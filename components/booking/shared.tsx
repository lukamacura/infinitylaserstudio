"use client";

/**
 * Visual and helper primitives shared by the public BookingModal and the
 * admin's AdminReservationModal. Anything that shapes how a booking step
 * *looks* (accent palette, region artwork, cascade, skeletons) lives here so
 * the two modals can never drift apart visually again.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import Image, { getImageProps } from "next/image";
import {
  ScanFace, Hand, Footprints, Flower2, Minus, Target, Shirt, PersonStanding,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Service } from "@/lib/database.types";

export type Gender = "zene" | "muskarci";

// ── Icon mapping ──────────────────────────────────────────────────────────────
export function getIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("nausnice")) return ScanFace;
  if (n.includes("lice") || n.includes("lica") || n.includes("brada")) return ScanFace;
  if (n.includes("intimna") || n.includes("intima")) return Flower2;
  if (n.includes("pazuh")) return Hand;
  if (n.includes("ruk")) return Hand;
  if (n.includes("linija")) return Minus;
  if (n.includes("stomak")) return Target;
  if (n.includes("nog")) return Footprints;
  if (n.includes("telo")) return PersonStanding;
  if (n.includes("grudi")) return Shirt;
  if (n.includes("leđ") || n.includes("ledj")) return PersonStanding;
  return Target;
}

// ── Region artwork ────────────────────────────────────────────────────────────
// The /regije posters carry a baked-in title along the bottom, so each
// thumbnail zooms onto its highlighted zone instead of showing the full frame.
// `zoom` and the transform-origin (`x`/`y`, in %) pick the visible window; the
// origin-based scale can never reveal anything outside the image itself.
export interface RegionArt { src: string; zoom: number; x: number; y: number }

const FACE_ART = { zoom: 1.6, x: 50, y: 5 };
// Men's heads fill more of the frame - pull back so the hairline stays in.
const FACE_ART_M = { zoom: 1.45, x: 50, y: 0 };

// Posters live in /public/regije/<gender>/<slug>.webp - folder names match the
// Gender keys and slugs are plain ASCII, so the path needs no encoding.
const regionSrc = (gender: Gender, slug: string) => `/regije/${gender}/${slug}.webp`;

function getWomenArt(n: string): RegionArt | null {
  const src = (slug: string) => regionSrc("zene", slug);
  if (n.includes("nausnice"))  return { src: src("nausnice"), ...FACE_ART };
  if (n.includes("brada"))     return { src: src("brada"), ...FACE_ART };
  if (n.includes("lice") || n.includes("lica")) return { src: src("celo-lice"), ...FACE_ART };
  if (n.includes("intim"))     return { src: src("intima"), zoom: 2.2, x: 50, y: 22 };
  if (n.includes("pazuh"))     return { src: src("pazuh"), zoom: 2.2, x: 54, y: 0 };
  if (n.includes("1/2 ruk"))   return { src: src("pola-ruku"), zoom: 2.2, x: 50, y: 9 };
  if (n.includes("ruk"))       return { src: src("ruke"), zoom: 2, x: 50, y: 4 };
  if (n.includes("1/2 nog"))   return { src: src("pola-nogu"), zoom: 2.1, x: 50, y: 53 };
  if (n.includes("nog"))       return { src: src("noge"), zoom: 2, x: 50, y: 54 };
  if (n.includes("telo"))      return { src: src("celo-telo"), zoom: 1.3, x: 50, y: 0 };
  return null;
}

function getMenArt(n: string): RegionArt | null {
  const src = (slug: string) => regionSrc("muskarci", slug);
  if (n.includes("1/2 lic"))   return { src: src("pola-lica"), ...FACE_ART_M };
  if (n.includes("lice") || n.includes("lica")) return { src: src("celo-lice"), ...FACE_ART_M };
  if (n.includes("pazuh"))     return { src: src("pazuh"), zoom: 2.2, x: 45, y: 0 };
  if (n.includes("1/2 ruk"))   return { src: src("pola-ruku"), zoom: 2.2, x: 50, y: 9 };
  if (n.includes("ruk"))       return { src: src("ruke"), zoom: 2, x: 50, y: 0 };
  if (n.includes("1/2 le"))    return { src: src("pola-ledja"), zoom: 2.2, x: 50, y: 0 };
  if (n.includes("leđ") || n.includes("ledj")) return { src: src("cela-ledja"), zoom: 2, x: 50, y: 0 };
  if (n.includes("grudi"))     return { src: src("grudi"), zoom: 2.2, x: 50, y: 0 };
  if (n.includes("stomak") && !n.includes("linija")) return { src: src("stomak"), zoom: 2.2, x: 50, y: 5.5 };
  if (n.includes("telo"))      return { src: src("celo-telo"), zoom: 1.3, x: 50, y: 0 };
  return null;
}

export function getRegionArt(name: string, gender: Gender): RegionArt | null {
  const n = name.toLowerCase();
  return gender === "zene" ? getWomenArt(n) : getMenArt(n);
}

// `sizes` must match between the cards and the preloader so the browser picks
// the same srcset candidate and the preload is a cache hit.
export const THUMB_SIZES = "(min-width: 640px) 216px, 180px";
export const HERO_THUMB_SIZES = "(min-width: 640px) 150px, 128px";
export const THUMB_QUALITY = 75;

// One representative name per image - enough to resolve every file once.
const REGION_KEYS: Record<Gender, string[]> = {
  zene: ["nausnice", "brada", "celo lice", "intim", "pazuh", "1/2 ruku", "ruke", "1/2 nogu", "noge", "celo telo"],
  muskarci: ["1/2 lica", "celo lice", "pazuh", "1/2 ruku", "ruke", "1/2 leđa", "cela leđa", "grudi", "stomak", "celo telo"],
};

const preloaded = new Set<string>();

/** Warms the cache for a gender's artwork while the services request is in
 *  flight. Runs at idle, low priority, so it never competes with the page. */
