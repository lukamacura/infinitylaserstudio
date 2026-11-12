/**
 * Belgrade's calendar for Infy - the server runs in UTC, the studio does not.
 * Dates are "YYYY-MM-DD", times "HH:MM". Safe on server and client.
 */

const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit",
});
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false,
});

export const SR_WEEKDAYS = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"];
export const SR_WEEKDAYS_SHORT = ["pon", "uto", "sre", "čet", "pet", "sub", "ned"];
const SR_MONTHS_GEN = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

/** Today in Belgrade. */
export function belgradeToday(now = new Date()): string {
  return DAY.format(now);
}

/** Minutes since midnight in Belgrade. */
export function belgradeMinutes(now = new Date()): number {
  const [h, m] = CLOCK.format(now).split(":").map(Number);
  return (h % 24) * 60 + m;
}

export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function mondayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** "Utorak, 17. novembar" */
export function longDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const w = SR_WEEKDAYS[mondayIndex(date)];
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}, ${d.getUTCDate()}. ${SR_MONTHS_GEN[d.getUTCMonth()]}`;
}

/** "uto 17.11." */
export function shortDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${SR_WEEKDAYS_SHORT[mondayIndex(date)]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** "danas", "sutra", "juče" or "uto 17.11." */
export function relativeDay(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "danas";
  if (diff === 1) return "sutra";
  if (diff === -1) return "juče";
  return shortDay(date);
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
