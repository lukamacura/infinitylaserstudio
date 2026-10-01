-- ─────────────────────────────────────────────────────────────────────────────
-- Per-studio prices - PHASE 1. Safe to run while the old code is live.
--
-- Novi Sad and Sombor have different price lists, and prices change over time.
-- `service_prices` keeps every price a treatment has had in each studio, with
-- the moment it started to apply. A reservation is always priced with the list
-- that applied in its studio when it was BOOKED (reservations.created_at), so
-- raising a price never rewrites past revenue in finances or stats.
--
-- Purely additive: the live code keeps reading services.price, which is not
-- touched. Novi Sad gets today's prices here (identical to services.price);
-- its new, higher prices are added by sql/prices_phase2.sql once the new code
-- is deployed. Sombor's list is the same as today's, so it is final already.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Hidden treatments stay in the database (old bookings point at them) but
--    are no longer offered. The old code ignores this column.
alter table public.services
  add column if not exists active boolean not null default true;

-- 2. Price history per studio ─────────────────────────────────────────────────
create table if not exists public.service_prices (
  service_id uuid not null references public.services (id) on delete cascade,
  location   text not null
    constraint service_prices_location_check check (location in ('novi_sad', 'sombor')),
  price      numeric not null check (price >= 0),
  valid_from timestamptz not null,
  primary key (service_id, location, valid_from)
);

alter table public.service_prices enable row level security;

drop policy if exists "service_prices public read" on public.service_prices;
create policy "service_prices public read" on public.service_prices
  for select using (true);

drop policy if exists "admin all" on public.service_prices;
create policy "admin all" on public.service_prices
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.service_prices to anon, authenticated;
grant insert, update, delete on public.service_prices to authenticated;

-- 3. Opening prices - both studios start on today's list. The date is before
--    the first reservation ever made, so every past booking is covered.
insert into public.service_prices (service_id, location, price, valid_from)
select s.id, l.location, s.price, timestamptz '2026-01-01 00:00:00+01'
  from public.services s
 cross join (values ('novi_sad'), ('sombor')) as l (location)
on conflict do nothing;

-- 4. Men's "Celo telo" is no longer on the price list.
update public.services set active = false
 where id = '9259a7e9-4961-4e87-85dd-21c203d1d3ae';

commit;
