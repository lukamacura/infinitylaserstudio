-- ─────────────────────────────────────────────────────────────────────────────
-- Manual price correction per reservation.
--
-- A reservation's price is never stored - every screen computes it from its
-- regions, the studio's price list and the promo code (lib/pricing.ts). When
-- the studio charges something else (a deal at the counter, a partial
-- treatment), the admin types the real amount; it wins over the computed price
-- in the calendar and finances. null = no correction, the usual rules apply.
--
-- Purely additive: safe to run while the old code is live. Admins already have
-- full access to reservations through the "admin all" policy.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reservations
  add column if not exists price_override integer
    constraint reservations_price_override_check check (price_override >= 0);
