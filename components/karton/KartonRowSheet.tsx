"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { LOCATIONS, type LocationId } from "@/lib/locations";
import { fmtEnergy, sortRegions, type KartonRow } from "@/lib/kartoni";
import KartonSheet from "./KartonSheet";

/**
 * One row of the card: its date, its studio and which regions it has. Adding a
 * column and adding a row are the same thing here - a column is simply a region
 * some row has.
 */
export default function KartonRowSheet({
  row,
  defaults,
  regions,
  onClose,
  onSave,
  onDelete,
}: {
  /** Null for a new row. */
  row: KartonRow | null;
  defaults: { date: string; location: LocationId; regions: string[] };
  /** What the studio treats, in order; a region typed by hand joins the list. */
  regions: string[];
  onClose: () => void;
  onSave: (date: string, location: LocationId, regions: string[]) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [date, setDate] = useState(row?.date ?? defaults.date);
  const [location, setLocation] = useState<LocationId>(row?.location ?? defaults.location);
  const [selected, setSelected] = useState<string[]>(row ? row.entries.map((e) => e.region) : defaults.regions);
  const [typed, setTyped] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLoss, setConfirmLoss] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const energyOf = (region: string) => row?.entries.find((e) => e.region === region)?.energy_j ?? null;
  const shown = sortRegions([...regions, ...selected, ...extra], regions);
  /** Regions being taken off the row that already have an energy on them. */
  const losing = (row?.entries ?? []).filter((e) => e.energy_j !== null && !selected.includes(e.region));

  function toggle(region: string) {
    setConfirmLoss(false);
    setSelected((s) => (s.includes(region) ? s.filter((r) => r !== region) : [...s, region]));
  }

  function addTyped() {
    const name = typed.trim().replace(/\s+/g, " ");
    if (!name) return;
    const proper = name.charAt(0).toUpperCase() + name.slice(1);
    const known = shown.find((r) => r.toLowerCase() === proper.toLowerCase()) ?? proper;
    setExtra((x) => (x.includes(known) ? x : [...x, known]));
    setSelected((s) => (s.includes(known) ? s : [...s, known]));
    setTyped("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !date) return;
    if (losing.length > 0 && !confirmLoss) {
      setConfirmLoss(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(date, location, selected);
    } catch {
      setError("Nije sačuvano. Proverite internet i pokušajte ponovo.");
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError("Red nije obrisan. Proverite internet i pokušajte ponovo.");
      setBusy(false);
    }
  }

  const rowHasEnergy = (row?.entries ?? []).some((x) => x.energy_j !== null);

  return (
    <KartonSheet title={row ? "Izmena reda" : "Novi red"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="min-w-0">
            <label htmlFor="karton-date" className="karton-label">Datum</label>
            <input
              id="karton-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="karton-input"
            />
          </div>
          <div>
            <p className="karton-label">Studio</p>
            <div className="flex gap-1.5">
              {LOCATIONS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={location === l.id}
                  aria-label={l.name}
                  onClick={() => setLocation(l.id)}
                  className="karton-chip h-[46px]"
                >
                  {l.id === "sombor" ? "SO" : "NS"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="karton-label">Regije</p>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((r) => {
              const energy = energyOf(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={selected.includes(r)}
                  onClick={() => toggle(r)}
                  className="karton-chip"
                >
                  {r}
                  {energy !== null && <small>{fmtEnergy(energy)} J</small>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2.5">
            <input
              aria-label="Druga regija"
              placeholder="Druga regija…"
              value={typed}
              maxLength={40}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }}
              className="karton-input flex-1 min-w-0"
            />
            <button type="button" onClick={addTyped} aria-label="Dodaj regiju" className="karton-btn karton-btn-ghost shrink-0 !px-3.5">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {confirmLoss && losing.length > 0 && (
          <p className="karton-warning" role="alert">
            Briše se uneta energija za: <b>{losing.map((x) => `${x.region} (${fmtEnergy(x.energy_j as number)} J)`).join(", ")}</b>.
            Pritisnite „Sačuvaj” još jednom ako je to u redu.
          </p>
        )}
        {error && <p className="karton-warning" role="alert">{error}</p>}

        <button type="submit" disabled={busy || !date} className="karton-btn karton-btn-primary w-full">
          {busy ? "Čuvam…" : "Sačuvaj"}
        </button>

        {row && onDelete && (confirmDelete ? (
          <div className="space-y-2">
            <p className="karton-warning" role="alert">
              {rowHasEnergy ? "Ovaj red ima unete energije. Brisanje se ne može vratiti." : "Obrisati ovaj red?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="karton-btn karton-btn-ghost">Ne</button>
              <button type="button" onClick={remove} disabled={busy} className="karton-btn karton-btn-danger">Obriši red</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="karton-btn karton-btn-text w-full">
            Obriši red
          </button>
        ))}
      </form>
    </KartonSheet>
  );
}
