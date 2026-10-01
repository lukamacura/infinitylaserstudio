-- ─────────────────────────────────────────────────────────────────────────────
-- Second studio (Sombor) - PHASE 1. Run BEFORE deploying the code that knows
-- about locations.
--
-- Purely additive and backwards compatible: the code that is live today keeps
-- working untouched, because
--   • every new `location` column defaults to 'novi_sad', so all existing rows
--     (and anything the old code inserts) belong to Novi Sad,
--   • the booking functions gain a `p_location` argument that defaults to
--     'novi_sad', so the old 2-/10-argument calls still resolve,
--   • the old primary keys stay in place (old upserts use ON CONFLICT on them).
--
-- No row is deleted or rewritten. Sombor rows in weekly_schedule /
-- availability_overrides / marketing_spend become possible only after
-- sql/locations_phase2.sql (run once the new code is live).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Which studio a row belongs to ────────────────────────────────────────────
alter table public.reservations
  add column if not exists location text not null default 'novi_sad'
  constraint reservations_location_check check (location in ('novi_sad', 'sombor'));

alter table public.weekly_schedule
  add column if not exists location text not null default 'novi_sad'
  constraint weekly_schedule_location_check check (location in ('novi_sad', 'sombor'));

alter table public.availability_overrides
  add column if not exists location text not null default 'novi_sad'
  constraint availability_overrides_location_check check (location in ('novi_sad', 'sombor'));

alter table public.marketing_spend
  add column if not exists location text not null default 'novi_sad'
  constraint marketing_spend_location_check check (location in ('novi_sad', 'sombor'));

create index if not exists reservations_location_date_idx
  on public.reservations (location, date);

-- Targets for the new code's upserts (ON CONFLICT (location, …)). They live
-- next to the old primary keys for now and replace them in phase 2.
create unique index if not exists weekly_schedule_location_weekday_key
  on public.weekly_schedule (location, weekday);
create unique index if not exists availability_overrides_location_date_key
  on public.availability_overrides (location, date);
create unique index if not exists marketing_spend_location_month_key
  on public.marketing_spend (location, month);

-- 2. Busy slots - one studio's calendar ───────────────────────────────────────
drop function if exists public.public_busy_slots(date, date);
create function public.public_busy_slots(p_from date, p_to date, p_location text default 'novi_sad')
returns table (date date, start_time time, end_time time, status text)
language sql stable security definer set search_path = ''
as $$
  select r.date, r.start_time, r.end_time, r.status from public.reservations r
   where r.location = p_location
     and r.date between p_from and least(p_to, p_from + 62)
     and r.status not in ('cancelled', 'blacklisted');
$$;

-- 3. Pre-paid bundle sessions - a bundle is redeemed where it was bought ──────
drop function if exists public.bundle_sessions_left(text, text);
create function public.bundle_sessions_left(p_email text, p_code text, p_location text default 'novi_sad')
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_code text := lower(trim(p_code)); v_email text := lower(trim(p_email));
  v_m text[]; v_purchases integer; v_used integer;
begin
  v_m := regexp_match(v_code, '^paket-(\d+)-(\d+)$');
  if v_m is null then return 0; end if;
  select count(*) into v_purchases from public.reservations
   where lower(trim(customer_email)) = v_email and lower(trim(promo_code)) = v_code
     and status = 'confirmed' and location = p_location;
  if v_purchases = 0 then return 0; end if;
  select count(*) into v_used from public.reservations
   where lower(trim(customer_email)) = v_email and lower(trim(promo_code)) = v_code || '-r'
     and status in ('confirmed', 'pending') and location = p_location;
  return greatest(0, v_purchases * (v_m[1]::int - 1) - v_used);
end; $$;

