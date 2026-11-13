/**
 * Everything Infy can do, as tools the model calls. Server-only; every call
 * runs as the signed-in admin (their session, the tables' admin-only rules).
 *
 * Three kinds:
 *   - reading: people, cards, a day's schedule, free times, the price list,
 *     the brief, the call list;
 *   - small writes that are undone with one tap: writing someone on the call
 *     list ("upiti"), their follow-up day, a confirmation call's outcome;
 *   - proposals for a booking, a move or a cancellation. These change nothing:
 *     the server checks them and returns a signed paper sheet, and only the
 *     staff's "Potvrdi" (app/api/infy/confirm) carries them out.
 */
import { randomUUID } from "node:crypto";
import {
  SLOT_SIZE, calcBookingDuration, calcTotalDuration, getAvailableSlots, pickFreeLaser,
  type BusinessWindow, type LaserDay,
} from "@/lib/supabase";
import {
  buildAvailability, laserDays, resolveWindows, startedLaserDays, type AvailabilityData,
} from "@/lib/availability";
import { SINGLE_LASER, isLaserActive, laserLabel, type Laser } from "@/lib/lasers";
import { escapeLike } from "@/lib/fetchAll";
import { getLocation, isLocationId } from "@/lib/locations";
import { PriceBook } from "@/lib/prices";
import { COMBO_RULES, applyComboRules, isIlsPromoCode, STUDENT_PROMO_CODE } from "@/lib/pricing";
import { loadReservationSheet } from "@/lib/reservationSheet";
import { normPhone } from "@/lib/upiti";
import type { AdminDb } from "@/lib/server/adminDb";
import type { SuccessDiscount } from "@/components/booking/BookingSheet";
import { loadFacts, loadStudioLoads, pct } from "./brief";
import type { ToolSpec } from "./openai";
import { PROPOSAL_TTL_MS, signProposal, type BookPayload, type MovePayload } from "./proposals";
import {
  addDays, belgradeToday, daysBetween, fromMinutes, isIsoDate, longDay, mondayIndex, shortDay, toMinutes,
} from "./time";
import type { InfyCard, InfyLocation, ProposalDisplay } from "./types";

export type ToolContext = {
  db: AdminDb;
  /** Belgrade's today and the minute now, fixed for the whole turn. */
  today: string;
  nowMinute: number;
  /** The studio open in the admin - the default when none is named. */
  location: InfyLocation;
  /** Cards for the panel, collected during the turn. */
  cards: InfyCard[];
  cache: Map<string, unknown>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]0$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = ["instagram", "facebook", "tiktok", "viber", "telefon", "drugo"] as const;
/** Admin bookings outside working hours: the span the admin modal offers. */
const ADMIN_WINDOW: BusinessWindow[] = [{ start: 7 * 60, end: 22 * 60 }];
/** Days slobodni_termini lists at most. */
const FREE_LIST_DAYS = 14;
/** How far ahead the nearest free time is looked for (a busy studio can be full for two weeks). */
const FREE_SEARCH_DAYS = 30;

/** A free start time, as the model gets it. */
export type FreeTime = { datum: string; dan: string; vreme: string };
/** A tool that could not do it. A refused proposal carries the real free times instead. */
export type Fail = { greska: string; najbliza_slobodna?: FreeTime[] };
const fail = (greska: string, najbliza?: FreeTime[]): Fail =>
  najbliza ? { greska, najbliza_slobodna: najbliza } : { greska };

// ── Loading ───────────────────────────────────────────────────────────────────

type Svc = { id: string; name: string; gender: string; active: boolean; service_duration: number; sort_order: number; price: number };

async function cached<T>(ctx: ToolContext, key: string, load: () => Promise<T>): Promise<T> {
  if (ctx.cache.has(key)) return ctx.cache.get(key) as T;
  const value = await load();
  ctx.cache.set(key, value);
  return value;
}

/** Every treatment, with its price list. */
function catalog(ctx: ToolContext): Promise<{ services: Svc[]; book: PriceBook }> {
  return cached(ctx, "catalog", async () => {
    const [svc, prices] = await Promise.all([
      ctx.db.from("services").select("id, name, gender, active, service_duration, sort_order, price").order("sort_order"),
      ctx.db.from("service_prices").select("service_id, location, price, valid_from"),
    ]);
    if (svc.error || prices.error || !svc.data || !prices.data) throw new Error("catalog");
    return {
      services: svc.data as Svc[],
      book: new PriceBook(prices.data.map((p) => ({ ...p, price: Number(p.price) }))),
    };
  });
}

/**
 * Every laser and each laser's own working hours (sql/lasers_phase1.sql),
 * read once per turn.
 */
function schedule(ctx: ToolContext) {
  return cached(ctx, "schedule", async () => {
    const [tpl, ovr, lasers] = await Promise.all([
      ctx.db.from("weekly_schedule").select("weekday, windows, location, laser"),
      ctx.db.from("availability_overrides").select("date, windows, location, laser").gte("date", ctx.today),
      ctx.db.from("lasers").select("location, laser, name, active_from").order("laser"),
    ]);
    if (tpl.error || ovr.error) throw new Error("schedule");
    return { tpl: tpl.data ?? [], ovr: ovr.data ?? [], lasers: (lasers.error ? null : lasers.data) ?? [] };
  });
}

/**
 * A studio's lasers, lowest number first (Novi Sad: Stari, Novi). Lasers that
 * cannot be read count as one - fewer free times, never one the database
 * would refuse.
 */
async function lasersOf(ctx: ToolContext, location: string): Promise<Laser[]> {
  const mine = (await schedule(ctx)).lasers.filter((l) => l.location === location);
  return mine.length ? mine : SINGLE_LASER;
}

async function studioHours(ctx: ToolContext, location: string): Promise<AvailabilityData> {
  const all = await schedule(ctx);
  return buildAvailability(
    await lasersOf(ctx, location),
    all.tpl.filter((r) => r.location === location),
    all.ovr.filter((r) => r.location === location),
  );
}

/** "Stari" / "Novi" - only where a studio has more than one laser; elsewhere there is nothing to tell apart. */
function laserName(lasers: Laser[], laser: number | null | undefined): string | null {
  return lasers.length > 1 ? lasers.find((l) => l.laser === (laser ?? 1))?.name ?? null : null;
}

type LaserNames = (location: string, laser: number | null | undefined) => string | null;

/** Names for the bookings a tool lists; none when the hours cannot be read (the list still goes out). */
async function laserNames(ctx: ToolContext): Promise<LaserNames> {
  try {
    const all = (await schedule(ctx)).lasers;
    return (loc, laser) => laserName(all.filter((l) => l.location === loc), laser);
  } catch {
    return () => null;
  }
}

/**
 * The laser the staff asked for - its number or its name ("Novi"). undefined:
 * none asked, or the studio has one laser (nothing to choose); a Fail for a
 * laser the studio does not have.
 */
function askedLaser(raw: unknown, lasers: Laser[], loc: string): number | undefined | Fail {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const text = typeof raw === "string" ? raw.trim().toLowerCase() : null;
  const found = lasers.find((l) =>
    l.laser === raw || String(l.laser) === text || l.name.toLowerCase() === text || laserLabel(l).toLowerCase() === text);
  if (!found) {
    return fail(lasers.length > 1
      ? `Nepoznat laser. ${studioName(loc)}: ${lasers.map((l) => `${l.laser} = ${l.name}`).join(", ")}.`
      : `${studioName(loc)} ima jedan laser - izostavi laser.`);
  }
  return lasers.length > 1 ? found.laser : undefined;
}

/** A laser that has not started by `date`: why it can't be booked. */
function notStarted(l: Laser, date: string): Fail | null {
  return isLaserActive(l, date) ? null : fail(`${laserLabel(l)} prima termine od ${shortDay(l.active_from as string)}.`);
}

