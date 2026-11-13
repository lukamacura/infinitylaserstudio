"use client";

import { useState } from "react";
import {
  ArrowLeftRight, BellRing, CalendarClock, CalendarPlus, CalendarX, Loader2, Mail, MailX, TriangleAlert, Undo2,
} from "lucide-react";
import BookingSheet from "@/components/booking/BookingSheet";
import { shortDay } from "@/lib/infy/time";
import type { InfyCard } from "@/lib/infy/types";

export type CardStatus = "pending" | "sending" | "done" | "error" | "replaced" | "dismissed" | "undone";

export type UiCard = InfyCard & {
  status: CardStatus;
  error?: string;
  email?: "sent" | "failed" | "skipped";
  /** Done, but on the other laser - the one asked for was taken meanwhile. */
  laserMissed?: boolean;
};

type ProposalUiCard = Extract<UiCard, { type: "proposal" }>;
type UpitUiCard = Extract<UiCard, { type: "upit" }>;

const KIND = {
  book:   { label: "Novi termin", Icon: CalendarPlus,  confirm: "Potvrdi zakazivanje", stamp: "Zakazano" },
  move:   { label: "Pomeranje",   Icon: CalendarClock, confirm: "Potvrdi pomeranje",   stamp: "Pomereno" },
  cancel: { label: "Otkazivanje", Icon: CalendarX,     confirm: "Potvrdi otkazivanje", stamp: "Otkazano" },
  laser:  { label: "Drugi laser", Icon: ArrowLeftRight, confirm: "Potvrdi prebacivanje", stamp: "Prebačeno" },
} as const;

const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", viber: "Viber", telefon: "Telefon", drugo: "Drugo",
};

/**
 * One of Infy's proposals, on the same paper the client gets. Nothing has
 * happened yet: "Potvrdi" carries it out (app/api/infy/confirm), and the sheet
 * gets its stamp - a cancellation also its red strokes.
 */
