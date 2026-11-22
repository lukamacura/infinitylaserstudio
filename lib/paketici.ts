// ── Infinity paketići (/paketici) ───────────────────────────────────────────────
// The New Year gift box: a voucher for laser hair removal in a premium box.
// Pure and dependency-light - shared by the page (live totals, bonus nudges)
// and app/api/paketici, which recomputes every order from the database's
// prices. Numbers sent by the browser are never trusted.
//
// Everything is at full price - no package discount. The only extra is one free
// treatment that grows with the size of the gift (see BONUS_LADDER).

import { applyComboRules } from "./pricing";

export type GiftVersion = "zenska" | "muska";
export type GiftMode = "iznos" | "regije" | "paket";
export type Delivery = "novi_sad" | "posta" | "studio";
export type Payment = "pouzece" | "kartica";
export type Occasion = "nova_godina" | "rodjendan" | "bez";
/** 0 = no bonus yet; 3 / 6 / 8 = the treatment count the bonus belongs to. */
export type Tier = 0 | 3 | 6 | 8;

/** How many boxes are made. Mirrored in sql/paketici.sql (gift_orders_limit). */
export const GIFT_LIMIT = 50;
/** Nothing smaller is sold as a box (~100 €); below it, a regular voucher. */
export const MIN_TOTAL = 12_000;
export const AMOUNT_STEP = 5_000;
export const MAX_AMOUNT = 150_000;
/** The slider's stops: 12.000, then every 5.000 from 15.000 up to 150.000. */
export const AMOUNTS: number[] = [
  MIN_TOTAL,
  ...Array.from({ length: (MAX_AMOUNT - 15_000) / AMOUNT_STEP + 1 }, (_, i) => 15_000 + i * AMOUNT_STEP),
];
export const DEFAULT_AMOUNT = 25_000;

/** Option 3 - the same 3/6/8 packages as in the booking modal, at full price. */
export const PACKAGE_SIZES = [3, 6, 8] as const;
/** Option 2 - one treatment alone is never sold; 8 is a full course. */
export const MIN_SESSIONS = 2;
export const MAX_SESSIONS = 8;
export const DEFAULT_SESSIONS = 6;
export const DEFAULT_PACKAGE = 6;

/** The studio whose prices (and address) the gift uses. */
export const GIFT_LOCATION = "novi_sad" as const;

/**
 * Wistia media id of Branka's video ("Ako ne znaš šta tvoja devojka želi…").
 * null until it is recorded - the page then shows a poster without a player.
 */
export const VSL_WISTIA_ID: string | null = null;
/** Width ÷ height of that video: 9/16 vertical (phone), 16/9 if it is shot wide. */
export const VSL_ASPECT = 9 / 16;

/** Online card payment shows up only once a provider is connected. */
export const CARD_PAYMENTS_ON = process.env.NEXT_PUBLIC_PAKETICI_KARTICA === "1";

// ── The free treatment ────────────────────────────────────────────────────────
// One free treatment per gift, by size. `service` is the treatment's name in the
// database (lower case) - its price there is shown as the bonus's worth.
// The men's ladder was not given; these are face/small regions of the men's
// list so nothing larger than the women's bonus is given away. Change here.
export const BONUS_LADDER: Record<GiftVersion, Record<3 | 6 | 8, { label: string; service: string }>> = {
  zenska: {
    3: { label: "Nausnice", service: "nausnice" },
    6: { label: "Nausnice + brada", service: "nausnice i brada" },
    8: { label: "Celo lice", service: "celo lice" },
  },
  muska: {
    3: { label: "1/2 lica", service: "1/2 lica" },
    6: { label: "Pazuh", service: "pazuh" },
    8: { label: "Celo lice", service: "lice" },
  },
};

/**
 * Option 1 has no treatment count, so the bonus follows the amount: each step
 * sits at about what that package costs for the two most bought choices
 * (Noge + intima and Celo telo, Novi Sad: 3× ≈ 22–33k, 6× ≈ 44–65k,
 * 8× ≈ 58–87k), on the slider's 5.000 grid.
 */
export const AMOUNT_TIERS: { min: number; tier: 3 | 6 | 8 }[] = [
  { min: 25_000, tier: 3 },
  { min: 50_000, tier: 6 },
  { min: 70_000, tier: 8 },
];

export function tierForSessions(n: number): Tier {
  return n >= 8 ? 8 : n >= 6 ? 6 : n >= 3 ? 3 : 0;
}

export function tierForAmount(amount: number): Tier {
  let t: Tier = 0;
  for (const s of AMOUNT_TIERS) if (amount >= s.min) t = s.tier;
  return t;
}

