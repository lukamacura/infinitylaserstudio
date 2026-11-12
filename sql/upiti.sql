-- ─────────────────────────────────────────────────────────────────────────────
-- Upiti - the call list. Someone writes on Instagram (or Facebook, Viber...)
-- and leaves a phone number; it goes on this list so the doctor calls them
-- back and nobody is forgotten.
--
--   upiti              — one row per inquiry, written in by hand on /upiti
--   upiti_list(...)    — the list as the page shows it, joined to the cards
--   upiti_open_count() — the number next to "Upiti" in the admin menu
--
-- Tied to the cards through the phone number only, at read time:
--   * a client on file with that phone → the inquiry links to their card;
--   * a booking with that phone, made after the inquiry, for a date on or after
--     it → the inquiry counts as booked and drops off the list by itself.
-- Nothing here writes to kartoni, clients or reservations, and nothing there
-- changes: no triggers. Purely additive - safe to run while the old code is live.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.upiti (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null check (length(trim(name)) between 1 and 120),
  phone        text        check (length(phone) <= 40),
  source       text        not null default 'instagram'
                           check (source in ('instagram', 'facebook', 'tiktok', 'viber', 'telefon', 'drugo')),
  -- What they asked about, in a word or two.
  note         text        not null default '' check (length(note) <= 1000),
  location     text        check (location in ('novi_sad', 'sombor')),
  -- What the doctor marked. A booking found by phone overrides 'open' and
  -- 'declined' when the list is read (upiti_list).
  status       text        not null default 'open' check (status in ('open', 'booked', 'declined')),
  -- Calls nobody answered: the tally marks on the list.
  attempts     smallint    not null default 0 check (attempts between 0 and 99),
  last_call_at timestamptz,
  closed_at    timestamptz,
  phone_norm   text        generated always as (public.karton_norm_phone(phone)) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists upiti_created_idx    on public.upiti (created_at);
create index if not exists upiti_phone_norm_idx on public.upiti (phone_norm);

alter table public.upiti enable row level security;
drop policy if exists "admin all" on public.upiti;
create policy "admin all" on public.upiti for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.upiti from anon;
grant select, insert, update, delete on public.upiti to authenticated;

drop trigger if exists upiti_touch on public.upiti;
create trigger upiti_touch before update on public.upiti
  for each row execute function public.karton_touch();

/**
 * The list. p_open = true: who still has to be called, oldest first (the order
 * they were written in). p_open = false: the crossed-out ones, newest first.
 * Runs as the caller, so the tables' admin-only policies apply.
 */
create or replace function public.upiti_list(p_open boolean default true, p_limit integer default 200, p_offset integer default 0)
returns table (
  id uuid, name text, phone text, source text, note text, location text,
  status text, saved_status text, attempts integer, last_call_at timestamptz,
  created_at timestamptz, done_at timestamptz,
  karton_id uuid, karton_number integer, karton_name text,
  booked_date date, booked_time time, booked_location text, booked_after boolean,
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

commit;
