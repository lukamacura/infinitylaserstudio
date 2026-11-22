"use client";

import { useEffect, useState } from "react";
import { GIFT_LIMIT } from "@/lib/paketici";

/** Boxes left; `remaining` null when the count is unknown. */
export interface Stock {
  total: number;
  remaining: number | null;
}

const EVENT = "pk:stock";
let fresh: Promise<Stock | null> | null = null;

/** One fresh read per page view, shared by every counter on the page. */
function fetchStock(): Promise<Stock | null> {
  fresh ??= fetch("/api/paketici", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && typeof d.remaining === "number" ? { total: Number(d.total) || GIFT_LIMIT, remaining: d.remaining } : null))
    .catch(() => null);
  return fresh;
}

/** After an order: every counter shows the new number. */
export function announceStock(remaining: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: remaining }));
}

/** The page renders with the server's count, then checks for a fresher one. */
export function useStock(initial: Stock): Stock {
  const [stock, setStock] = useState(initial);
  useEffect(() => {
    let live = true;
    void fetchStock().then((s) => { if (live && s) setStock(s); });
    const on = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number") setStock((s) => ({ ...s, remaining: n }));
    };
    window.addEventListener(EVENT, on);
    return () => { live = false; window.removeEventListener(EVENT, on); };
  }, []);
  return stock;
}