/** "Stari 09:00–20:00 · Novi 12:00–18:00" - each laser's own hours on a date. */
function hoursByLaser(date: string, hours: AvailabilityData): string {
  return hours.lasers.map((l) => {
    if (!isLaserActive(l, date)) return `${l.name} počinje ${shortDay(l.active_from as string)}`;
    const own = resolveWindows(date, hours, l.laser);
    return `${l.name} ${own ? fmtWindows(own) : "ne radi"}`;
  }).join(" · ");
}

/** "Novi Sad · Novi laser (bio Stari)" - the laser only where there is more than one; `from`: the one it leaves. */
function studioLine(loc: string, lasers: Laser[], laser: number, from?: number | null): string {
  const to = lasers.length > 1 ? lasers.find((l) => l.laser === laser) : undefined;
  if (!to) return studioName(loc);
  const was = from != null && from !== laser ? lasers.find((l) => l.laser === from) : undefined;
  return `${studioName(loc)} · ${laserLabel(to)}${was ? ` (bio ${was.name})` : ""}`;
}

function within(windows: BusinessWindow[], start: number, end: number): boolean {
  return windows.some((w) => start >= w.start && end <= w.end);
}

type Busy = { id: string; date: string; start_time: string; end_time: string; location: string; customer_name: string; laser: number | null };

async function busyBetween(ctx: ToolContext, location: string, from: string, to: string): Promise<Busy[]> {
  const { data, error } = await ctx.db.from("reservations")
    .select("id, date, start_time, end_time, location, customer_name, laser")
    .eq("location", location).gte("date", from).lte("date", to)
    .in("status", ["pending", "confirmed"]);
  if (error) throw new Error("busy");
  return (data ?? []) as Busy[];
}

function fmtWindows(w: BusinessWindow[]): string {
  return w.length ? w.map((x) => `${fromMinutes(x.start)}–${fromMinutes(x.end)}`).join(", ") : "zatvoreno";
}

/**
 * A laser works for the whole of [start, end) and is free then - otherwise
 * the booking falls outside working hours (the admin may still make it).
 */
function freeInHours(busy: Busy[], lasers: LaserDay[], date: string, start: number, end: number, except?: string): boolean {
  const day = busy.filter((b) => b.id !== except && b.date === date).map((b) => ({ ...b, status: "confirmed" }));
  return pickFreeLaser(day, start, end, lasers) !== null;
}

function studioName(loc: string): string {
  return isLocationId(loc) ? getLocation(loc).name : loc;
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

type ResRow = {
  id: string; customer_name: string; customer_phone: string | null; customer_email: string;
  date: string; start_time: string; end_time: string; total_duration: number; status: string;
  location: string; laser: number | null; call_status: string; notes: string | null;
  reservation_services: { services: { name: string } | null }[];
};
const RES_COLUMNS =
  "id, customer_name, customer_phone, customer_email, date, start_time, end_time, total_duration, status, location, laser, call_status, notes, reservation_services(services(name))";

/** `names`: the laser it is on, in a studio with more than one. */
function resForModel(r: ResRow, names?: LaserNames) {
  const laser = names?.(r.location, r.laser) ?? null;
  return {
    id: r.id,
    ime: r.customer_name,
    telefon: r.customer_phone,
    email: r.customer_email || null,
    studio: r.location,
    datum: r.date,
    dan: shortDay(r.date),
    vreme: `${hhmm(r.start_time)}–${hhmm(r.end_time)}`,
    ...(laser ? { laser } : {}),
    usluge: r.reservation_services.map((x) => x.services?.name).filter(Boolean),
    status: r.status,
    potvrdni_poziv: r.call_status,
    ...(r.notes ? { napomena: r.notes.slice(0, 200) } : {}),
  };
}

// ── Reading ───────────────────────────────────────────────────────────────────

async function findPeople(ctx: ToolContext, a: { upit?: unknown }) {
  const q = typeof a.upit === "string" ? a.upit.trim().slice(0, 80) : "";
  if (q.length < 2) return fail("Upit za pretragu je prekratak.");
  const digits = q.replace(/\D/g, "");
  const isPhone = digits.length >= 6 && /^[\d\s+()/.-]+$/.test(q);
  const phone = isPhone ? normPhone(q) : null;

  const [cards, leads] = await Promise.all([
    ctx.db.rpc("karton_search", { p_query: q, p_limit: 6, p_offset: 0 }),
    (phone
      ? ctx.db.from("upiti").select("id, name, phone, source, note, status, created_at, remind_on, last_call_at").eq("phone_norm", phone)
      : ctx.db.from("upiti").select("id, name, phone, source, note, status, created_at, remind_on, last_call_at").ilike("name", `%${escapeLike(q)}%`)
    ).order("created_at", { ascending: false }).limit(6),
  ]);

  const clientIds = (cards.data ?? []).map((k) => k.client_id);
  const byName = phone
    ? ctx.db.from("reservations").select(RES_COLUMNS).ilike("customer_phone", `%${digits.slice(-8)}%`)
    : ctx.db.from("reservations").select(RES_COLUMNS).ilike("customer_name", `%${escapeLike(q)}%`);
  const [named, carded, names] = await Promise.all([
    byName.gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(10),
    clientIds.length
      ? ctx.db.from("reservations").select(RES_COLUMNS).in("client_id", clientIds)
          .gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(10)
      : Promise.resolve({ data: [], error: null }),
    laserNames(ctx),
  ]);
  const seen = new Set<string>();
  const upcoming = [...((named.data ?? []) as unknown as ResRow[]), ...((carded.data ?? []) as unknown as ResRow[])]
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((x, y) => (x.date + x.start_time).localeCompare(y.date + y.start_time))
    .slice(0, 10)
    .map((r) => resForModel(r, names));

  return {
    kartoni: (cards.data ?? []).map((k) => ({
      karton_id: k.karton_id, broj: k.number, ime: k.name, telefon: k.phone, email: k.email,
      broj_dolazaka: k.rows_count, poslednji_dolazak: k.last_date, sledeci_termin: k.next_date,
    })),
    upiti: (leads.data ?? []).map((u) => ({
      id: u.id, ime: u.name, telefon: u.phone, izvor: u.source, beleska: u.note, status: u.status,
      upisano: u.created_at.slice(0, 10), podseti: u.remind_on,
    })),
    zakazani_termini: upcoming,
  };
}

async function kartonDetails(ctx: ToolContext, a: { karton_id?: unknown }) {
  if (typeof a.karton_id !== "string" || !UUID_RE.test(a.karton_id)) return fail("Neispravan karton_id.");
  const [k, rows] = await Promise.all([
    ctx.db.from("kartoni").select("id, number, note, client_id, clients(name, phone, email, gender)").eq("id", a.karton_id).maybeSingle(),
    ctx.db.from("karton_rows").select("date, location, karton_entries(region, energy_j, planned)")
      .eq("karton_id", a.karton_id).order("date", { ascending: false }).limit(12),
  ]);
  if (k.error || !k.data) return fail("Karton nije pronađen.");
  const card = k.data as unknown as {
    id: string; number: number; note: string; client_id: string;
    clients: { name: string; phone: string | null; email: string | null; gender: string | null } | null;
  };
  const [upcoming, names] = await Promise.all([
    ctx.db.from("reservations").select(RES_COLUMNS).eq("client_id", card.client_id)
      .gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(5),
    laserNames(ctx),
  ]);
  return {
    karton_id: card.id,
    broj: card.number,
    ime: card.clients?.name,
    telefon: card.clients?.phone,
    email: card.clients?.email,
    pol: card.clients?.gender,
    beleska: card.note ? card.note.slice(0, 600) : "",
    tretmani: ((rows.data ?? []) as unknown as { date: string; location: string; karton_entries: { region: string; energy_j: number | null; planned: boolean }[] }[])
      .map((r) => ({
        datum: r.date,
        studio: r.location,
        regije: r.karton_entries.map((e) => (e.energy_j != null ? `${e.region} ${e.energy_j}J` : e.region)),
      })),
    zakazani_termini: ((upcoming.data ?? []) as unknown as ResRow[]).map((r) => resForModel(r, names)),
  };
}

async function daySchedule(ctx: ToolContext, a: { datum?: unknown; studio?: unknown }) {
  if (!isIsoDate(a.datum)) return fail("Neispravan datum (YYYY-MM-DD).");
  const date = a.datum;
  const locs = isLocationId(a.studio) ? [a.studio] : (["novi_sad", "sombor"] as const);
  const [res, staff, staffTpl, staffOvr] = await Promise.all([
    ctx.db.from("reservations").select(RES_COLUMNS).eq("date", date).in("location", [...locs]).order("start_time"),
    ctx.db.from("staff").select("id, name"),
    ctx.db.from("staff_weekly").select("weekday, staff_ids, location").eq("weekday", mondayIndex(date)),
    ctx.db.from("staff_overrides").select("date, staff_ids, location").eq("date", date),
  ]);
  if (res.error) return fail("Raspored nije učitan.");
  const names = new Map((staff.data ?? []).map((s) => [s.id, s.name]));
  const lasers = await laserNames(ctx);
  const rows = (res.data ?? []) as unknown as ResRow[];
  const out = [];
  for (const loc of locs) {
    const ids = staffOvr.data?.find((o) => o.location === loc)?.staff_ids
      ?? staffTpl.data?.find((t) => t.location === loc)?.staff_ids ?? [];
    const mine = rows.filter((r) => r.location === loc);
    const hours = await studioHours(ctx, loc);
    out.push({
      studio: loc,
      radno_vreme: fmtWindows(resolveWindows(date, hours) ?? []),
      // Each laser's own hours, where there is more than one.
      ...(hours.lasers.length > 1 ? { laseri: hoursByLaser(date, hours) } : {}),
      radi: ids.map((id) => names.get(id)).filter(Boolean),
      termini: mine.filter((r) => r.status === "pending" || r.status === "confirmed").map((r) => resForModel(r, lasers)),
      otkazano: mine.filter((r) => r.status === "cancelled").map((r) => `${r.customer_name} ${hhmm(r.start_time)}`),
    });
  }
  return { datum: date, dan: longDay(date), studiji: out };
}

/** How long a booking of these treatments takes; null when an id is unknown. */
async function durationOf(ctx: ToolContext, ids: string[], newClient: boolean): Promise<{ minutes: number; svcs: Svc[] } | null> {
  const { services } = await catalog(ctx);
  const svcs = ids.map((id) => services.find((s) => s.id === id));
  if (svcs.some((s) => !s)) return null;
  const list = svcs as Svc[];
  return { minutes: newClient ? calcBookingDuration(list) : calcTotalDuration(list), svcs: list };
}

type FreeOpts = {
  minutes: number;
  /** The admin span instead of working hours. */
  anyHour?: boolean;
  /** Start no earlier than / end by, in minutes. */
  after?: number | null;
  before?: number | null;
  /** A booking being moved does not stand in its own way. */
  exceptId?: string;
  /** Only this laser - the staff asked for it. */
  laser?: number;
};
type FreeDay = { date: string; windows: BusinessWindow[]; slots: string[] };

/**
 * Free start times on each day from..to - the same check the proposals make
 * (getAvailableSlots and clashWith both treat touching bookings as free).
 */
async function freeByDay(ctx: ToolContext, loc: string, from: string, to: string, o: FreeOpts): Promise<FreeDay[]> {
  const busy = (await busyBetween(ctx, loc, from, to)).filter((b) => b.id !== o.exceptId);
  const hours = await studioHours(ctx, loc);
  const days: FreeDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const windows = o.anyHour ? ADMIN_WINDOW : resolveWindows(date, hours, o.laser) ?? [];
    // Each laser within its own hours - or, for the admin span, any started laser.
    const lasers = (o.anyHour
      ? startedLaserDays(date, hours).map((d) => ({ laser: d.laser, windows: ADMIN_WINDOW }))
      : laserDays(date, hours)
    ).filter((d) => o.laser === undefined || d.laser === o.laser);
    const slots = lasers.length
      ? getAvailableSlots(
          busy.filter((b) => b.date === date).map((b) => ({ ...b, status: "confirmed" })),
          o.minutes, date === ctx.today ? ctx.nowMinute : undefined, lasers,
        ).filter((s) => {
          const m = toMinutes(s);
          return (o.after == null || m >= o.after) && (o.before == null || m + o.minutes <= o.before);
        })
      : [];
    days.push({ date, windows, slots });
  }
  return days;
}

