// ── Shared discount / pricing logic ────────────────────────────────────────────
// Used by the finances dashboard and the admin calendar so both compute the exact
// same final price and discount labels for every reservation.

import { parseBundlePromo } from "./bundles";

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

/**
 * Student discount: −20% on the first treatment, valid only against a student ID
 * shown at the studio. Unlike every other code this one cannot be verified while
 * booking, so the price it produces is provisional - the admin panel can strip the
 * code off the reservation, which returns it to full price everywhere.
 */
export const STUDENT_PROMO_CODE = "student20";

export function isStudentPromoCode(raw: string | null | undefined): boolean {
  return !!raw && raw.trim().toLowerCase() === STUDENT_PROMO_CODE;
}

export type DiscountKind =
  | "fifty"
  | "promo"
  | "fifty_promo"
  | "student"
  | "bundle"
  | "bundle_redeem"
  | "none";

export interface PriceResult {
  /** Full list price (after combo packages), before any discount. */
  listPrice: number;
  /** Price actually charged, after every applicable discount. */
  finalPrice: number;
  /** First-treatment −50% applied (only for bookings created before the cutoff). */
  fiftyOff: boolean;
  /** −10% ils- promo code applied. */
  promoOff: boolean;
  /** −20% student code applied (pending a student ID at the studio). */
  studentOff: boolean;
  /** The applied promo code (only when promoOff or studentOff). */
  promoCode: string | null;
  /** Number of treatments in the bundle (only when kind is a bundle). */
  bundleSessions: number | null;
  kind: DiscountKind;
}

/**
 * Final price + discount flags for one reservation.
 * - 50% first-treatment discount applies only when it's the client's first
 *   treatment AND it was booked before the 50% promo was removed.
 * - 10% ils- promo stacks on top of whatever base remains (matches the historical
 *   booking-flow behaviour where the promo applied after the first-treatment cut).
 * - 20% student code never stacks with the ils- promo; it is only ever issued for
 *   a first treatment, so it also cannot meet the (retired) 50% discount.
 */
export function computeReservationPrice(opts: {
  listPrice: number;
  isFirstTreatment: boolean;
  createdAt: string | null;
  promoCode: string | null;
}): PriceResult {
  const { listPrice, isFirstTreatment, createdAt, promoCode } = opts;

  // Bundles ("Napravi svoj paket") are paid in full upfront on the first session
  // and never stack with the 50%/ils discounts. The full bundle total is encoded
  // in the promo code; redemption sessions (2…N) are already paid, so they're 0.
  const bundle = parseBundlePromo(promoCode);
  if (bundle) {
    return {
      listPrice,
      finalPrice: bundle.redeem ? 0 : bundle.total,
      fiftyOff: false,
      promoOff: false,
      studentOff: false,
      promoCode: promoCode!.trim(),
      bundleSessions: bundle.sessions,
      kind: bundle.redeem ? "bundle_redeem" : "bundle",
    };
  }

  const bookedBeforeCutoff =
    createdAt != null && new Date(createdAt) < FIRST_TREATMENT_50_END;
  const fiftyOff = isFirstTreatment && bookedBeforeCutoff;
  const promoOff = isIlsPromoCode(promoCode);
  const studentOff = isStudentPromoCode(promoCode);

  let finalPrice = listPrice;
  if (fiftyOff) finalPrice = Math.round(finalPrice * 0.5);
  if (promoOff) finalPrice = Math.round(finalPrice * 0.9);
  if (studentOff) finalPrice = Math.round(finalPrice * 0.8);

  const kind: DiscountKind =
    fiftyOff && promoOff ? "fifty_promo"
      : fiftyOff ? "fifty"
      : promoOff ? "promo"
      : studentOff ? "student"
      : "none";

  return {
    listPrice,
    finalPrice,
    fiftyOff,
    promoOff,
    studentOff,
    promoCode: promoOff || studentOff ? promoCode!.trim() : null,
    bundleSessions: null,
    kind,
  };
}