export function preloadRegionArt(gender: Gender) {
  if (typeof window === "undefined" || preloaded.has(gender)) return;
  preloaded.add(gender);
  const run = () => {
    for (const key of REGION_KEYS[gender]) {
      const art = getRegionArt(key, gender);
      if (!art) continue;
      const sizes = isFullBody(key) ? HERO_THUMB_SIZES : THUMB_SIZES;
      const { props } = getImageProps({ src: art.src, alt: "", fill: true, sizes, quality: THUMB_QUALITY });
      const img = new window.Image();
      img.decoding = "async";
      img.fetchPriority = "low";
      img.sizes = sizes;
      if (props.srcSet) img.srcset = props.srcSet;
      img.src = props.src;
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 600 });
  else setTimeout(run, 1);
}

/** Artwork for a treatment card, frameless. Screen blending drops the image's
 *  dark backdrop into the card and a radial mask feathers the crop edges, so
 *  only the glowing figure remains. Dimmed at rest, full glow when selected. */
const FEATHER_MASK = "radial-gradient(closest-side, #000 62%, transparent 100%)";

/** Length of the `.bm-card-in` entrance (globals.css). While it runs the card
 *  is an isolated group, so screen blending has no backdrop and the poster's
 *  dark background shows through - reveal the figure only after it ends. */
export const CARD_IN_MS = 560;