-- 4. Booking - slot, working hours and lock are all per studio ────────────────
-- Identical to the previous version except for the lines marked [location].
drop function if exists public.public_create_booking(uuid, text, text, text, text, date, time, uuid[], text, text);
create function public.public_create_booking(
  p_id uuid, p_name text, p_email text, p_phone text, p_customer_note text,
  p_date date, p_start_time time, p_service_ids uuid[], p_promo_code text, p_notes text,
  p_location text default 'novi_sad'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := trim(coalesce(p_email, ''));
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_promo text := nullif(lower(trim(coalesce(p_promo_code, ''))), '');
  v_now timestamp := now() at time zone 'Europe/Belgrade';
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
  v_existing public.reservations%rowtype;
  v_ids uuid[]; v_count integer; v_sum integer; v_returning boolean;
  v_duration integer; v_start integer; v_end integer; v_windows jsonb; v_fits boolean; v_m text[];
begin
  select * into v_existing from public.reservations where id = p_id;
  if found then
    if lower(trim(v_existing.customer_email)) = lower(v_email) then
      return jsonb_build_object('status','ok','id',v_existing.id,
        'end_time', to_char(v_existing.end_time,'HH24:MI'),
        'total_duration', v_existing.total_duration,
        'returning', exists (select 1 from public.reservations
           where lower(trim(customer_email)) = lower(v_email) and status = 'confirmed' and id <> p_id));
    end if;
    return jsonb_build_object('status','invalid_input');
  end if;

  if p_id is null or p_date is null or p_start_time is null
     or p_location is null or p_location not in ('novi_sad', 'sombor')   -- [location]
     or length(v_name) = 0 or length(v_name) > 120
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200
     or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 or length(v_phone) > 40
     or length(coalesce(p_customer_note, '')) > 1000
     or length(coalesce(p_notes, '')) > 500
     or extract(minute from p_start_time)::int % 10 <> 0
     or extract(second from p_start_time) <> 0 then
    return jsonb_build_object('status','invalid_input');
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_service_ids) x;
  if v_ids is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 20 then
    return jsonb_build_object('status','invalid_input');
  end if;
  select count(*), coalesce(sum(service_duration), 0) into v_count, v_sum from public.services where id = any (v_ids);
  if v_count <> cardinality(v_ids) then return jsonb_build_object('status','invalid_input'); end if;

  if p_date < v_today or p_date > v_today + 15 or (p_date + p_start_time) <= v_now then
    return jsonb_build_object('status','too_late');
  end if;

  -- [location] one lock per studio per day
  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || p_location || ':' || p_date::text, 0));

  -- A client is "returning" across the whole brand, not per studio.
  v_returning := exists (select 1 from public.reservations
     where lower(trim(customer_email)) = lower(v_email) and status = 'confirmed');

  v_sum := v_sum + case when cardinality(v_ids) >= 2 then 5 else 0 end + case when v_returning then 0 else 10 end;
  v_duration := ceil(v_sum / 10.0)::int * 10;
  v_start := extract(hour from p_start_time)::int * 60 + extract(minute from p_start_time)::int;
  v_end := v_start + v_duration;

  select windows into v_windows from public.availability_overrides
   where date = p_date and location = p_location;                        -- [location]
  if not found then
    select windows into v_windows from public.weekly_schedule
     where weekday = extract(isodow from p_date)::int - 1 and location = p_location;  -- [location]
  end if;
  select exists (select 1 from jsonb_array_elements(coalesce(v_windows, '[]'::jsonb)) w
     where (w->>'start')::int <= v_start and (w->>'end')::int >= v_end) into v_fits;
  if not v_fits then return jsonb_build_object('status','slot_taken'); end if;

  if exists (select 1 from public.reservations r
     where r.date = p_date and r.location = p_location                   -- [location]
       and r.status not in ('cancelled','blacklisted')
       and r.start_time < make_time(v_end / 60, v_end % 60, 0) and r.end_time > p_start_time) then
    return jsonb_build_object('status','slot_taken');
  end if;

  if v_promo is not null then
    if v_promo = 'student20' then
      if v_returning then return jsonb_build_object('status','invalid_promo','reason','student_not_first'); end if;
    elsif v_promo ~ '^paket-\d+-\d+$' then
      v_m := regexp_match(v_promo, '^paket-(\d+)-(\d+)$');
      if v_m[1]::int not in (3,6,8,10) or v_m[2]::int <= 0 then return jsonb_build_object('status','invalid_promo'); end if;
    elsif v_promo ~ '^paket-\d+-\d+-r$' then
      if public.bundle_sessions_left(v_email, left(v_promo, -2), p_location) <= 0 then   -- [location]
        return jsonb_build_object('status','invalid_promo','reason','bundle_used');
      end if;
    else
      return jsonb_build_object('status','invalid_promo');
    end if;
  end if;

  insert into public.reservations (id, customer_name, customer_email, customer_phone, customer_note, notes,
    date, start_time, end_time, total_duration, status, promo_code, location)          -- [location]
  values (p_id, v_name, v_email, v_phone, nullif(trim(coalesce(p_customer_note, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), p_date, p_start_time, make_time(v_end / 60, v_end % 60, 0),
    v_duration, 'confirmed', v_promo, p_location);
  insert into public.reservation_services (reservation_id, service_id) select p_id, unnest(v_ids);

  return jsonb_build_object('status','ok','id',p_id,
    'end_time', lpad((v_end / 60)::text, 2, '0') || ':' || lpad((v_end % 60)::text, 2, '0'),
    'total_duration', v_duration, 'returning', v_returning);
end; $$;

-- 5. Same access as before ────────────────────────────────────────────────────
revoke all on function public.public_busy_slots(date, date, text) from public;
revoke all on function public.bundle_sessions_left(text, text, text) from public;
revoke all on function public.public_create_booking(uuid, text, text, text, text, date, time, uuid[], text, text, text) from public;
grant execute on function public.public_busy_slots(date, date, text) to anon, authenticated;
grant execute on function public.bundle_sessions_left(text, text, text) to anon, authenticated;
grant execute on function public.public_create_booking(uuid, text, text, text, text, date, time, uuid[], text, text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
