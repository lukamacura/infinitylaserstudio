// ── Per-studio price lists ─────────────────────────────────────────────────────
// Every studio has its own prices, and prices change over time. The table
// `service_prices` keeps each price with the moment it started to apply (see
// sql/prices_phase1.sql). A reservation is always priced with the list that
// applied in its studio when it was booked, so a price change never rewrites
// past revenue. services.price is legacy and no longer read.

import { supabase } from "./supabase";
import type { LocationId } from "./locations";

export interface PriceRow {
  service_id: string;
  location: string;
  price: number;
  valid_from: string;
}

/** Every price row, oldest first. Small (a few dozen rows), so read whole. */
export async function fetchPriceRows(): Promise<PriceRow[] | null> {
  const { data, error } = await supabase
    .from("service_prices")
    .select("service_id, location, price, valid_from")
    .order("valid_from", { ascending: true });
  if (error || !data) return null;
  return data.map((r) => ({ ...r, price: Number(r.price) }));
}

/**
 * Looks up "price of service X in studio Y at moment T" without rescanning the
 * rows each time - finances and the admin calendar price hundreds of bookings.
 */
export class PriceBook {
  private readonly byKey = new Map<string, { from: number; price: number }[]>();

  constructor(rows: PriceRow[]) {
    for (const r of rows) {
      const key = `${r.service_id}|${r.location}`;
      const list = this.byKey.get(key) ?? [];
      list.push({ from: new Date(r.valid_from).getTime(), price: r.price });
      this.byKey.set(key, list);
    }
    for (const list of this.byKey.values()) list.sort((a, b) => a.from - b.from);
  }

  /** null when the treatment has no price in that studio at that moment. */
  priceAt(serviceId: string, location: string, at: Date | string | null = null): number | null {
    const list = this.byKey.get(`${serviceId}|${location}`);
    if (!list) return null;
    const t = at == null ? Date.now() : new Date(at).getTime();
    let price: number | null = null;
    for (const p of list) {
      if (p.from > t) break;
      price = p.price;
    }
    return price;
  }

  /**
   * The services with `price` set to what they cost in `location` at `at`
   * (now by default). Services without a price there are dropped.
   */
  apply<S extends { id: string; price: number }>(
    services: S[],
    location: LocationId | string,
    at: Date | string | null = null,
  ): S[] {
    const out: S[] = [];
    for (const s of services) {
      const price = this.priceAt(s.id, location, at);
      if (price != null) out.push({ ...s, price });
    }
    return out;
  }
}
