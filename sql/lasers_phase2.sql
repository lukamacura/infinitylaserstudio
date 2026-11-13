-- ─────────────────────────────────────────────────────────────────────────────
-- Lasers - PHASE 2. Run AFTER the code that knows about lasers is deployed.
--
--   1. Swaps the working-hours keys from (location, weekday) / (location, date)
--      to (location, laser, weekday) / (location, laser, date), which is what
--      lets the second laser have its own hours. No row is touched.
--   2. Adds Laser 2 ("Novi") in Novi Sad.
--
-- Do NOT run it while the old code is still deployed: the old admin saves
-- hours with ON CONFLICT (location, weekday) / (location, date), which need
-- the old keys.
--
-- After it: Admin → Radno vreme → switch to "Novi" and enter its hours. Laser
-- 2 takes bookings from active_from on (set below), within its own hours.
-- Running it again only changes the date / name.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
begin
  -- The phase 1 index becomes the key (and takes the key's name).
  if to_regclass('public.weekly_schedule_location_laser_weekday_key') is not null then
    alter table public.weekly_schedule
      drop constraint weekly_schedule_pkey,
      add constraint weekly_schedule_pkey
        primary key using index weekly_schedule_location_laser_weekday_key;
  end if;
  if to_regclass('public.availability_overrides_location_laser_date_key') is not null then
    alter table public.availability_overrides
      drop constraint availability_overrides_pkey,
      add constraint availability_overrides_pkey
        primary key using index availability_overrides_location_laser_date_key;
  end if;
end $$;

insert into public.lasers (location, laser, name, active_from)
values ('novi_sad', 2, 'Novi', date '2026-11-13')   -- ← the first day it works
on conflict (location, laser) do update
  set name = excluded.name, active_from = excluded.active_from;

commit;

-- Check:
--   select * from public.lasers order by location, laser;   → 3 rows
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid in ('public.weekly_schedule'::regclass, 'public.availability_overrides'::regclass)
--      and contype = 'p';                                    → both keys include laser
--
-- Laser 2 stops taking bookings from some date on (its bookings stay and are
-- moved by hand):
--   update public.lasers set active_from = date '2099-01-01' where location = 'novi_sad' and laser = 2;
