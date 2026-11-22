"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { OCCASION_LABEL, formatNumber, type Delivery, type GiftMode, type GiftQuote, type GiftVersion, type Occasion, type Payment } from "@/lib/paketici";

/** Place in the writing order (`--w`, see `.notes-*` in globals.css). */
function write(i: number): CSSProperties {
  return { "--w": i } as CSSProperties;
}

function Amount({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap font-bold leading-none ${className}`}>
      {formatNumber(value)}
      <span className="ml-1.5 text-[0.6em] font-semibold">RSD</span>
    </span>
  );
}

export interface GiftSheetProps {
  version: GiftVersion;
  mode: GiftMode;
  quote: Extract<GiftQuote, { ok: true }>;
  delivery: Delivery;
  address: string;
  city: string;
  name: string;
  phone: string;
  dedication: string;
  occasion: Occasion;
  payment: Payment;
}

/**
 * The order written out by hand on squared paper, line after line, with the
 * total circled in red - the same sheet the booking modal shows for a booked
 * term (components/booking/BookingSheet.tsx), with the gift's own lines. It
 * writes a little faster (`.pk-notes-fast`): here it is read before the
 * order is sent, not after.
 */
export default function GiftSheet(p: GiftSheetProps) {
  // Start writing one frame after mount so the transitions actually run.
  const [written, setWritten] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWritten(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const { quote } = p;
  const first = p.name.trim().split(/\s+/)[0] ?? "";
  const where = p.delivery === "studio"
    ? "preuzimaš u studiju"
    : p.delivery === "posta"
      ? `poštom, ${p.city.trim()}`
      : p.address.trim();
  const rows = [
    { label: "Za", value: p.version === "zenska" ? "nju" : "njega" },
    { label: "Stiže", value: where },
    { label: "Kontakt", value: first ? `${first}, ${p.phone.trim()}` : p.phone.trim() },
    { label: "Stiker", value: OCCASION_LABEL[p.occasion] },
    { label: "Plaćanje", value: p.payment === "kartica" ? "karticom" : p.delivery === "studio" ? "u studiju" : "pouzećem" },
  ];

  const voucher = p.mode === "iznos"
    ? `Iznos ${formatNumber(quote.total)} RSD`
    : p.mode === "paket"
      ? `Paket ${quote.sessions}: ${quote.regions.join(" + ")}`
      : `${quote.regions.join(" + ")} × ${quote.sessions}`;
  const items = [
    { text: voucher, muted: false },
    ...(p.mode === "iznos" ? [{ text: `${p.version === "zenska" ? "ona" : "on"} bira tretmane`, muted: true }] : []),
    {
      text: p.version === "zenska" ? "kutija: meda, Ferrero, Raffaello, kolačić sreće, brijač" : "kutija sa plavom mašnom",
      muted: true,
    },
  ];
  const dedication = p.dedication.trim();

  // Writing order: title, rows, "U voucheru", items, bonus, (posveta label, text), line, total, circle.
  const wItems = 1 + rows.length + 1;
  const wBonus = wItems + items.length;
  const wDedication = wBonus + (quote.bonus ? 1 : 0);
  const wLine = wDedication + (dedication ? 2 : 0);
  const wTotal = wLine + 1;

  return (
    <div className="notes-paper pk-hand pk-notes-fast px-5 pt-8 pb-6 text-left sm:px-8 sm:pt-10 sm:pb-8">
      <span className="notes-tape" aria-hidden />

      <div className="notes-body" data-rv-in={written ? "" : undefined}>
        {/* Title */}
        <p className="notes-write relative mb-5 inline-block text-[1.75rem] font-bold leading-none sm:text-[2rem]">
          Tvoj paketić
          <svg className="absolute -bottom-2 left-0 h-2 w-full" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
            <path d="M2 5 Q40 1 90 4 T198 3" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </p>

        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`notes-write flex items-baseline justify-between gap-3 ${i > 0 ? "mt-1" : ""}`}
            style={write(1 + i)}
          >
            <span className="shrink-0 text-lg opacity-70 sm:text-xl">{row.label}</span>
            <span className="min-w-0 break-words text-right text-xl font-bold leading-tight sm:text-2xl">{row.value}</span>
          </div>
        ))}

        <p className="notes-write mt-4 text-lg opacity-70 sm:text-xl" style={write(wItems - 1)}>U voucheru:</p>
        {items.map((s, i) => (
          <p
            key={s.text}
            className={`notes-write leading-tight ${s.muted ? "text-lg opacity-55 sm:text-xl" : "text-xl font-semibold sm:text-2xl"}`}
            style={write(wItems + i)}
          >
            • {s.text}
          </p>
        ))}

        {/* The free treatment, added in red pen */}
        {quote.bonus && (
          <p className="notes-write mt-1 origin-left -rotate-2 text-xl font-bold leading-none text-(--pen) sm:text-2xl" style={write(wBonus)}>
            ↳ + {quote.bonus.label.toLowerCase()} gratis
          </p>
        )}

        {dedication && (
          <>
            <p className="notes-write mt-4 text-lg opacity-70 sm:text-xl" style={write(wDedication)}>Posveta:</p>
            <p className="notes-write line-clamp-3 whitespace-pre-line break-words text-xl leading-tight sm:text-2xl" style={write(wDedication + 1)}>
              „{dedication}“
            </p>
          </>
        )}

        {/* The line under the sum */}
        <svg className="mt-4 block h-3 w-full" viewBox="0 0 400 12" fill="none" preserveAspectRatio="none" aria-hidden>
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

        {/* The total, circled in red */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="notes-write text-2xl font-bold leading-none sm:text-[2rem]" style={write(wTotal)}>Ukupno =</p>
          <span className="relative inline-block px-1">
            <span className="notes-write inline-block" style={write(wTotal)}>
              <Amount value={quote.total} className="text-[1.75rem] sm:text-[2.5rem]" />
            </span>
            <svg
              className="absolute -inset-x-3 -inset-y-3 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)] overflow-visible"
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
      </div>
    </div>
  );
}