export function RegionThumb({
  art, selected, sizes, className, revealDelay = 0,
}: { art: RegionArt; selected: boolean; sizes: string; className: string; revealDelay?: number }) {
  const [loaded, setLoaded] = useState(false);
  // The figure should light up just after its card lands. When the image is
  // already cached that is `revealDelay` after mount; when it arrives late the
  // remaining wait shrinks to zero so it never lingers invisible.
  // Captured on first render: next/image can report a cached image as loaded
  // before effects run, so an effect-set timestamp would still be empty.
  const [mountedAt] = useState(() => performance.now());
  const [delay, setDelay] = useState(revealDelay);

  const handleLoad = () => {
    const elapsed = performance.now() - mountedAt;
    setDelay(Math.max(0, revealDelay - elapsed));
    setLoaded(true);
  };

  return (
    <div
      className={`relative shrink-0 mix-blend-screen transition-[opacity,transform] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity motion-reduce:scale-100 ${
        loaded ? "opacity-100 scale-100 duration-[900ms]" : "opacity-0 scale-[0.9] duration-0"
      } ${className}`}
      style={{
        maskImage: FEATHER_MASK, WebkitMaskImage: FEATHER_MASK,
        maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        transitionDelay: loaded ? `${delay}ms` : "0ms",
      }}
    >
      {/* Hover / selected zoom sits on its own layer so it composes with the crop */}
      <div
        className={`absolute inset-0 overflow-hidden transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          selected ? "scale-[1.08]" : "group-hover:scale-[1.05]"
        }`}
        style={{ transformOrigin: `${art.x}% ${art.y}%` }}
      >
        <Image
          src={art.src}
          alt=""
          fill
          sizes={sizes}
          quality={THUMB_QUALITY}
          draggable={false}
          onLoad={handleLoad}
          onError={handleLoad}
          className={`object-cover select-none transition-[filter] duration-500 ease-out ${
            selected ? "brightness-125 saturate-110" : "brightness-90 saturate-[0.85] group-hover:brightness-110"
          }`}
          style={{ transform: `scale(${art.zoom})`, transformOrigin: `${art.x}% ${art.y}%` }}
        />
      </div>
    </div>
  );
}

// ── Date & day helpers ────────────────────────────────────────────────────────
export const SR_DAYS_FULL = [
  "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja",
];
export const SR_MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];
export const SR_MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "avg", "sep", "okt", "nov", "dec",
];

/** Returns Monday-index (0=Mon, 6=Sun) for a JS Date */
export function monIdx(d: Date) { return (d.getDay() + 6) % 7; }

