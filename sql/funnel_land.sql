-- ─────────────────────────────────────────────────────────────────────────────
-- Booking funnel - visits that landed on the site (/fnl "Odakle dolaze").
--
--   stage 'land'              — every visit to the home page, before any click
--   booking_funnel_events.source on a 'land' row — how the visit entered:
--                               'link' (a link that opens the form by itself)
--                               or 'root' (plain home page)
--   admin_funnel_sources(...) — gains entry + landed, so a direct link and the
--                               home page can be compared from the same start
--
-- Additive: admin_booking_funnel ignores 'land' (its stage list has no such
-- stage), so the step-by-step funnel is unchanged. The old columns of
-- admin_funnel_sources keep their meaning - 'source' still says what opened
-- the form - so the page already live keeps working. The function is dropped
-- and recreated in the same transaction, so there is no moment without one.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table public.booking_funnel_events
  drop constraint booking_funnel_events_stage_check,
  add constraint booking_funnel_events_stage_check check (stage in (
    'land', 'open', 'studio', 'gender', 'services', 'plan', 'day', 'time', 'submit', 'booked'
  ));

drop function if exists public.admin_funnel_sources(timestamptz, timestamptz, text);

-- ── Admin: per entry point, how far visitors got in [p_from, p_to) ───────────
create or replace function public.admin_funnel_sources(
  p_from     timestamptz,
  p_to       timestamptz,
  p_location text default null
)
returns table (
  source text, utm text, opened bigint, picked_studio bigint, booked bigint,
  entry text, landed bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with sessions as (
    select e.session_id,
           max(e.source) filter (where e.stage = 'open') as source,
           max(e.source) filter (where e.stage = 'land') as entry,
           max(e.utm)      as utm,
           max(e.location) as location,
           bool_or(e.stage = 'land')                   as landed,
           bool_or(e.stage = 'open')                   as opened,
           bool_or(e.stage not in ('land', 'open'))    as picked_studio,
           bool_or(e.stage = 'booked')                 as booked
    from public.booking_funnel_events e
    where e.created_at >= p_from and e.created_at < p_to
    group by e.session_id
  )
  select coalesce(s.source, 'nepoznato'),
         coalesce(s.utm, ''),
         count(*) filter (where s.opened),
         count(*) filter (where s.picked_studio),
         count(*) filter (where s.booked),
         coalesce(s.entry, ''),
         count(*) filter (where s.landed)
  from sessions s
  where p_location is null or s.location = p_location
  group by 1, 2, 6
  order by 7 desc, 3 desc;
end;
$$;
revoke all on function public.admin_funnel_sources(timestamptz, timestamptz, text) from public;
grant execute on function public.admin_funnel_sources(timestamptz, timestamptz, text) to authenticated;

commit;
