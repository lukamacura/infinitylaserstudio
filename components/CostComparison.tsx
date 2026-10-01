import type { CSSProperties } from "react";
import { Caveat } from "next/font/google";
import { computeBundle, SHOWCASE_BUNDLES } from "@/lib/bundles";

// Handwriting for the notes page. Used only here and far below the fold, so
// it is not preloaded - the hero fonts keep the early bandwidth.
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

/** What 20 years of shaving, waxing and creams add up to. */
const TRADITIONAL_TOTAL = 500_000;

// The laser side is a real package from "Primeri paketa", priced by the same
// helper, so the comparison can't drift from what the booking modal charges.
const PACKAGE = SHOWCASE_BUNDLES[0];
const bundle = computeBundle([{ name: PACKAGE.title, price: PACKAGE.price }], PACKAGE.sessions);

const difference = TRADITIONAL_TOTAL - bundle.finalTotal;
const timesCheaper = Math.floor(TRADITIONAL_TOTAL / bundle.finalTotal);

function formatPrice(n: number): string {
  return n.toLocaleString("sr-RS");
}

/** Stagger step for `data-rv` (see "Scroll reveals" in globals.css). */
function step(i: number): CSSProperties {
  return { "--rv-i": i } as CSSProperties;
}

/** Place in the writing order of the notes page (`--w` in globals.css). */
function write(i: number): CSSProperties {
  return { "--w": i } as CSSProperties;
}

function Amount({ sign, value, className = "" }: { sign?: string; value: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap font-bold leading-none ${className}`}>
      {sign && <span className="mr-2">{sign}</span>}
      {formatPrice(value)}
      <span className="ml-1.5 text-[0.6em] font-semibold">RSD</span>
    </span>
  );
}

export default function CostComparison() {
  return (
    <section className="section-y px-6 bg-background-alt">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <div data-rv className="text-center mb-4">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60">
            <span className="w-6 h-px bg-accent inline-block" />
            Jednom platiš. Zauvek slobodna.
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
        </div>

        {/* Headline */}
        <h2 data-rv style={step(1)} className="font-playfair text-4xl md:text-5xl text-foreground text-center leading-tight section-head">
          Šta bi radila sa{" "}
          <span className="relative inline-block">
            500.000 dinara više?
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </h2>

        {/* The sum, worked out by hand on a sheet of squared paper.
            The outer div brings the sheet in; the inner one starts the writing
            once a good part of the page is on screen. */}
        <div data-rv="zoom" className="max-w-xl mx-auto mt-2">
          <div className={`notes-paper ${caveat.className} px-5 pt-10 pb-8 sm:px-9 md:px-11 md:pt-12 md:pb-10`}>
            <span className="notes-tape" aria-hidden />

            <div data-rv="group" data-rv-ratio="0.35" className="notes-body">
              {/* Title */}
              <p className="notes-write relative inline-block text-[1.75rem] md:text-[2rem] font-bold leading-none mb-7">
                Računica za 20 godina
                <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 5 Q40 1 90 4 T198 3" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </p>

              {/* 20 years of the old way */}
              <div className="notes-write flex items-end justify-between gap-3" style={write(1)}>
                <div className="min-w-0">
                  <p className="text-2xl md:text-[1.75rem] font-semibold leading-tight">Brijanje, vosak, kreme</p>
                  <p className="text-xl md:text-[1.35rem] leading-tight opacity-70">20 godina, a dlake se uvek vrate</p>
                </div>
                <Amount value={TRADITIONAL_TOTAL} className="text-[2rem] md:text-[2.5rem]" />
              </div>

              {/* One package */}
              <div className="notes-write flex items-end justify-between gap-3 mt-5" style={write(3)}>
                <div className="min-w-0">
                  <p className="text-2xl md:text-[1.75rem] font-semibold leading-tight">
                    Infinity Laser, paket {PACKAGE.title}
                  </p>
                  <p className="text-xl md:text-[1.35rem] leading-tight opacity-70">
                    {bundle.sessions} tretmana, trajni rezultat
                  </p>
                </div>
                <Amount sign="−" value={bundle.finalTotal} className="text-[2rem] md:text-[2.5rem]" />
              </div>

              {/* Red-pen remark */}
              <p
                className="notes-write text-2xl md:text-[1.75rem] font-bold leading-none mt-2 -rotate-2 origin-left text-(--pen)"
                style={write(5)}
              >
                ↳ {timesCheaper} puta manje!
              </p>

              {/* The line under the sum */}
              <svg className="block w-full h-3 mt-4" viewBox="0 0 400 12" fill="none" preserveAspectRatio="none" aria-hidden>
                <path
                  className="notes-draw"
                  style={write(6)}
                  pathLength={1}
                  d="M2 7 Q70 3 150 6 T290 5 T398 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              {/* What stays with her */}
              <div className="flex items-center justify-between gap-3 mt-4">
                <p className="notes-write text-[1.75rem] md:text-[2rem] font-bold leading-none" style={write(7)}>
                  Ostaje tebi =
                </p>
                <span className="relative inline-block px-1">
                  <span className="notes-write inline-block" style={write(7)}>
                    <Amount value={difference} className="text-[2.25rem] md:text-[2.75rem]" />
                  </span>
                  {/* Circled in red */}
                  <svg
                    className="absolute -inset-x-3 -inset-y-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] overflow-visible"
                    viewBox="0 0 200 64"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      className="notes-draw"
                      style={write(9)}
                      pathLength={1}
                      d="M26 12 C70 1 150 1 182 14 C204 25 198 50 150 58 C95 66 22 60 8 40 C-4 20 40 4 120 7"
                      stroke="var(--pen)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>

              {/* Side sums */}
              <p className="notes-write text-[1.35rem] md:text-2xl leading-tight mt-9" style={write(11)}>
                {formatPrice(bundle.finalTotal)} : {bundle.sessions} ={" "}
                <span className="font-bold">{formatPrice(bundle.pricePerSession)} RSD</span> po tretmanu
              </p>
              <p className="notes-write text-[1.35rem] md:text-2xl leading-tight mt-1 text-(--pen)" style={write(12)}>
                P.S. + 72 sata svake godine koje više ne trošiš na brijanje
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
