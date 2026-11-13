import { supabase, type BusinessWindow, type LaserDay } from "./supabase";
import type { LocationId } from "./locations";
import { SINGLE_LASER, isLaserActive, type Laser } from "./lasers";

/** Weekly template: index 0 = Monday … 6 = Sunday. Empty array = closed that day. */
export type WeeklyTemplate = BusinessWindow[][];

/** Per-date overrides: "YYYY-MM-DD" → windows. Empty array = explicitly closed. */
export type OverridesMap = Record<string, BusinessWindow[]>;

/** One laser's working hours: its weekly template and its per-date exceptions. */
export interface LaserHours {
  template: WeeklyTemplate;
  overrides: OverridesMap;
}

/**
 * A studio's working hours. Every laser has its own (sql/lasers_phase1.sql);
 * the studio is open whenever one of them works.
 */
export interface AvailabilityData {
  /** The studio's lasers, lowest number first. */
  lasers: Laser[];
  /** Laser number → its hours. A laser missing here is closed every day. */
  hours: Record<number, LaserHours>;
}

export type { LaserDay };

/** Public site shows this many days from today (rolling 2-week window). Server check (sql/booking_horizon_14.sql, v_today + 15) must stay ahead of this. */
export const PUBLIC_HORIZON_DAYS = 14;

/** Admin can schedule this far ahead (not limited to the public window). */
export const ADMIN_HORIZON_DAYS = 90;

const CLOSED_TEMPLATE: WeeklyTemplate = [[], [], [], [], [], [], []];

/** Hours of a laser nobody has set any for - closed every day. */
export const EMPTY_LASER_HOURS: LaserHours = { template: CLOSED_TEMPLATE, overrides: {} };

/** Safe fallback before availability loads or on a fetch error — everything closed. */
export const EMPTY_AVAILABILITY: AvailabilityData = { lasers: SINGLE_LASER, hours: {} };

/** Local calendar date "YYYY-MM-DD" (not UTC — avoids evening off-by-one). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-index (0=Mon … 6=Sun) for a "YYYY-MM-DD" string. */
export function weekdayOf(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

/** One laser's weekly template and exceptions (closed everywhere when it has none). */
export function laserHours(data: AvailabilityData, laser: number): LaserHours {
  return data.hours[laser] ?? EMPTY_LASER_HOURS;
}

/** A laser's own hours on a date: the date's exception, else its weekday; [] = closed or not started. */
function windowsOfLaser(dateStr: string, data: AvailabilityData, laser: number): BusinessWindow[] {
  const l = data.lasers.find((x) => x.laser === laser);
  if (!l || !isLaserActive(l, dateStr)) return [];
  const h = laserHours(data, laser);
  return h.overrides[dateStr] ?? h.template[weekdayOf(dateStr)] ?? [];
}

/** Windows put together: overlapping or touching ones become one. */
function mergeWindows(windows: BusinessWindow[]): BusinessWindow[] {
  const out: BusinessWindow[] = [];
  for (const w of [...windows].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

/** Every laser that works on a date, with its own hours, lowest number first. */
export function laserDays(dateStr: string, data: AvailabilityData): LaserDay[] {
  return data.lasers
    .map((l) => ({ laser: l.laser, windows: windowsOfLaser(dateStr, data, l.laser) }))
    .filter((d) => d.windows.length > 0);
}

/**
 * Every laser that has started by a date, whatever its hours - the admin may
 * book outside them. `windows` are its own hours (maybe none), so a laser that
 * works then can still be preferred (pickFreeLaser with anyHour).
 */
export function startedLaserDays(dateStr: string, data: AvailabilityData): LaserDay[] {
  return data.lasers
    .filter((l) => isLaserActive(l, dateStr))
    .map((l) => ({ laser: l.laser, windows: windowsOfLaser(dateStr, data, l.laser) }));
}

/**
 * Working windows for a date, null when closed. With `laser`: that laser's own
 * hours. Without: the studio's - every laser's hours put together.
 */
export function resolveWindows(
  dateStr: string,
  data: AvailabilityData,
  laser?: number,
): BusinessWindow[] | null {
  const windows = laser !== undefined
    ? windowsOfLaser(dateStr, data, laser)
    : mergeWindows(laserDays(dateStr, data).flatMap((d) => d.windows));
  return windows.length ? windows : null;
}

/**
 * Future dates (today … today + horizonDays − 1) on which some laser works,
 * chronologically ordered. Replaces the old `Object.keys(SPECIAL_AVAILABILITY)`.
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

type HoursRow = { windows: unknown; laser?: number | null };

/**
 * One studio's hours from its rows. A row without `laser` (read before
 * sql/lasers_phase1.sql) belongs to Laser 1. Shared with Infy (server side).
 */
export function buildAvailability(
  lasers: Laser[],
  templateRows: (HoursRow & { weekday: number })[],
  overrideRows: (HoursRow & { date: string })[],
): AvailabilityData {
  const hours: Record<number, LaserHours> = {};
  const of = (laser: number) => (hours[laser] ??= { template: [[], [], [], [], [], [], []], overrides: {} });
  for (const row of templateRows) {
    if (row.weekday >= 0 && row.weekday <= 6) {
      of(row.laser ?? 1).template[row.weekday] = (row.windows as BusinessWindow[] | null) ?? [];
    }
  }
  for (const row of overrideRows) {
    of(row.laser ?? 1).overrides[row.date] = (row.windows as BusinessWindow[] | null) ?? [];
  }
  return { lasers, hours };
}

/**
 * Load one studio's lasers and each laser's weekly template + future
 * exceptions (date ≥ today).
 */
export async function fetchAvailability(location: LocationId): Promise<AvailabilityData> {
  const todayStr = toDateStr(new Date());
  // "*" rather than a column list: before sql/lasers_phase1.sql the rows have
  // no `laser` and still load (as Laser 1) instead of failing the booking form.
  const [tplRes, ovrRes, laserRes] = await Promise.all([
    supabase.from("weekly_schedule").select("*").eq("location", location),
    supabase.from("availability_overrides").select("*").eq("location", location).gte("date", todayStr),
    supabase.from("lasers").select("laser, name, active_from").eq("location", location).order("laser"),
  ]);
  // A failed read must not pass for "closed every day".
  if (tplRes.error || ovrRes.error) throw new Error("availability load failed");

  // Lasers that cannot be read count as one laser - fewer times offered, never
  // a time the database would refuse (see SINGLE_LASER).
  const lasers: Laser[] = !laserRes.error && laserRes.data?.length ? laserRes.data : SINGLE_LASER;
  return buildAvailability(lasers, tplRes.data ?? [], ovrRes.data ?? []);
}
