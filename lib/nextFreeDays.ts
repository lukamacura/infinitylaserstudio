import { supabase, calcBookingDuration, getAvailableSlots } from "@/lib/supabase";
import {
  fetchAvailability, resolveWindows, buildCandidateDates, toDateStr, PUBLIC_HORIZON_DAYS,
} from "@/lib/availability";
import { fetchPublicStaffDays } from "@/lib/staff";
import type { LocationId } from "@/lib/locations";

export interface FreeDay {
  date: string;       // YYYY-MM-DD
  isToday: boolean;
  freeSlots: number;
  staff: string[];
}

/** A first visit for one small region (consultation included) - nothing is chosen yet. */
const TEASER_DURATION = calcBookingDuration([{ service_duration: 15 }]);

/**
 * The next `count` days with a free start time at a studio, for the landing
 * CTA. Same rules as the modal's date step: 2-hour notice today, existing
 * reservations hide full days. Resolves to [] when anything fails to load.
 */
export async function loadNextFreeDays(location: LocationId, count: number): Promise<FreeDay[]> {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + PUBLIC_HORIZON_DAYS - 1);
  const todayStr = toDateStr(now);

  const [availability, busy, staff] = await Promise.all([
    fetchAvailability(location).catch(() => null),
    Promise.resolve(
      supabase.rpc("public_busy_slots", { p_from: todayStr, p_to: toDateStr(to), p_location: location }),
    ).then(({ data, error }) => (error ? null : data ?? []), () => null),
    fetchPublicStaffDays(location, todayStr, toDateStr(to)).catch(() => ({} as Record<string, string[]>)),
  ]);
  if (!availability || !busy) return [];

  const minStartToday = now.getHours() * 60 + now.getMinutes() + 120;
  const days: FreeDay[] = [];
  for (const date of buildCandidateDates(PUBLIC_HORIZON_DAYS, availability, now)) {
    const windows = resolveWindows(date, availability);
    if (!windows) continue;
    const isToday = date === todayStr;
    const reservations = busy.filter((r) => r.date === date);
    const freeSlots = getAvailableSlots(reservations, TEASER_DURATION, isToday ? minStartToday : undefined, windows).length;
    if (freeSlots === 0) continue;
    days.push({ date, isToday, freeSlots, staff: staff[date] ?? [] });
    if (days.length === count) break;
  }
  return days;
}
