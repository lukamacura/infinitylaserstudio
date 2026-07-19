import { supabase, type BusinessWindow } from "./supabase";

export type { BusinessWindow };

/** Weekly template: index 0 = Monday … 6 = Sunday. Empty array = closed that day. */
export type WeeklyTemplate = BusinessWindow[][];

/** Per-date overrides: "YYYY-MM-DD" → windows. Empty array = explicitly closed. */
export type OverridesMap = Record<string, BusinessWindow[]>;

export interface AvailabilityData {
  template: WeeklyTemplate;
  overrides: OverridesMap;
}

/** Public site shows this many days from today (rolling 2-week window). */
export const PUBLIC_HORIZON_DAYS = 14;

/** Admin can schedule this far ahead (not limited to the public window). */
export const ADMIN_HORIZON_DAYS = 90;

const CLOSED_TEMPLATE: WeeklyTemplate = [[], [], [], [], [], [], []];

/** Safe fallback before availability loads or on a fetch error — everything closed. */
export const EMPTY_AVAILABILITY: AvailabilityData = { template: CLOSED_TEMPLATE, overrides: {} };

/** Local calendar date "YYYY-MM-DD" (not UTC — avoids evening off-by-one). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-index (0=Mon … 6=Sun) for a "YYYY-MM-DD" string. */
function weekdayOf(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

/**
 * Effective working windows for a date: a per-date override wins (empty ⇒ closed),
 * otherwise the weekly template for that weekday. Returns null when closed.
 */
export function resolveWindows(
  dateStr: string,
  data: AvailabilityData,
): BusinessWindow[] | null {
  const override = data.overrides[dateStr];
  if (override !== undefined) return override.length ? override : null;
  const windows = data.template[weekdayOf(dateStr)];
  return windows && windows.length ? windows : null;
}

/**
 * Future dates (today … today + horizonDays − 1) that have at least one open
 * window, chronologically ordered. Replaces the old `Object.keys(SPECIAL_AVAILABILITY)`.
 */
export function buildCandidateDates(
  horizonDays: number,
  data: AvailabilityData,
  fromDate: Date = new Date(),
): string[] {
  const dates: string[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const dateStr = toDateStr(d);
    if (resolveWindows(dateStr, data)) dates.push(dateStr);
  }
  return dates;
}

/** Load the weekly template + all future overrides (date ≥ today) from Supabase. */
export async function fetchAvailability(): Promise<AvailabilityData> {
  const todayStr = toDateStr(new Date());
  const [tplRes, ovrRes] = await Promise.all([
    supabase.from("weekly_schedule").select("weekday, windows"),
    supabase.from("availability_overrides").select("date, windows").gte("date", todayStr),
  ]);

  const template: WeeklyTemplate = [[], [], [], [], [], [], []];
  for (const row of (tplRes.data ?? []) as { weekday: number; windows: unknown }[]) {
    if (row.weekday >= 0 && row.weekday <= 6) {
      template[row.weekday] = (row.windows as BusinessWindow[] | null) ?? [];
    }
  }

  const overrides: OverridesMap = {};
  for (const row of (ovrRes.data ?? []) as { date: string; windows: unknown }[]) {
    overrides[row.date] = (row.windows as BusinessWindow[] | null) ?? [];
  }

  return { template, overrides };
}
