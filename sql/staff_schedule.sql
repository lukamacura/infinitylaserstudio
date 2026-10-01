-- ─────────────────────────────────────────────────────────────────────────────
-- Staff schedule - who works which day. Safe to run while the old code is live.
--
-- Same model as working hours (weekly_schedule + availability_overrides):
--   staff           — the people (one list shared by both studios)
--   staff_weekly    — who works each weekday, per studio (the template)
--   staff_overrides — who works on one specific date (an exception)
--
-- Resolving a date D:  staff_overrides row  →  otherwise staff_weekly for D's weekday.
-- An override with '{}' means nobody is assigned that day.
--
-- Purely additive and admin-only: the public site never reads these tables.
-- A person is never deleted (active = false hides them), so old schedules
-- keep pointing at a real row.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.staff (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (length(trim(name)) > 0),
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_weekly (
  location  text     not null
    constraint staff_weekly_location_check check (location in ('novi_sad', 'sombor')),
  weekday   smallint not null check (weekday between 0 and 6), -- 0=Mon … 6=Sun
  staff_ids uuid[]   not null default '{}',
  primary key (location, weekday)
);

create table if not exists public.staff_overrides (
  location   text        not null
    constraint staff_overrides_location_check check (location in ('novi_sad', 'sombor')),
  date       date        not null,
  staff_ids  uuid[]      not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (location, date)
);

do $$
declare t text;
begin
  foreach t in array array['staff', 'staff_weekly', 'staff_overrides'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

commit;