export function ProposalCard({
  card, now, onConfirm, onDismiss,
}: {
  card: ProposalUiCard;
  now: number;
  onConfirm: (notify: boolean) => void;
  onDismiss: () => void;
}) {
  const d = card.display;
  const kind = KIND[d.kind];
  const [notify, setNotify] = useState(d.emailDefault);
  const expired = (card.status === "pending" || card.status === "error") && card.expiresAt < now;
  const done = card.status === "done";
  const inactive = card.status === "replaced" || card.status === "dismissed" || expired;
  const actionable = (card.status === "pending" || card.status === "error") && !expired;

  return (
    <div className={`infy-rise mt-2 transition-opacity duration-300 ${inactive ? "opacity-45" : ""}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold font-poppins uppercase tracking-widest text-accent mb-3">
        <kind.Icon size={14} /> Predlog · {kind.label}
      </p>

      <div className="relative px-1">
        <BookingSheet
          title={d.title}
          studio={d.studio}
          movedFrom={d.movedFrom}
          date={d.date}
          timeRange={d.timeRange}
          duration={d.duration}
          withConsultation={d.withConsultation}
          services={d.services}
          listTotal={d.listTotal}
          finalPrice={d.finalPrice}
          discount={d.discount}
          cancelled={d.kind === "cancel" && done ? { late: false } : null}
        />
        {done && (
          <span className={`infy-stamp ${d.kind === "cancel" ? "is-red" : ""}`} aria-hidden>{kind.stamp}</span>
        )}
      </div>

      {(d.phone || d.email) && (
        <p className="mt-4 text-xs font-poppins text-foreground/60">
          {[d.phone, d.email].filter(Boolean).join(" · ")}
        </p>
      )}

      {d.warnings.length > 0 && !done && (
        <ul className="mt-2 space-y-1">
          {d.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs font-poppins text-amber-300">
              <TriangleAlert size={13} className="shrink-0 mt-px" /> {w}
            </li>
          ))}
        </ul>
      )}

      {actionable && (
        <>
          {d.kind === "laser" ? (
            // Same day and time - the client has nothing to be told.
            <p className="mt-3 text-sm font-poppins text-foreground/60">Vreme ostaje isto - klijent ne dobija mejl</p>
          ) : (
            <label className={`mt-3 flex items-center gap-2.5 text-sm font-poppins ${d.email ? "cursor-pointer" : "opacity-50"}`}>
              <input
                type="checkbox"
                checked={notify && !!d.email}
                disabled={!d.email}
                onChange={(e) => setNotify(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              {d.email ? `Pošalji mejl klijentu` : "Klijent nema email - bez mejla"}
            </label>
          )}
          {card.status === "error" && card.error && (
            <p className="mt-2 text-xs font-poppins text-red-300" role="alert">{card.error}</p>
          )}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => onConfirm(notify && !!d.email)}
              className={`h-11 rounded-xl text-sm font-bold font-poppins cursor-pointer transition-opacity hover:opacity-90 ${
                d.kind === "cancel" ? "bg-red-400 text-[#1a1112]" : "bg-accent text-on-accent"
              }`}
            >
              {kind.confirm}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="h-11 px-4 rounded-xl text-sm font-semibold font-poppins bg-foreground/6 hover:bg-foreground/10 cursor-pointer"
            >
              Odustani
            </button>
          </div>
        </>
      )}

      {card.status === "sending" && (
        <p className="mt-3 flex items-center gap-2 text-sm font-poppins text-foreground/70">
          <Loader2 size={16} className="animate-spin" /> Upisujem…
        </p>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold font-poppins text-emerald-300">
          {card.email === "sent" ? <Mail size={15} /> : <MailX size={15} />}
          {card.email === "sent" ? "Gotovo · klijent je dobio mejl"
            : card.email === "failed" ? "Gotovo · mejl NIJE otišao, javi se klijentu"
            : "Gotovo · bez mejla"}
        </p>
      )}
      {done && card.laserMissed && (
        <p className="mt-1 flex items-start gap-1.5 text-xs font-poppins text-amber-300">
          <TriangleAlert size={13} className="shrink-0 mt-px" /> Traženi laser je u međuvremenu zauzet - termin je na drugom laseru.
        </p>
      )}
      {card.status === "replaced" && <p className="mt-2 text-xs font-poppins text-foreground/55">Zamenjeno novim predlogom.</p>}
      {card.status === "dismissed" && <p className="mt-2 text-xs font-poppins text-foreground/55">Odustato - ništa nije promenjeno.</p>}
      {expired && <p className="mt-2 text-xs font-poppins text-foreground/55">Predlog je istekao (30 min) - traži novi.</p>}
    </div>
  );
}

/** Someone written on the call list (or changed there), with one-tap undo. */
export function UpitCard({ card, onUndo }: { card: UpitUiCard; onUndo: () => void }) {
  const undone = card.status === "undone";
  return (
    <div className={`infy-rise mt-2 flex items-start gap-2.5 rounded-xl border border-foreground/10 bg-foreground/4 px-3 py-2.5 ${undone ? "opacity-50" : ""}`}>
      <BellRing size={15} className="shrink-0 mt-0.5 text-accent" />
      <div className="min-w-0 flex-1 text-xs font-poppins leading-snug">
        <p className={undone ? "line-through" : ""}>
          {card.created ? "Na spisku upita" : "Ažurirano"}: <b>{card.name}</b> · {SOURCE_LABEL[card.source] ?? card.source}
        </p>
        {!undone && <p className="text-foreground/60 mt-0.5">Infy podseća {shortDay(card.dueOn)}{card.note ? ` · ${card.note}` : ""}</p>}
        {undone && <p className="text-foreground/60 mt-0.5">Poništeno - obrisano sa spiska.</p>}
      </div>
      {card.created && !undone && (
        <button
          type="button"
          onClick={onUndo}
          disabled={card.status === "sending"}
          className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold bg-foreground/6 hover:bg-foreground/10 cursor-pointer disabled:opacity-50"
        >
          <Undo2 size={12} /> Poništi
        </button>
      )}
    </div>
  );
}
