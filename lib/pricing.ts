// ── Shared discount / pricing logic ────────────────────────────────────────────
// Used by the finances dashboard and the admin calendar so both compute the exact
// same final price and discount labels for every reservation.

/**
 * The automatic 50% "first treatment" discount was removed on 29.05.2026.
 * Any reservation BOOKED (created_at) on or after this moment never gets the 50%
 * off — only reservations created before it (a genuine first treatment) keep it.
 * Belgrade time (UTC+2).
 */
export const FIRST_TREATMENT_50_END = new Date("2026-05-29T00:00:00+02:00");

/** Promo codes: `ils-` + any non-empty suffix (e.g. ils-leyla). Case-insensitive. */
export function isIlsPromoCode(raw: string | null | undefined): boolean {
  return !!raw && /^ils-.+$/i.test(raw.trim());
}

export type DiscountKind = "fifty" | "promo" | "fifty_promo" | "none";

export interface PriceResult {
  /** Full list price (after combo packages), before any discount. */
  listPrice: number;
  /** Price actually charged, after every applicable discount. */
  finalPrice: number;
  /** First-treatment −50% applied (only for bookings created before the cutoff). */
  fiftyOff: boolean;
  /** −10% ils- promo code applied. */
  promoOff: boolean;
  /** The applied promo code (only when promoOff). */
  promoCode: string | null;
  kind: DiscountKind;
}

/**
 * Final price + discount flags for one reservation.
 * - 50% first-treatment discount applies only when it's the client's first
 *   treatment AND it was booked before the 50% promo was removed.
 * - 10% ils- promo stacks on top of whatever base remains (matches the historical
 *   booking-flow behaviour where the promo applied after the first-treatment cut).
 */
export function computeReservationPrice(opts: {
  listPrice: number;
  isFirstTreatment: boolean;
  createdAt: string | null;
  promoCode: string | null;
}): PriceResult {
  const { listPrice, isFirstTreatment, createdAt, promoCode } = opts;

  const bookedBeforeCutoff =
    createdAt != null && new Date(createdAt) < FIRST_TREATMENT_50_END;
  const fiftyOff = isFirstTreatment && bookedBeforeCutoff;
  const promoOff = isIlsPromoCode(promoCode);

  let finalPrice = listPrice;
  if (fiftyOff) finalPrice = Math.round(finalPrice * 0.5);
  if (promoOff) finalPrice = Math.round(finalPrice * 0.9);

  const kind: DiscountKind =
    fiftyOff && promoOff ? "fifty_promo" : fiftyOff ? "fifty" : promoOff ? "promo" : "none";

  return {
    listPrice,
    finalPrice,
    fiftyOff,
    promoOff,
    promoCode: promoOff ? promoCode!.trim() : null,
    kind,
  };
}