/** The start of each free stretch, earliest first - what to offer for a taken time. */
function gapStarts(days: FreeDay[], count: number): FreeTime[] {
  const out: FreeTime[] = [];
  for (const d of days) {
    let prev = -Infinity;
    for (const s of d.slots) {
      const m = toMinutes(s);
      if (m - prev > SLOT_SIZE) {
        out.push({ datum: d.date, dan: shortDay(d.date), vreme: s });
        if (out.length >= count) return out;
      }
      prev = m;
    }
  }
  return out;
}

/** The nearest free times from a day on (from now, when it is today), in working hours. */
async function nearestFree(ctx: ToolContext, loc: string, date: string, o: FreeOpts, count = 4): Promise<FreeTime[]> {
  const from = date < ctx.today ? ctx.today : date;
  return gapStarts(await freeByDay(ctx, loc, from, addDays(from, FREE_SEARCH_DAYS - 1), o), count);
}

async function freeSlots(ctx: ToolContext, a: {
  studio?: unknown; od?: unknown; do?: unknown; usluge_ids?: unknown; trajanje_min?: unknown;
  novi_klijent?: unknown; posle?: unknown; pre?: unknown; van_radnog_vremena?: unknown; laser?: unknown;
}) {
  const loc = isLocationId(a.studio) ? a.studio : ctx.location;
  if (!isIsoDate(a.od)) return fail("Neispravan datum 'od' (YYYY-MM-DD).");
  const hours = await studioHours(ctx, loc);
  const laser = askedLaser(a.laser, hours.lasers, loc);
  if (typeof laser === "object") return laser;
  const from = a.od < ctx.today ? ctx.today : a.od;
  let to = isIsoDate(a.do) && a.do >= from ? a.do : from;
  if (daysBetween(from, to) > FREE_LIST_DAYS - 1) to = addDays(from, FREE_LIST_DAYS - 1);

  const newClient = a.novi_klijent !== false;
  let minutes = 30;
  let guessed = true;
  if (Array.isArray(a.usluge_ids) && a.usluge_ids.length) {
    const d = await durationOf(ctx, a.usluge_ids.filter((x): x is string => typeof x === "string"), newClient);
    if (!d) return fail("Nepoznat id usluge - pozovi 'usluge'.");
    minutes = d.minutes;
    guessed = false;
  } else if (typeof a.trajanje_min === "number" && a.trajanje_min >= 10 && a.trajanje_min <= 300) {
    minutes = Math.ceil(a.trajanje_min / 10) * 10;
    guessed = false;
  }
  const opts: FreeOpts = {
    minutes,
    anyHour: a.van_radnog_vremena === true,
    after: typeof a.posle === "string" && /^\d{1,2}:\d{2}$/.test(a.posle) ? toMinutes(a.posle) : null,
    before: typeof a.pre === "string" && /^\d{1,2}:\d{2}$/.test(a.pre) ? toMinutes(a.pre) : null,
    laser,
  };
  // Without a laser asked, each day's hours are told per laser (where there is more than one).
  const perLaser = laser === undefined && !opts.anyHour && hours.lasers.length > 1;

  const found = await freeByDay(ctx, loc, from, to, opts);
  // "Najbliži slobodan": the first free time, looked for past 'do' too.
  let first: FreeTime | null = gapStarts(found, 1)[0] ?? null;
  const last = addDays(from, FREE_SEARCH_DAYS - 1);
  if (!first && to < last) first = gapStarts(await freeByDay(ctx, loc, addDays(to, 1), last, opts), 1)[0] ?? null;

  return {
    studio: loc,
    ...(laser !== undefined ? { laser: laserName(hours.lasers, laser) } : {}),
    trajanje_min: minutes,
    novi_klijent: newClient,
    ...(guessed ? { upozorenje: "Trajanje nije zadato - računato je 30 min. Za zakazivanje pozovi ponovo sa usluge_ids." } : {}),
    prvi_slobodan: first ?? `Nema slobodnog termina u narednih ${FREE_SEARCH_DAYS} dana.`,
    dani: found.map((d) => (d.windows.length
      ? {
          datum: d.date,
          dan: shortDay(d.date),
          radno_vreme: perLaser ? hoursByLaser(d.date, hours) : fmtWindows(d.windows),
          termini: d.slots.slice(0, 18),
          ...(d.slots.length > 18 ? { jos: d.slots.length - 18 } : {}),
        }
      : { datum: d.date, dan: shortDay(d.date), zatvoreno: true })),
  };
}

