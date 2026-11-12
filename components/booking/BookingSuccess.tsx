"use client";

import type { CSSProperties } from "react";
import { AlertCircle, MailCheck, MailX } from "lucide-react";
import { formatPrice } from "@/components/booking/shared";
import BookingSheet, { type SuccessDiscount } from "@/components/booking/BookingSheet";

export type { SuccessDiscount };

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
  accentHex: string;
}

/**
 * Booking confirmation: the booking written out by hand on the same squared
 * paper as the landing page's sum, line after line, with the total circled.
 */
export default function BookingSuccess(p: BookingSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center pt-2 pb-4 sm:pt-4 sm:pb-6">
      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair mb-3 sm:mb-4">{p.headline}</h3>

      {/* Email sent - a booking made in the studio may have no address */}
      <div
        className="bm-mail-in inline-flex items-center gap-2.5 rounded-full border px-4 py-2 mb-8 sm:mb-10 max-w-full"
        style={{ borderColor: `${p.accentHex}40`, backgroundColor: `${p.accentHex}12` }}
      >
        {p.email.trim() ? (
          <>
            <MailCheck size={18} className="shrink-0" style={{ color: p.accentHex }} />
            <p className="text-xs sm:text-sm font-poppins text-foreground/70 min-w-0 truncate">
              Potvrda je poslata na <span className="font-semibold text-foreground">{p.email}</span>
            </p>
          </>
        ) : (
          <>
            <MailX size={18} className="shrink-0" style={{ color: p.accentHex }} />
            <p className="text-xs sm:text-sm font-poppins text-foreground/70 min-w-0 truncate">Bez emaila - potvrda nije poslata</p>
          </>
        )}
      </div>

      {/* The booking, written out on paper */}
      <div className="w-full max-w-md bm-paper-in" style={{ "--accent": p.accentHex } as CSSProperties}>
        <BookingSheet
          date={p.date}
          timeRange={p.timeRange}
          duration={p.duration}
          withConsultation={p.withConsultation}
          services={p.services}
          listTotal={p.listTotal}
          finalPrice={p.finalPrice}
          discount={p.discount}
        />
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
