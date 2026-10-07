-- ─────────────────────────────────────────────────────────────────────────────
-- Public: who works which day - the booking modal shows their avatars.
-- Needs sql/staff_schedule.sql. Purely additive, safe while the old code is live.
--
-- The staff tables stay admin-only; this exposes nothing but first names of
-- active people per date. Same resolution as the admin: the date's exception
-- (staff_overrides) wins, otherwise the weekday template (staff_weekly).
-- Days with nobody assigned are left out.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop function if exists public.public_staff_days(date, date, text);
create function public.public_staff_days(p_from date, p_to date, p_location text)
returns table (date date, names text[])
language sql stable security definer set search_path = ''
as $$
  with days as (
    select d::date as date
      from generate_series(p_from, least(p_to, p_from + 62), interval '1 day') d
  ), ids as (
    select days.date,
           coalesce(o.staff_ids, w.staff_ids, '{}') as staff_ids
      from days
      left join public.staff_overrides o
        on o.location = p_location and o.date = days.date
      left join public.staff_weekly w
        on w.location = p_location and w.weekday = extract(isodow from days.date)::int - 1
  )
  select ids.date, array_agg(s.name order by s.created_at)
    from ids
    join public.staff s on s.id = any(ids.staff_ids) and s.active
   group by ids.date;
$$;

revoke all on function public.public_staff_days(date, date, text) from public;
grant execute on function public.public_staff_days(date, date, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
