-- ════════════════════════════════════════════════════════════════════════════
-- Status model change: "no_show" → "blacklisted"
-- Run in the Supabase SQL editor — the WHOLE file, top to bottom, in one go.
--
-- Background:
--   Old status set: pending / confirmed / cancelled / no_show — built around the
--   (now retired) 50%-off-first-treatment offer.
--
--   New status set: pending / confirmed / cancelled / blacklisted
--     cancelled   — the appointment is off; the client's history is untouched.
--                   A cancelled booking never counts as "the client has been
--                   here", so a first-timer who cancels stays a first-timer.
--     blacklisted — the client did not show up / went silent. Marks the person,
--                   not just this one booking.
--
-- ORDER MATTERS. `reservations.status` is guarded by a CHECK constraint
-- (`reservations_status_check`, created in the Supabase UI, not in this repo).
-- Adding a CHECK constraint validates every existing row immediately, so the
-- new constraint cannot go on while 93 rows still say 'no_show', and the rows
-- cannot be updated to 'blacklisted' while the old constraint is still on.
-- The only order that works is:
--
--     drop the constraint  →  migrate the rows  →  add the constraint back
--
-- Everything runs in one transaction: if any step fails, nothing is applied.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Remove the guard so the column can hold either value in transit ──────
alter table public.reservations
  drop constraint if exists reservations_status_check;

-- ── 2. Migrate the legacy rows ──────────────────────────────────────────────
-- Already done via the REST API on 19.07.2026: the 9 no_show rows belonging to
-- 8 people who DO have confirmed appointments were set to 'cancelled', so they
-- are not blacklisted. Four of them had returned and kept coming after the miss:
--   Nada Nenadić · Dragana Janković · Aleksandra Trifunov · Maja Grgić
--
-- What is left are 93 rows from 93 people with no confirmed appointment ever —
-- booked once, never showed, never came back. Those become the blacklist.
update public.reservations
   set status = 'blacklisted'
 where status = 'no_show';

-- ── 3. Put the guard back, now listing the new value ────────────────────────
-- Safe at this point: no row says 'no_show' any more.
alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'blacklisted'));

commit;

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Expect: confirmed 488 · cancelled 172 · blacklisted 93 · no no_show row left.
select status, count(*) as rows
  from public.reservations
 group by status
 order by rows desc;
