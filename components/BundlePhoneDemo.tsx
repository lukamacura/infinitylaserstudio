"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  ArrowLeft, X, Check, Signal, Wifi, BatteryFull,
  Sparkles, CheckCircle2, CalendarHeart, type LucideIcon,
} from "lucide-react";
import { computeBundle } from "@/lib/bundles";
import { getRegionArt, RegionThumb, THUMB_SIZES, formatPrice } from "@/components/booking/shared";

// ── Demo script ──────────────────────────────────────────────────────────────
// A scripted walk through the booking modal's bundle flow, played on a loop
// inside an iPhone frame: pick Noge + Intima → pick the 8-session package →
// confirm. Prices are the women's list prices from the catalog.

const REGIONS = [
  { key: "pazuh", name: "Pazuh", price: 2300 },
  { key: "noge", name: "Noge", price: 4300 },
  { key: "intima", name: "Intima", price: 3500 },
  { key: "ruke", name: "Ruke", price: 3400 },
];

/** Noge + Intima is a combo product with its own price. */
const COMBO = { name: "Noge + Intima", price: 6000 };
const BUNDLE_SIZES = [3, 6, 8];
const PICKED_SIZE = 8;

type Tap = "noge" | "intima" | "next" | "bundle" | "confirm";

interface Frame {
  screen: 0 | 1 | 2;
  selected: string[];
  bundle: boolean;
  done: boolean;
  tap?: Tap;
  ms: number;
}

const BOTH = ["noge", "intima"];

const FRAMES: Frame[] = [
  { screen: 0, selected: [], bundle: false, done: false, ms: 1000 },
  { screen: 0, selected: [], bundle: false, done: false, tap: "noge", ms: 500 },
  { screen: 0, selected: ["noge"], bundle: false, done: false, ms: 700 },
  { screen: 0, selected: ["noge"], bundle: false, done: false, tap: "intima", ms: 500 },
  { screen: 0, selected: BOTH, bundle: false, done: false, ms: 1200 },
  { screen: 0, selected: BOTH, bundle: false, done: false, tap: "next", ms: 500 },
  { screen: 1, selected: BOTH, bundle: false, done: false, ms: 1400 },
  { screen: 1, selected: BOTH, bundle: false, done: false, tap: "bundle", ms: 500 },
  { screen: 1, selected: BOTH, bundle: true, done: false, ms: 1400 },
  { screen: 2, selected: BOTH, bundle: true, done: false, ms: 2400 },
  { screen: 2, selected: BOTH, bundle: true, done: false, tap: "confirm", ms: 500 },
  { screen: 2, selected: BOTH, bundle: true, done: true, ms: 2800 },
];

/** Where each step starts, and where it rests when nothing is animating. */
const STEP_START = [0, 6, 9];
const STEP_REST = [4, 8, 11];

