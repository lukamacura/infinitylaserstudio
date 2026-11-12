/**
 * Upiti - the call list: people who wrote (Instagram, Facebook...) and left a
 * phone number for the doctor to call back. Types and every call /upiti makes.
 * The table and the list function live in sql/upiti.sql.
 */
import { supabase } from "./supabase";
import { fmtDayMonth } from "./kartoni";

export type UpitSource = "instagram" | "facebook" | "tiktok" | "viber" | "telefon" | "drugo";
export type UpitStatus = "open" | "booked" | "declined";

export const UPIT_SOURCES: readonly { key: UpitSource; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "viber", label: "Viber" },
  { key: "telefon", label: "Telefon" },
  { key: "drugo", label: "Drugo" },
];

export function sourceLabel(source: UpitSource): string {
  return UPIT_SOURCES.find((s) => s.key === source)?.label ?? "Drugo";
}

export type Upit = {
  id: string;
  name: string;
  phone: string | null;
  source: UpitSource;
  note: string;
  /** As shown: a booking found by phone turns an open one into booked. */
  status: UpitStatus;
  /** As the doctor marked it. */
  saved_status: UpitStatus;
  attempts: number;
  last_call_at: string | null;
  created_at: string;
  done_at: string | null;
  karton_id: string | null;
  karton_number: number | null;
  karton_name: string | null;
  booked_date: string | null;
  booked_time: string | null;
  /** The booking was made after the inquiry - they booked. False: one they already had. */
  booked_after: boolean;
  /** A follow-up day set by hand (or by Infy); null = the default. */
  remind_on: string | null;
  /** When Infy brings them up: remind_on, or 3 days after the inquiry / the last contact. */
  due_on: string;
  total: number;
};

export type UpitDraft = {
  name: string;
  phone: string;
  source: UpitSource;
  note: string;
};

export const DONE_PAGE_SIZE = 30;

// ── Formatting ────────────────────────────────────────────────────────────────

const BELGRADE_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit",
});
const BELGRADE_TIME = new Intl.DateTimeFormat("sr-RS", {
  timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** A moment as "2026-11-09", Belgrade's calendar. */
export function belgradeDay(iso: string): string {
  return BELGRADE_DAY.format(new Date(iso));
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/** "danas 14:20", "juče 9:05", "7.11. 18:40" - when the last call was. */
export function fmtWhen(iso: string, now = new Date()): string {
  const day = belgradeDay(iso);
  const diff = dayDiff(belgradeDay(now.toISOString()), day);
  const time = BELGRADE_TIME.format(new Date(iso));
  if (diff === 0) return `danas ${time}`;
  if (diff === 1) return `juče ${time}`;
  return `${fmtDayMonth(day)} ${time}`;
}

/** How long someone has been waiting for a call, in days (0 = written in today). */
export function waitingDays(iso: string, now = new Date()): number {
  return dayDiff(belgradeDay(now.toISOString()), belgradeDay(iso));
}

/** "tel:" for a typed number: digits and a leading + only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Digits only, +381 as 0 - mirrors karton_norm_phone, to spot a number already on the list. */
export function normPhone(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6 || /^(\d)\1+$/.test(d)) return null;
  return d.replace(/^(00)?3810?/, "0");
}

// ── Calls ─────────────────────────────────────────────────────────────────────

/** p_open: who still has to be called (all of them), or the crossed-out ones, a page at a time. */
export async function fetchUpiti(open: boolean, offset = 0): Promise<Upit[]> {
  const { data, error } = await supabase.rpc("upiti_list", {
    p_open: open,
    p_limit: open ? 500 : DONE_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as Upit[];
}

export async function fetchUpitiOpenCount(): Promise<number> {
  const { data, error } = await supabase.rpc("upiti_open_count");
  if (error) throw error;
  return data ?? 0;
}

function row(draft: UpitDraft) {
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim() || null,
    source: draft.source,
    note: draft.note.trim(),
  };
}

export async function addUpit(draft: UpitDraft): Promise<void> {
  const { error } = await supabase.from("upiti").insert(row(draft));
  if (error) throw error;
}

export async function saveUpit(id: string, draft: UpitDraft): Promise<void> {
  const { error } = await supabase.from("upiti").update(row(draft)).eq("id", id);
  if (error) throw error;
}

/** Crossed out as booked or not interested, or back on the list. */
export async function setUpitStatus(id: string, status: UpitStatus): Promise<void> {
  const { error } = await supabase
    .from("upiti")
    .update({ status, closed_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Called, nobody answered: one more tally mark. */
export async function markNoAnswer(upit: Upit): Promise<void> {
  const { error } = await supabase
    .from("upiti")
    .update({ attempts: Math.min(upit.attempts + 1, 99), last_call_at: new Date().toISOString() })
    .eq("id", upit.id);
  if (error) throw error;
}

/** Takes back the last tally mark - a tap by mistake. */
export async function undoNoAnswer(upit: Upit): Promise<void> {
  const { error } = await supabase
    .from("upiti")
    .update({ attempts: Math.max(upit.attempts - 1, 0) })
    .eq("id", upit.id);
  if (error) throw error;
}

/** The day Infy brings them up again; null = 3 days after the last contact. */
export async function setUpitRemind(id: string, day: string | null): Promise<void> {
  const { error } = await supabase.from("upiti").update({ remind_on: day }).eq("id", id);
  if (error) throw error;
}

/** Staff got in touch (wrote, called): the next reminder is 3 days from now. */
export async function markFollowedUp(id: string): Promise<void> {
  const { error } = await supabase
    .from("upiti")
    .update({ last_call_at: new Date().toISOString(), remind_on: null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUpit(id: string): Promise<void> {
  const { error } = await supabase.from("upiti").delete().eq("id", id);
  if (error) throw error;
}
