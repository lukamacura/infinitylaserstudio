/**
 * The treatment cards: types, the rules the card shows, and every call the
 * /kartoni pages make. Tables and triggers live in sql/kartoni.sql.
 */
import { supabase } from "./supabase";
import type { LocationId } from "./locations";

export type KartonGender = "zene" | "muskarci";

export type KartonEntry = {
  region: string;
  energy_j: number | null;
  frequency_hz: number | null;
  /** Booked or picked for this date: an empty cell the staff still has to fill. */
  planned: boolean;
};

export type KartonRow = {
  id: string;
  date: string;
  location: LocationId;
  /** The booking this row came from; null for a row added by hand. */
  reservation_id: string | null;
  created_at: string;
  entries: KartonEntry[];
};

export type KartonClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: KartonGender | null;
};

export type Karton = {
  id: string;
  number: number;
  note: string;
  client: KartonClient;
  rows: KartonRow[];
};

export type KartonListItem = {
  karton_id: string;
  number: number;
  client_id: string;
  name: string;
  name_norm: string;
  phone: string | null;
  email: string | null;
  rows_count: number;
  last_date: string | null;
  next_date: string | null;
  total: number;
};

export type KartonTodayItem = {
  karton_id: string;
  number: number;
  name: string;
  start_time: string | null;
  regions: string[];
  filled: number;
};

export type ClientDraft = {
  name: string;
  phone: string;
  email: string;
  gender: KartonGender | null;
};

// ── Energy and frequency ──────────────────────────────────────────────────────

const FREQUENCY_LIMIT_J = 15;
export const MAX_ENERGY_J = 100;

/** Below 15 J: 10 Hz, from 15 J up: 7 Hz. Mirrored in karton_frequency, which has the last word. */
export function frequencyFor(energy: number): number {
  return energy < FREQUENCY_LIMIT_J ? 10 : 7;
}

/** What was typed into a cell: a number, nothing, or something that can't be saved. */
export function parseEnergy(text: string): number | null | "invalid" {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return null;
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(clean)) return "invalid";
  const value = Number(clean);
  return value > 0 && value <= MAX_ENERGY_J ? value : "invalid";
}

/** 12.5 → "12,5" - the decimal comma a phone's keypad types back. */
export function fmtEnergy(energy: number): string {
  return String(Number(energy)).replace(".", ",");
}

// ── Dates ─────────────────────────────────────────────────────────────────────

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-10-07" → "7.10." */
export function fmtDayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

/** "2026-10-07" → "7.10.2026." */
export function fmtDate(date: string): string {
  return `${fmtDayMonth(date)}${date.slice(0, 4)}.`;
}

export function fmtCardNumber(number: number): string {
  return String(number).padStart(4, "0");
}

/** Serbian plural: 1 karton · 2-4 kartona · 5+ kartona, 1 red · 2-4 reda · 5+ redova. */
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// ── Regions (the card's columns) ──────────────────────────────────────────────

/**
 * The columns one service stands for. A combo is two regions, usually at two
 * energies; whole body is the regions it covers (not the face, which is booked
 * next to it). Mirrored in karton_service_regions.
 */
export function regionsOfService(name: string, gender: KartonGender): string[] {
  if (name.toLowerCase().includes("celo telo")) {
    return gender === "muskarci"
      ? ["Pazuh", "Ruke", "Grudi", "Stomak", "Leđa", "Noge"]
      : ["Pazuh", "Ruke", "Noge", "Intima"];
  }
  return name.trim().split(/\s+(?:\+|i)\s+/).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
}

/** Every region the studio treats, per gender, in price-list order. */
export type RegionCatalog = Record<KartonGender, string[]>;
export const EMPTY_CATALOG: RegionCatalog = { zene: [], muskarci: [] };

export function buildCatalog(services: { name: string; gender: string }[]): RegionCatalog {
  const out: RegionCatalog = { zene: [], muskarci: [] };
  for (const s of services) {
    if (s.gender !== "zene" && s.gender !== "muskarci") continue;
    const list = out[s.gender];
    // Whole body only repeats regions that are on the list anyway.
    if (s.name.toLowerCase().includes("celo telo")) continue;
    for (const r of regionsOfService(s.name, s.gender)) if (!list.includes(r)) list.push(r);
  }
  return out;
}

/** The regions to offer for a client - their gender's first, then the other's. */
export function regionsFor(catalog: RegionCatalog, gender: KartonGender | null): string[] {
  const first = gender === "muskarci" ? catalog.muskarci : catalog.zene;
  const second = gender === "muskarci" ? catalog.zene : catalog.muskarci;
  return gender ? first : [...first, ...second.filter((r) => !first.includes(r))];
}

/** Columns in price-list order, anything typed by hand after them. */
export function sortRegions(regions: Iterable<string>, order: string[]): string[] {
  const rank = (r: string) => {
    const i = order.indexOf(r);
    return i === -1 ? order.length : i;
  };
  return [...new Set(regions)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "sr"));
}

export function sortRows(rows: KartonRow[]): KartonRow[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
}

// ── Calls ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40;
export const KARTONI_PAGE_SIZE = PAGE_SIZE;

export async function searchKartoni(query: string, offset = 0): Promise<KartonListItem[]> {
  const { data, error } = await supabase.rpc("karton_search", { p_query: query, p_limit: PAGE_SIZE, p_offset: offset });
  if (error) throw error;
  return (data ?? []) as KartonListItem[];
}

export async function fetchKartoniToday(location: LocationId): Promise<KartonTodayItem[]> {
  const { data, error } = await supabase.rpc("karton_today", { p_location: location });
  if (error) throw error;
  return (data ?? []) as KartonTodayItem[];
}

