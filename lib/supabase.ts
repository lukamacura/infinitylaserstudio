import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(url, key);

// ── Business logic helpers ──────────────────────────────────────────────────

export const BUSINESS_START        = 7 * 60;  // 07:00 in minutes
export const BUSINESS_END          = 17 * 60; // 17:00 in minutes
export const SLOT_SIZE             = 10;      // minutes per slot
export const CONSULTATION_MINUTES  = 15;      // mandatory pre-treatment consultation

/** Total duration (including inter-service pauses, but NOT a trailing pause after the last service), rounded up to slot boundary */
export function calcTotalDuration(services: { service_duration: number; pause_duration: number }[]): number {
  const raw = services.reduce((sum, s) => sum + s.service_duration + s.pause_duration, 0)
            - (services.at(-1)?.pause_duration ?? 0);
  return Math.ceil(raw / SLOT_SIZE) * SLOT_SIZE;
}

/** Booking duration = services + inter-service pauses + consultation, rounded up to slot boundary */
export function calcBookingDuration(services: { service_duration: number; pause_duration: number }[]): number {
  const raw = services.reduce((sum, s) => sum + s.service_duration + s.pause_duration, 0)
            - (services.at(-1)?.pause_duration ?? 0);
  return Math.ceil((raw + CONSULTATION_MINUTES) / SLOT_SIZE) * SLOT_SIZE;
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
  minStartMinutes?: number
): string[] {
  const active = reservations
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({
      start: timeToMinutes(r.start_time),
      end:   timeToMinutes(r.end_time),
    }));

  // Round minStart up to the next clean slot boundary
  const earliest = minStartMinutes !== undefined
    ? Math.ceil(minStartMinutes / SLOT_SIZE) * SLOT_SIZE
    : BUSINESS_START;

  const fromMinute = Math.max(BUSINESS_START, earliest);
  const slots: string[] = [];

  for (let t = fromMinute; t + durationMinutes <= BUSINESS_END; t += SLOT_SIZE) {
    const slotEnd = t + durationMinutes;
    const hasConflict = active.some((r) => t < r.end && slotEnd > r.start);
    if (!hasConflict) slots.push(minutesToTime(t));
  }

  return slots;
}
