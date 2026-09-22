-- ════════════════════════════════════════════════════════════════════════════
-- Secure booking — PHASE 2 (lock-down)
--
-- Run ONLY after:
--   1. the new site (booking via public_* functions, Supabase Auth admin login)
--      is deployed, and
--   2. the admin user exists in admin_users and can log in to /admin.
--
-- Running it earlier breaks the old live site's booking form.
-- After this the anon key can no longer read personal data or change anything;
-- the public form works only through the functions from phase 1.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Reservations: no direct public access at all.
drop policy if exists "reservations_public_insert" on public.reservations;
drop policy if exists "reservations_public_read"   on public.reservations;
drop policy if exists "reservations_public_update" on public.reservations;

drop policy if exists "res_services_public_insert" on public.reservation_services;
drop policy if exists "res_services_public_read"   on public.reservation_services;

-- Ad spend: admin only.
drop policy if exists "marketing_spend_public_insert" on public.marketing_spend;
drop policy if exists "marketing_spend_public_read"   on public.marketing_spend;
drop policy if exists "marketing_spend_public_update" on public.marketing_spend;

-- Working hours: everyone may read (the booking form needs them), only admin writes.
drop policy if exists "weekly_schedule anon all" on public.weekly_schedule;
drop policy if exists "weekly_schedule public read" on public.weekly_schedule;
create policy "weekly_schedule public read" on public.weekly_schedule
  for select using (true);

drop policy if exists "availability_overrides anon all" on public.availability_overrides;
drop policy if exists "availability_overrides public read" on public.availability_overrides;
create policy "availability_overrides public read" on public.availability_overrides
  for select using (true);

-- services keeps "services_public_read"; writes are admin-only via "admin all".

commit;
