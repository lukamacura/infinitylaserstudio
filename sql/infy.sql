-- ─────────────────────────────────────────────────────────────────────────────
-- Infy - the admin's assistant. Everything here is additive: the live site and
-- the live admin keep working whether or not the new code is deployed.
--
--   upiti.remind_on            — "javi mi tog dana" for a follow-up
--   upiti_list(...)            — now also says when each one is due (due_on)
--   admin_create_booking(...)  — a booking made by staff (the admin modal and
--                                Infy), checked and saved under the same day
--                                lock as a booking from the site
--   admin_cancel_reservation() — staff cancel, with a line in the notes
--   infy_facts()               — the facts Infy's daily / weekly brief is made of
--
-- Nothing writes to kartoni: the booking triggers keep the cards as before.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── Follow-ups on the call list ──────────────────────────────────────────────

-- A day to come back to someone. Empty: three days after they were written in
-- (or after the last time staff got in touch).
alter table public.upiti add column if not exists remind_on date;

drop function if exists public.upiti_list(boolean, integer, integer);

/**
 * The list. p_open = true: who still has to be called, oldest first (the order
 * they were written in). p_open = false: the crossed-out ones, newest first.
 * due_on: when Infy brings them up - remind_on, or 3 days after the inquiry /
 * the last contact. Runs as the caller, so the tables' admin-only policies apply.
 */
