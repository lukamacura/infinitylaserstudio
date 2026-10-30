"use client";

import { useState, type FormEvent } from "react";
import { EMAIL_REGEX } from "@/components/booking/shared";
import KartonSheet from "./KartonSheet";
import type { ClientDraft, KartonGender } from "@/lib/kartoni";

const GENDERS: { key: KartonGender; label: string }[] = [
  { key: "zene", label: "Žensko" },
  { key: "muskarci", label: "Muško" },
];

/** The client's details on a card - for a new card and for correcting an old one. */
export default function KartonClientSheet({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: ClientDraft;
  onClose: () => void;
  /** Resolves to an error message, or null when it went through. */
  onSubmit: (draft: ClientDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailBad = draft.email.trim() !== "" && !EMAIL_REGEX.test(draft.email.trim());
  const canSave = draft.name.trim() !== "" && !emailBad && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(await onSubmit({ ...draft, name: draft.name.trim() }));
    setBusy(false);
  }

  return (
    <KartonSheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label htmlFor="karton-name" className="karton-label">Ime i prezime</label>
          <input
            id="karton-name"
            className="karton-input"
            value={draft.name}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="karton-phone" className="karton-label">Telefon</label>
          <input
            id="karton-phone"
            className="karton-input"
            type="tel"
            value={draft.phone}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="karton-email" className="karton-label">Email (nije obavezno)</label>
          <input
            id="karton-email"
            className="karton-input"
            type="email"
            value={draft.email}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          {emailBad && <p className="karton-cell-error karton-type mt-1">Email nije ispravan.</p>}
        </div>
        <div>
          <p className="karton-label">Pol</p>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={draft.gender === g.key}
                onClick={() => setDraft({ ...draft, gender: draft.gender === g.key ? null : g.key })}
                className="karton-chip flex-1 justify-center"
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="karton-warning" role="alert">{error}</p>}
        <button type="submit" disabled={!canSave} className="karton-btn karton-btn-primary w-full">
          {busy ? "Čuvam…" : submitLabel}
        </button>
      </form>
    </KartonSheet>
  );
}
