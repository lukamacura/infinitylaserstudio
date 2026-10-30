"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { LocationId } from "@/lib/locations";
import {
  fmtCardNumber, fmtDate, fmtDayMonth, fmtEnergy, frequencyFor, parseEnergy, regionsFor, sortRegions, sortRows,
  todayStr, MAX_ENERGY_J,
  type ClientDraft, type Karton, type KartonActions, type KartonClient, type KartonEntry, type KartonRow, type RegionCatalog,
} from "@/lib/kartoni";
import KartonClientSheet from "./KartonClientSheet";
import KartonRowSheet from "./KartonRowSheet";

/** One region on one date: type the energy, the frequency follows. Saves on leaving the cell. */
function EnergyCell({
  label,
  entry,
  onSave,
}: {
  label: string;
  entry: KartonEntry | undefined;
  onSave: (energy: number | null) => Promise<void>;
}) {
  const saved = entry?.energy_j ?? null;
  const [text, setText] = useState(saved === null ? "" : fmtEnergy(saved));
  const [failed, setFailed] = useState(false);

  const parsed = parseEnergy(text);
  const invalid = parsed === "invalid";

  async function commit() {
    if (invalid || parsed === saved) return;
    setFailed(false);
    try {
      await onSave(parsed);
    } catch {
      setFailed(true);
    }
  }

  const planned = !!entry?.planned && parsed === null;
  return (
    <td className="karton-cell">
      <div className={`karton-cell-box${planned ? " is-planned" : ""}${invalid || failed ? " is-error" : ""}`}>
        <div className="karton-energy-line">
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            aria-label={`Energija u džulima, ${label}`}
            aria-invalid={invalid}
            placeholder="—"
            value={text}
            onChange={(e) => { setText(e.target.value); setFailed(false); }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="karton-energy"
          />
          <span className="karton-unit">J</span>
        </div>
        {invalid ? (
          <span className="karton-hz karton-cell-error">do {MAX_ENERGY_J} J</span>
        ) : failed ? (
          <span className="karton-hz karton-cell-error" title="Nije sačuvano. Dodirnite polje i pokušajte ponovo.">greška</span>
        ) : (
          <span className="karton-hz">{typeof parsed === "number" && <><b>{frequencyFor(parsed)}</b> Hz</>}</span>
        )}
      </div>
    </td>
  );
}

/** Autosaving note: while typing, on leaving the field, and on leaving the page. */
function NoteField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const lastSaved = useRef(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  useEffect(() => { saveRef.current = onSave; });

  const flush = useRef(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const value = latest.current;
    if (value === lastSaved.current) return;
    setState("saving");
    try {
      await saveRef.current(value);
      lastSaved.current = value;
      setState((s) => (s === "saving" ? "saved" : s));
    } catch {
      setState("failed");
    }
  });

  useEffect(() => {
    const save = flush.current;
    const onHide = () => { if (document.visibilityState === "hidden") void save(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void save();
    };
  }, []);

  function change(value: string) {
    setNote(value);
    latest.current = value;
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush.current(), 800);
  }

  return (
    <section className="px-4 sm:px-6 pt-5 pb-2">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <label htmlFor="karton-note" className="karton-eyebrow">Napomena</label>
        <span className="karton-printed" aria-live="polite">
          {state === "saving" && "čuvam…"}
          {state === "saved" && "sačuvano"}
          {state === "failed" && <b>nije sačuvano, proverite internet</b>}
        </span>
      </div>
      <textarea
        id="karton-note"
        rows={5}
        maxLength={5000}
        value={note}
        placeholder="Reakcije kože, lekovi, dogovori…"
        onChange={(e) => change(e.target.value)}
        onBlur={() => void flush.current()}
        className="karton-note"
      />
    </section>
  );
}

function clientDraft(client: KartonClient): ClientDraft {
  return {
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    gender: client.gender,
  };
}

/**
 * The card itself: the client on top, dates down and regions across, the note
 * at the bottom. Holds no database code - everything goes through `actions`.
 */