async function serviceList(ctx: ToolContext, a: { pol?: unknown; studio?: unknown }) {
  const gender = a.pol === "muskarci" ? "muskarci" : "zene";
  const loc = isLocationId(a.studio) ? a.studio : ctx.location;
  const { services, book } = await catalog(ctx);
  const comboKeys = COMBO_RULES.map((r) => r.comboKey);
  const priced = book.apply(services.filter((s) => s.active && s.gender === gender), loc);
  return {
    pol: gender,
    studio: loc,
    usluge: priced
      .filter((s) => !comboKeys.some((k) => s.name.toLowerCase().includes(k)))
      .map((s) => ({ id: s.id, naziv: s.name, trajanje_min: s.service_duration, cena_rsd: s.price })),
    napomena: "Kombinacije (nausnice+brada, noge+intima, stomak+grudi) se same obračunavaju po paket ceni.",
  };
}

async function briefTool(ctx: ToolContext) {
  const [facts, loads] = await Promise.all([loadFacts(ctx.db), loadStudioLoads(ctx.db)]);
  return {
    danas: ctx.today,
    pozvati_novi_klijenti: facts.calls.map((c) => ({ ...c, dan: shortDay(c.date) })),
    follow_up_upiti: facts.upiti_due,
    upiti_na_spisku: facts.upiti_open,
    zakazano_od_juce: { ukupno: facts.booked_total, sa_sajta: facts.booked_online, lista: facts.booked.slice(0, 25) },
    upiti_koji_su_se_zakazali: facts.upiti_booked,
    klijenti_otkazali_preko_linka: facts.client_cancels,
    vrati_ih: { ukupno: facts.return_total, posle_nedelja: facts.return_weeks, lista: facts.return_due.slice(0, 15) },
    kapacitet_7_dana: loads.map((s) => ({
      studio: s.location,
      popunjenost: pct(s.booked, s.open),
      dani: s.days.map((d) => ({
        datum: d.date, dan: shortDay(d.date), zatvoreno: d.closed, popunjenost: pct(d.booked, d.open),
        termina: d.count, rupe: d.gaps.map((g) => `${g.start}–${g.end}${g.laser ? ` ${g.laser}` : ""}`), bez_osoblja: d.noStaff,
      })),
    })),
    prosla_nedelja: facts.week,
  };
}

async function callList(ctx: ToolContext) {
  const { data, error } = await ctx.db.rpc("upiti_list", { p_open: true, p_limit: 200, p_offset: 0 });
  if (error) return fail("Spisak nije učitan.");
  return {
    upiti: (data ?? []).map((u) => ({
      id: u.id, ime: u.name, telefon: u.phone, izvor: u.source, beleska: u.note,
      upisano: u.created_at.slice(0, 10), podseti: u.due_on, ne_javlja_se_puta: u.attempts,
      karton: u.karton_number,
    })),
  };
}

// ── Small writes (undone with one tap) ────────────────────────────────────────

async function addUpit(ctx: ToolContext, a: { ime?: unknown; telefon?: unknown; izvor?: unknown; beleska?: unknown; podseti_datum?: unknown }) {
  const name = typeof a.ime === "string" ? a.ime.trim().slice(0, 120) : "";
  if (!name) return fail("Fali ime.");
  const phone = typeof a.telefon === "string" && a.telefon.trim() ? a.telefon.trim().slice(0, 40) : null;
  const source = SOURCES.includes(a.izvor as (typeof SOURCES)[number]) ? (a.izvor as string) : "drugo";
  const note = typeof a.beleska === "string" ? a.beleska.trim().slice(0, 1000) : "";
  const remind = isIsoDate(a.podseti_datum) && a.podseti_datum >= ctx.today ? a.podseti_datum : null;

  // Already on the list (same number, or the same name still open): not twice.
  const phoneNorm = phone ? normPhone(phone) : null;
  const existing = await (phoneNorm
    ? ctx.db.from("upiti").select("id, name, status").eq("phone_norm", phoneNorm).eq("status", "open").limit(1)
    : ctx.db.from("upiti").select("id, name, status").ilike("name", escapeLike(name)).eq("status", "open").limit(1));
  if (existing.data?.length) {
    return { vec_postoji: true, id: existing.data[0].id, ime: existing.data[0].name, savet: "Koristi azuriraj_upit." };
  }

  const { data, error } = await ctx.db.from("upiti")
    .insert({ name, phone, source, note, remind_on: remind })
    .select("id, created_at").single();
  if (error || !data) return fail("Upit nije sačuvan.");
  const dueOn = remind ?? addDays(ctx.today, 3);
  ctx.cards.push({ type: "upit", id: data.id, name, source, dueOn, created: true, note });
  return { ok: true, id: data.id, podsetnik: dueOn, dan: shortDay(dueOn) };
}

async function updateUpit(ctx: ToolContext, a: { id?: unknown; podseti_datum?: unknown; status?: unknown; beleska?: unknown; javio_se?: unknown }) {
  if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return fail("Neispravan id upita.");
  const patch: { remind_on?: string | null; status?: string; closed_at?: string | null; note?: string; last_call_at?: string } = {};
  if (a.podseti_datum === null) patch.remind_on = null;
  else if (isIsoDate(a.podseti_datum)) patch.remind_on = a.podseti_datum;
  if (a.status === "open" || a.status === "booked" || a.status === "declined") {
    patch.status = a.status;
    patch.closed_at = a.status === "open" ? null : new Date().toISOString();
  }
  if (typeof a.beleska === "string") patch.note = a.beleska.trim().slice(0, 1000);
  if (a.javio_se === true) {
    patch.last_call_at = new Date().toISOString();
    if (patch.remind_on === undefined) patch.remind_on = null;
  }
  if (Object.keys(patch).length === 0) return fail("Nema izmena.");
  const { data, error } = await ctx.db.from("upiti").update(patch).eq("id", a.id)
    .select("id, name, source, note, remind_on, last_call_at, created_at").single();
  if (error || !data) return fail("Upit nije pronađen ili nije sačuvan.");
  const dueOn = data.remind_on ?? addDays(belgradeToday(new Date(data.last_call_at ?? data.created_at)), 3);
  ctx.cards.push({ type: "upit", id: data.id, name: data.name, source: data.source, dueOn, created: false, note: data.note });
  return { ok: true, sledeci_podsetnik: dueOn };
}

