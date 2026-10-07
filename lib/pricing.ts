// ── Shared discount / pricing logic ────────────────────────────────────────────
// Used by the finances dashboard and the admin calendar so both compute the exact
// same final price and discount labels for every reservation.

import { parseBundlePromo, roundTo100 } from "./bundles";

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

/**
 * Link discount: −20% for anyone who arrives on `?promo=popust20` - new or
 * returning, single session or bundle. On a single session the code is stored
 * on the reservation; on a bundle the cut is already in the bundle total, so a
 * bundle reservation keeps its usual paket-N-<total> code.
 */
export const LINK_PROMO_CODE = "popust20";
export const LINK_DISCOUNT_PCT = 20;

export function isLinkPromoCode(raw: string | null | undefined): boolean {
  return !!raw && raw.trim().toLowerCase() === LINK_PROMO_CODE;
}

/** Single-session price after the link discount. */
export function linkSinglePrice(listPrice: number): number {
  return Math.round(listPrice * (1 - LINK_DISCOUNT_PCT / 100));
}

/** Bundle total after the link discount - rounded to 00 like every bundle price. */
export function linkBundleTotal(bundleTotal: number): number {
  return roundTo100(bundleTotal * (1 - LINK_DISCOUNT_PCT / 100));
}

export type DiscountKind =
  | "fifty"
  | "promo"
  | "fifty_promo"
  | "student"
  | "link"
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
  /** −20% popust20 link code applied. */
  linkOff: boolean;
  /** The applied promo code (only when promoOff, studentOff or linkOff). */
  promoCode: string | null;
  /** Number of treatments in the bundle (only when kind is a bundle). */
  bundleSessions: number | null;
  kind: DiscountKind;
  /** finalPrice was typed in by hand in the admin panel (reservations.price_override). */
  overridden: boolean;
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
  /** A price corrected by hand in the admin panel - wins over every rule below. */
  priceOverride?: number | null;
}): PriceResult {
  const computed = computeRulePrice(opts);
  const override = opts.priceOverride;
  return override != null
    ? { ...computed, finalPrice: Number(override), overridden: true }
    : computed;
}

function computeRulePrice(opts: {
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
      linkOff: false,
      promoCode: promoCode!.trim(),
      bundleSessions: bundle.sessions,
      kind: bundle.redeem ? "bundle_redeem" : "bundle",
      overridden: false,
    };
  }

  const bookedBeforeCutoff =
    createdAt != null && new Date(createdAt) < FIRST_TREATMENT_50_END;
  const fiftyOff = isFirstTreatment && bookedBeforeCutoff;
  const promoOff = isIlsPromoCode(promoCode);
  const studentOff = isStudentPromoCode(promoCode);
  const linkOff = isLinkPromoCode(promoCode);

  let finalPrice = listPrice;
  if (fiftyOff) finalPrice = Math.round(finalPrice * 0.5);
  if (promoOff) finalPrice = Math.round(finalPrice * 0.9);
  if (studentOff) finalPrice = Math.round(finalPrice * 0.8);
  if (linkOff) finalPrice = linkSinglePrice(finalPrice);

  const kind: DiscountKind =
    fiftyOff && promoOff ? "fifty_promo"
      : fiftyOff ? "fifty"
      : promoOff ? "promo"
      : studentOff ? "student"
      : linkOff ? "link"
      : "none";

  return {
    listPrice,
    finalPrice,
    fiftyOff,
    promoOff,
    studentOff,
    linkOff,
    promoCode: promoOff || studentOff || linkOff ? promoCode!.trim() : null,
    bundleSessions: null,
    kind,
    overridden: false,
  };
}
