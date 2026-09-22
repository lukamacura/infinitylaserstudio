-- ════════════════════════════════════════════════════════════════════════════
-- Secure booking — PHASE 1 (additive, safe to run while the old site is live)
--
-- Before: the public anon key could read/update every reservation directly
-- (names, emails, phones) and the admin "login" was a password shipped in the
-- JS bundle. Two simultaneous bookings for the same slot could both succeed.
--
-- After phase 1:
--   • admin_users + is_admin()   → real admin identity (Supabase Auth user id)
--   • "admin all" policies       → the logged-in admin keeps full access
--   • public_* functions         → the ONLY things the public booking form needs,
--                                   none of them return personal data
--   • public_create_booking      → validates everything server-side and takes a
--                                   per-date lock, so one slot = one booking
--
-- Nothing here removes access. The old public policies are dropped in phase 2
-- (sql/secure_booking_phase2.sql), only after the new site is deployed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Admin identity ──────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- No policies on purpose: only the security-definer function below reads it.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Admin policies (additive) ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'reservations', 'reservation_services', 'services',
    'weekly_schedule', 'availability_overrides', 'marketing_spend'
  ] loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- ── Public: busy time ranges (no personal data) ─────────────────────────────
create or replace function public.public_busy_slots(p_from date, p_to date)
returns table (date date, start_time time, end_time time, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.date, r.start_time, r.end_time, r.status
    from public.reservations r
   where r.date between p_from and least(p_to, p_from + 62)
     and r.status not in ('cancelled', 'blacklisted');
$$;

-- ── Public: has this email been here before? ────────────────────────────────
create or replace function public.public_is_returning(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reservations
     where lower(trim(customer_email)) = lower(trim(p_email))
       and status = 'confirmed'
  );
$$;

-- ── Bundle redemption check (shared by the form and create_booking) ─────────
-- Returns how many pre-paid sessions are still free for this email + code.
-- 0 = invalid / fully used. Buying the same bundle twice doubles the allowance.
create or replace function public.bundle_sessions_left(p_email text, p_code text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code      text := lower(trim(p_code));
  v_email     text := lower(trim(p_email));
  v_m         text[];
  v_purchases integer;
  v_used      integer;
begin
  v_m := regexp_match(v_code, '^paket-(\d+)-(\d+)$');
  if v_m is null then return 0; end if;

  select count(*) into v_purchases from public.reservations
   where lower(trim(customer_email)) = v_email
     and lower(trim(promo_code)) = v_code
     and status = 'confirmed';
  if v_purchases = 0 then return 0; end if;

  select count(*) into v_used from public.reservations
   where lower(trim(customer_email)) = v_email
     and lower(trim(promo_code)) = v_code || '-r'
     and status in ('confirmed', 'pending');

  return greatest(0, v_purchases * (v_m[1]::int - 1) - v_used);
end;
$$;
revoke all on function public.bundle_sessions_left(text, text) from public;
grant execute on function public.bundle_sessions_left(text, text) to anon, authenticated;

-- ── Public: create a booking — validated, locked, atomic ────────────────────
create or replace function public.public_create_booking(
  p_id            uuid,
  p_name          text,
  p_email         text,
  p_phone         text,
  p_customer_note text,
  p_date          date,
  p_start_time    time,
  p_service_ids   uuid[],
  p_promo_code    text,
  p_notes         text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email     text := trim(coalesce(p_email, ''));
  v_name      text := trim(coalesce(p_name, ''));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_promo     text := nullif(lower(trim(coalesce(p_promo_code, ''))), '');
  v_now       timestamp := now() at time zone 'Europe/Belgrade';
  v_today     date := (now() at time zone 'Europe/Belgrade')::date;
  v_existing  public.reservations%rowtype;
  v_ids       uuid[];
  v_count     integer;
  v_sum       integer;
  v_returning boolean;
  v_duration  integer;
  v_start     integer;
  v_end       integer;
  v_windows   jsonb;
  v_fits      boolean;
  v_m         text[];
begin
  -- 1. Idempotent retry: this id is already saved → report success again.
  select * into v_existing from public.reservations where id = p_id;
  if found then
    if lower(trim(v_existing.customer_email)) = lower(v_email) then
      return jsonb_build_object(
        'status', 'ok', 'id', v_existing.id,
        'end_time', to_char(v_existing.end_time, 'HH24:MI'),
        'total_duration', v_existing.total_duration,
        'returning', exists (
          select 1 from public.reservations
           where lower(trim(customer_email)) = lower(v_email)
             and status = 'confirmed' and id <> p_id));
    end if;
    return jsonb_build_object('status', 'invalid_input');
  end if;

  -- 2. Basic input checks.
  if p_id is null or p_date is null or p_start_time is null
     or length(v_name) = 0 or length(v_name) > 120
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200
     or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 or length(v_phone) > 40
     or length(coalesce(p_customer_note, '')) > 1000
     or length(coalesce(p_notes, '')) > 500
     or extract(minute from p_start_time)::int % 10 <> 0
     or extract(second from p_start_time) <> 0 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_service_ids) x;
  if v_ids is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 20 then
    return jsonb_build_object('status', 'invalid_input');
  end if;
  select count(*), coalesce(sum(service_duration), 0) into v_count, v_sum
    from public.services where id = any (v_ids);
  if v_count <> cardinality(v_ids) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  -- 3. Date inside the public horizon, start not in the past.
  if p_date < v_today or p_date > v_today + 15
     or (p_date + p_start_time) <= v_now then
    return jsonb_build_object('status', 'too_late');
  end if;

  -- 4. One booking at a time per date - the rest of the checks run under this lock.
  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || p_date::text, 0));

  v_returning := exists (
    select 1 from public.reservations
     where lower(trim(customer_email)) = lower(v_email) and status = 'confirmed');

  -- Mirrors lib/supabase.ts: +5 min pause for 2+ regions, +10 min consultation
  -- for first-timers, rounded up to the 10-minute grid.
  v_sum := v_sum + case when cardinality(v_ids) >= 2 then 5 else 0 end
                 + case when v_returning then 0 else 10 end;
  v_duration := ceil(v_sum / 10.0)::int * 10;
  v_start := extract(hour from p_start_time)::int * 60 + extract(minute from p_start_time)::int;
  v_end   := v_start + v_duration;

  -- 5. Inside working hours (per-date override wins over the weekly template).
  select windows into v_windows from public.availability_overrides where date = p_date;
  if not found then
    select windows into v_windows from public.weekly_schedule
     where weekday = extract(isodow from p_date)::int - 1;
  end if;
  select exists (
    select 1 from jsonb_array_elements(coalesce(v_windows, '[]'::jsonb)) w
     where (w->>'start')::int <= v_start and (w->>'end')::int >= v_end
  ) into v_fits;
  if not v_fits then
    return jsonb_build_object('status', 'slot_taken');
  end if;

  -- 6. No overlap with any active booking (admin-made ones included).
  if exists (
    select 1 from public.reservations r
     where r.date = p_date
       and r.status not in ('cancelled', 'blacklisted')
       and r.start_time < make_time(v_end / 60, v_end % 60, 0)
       and r.end_time   > p_start_time
  ) then
    return jsonb_build_object('status', 'slot_taken');
  end if;

  -- 7. Promo codes. ils- codes are admin-only and never accepted here.
  if v_promo is not null then
    if v_promo = 'student20' then
      if v_returning then
        return jsonb_build_object('status', 'invalid_promo', 'reason', 'student_not_first');
      end if;
    elsif v_promo ~ '^paket-\d+-\d+$' then
      v_m := regexp_match(v_promo, '^paket-(\d+)-(\d+)$');
      if v_m[1]::int not in (3, 6, 8, 10) or v_m[2]::int <= 0 then
        return jsonb_build_object('status', 'invalid_promo');
      end if;
    elsif v_promo ~ '^paket-\d+-\d+-r$' then
      if public.bundle_sessions_left(v_email, left(v_promo, -2)) <= 0 then
        return jsonb_build_object('status', 'invalid_promo', 'reason', 'bundle_used');
      end if;
    else
      return jsonb_build_object('status', 'invalid_promo');
    end if;
  end if;

  -- 8. Save the booking and its regions in one transaction.
  insert into public.reservations (
    id, customer_name, customer_email, customer_phone, customer_note, notes,
    date, start_time, end_time, total_duration, status, promo_code
  ) values (
    p_id, v_name, v_email, v_phone, nullif(trim(coalesce(p_customer_note, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_date, p_start_time, make_time(v_end / 60, v_end % 60, 0), v_duration,
    'confirmed', v_promo
  );
  insert into public.reservation_services (reservation_id, service_id)
  select p_id, unnest(v_ids);

  return jsonb_build_object(
    'status', 'ok', 'id', p_id,
    'end_time', lpad((v_end / 60)::text, 2, '0') || ':' || lpad((v_end % 60)::text, 2, '0'),
    'total_duration', v_duration,
    'returning', v_returning);
end;
$$;

-- Callable by the public site; nothing else about these functions is exposed.
revoke all on function public.public_busy_slots(date, date) from public;
revoke all on function public.public_is_returning(text) from public;
revoke all on function public.public_create_booking(uuid, text, text, text, text, date, time, uuid[], text, text) from public;
grant execute on function public.public_busy_slots(date, date) to anon, authenticated;
grant execute on function public.public_is_returning(text) to anon, authenticated;
grant execute on function public.public_create_booking(uuid, text, text, text, text, date, time, uuid[], text, text) to anon, authenticated;