async function markCall(ctx: ToolContext, a: { rezervacija_id?: unknown; ishod?: unknown }) {
  if (typeof a.rezervacija_id !== "string" || !UUID_RE.test(a.rezervacija_id)) return fail("Neispravan id termina.");
  const answered = a.ishod === "javio_se";
  if (!answered && a.ishod !== "ne_javlja_se") return fail("Ishod je javio_se ili ne_javlja_se.");
  const { error } = await ctx.db.from("reservations")
    .update(answered ? { call_status: "answered" } : { call_status: "no_answer", call_attempted_at: new Date().toISOString() })
    .eq("id", a.rezervacija_id);
  return error ? fail("Nije sačuvano.") : { ok: true };
}

// ── Proposals ─────────────────────────────────────────────────────────────────

function regionProblem(names: string[]): string | null {
  const n = names.map((x) => x.toLowerCase());
  if (n.some((x) => x.includes("celo telo")) &&
      n.some((x) => !x.includes("celo telo") && !["nausnice", "brada", "celo lice"].some((k) => x.includes(k)))) {
    return "Uz celo telo mogu samo nausnice, brada i celo lice - ostale regije su već u celom telu.";
  }
  if (n.some((x) => x.includes("celo lice")) &&
      n.some((x) => !x.includes("celo lice") && ["nausnice", "brada"].some((k) => x.includes(k)))) {
    return "Celo lice već pokriva nausnice i bradu.";
  }
  return null;
}

/** Is this a returning client? Confirmed bookings by email, phone or card. */
async function isReturning(ctx: ToolContext, email: string, phone: string | null, kartonId: string | null): Promise<boolean> {
  if (email) {
    const { count } = await ctx.db.from("reservations").select("id", { count: "exact", head: true })
      .ilike("customer_email", escapeLike(email)).eq("status", "confirmed");
    if ((count ?? 0) > 0) return true;
  }
  const norm = phone ? normPhone(phone) : null;
  if (norm) {
    const { data } = await ctx.db.from("clients").select("id").eq("phone_norm", norm).limit(5);
    const ids = (data ?? []).map((c) => c.id);
    if (ids.length) {
      const { count } = await ctx.db.from("reservations").select("id", { count: "exact", head: true })
        .in("client_id", ids).eq("status", "confirmed");
      if ((count ?? 0) > 0) return true;
    }
  }
  if (kartonId) {
    const { count } = await ctx.db.from("karton_rows").select("id", { count: "exact", head: true })
      .eq("karton_id", kartonId).lt("date", ctx.today);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

/**
 * The booking in the way of [start, end): none while one of `lasers` (started
 * ones, or just the one asked for) is free for the whole time, in its hours or
 * not - the admin rule of free_laser (sql/lasers_phase1.sql). With every one
 * taken, the first booking overlapping on them.
 */
function clashWith(busy: Busy[], lasers: LaserDay[], date: string, start: number, end: number, except?: string): Busy | undefined {
  const day = busy.filter((b) => b.id !== except && b.date === date);
  if (pickFreeLaser(day.map((b) => ({ ...b, status: "confirmed" })), start, end, lasers, { anyHour: true }) !== null) return undefined;
  return day.find((b) =>
    lasers.some((l) => l.laser === (b.laser ?? 1)) && toMinutes(b.start_time) < end && toMinutes(b.end_time) > start);
}

/**
 * The laser a booking of [start, end) gets in the database: the one asked
 * for, else free_laser's admin rule - a free one that works then first,
 * `prefer` (its own, for a move) before the other, Stari before Novi.
 */
function landingLaser(
  busy: Busy[], lasers: LaserDay[], date: string, start: number, end: number,
  o: { asked?: number; prefer?: number; except?: string },
): number {
  if (o.asked !== undefined) return o.asked;
  const day = busy.filter((b) => b.id !== o.except && b.date === date).map((b) => ({ ...b, status: "confirmed" }));
  return pickFreeLaser(day, start, end, lasers, { prefer: o.prefer, anyHour: true }) ?? o.prefer ?? lasers[0]?.laser ?? 1;
}

/**
 * "Van radnog vremena" for [start, end): outside the asked laser's own hours,
 * or - none asked - with no laser that works then and is free.
 */
function hoursWarning(
  busy: Busy[], hours: AvailabilityData, date: string, start: number, end: number, asked: number | undefined, except?: string,
): string | null {
  if (asked !== undefined) {
    const own = resolveWindows(date, hours, asked) ?? [];
    if (within(own, start, end)) return null;
    const l = hours.lasers.find((x) => x.laser === asked);
    return `Van radnog vremena - ${l ? laserLabel(l) : "laser"}: ${own.length ? fmtWindows(own) : "ne radi tog dana"}`;
  }
  if (freeInHours(busy, laserDays(date, hours), date, start, end, except)) return null;
  return `Van radnog vremena (${hours.lasers.length > 1 ? hoursByLaser(date, hours) : fmtWindows(resolveWindows(date, hours) ?? [])})`;
}

function pushProposal(ctx: ToolContext, token: string, subject: string, display: ProposalDisplay) {
  // A newer proposal for the same thing replaces the one before it in this turn.
  const i = ctx.cards.findIndex((c) => c.type === "proposal" && c.subject === subject);
  if (i >= 0) ctx.cards.splice(i, 1);
  ctx.cards.push({ type: "proposal", token, subject, display, expiresAt: Date.now() + PROPOSAL_TTL_MS });
}

async function proposeBooking(ctx: ToolContext, a: {
  studio?: unknown; datum?: unknown; vreme?: unknown; usluge_ids?: unknown; ime?: unknown;
  telefon?: unknown; email?: unknown; karton_id?: unknown; novi_klijent?: unknown;
  promo_kod?: unknown; napomena?: unknown; laser?: unknown;
}) {
  const loc = isLocationId(a.studio) ? a.studio : ctx.location;
  if (!isIsoDate(a.datum)) return fail("Neispravan datum (YYYY-MM-DD).");
  if (typeof a.vreme !== "string" || !TIME_RE.test(a.vreme)) return fail("Vreme mora biti HH:MM, na 10 minuta.");
  const date = a.datum;
  const start = toMinutes(a.vreme);
  const hours = await studioHours(ctx, loc);
  const asked = askedLaser(a.laser, hours.lasers, loc);
  if (typeof asked === "object") return asked;
  const askedRow = hours.lasers.find((l) => l.laser === asked);
  const off = askedRow ? notStarted(askedRow, date) : null;
  if (off) return off;
  const ids = Array.isArray(a.usluge_ids) ? [...new Set(a.usluge_ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))] : [];
  if (!ids.length || ids.length > 20) return fail("Fale usluge (id-jevi iz alata 'usluge').");

  // The client: from the card when one is named, then what was said.
  const kartonId = typeof a.karton_id === "string" && UUID_RE.test(a.karton_id) ? a.karton_id : null;
  type CardClient = { name: string; phone: string | null; email: string | null };
  let card: CardClient | null = null;
  if (kartonId) {
    const { data } = await ctx.db.from("kartoni").select("clients(name, phone, email)").eq("id", kartonId).maybeSingle();
    card = (data as unknown as { clients: CardClient | null } | null)?.clients ?? null;
    if (!card) return fail("Karton nije pronađen.");
  }
  const name = (typeof a.ime === "string" && a.ime.trim() ? a.ime.trim() : card?.name ?? "").slice(0, 120);
  if (!name) return fail("Fali ime klijenta.");
  const phone = (typeof a.telefon === "string" && a.telefon.trim() ? a.telefon.trim() : card?.phone ?? "").slice(0, 40) || null;
  const email = (typeof a.email === "string" && a.email.trim() ? a.email.trim() : card?.email ?? "").slice(0, 200);
  if (email && !EMAIL_RE.test(email)) return fail("Email nije ispravan.");

  const { services, book } = await catalog(ctx);
  const chosen = ids.map((id) => services.find((s) => s.id === id));
  if (chosen.some((s) => !s || !s.active)) return fail("Nepoznata ili neaktivna usluga - pozovi 'usluge'.");
  const svcs = chosen as Svc[];
  if (new Set(svcs.map((s) => s.gender)).size > 1) return fail("Usluge moraju biti za isti pol.");
  const problem = regionProblem(svcs.map((s) => s.name));
  if (problem) return fail(problem);

  const returning = typeof a.novi_klijent === "boolean" ? !a.novi_klijent : await isReturning(ctx, email, phone, kartonId);
  const minutes = returning ? calcTotalDuration(svcs) : calcBookingDuration(svcs);
  const end = start + minutes;
  if (end >= 24 * 60) return fail("Termin bi trajao posle ponoći.");

  // Taken or past: the real free times for this length go back with the
  // refusal, so the next try is never a guess (the end of the booking in the
  // way is often not free - the next one starts right there).
  if (date < ctx.today || (date === ctx.today && start < ctx.nowMinute - 5)) {
    return fail("To vreme je prošlo.", await nearestFree(ctx, loc, date, { minutes, laser: asked }));
  }
  const busy = await busyBetween(ctx, loc, date, date);
  // The laser asked for, or any started one.
  const started = startedLaserDays(date, hours).filter((d) => asked === undefined || d.laser === asked);
  const clash = clashWith(busy, started, date, start, end);
  if (clash) {
    return fail(
      `${a.vreme}–${fromMinutes(end)} (${minutes} min) se preklapa sa: ${clash.customer_name} ${hhmm(clash.start_time)}–${hhmm(clash.end_time)}${askedRow ? ` (${laserLabel(askedRow)})` : ""}.`,
      await nearestFree(ctx, loc, date, { minutes, laser: asked }),
    );
  }
  const laser = landingLaser(busy, started, date, start, end, { asked });

  // Price: this studio's list today, combos applied, then the code.
  const gender = svcs[0].gender;
  const all = book.apply(services.filter((s) => s.active && s.gender === gender), loc);
  const priced = book.apply(svcs, loc);
  if (priced.length !== svcs.length) return fail("Neka usluga nema cenu u ovom studiju.");
  const effective = applyComboRules(priced, all);
  const list = effective.reduce((sum, s) => sum + s.price, 0);
  const rawCode = typeof a.promo_kod === "string" ? a.promo_kod.trim().toLowerCase() : "";
  let promo: string | null = null;
  let finalPrice = list;
  let discount: SuccessDiscount = null;
  const notes: string[] = [];
  if (typeof a.napomena === "string" && a.napomena.trim()) notes.push(a.napomena.trim().slice(0, 300));
  if (rawCode) {
    if (rawCode === STUDENT_PROMO_CODE || rawCode === "student") {
      promo = STUDENT_PROMO_CODE;
      finalPrice = Math.round(list * 0.8);
      discount = { kind: "student" };
      notes.push("STUDENTSKI POPUST −20% - proveri indeks pri dolasku!");
    } else if (isIlsPromoCode(rawCode)) {
      promo = rawCode;
      finalPrice = Math.round(list * 0.9);
      discount = { kind: "promo" };
    } else {
      return fail("Kroz Infy idu samo student20 i ils- kodovi. Pakete zakaži kroz '+ Novi termin'.");
    }
  }

  const warnings: string[] = [];
  const outside = hoursWarning(busy, hours, date, start, end, asked);
  if (outside) warnings.push(outside);
  if (!email && !phone) warnings.push("Nema ni telefona ni emaila");
  else if (!email) warnings.push("Bez emaila - potvrda se ne šalje");
  if (promo === STUDENT_PROMO_CODE && returning) warnings.push("Klijent već postoji - studentski popust je za prvi tretman");

  const payload: BookPayload = {
    k: "book", id: randomUUID(), loc, date, start: a.vreme, svc: ids, name, email, phone,
    cons: !returning, promo, notes: notes.join(" · ") || null,
    lines: effective.map((s) => ({ name: s.name, price: s.price })), list,
    laser, ...(asked !== undefined ? { force: true } : {}),
    exp: Date.now() + PROPOSAL_TTL_MS,
  };
  const token = signProposal(payload);
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `book:${name.toLowerCase()}`, {
    kind: "book",
    title: name,
    studio: studioLine(loc, hours.lasers, laser),
    date: longDay(date),
    timeRange: `${a.vreme} – ${fromMinutes(end)}`,
    duration: minutes,
    withConsultation: !returning,
    services: effective.map((s) => s.name),
    listTotal: list,
    finalPrice,
    discount,
    movedFrom: null,
    email: email || null,
    emailDefault: !!email,
    phone,
    warnings,
  });
  return {
    ok: true,
    poruka: "Papir sa predlogom je prikazan. Ništa nije zakazano dok osoblje ne pritisne Potvrdi.",
    ...(laserName(hours.lasers, laser) ? { laser: laserName(hours.lasers, laser) } : {}),
    trajanje_min: minutes, sa_konsultacijom: !returning, cena_rsd: finalPrice, upozorenja: warnings,
  };
}

