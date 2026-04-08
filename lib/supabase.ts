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

export const SLOT_SIZE             = 10;      // minutes per slot
export const CONSULTATION_MINUTES  = 15;      // mandatory pre-treatment consultation

// ── Temporary availability whitelist ────────────────────────────────────────
// Remove this map (and the check below) to restore full-time scheduling.
// Each date may list one or more { start, end } windows (minutes since midnight).
export type BusinessWindow = { start: number; end: number };

export const SPECIAL_AVAILABILITY: Record<string, BusinessWindow[]> = {
  "2026-04-07": [{ start: 12 * 60,        end: 16 * 60      }], // 12:00–16:00
  "2026-04-11": [{ start: 10 * 60 + 30,   end: 17 * 60      }], // 10:30–17:00
  "2026-04-18": [{ start: 14 * 60,        end: 19 * 60      }], // 14:00–19:00
  "2026-04-20": [{ start: 13 * 60,        end: 20 * 60      }], // 13:00–20:00
  "2026-04-22": [{ start: 13 * 60,        end: 19 * 60      }], // 13:00–19:00
  "2026-04-25": [{ start: 10 * 60,        end: 16 * 60      }], // 10:00–16:00
  "2026-04-27": [{ start: 14 * 60,        end: 19 * 60      }], // 14:00–19:00
  "2026-05-05": [
    { start: 13 * 60,        end: 17 * 60 + 30 }, // 13:00–17:30
    { start: 18 * 60 + 30,  end: 19 * 60 + 30 }, // 18:30–19:30
  ],
  "2026-05-09": [{ start: 10 * 60,        end: 17 * 60      }], // 10:00–17:00
  "2026-05-15": [{ start: 14 * 60,        end: 20 * 60      }], // 14:00–20:00
  "2026-05-29": [{ start: 14 * 60,        end: 20 * 60      }], // 14:00–20:00
  "2026-05-30": [{ start: 10 * 60,        end: 17 * 60      }], // 10:00–17:00
};

/** Returns bookable time windows (minutes since midnight) for a date, or null if closed. */
export function getBusinessWindows(dateStr: string): BusinessWindow[] | null {
  const windows = SPECIAL_AVAILABILITY[dateStr];
  return windows?.length ? windows : null;
}

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
  minStartMinutes: number | undefined,
  businessWindows: BusinessWindow[],
): string[] {
  const active = reservations
    .filter((r) => r.status !== "cancelled")
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
