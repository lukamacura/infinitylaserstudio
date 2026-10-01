-- ─────────────────────────────────────────────────────────────────────────────
-- Second studio (Sombor) - PHASE 2. Run AFTER the location-aware code is live.
--
-- Swaps the single-column primary keys for (location, …) ones, which is what
-- lets Sombor have its own working hours, date exceptions and ad spend next to
-- Novi Sad's. No rows are touched - the Novi Sad data stays exactly as it is.
--
-- Do NOT run this while the old code is still deployed: its upserts use
-- ON CONFLICT (weekday) / (date) / (month), which need the old keys.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table public.weekly_schedule
  drop constraint weekly_schedule_pkey,
  add constraint weekly_schedule_pkey
    primary key using index weekly_schedule_location_weekday_key;

alter table public.availability_overrides
  drop constraint availability_overrides_pkey,
  add constraint availability_overrides_pkey
    primary key using index availability_overrides_location_date_key;

alter table public.marketing_spend
  drop constraint marketing_spend_pkey,
  add constraint marketing_spend_pkey
    primary key using index marketing_spend_location_month_key;

commit;
