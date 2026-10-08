import { supabase } from "./supabase";
import type { LocationId } from "./locations";
import { toDateStr, weekdayOf } from "./availability";

/** One person who can be put on the schedule. Shared by both studios. */
export interface StaffMember {
  id: string;
  name: string;
  active: boolean;
}

export interface StaffSchedule {
  /** Index 0 = Monday … 6 = Sunday → ids of who works that weekday. */
  template: string[][];
  /** "YYYY-MM-DD" → ids of who works that date (an exception; [] = nobody). */
  overrides: Record<string, string[]>;
}

export const EMPTY_STAFF_SCHEDULE: StaffSchedule = {
  template: [[], [], [], [], [], [], []],
  overrides: {},
};

/** Who works on a date: the date's exception if there is one, otherwise the weekly template. */
export function resolveStaff(dateStr: string, schedule: StaffSchedule): string[] {
  return schedule.overrides[dateStr] ?? schedule.template[weekdayOf(dateStr)] ?? [];
}

/** Same people, order ignored. */
export function sameStaff(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Everyone ever added (inactive too, so old schedules can still show a name). */
export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, active")
    .order("created_at");
  if (error) throw new Error("staff load failed");
  return data ?? [];
}

/** One studio's weekly staff template + its exceptions from today on. */
export async function fetchStaffSchedule(location: LocationId): Promise<StaffSchedule> {
  const todayStr = toDateStr(new Date());
  const [tplRes, ovrRes] = await Promise.all([
    supabase.from("staff_weekly").select("weekday, staff_ids").eq("location", location),
    supabase.from("staff_overrides").select("date, staff_ids").eq("location", location).gte("date", todayStr),
  ]);
  if (tplRes.error || ovrRes.error) throw new Error("staff schedule load failed");

  const template: string[][] = [[], [], [], [], [], [], []];
  for (const row of tplRes.data ?? []) {
    if (row.weekday >= 0 && row.weekday <= 6) template[row.weekday] = row.staff_ids ?? [];
  }
  const overrides: Record<string, string[]> = {};
  for (const row of ovrRes.data ?? []) overrides[row.date] = row.staff_ids ?? [];

  return { template, overrides };
}

/**
 * Photos in /public/team, by lowercased first name ("dr " kept for the doctor,
 * so a plain "Ana" on staff doesn't get Dr Ana's photo). Anyone without one gets their initial.
 */
const STAFF_PHOTOS: Record<string, string> = {
  "dr ana": "/team/ana.webp",
  branka: "/team/branka.webp",
  mila: "/team/mila.webp",
  tanja: "/team/tanja.webp",
};

/** Doctor titles, normalised to "dr" ("Dr Ana Kasap" → "dr ana", "Ana" → "ana"). */
const TITLES = new Set(["dr", "dr.", "др", "др."]);

export function staffPhoto(name: string): string | null {
  const words = name.trim().toLowerCase().split(/\s+/);
  const titled = TITLES.has(words[0]);
  const first = titled ? words[1] : words[0];
  const key = titled && first ? `dr ${first}` : first;
  return (key && STAFF_PHOTOS[key]) ?? null;
}

/**
 * Public (booking modal): "YYYY-MM-DD" → first names of who works that day.
 * Days with nobody assigned are absent. Never throws - on failure nothing is shown.
 */
export async function fetchPublicStaffDays(
  location: LocationId, from: string, to: string,
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.rpc("public_staff_days", {
    p_from: from, p_to: to, p_location: location,
  });
  if (error || !data) return {};
  const byDate: Record<string, string[]> = {};
  for (const row of data) if (row.names?.length) byDate[row.date] = row.names;
  return byDate;
}
