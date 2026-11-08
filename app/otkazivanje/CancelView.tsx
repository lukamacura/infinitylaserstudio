"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { AlertCircle, CalendarPlus, Loader2 } from "lucide-react";
import { PHONE_DISPLAY, PHONE_LINK } from "@/lib/email/layout";

// Same handwriting as the booking modal's last step (BookingSuccess).
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

// Supabase + framer-motion stay out of the page until "Zakaži novi termin".
const BookingModal = dynamic(() => import("@/components/BookingModal"), { ssr: false });

export type CancelViewState = "open" | "cancelled" | "already" | "past" | "invalid" | "error";

export interface CancelAppointment {
  firstName: string;
  /** "Ponedeljak, 9. novembar" */
  day: string;
  /** "10:00 – 11:10" */
  time: string;
  /** "Miloja Čiplića 51, Novi Sad" */
  studio: string;
  services: string[];
  ref: string;
}

/** Place in the writing order of the sheet (`--w` in globals.css). */
function write(i: number): CSSProperties {
  return { "--w": i } as CSSProperties;
}

const phone = (
  <a href={`tel:${PHONE_LINK}`} className="font-semibold underline underline-offset-2 whitespace-nowrap">{PHONE_DISPLAY}</a>
);

/** The amber box: what a cancellation under 24 h costs, and when it doesn't. */
function LateNotice({ done }: { done: boolean }) {
  return (
    <div className="bm-mail-in w-full max-w-md mt-8 flex items-start gap-3 p-4 rounded-2xl bg-amber-400/10 border-2 border-amber-400/40 text-left">
      <AlertCircle size={18} className="text-amber-300 shrink-0 mt-0.5" />
      <div className="text-xs sm:text-sm font-poppins text-amber-100/90 leading-relaxed">
        {done ? (
          <p>
            Termin je otkazan manje od 24 sata pre tretmana, pa se pri sledećem dolasku naplaćuje{" "}
            <strong className="text-amber-200">50% cene ovog tretmana</strong>.
          </p>
        ) : (
          <p>
            Do termina je ostalo manje od 24 sata. Ako ga sada otkažete, pri sledećem dolasku naplaćuje se{" "}
            <strong className="text-amber-200">50% cene ovog tretmana</strong>.
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

/** A red pen stroke through whatever it sits on, drawn once when it appears. */
function Strike({ delay }: { delay: number }) {
  return (
    <svg className="absolute -inset-x-1 top-1/2 -translate-y-1/2 w-[calc(100%+0.5rem)] h-3 overflow-visible pointer-events-none" viewBox="0 0 100 12" fill="none" preserveAspectRatio="none" aria-hidden>
      <path className="notes-strike" style={{ "--d": `${delay}s` } as CSSProperties} pathLength={1} d="M-2 8 Q50 3 102 5" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Sheet({ a, struck, late }: { a: CancelAppointment; struck: boolean; late: boolean }) {
  // Start writing one frame after mount so the transitions actually run.
  const [written, setWritten] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWritten(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows: [string, string][] = [["Datum", a.day], ["Vreme", a.time]];
  const wItems = 1 + rows.length + 1;
  const wStudio = wItems + a.services.length;

  return (
    <div className="w-full max-w-md bm-paper-in">
      <div className={`notes-paper ${caveat.className} text-left px-5 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8`}>
        <span className="notes-tape" aria-hidden />

        <div className="notes-body" data-rv-in={written ? "" : undefined}>
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
              <span className={`relative inline-block text-xl sm:text-2xl font-bold text-right leading-tight transition-opacity duration-700 ${struck ? "opacity-55" : ""}`}>
                {value}
                {struck && <Strike delay={0.15 + i * 0.25} />}
              </span>
            </div>
          ))}

          {a.services.length > 0 && (
            <>
              <p className="notes-write text-lg sm:text-xl opacity-70 mt-4 sm:mt-5" style={write(wItems - 1)}>Usluge:</p>
              {a.services.map((name, i) => (
                <p
                  key={name}
                  className={`notes-write text-xl sm:text-2xl font-semibold leading-tight transition-opacity duration-700 ${struck ? "opacity-55" : ""}`}
                  style={write(wItems + i)}
                >
                  • {name}
                </p>
              ))}
            </>
          )}

          <p className="notes-write text-lg sm:text-xl leading-tight mt-4 sm:mt-5 opacity-70" style={write(wStudio)}>
            {a.studio}
          </p>

          {struck && (
            <p className="notes-ink-in text-xl sm:text-2xl font-bold leading-none mt-4 -rotate-2 origin-left text-(--pen)">
              {late ? "↳ otkazano manje od 24 h pre termina" : "↳ otkazano · bez troškova"}
            </p>
          )}

          <p className="notes-write text-lg sm:text-xl leading-tight mt-6 sm:mt-7" style={write(wStudio + 1)}>
            Ref. broj: <span className="font-bold tracking-wider">#{a.ref}</span>
          </p>
        </div>
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

      {view === "open" && <Header title="Otkazivanje termina">{name ? `${name}, d` : "D"}a li želite da otkažete ovaj termin?</Header>}
      {view === "cancelled" && <Header title="Termin je otkazan">{name ? `${name}, h` : "H"}vala što ste nam javili. Potvrdu smo poslali na Vaš email.</Header>}
      {view === "already" && <Header title="Termin je već otkazan">Ovaj termin je otkazan i više Vas ne čeka.</Header>}
      {view === "past" && <Header title="Termin je prošao">Ovaj termin je već počeo ili prošao, pa ga ne možete otkazati preko linka. Pozovite nas na {phone}.</Header>}
      {view === "invalid" && <Header title="Link nije ispravan">Ne možemo da pronađemo ovaj termin. Za otkazivanje nas pozovite na {phone} ili odgovorite na email sa potvrdom.</Header>}
      {view === "error" && <Header title="Termin trenutno ne može da se učita">Pokušajte ponovo za minut ili nas pozovite na {phone}.</Header>}

      {appointment && (view === "open" || done) && (
        <div className="w-full flex flex-col items-center mt-10 sm:mt-12">
          <Sheet a={appointment} struck={done} late={late} />
        </div>
      )}

      {view === "open" && late && <LateNotice done={false} />}
      {done && late && <LateNotice done />}

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
