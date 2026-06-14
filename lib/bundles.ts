// ── "Napravi svoj paket" bundle pricing ─────────────────────────────────────────
// Pure, dependency-free helpers shared by the booking modal, the landing-page
// examples and lib/pricing.ts (finances/admin). Keep this file side-effect free.

export type BundleCategory = "face" | "body";

/**
 * Treatments needed for full results differ by area:
 *   • Face needs ~10 sessions  → discount scales up to 10.
 *   • Body needs ~6–8 sessions → discount maxes out at 8.
 * Bigger commitment ⇒ bigger discount.
 */
export const FACE_TIERS: Record<number, number> = { 3: 7, 6: 12, 8: 17, 10: 21 };
export const BODY_TIERS: Record<number, number> = { 3: 12, 6: 17, 8: 21 };

/** Region categorisation by name (mirrors the modal's keyword icon logic). */
export function serviceCategory(name: string): BundleCategory {
  const n = name.toLowerCase();
  if (n.includes("lice") || n.includes("lica") || n.includes("nausnice") || n.includes("brada")) {
    return "face";
  }
  return "body";
}

function tierPercent(category: BundleCategory, sessions: number): number {
  const map = category === "face" ? FACE_TIERS : BODY_TIERS;
  return map[sessions] ?? 0;
}

/** Round to the nearest value ending in "00" (e.g. 53.742 → 53.700). */
export function roundTo100(n: number): number {
  return Math.round(n / 100) * 100;
}

interface PricedRegion {
  price: number;
  name: string;
}

/**
 * Bundle sizes a basket is eligible for:
 *   • all-face basket → 3 / 6 / 8 / 10
 *   • anything with a body region → 3 / 6 / 8 (body's full course is 8, no 10)
 */
export function eligibleBundleSizes(regions: PricedRegion[]): number[] {
  if (regions.length === 0) return [];
  const allFace = regions.every((r) => serviceCategory(r.name) === "face");
  return allFace ? [3, 6, 8, 10] : [3, 6, 8];
}

export interface BundleResult {
  sessions: number;
  /** Single-session list total × sessions (the crossed-out price). */
  originalTotal: number;
  /** Discounted total, rounded to nearest 00 — paid in full upfront. */
  finalTotal: number;
  /** originalTotal − finalTotal. */
  savings: number;
  /** finalTotal ÷ sessions, rounded — "samo X po tretmanu". */
  pricePerSession: number;
  /** Effective blended discount across all regions, for display. */
  blendedPct: number;
}

/**
 * Per-region discount by category at the chosen session count, summed and
 * rounded. A mixed basket gets face % on face regions and body % on body ones.
 */
export function computeBundle(regions: PricedRegion[], sessions: number): BundleResult {
  const originalTotal = regions.reduce((sum, r) => sum + r.price, 0) * sessions;

  const rawFinal = regions.reduce((sum, r) => {
    const pct = tierPercent(serviceCategory(r.name), sessions);
    return sum + r.price * sessions * (1 - pct / 100);
  }, 0);

  const finalTotal = roundTo100(rawFinal);
  const savings = originalTotal - finalTotal;
  const pricePerSession = Math.round(finalTotal / sessions);
  const blendedPct =
    originalTotal > 0 ? Math.round((1 - finalTotal / originalTotal) * 100) : 0;

  return { sessions, originalTotal, finalTotal, savings, pricePerSession, blendedPct };
}

// ── Promo-code encoding (no DB schema change) ───────────────────────────────────
// A bundle is recorded in reservations.promo_code:
//   • purchase   → "paket-<sessions>-<finalTotal>"      (charged the full total)
//   • redemption → "paket-<sessions>-<finalTotal>-r"    (a pre-paid follow-up, 0)

const BUNDLE_PROMO_RE = /^paket-(\d+)-(\d+)(-r)?$/i;

export interface ParsedBundlePromo {
  sessions: number;
  total: number;
  redeem: boolean;
}

export function parseBundlePromo(code: string | null | undefined): ParsedBundlePromo | null {
  if (!code) return null;
  const m = code.trim().match(BUNDLE_PROMO_RE);
  if (!m) return null;
  return { sessions: Number(m[1]), total: Number(m[2]), redeem: !!m[3] };
}

/** The purchase code for a computed bundle (what gets stored on session 1). */
export function bundlePurchaseCode(sessions: number, finalTotal: number): string {
  return `paket-${sessions}-${finalTotal}`;
}

/** The redemption code derived from a purchase code (sessions 2…N, price 0). */
export function bundleRedeemCode(purchaseCode: string): string {
  return `${purchaseCode.trim()}-r`;
}