export function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateFull(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${SR_DAYS_FULL[monIdx(d)]}, ${d.getDate()}. ${SR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

export interface DayOption {
  date: string;       // YYYY-MM-DD
  label: string;      // "Ponedeljak"
  shortDate: string;  // "24. feb"
  isToday: boolean;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("sr-RS");
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Body scroll lock ──────────────────────────────────────────────────────────
// `overflow: hidden` alone does not stop iOS Safari from dragging the page
// behind a full-screen modal. Pinning the body at its current offset does; the
// offset is put back on unlock so the page never jumps. Module-level so every
// mounted modal instance (floating button + page + admin) shares one lock.
let lockedScrollY: number | null = null;

export function lockBodyScroll() {
  if (lockedScrollY !== null) return;
  lockedScrollY = window.scrollY;
  const s = document.body.style;
  s.position = "fixed";
  s.top = `-${lockedScrollY}px`;
  s.left = "0";
  s.right = "0";
  s.width = "100%";
  s.overflow = "hidden";
}

export function unlockBodyScroll() {
  if (lockedScrollY === null) return;
  const y = lockedScrollY;
  lockedScrollY = null;
  const s = document.body.style;
  s.position = ""; s.top = ""; s.left = ""; s.right = ""; s.width = ""; s.overflow = "";
  // "instant": the page has `scroll-behavior: smooth`, which would animate the restore.
  window.scrollTo({ top: y, behavior: "instant" });
}

// ── Combo detection ───────────────────────────────────────────────────────────
interface ComboRule {
  parts: string[];   // lowercase substrings that identify the component services
  comboKey: string;  // lowercase substring that identifies the combo service
}

const COMBO_RULES: ComboRule[] = [
  { parts: ["nausnice", "brada"],  comboKey: "nausnice i brada" },
  { parts: ["noge", "intima"],     comboKey: "noge + intima" },
  { parts: ["stomak", "grudi"],    comboKey: "stomak + grudi" },
];

/** Returns true if this service is a combo product (should be hidden from the list) */
export function isComboService(name: string): boolean {
  const n = name.toLowerCase();
  return COMBO_RULES.some((r) => n.includes(r.comboKey));
}

// ── "Celo telo" exclusivity ─────────────────────────────────────────────────
// When the whole body is selected, only earrings, chin and whole face may be
// added alongside it - every other region is already covered by "Celo telo".
const FULL_BODY_KEY = "celo telo";
const FULL_BODY_ALLOWED = ["nausnice", "brada", "celo lice"];

export function isFullBody(name: string): boolean {
  return name.toLowerCase().includes(FULL_BODY_KEY);
}

/** Services that may stay selectable when "Celo telo" is chosen. */
export function isAllowedWithFullBody(name: string): boolean {
  const n = name.toLowerCase();
  return isFullBody(name) || FULL_BODY_ALLOWED.some((k) => n.includes(k));
}

/**
 * Given the currently selected services and all loaded services,
 * returns the effective list for price/duration calculation:
 * combo component pairs are replaced with the combo service.
 * Also returns which combos were applied (for UI badge).
 */
export function applyComboRules(
  selected: Service[],
  all: Service[]
): { effective: Service[]; appliedCombos: Service[] } {
  let effective = [...selected];
  const appliedCombos: Service[] = [];

  for (const rule of COMBO_RULES) {
    const matchedParts = rule.parts
      .map((part) => effective.find((s) => s.name.toLowerCase().includes(part)))
      .filter((s): s is Service => s !== undefined);

    if (matchedParts.length === rule.parts.length) {
      const combo = all.find((s) => s.name.toLowerCase().includes(rule.comboKey));
      if (combo) {
        effective = effective.filter((s) => !matchedParts.includes(s));
        effective.push(combo);
        appliedCombos.push(combo);
      }
    }
  }

  return { effective, appliedCombos };
}

/** Step 2 list order - "Celo telo" leads, it is the offer we most want booked. */
export function orderPickableServices(services: Service[]): Service[] {
  const visible = services.filter((s) => !isComboService(s.name));
  return [
    ...visible.filter((s) => isFullBody(s.name)),
    ...visible.filter((s) => !isFullBody(s.name)),
  ];
}

// ── Accent theme ──────────────────────────────────────────────────────────────
// Both genders run on a dark sheet (see `.bm-theme-*` in globals.css):
// zene = midnight plum + rose gold, muskarci = obsidian + antique gold.
export const ACCENTS = {
  zene: {
    hex: "#DCA8A6",
    onHex: "#1E1017",
    border: "border-[#DCA8A6]",
    bg: "bg-[#DCA8A6]",
    bgLight: "bg-[#DCA8A6]/10",
    bgMed: "bg-[#DCA8A6]/20",
  },
  muskarci: {
    hex: "#D4AF67",
    onHex: "#0B0B0C",
    border: "border-[#D4AF67]",
    bg: "bg-[#D4AF67]",
    bgLight: "bg-[#D4AF67]/10",
    bgMed: "bg-[#D4AF67]/20",
  },
} as const;

/** Step 1 gender cards - the surface gradient matches each gender's sheet. */
export const GENDER_OPTIONS = [
  { key: "zene",     label: "Žene",      sub: "Tretmani za žene",      image: "/pol/zenski.webp", Icon: Flower2,         hex: ACCENTS.zene.hex,     surface: "linear-gradient(120deg, #1E1017 0%, #120A0E 100%)" },
  { key: "muskarci", label: "Muškarci",  sub: "Tretmani za muškarce",  image: "/pol/muski.webp",  Icon: PersonStanding,  hex: ACCENTS.muskarci.hex, surface: "linear-gradient(120deg, #161616 0%, #0B0B0C 100%)" },
] as const;

/**
 * The modal is full-screen on every device, so on desktop the content would
 * otherwise stretch across the whole viewport. Header, body and footer all share
 * this centered column - mobile is untouched (max-width kicks in only from sm).
 */
export const COL_W = "w-full sm:max-w-[680px] md:max-w-[760px] sm:mx-auto";

/** Inline stagger for `.bm-card-in`: item `index` lands `stepMs` after the
 *  previous one, capped so a long list never keeps the user waiting. */
export function cascade(index: number, stepMs: number, cap: number): CSSProperties {
  return { animationDelay: `${Math.min(index, cap) * stepMs}ms` };
}

/** Shape-matched placeholder block (see `.bm-skeleton` in globals.css). */
export function Skeleton({ className }: { className: string }) {
  return <div className={`bm-skeleton ${className}`} aria-hidden="true" />;
}

/** Pre-treatment instructions - shown on the "preparation" step of both modals. */
export { PREPARATION_STEPS } from "@/lib/preparation";
