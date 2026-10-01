-- ─────────────────────────────────────────────────────────────────────────────
-- Booking funnel - how far each visitor gets in the booking form (/fnl).
--
--   booking_funnel_events      — one row per (visitor session, stage reached)
--   public_track_funnel(...)   — the ONLY way the public form writes to it
--   admin_booking_funnel(...)  — per-stage visitor counts, admin only
--
-- Purely additive: no existing table, policy or function is changed. The table
-- has RLS on and no policies, so nobody reads or writes it directly. Rows hold
-- no personal data - just a random session id, a stage and the studio.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.booking_funnel_events (
  id         bigint      generated always as identity primary key,
  session_id uuid        not null,
  stage      text        not null check (stage in (
    'open', 'studio', 'gender', 'services', 'plan', 'day', 'time', 'submit', 'booked'
  )),
  location   text        check (location in ('novi_sad', 'sombor')),
  created_at timestamptz not null default now(),
  unique (session_id, stage)
);
create index if not exists booking_funnel_events_created_at_idx
  on public.booking_funnel_events (created_at);

alter table public.booking_funnel_events enable row level security;

-- ── Public: record a stage (first time only per session) ─────────────────────
create or replace function public.public_track_funnel(
  p_session  uuid,
  p_stage    text,
  p_location text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.booking_funnel_events (session_id, stage, location)
  values (p_session, p_stage, p_location)
  on conflict (session_id, stage) do nothing;
$$;
revoke all on function public.public_track_funnel(uuid, text, text) from public;
grant execute on function public.public_track_funnel(uuid, text, text) to anon, authenticated;

-- ── Admin: visitors who reached each stage in [p_from, p_to) ─────────────────
-- A session counts for every stage up to the furthest one it reached, so a
-- skipped screen (gender preset by a link, a landing-page bundle jumping
-- straight to the plan) never shows up as a drop.
create or replace function public.admin_booking_funnel(
  p_from     timestamptz,
  p_to       timestamptz,
  p_location text default null
)
returns table (stage text, sessions bigint)
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
  with stages(stage, rank) as (
    values ('open', 1), ('studio', 2), ('gender', 3), ('services', 4), ('plan', 5),
           ('day', 6), ('time', 7), ('submit', 8), ('booked', 9)
  ),
  furthest as (
    select e.session_id, max(s.rank) as rank, max(e.location) as location
    from public.booking_funnel_events e
    join stages s on s.stage = e.stage
    where e.created_at >= p_from and e.created_at < p_to
    group by e.session_id
  )
  select s.stage,
         count(f.session_id) filter (
           where f.rank >= s.rank
             -- With a studio filter only sessions that picked that studio count
             -- (the page then starts the funnel at "picked a studio").
             and (p_location is null or f.location = p_location)
         )
  from stages s
  cross join furthest f
  group by s.stage, s.rank
  order by s.rank;
end;
$$;
revoke all on function public.admin_booking_funnel(timestamptz, timestamptz, text) from public;
grant execute on function public.admin_booking_funnel(timestamptz, timestamptz, text) to authenticated;

commit;
