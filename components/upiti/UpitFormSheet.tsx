"use client";

import { useState, type FormEvent } from "react";
import KartonSheet from "@/components/karton/KartonSheet";
import { normPhone, UPIT_SOURCES, type Upit, type UpitDraft } from "@/lib/upiti";

/** Writing someone on the list, or correcting what was written. Only the name is required. */
export default function UpitFormSheet({
  title,
  submitLabel,
  initial,
  editingId,
  openList,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: UpitDraft;
  /** The one being corrected, so it doesn't count as its own duplicate. */
  editingId?: string;
  /** Who is on the list now - a number already on it gets a warning. */
  openList: Upit[];
  onClose: () => void;
  /** Resolves to an error message, or null when it went through. */
  onSubmit: (draft: UpitDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phone = normPhone(draft.phone);
  const already = phone ? openList.find((u) => u.id !== editingId && u.phone && normPhone(u.phone) === phone) : undefined;
  const canSave = draft.name.trim() !== "" && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    const result = await onSubmit(draft);
    setError(result);
    setBusy(false);
  }

  return (
    <KartonSheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label htmlFor="upit-name" className="karton-label">Ime</label>
          <input
            id="upit-name"
            className="karton-input"
            value={draft.name}
            maxLength={120}
            autoComplete="off"
            placeholder="ime i prezime ili ime sa Instagrama"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="upit-phone" className="karton-label">Telefon</label>
          <input
            id="upit-phone"
            className="karton-input"
            type="tel"
            inputMode="tel"
            value={draft.phone}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
          {already && (
            <p className="karton-printed mt-1.5"><b>Ovaj broj je već na spisku: {already.name}.</b></p>
          )}
        </div>

        <div>
          <p className="karton-label">Odakle je upit</p>
          <div className="upit-src-grid">
            {UPIT_SOURCES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={draft.source === s.key}
                onClick={() => setDraft({ ...draft, source: s.key })}
                className="karton-chip justify-center !px-1"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="upit-note" className="karton-label">Šta pita (nije obavezno)</label>
          <input
            id="upit-note"
            className="karton-input"
            value={draft.note}
            maxLength={1000}
            autoComplete="off"
            placeholder="npr. celo telo, cena, prvi tretman"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>

        {error && <p className="karton-warning" role="alert">{error}</p>}
        <button type="submit" disabled={!canSave} className="karton-btn karton-btn-primary w-full">
          {busy ? "Čuvam…" : submitLabel}
        </button>
      </form>
    </KartonSheet>
  );
}
