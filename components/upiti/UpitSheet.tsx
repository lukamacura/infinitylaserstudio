"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, NotebookPen, Phone, PhoneMissed, RotateCcw, X } from "lucide-react";
import KartonSheet from "@/components/karton/KartonSheet";
import { fmtCardNumber, fmtDayMonth } from "@/lib/kartoni";
import {
  belgradeDay, deleteUpit, fmtWhen, markNoAnswer, setUpitRemind, setUpitStatus, telHref, undoNoAnswer,
  type Upit, type UpitStatus,
} from "@/lib/upiti";
import { addDays, relativeDay } from "@/lib/infy/time";
import { SourceStamp, Tally } from "./Spisak";

/** Follow-up day choices: label, days from today. */
const REMIND_CHOICES: readonly [string, number][] = [["Sutra", 1], ["Za 3 dana", 3], ["Za nedelju", 7], ["Za 2 nedelje", 14]];

/**
 * One person from the list: call them, then say how it went. Every change is
 * saved straight away; `onChanged` reloads the list.
 */
export default function UpitSheet({
  upit,
  onClose,
  onChanged,
  onEdit,
}: {
  upit: Upit;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const open = upit.status === "open";
  const today = belgradeDay(new Date().toISOString());
  /** Crossed out because a booking with their number turned up, not by hand. */
  const autoBooked = upit.status === "booked" && upit.saved_status !== "booked";

  async function run(action: () => Promise<void>, close = true) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      if (close) onClose();
    } catch {
      setError("Nije sačuvano. Proverite internet i pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  const mark = (status: UpitStatus) => run(() => setUpitStatus(upit.id, status));

  return (
    <KartonSheet title={upit.name} onClose={onClose}>
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SourceStamp upit={upit} />
          <span className="karton-printed">upisano {fmtWhen(upit.created_at)}</span>
        </div>

        {upit.note && <p className="upit-sheet-note">{upit.note}</p>}

        {upit.karton_id && upit.karton_number !== null && (
          <Link href={`/kartoni/${upit.karton_id}`} className="upit-fact">
            <NotebookPen size={17} className="shrink-0" />
            <span className="min-w-0">
              Ima karton <b>Nº {fmtCardNumber(upit.karton_number)}</b>
              {upit.karton_name && upit.karton_name !== upit.name && <> · {upit.karton_name}</>}
            </span>
          </Link>
        )}

        {upit.booked_date && (
          <p className="upit-fact is-booked">
            <Check size={17} className="shrink-0" />
            <span>
              {upit.booked_after ? "Zakazan termin" : "Već ima termin"}{" "}
              <b>{fmtDayMonth(upit.booked_date)} u {upit.booked_time?.slice(0, 5)}</b>
            </span>
          </p>
        )}

        {open && upit.attempts > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="karton-printed inline-flex flex-wrap items-center gap-x-2">
              Ne javlja se <Tally count={upit.attempts} />
              {upit.last_call_at && <span>· {fmtWhen(upit.last_call_at)}</span>}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => undoNoAnswer(upit), false)}
              className="karton-btn karton-btn-text upit-btn-small shrink-0"
            >
              poništi
            </button>
          </div>
        )}

        {/* When Infy brings them up again (sql/infy.sql: due_on). */}
        {open && (
          <div className="space-y-1.5">
            <p className="karton-printed inline-flex items-center gap-1.5">
              <BellRing size={15} className="shrink-0" />
              Infy podseća: <b>{relativeDay(upit.due_on, today)}</b>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REMIND_CHOICES.map(([label, days]) => {
                const day = addDays(today, days);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={busy}
                    aria-pressed={upit.due_on === day}
                    onClick={() => void run(() => setUpitRemind(upit.id, day), false)}
                    className="karton-chip"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {open && upit.phone && (
          <a href={telHref(upit.phone)} className="karton-btn karton-btn-primary w-full">
            <Phone size={18} /> Pozovi {upit.phone}
          </a>
        )}

        {open && (
          <div className="space-y-2 pt-1">
            <p className="karton-label">Kako je prošlo?</p>
            <button type="button" disabled={busy} onClick={() => void mark("booked")} className="karton-btn upit-btn-booked w-full">
              <Check size={18} strokeWidth={2.5} /> Zakazan termin
            </button>
            <button type="button" disabled={busy} onClick={() => void run(() => markNoAnswer(upit))} className="karton-btn karton-btn-ghost w-full">
              <PhoneMissed size={18} /> Ne javlja se
            </button>
            <button type="button" disabled={busy} onClick={() => void mark("declined")} className="karton-btn karton-btn-ghost w-full !text-[var(--stamp)]">
              <X size={18} /> Ne želi
            </button>
          </div>
        )}

        {autoBooked && (
          <p className="karton-printed">
            Precrtano samo od sebe: sa ovim brojem telefona je zakazan termin.
          </p>
        )}

        {!open && !autoBooked && (
          <button type="button" disabled={busy} onClick={() => void mark("open")} className="karton-btn karton-btn-ghost w-full">
            <RotateCcw size={17} /> Vrati na spisak
          </button>
        )}

        {error && <p className="karton-warning" role="alert">{error}</p>}

        {confirmDelete ? (
          <div className="space-y-2 pt-1">
            <p className="karton-warning">Obrisati {upit.name} sa spiska? Ovo se ne može vratiti.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="karton-btn karton-btn-ghost">Ne</button>
              <button type="button" disabled={busy} onClick={() => void run(() => deleteUpit(upit.id))} className="karton-btn karton-btn-danger">
                Obriši
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onEdit} className="karton-btn karton-btn-text upit-btn-small !px-0 !text-[var(--pen)]">
              Izmeni podatke
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="karton-btn karton-btn-text upit-btn-small !px-0">
              Obriši
            </button>
          </div>
        )}
      </div>
    </KartonSheet>
  );
}
