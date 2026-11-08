"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Caveat } from "next/font/google";
import { formatPrice } from "@/components/booking/shared";

// Same handwriting as the landing page's "Računica" sheet (CostComparison).
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

export type SuccessDiscount =
  | { kind: "bundle"; size: number; pct: number }
  | { kind: "redeem" }
  | { kind: "student" }
  | { kind: "link" }
  | { kind: "gift" }
  | { kind: "promo" }
  | null;

export interface BookingSheetProps {
  /** "Utorak, 7. oktobar" */
  date: string;
  /** "10:00 – 11:10" */
  timeRange: string;
  duration: number;
  /** Consultation is listed first for new clients. */
  withConsultation: boolean;
  services: string[];
  listTotal: number;
  /** null: the price could not be worked out - the sum is left out. */
  finalPrice: number | null;
  discount: SuccessDiscount;
  /**
   * The client cancelled (/otkazivanje): day and time get struck through in
   * red and a note is written under the sum - drawn when this turns on.
   */
  cancelled?: { late: boolean } | null;
}

/** Place in the writing order of the notes page (`--w` in globals.css). */
function write(i: number): CSSProperties {
  return { "--w": i } as CSSProperties;
}

function Amount({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap font-bold leading-none ${className}`}>
      {formatPrice(value)}
      <span className="ml-1.5 text-[0.6em] font-semibold">RSD</span>
    </span>
  );
}

function discountNote(d: NonNullable<SuccessDiscount>): string {
  if (d.kind === "bundle") return `↳ paket ${d.size}× · −${d.pct}%`;
  if (d.kind === "redeem") return "↳ plaćeno u paketu";
  if (d.kind === "link") return "↳ popust −20%";
  if (d.kind === "gift") return "↳ nausnice gratis";
  if (d.kind === "promo") return "↳ promo −10%";
  return "↳ student −20% · uz indeks";
}

/** A red pen stroke through whatever it sits on, drawn once when it appears. */
function Strike({ delay }: { delay: number }) {
  return (
    <svg className="absolute -inset-x-1 top-1/2 -translate-y-1/2 w-[calc(100%+0.5rem)] h-3 overflow-visible pointer-events-none" viewBox="0 0 100 12" fill="none" preserveAspectRatio="none" aria-hidden>
      <path className="notes-strike" style={{ "--d": `${delay}s` } as CSSProperties} pathLength={1} d="M-2 8 Q50 3 102 5" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The booking written out by hand on squared paper, line after line, with the
 * total circled - the booking modal's last step, the cancellation page, and
 * (in email form) lib/email/bookingEmail.ts.
 */
export default function BookingSheet(p: BookingSheetProps) {
  // Start writing one frame after mount so the transitions actually run.
  const [written, setWritten] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWritten(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows: [string, string][] = [
    ["Datum", p.date],
    ["Vreme", p.timeRange],
    ["Trajanje", `${p.duration} min`],
  ];
  const items = [
    ...(p.withConsultation ? [{ name: "Konsultacija (10 min)", muted: true }] : []),
    ...p.services.map((name) => ({ name, muted: false })),
  ];
  // Writing order: title, rows, "Usluge", items, line, (list price, strike, note), total, circle.
  const wItems = 1 + rows.length + 1;
  const wLine = wItems + items.length;
  const wList = wLine + 1;
  const wTotal = p.discount ? wList + 3 : wLine + 1;
  const cancelled = p.cancelled;
  // Cancelled before the page opened: the red marks wait until the sheet is
  // written out. Cancelled just now (the sheet is on screen): they come at once.
  const [cancelledAtMount] = useState(!!p.cancelled);
  const lastStep = p.finalPrice !== null ? wTotal + 1 : wLine - 1;
  const marksAt = cancelledAtMount ? 0.25 + lastStep * 0.3 + 0.6 : 0;

  return (
    <div className={`notes-paper ${caveat.className} text-left px-5 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8`}>
      <span className="notes-tape" aria-hidden />

      <div className="notes-body" data-rv-in={written ? "" : undefined}>
        {/* Title */}
        <p className="notes-write relative inline-block text-[1.75rem] sm:text-[2rem] font-bold leading-none mb-5 sm:mb-6">
          Tvoj termin
          <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
            <path d="M2 5 Q40 1 90 4 T198 3" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </p>

        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`notes-write flex items-baseline justify-between gap-3 ${i > 0 ? "mt-1.5 sm:mt-2" : ""}`}
            style={write(1 + i)}
          >
            <span className="text-lg sm:text-xl opacity-70">{label}</span>
            <span className={`relative inline-block text-xl sm:text-2xl font-bold text-right leading-tight transition-opacity duration-700 ${cancelled && i < 2 ? "opacity-60" : ""}`}>
              {value}
              {cancelled && i < 2 && <Strike delay={marksAt + 0.15 + i * 0.25} />}
            </span>
          </div>
        ))}

        <p className="notes-write text-lg sm:text-xl opacity-70 mt-4 sm:mt-5" style={write(wItems - 1)}>Usluge:</p>
        {items.map((s, i) => (
          <p
            key={s.name}
            className={`notes-write text-xl sm:text-2xl font-semibold leading-tight ${s.muted ? "opacity-55" : ""}`}
            style={write(wItems + i)}
          >
            • {s.name}
          </p>
        ))}

        {p.finalPrice !== null && (
          <>
            {/* The line under the sum */}
            <svg className="block w-full h-3 mt-4" viewBox="0 0 400 12" fill="none" preserveAspectRatio="none" aria-hidden>
              <path
                className="notes-draw"
                style={write(wLine)}
                pathLength={1}
                d="M2 7 Q70 3 150 6 T290 5 T398 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Regular price, struck through in red, with the reason */}
            {p.discount && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="notes-write text-lg sm:text-xl opacity-70" style={write(wList)}>Redovna cena</span>
                <span className="relative inline-block">
                  <span className="notes-write inline-block opacity-70" style={write(wList)}>
                    <Amount value={p.listTotal} className="text-xl sm:text-2xl" />
                  </span>
                  <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-3 overflow-visible" viewBox="0 0 100 12" fill="none" preserveAspectRatio="none" aria-hidden>
                    <path className="notes-draw" style={write(wList + 1)} pathLength={1} d="M-4 8 Q50 3 104 5" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
            )}
            {p.discount && (
              <p className="notes-write text-xl sm:text-2xl font-bold leading-none mt-1 -rotate-2 origin-left text-(--pen)" style={write(wList + 2)}>
                {discountNote(p.discount)}
              </p>
            )}

            {/* The total, circled in red */}
            <div className="flex items-center justify-between gap-3 mt-5 sm:mt-6">
              <p className="notes-write text-2xl sm:text-[2rem] font-bold leading-none" style={write(wTotal)}>Ukupno =</p>
              <span className="relative inline-block px-1">
                <span className="notes-write inline-block" style={write(wTotal)}>
                  <Amount value={p.finalPrice} className="text-[1.75rem] sm:text-[2.5rem]" />
                </span>
                <svg
                  className="absolute -inset-x-3 -inset-y-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] overflow-visible"
                  viewBox="0 0 200 64"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    className="notes-draw"
                    style={write(wTotal + 1)}
                    pathLength={1}
                    d="M26 12 C70 1 150 1 182 14 C204 25 198 50 150 58 C95 66 22 60 8 40 C-4 20 40 4 120 7"
                    stroke="var(--pen)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
          </>
        )}

        {cancelled && (
          <p
            className="notes-ink-in text-xl sm:text-2xl font-bold leading-tight mt-6 sm:mt-7 -rotate-2 origin-left text-(--pen)"
            style={{ animationDelay: `${marksAt + 0.7}s` }}
          >
            {cancelled.late ? "↳ otkazano manje od 24 h pre termina" : "↳ otkazano na vreme · bez troškova"}
          </p>
        )}
      </div>
    </div>
  );
}
