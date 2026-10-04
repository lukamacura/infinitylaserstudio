-- ─────────────────────────────────────────────────────────────────────────────
-- Booking funnel - where the form was opened from (/fnl "Odakle dolaze").
--
--   booking_funnel_events.source  — what opened the form: hero, plutajuce,
--                                   navbar, footer, zajednica, cenovnik, link
--   booking_funnel_events.utm     — utm_source of the visit ("meta" when the
--                                   only trace is a Facebook click id)
--   public_track_funnel(...)      — gains p_source / p_utm, both optional
--   admin_funnel_sources(...)     — per source: opened, picked a studio, booked
--
-- Additive and backwards compatible: existing rows keep NULL, and the live
-- form's 3-argument call matches the new function through the defaults. The
-- old function is dropped and the new one created in the same transaction, so
-- there is no moment without one.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table public.booking_funnel_events
  add column if not exists source text check (char_length(source) <= 40),
  add column if not exists utm    text check (char_length(utm) <= 60);

drop function if exists public.public_track_funnel(uuid, text, text);

create or replace function public.public_track_funnel(
  p_session  uuid,
  p_stage    text,
  p_location text default null,
  p_source   text default null,
  p_utm      text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.booking_funnel_events (session_id, stage, location, source, utm)
  values (p_session, p_stage, p_location, left(p_source, 40), left(p_utm, 60))
  on conflict (session_id, stage) do nothing;
$$;
revoke all on function public.public_track_funnel(uuid, text, text, text, text) from public;
grant execute on function public.public_track_funnel(uuid, text, text, text, text) to anon, authenticated;

-- ── Admin: per entry point, how far visitors got in [p_from, p_to) ───────────
create or replace function public.admin_funnel_sources(
  p_from     timestamptz,
  p_to       timestamptz,
  p_location text default null
)
returns table (source text, utm text, opened bigint, picked_studio bigint, booked bigint)
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
           max(e.source)   as source,
           max(e.utm)      as utm,
           max(e.location) as location,
           bool_or(e.stage <> 'open') as picked_studio,
           bool_or(e.stage = 'booked') as booked
    from public.booking_funnel_events e
    where e.created_at >= p_from and e.created_at < p_to
    group by e.session_id
  )
  select coalesce(s.source, 'nepoznato'),
         coalesce(s.utm, ''),
         count(*),
         count(*) filter (where s.picked_studio),
         count(*) filter (where s.booked)
  from sessions s
  where p_location is null or s.location = p_location
  group by 1, 2
  order by 3 desc;
end;
$$;
revoke all on function public.admin_funnel_sources(timestamptz, timestamptz, text) from public;
grant execute on function public.admin_funnel_sources(timestamptz, timestamptz, text) to authenticated;

commit;
