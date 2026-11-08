"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertCircle, CalendarPlus, Loader2 } from "lucide-react";
import { PHONE_DISPLAY, PHONE_LINK } from "@/lib/email/layout";
import BookingSheet, { type BookingSheetProps } from "@/components/booking/BookingSheet";
import { formatPrice } from "@/components/booking/shared";

// Supabase + framer-motion stay out of the page until "Zakaži novi termin".
const BookingModal = dynamic(() => import("@/components/BookingModal"), { ssr: false });

export type CancelViewState = "open" | "cancelled" | "already" | "past" | "invalid" | "error";

export interface CancelAppointment {
  firstName: string;
  /** "u Novom Sadu" */
  city: string;
  /** The same sheet as the confirmation - without the cancelled marks, which follow the state. */
  sheet: Omit<BookingSheetProps, "cancelled">;
  /** 50% of this treatment, in RSD; null when the price is unknown. */
  lateFee: number | null;
}

const phone = (
  <a href={`tel:${PHONE_LINK}`} className="font-semibold underline underline-offset-2 whitespace-nowrap">{PHONE_DISPLAY}</a>
);

/** The amber box: what a cancellation under 24 h costs, and when it doesn't. */
function LateNotice({ done, fee }: { done: boolean; fee: number | null }) {
  const amount = (
    <strong className="text-amber-200">
      50% cene ovog tretmana{fee != null && <> ({formatPrice(fee)}&nbsp;RSD)</>}
    </strong>
  );
  return (
    <div className="bm-mail-in w-full max-w-md mt-8 flex items-start gap-3 p-4 rounded-2xl bg-amber-400/10 border-2 border-amber-400/40 text-left">
      <AlertCircle size={18} className="text-amber-300 shrink-0 mt-0.5" />
      <div className="text-xs sm:text-sm font-poppins text-amber-100/90 leading-relaxed">
        {done ? (
          <p>
            Termin je otkazan manje od 24 sata pre tretmana, pa se pri sledećem dolasku naplaćuje {amount}.
          </p>
        ) : (
          <p>
            Do termina je ostalo manje od 24 sata. Ako ga sada otkažete, pri sledećem dolasku naplaćuje se {amount}.
          </p>
        )}
        <p className="mt-2 text-amber-100/70">
          Ako je razlog zdravstveni (bolest, povreda) ili hitan slučaj, ne naplaćuje se ništa
          {done ? <> - samo nam javite na {phone}.</> : "."}{" "}
          <Link href="/uslovi-koriscenja" className="underline underline-offset-2">Uslovi otkazivanja</Link>
        </p>
      </div>
    </div>
  );
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h1 className="mt-10 sm:mt-14 font-playfair text-3xl sm:text-4xl text-center leading-tight">{title}</h1>
      {children && (
        <p className="mt-3 max-w-sm font-poppins text-sm sm:text-base text-foreground/60 text-center leading-relaxed">{children}</p>
      )}
    </>
  );
}

/**
 * The cancellation page: the appointment on paper and one button. After the
 * button, the date and time are struck through in red right there, with what
 * a late cancellation costs and a way to book a new term.
 */
