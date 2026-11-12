"use client";

import Link from "next/link";
import { Phone, Plus } from "lucide-react";
import { fmtCardNumber, fmtDayMonth } from "@/lib/kartoni";
import {
  belgradeDay, fmtWhen, sourceLabel, telHref, waitingDays, type Upit,
} from "@/lib/upiti";

/** Missed calls as tally marks: |||| with a slash through for every five. */
export function Tally({ count }: { count: number }) {
  const groups: number[] = [];
  for (let left = Math.min(count, 25); left > 0; left -= 5) groups.push(Math.min(left, 5));
  return (
    <span className="tally" role="img" aria-label={`ne javlja se: ${count}`}>
      {groups.map((n, g) => (
        <span key={g} className="tally-group">
          {Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} />)}
          {n === 5 && <i className="tally-slash" />}
        </span>
      ))}
    </span>
  );
}

export function SourceStamp({ upit }: { upit: Upit }) {
  return <span className="upit-src" data-src={upit.source}>{sourceLabel(upit.source)}</span>;
}

/** The day in the margin: "danas", "juče" or "7.11.". */
function Day({ upit, today }: { upit: Upit; today: string }) {
  const day = belgradeDay(upit.created_at);
  const waited = waitingDays(upit.created_at);
  const late = upit.status === "open" && waited >= 2;
  const label = day === today ? "danas" : waited === 1 ? "juče" : fmtDayMonth(day);
  return (
    <div className={`upit-day${late ? " is-late" : ""}`}>{label}</div>
  );
}

function Entry({ upit, today, onOpen }: { upit: Upit; today: string; onOpen: (u: Upit) => void }) {
  const done = upit.status !== "open";
  const booking = upit.booked_date;

  return (
    <li className={`upit${done ? " is-done" : ""}`}>
      <button type="button" className="upit-open" onClick={() => onOpen(upit)} aria-label={`Otvori: ${upit.name}`} />
      <Day upit={upit} today={today} />

      <div className="upit-body">
        <div className="upit-name">{upit.name}</div>
        <div className="upit-line">
          {upit.phone ? (
            <a className="upit-phone" href={telHref(upit.phone)}>{upit.phone}</a>
          ) : (
            <span className="upit-nophone">bez telefona</span>
          )}
          <SourceStamp upit={upit} />
          {upit.note && <span className="upit-note">{upit.note}</span>}
        </div>
        <div className="upit-meta">
          {!done && upit.attempts > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Tally count={upit.attempts} />
              {upit.last_call_at && <span>{fmtWhen(upit.last_call_at)}</span>}
            </span>
          )}
          {!done && booking && !upit.booked_after && <span>ima termin {fmtDayMonth(booking)}</span>}
          {upit.karton_id && upit.karton_number !== null && (
            <Link className="upit-karton" href={`/kartoni/${upit.karton_id}`}>Karton Nº {fmtCardNumber(upit.karton_number)}</Link>
          )}
        </div>
      </div>

      <div className="upit-side">
        {done ? (
          <span className={`upit-result ${upit.status === "booked" ? "is-booked" : "is-declined"}`}>
            {upit.status === "booked" ? "Zakazano" : "Ne želi"}
            {upit.status === "booked" && booking && <small>{fmtDayMonth(booking)} {upit.booked_time?.slice(0, 5)}</small>}
          </span>
        ) : upit.phone ? (
          <a className="upit-call" href={telHref(upit.phone)} aria-label={`Pozovi ${upit.name}`}>
            <Phone size={19} strokeWidth={2.2} />
          </a>
        ) : null}
      </div>
    </li>
  );
}

/** The sheet of paper: who is left to call, then the crossed-out ones. */
export default function Spisak({
  open,
  done,
  doneTotal,
  loadingMore,
  onOpen,
  onAdd,
  onMore,
}: {
  open: Upit[];
  done: Upit[];
  doneTotal: number;
  loadingMore: boolean;
  onOpen: (u: Upit) => void;
  onAdd: () => void;
  onMore: () => void;
}) {
  const today = belgradeDay(new Date().toISOString());
  const [y, m, d] = today.split("-");

  return (
    <article className="spisak">
      <span className="spisak-tape" aria-hidden="true" />

      <header className="spisak-head">
        <div className="min-w-0">
          <p className="karton-eyebrow">Infinity Laser Studio</p>
          <h2 className="spisak-title">Pozvati:</h2>
        </div>
        <span className="spisak-date">{Number(d)}.{Number(m)}.{y}.</span>
      </header>

      {open.length === 0 && (
        <p className="spisak-empty">Svi su pozvani. Novi upit upišite ispod.</p>
      )}

      <ul>
        {open.map((u) => <Entry key={u.id} upit={u} today={today} onOpen={onOpen} />)}
      </ul>

      <button type="button" className="spisak-add" onClick={onAdd}>
        <Plus size={17} strokeWidth={2.5} /> Upiši novi upit
      </button>

      {done.length > 0 && (
        <>
          <div className="spisak-section">
            <span className="karton-eyebrow">Precrtano</span>
          </div>
          <ul>
            {done.map((u) => <Entry key={u.id} upit={u} today={today} onOpen={onOpen} />)}
          </ul>
          {done.length < doneTotal && (
            <button type="button" className="spisak-more" onClick={onMore} disabled={loadingMore}>
              {loadingMore ? "Učitavam…" : "Starije"}
            </button>
          )}
        </>
      )}

      <div className="spisak-foot" aria-hidden="true" />
    </article>
  );
}
