/**
 * Server reads for /paketici: today's Novi Sad prices per version, and how many
 * boxes are left. Server-only.
 */
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchPriceRows, PriceBook } from "@/lib/prices";
import { GIFT_LOCATION, VERSION_GENDER, type GiftCatalog, type GiftService } from "@/lib/paketici";

/** Every active treatment of both lists at today's Novi Sad price; null if the read failed. */
export async function loadGiftCatalog(): Promise<GiftCatalog | null> {
  const [{ data, error }, priceRows] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, gender")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    fetchPriceRows(),
  ]);
  if (error || !data || data.length === 0 || !priceRows) return null;

  const book = new PriceBook(priceRows);
  const list = (gender: string): GiftService[] =>
    data.flatMap((s) => {
      if (s.gender !== gender) return [];
      const price = book.priceAt(s.id, GIFT_LOCATION);
      return price == null ? [] : [{ id: s.id, name: s.name, price }];
    });
  return { zenska: list(VERSION_GENDER.zenska), muska: list(VERSION_GENDER.muska) };
}

export interface GiftStock {
  total: number;
  remaining: number;
}

/** Boxes left; null when the count can't be read (e.g. sql/paketici.sql not applied yet). */
export async function loadGiftStock(): Promise<GiftStock | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Untyped client: the gift functions are not in lib/database.types.ts.
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("gift_orders_stock");
  const r = Array.isArray(data) ? data[0] : null;
  if (error || !r) return null;
  return { total: Number(r.total), remaining: Number(r.remaining) };
}