async function loadReservation(ctx: ToolContext, id: unknown): Promise<ResRow | Fail> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return fail("Neispravan id termina.");
  const { data, error } = await ctx.db.from("reservations").select(RES_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return fail("Termin nije pronađen.");
  return data as unknown as ResRow;
}

/** The sheet's price and discount for a saved booking. */
async function sheetPrice(ctx: ToolContext, id: string) {
  const sheet = await loadReservationSheet(ctx.db, id);
  if (!sheet) return { services: null, withConsultation: false, listTotal: 0, finalPrice: null, discount: null as SuccessDiscount };
  const d = sheet.discount;
  const discount: SuccessDiscount =
    d === "student" ? { kind: "student" }
    : d === "link" ? { kind: "link" }
    : d === "gift" ? { kind: "gift" }
    : d === "promo" ? { kind: "promo" }
    : d === "bundle_redeem" ? { kind: "redeem" }
    : d === "bundle" && sheet.bundleSessions
      ? { kind: "bundle", size: sheet.bundleSessions, pct: sheet.listPrice > 0 ? Math.round((1 - sheet.finalPrice / sheet.listPrice) * 100) : 0 }
      : null;
  return {
    services: sheet.services.map((s) => s.name),
    withConsultation: sheet.withConsultation,
    listTotal: sheet.listPrice,
    finalPrice: sheet.finalPrice,
    discount,
  };
}