const STEPS: { Icon: LucideIcon; title: string; text: string; sub: string }[] = [
  { Icon: Sparkles, title: "Izaberi regije", text: "Kombinuj lice i telo.", sub: "Odaberi regije za tretman" },
  { Icon: CheckCircle2, title: "Izaberi paket", text: "Veći paket, veći popust.", sub: "Pojedinačno ili paket sa popustom?" },
  { Icon: CalendarHeart, title: "Plati jednom", text: "Svi termini su ti zagarantovani.", sub: "Pregled i potvrda" },
];

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The fingertip: shown on whatever the script is pressing right now. */
function TapDot() {
  return <span className="phone-tap" aria-hidden="true" />;
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-300 ${checked ? "border-accent bg-accent" : "border-foreground/20"}`}>
      {checked && <Check size={11} strokeWidth={3.5} className="text-on-accent" />}
    </span>
  );
}

export default function BundlePhoneDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );

  // Play only while the phone is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reduced) return;
    const t = setTimeout(() => setFrameIdx((i) => (i + 1) % FRAMES.length), FRAMES[frameIdx].ms);
    return () => clearTimeout(t);
  }, [frameIdx, inView, reduced]);

  const frame = FRAMES[frameIdx];
  const { screen, selected, bundle, done, tap } = frame;

  const comboOn = selected.length === 2;
  const total = comboOn
    ? COMBO.price
    : REGIONS.filter((r) => selected.includes(r.key)).reduce((sum, r) => sum + r.price, 0);
  const picked = computeBundle([COMBO], PICKED_SIZE);

  const panel = (i: number) =>
    `absolute inset-0 flex flex-col transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
      i === screen ? "opacity-100" : "opacity-0 pointer-events-none"
    }`;
  const panelStyle = (i: number) => ({ transform: `translateX(${(i - screen) * 100}%)` });

  return (
    <div ref={rootRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-center">
      {/* ── iPhone ─────────────────────────────────────────────────────────── */}
      <div className="relative order-2 lg:order-1 mx-auto lg:justify-self-end lg:mx-0" role="img" aria-label="Prikaz zakazivanja paketa u tri koraka: izaberi regije, izaberi paket, plati jednom">
        <div className="absolute inset-8 rounded-full bg-accent/25 blur-[90px] pointer-events-none" aria-hidden="true" />

        {/* Side buttons */}
        <span className="absolute -left-[3px] top-[112px] w-[3px] h-7 rounded-l bg-[#3a2a31]" aria-hidden="true" />
        <span className="absolute -left-[3px] top-[160px] w-[3px] h-12 rounded-l bg-[#3a2a31]" aria-hidden="true" />
        <span className="absolute -left-[3px] top-[220px] w-[3px] h-12 rounded-l bg-[#3a2a31]" aria-hidden="true" />
        <span className="absolute -right-[3px] top-[180px] w-[3px] h-[72px] rounded-r bg-[#3a2a31]" aria-hidden="true" />

        {/* Body */}
        <div className="relative w-[280px] h-[572px] lg:w-[300px] lg:h-[620px] rounded-[3.25rem] p-[9px] bg-linear-to-b from-[#4a363e] via-[#1c1115] to-[#0a0507] border border-white/15 shadow-2xl shadow-black/70" aria-hidden="true">
          <div
            className="bm-theme bm-theme-zene relative w-full h-full rounded-[2.75rem] overflow-hidden flex flex-col font-poppins select-none"
            style={{ backgroundColor: "var(--bm-bg)", backgroundImage: "var(--bm-bg-image)" }}
          >
            {/* Status bar + dynamic island */}
            <div className="relative shrink-0 h-12 flex items-center justify-between px-7 pt-1.5">
              <span className="text-[13px] font-semibold tracking-tight">9:41</span>
              <span className="absolute left-1/2 top-2.5 -translate-x-1/2 w-[92px] h-[27px] rounded-full bg-black flex items-center justify-end pr-2.5">
                <span className="w-2 h-2 rounded-full bg-[#15151c] ring-1 ring-white/10" />
              </span>
              <span className="flex items-center gap-1">
                <Signal size={14} strokeWidth={2.5} />
                <Wifi size={14} strokeWidth={2.5} />
                <BatteryFull size={19} strokeWidth={2} />
              </span>
            </div>

            {/* Navigation bar */}
            <div className="shrink-0 flex items-center justify-between px-3 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-8 h-8 flex items-center justify-center rounded-full">
                  <ArrowLeft size={16} />
                </span>
                <span className="text-xl font-bold font-playfair bm-metal-text">Zakaži tretman</span>
              </span>
              <span className="w-8 h-8 flex items-center justify-center rounded-full">
                <X size={17} />
              </span>
            </div>

            {/* Step indicator */}
            <div className="shrink-0 px-4 pt-1 pb-3">
              <div className="h-[3px] rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${done ? 100 : ((screen + 1) / (STEPS.length + 1)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-foreground/60 mt-2">{STEPS[screen].sub}</p>
            </div>

            {/* Screens */}
            <div className="relative flex-1 min-h-0">
              {/* 1 · Regions */}
              <div className={panel(0)} style={panelStyle(0)}>
                <div className="flex-1 min-h-0 px-4 flex flex-col gap-2">
                  {REGIONS.map((r) => {
                    const isSelected = selected.includes(r.key);
                    const art = getRegionArt(r.name, "zene");
                    return (
                      <div
                        key={r.key}
                        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl border-2 transition-colors duration-300 ${
                          isSelected ? "border-accent bg-accent/10" : "border-foreground/8"
                        }`}
                      >
                        {art && (
                          <RegionThumb art={art} selected={isSelected} sizes={THUMB_SIZES} className="w-14 h-14 -my-2 -ml-1" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold">{r.name}</p>
                          <p className="text-[11px] text-foreground/40 mt-0.5">{formatPrice(r.price)} RSD</p>
                        </div>
                        <Checkbox checked={isSelected} />
                        {tap === r.key && <TapDot />}
                      </div>
                    );
                  })}
                </div>
                <div className="shrink-0 px-4 pt-3 flex flex-col gap-2">
                  <div className="h-9 flex flex-col items-center justify-center text-center">
                    {selected.length > 0 ? (
                      <>
                        <span className="text-[15px] font-bold text-accent leading-none">{formatPrice(total)} RSD</span>
                        {comboOn && (
                          <span className="flex items-center gap-1 mt-1">
                            <span className="px-1.5 py-px rounded text-[8px] font-bold tracking-wide bm-metal">COMBO</span>
                            <span className="text-[9px] text-foreground/40">paket popust uračunat</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-foreground/45">Odaberite bar jednu uslugu za nastavak.</p>
                    )}
                  </div>
                  <div className={`relative w-full py-3 rounded-full text-center text-xs font-semibold tracking-widest bm-metal transition-opacity duration-300 ${selected.length > 0 ? "" : "opacity-45"}`}>
                    NASTAVI
                    {tap === "next" && <TapDot />}
                  </div>
                </div>
              </div>

              {/* 2 · Package */}
              <div className={panel(1)} style={panelStyle(1)}>
                <div className="flex-1 min-h-0 px-4 pt-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border-2 border-foreground/8">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold">Samo 1 tretman</p>
                      <p className="text-[10px] text-foreground/45">Bez popusta</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums shrink-0">
                      {formatPrice(COMBO.price)}<span className="ml-1 text-[9px] font-semibold">RSD</span>
                    </p>
                  </div>

                  {BUNDLE_SIZES.map((size) => {
                    const b = computeBundle([COMBO], size);
                    const isPick = size === PICKED_SIZE;
                    const isSelected = bundle && isPick;
                    return (
                      <div
                        key={size}
                        className={`relative flex items-center gap-2.5 p-2.5 rounded-2xl border-2 transition-colors duration-300 ${
                          isSelected ? "border-accent bg-accent/10" : "border-foreground/8"
                        }`}
                      >
                        {isPick && (
                          <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest bm-metal">
                            NAJVEĆA UŠTEDA
                          </span>
                        )}
                        <div className="relative shrink-0 w-12 h-12 scale-110">
                          <Image src={`/paketi/${size}.webp`} alt="" fill sizes="56px" className="object-contain" />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[13px] font-bold truncate">Paket {size} tretmana</p>
                            <p className="text-sm font-bold text-accent tabular-nums shrink-0">
                              {formatPrice(b.finalTotal)}<span className="ml-1 text-[9px] font-semibold">RSD</span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bm-metal shrink-0">−{b.blendedPct}%</span>
                              <span className="text-[10px] font-semibold text-emerald-300 truncate">Ušteda {formatPrice(b.savings)}</span>
                            </span>
                            <span className="text-[10px] text-foreground/35 line-through tabular-nums shrink-0">{formatPrice(b.originalTotal)}</span>
                          </div>
                        </div>
                        {isPick && tap === "bundle" && <TapDot />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3 · Pay once */}
              <div className={panel(2)} style={panelStyle(2)}>
                <div className="flex-1 min-h-0 px-4 pt-1">
                  <div className="rounded-2xl bg-foreground/4 p-4">
                    <p className="text-[9px] font-semibold tracking-widest text-foreground/40 mb-2">PREGLED CENE</p>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[11px] text-foreground/60">{COMBO.name}</span>
                      <span className="text-[11px] text-foreground/40">{formatPrice(COMBO.price)} RSD</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 mt-1 mb-3">
                      <span className="text-[11px] text-foreground/60 font-semibold">Paket - {PICKED_SIZE} tretmana</span>
                      <span className="text-[11px] text-foreground/40">× {PICKED_SIZE}</span>
                    </div>
                    <div className="border-t border-foreground/10 pt-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/50">Redovna cena ({PICKED_SIZE}×)</span>
                        <span className="text-xs font-semibold text-foreground/40 line-through">{formatPrice(picked.originalTotal)} RSD</span>
                      </div>
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-xs text-emerald-300 font-semibold">Cena paketa (−{picked.blendedPct}%)</span>
                        <span className="text-xs font-bold text-emerald-300">{formatPrice(picked.finalTotal)} RSD</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-2 border-t border-foreground/8">
                        <span className="text-[11px] text-foreground/40">Ušteda</span>
                        <span className="text-[11px] font-semibold text-accent">{formatPrice(picked.savings)} RSD</span>
                      </div>
                      <p className="text-[10px] text-foreground/45 leading-snug mt-2.5 pt-2.5 border-t border-foreground/8">
                        Ceo paket plaćaš na prvom tretmanu - svi preostali termini su ti zagarantovani.
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2.5 mt-3 px-3 py-2.5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 transition-[opacity,transform] duration-500 motion-reduce:transition-none ${done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
                    <span className="w-6 h-6 rounded-full bg-emerald-300 flex items-center justify-center shrink-0">
                      <Check size={14} strokeWidth={3.5} className="text-[#0B1F14]" />
                    </span>
                    <p className="text-[11px] font-semibold text-emerald-200 leading-snug">
                      Svih {PICKED_SIZE} termina je zagarantovano
                    </p>
                  </div>
                </div>
                <div className="shrink-0 px-4 pt-3">
                  <div className="relative w-full py-3 rounded-full text-center text-xs font-semibold tracking-widest bm-metal">
                    {done ? "POTVRĐENO" : "POTVRDI TERMIN"}
                    {tap === "confirm" && <TapDot />}
                  </div>
                </div>
              </div>
            </div>

            {/* Home indicator */}
            <div className="shrink-0 h-8 flex items-center justify-center">
              <span className="w-28 h-[5px] rounded-full bg-foreground/45" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Steps, in step with the phone: a tab row above it on phones,
             cards beside it on desktop ─────────────────────────────────────── */}
      <ol className="order-1 lg:order-2 grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3 w-full max-w-md mx-auto lg:mx-0">
        {STEPS.map(({ Icon, title, text }, i) => {
          const active = i === screen;
          return (
            <li key={title} className="min-w-0">
              <button
                type="button"
                onClick={() => setFrameIdx(reduced ? STEP_REST[i] : STEP_START[i])}
                aria-current={active ? "step" : undefined}
                className={`flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-4 w-full h-full rounded-2xl border px-2 py-3 lg:p-5 text-center lg:text-left cursor-pointer transition-all duration-500 motion-reduce:transition-none ${
                  active
                    ? "border-accent/60 bg-accent/7 shadow-[0_0_32px_-8px] shadow-accent/60"
                    : "border-foreground/8 bg-foreground/2 opacity-60 hover:opacity-90"
                }`}
              >
                <span className={`inline-flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 shrink-0 rounded-xl transition-colors duration-500 ${active ? "bg-accent text-on-accent" : "bg-rose/10 text-accent"}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-poppins text-xs lg:text-base font-bold text-foreground leading-tight">
                    <span className="hidden lg:inline">{i + 1}. </span>{title}
                  </span>
                  <span className="hidden lg:block font-poppins text-sm text-foreground/55 mt-1">{text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