create function public.upiti_list(p_open boolean default true, p_limit integer default 200, p_offset integer default 0)
returns table (
  id uuid, name text, phone text, source text, note text, location text,
  status text, saved_status text, attempts integer, last_call_at timestamptz,
  created_at timestamptz, done_at timestamptz,
  karton_id uuid, karton_number integer, karton_name text,
  booked_date date, booked_time time, booked_location text, booked_after boolean,
  remind_on date, due_on date,
  total bigint
)
language sql stable set search_path to '' as $$
  with base as (
    select u.*, kc.k_id, kc.k_number, kc.k_name,
           b.r_date, b.r_time, b.r_location, b.r_created, coalesce(b.r_after, false) as r_after
      from public.upiti u
      -- Their card: a client with this phone, or one who booked with it once.
      -- A matching name first, so a mother's card loses to her daughter's.
      left join lateral (
        select k.id as k_id, k.number as k_number, c.name as k_name
          from (
            select c0.id as client_id, 0 as pref, c0.created_at as at
              from public.clients c0 where c0.phone_norm = u.phone_norm
            union all
            select r0.client_id, 1, r0.created_at
              from public.reservations r0
             where public.karton_norm_phone(r0.customer_phone) = u.phone_norm and r0.client_id is not null
          ) m
          join public.clients c on c.id = m.client_id
          join public.kartoni k on k.client_id = c.id
         order by public.karton_same_person(c.name_norm, public.karton_norm_name(u.name)) desc, m.pref, m.at desc
         limit 1
      ) kc on true
      -- A live booking with this phone from the day of the inquiry on. Made
      -- after the inquiry (a day's slack: it is often written in late) means
      -- they booked; an older one is only shown.
      left join lateral (
        select r.date as r_date, r.start_time as r_time, r.location as r_location, r.created_at as r_created,
               r.created_at >= u.created_at - interval '1 day' as r_after
          from public.reservations r
         where public.karton_norm_phone(r.customer_phone) = u.phone_norm
           and r.status in ('pending', 'confirmed')
           and r.date >= (u.created_at at time zone 'Europe/Belgrade')::date
         order by (r.created_at >= u.created_at - interval '1 day') desc, r.date, r.start_time
         limit 1
      ) b on true
  ),
  shown as (
    select base.*,
           case when r_after then 'booked' else base.status end as eff_status,
           case when r_after and base.status = 'open' then r_created else base.closed_at end as eff_done
      from base
  )
  select s.id, s.name, s.phone, s.source, s.note, s.location,
         s.eff_status, s.status, s.attempts::integer, s.last_call_at,
         s.created_at, s.eff_done,
         s.k_id, s.k_number, s.k_name,
         s.r_date, s.r_time, s.r_location, s.r_after,
         s.remind_on,
         coalesce(s.remind_on, (coalesce(s.last_call_at, s.created_at) at time zone 'Europe/Belgrade')::date + 3),
         count(*) over ()
    from shown s
   where (s.eff_status = 'open') = coalesce(p_open, true)
   order by
     case when coalesce(p_open, true) then s.created_at end asc,
     case when not coalesce(p_open, true) then coalesce(s.eff_done, s.updated_at) end desc,
     s.created_at desc
   limit greatest(1, least(coalesce(p_limit, 200), 500)) offset greatest(coalesce(p_offset, 0), 0);
$$;

/** How many are still to be called - the badge in the admin menu. */
create or replace function public.upiti_open_count()
returns integer language sql stable set search_path to '' as $$
  select count(*)::integer from public.upiti_list(true, 500, 0);
$$;

revoke all on function public.upiti_list(boolean, integer, integer) from public, anon;
revoke all on function public.upiti_open_count() from public, anon;
grant execute on function public.upiti_list(boolean, integer, integer) to authenticated, service_role;
grant execute on function public.upiti_open_count() to authenticated, service_role;

-- ── A booking made by staff ──────────────────────────────────────────────────

/**
 * The admin modal and Infy book through here. Same day lock, same duration
 * rules and the same overlap check as public_create_booking, with the staff
 * rules: any day and any time of day (only a taken time is refused), email and
 * phone optional, every promo code the admin knows, an internal note.
 *
 * p_with_consultation: the 10-minute consultation of a first visit - decided
 * by the caller, who showed the client's history before saving.
 * p_id is chosen by the caller: a retry after a lost answer finds the booking
 * already saved instead of making a second one.
 */
create or replace function public.admin_create_booking(
  p_id                uuid,
  p_location          text,
  p_name              text,
  p_email             text,
  p_phone             text,
  p_date              date,
  p_start_time        time,
  p_service_ids       uuid[],
  p_with_consultation boolean,
  p_promo_code        text,
  p_notes             text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name     text := trim(coalesce(p_name, ''));
  v_email    text := trim(coalesce(p_email, ''));
  v_phone    text := nullif(trim(coalesce(p_phone, '')), '');
  v_promo    text := nullif(lower(trim(coalesce(p_promo_code, ''))), '');
  v_notes    text := nullif(trim(coalesce(p_notes, '')), '');
  v_now      timestamp := now() at time zone 'Europe/Belgrade';
  v_existing public.reservations%rowtype;
  v_clash    public.reservations%rowtype;
  v_ids      uuid[];
  v_count    integer;
  v_sum      integer;
  v_regions  integer;
  v_merge    integer;
  v_duration integer;
  v_start    integer;
  v_end      integer;
  v_end_time time;
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  -- 1. The same booking again (a retry): report it as saved.
  select * into v_existing from public.reservations where id = p_id;
  if found then
    if v_existing.date = p_date and v_existing.start_time = p_start_time
       and v_existing.location = p_location and v_existing.customer_name = v_name then
      return jsonb_build_object(
        'status', 'ok', 'id', v_existing.id,
        'end_time', to_char(v_existing.end_time, 'HH24:MI'),
        'total_duration', v_existing.total_duration);
    end if;
    return jsonb_build_object('status', 'invalid_input');
  end if;

  -- 2. Input.
  if p_id is null or p_date is null or p_start_time is null or p_with_consultation is null
     or p_location is null or p_location not in ('novi_sad', 'sombor')
     or length(v_name) = 0 or length(v_name) > 120
     or (v_email <> '' and (v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200))
     or length(coalesce(v_phone, '')) > 40
     or length(coalesce(v_promo, '')) > 60
     or length(coalesce(v_notes, '')) > 1000
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

  -- 3. Not in the past (a few minutes of slack for a slow phone).
  if (p_date + p_start_time) < v_now - interval '5 minutes' then
    return jsonb_build_object('status', 'too_late');
  end if;

  -- 4. One booking at a time per studio and day - same key as the site.
  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || p_location || ':' || p_date::text, 0));

  -- Mirrors lib/supabase.ts: earrings + chin count as one region, +5 min pause
  -- for 2+ regions, +10 min consultation, rounded up to the 10-minute grid.
  v_regions := cardinality(v_ids);
  select least(e.service_duration, c.service_duration) into v_merge
    from public.services e, public.services c
   where e.id = any (v_ids) and c.id = any (v_ids)
     and lower(e.name) like '%nausnice%' and lower(e.name) not like '%brada%'
     and lower(c.name) like '%brada%' and lower(c.name) not like '%nausnice%'
   limit 1;
  if v_merge is not null then
    v_sum := v_sum - v_merge;
    v_regions := v_regions - 1;
  end if;
  v_sum := v_sum + case when v_regions >= 2 then 5 else 0 end
                 + case when p_with_consultation then 10 else 0 end;
  v_duration := ceil(v_sum / 10.0)::int * 10;
  v_start := extract(hour from p_start_time)::int * 60 + extract(minute from p_start_time)::int;
  v_end   := v_start + v_duration;
  if v_duration <= 0 or v_end >= 24 * 60 then
    return jsonb_build_object('status', 'invalid_input');
  end if;
  v_end_time := make_time(v_end / 60, v_end % 60, 0);

  -- 5. No overlap with any active booking in this studio.
  select * into v_clash from public.reservations o
   where o.date = p_date and o.location = p_location
     and o.status not in ('cancelled', 'blacklisted')
     and o.start_time < v_end_time and o.end_time > p_start_time
   order by o.start_time
   limit 1;
  if found then
    return jsonb_build_object(
      'status',      'slot_taken',
      'clash_name',  v_clash.customer_name,
      'clash_start', to_char(v_clash.start_time, 'HH24:MI'),
      'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;

  -- 6. A pre-paid bundle treatment must still be left on that bundle.
  if v_promo ~ '^paket-\d+-\d+-r$' then
    if v_email = '' or public.bundle_sessions_left(v_email, left(v_promo, -2), p_location) <= 0 then
      return jsonb_build_object('status', 'invalid_promo', 'reason', 'bundle_used');
    end if;
  end if;

  -- 7. The booking and its regions, in one transaction.
  insert into public.reservations (
    id, customer_name, customer_email, customer_phone, notes,
    date, start_time, end_time, total_duration, status, promo_code, location
  ) values (
    p_id, v_name, v_email, v_phone, v_notes,
    p_date, p_start_time, v_end_time, v_duration, 'confirmed', v_promo, p_location
  );
  insert into public.reservation_services (reservation_id, service_id)
  select p_id, unnest(v_ids);

  return jsonb_build_object(
    'status', 'ok', 'id', p_id,
    'end_time', to_char(v_end_time, 'HH24:MI'),
    'total_duration', v_duration);
end;
$$;

revoke all on function public.admin_create_booking(uuid, text, text, text, text, date, time, uuid[], boolean, text, text) from public, anon;
grant execute on function public.admin_create_booking(uuid, text, text, text, text, date, time, uuid[], boolean, text, text) to authenticated;

-- ── A cancellation by staff ──────────────────────────────────────────────────

/**
 * Cancels one appointment and writes when (and why, if given) in its notes.
 * Answers with what the "Termin je otkazan" email needs. A second call says
 * 'already' and changes nothing.
 */
create or replace function public.admin_cancel_reservation(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r        public.reservations%rowtype;
  v_reason text := left(nullif(trim(coalesce(p_reason, '')), ''), 200);
  v_line   text;
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_id is null then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select * into r from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if r.status = 'blacklisted' then
    return jsonb_build_object('status', 'inactive');
  end if;

  if r.status <> 'cancelled' then
    v_line := 'Otkazano ' || to_char(now() at time zone 'Europe/Belgrade', 'FMDD.FMMM. HH24:MI')
              || coalesce(': ' || v_reason, '');
    update public.reservations
       set status = 'cancelled',
           notes  = concat_ws(' · ', nullif(trim(coalesce(r.notes, '')), ''), v_line)
     where id = r.id;
  end if;

  return jsonb_build_object(
    'status',         case when r.status = 'cancelled' then 'already' else 'ok' end,
    'id',             r.id,
    'customer_name',  r.customer_name,
    'customer_email', trim(coalesce(r.customer_email, '')),
    'location',       r.location,
    'date',           r.date,
    'start_time',     to_char(r.start_time, 'HH24:MI'),
    'end_time',       to_char(r.end_time, 'HH24:MI'),
    'total_duration', r.total_duration,
    -- Only an appointment still ahead is worth an email to the client.
    'upcoming',       (r.date + r.start_time) > (now() at time zone 'Europe/Belgrade'),
    'services',       coalesce((
      select jsonb_agg(s.name order by s.sort_order, s.name)
        from public.reservation_services rs
        join public.services s on s.id = rs.service_id
       where rs.reservation_id = r.id), '[]'::jsonb));
end;
$$;

revoke all on function public.admin_cancel_reservation(uuid, text) from public, anon;
grant execute on function public.admin_cancel_reservation(uuid, text) to authenticated;

-- ── The brief ────────────────────────────────────────────────────────────────

/**
 * What Infy's brief is made of, for both studios at once. Admin only (it also
 * reads the site's funnel, which has no policy for anyone). Working hours, free
 * gaps and how full the days are come from lib/infy/brief.ts (they need the
 * calendar rules).
 *
 * p_return_weeks: a client whose last treatment is at least this many weeks
 * ago (and at most half a year), with nothing booked since, is due to come back.
 */
create or replace function public.infy_facts(p_return_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  return (
  with
  b as (
    select (now() at time zone 'Europe/Belgrade')::date as d,
           (((now() at time zone 'Europe/Belgrade')::date - 1)::timestamp at time zone 'Europe/Belgrade') as since,
           greatest(coalesce(p_return_weeks, 8), 1) * 7 as return_days
  ),
  -- Confirmed first visits in the next days that nobody has called yet -
  -- the admin's "Pozivi" tab: an email that appears once among confirmed bookings.
  calls as (
    select r.id, r.customer_name as name, r.customer_phone as phone, r.date,
           to_char(r.start_time, 'HH24:MI') as start, r.location, r.call_status,
           r.call_attempted_at
      from public.reservations r, b
     where r.status = 'confirmed' and r.call_status <> 'answered'
       and r.date between b.d and b.d + 3
       and trim(coalesce(r.customer_email, '')) <> ''
       and not exists (
         select 1 from public.reservations o
          where o.id <> r.id and o.status = 'confirmed'
            and lower(trim(o.customer_email)) = lower(trim(r.customer_email)))
     order by r.date, r.start_time
     limit 40
  ),
  open_upiti as (
    select * from public.upiti_list(true, 500, 0)
  ),
  upiti_due as (
    select u.id, u.name, u.phone, u.source, u.note, u.created_at, u.last_call_at,
           u.attempts, u.remind_on, u.due_on, u.karton_id, u.karton_number
      from open_upiti u, b
     where u.due_on <= b.d
     order by u.due_on, u.created_at
     limit 40
  ),
  -- Booked since yesterday morning. online: the site's funnel logged the
  -- booking at the same second (staff bookings never pass through it).
  booked as (
    select r.id, r.customer_name as name, r.date, to_char(r.start_time, 'HH24:MI') as start,
           r.location, r.status, r.created_at,
           exists (
             select 1 from public.booking_funnel_events f
              where f.stage = 'booked' and f.created_at >= b.since - interval '1 minute'
                and f.created_at between r.created_at - interval '5 seconds' and r.created_at + interval '5 seconds'
           ) as online
      from public.reservations r, b
     where r.created_at >= b.since
     order by r.created_at desc
  ),
  upiti_booked as (
    select u.id, u.name, u.booked_date, to_char(u.booked_time, 'HH24:MI') as booked_time
      from public.upiti_list(false, 200, 0) u, b
     where u.status = 'booked' and u.done_at >= b.since
  ),
  client_cancels as (
    select r.id, r.customer_name as name, r.date, to_char(r.start_time, 'HH24:MI') as start,
           r.location, r.late_cancel as late, r.client_cancelled_at
      from public.reservations r, b
     where r.client_cancelled_at >= b.since
     order by r.client_cancelled_at desc
  ),
  -- Due back: last treatment between return_days and ~6 months ago, nothing
  -- after it (a booking makes a row on the card), never blacklisted.
  ret as (
    select k.id as karton_id, k.number, c.name, c.phone, s.last_date, s.visits, s.location
      from public.kartoni k
      join public.clients c on c.id = k.client_id
      join lateral (
        select max(kr.date) as last_date, count(*)::integer as visits,
               (array_agg(kr.location order by kr.date desc))[1] as location
          from public.karton_rows kr where kr.karton_id = k.id
      ) s on true
      cross join b
     where s.last_date between b.d - 183 and b.d - b.return_days
       and not exists (
         select 1 from public.reservations x where x.client_id = c.id and x.status = 'blacklisted')
  ),
  today as (
    select r.location, count(*)::integer as n,
           to_char(min(r.start_time), 'HH24:MI') as first_start,
           to_char(max(r.end_time), 'HH24:MI') as last_end
      from public.reservations r, b
     where r.date = b.d and r.status in ('pending', 'confirmed')
     group by r.location
  ),
  week as (
    select l.location,
           (select count(*) from public.reservations r, b
             where r.location = l.location and r.date between b.d - 7 and b.d - 1 and r.status = 'confirmed')::integer as visits,
           (select count(*) from public.reservations r, b
             where r.location = l.location and r.date between b.d - 7 and b.d - 1 and r.status = 'cancelled')::integer as cancelled,
           (select count(*) from public.reservations r, b
             where r.location = l.location and r.date between b.d - 7 and b.d - 1 and r.status = 'blacklisted')::integer as blacklisted,
           (select count(*) from public.reservations r, b
             where r.location = l.location
               and r.created_at >= ((b.d - 7)::timestamp at time zone 'Europe/Belgrade')
               and r.created_at <  (b.d::timestamp at time zone 'Europe/Belgrade'))::integer as created,
           (select count(*) from public.booking_funnel_events f, b
             where f.location = l.location and f.stage = 'booked'
               and f.created_at >= ((b.d - 7)::timestamp at time zone 'Europe/Belgrade')
               and f.created_at <  (b.d::timestamp at time zone 'Europe/Belgrade'))::integer as online,
           (select count(*) from public.reservations r, b
             where r.location = l.location and r.date between b.d and b.d + 6
               and r.status in ('pending', 'confirmed'))::integer as next_week
      from (values ('novi_sad'), ('sombor')) as l(location)
  )
  select jsonb_build_object(
    'today_date', (select d from b),
    'return_weeks', (select return_days / 7 from b),
    'today', coalesce((select jsonb_agg(to_jsonb(t)) from today t), '[]'::jsonb),
    'calls', coalesce((select jsonb_agg(to_jsonb(c)) from calls c), '[]'::jsonb),
    'upiti_due', coalesce((select jsonb_agg(to_jsonb(u)) from upiti_due u), '[]'::jsonb),
    'upiti_open', (select count(*) from open_upiti),
    'upiti_next_due', (select min(due_on) from open_upiti u, b where u.due_on > b.d),
    'booked', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from booked limit 60) x), '[]'::jsonb),
    'booked_total', (select count(*) from booked),
    'booked_online', (select count(*) from booked where online),
    'upiti_booked', coalesce((select jsonb_agg(to_jsonb(u)) from upiti_booked u), '[]'::jsonb),
    'client_cancels', coalesce((select jsonb_agg(to_jsonb(c)) from client_cancels c), '[]'::jsonb),
    'return_due', coalesce((select jsonb_agg(to_jsonb(x)) from (
                    select * from ret order by last_date desc, name limit 25) x), '[]'::jsonb),
    'return_total', (select count(*) from ret),
    'week', coalesce((select jsonb_agg(to_jsonb(w)) from week w), '[]'::jsonb),
    'week_new_clients', (select count(*) from public.clients c, b
                          where c.created_at >= ((b.d - 7)::timestamp at time zone 'Europe/Belgrade')
                            and c.created_at <  (b.d::timestamp at time zone 'Europe/Belgrade')),
    'week_upiti_added', (select count(*) from public.upiti u, b
                          where u.created_at >= ((b.d - 7)::timestamp at time zone 'Europe/Belgrade')
                            and u.created_at <  (b.d::timestamp at time zone 'Europe/Belgrade'))
  ));
end;
$$;

revoke all on function public.infy_facts(integer) from public, anon;
grant execute on function public.infy_facts(integer) to authenticated;

commit;
