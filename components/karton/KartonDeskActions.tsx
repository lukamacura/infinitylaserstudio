"use client";

import { useEffect, useState } from "react";
import { Combine, Search, Trash2 } from "lucide-react";
import { fmtCardNumber, plural, type Karton, type KartonActions, type KartonListItem } from "@/lib/kartoni";
import KartonSheet from "./KartonSheet";

/** What is done to a card as a whole: these lie next to it on the desk, not on it. */
export default function KartonDeskActions({
  karton,
  actions,
  onGone,
  onMerged,
}: {
  karton: Karton;
  actions: KartonActions;
  /** The card no longer exists. */
  onGone: () => void;
  /** Another card was merged into this one - load it again. */
  onMerged: () => void;
}) {
  const [sheet, setSheet] = useState<"delete" | "merge" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KartonListItem[]>([]);
  const [picked, setPicked] = useState<KartonListItem | null>(null);

  const search = actions.search;
  useEffect(() => {
    if (sheet !== "merge" || query.trim().length < 2) return;
    let active = true;
    const t = setTimeout(() => {
      search(query)
        .then((r) => { if (active) setResults(r.filter((x) => x.karton_id !== karton.id)); })
        .catch(() => { if (active) setError("Pretraga nije uspela. Proverite internet."); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [sheet, query, search, karton.id]);

  function close() {
    setSheet(null);
    setBusy(false);
    setError(null);
    setQuery("");
    setResults([]);
    setPicked(null);
  }

  async function run(job: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch {
      setError(failure);
      setBusy(false);
    }
  }

  const filledRows = karton.rows.filter((r) => r.entries.some((e) => e.energy_j !== null)).length;
  const linkButton = "inline-flex items-center gap-2 min-h-11 px-3 rounded-xl text-[13px] font-semibold font-poppins transition-colors cursor-pointer";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-1">
      <button type="button" onClick={() => setSheet("merge")} className={`${linkButton} text-foreground/70 hover:text-foreground hover:bg-foreground/5`}>
        <Combine size={16} /> Spoji sa drugim kartonom
      </button>
      <button type="button" onClick={() => setSheet("delete")} className={`${linkButton} text-red-400 hover:bg-red-400/10`}>
        <Trash2 size={16} /> Obriši karton
      </button>

      {sheet === "delete" && (
        <KartonSheet title="Obrisati karton?" onClose={close}>
          <div className="space-y-3.5">
            <p className="karton-warning">
              Karton Nº {fmtCardNumber(karton.number)}, <b>{karton.client.name}</b>:
              {" "}{karton.rows.length} {plural(karton.rows.length, "red", "reda", "redova")}
              {filledRows > 0 && `, od toga ${filledRows} sa unetim energijama`}
              {karton.note.trim() && " i napomena"}. Brisanje se ne može vratiti.
            </p>
            <p className="karton-printed">
              Rezervacije klijenta ostaju. Ako ponovo zakaže, dobiće nov, prazan karton.
            </p>
            {error && <p className="karton-warning" role="alert">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={close} className="karton-btn karton-btn-ghost">Odustani</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => { await actions.deleteKarton(karton.id); onGone(); }, "Karton nije obrisan. Proverite internet.")}
                className="karton-btn karton-btn-danger"
              >
                {busy ? "Brišem…" : "Obriši"}
              </button>
            </div>
          </div>
        </KartonSheet>
      )}

      {sheet === "merge" && (
        <KartonSheet title="Spoji kartone" onClose={close}>
          {picked ? (
            <div className="space-y-3.5">
              <p className="karton-warning">
                Sve iz kartona <b>{picked.name}</b> (Nº {fmtCardNumber(picked.number)}) prelazi u ovaj karton, a taj
                karton se briše. Spajajte samo ako je to sigurno ista osoba.
              </p>
              {error && <p className="karton-warning" role="alert">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPicked(null)} className="karton-btn karton-btn-ghost">Nazad</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(async () => { await actions.mergeKartoni(karton.id, picked.karton_id); close(); onMerged(); }, "Kartoni nisu spojeni. Proverite internet.")}
                  className="karton-btn karton-btn-primary"
                >
                  {busy ? "Spajam…" : "Spoji"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="karton-printed">Nađite drugi karton iste osobe. Njegov sadržaj prelazi u ovaj.</p>
              <div className="relative">
                <Search size={17} className="karton-printed absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  autoFocus
                  aria-label="Pretraga kartona"
                  placeholder="Ime, telefon ili email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="karton-input karton-input-search"
                />
              </div>
              {error && <p className="karton-warning" role="alert">{error}</p>}
              <div className="space-y-1">
                {query.trim().length >= 2 && results.map((r) => (
                  <button
                    key={r.karton_id}
                    type="button"
                    onClick={() => setPicked(r)}
                    className="karton-pick w-full text-left px-3 py-2.5 rounded-lg hover:bg-black/5 cursor-pointer"
                  >
                    <span className="karton-index-name">{r.name}</span>
                    <span className="karton-index-meta">Nº {fmtCardNumber(r.number)} · {r.phone ?? "bez telefona"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </KartonSheet>
      )}
    </div>
  );
}