export async function fetchRegionCatalog(): Promise<RegionCatalog> {
  const { data, error } = await supabase
    .from("services")
    .select("name, gender")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return buildCatalog(data ?? []);
}

export async function fetchKarton(id: string): Promise<Karton | null> {
  const { data, error } = await supabase
    .from("kartoni")
    .select(`
      id, number, note,
      client:clients ( id, name, phone, email, gender ),
      rows:karton_rows ( id, date, location, reservation_id, created_at,
        entries:karton_entries ( region, energy_j, frequency_hz, planned ) )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const karton = data as unknown as Karton;
  return { ...karton, rows: sortRows(karton.rows) };
}

export type CreateKartonResult =
  | { status: "created"; id: string }
  | { status: "exists"; id: string; name: string }
  | { status: "invalid_name" };

export async function createKarton(draft: ClientDraft, force = false): Promise<CreateKartonResult> {
  const { data, error } = await supabase.rpc("karton_create", {
    p_name: draft.name,
    p_phone: draft.phone,
    p_email: draft.email,
    p_gender: draft.gender,
    p_force: force,
  });
  if (error) throw error;
  return data as unknown as CreateKartonResult;
}

export async function kartonForReservation(reservationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("karton_for_reservation", { p_reservation_id: reservationId });
  if (error) throw error;
  return data ?? null;
}

/** Everything a card can do, passed in so the card itself holds no database code. */
export type KartonActions = {
  saveEnergy: (rowId: string, region: string, energy: number | null, planned: boolean) => Promise<KartonEntry | null>;
  saveNote: (kartonId: string, note: string) => Promise<void>;
  saveClient: (clientId: string, draft: ClientDraft) => Promise<KartonClient>;
  addRow: (kartonId: string, date: string, location: LocationId, regions: string[]) => Promise<KartonRow>;
  updateRow: (row: KartonRow, date: string, location: LocationId, regions: string[]) => Promise<KartonRow>;
  deleteRow: (rowId: string) => Promise<void>;
  deleteKarton: (id: string) => Promise<void>;
  mergeKartoni: (keepId: string, dropId: string) => Promise<void>;
  search: (query: string) => Promise<KartonListItem[]>;
};

const ENTRY_COLUMNS = "region, energy_j, frequency_hz, planned";
const ROW_COLUMNS = `id, date, location, reservation_id, created_at, entries:karton_entries ( ${ENTRY_COLUMNS} )`;

export const kartonActions: KartonActions = {
  /** Returns the saved cell, or null when clearing it removed it from the row. */
  async saveEnergy(rowId, region, energy, planned) {
    if (energy === null && !planned) {
      const { error } = await supabase.from("karton_entries").delete().eq("row_id", rowId).eq("region", region);
      if (error) throw error;
      return null;
    }
    const { data, error } = await supabase
      .from("karton_entries")
      .upsert({ row_id: rowId, region, energy_j: energy }, { onConflict: "row_id,region" })
      .select(ENTRY_COLUMNS)
      .single();
    if (error) throw error;
    return data as KartonEntry;
  },

  async saveNote(kartonId, note) {
    const { error } = await supabase.from("kartoni").update({ note }).eq("id", kartonId);
    if (error) throw error;
  },

  async saveClient(clientId, draft) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: draft.name.trim(),
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        gender: draft.gender,
      })
      .eq("id", clientId)
      .select("id, name, phone, email, gender")
      .single();
    if (error) throw error;
    return data as KartonClient;
  },

  async addRow(kartonId, date, location, regions) {
    const { data, error } = await supabase
      .from("karton_rows")
      .insert({ karton_id: kartonId, date, location })
      .select("id, date, location, reservation_id, created_at")
      .single();
    if (error) throw error;
    const row = data as Omit<KartonRow, "entries">;
    if (regions.length === 0) return { ...row, entries: [] };
    const { data: entries, error: entriesError } = await supabase
      .from("karton_entries")
      .insert(regions.map((region) => ({ row_id: row.id, region, planned: true })))
      .select(ENTRY_COLUMNS);
    if (entriesError) {
      // A row without its cells is worse than no row - take it back.
      await supabase.from("karton_rows").delete().eq("id", row.id);
      throw entriesError;
    }
    return { ...row, entries: (entries ?? []) as KartonEntry[] };
  },

  async updateRow(row, date, location, regions) {
    if (date !== row.date || location !== row.location) {
      const { error } = await supabase.from("karton_rows").update({ date, location }).eq("id", row.id);
      if (error) throw error;
    }
    const removed = row.entries.map((e) => e.region).filter((r) => !regions.includes(r));
    if (removed.length > 0) {
      const { error } = await supabase.from("karton_entries").delete().eq("row_id", row.id).in("region", removed);
      if (error) throw error;
    }
    const added = regions.filter((r) => !row.entries.some((e) => e.region === r));
    if (added.length > 0) {
      const { error } = await supabase
        .from("karton_entries")
        .insert(added.map((region) => ({ row_id: row.id, region, planned: true })));
      if (error) throw error;
    }
    const { data, error } = await supabase.from("karton_rows").select(ROW_COLUMNS).eq("id", row.id).single();
    if (error) throw error;
    return data as unknown as KartonRow;
  },

  async deleteRow(rowId) {
    const { error } = await supabase.from("karton_rows").delete().eq("id", rowId);
    if (error) throw error;
  },

  async deleteKarton(id) {
    const { error } = await supabase.rpc("karton_delete", { p_id: id });
    if (error) throw error;
  },

  async mergeKartoni(keepId, dropId) {
    const { error } = await supabase.rpc("karton_merge", { p_keep: keepId, p_drop: dropId });
    if (error) throw error;
  },

  search: (query) => searchKartoni(query),
};
