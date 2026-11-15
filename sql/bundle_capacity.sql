-- ─────────────────────────────────────────────────────────────────────────────
-- Package capacity (2026-11-15). The site stops selling packages for a month
-- once packages take more than 30% of that month's working time.
--
--   share = minutes of package visits in the month
--             (first visit "paket-N-T" + prepaid visits "paket-N-T-r",
--              not cancelled / blacklisted, booked online or in the admin)
--         ÷ minutes all lasers of the studio work in the month
--             (each laser's date exception, else its weekday hours, from its
--              first working day; past days of the month count too)
--   closed when share > 30%. Each studio on its own; the month is the month
--   of the visit being booked.
--
-- What this file changes:
--   1. NEW FUNCTION bundle_month_open(location, day)      - the rule (internal)
--   2. NEW FUNCTION public_bundle_closed_months(location) - read by the booking
--      form: the months from now to the end of the booking window that are full
--   3. public_create_booking - refuses a NEW package (paket-N-T) in a full
--      month: status invalid_promo, reason bundles_full. Prepaid visits (-r)
--      always pass. The admin (admin_create_booking) is not limited.
--
-- Apply AFTER the booking form that reads it is deployed: until then the old
-- form shows "Nevažeći promo kod" for a refused package. The new form works
-- without this file (it then offers packages as before).
-- Running it a second time changes nothing.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. bundle_month_open ─────────────────────────────────────────────────────────
create or replace function public.bundle_month_open(p_location text, p_day date)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  with bounds as (
    select date_trunc('month', p_day::timestamp)::date                       as m_from,
           (date_trunc('month', p_day::timestamp) + interval '1 month')::date as m_to
  ),
  laser_days as (
    select l.laser, d::date as day
      from public.lasers l
     cross join bounds b
     cross join generate_series(b.m_from::timestamp, (b.m_to - 1)::timestamp, interval '1 day') d
     where l.location = p_location
       and (l.active_from is null or l.active_from <= d::date)
  ),
  -- A laser's hours on a day, overlapping windows counted once.
  capacity as (
    select coalesce(sum(upper(w) - lower(w)), 0) as mins
      from laser_days ld
     cross join lateral (
       select range_agg(int4range((x->>'start')::int, (x->>'end')::int)) as hours
         from jsonb_array_elements(coalesce(
                (select o.windows from public.availability_overrides o
                  where o.location = p_location and o.laser = ld.laser and o.date = ld.day),
                (select s.windows from public.weekly_schedule s
                  where s.location = p_location and s.laser = ld.laser
                    and s.weekday = extract(isodow from ld.day)::int - 1),
                '[]'::jsonb)) x
        where (x->>'end')::int > (x->>'start')::int
     ) h
     cross join lateral unnest(h.hours) w
  ),
  packages as (
    select coalesce(sum(extract(epoch from (r.end_time - r.start_time)) / 60), 0) as mins
      from public.reservations r
     cross join bounds b
     where r.location = p_location
       and r.date >= b.m_from and r.date < b.m_to
       and r.status not in ('cancelled', 'blacklisted')
       and lower(trim(r.promo_code)) ~ '^paket-\d+-\d+(-r)?$'
  )
  -- Open while packages take at most 30% (no hours and no packages = open).
  select p.mins * 100 <= c.mins * 30
    from packages p, capacity c;
$$;

revoke all on function public.bundle_month_open(text, date) from public, anon, authenticated;

-- 2. public_bundle_closed_months ───────────────────────────────────────────────
-- Months (YYYY-MM) from this month to the end of the booking window
-- (today + 22, the server's slack) in which a new package can't be booked.
create or replace function public.public_bundle_closed_months(p_location text)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(to_char(m, 'YYYY-MM') order by m), '{}'::text[])
    from generate_series(
           date_trunc('month', (now() at time zone 'Europe/Belgrade')::date::timestamp),
           date_trunc('month', ((now() at time zone 'Europe/Belgrade')::date + 22)::timestamp),
           interval '1 month') m
   where p_location in ('novi_sad', 'sombor')
     and not public.bundle_month_open(p_location, m::date);
$$;

revoke all on function public.public_bundle_closed_months(text) from public;
grant execute on function public.public_bundle_closed_months(text) to anon, authenticated;

-- 3. public_create_booking ─────────────────────────────────────────────────────
-- Only the new-package branch changes; the rest of the live function stays.
do $$
declare
  v_def text := pg_get_functiondef(
    'public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure);
  v_old text := $q$      if v_m[1]::int not in (3,6,8,10) or v_m[2]::int <= 0 then return jsonb_build_object('status','invalid_promo'); end if;$q$;
  v_new text := $q$      if v_m[1]::int not in (3,6,8,10) or v_m[2]::int <= 0 then return jsonb_build_object('status','invalid_promo'); end if;
      -- Packages sell while they take at most 30% of the month's hours (sql/bundle_capacity.sql).
      -- One package sale per studio-month at a time, so the check below sees every earlier one.
      perform pg_advisory_xact_lock(hashtextextended('ils_bundle:' || p_location || ':' || to_char(p_date, 'YYYY-MM'), 0));
      if not public.bundle_month_open(p_location, p_date) then
        return jsonb_build_object('status','invalid_promo','reason','bundles_full');
      end if;$q$;
  v_n integer;
begin
  if position('public.bundle_month_open(' in v_def) > 0 then
    raise notice 'public_create_booking already checks package capacity - skipped';
    return;
  end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then
    raise exception 'bundle_capacity.sql: package line expected once in public_create_booking, found % - nothing changed', v_n;
  end if;
  execute replace(v_def, v_old, v_new);  -- same signature: grants stay
end $$;

commit;

-- Check after applying:
--   select public.public_bundle_closed_months('novi_sad'), public.public_bundle_closed_months('sombor');
--     → {} while every month in the window is at or under 30%
--   select position('bundle_month_open' in pg_get_functiondef(
--     'public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure)) > 0;
--     → true