async function proposeMove(ctx: ToolContext, a: { rezervacija_id?: unknown; datum?: unknown; vreme?: unknown; laser?: unknown }) {
  const r = await loadReservation(ctx, a.rezervacija_id);
  if ("greska" in r) return r;
  if (r.status !== "pending" && r.status !== "confirmed") return fail("Termin je otkazan ili na crnoj listi - ne može se pomeriti.");
  if (!isIsoDate(a.datum)) return fail("Neispravan datum (YYYY-MM-DD).");
  if (typeof a.vreme !== "string" || !TIME_RE.test(a.vreme)) return fail("Vreme mora biti HH:MM, na 10 minuta.");
  const date = a.datum;
  const start = toMinutes(a.vreme);
  const hours = await studioHours(ctx, r.location);
  const asked = askedLaser(a.laser, hours.lasers, r.location);
  if (typeof asked === "object") return asked;
  const current = r.laser ?? 1;
  if (date === r.date && a.vreme === hhmm(r.start_time)) {
    // Same day and time, another laser: only the laser changes.
    if (asked !== undefined && asked !== current) return proposeLaserSwitch(ctx, r, hours, asked);
    return fail(asked !== undefined ? "Termin je već tada i na tom laseru." : "Termin je već tada.");
  }
  const askedRow = hours.lasers.find((l) => l.laser === asked);
  const off = askedRow ? notStarted(askedRow, date) : null;
  if (off) return off;
  const end = start + r.total_duration;
  if (end >= 24 * 60) return fail("Termin bi trajao posle ponoći.");

  const freeOpts: FreeOpts = { minutes: r.total_duration, exceptId: r.id, laser: asked };
  if (date < ctx.today || (date === ctx.today && start < ctx.nowMinute - 5)) {
    return fail("To vreme je prošlo.", await nearestFree(ctx, r.location, date, freeOpts));
  }
  const busy = await busyBetween(ctx, r.location, date, date);
  const started = startedLaserDays(date, hours).filter((d) => asked === undefined || d.laser === asked);
  const clash = clashWith(busy, started, date, start, end, r.id);
  if (clash) {
    return fail(
      `${a.vreme}–${fromMinutes(end)} se preklapa sa: ${clash.customer_name} ${hhmm(clash.start_time)}–${hhmm(clash.end_time)}${askedRow ? ` (${laserLabel(askedRow)})` : ""}.`,
      await nearestFree(ctx, r.location, date, freeOpts),
    );
  }
  // admin_move_reservation keeps its own laser when that one is as good as the other.
  const laser = landingLaser(busy, started, date, start, end, { asked, prefer: current, except: r.id });

  const warnings: string[] = [];
  const outside = hoursWarning(busy, hours, date, start, end, asked, r.id);
  if (outside) warnings.push(outside);
  const email = r.customer_email.trim();
  if (!email) warnings.push("Bez emaila - klijent ne dobija obaveštenje");

  const price = await sheetPrice(ctx, r.id);
  const payload: MovePayload = {
    k: "move", id: r.id, date, start: a.vreme, ...(asked !== undefined ? { laser: asked } : {}), exp: Date.now() + PROPOSAL_TTL_MS,
  };
  const token = signProposal(payload);
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `move:${r.id}`, {
    kind: "move",
    title: r.customer_name,
    studio: studioLine(r.location, hours.lasers, laser, current),
    date: longDay(date),
    timeRange: `${a.vreme} – ${fromMinutes(end)}`,
    duration: r.total_duration,
    withConsultation: price.withConsultation,
    services: price.services ?? r.reservation_services.map((x) => x.services?.name ?? "").filter(Boolean),
    listTotal: price.listTotal,
    finalPrice: price.finalPrice,
    discount: price.discount,
    movedFrom: { date: longDay(r.date), timeRange: `${hhmm(r.start_time)} – ${hhmm(r.end_time)}` },
    email: email || null,
    emailDefault: !!email,
    phone: r.customer_phone,
    warnings,
  });
  return {
    ok: true,
    poruka: "Papir sa predlogom pomeranja je prikazan. Čeka se Potvrdi.",
    ...(laserName(hours.lasers, laser) ? { laser: laserName(hours.lasers, laser) } : {}),
    upozorenja: warnings,
  };
}

/**
 * The same day and time on another laser (admin_set_laser): refused when that
 * laser is taken then. The client's term does not change - no email.
 */
async function proposeLaserSwitch(ctx: ToolContext, r: ResRow, hours: AvailabilityData, laser: number) {
  const row = hours.lasers.find((l) => l.laser === laser);
  if (!row) return fail("Nepoznat laser.");
  const off = notStarted(row, r.date);
  if (off) return off;
  const start = toMinutes(r.start_time);
  const end = toMinutes(r.end_time);
  const busy = await busyBetween(ctx, r.location, r.date, r.date);
  const clash = busy.find((b) =>
    b.id !== r.id && (b.laser ?? 1) === laser && toMinutes(b.start_time) < end && toMinutes(b.end_time) > start);
  if (clash) {
    return fail(`${laserLabel(row)} je tada zauzet: ${clash.customer_name} ${hhmm(clash.start_time)}–${hhmm(clash.end_time)}.`);
  }

  const warnings: string[] = [];
  const outside = hoursWarning(busy, hours, r.date, start, end, laser, r.id);
  if (outside) warnings.push(outside);

  const price = await sheetPrice(ctx, r.id);
  const token = signProposal({ k: "laser", id: r.id, laser, exp: Date.now() + PROPOSAL_TTL_MS });
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `move:${r.id}`, {
    kind: "laser",
    title: r.customer_name,
    studio: studioLine(r.location, hours.lasers, laser, r.laser ?? 1),
    date: longDay(r.date),
    timeRange: `${hhmm(r.start_time)} – ${hhmm(r.end_time)}`,
    duration: r.total_duration,
    withConsultation: price.withConsultation,
    services: price.services ?? r.reservation_services.map((x) => x.services?.name ?? "").filter(Boolean),
    listTotal: price.listTotal,
    finalPrice: price.finalPrice,
    discount: price.discount,
    movedFrom: null,
    email: null,
    emailDefault: false,
    phone: r.customer_phone,
    warnings,
  });
  return {
    ok: true,
    poruka: `Papir sa predlogom prebacivanja na ${laserLabel(row)} je prikazan. Vreme ostaje isto, klijent ne dobija mejl. Čeka se Potvrdi.`,
    upozorenja: warnings,
  };
}

async function proposeCancel(ctx: ToolContext, a: { rezervacija_id?: unknown; razlog?: unknown }) {
  const r = await loadReservation(ctx, a.rezervacija_id);
  if ("greska" in r) return r;
  if (r.status === "cancelled") return fail("Termin je već otkazan.");
  if (r.status === "blacklisted") return fail("Termin je na crnoj listi.");
  const reason = typeof a.razlog === "string" && a.razlog.trim() ? a.razlog.trim().slice(0, 200) : null;
  const upcoming = r.date > ctx.today || (r.date === ctx.today && toMinutes(r.start_time) > ctx.nowMinute);
  const email = r.customer_email.trim();
  const warnings: string[] = [];
  if (!upcoming) warnings.push("Termin je već prošao");
  if (!email) warnings.push("Bez emaila - klijent ne dobija obaveštenje");

  const [price, lasers] = await Promise.all([
    sheetPrice(ctx, r.id),
    lasersOf(ctx, r.location).catch(() => SINGLE_LASER),
  ]);
  const token = signProposal({ k: "cancel", id: r.id, reason, exp: Date.now() + PROPOSAL_TTL_MS });
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `cancel:${r.id}`, {
    kind: "cancel",
    title: r.customer_name,
    studio: studioLine(r.location, lasers, r.laser ?? 1),
    date: longDay(r.date),
    timeRange: `${hhmm(r.start_time)} – ${hhmm(r.end_time)}`,
    duration: r.total_duration,
    withConsultation: price.withConsultation,
    services: price.services ?? r.reservation_services.map((x) => x.services?.name ?? "").filter(Boolean),
    listTotal: price.listTotal,
    finalPrice: price.finalPrice,
    discount: price.discount,
    movedFrom: null,
    email: email || null,
    emailDefault: !!email && upcoming,
    phone: r.customer_phone,
    warnings,
  });
  return { ok: true, poruka: "Papir sa predlogom otkazivanja je prikazan. Čeka se Potvrdi.", upozorenja: warnings };
}

// ── The list the model sees ───────────────────────────────────────────────────

const str = (description: string) => ({ type: "string", description });
const day = (description: string) => ({ type: "string", description: `${description} (YYYY-MM-DD)` });
const studio = { type: "string", enum: ["novi_sad", "sombor"], description: "Studio; bez njega važi studio otvoren u adminu." };
const laserArg = {
  type: "integer",
  description: "Samo kad osoblje traži određeni laser (Novi Sad: 1 = Stari, 2 = Novi). Inače izostavi - bira se slobodan laser.",
};

function tool(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } };
}

