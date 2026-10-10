import type { CSSProperties } from "react";
import { Caveat } from "next/font/google";

// Handwriting for the notes page. Not preloaded, and applied only once the
// page has loaded (`.hand`, see globals.css) - the hero keeps the early bandwidth.
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

/** Years of removing hair the usual way, roughly from 16 to 56. */
const YEARS = 40;

/** What the usual way costs a year, item by item (rough RSD estimates). */
const YEARLY_COSTS = [
  { label: "Žileti i pena za brijanje", perYear: 6_000 },
  { label: "Depilacija voskom u salonu", perYear: 10_000 },
  { label: "Kreme, losioni i trake", perYear: 4_000 },
];

/** Shaving ~10 minutes, 4 times a week. */
const HOURS_PER_YEAR = Math.round((10 * 4 * 52) / 60);

const LIFETIME_TOTAL = YEARLY_COSTS.reduce((sum, c) => sum + c.perYear * YEARS, 0);
const lifetimeDays = Math.round((HOURS_PER_YEAR * YEARS) / 24);

function formatPrice(n: number): string {
  return n.toLocaleString("sr-RS");
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
    <section className="section-y px-4 sm:px-6 bg-background-alt">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <div data-rv className="text-center mb-4">
          <h2 className="inline-flex items-center gap-2 font-poppins font-normal text-sm text-foreground/60">
            <span className="w-6 h-px bg-accent inline-block" />
            Koliko te dlačice koštaju za ceo život?
            <span className="w-6 h-px bg-accent inline-block" />
          </h2>
        </div>

        {/* The sum, worked out by hand on a sheet of squared paper.
            The outer div brings the sheet in; the inner one starts the writing
            once a good part of the page is on screen. */}
        <div data-rv="zoom" className="max-w-xl mx-auto mt-2">
          <div className={`notes-paper ${caveat.variable} hand px-4 pt-8 pb-6 sm:px-9 md:px-11 md:pt-12 md:pb-10`}>
            <span className="notes-tape" aria-hidden />

            <div data-rv="group" data-rv-ratio="0.35" className="notes-body">
              {/* Title */}
              <p className="notes-write relative inline-block text-2xl md:text-[2rem] font-bold leading-none mb-5 md:mb-7">
                Računica za {YEARS} godina
                <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 5 Q40 1 90 4 T198 3" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </p>

              {/* One line per item */}
              {YEARLY_COSTS.map((c, i) => (
                <div
                  key={c.label}
                  className={`notes-write grid grid-cols-[1fr_auto] items-end gap-x-3 ${i > 0 ? "mt-3 md:mt-5" : ""}`}
                  style={write(1 + i * 2)}
                >
                  {/* Phone: the label gets the full width, the working and the amount share the line under it */}
                  <p className="col-span-2 md:col-span-1 text-xl md:text-[1.75rem] font-semibold leading-tight">{c.label}</p>
                  <p className="col-start-1 text-meta md:text-[1.35rem] leading-tight opacity-70">
                    {formatPrice(c.perYear)} RSD × {YEARS} god.
                  </p>
                  <Amount
                    sign={i > 0 ? "+" : undefined}
                    value={c.perYear * YEARS}
                    className="text-2xl md:text-[2.25rem] md:col-start-2 md:row-start-1 md:row-span-2"
                  />
                </div>
              ))}

              {/* Red-pen remark */}
              <p
                className="notes-write text-xl md:text-[1.75rem] font-bold leading-none mt-2 -rotate-2 origin-left text-(--pen)"
                style={write(YEARLY_COSTS.length * 2)}
              >
                ↳ a dlake se uvek vrate!
              </p>

              {/* The line under the sum */}
              <svg className="block w-full h-3 mt-3 md:mt-4" viewBox="0 0 400 12" fill="none" preserveAspectRatio="none" aria-hidden>
                <path
                  className="notes-draw"
                  style={write(YEARLY_COSTS.length * 2 + 1)}
                  pathLength={1}
                  d="M2 7 Q70 3 150 6 T290 5 T398 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              {/* The lifetime total */}
              <div className="flex items-center justify-between gap-3 mt-3 md:mt-4">
                <p className="notes-write text-2xl md:text-[2rem] font-bold leading-none" style={write(YEARLY_COSTS.length * 2 + 2)}>
                  Ukupno =
                </p>
                <span className="relative inline-block px-1">
                  <span className="notes-write inline-block" style={write(YEARLY_COSTS.length * 2 + 2)}>
                    <Amount value={LIFETIME_TOTAL} className="text-[1.75rem] md:text-[2.75rem]" />
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
                      style={write(YEARLY_COSTS.length * 2 + 4)}
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
              <p className="notes-write text-lg md:text-2xl leading-tight mt-6 md:mt-9" style={write(YEARLY_COSTS.length * 2 + 6)}>
                + {HOURS_PER_YEAR} sati godišnje samo na brijanje ={" "}
                <span className="font-bold">{lifetimeDays} dana</span> života
              </p>
              <p className="notes-write text-lg md:text-2xl leading-tight mt-1 text-(--pen)" style={write(YEARLY_COSTS.length * 2 + 7)}>
                P.S. Laser ovo završava jednom zauvek.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