/** The next bonus step above `n` treatments, or null at the top. */
export function nextSessionTier(n: number): { tier: 3 | 6 | 8; missing: number } | null {
  for (const t of PACKAGE_SIZES) if (n < t) return { tier: t, missing: t - n };
  return null;
}

/** The next bonus step above `amount`, or null at the top. */
export function nextAmountTier(amount: number): { tier: 3 | 6 | 8; min: number; missing: number } | null {
  for (const s of AMOUNT_TIERS) if (amount < s.min) return { ...s, missing: s.min - amount };
  return null;
}

// ── Treatments ────────────────────────────────────────────────────────────────

/** A treatment with today's Novi Sad price. */
export interface GiftService {
  id: string;
  name: string;
  price: number;
}

/** Both lists - women's for the women's box, men's for the men's. */
export type GiftCatalog = Record<GiftVersion, GiftService[]>;

export interface Bonus {
  tier: 3 | 6 | 8;
  label: string;
  /** Regular price of that treatment; null when the database has none. */
  value: number | null;
}

export function bonusFor(version: GiftVersion, tier: Tier, services: GiftService[]): Bonus | null {
  if (tier === 0) return null;
  const b = BONUS_LADDER[version][tier];
  const svc = services.find((s) => s.name.trim().toLowerCase() === b.service);
  return { tier, label: b.label, value: svc?.price ?? null };
}

// Same region rules as the booking modal (components/booking/shared.tsx) -
// that file is a client module, so the server can't import it.
const COMBO_KEYS = ["nausnice i brada", "noge + intima", "stomak + grudi"];
const FULL_BODY = "celo telo";
const WITH_FULL_BODY = ["nausnice", "brada", "celo lice"];
const FULL_FACE = "celo lice";
const UNDER_FULL_FACE = ["nausnice", "brada"];

const lc = (s: string) => s.toLowerCase();
const isCombo = (name: string) => COMBO_KEYS.some((k) => lc(name).includes(k));
const isFullBody = (name: string) => lc(name).includes(FULL_BODY);
const isFullFace = (name: string) => lc(name).includes(FULL_FACE);
const okWithFullBody = (name: string) => isFullBody(name) || WITH_FULL_BODY.some((k) => lc(name).includes(k));
const coveredByFullFace = (name: string) => !isFullFace(name) && UNDER_FULL_FACE.some((k) => lc(name).includes(k));

/** The regions to pick from: combos are priced automatically, so not listed. */
export function pickableRegions(services: GiftService[]): GiftService[] {
  const visible = services.filter((s) => !isCombo(s.name));
  return [...visible.filter((s) => isFullBody(s.name)), ...visible.filter((s) => !isFullBody(s.name))];
}

/**
 * Toggles one region. Whole body already covers every body region, and whole
 * face covers earrings and chin, so picking one drops what it covers - and
 * picking a covered region drops the whole one.
 */
export function toggleRegion(selected: string[], id: string, services: GiftService[]): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  const byId = new Map(services.map((s) => [s.id, s]));
  const added = byId.get(id);
  if (!added) return selected;
  const keep = selected.filter((x) => {
    const s = byId.get(x);
    if (!s) return false;
    if (isFullBody(added.name) && !okWithFullBody(s.name)) return false;
    if (isFullBody(s.name) && !okWithFullBody(added.name)) return false;
    if (isFullFace(added.name) && coveredByFullFace(s.name)) return false;
    if (isFullFace(s.name) && coveredByFullFace(added.name)) return false;
    return true;
  });
  return [...keep, id];
}

/** One visit's price for the picked regions, combos applied (Noge + Intima…). */
export function regionsPrice(ids: string[], services: GiftService[]): { perSession: number; names: string[] } {
  const picked = services.filter((s) => ids.includes(s.id));
  const effective = applyComboRules(picked, services);
  return {
    perSession: effective.reduce((sum, s) => sum + s.price, 0),
    names: effective.map((s) => s.name),
  };
}

// ── A whole order ─────────────────────────────────────────────────────────────

export interface GiftSelection {
  version: GiftVersion;
  mode: GiftMode;
  amount?: number;
  regionIds?: string[];
  sessions?: number;
}

export type GiftQuote =
  | {
      ok: true;
      total: number;
      tier: Tier;
      bonus: Bonus | null;
      /** null for a fixed amount. */
      sessions: number | null;
      perSession: number | null;
      regions: string[];
    }
  | { ok: false; reason: "amount" | "regions" | "sessions" | "min" };

