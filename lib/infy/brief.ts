/**
 * The facts behind Infy's brief, server-side, as the signed-in admin:
 * infy_facts (sql/infy.sql) plus the calendar's shape for the next 7 days -
 * how full each studio is, the free stretches worth filling, and days with
 * working hours but nobody on the staff schedule. Nothing here is written by
 * the AI; it only puts words around these numbers.
 */
import type { BusinessWindow } from "@/lib/supabase";
import { LOCATIONS } from "@/lib/locations";
import { SINGLE_LASER } from "@/lib/lasers";
import { buildAvailability, laserDays, resolveWindows } from "@/lib/availability";
import type { AdminDb } from "@/lib/server/adminDb";
import { addDays, belgradeMinutes, belgradeToday, fromMinutes, mondayIndex, toMinutes } from "./time";
import type { DayLoad, Gap, InfyFacts, InfyLocation, StudioLoad } from "./types";

/** How many days ahead the calendar part looks (today included). */
export const BRIEF_DAYS = 7;
/** A free stretch shorter than this is not worth a word. */
export const GAP_MINUTES = 60;
/** Weeks after the last treatment before a client counts as "due back". */
export const RETURN_WEEKS = 8;

type Busy = { date: string; start_time: string; end_time: string; location: string; laser: number };

/** Union of busy intervals, clipped to [from, to]. */
function mergeBusy(intervals: [number, number][], from: number, to: number): [number, number][] {
  const sorted = intervals
    .map(([a, b]) => [Math.max(a, from), Math.min(b, to)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function dayLoad(
  date: string,
  windows: BusinessWindow[],
  busy: [number, number][],
  count: number,
  fromMinute: number,
  noStaff: boolean,
): DayLoad {
  let open = 0;
  let booked = 0;
  const gaps: Gap[] = [];
  for (const w of windows) {
    const start = Math.max(w.start, fromMinute);
    if (start >= w.end) continue;
    open += w.end - start;
    let cursor = start;
    for (const [a, b] of mergeBusy(busy, start, w.end)) {
      booked += b - a;
      if (a - cursor >= GAP_MINUTES) gaps.push({ start: fromMinutes(cursor), end: fromMinutes(a), minutes: a - cursor });
      cursor = Math.max(cursor, b);
    }
    if (w.end - cursor >= GAP_MINUTES) gaps.push({ start: fromMinutes(cursor), end: fromMinutes(w.end), minutes: w.end - cursor });
  }
  return { date, closed: windows.length === 0, open, booked, count, gaps, noStaff: noStaff && windows.length > 0 };
}

/**
 * One studio day from each working laser's own load (sql/lasers_phase1.sql):
 * every laser is its own line of time in its own hours, so open and booked
 * minutes add up and a free stretch on any of them is worth filling. No laser
 * working = closed.
 */
function mergeLoads(date: string, loads: DayLoad[], count: number, windows: BusinessWindow[], noStaff: boolean): DayLoad {
  const seen = new Set<string>();
  const gaps = loads
    .flatMap((l) => l.gaps)
    .filter((g) => {
      const key = `${g.start}-${g.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  return {
    date,
    closed: windows.length === 0 || loads.length === 0,
    open: loads.reduce((sum, l) => sum + l.open, 0),
    booked: loads.reduce((sum, l) => sum + l.booked, 0),
    count,
    gaps,
    noStaff: noStaff && windows.length > 0,
  };
}

/** The calendar part of the brief, both studios. */
export async function loadStudioLoads(db: AdminDb, now = new Date()): Promise<StudioLoad[]> {
  const today = belgradeToday(now);
  const last = addDays(today, BRIEF_DAYS - 1);
  // From now on, on the 10-minute grid - the morning that is over is not a gap.
  const nowMinute = Math.ceil(belgradeMinutes(now) / 10) * 10;

  const [tpl, ovr, res, staffTpl, staffOvr, lasersRes] = await Promise.all([
    db.from("weekly_schedule").select("weekday, windows, location, laser"),
    db.from("availability_overrides").select("date, windows, location, laser").gte("date", today).lte("date", last),
    db.from("reservations").select("date, start_time, end_time, location, laser")
      .gte("date", today).lte("date", last).in("status", ["pending", "confirmed"]),
    db.from("staff_weekly").select("weekday, staff_ids, location"),
    db.from("staff_overrides").select("date, staff_ids, location").gte("date", today).lte("date", last),
    db.from("lasers").select("location, laser, name, active_from").order("laser"),
  ]);
  if (tpl.error || ovr.error || res.error) throw new Error("calendar load failed");

  return LOCATIONS.map((studio): StudioLoad => {
    const loc = studio.id as InfyLocation;
    // Each laser's own hours. Lasers that cannot be read: one, every booking on it.
    const studioLasers = (lasersRes.error ? null : lasersRes.data ?? [])?.filter((l) => l.location === loc) ?? [];
    const hours = buildAvailability(
      studioLasers.length > 0 ? studioLasers : SINGLE_LASER,
      (tpl.data ?? []).filter((r) => r.location === loc),
      (ovr.data ?? []).filter((r) => r.location === loc),
    );
    const laserOf = (b: Busy) => (studioLasers.length > 0 ? b.laser ?? 1 : 1);

    // The staff schedule only says something once it is used for this studio.
    const staffWeekly = new Map<number, string[]>();
    for (const r of staffTpl.data ?? []) if (r.location === loc) staffWeekly.set(r.weekday, r.staff_ids ?? []);
    const staffDates = new Map<string, string[]>();
    for (const r of staffOvr.data ?? []) if (r.location === loc) staffDates.set(r.date, r.staff_ids ?? []);
    const staffInUse = [...staffWeekly.values()].some((ids) => ids.length > 0);

    const busyByDate = new Map<string, Busy[]>();
    for (const r of (res.data ?? []) as Busy[]) {
      if (r.location !== loc) continue;
      const list = busyByDate.get(r.date) ?? [];
      list.push(r);
      busyByDate.set(r.date, list);
    }

    const days: DayLoad[] = [];
    for (let i = 0; i < BRIEF_DAYS; i++) {
      const date = addDays(today, i);
      const busy = busyByDate.get(date) ?? [];
      const staff = staffDates.get(date) ?? staffWeekly.get(mondayIndex(date)) ?? [];
      const windows = resolveWindows(date, hours) ?? [];
      const noStaff = staffInUse && staff.length === 0;
      const perLaser = laserDays(date, hours).map(({ laser, windows: own }) => {
        const mine = busy.filter((b) => laserOf(b) === laser);
        return dayLoad(
          date,
          own,
          mine.map((b): [number, number] => [toMinutes(b.start_time), toMinutes(b.end_time)]),
          mine.length,
          i === 0 ? nowMinute : 0,
          noStaff,
        );
      });
      days.push(mergeLoads(date, perLaser, busy.length, windows, noStaff));
    }
    return {
      location: loc,
      days,
      open: days.reduce((s, d) => s + d.open, 0),
      booked: days.reduce((s, d) => s + d.booked, 0),
    };
  });
}

export async function loadFacts(db: AdminDb): Promise<InfyFacts> {
  const { data, error } = await db.rpc("infy_facts", { p_return_weeks: RETURN_WEEKS });
  if (error || !data || typeof data !== "object" || (data as { status?: string }).status === "forbidden") {
    throw new Error("facts load failed");
  }
  return data as unknown as InfyFacts;
}

/** "62%" of the working time booked; "-" when there is none. */
export function pct(booked: number, open: number): string {
  return open > 0 ? `${Math.round((booked / open) * 100)}%` : "-";
}