export default function KartonPaper({
  karton,
  catalog,
  location,
  actions,
  update,
}: {
  karton: Karton;
  catalog: RegionCatalog;
  /** The studio a new row is for, until someone picks the other one. */
  location: LocationId;
  actions: KartonActions;
  /** Always from the latest state: saves of two cells can finish in any order. */
  update: (change: (current: Karton) => Karton) => void;
}) {
  const [rowSheet, setRowSheet] = useState<{ row: KartonRow | null } | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const today = todayStr();

  const { client, rows } = karton;
  const offered = useMemo(() => regionsFor(catalog, client.gender), [catalog, client.gender]);
  const columns = useMemo(
    () => sortRegions(rows.flatMap((r) => r.entries.map((e) => e.region)), offered),
    [rows, offered],
  );

  /** Column "+" works on today's row, or else the newest one, or starts the first. */
  const rowForNewColumn = rows.find((r) => r.date === today) ?? rows[rows.length - 1] ?? null;
  const lastRegions = rows[rows.length - 1]?.entries.map((e) => e.region) ?? [];

  async function saveCell(row: KartonRow, region: string, energy: number | null) {
    const planned = row.entries.find((e) => e.region === region)?.planned ?? false;
    const saved = await actions.saveEnergy(row.id, region, energy, planned);
    update((k) => ({
      ...k,
      rows: k.rows.map((r) => {
        if (r.id !== row.id) return r;
        const others = r.entries.filter((e) => e.region !== region);
        return { ...r, entries: saved ? [...others, saved] : others };
      }),
    }));
  }

  async function saveRow(date: string, rowLocation: LocationId, regions: string[]) {
    const editing = rowSheet?.row ?? null;
    if (editing) {
      const saved = await actions.updateRow(editing, date, rowLocation, regions);
      update((k) => ({ ...k, rows: sortRows(k.rows.map((r) => (r.id === saved.id ? saved : r))) }));
    } else {
      const added = await actions.addRow(karton.id, date, rowLocation, regions);
      update((k) => ({ ...k, rows: sortRows([...k.rows, added]) }));
    }
    setRowSheet(null);
  }

  async function deleteRow() {
    const editing = rowSheet?.row;
    if (!editing) return;
    await actions.deleteRow(editing.id);
    update((k) => ({ ...k, rows: k.rows.filter((r) => r.id !== editing.id) }));
    setRowSheet(null);
  }

  return (
    <article className="karton-paper">
      <span className="karton-hole" aria-hidden="true" />

      {/* Client */}
      <header className="px-4 sm:px-6 pt-10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="karton-eyebrow">Infinity Laser Studio</p>
            <p className="karton-printed">Karton klijenta</p>
          </div>
          <span className="karton-stamp shrink-0">Nº {fmtCardNumber(karton.number)}</span>
        </div>
        <hr className="karton-rule-double mt-2.5 mb-3" />

        <div className="flex items-start justify-between gap-2">
          <h1 className="karton-name min-w-0">{client.name}</h1>
          <button
            type="button"
            onClick={() => setEditingClient(true)}
            aria-label="Izmeni podatke klijenta"
            className="karton-printed w-11 h-11 -mt-1 -mr-1.5 flex items-center justify-center rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
          >
            <Pencil size={18} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 sm:gap-x-6 mt-1">
          <div className="karton-field">
            <span className="karton-field-label">Telefon</span>
            {client.phone ? (
              <a className="karton-field-value" href={`tel:${client.phone.replace(/\s/g, "")}`}>{client.phone}</a>
            ) : (
              <span className="karton-field-value karton-field-empty">nije upisan</span>
            )}
          </div>
          <div className="karton-field">
            <span className="karton-field-label">Email</span>
            {client.email ? (
              <a className="karton-field-value" href={`mailto:${client.email}`}>{client.email}</a>
            ) : (
              <span className="karton-field-value karton-field-empty">nije upisan</span>
            )}
          </div>
        </div>
      </header>

      {/* Dates down, regions across */}
      <div className="karton-scroll">
        <table className="karton-table">
          <thead>
            <tr>
              <th scope="col" className="karton-date">Datum</th>
              {columns.map((c) => <th key={c} scope="col">{c}</th>)}
              <th scope="col" className="karton-col-end">
                <button type="button" className="karton-col-add" onClick={() => setRowSheet({ row: rowForNewColumn })}>
                  <Plus size={13} strokeWidth={3} /> Regija
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isToday = row.date === today;
              const isFuture = row.date > today;
              return (
                <tr key={row.id} className={isToday ? "karton-row-today" : isFuture ? "karton-row-future" : undefined}>
                  <th scope="row" className="karton-date">
                    <button
                      type="button"
                      className="karton-date-button"
                      onClick={() => setRowSheet({ row })}
                      aria-label={`Izmeni red ${fmtDate(row.date)}`}
                    >
                      <span className="karton-date-day">{fmtDayMonth(row.date)}</span>
                      <span className="karton-date-sub">{row.date.slice(0, 4)} · {row.location === "sombor" ? "SO" : "NS"}</span>
                      {isToday && <span className="karton-today-tag">DANAS</span>}
                      {isFuture && <span className="karton-date-sub italic">zakazano</span>}
                    </button>
                  </th>
                  {columns.map((region) => {
                    const entry = row.entries.find((e) => e.region === region);
                    return (
                      <EnergyCell
                        // A cell changed from outside starts over from the new value.
                        key={`${region}:${entry?.energy_j ?? ""}`}
                        label={`${region}, ${fmtDate(row.date)}`}
                        entry={entry}
                        onSave={(energy) => saveCell(row, region, energy)}
                      />
                    );
                  })}
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <>
          <p className="karton-printed karton-empty px-4 sm:px-6 py-3">
            Karton je prazan. Red za termin se dodaje sam kad klijent zakaže, a stare tretmane možete prepisati ovde.
          </p>
          <div className="karton-blank-line" aria-hidden="true" />
        </>
      )}

      <button type="button" className="karton-add-row" onClick={() => setRowSheet({ row: null })}>
        <Plus size={17} strokeWidth={2.5} /> Novi red
      </button>

      <NoteField
        initial={karton.note}
        onSave={async (note) => {
          await actions.saveNote(karton.id, note);
          update((k) => ({ ...k, note }));
        }}
      />

      <footer className="karton-printed px-4 sm:px-6 pt-1 pb-5">
        Frekvencija se računa sama: ispod 15 J <b>10 Hz</b>, od 15 J naviše <b>7 Hz</b>.
      </footer>

      {rowSheet && (
        <KartonRowSheet
          row={rowSheet.row}
          defaults={{ date: today, location, regions: lastRegions }}
          regions={offered}
          onClose={() => setRowSheet(null)}
          onSave={saveRow}
          onDelete={rowSheet.row ? deleteRow : undefined}
        />
      )}

      {editingClient && (
        <KartonClientSheet
          title="Podaci klijenta"
          submitLabel="Sačuvaj"
          initial={clientDraft(client)}
          onClose={() => setEditingClient(false)}
          onSubmit={async (draft) => {
            try {
              const saved = await actions.saveClient(client.id, draft);
              update((k) => ({ ...k, client: saved }));
              setEditingClient(false);
              return null;
            } catch {
              return "Nije sačuvano. Proverite internet i pokušajte ponovo.";
            }
          }}
        />
      )}
    </article>
  );
}