/**
 * What a selection costs and which free treatment comes with it. `services` is
 * the version's own list (women's or men's) at Novi Sad prices.
 */
export function quoteGift(sel: GiftSelection, services: GiftService[]): GiftQuote {
  if (sel.mode === "iznos") {
    const amount = sel.amount ?? 0;
    if (!AMOUNTS.includes(amount)) return { ok: false, reason: "amount" };
    const tier = tierForAmount(amount);
    return {
      ok: true, total: amount, tier, bonus: bonusFor(sel.version, tier, services),
      sessions: null, perSession: null, regions: [],
    };
  }

  const ids = [...new Set(sel.regionIds ?? [])];
  const known = ids.filter((id) => services.some((s) => s.id === id && !isCombo(s.name)));
  if (known.length === 0 || known.length !== ids.length) return { ok: false, reason: "regions" };

  const n = sel.sessions ?? 0;
  const sizeOk = sel.mode === "paket"
    ? (PACKAGE_SIZES as readonly number[]).includes(n)
    : Number.isInteger(n) && n >= MIN_SESSIONS && n <= MAX_SESSIONS;
  if (!sizeOk) return { ok: false, reason: "sessions" };

  const { perSession, names } = regionsPrice(known, services);
  const total = perSession * n;
  if (total < MIN_TOTAL) return { ok: false, reason: "min" };
  const tier = tierForSessions(n);
  return {
    ok: true, total, tier, bonus: bonusFor(sel.version, tier, services),
    sessions: n, perSession, regions: names,
  };
}

/** "Noge + Intima × 6 tretmana" / "Iznos 50.000 RSD" - one line for emails and the admin. */
export function describeGift(mode: GiftMode, q: Extract<GiftQuote, { ok: true }>): string {
  if (mode === "iznos") return `Iznos ${formatRsd(q.total)}`;
  const what = q.regions.join(" + ");
  return mode === "paket"
    ? `Paket ${q.sessions} tretmana: ${what}`
    : `${what} × ${q.sessions} ${treatmentsWord(q.sessions ?? 0)}`;
}

// ── Words ─────────────────────────────────────────────────────────────────────

/** 12000 → "12.000 RSD". Hand-made so server and browser always agree. */
export function formatRsd(n: number): string {
  return `${formatNumber(n)} RSD`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1 tretman, 21 tretman - every other count is "tretmana". */
export function treatmentsWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "tretman" : "tretmana";
}

export const VERSION_LABEL: Record<GiftVersion, string> = {
  zenska: "Ženska verzija (za nju)",
  muska: "Muška verzija (za njega)",
};

export const DELIVERY_LABEL: Record<Delivery, string> = {
  novi_sad: "Dostava na adresu u Novom Sadu",
  posta: "Dostava poštom (van Novog Sada)",
  studio: "Lično preuzimanje u studiju",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  nova_godina: "Srećna Nova godina",
  rodjendan: "Happy Birthday",
  bez: "Bez stikera",
};

export const PAYMENT_LABEL: Record<Payment, string> = {
  pouzece: "Pouzećem (pri preuzimanju)",
  kartica: "Karticom na sajtu",
};

/** The database's gender for a version. */
export const VERSION_GENDER: Record<GiftVersion, "zene" | "muskarci"> = {
  zenska: "zene",
  muska: "muskarci",
};

/**
 * Most bought packages so far (confirmed bookings, Apr–Nov 2026): Celo telo,
 * then Noge + Intima for women; Leđa for men. Shown as quick picks.
 */
export const POPULAR_PICKS: Record<GiftVersion, { label: string; names: string[] }[]> = {
  zenska: [
    { label: "Celo telo", names: ["celo telo"] },
    { label: "Noge + intima", names: ["noge", "intima"] },
    { label: "Pazuh + noge + intima", names: ["pazuh", "noge", "intima"] },
  ],
  muska: [{ label: "Leđa", names: ["leđa"] }],
};

/** "Dovoljno za…" under the amount slider - the same choices as POPULAR_PICKS plus one small region. */
export const AMOUNT_EXAMPLES: Record<GiftVersion, string[][]> = {
  zenska: [["celo telo"], ["noge", "intima"], ["pazuh"]],
  muska: [["leđa"], ["stomak", "grudi"], ["pazuh"]],
};

/** Ids for a list of names (exact, lower case) - quick picks and examples. */
export function idsByNames(names: string[], services: GiftService[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const s = services.find((x) => x.name.trim().toLowerCase() === n && !isCombo(x.name));
    if (!s) return [];
    out.push(s.id);
  }
  return out;
}
