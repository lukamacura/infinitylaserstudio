"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Caveat } from "next/font/google";
import { AlertCircle, MailCheck } from "lucide-react";
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
  | null;

export interface BookingSuccessProps {
  /** "Termin zakazan! Čekamo Vas u …" */
  headline: string;
  email: string;
  /** "Utorak, 7. oktobar" */
  date: string;
  /** "10:00 – 11:10" */
  timeRange: string;
  duration: number;
  /** Consultation is listed first for new clients. */
  withConsultation: boolean;
  services: string[];
  listTotal: number;
  finalPrice: number;
  discount: SuccessDiscount;
  bookingRef: string | null;
  accentHex: string;
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
  return "↳ student −20% · uz indeks";
}

/**
 * Booking confirmation: the booking written out by hand on the same squared
 * paper as the landing page's sum, line after line, with the total circled.
 */
export default function BookingSuccess(p: BookingSuccessProps) {
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
  // Writing order: title, rows, "Usluge", items, line, (list price, strike, note), total, circle, ref.
  const wItems = 1 + rows.length + 1;
  const wLine = wItems + items.length;
  const wList = wLine + 1;
  const wTotal = p.discount ? wList + 3 : wLine + 1;

  return (
    <div className="flex flex-col items-center text-center pt-2 pb-4 sm:pt-4 sm:pb-6">
      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair mb-3 sm:mb-4">{p.headline}</h3>

      {/* Email sent */}
      <div
        className="bm-mail-in inline-flex items-center gap-2.5 rounded-full border px-4 py-2 mb-8 sm:mb-10 max-w-full"
        style={{ borderColor: `${p.accentHex}40`, backgroundColor: `${p.accentHex}12` }}
      >
        <MailCheck size={18} className="shrink-0" style={{ color: p.accentHex }} />
        <p className="text-xs sm:text-sm font-poppins text-foreground/70 min-w-0 truncate">
          Potvrda je poslata na <span className="font-semibold text-foreground">{p.email}</span>
        </p>
      </div>

      {/* The booking, written out on paper */}
      <div className="w-full max-w-md bm-paper-in" style={{ "--accent": p.accentHex } as CSSProperties}>
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
                <span className="text-xl sm:text-2xl font-bold text-right leading-tight">{value}</span>
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

            {p.bookingRef && (
              <p className="notes-write text-lg sm:text-xl leading-tight mt-6 sm:mt-7" style={write(wTotal + 3)}>
                Ref. broj: <span className="font-bold tracking-wider">#{p.bookingRef}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {p.discount?.kind === "student" && (
        <div className="w-full max-w-md mt-6 flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl bg-amber-400/10 border-2 border-amber-400/50 text-left">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-px" />
          <p className="text-[11px] sm:text-xs font-poppins text-amber-200 font-semibold leading-snug">
            Ne zaboravi indeks! Bez njega studentski popust ne važi i naplaćuje se puna cena od {formatPrice(p.listTotal)} RSD.
          </p>
        </div>
      )}

      {/* Bundle - remaining pre-paid sessions; the code is handed over in person at the first treatment */}
      {p.discount?.kind === "bundle" && (
        <div className="w-full max-w-md mt-6 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-left border-2" style={{ borderColor: `${p.accentHex}33`, backgroundColor: `${p.accentHex}0A` }}>
          <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1 sm:mb-2">PAKET OD {p.discount.size} TRETMANA</p>
          <p className="text-xs sm:text-sm md:text-base font-poppins text-foreground/55 leading-snug">
            Na prvom tretmanu dobićete kod paketa kojim ćete zakazati preostalih {p.discount.size - 1} {p.discount.size - 1 === 1 ? "tretman" : "tretmana"} - ti termini su već plaćeni.
          </p>
        </div>
      )}
    </div>
  );
}
