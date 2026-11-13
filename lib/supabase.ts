import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set.");
  return createClient<Database>(url, key);
}

let _client: ReturnType<typeof getSupabaseClient> | null = null;

export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    if (!_client) _client = getSupabaseClient();
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ── Business logic helpers ──────────────────────────────────────────────────

export const SLOT_SIZE                  = 10; // minutes per slot
export const CONSULTATION_MINUTES       = 10; // pre-treatment consultation for first-time customers
export const MULTI_REGION_PAUSE_MINUTES = 5;  // single flat pause added when 2+ regions are selected

// ── Business window ─────────────────────────────────────────────────────────
// One bookable range { start, end } in minutes since midnight (e.g. 14:00 = 840).
// The schedule that produces these windows lives in the DB — see lib/availability.ts.
export type BusinessWindow = { start: number; end: number };

type DurationService = { service_duration: number; name?: string };

/**
 * Earrings + chin are treated in one go, so together they take as long as one
 * of them alone: the shorter one is dropped. Mirrored in public_create_booking.
 */
function mergeEarringsAndChin<T extends DurationService>(services: T[]): T[] {
  const n = (s: T) => (s.name ?? "").toLowerCase();
  const earrings = services.find((s) => n(s).includes("nausnice") && !n(s).includes("brada"));
  const chin     = services.find((s) => n(s).includes("brada") && !n(s).includes("nausnice"));
  if (!earrings || !chin) return services;
  const drop = earrings.service_duration >= chin.service_duration ? chin : earrings;
  return services.filter((s) => s !== drop);
}

/**
 * Sum of treatment time for the selected regions, plus one flat 5-min pause
 * when 2+ regions are selected. Per-region `pause_duration` is ignored by design.
 */
function sumServiceDurations(services: DurationService[]): number {
  const merged = mergeEarringsAndChin(services);
  const sum = merged.reduce((acc, s) => acc + s.service_duration, 0);
  return merged.length >= 2 ? sum + MULTI_REGION_PAUSE_MINUTES : sum;
}

/** Treatment duration for returning customers (no consultation), rounded up to slot boundary. */
export function calcTotalDuration(services: DurationService[]): number {
  return Math.ceil(sumServiceDurations(services) / SLOT_SIZE) * SLOT_SIZE;
}

/** Treatment duration for first-time customers — adds a 10-min consultation, rounded up to slot boundary. */
export function calcBookingDuration(services: DurationService[]): number {
  return Math.ceil((sumServiceDurations(services) + CONSULTATION_MINUTES) / SLOT_SIZE) * SLOT_SIZE;
}

/** Convert "HH:MM:SS" or "HH:MM" to total minutes */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * A booking as the slot check sees it. `laser` missing = Laser 1 (a row read
 * without it, or from before sql/lasers_phase1.sql).
 */
export type BusyRow = { start_time: string; end_time: string; status: string; laser?: number | null };

/** A laser and its own working hours on one date (lib/availability.ts: laserDays). */
export type LaserDay = { laser: number; windows: BusinessWindow[] };

type ActiveBusy = { start: number; end: number; laser: number };

/** Bookings that take up a laser's time (not cancelled, not blacklisted), in minutes. */
function activeBusy(reservations: BusyRow[]): ActiveBusy[] {
  return reservations
    .filter((r) => r.status !== "cancelled" && r.status !== "blacklisted")
    .map((r) => ({ start: timeToMinutes(r.start_time), end: timeToMinutes(r.end_time), laser: r.laser ?? 1 }));
}

function isFree(active: ActiveBusy[], laser: number, start: number, end: number): boolean {
  return !active.some((r) => r.laser === laser && start < r.end && end > r.start);
}

function inHours(windows: BusinessWindow[], start: number, end: number): boolean {
  return windows.some((w) => start >= w.start && end <= w.end);
}

/**
 * The laser a booking of [start, end) minutes would get; null when none.
 * Same rule as free_laser() in sql/lasers_phase1.sql:
 *   - only a laser with nothing booked then (back-to-back is fine);
 *   - the site (`anyHour` off): only one whose own hours cover the time;
 *   - the admin (`anyHour` on): any free one, but one that works then first;
 *   - among equals `prefer`, then the lowest number (Stari before Novi).
 */
export function pickFreeLaser(
  reservations: BusyRow[],
  start: number,
  end: number,
  lasers: LaserDay[],
  opts: { prefer?: number | null; anyHour?: boolean } = {},
): number | null {
  const active = activeBusy(reservations);
  const rank = (d: LaserDay) =>
    (inHours(d.windows, start, end) ? 0 : 2) + (d.laser === opts.prefer ? 0 : 1);
  const fits = lasers
    .filter((d) => isFree(active, d.laser, start, end) && (opts.anyHour || inHours(d.windows, start, end)))
    .sort((a, b) => rank(a) - rank(b) || a.laser - b.laser);
  return fits[0]?.laser ?? null;
}

/**
 * Return available start times (as "HH:MM") for a date given existing reservations.
 * Each laser is checked within its own hours: a time is available while at
 * least one laser works for the whole duration then and has nothing booked.
 * The client sees it once, however many lasers are free.
 * Pass `minStartMinutes` to enforce a minimum start time (e.g. now+120 for same-day bookings).
 */
export function getAvailableSlots(
  reservations: BusyRow[],
  durationMinutes: number,
  minStartMinutes: number | undefined,
  lasers: LaserDay[],
): string[] {
  const active = activeBusy(reservations);
  const earliest = minStartMinutes !== undefined
    ? Math.ceil(minStartMinutes / SLOT_SIZE) * SLOT_SIZE
    : -Infinity;

  const slotSet = new Set<string>();
  for (const { laser, windows } of lasers) {
    for (const { start: businessStart, end: businessEnd } of windows) {
      for (let t = Math.max(businessStart, earliest); t + durationMinutes <= businessEnd; t += SLOT_SIZE) {
        if (isFree(active, laser, t, t + durationMinutes)) slotSet.add(minutesToTime(t));
      }
    }
  }

  return Array.from(slotSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}
