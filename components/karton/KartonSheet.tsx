"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** A slip of card paper: bottom sheet on a phone, a dialog from `sm` up. */
export default function KartonSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 admin-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="karton-sheet relative z-10 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] admin-sheet-in"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="karton-sheet-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-lg cursor-pointer shrink-0"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
