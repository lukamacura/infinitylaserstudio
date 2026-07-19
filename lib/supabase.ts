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

/**
 * Sum of treatment time for the selected regions, plus one flat 5-min pause
 * when 2+ regions are selected. Per-region `pause_duration` is ignored by design.
 */
function sumServiceDurations(services: { service_duration: number }[]): number {
  const sum = services.reduce((acc, s) => acc + s.service_duration, 0);
  return services.length >= 2 ? sum + MULTI_REGION_PAUSE_MINUTES : sum;
}

/** Treatment duration for returning customers (no consultation), rounded up to slot boundary. */
export function calcTotalDuration(services: { service_duration: number }[]): number {
  return Math.ceil(sumServiceDurations(services) / SLOT_SIZE) * SLOT_SIZE;
}

/** Treatment duration for first-time customers — adds a 10-min consultation, rounded up to slot boundary. */
export function calcBookingDuration(services: { service_duration: number }[]): number {
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
 * Return available start times (as "HH:MM") for a date given existing reservations.
 * Pass `minStartMinutes` to enforce a minimum start time (e.g. now+120 for same-day bookings).
 */
export function getAvailableSlots(
  reservations: { start_time: string; end_time: string; status: string }[],
  durationMinutes: number,
  minStartMinutes: number | undefined,
  businessWindows: BusinessWindow[],
): string[] {
  const active = reservations
    .filter((r) => r.status !== "cancelled" && r.status !== "blacklisted")
    .map((r) => ({
      start: timeToMinutes(r.start_time),
      end:   timeToMinutes(r.end_time),
    }));

  const slotSet = new Set<string>();

  for (const { start: businessStart, end: businessEnd } of businessWindows) {
    const earliest = minStartMinutes !== undefined
      ? Math.ceil(minStartMinutes / SLOT_SIZE) * SLOT_SIZE
      : businessStart;

    const fromMinute = Math.max(businessStart, earliest);

    for (let t = fromMinute; t + durationMinutes <= businessEnd; t += SLOT_SIZE) {
      const slotEnd = t + durationMinutes;
      const hasConflict = active.some((r) => t < r.end && slotEnd > r.start);
      if (!hasConflict) slotSet.add(minutesToTime(t));
    }
  }

  return Array.from(slotSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}
