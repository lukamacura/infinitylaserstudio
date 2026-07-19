-- ════════════════════════════════════════════════════════════════════════════
-- Availability management: weekly template + per-date overrides
-- Run once in the Supabase SQL editor.
--
-- Model:
--   weekly_schedule        — default working hours per weekday (single source of truth)
--   availability_overrides — per-date deviations from the template
--
-- Resolving a date D:  override if a row exists  →  otherwise the weekly template.
--   • no override row            → use the weekly template for that weekday
--   • override row with windows  → those windows replace the template
--   • override row with []       → the day is explicitly CLOSED
--
-- `windows` is a JSON array of { "start": <min>, "end": <min> } where the values
-- are minutes since midnight (e.g. 14:00 = 840). `[]` means closed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.weekly_schedule (
  weekday  smallint primary key check (weekday between 0 and 6), -- 0=Mon … 6=Sun
  windows  jsonb    not null default '[]'::jsonb
);

create table if not exists public.availability_overrides (
  date        date        primary key,
  windows     jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── Row-level security (Option 1: anon read + write, mirrors reservations) ───
alter table public.weekly_schedule        enable row level security;
alter table public.availability_overrides enable row level security;

drop policy if exists "weekly_schedule anon all"        on public.weekly_schedule;
drop policy if exists "availability_overrides anon all" on public.availability_overrides;

create policy "weekly_schedule anon all"
  on public.weekly_schedule
  for all using (true) with check (true);

create policy "availability_overrides anon all"
  on public.availability_overrides
  for all using (true) with check (true);

-- ── Seed: weekly template ───────────────────────────────────────────────────
-- Pon–Čet 14:00–20:00, Pet 10:00–16:00, Sub 10:00–16:00, Ned zatvoreno.
insert into public.weekly_schedule (weekday, windows) values
  (0, '[{"start":840,"end":1200}]'::jsonb),  -- Ponedeljak 14:00–20:00
  (1, '[{"start":840,"end":1200}]'::jsonb),  -- Utorak     14:00–20:00
  (2, '[{"start":840,"end":1200}]'::jsonb),  -- Sreda      14:00–20:00
  (3, '[{"start":840,"end":1200}]'::jsonb),  -- Četvrtak   14:00–20:00
  (4, '[{"start":600,"end":960}]'::jsonb),   -- Petak      10:00–16:00
  (5, '[{"start":600,"end":960}]'::jsonb),   -- Subota     10:00–16:00
  (6, '[]'::jsonb)                           -- Nedelja    — zatvoreno
on conflict (weekday) do update set windows = excluded.windows;

-- ── Seed: overrides (existing schedule, 18.07.2026 → 31.07.2026) ────────────
-- Migrated 1:1 from the old SPECIAL_AVAILABILITY map so the site behaves exactly
-- as before for these dates. Dates from 01.08 onward follow the weekly template
-- above and can be adjusted from the admin "Radno vreme" tab.
insert into public.availability_overrides (date, windows) values
  ('2026-07-18', '[{"start":600,"end":1200}]'::jsonb),   -- Sub 10:00–20:00
  ('2026-07-20', '[{"start":900,"end":1200}]'::jsonb),   -- Pon 15:00–20:00
  ('2026-07-21', '[{"start":600,"end":1260}]'::jsonb),   -- Uto 10:00–21:00
  ('2026-07-22', '[{"start":780,"end":1200}]'::jsonb),   -- Sre 13:00–20:00
  ('2026-07-23', '[{"start":780,"end":1200}]'::jsonb),   -- Čet 13:00–20:00
  ('2026-07-24', '[{"start":600,"end":900}]'::jsonb),    -- Pet 10:00–15:00
  ('2026-07-25', '[{"start":600,"end":900}]'::jsonb),    -- Sub 10:00–15:00
  ('2026-07-27', '[{"start":900,"end":1200}]'::jsonb),   -- Pon 15:00–20:00
  ('2026-07-28', '[{"start":600,"end":1260}]'::jsonb),   -- Uto 10:00–21:00
  ('2026-07-29', '[{"start":780,"end":1200}]'::jsonb),   -- Sre 13:00–20:00
  ('2026-07-30', '[{"start":780,"end":1200}]'::jsonb),   -- Čet 13:00–20:00
  ('2026-07-31', '[{"start":540,"end":960}]'::jsonb)     -- Pet 09:00–16:00
on conflict (date) do update set windows = excluded.windows, updated_at = now();
