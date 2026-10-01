// ── "Napravi svoj paket" bundle pricing ─────────────────────────────────────────
// Pure, dependency-free helpers shared by the booking modal, the landing-page
// examples and lib/pricing.ts (finances/admin). Keep this file side-effect free.

export type BundleCategory = "face" | "body";

/**
 * Discount by bundle size, the same for every region. Face can go up to 10
 * sessions (body's full course is 8), and 10 keeps the top 20%.
 * Bigger commitment ⇒ bigger discount.
 */
export const BUNDLE_TIERS: Record<number, number> = { 3: 10, 6: 15, 8: 20, 10: 20 };

/** Region categorisation by name (mirrors the modal's keyword icon logic). */
export function serviceCategory(name: string): BundleCategory {
  const n = name.toLowerCase();
  if (n.includes("lice") || n.includes("lica") || n.includes("nausnice") || n.includes("brada")) {
    return "face";
  }
  return "body";
}

function tierPercent(sessions: number): number {
  return BUNDLE_TIERS[sessions] ?? 0;
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
  /** The tier discount (10/15/20), for display. */
  blendedPct: number;
}

/**
 * Tier discount at the chosen session count applied to every region, summed
 * and rounded to the nearest 00.
 */
export function computeBundle(regions: PricedRegion[], sessions: number): BundleResult {
  const originalTotal = regions.reduce((sum, r) => sum + r.price, 0) * sessions;

  const rawFinal = regions.reduce((sum, r) => {
    const pct = tierPercent(sessions);
    return sum + r.price * sessions * (1 - pct / 100);
  }, 0);

  const finalTotal = roundTo100(rawFinal);
  const savings = originalTotal - finalTotal;
  const pricePerSession = Math.round(finalTotal / sessions);
  // Every region gets the same tier %, so show that exact figure (10/15/20),
  // not the effective one, which rounding to 00 can nudge to e.g. 11%.
  const blendedPct = originalTotal > 0 ? tierPercent(sessions) : 0;

  return { sessions, originalTotal, finalTotal, savings, pricePerSession, blendedPct };
}

/**
 * Pre-calculated showcase bundles for the landing page (women's list prices
 * from the catalog). The first one is also the laser side of the price
 * comparison, so both sections always quote the same number.
 */
export const SHOWCASE_BUNDLES = [
  { title: "Celo telo", subtitle: "Cela površina tela", price: 8500, sessions: 8, keywords: ["telo"] },
  { title: "Celo lice", subtitle: "Kompletan tretman lica", price: 2500, sessions: 10, keywords: ["lice"] },
  { title: "Noge + Intima", subtitle: "Najtraženija kombinacija", price: 6000, sessions: 6, keywords: ["noge", "intima"] },
];

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