export const TOOL_SPECS: ToolSpec[] = [
  tool("pronadji_osobu", "Traži osobu po imenu ili telefonu: kartone, upite i njene zakazane termine (od danas).",
    { upit: str("Ime, prezime ili broj telefona") }, ["upit"]),
  tool("karton", "Karton klijenta: kontakt, beleška, tretmani sa regijama i energijom, zakazani termini.",
    { karton_id: str("id kartona iz pronadji_osobu") }, ["karton_id"]),
  tool("raspored_dana", "Svi termini jednog dana (oba studija ili jedan), radno vreme (u studiju sa dva lasera i po laseru), ko radi i na kom laseru je koji termin.",
    { datum: day("Dan"), studio }, ["datum"]),
  tool("slobodni_termini",
    "Slobodna vremena za zakazivanje u periodu (najviše 14 dana), u radnom vremenu. Vreme je slobodno kad bar jedan laser tada radi i nema termin; sa 'laser' samo na tom laseru. prvi_slobodan je najbliže slobodno vreme od 'od' (traži i posle 'do', do 30 dana).",
    {
      studio, laser: laserArg, od: day("Prvi dan"), do: day("Poslednji dan, može isti kao od"),
      usluge_ids: { type: "array", items: { type: "string" }, description: "id-jevi iz alata usluge - trajanje se računa kao pri zakazivanju. Bez njih je trajanje samo 30 min." },
      trajanje_min: { type: "number", description: "Ako usluge nisu poznate" },
      novi_klijent: { type: "boolean", description: "Novi klijent ima +10 min konsultacije (podrazumevano true)" },
      posle: str("Ne pre ovog vremena, HH:MM"), pre: str("Da se završi do, HH:MM"),
      van_radnog_vremena: { type: "boolean", description: "true samo kad osoblje izričito traži termin van radnog vremena" },
    }, ["od"]),
  tool("usluge", "Cenovnik: usluge (regije) sa id, trajanjem i cenom za pol i studio.",
    { pol: { type: "string", enum: ["zene", "muskarci"] }, studio }, ["pol"]),
  tool("pregled", "Današnji pregled: koga pozvati, follow-up upiti, ko se zakazao od juče, otkazivanja, rupe i kapacitet 7 dana, klijenti za vraćanje, prošla nedelja."),
  tool("upiti_spisak", "Svi otvoreni upiti (spisak za javljanje) sa danom podsetnika."),
  tool("zapisi_upit",
    "Upisuje osobu na spisak upita (lead sa Instagrama, Facebooka, Vibera, telefona...). Podsetnik je za 3 dana ako se ne navede datum.",
    {
      ime: str("Ime i prezime ili ime sa Instagrama"), telefon: str("Broj, ako je poznat"),
      izvor: { type: "string", enum: [...SOURCES] }, beleska: str("Šta je rekla / pitala, kratko"),
      podseti_datum: day("Kada da Infy podseti, ako je rečeno"),
    }, ["ime", "izvor"]),
  tool("azuriraj_upit", "Menja upit: dan podsetnika, status (open/booked/declined), belešku, ili javio_se=true kad se osoblje javilo (sledeći podsetnik za 3 dana).",
    {
      id: str("id upita"), podseti_datum: { type: ["string", "null"], description: "YYYY-MM-DD, ili null za podrazumevano" },
      status: { type: "string", enum: ["open", "booked", "declined"] }, beleska: str("Nova beleška"),
      javio_se: { type: "boolean" },
    }, ["id"]),
  tool("oznaci_poziv", "Potvrdni poziv novom klijentu pred prvi termin: javio_se ili ne_javlja_se.",
    { rezervacija_id: str("id termina"), ishod: { type: "string", enum: ["javio_se", "ne_javlja_se"] } }, ["rezervacija_id", "ishod"]),
  tool("predlog_zakazivanja",
    "Pravi PREDLOG novog termina na papiru. Ništa ne zakazuje: osoblje mora da pritisne Potvrdi. Server računa trajanje, konsultaciju, cenu i laser. Ako vrati greska, papir NIJE napravljen; najbliza_slobodna su prava slobodna vremena za ovo trajanje.",
    {
      studio, laser: laserArg, datum: day("Dan termina"), vreme: str("Početak HH:MM - iz slobodni_termini ili najbliza_slobodna"),
      usluge_ids: { type: "array", items: { type: "string" }, description: "id-jevi iz alata usluge" },
      ime: str("Ime i prezime"), telefon: str("Telefon"), email: str("Email"),
      karton_id: str("Ako klijent ima karton - kontakt se uzima iz njega"),
      novi_klijent: { type: "boolean", description: "Samo ako je izričito poznato; inače server proverava istoriju" },
      promo_kod: str("student20 ili ils-... kod, samo ako ga je osoblje navelo"),
      napomena: str("Interna napomena uz termin"),
    }, ["datum", "vreme", "usluge_ids", "ime"]),
  tool("predlog_pomeranja",
    "Pravi PREDLOG pomeranja postojećeg termina na papiru. Ništa ne menja dok osoblje ne pritisne Potvrdi. Isti datum i vreme sa drugim laserom = prebacivanje na taj laser (klijent ne dobija mejl).",
    { rezervacija_id: str("id termina"), datum: day("Novi dan"), vreme: str("Novi početak HH:MM"), laser: laserArg }, ["rezervacija_id", "datum", "vreme"]),
  tool("predlog_otkazivanja", "Pravi PREDLOG otkazivanja termina na papiru. Ništa ne otkazuje dok osoblje ne pritisne Potvrdi.",
    { rezervacija_id: str("id termina"), razlog: str("Razlog, kratko") }, ["rezervacija_id"]),
];

/** The tools that make a paper sheet. */
export const PROPOSAL_TOOLS = new Set(["predlog_zakazivanja", "predlog_pomeranja", "predlog_otkazivanja"]);

type Handler = (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
const HANDLERS: Record<string, Handler> = {
  pronadji_osobu: findPeople,
  karton: kartonDetails,
  raspored_dana: daySchedule,
  slobodni_termini: freeSlots,
  usluge: serviceList,
  pregled: briefTool,
  upiti_spisak: callList,
  zapisi_upit: addUpit,
  azuriraj_upit: updateUpit,
  oznaci_poziv: markCall,
  predlog_zakazivanja: proposeBooking,
  predlog_pomeranja: proposeMove,
  predlog_otkazivanja: proposeCancel,
};

/** Runs one tool call; the answer is JSON text for the model, never thrown. */
export async function runTool(ctx: ToolContext, name: string, rawArgs: string): Promise<string> {
  const handler = HANDLERS[name];
  if (!handler) return JSON.stringify(fail(`Nepoznat alat ${name}.`));
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = rawArgs ? JSON.parse(rawArgs) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    return JSON.stringify(fail("Argumenti nisu ispravan JSON."));
  }
  try {
    const result = await handler(ctx, args);
    // A refused proposal says so in words the model can't miss.
    const refused = PROPOSAL_TOOLS.has(name) && typeof result === "object" && result !== null && "greska" in result;
    const out = JSON.stringify(refused ? { ...(result as Fail), papir_napravljen: false } : result);
    return out.length > 12_000 ? `${out.slice(0, 12_000)}…(skraćeno)` : out;
  } catch (err) {
    console.error(`[infy] tool ${name} failed:`, err);
    return JSON.stringify(fail("Podaci trenutno nisu dostupni - pokušaj ponovo."));
  }
}

/** For the system prompt: the brief's days, so "sutra" or "u četvrtak" land on the right date. */
export function calendarLines(today: string): string {
  const lines: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = addDays(today, i);
    lines.push(`${shortDay(d)} = ${d}${i === 0 ? " (danas)" : i === 1 ? " (sutra)" : ""}`);
  }
  return lines.join("\n");
}