export default function CancelView({
  initial, late: initialLate, appointment, link,
}: {
  initial: CancelViewState;
  late: boolean;
  appointment: CancelAppointment | null;
  link: { r: string; k: string } | null;
}) {
  const [view, setView] = useState<CancelViewState>(initial);
  const [late, setLate] = useState(initialLate);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingMounted, setBookingMounted] = useState(false);
  if (bookingOpen && !bookingMounted) setBookingMounted(true);

  async function cancel() {
    if (!link || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/reservation-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      });
      const data = (await res.json().catch(() => null)) as
        { ok?: boolean; status?: string; late?: boolean; error?: string } | null;
      if (data?.ok) {
        setLate(data.late === true);
        setView(data.status === "already" ? "already" : "cancelled");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data?.error === "past") {
        setView("past");
      } else if (data?.error === "invalid_link" || data?.error === "inactive") {
        setView("invalid");
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const done = view === "cancelled" || view === "already";
  const name = appointment?.firstName;

  return (
    <main className="min-h-dvh bg-background px-4 pt-8 pb-20 flex flex-col items-center">
      <Link href="/" className="font-poppins text-[11px] sm:text-xs tracking-[0.3em] text-accent font-semibold">
        INFINITY LASER STUDIO
      </Link>

      {view === "open" && <Header title="Otkazivanje termina">{name ? `${name}, d` : "D"}a li želite da otkažete ovaj termin{appointment ? ` ${appointment.city}` : ""}?</Header>}
      {view === "cancelled" && <Header title="Termin je otkazan">{name ? `${name}, h` : "H"}vala što ste nam javili. Potvrdu smo poslali na Vaš email.</Header>}
      {view === "already" && <Header title="Termin je već otkazan">Ovaj termin je otkazan i više Vas ne čeka.</Header>}
      {view === "past" && <Header title="Termin je prošao">Ovaj termin je već počeo ili prošao, pa ga ne možete otkazati preko linka. Pozovite nas na {phone}.</Header>}
      {view === "invalid" && <Header title="Link nije ispravan">Ne možemo da pronađemo ovaj termin. Za otkazivanje nas pozovite na {phone} ili odgovorite na email sa potvrdom.</Header>}
      {view === "error" && <Header title="Termin trenutno ne može da se učita">Pokušajte ponovo za minut ili nas pozovite na {phone}.</Header>}

      {appointment && (view === "open" || done) && (
        <div className="w-full max-w-md mt-10 sm:mt-12 bm-paper-in">
          <BookingSheet {...appointment.sheet} cancelled={done ? { late } : null} />
        </div>
      )}

      {view === "open" && late && <LateNotice done={false} fee={appointment?.lateFee ?? null} />}
      {done && late && <LateNotice done fee={appointment?.lateFee ?? null} />}

      {view === "open" && (
        <div className="w-full max-w-md mt-8 flex flex-col items-center">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-full bg-[#C8405B] hover:bg-[#B5354F] active:scale-[0.98] text-white font-poppins text-sm font-semibold tracking-widest transition-all cursor-pointer disabled:opacity-70 disabled:cursor-wait"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? "OTKAZUJEM…" : "OTKAŽI TERMIN"}
          </button>
          {failed && (
            <p role="alert" className="mt-3 text-xs sm:text-sm font-poppins text-red-300 text-center">
              Otkazivanje nije uspelo. Pokušajte ponovo ili nas pozovite na {phone}.
            </p>
          )}
          <p className="mt-4 text-xs sm:text-sm font-poppins text-foreground/50 text-center leading-relaxed">
            Ne želite da otkažete? Samo zatvorite ovu stranicu - termin ostaje zakazan.
            Za pomeranje nas pozovite na {phone}.
          </p>
        </div>
      )}

      {done && (
        <div className="bm-mail-in w-full max-w-md mt-8 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-full bg-accent hover:bg-accent-soft text-on-accent font-poppins text-sm font-semibold tracking-widest transition-colors cursor-pointer"
          >
            <CalendarPlus size={18} />
            ZAKAŽI NOVI TERMIN
          </button>
          <Link href="/" className="mt-4 text-xs sm:text-sm font-poppins text-foreground/50 hover:text-foreground/70 transition-colors">
            Nazad na sajt
          </Link>
        </div>
      )}

      {view === "error" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 min-h-12 px-8 rounded-full border-2 border-accent/40 text-accent font-poppins text-sm font-semibold tracking-widest cursor-pointer"
        >
          POKUŠAJ PONOVO
        </button>
      )}

      {(view === "past" || view === "invalid") && (
        <Link href="/" className="mt-8 min-h-12 px-8 inline-flex items-center rounded-full border-2 border-accent/40 text-accent font-poppins text-sm font-semibold tracking-widest">
          NA SAJT
        </Link>
      )}

      {bookingMounted && <BookingModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </main>
  );
}
