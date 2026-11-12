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
  SLOT_SIZE, calcBookingDuration, calcTotalDuration, getAvailableSlots, type BusinessWindow,
} from "@/lib/supabase";
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
import { PROPOSAL_TTL_MS, signProposal, type BookPayload } from "./proposals";
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

/** Working windows of a studio on a date (override first, then the weekday). */
async function windowsOn(ctx: ToolContext, location: string, date: string): Promise<BusinessWindow[]> {
  const sched = await cached(ctx, "schedule", async () => {
    const [tpl, ovr] = await Promise.all([
      ctx.db.from("weekly_schedule").select("weekday, windows, location"),
      ctx.db.from("availability_overrides").select("date, windows, location").gte("date", ctx.today),
    ]);
    if (tpl.error || ovr.error) throw new Error("schedule");
    return { tpl: tpl.data ?? [], ovr: ovr.data ?? [] };
  });
  const own = sched.ovr.find((o) => o.location === location && o.date === date);
  if (own) return (own.windows as BusinessWindow[] | null) ?? [];
  const day = sched.tpl.find((t) => t.location === location && t.weekday === mondayIndex(date));
  return (day?.windows as BusinessWindow[] | null) ?? [];
}

type Busy = { id: string; date: string; start_time: string; end_time: string; location: string; customer_name: string };

async function busyBetween(ctx: ToolContext, location: string, from: string, to: string): Promise<Busy[]> {
  const { data, error } = await ctx.db.from("reservations")
    .select("id, date, start_time, end_time, location, customer_name")
    .eq("location", location).gte("date", from).lte("date", to)
    .in("status", ["pending", "confirmed"]);
  if (error) throw new Error("busy");
  return (data ?? []) as Busy[];
}

function fmtWindows(w: BusinessWindow[]): string {
  return w.length ? w.map((x) => `${fromMinutes(x.start)}–${fromMinutes(x.end)}`).join(", ") : "zatvoreno";
}

function inWindows(start: number, end: number, windows: BusinessWindow[]): boolean {
  return windows.some((w) => start >= w.start && end <= w.end);
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
  location: string; call_status: string; notes: string | null;
  reservation_services: { services: { name: string } | null }[];
};
const RES_COLUMNS =
  "id, customer_name, customer_phone, customer_email, date, start_time, end_time, total_duration, status, location, call_status, notes, reservation_services(services(name))";

function resForModel(r: ResRow) {
  return {
    id: r.id,
    ime: r.customer_name,
    telefon: r.customer_phone,
    email: r.customer_email || null,
    studio: r.location,
    datum: r.date,
    dan: shortDay(r.date),
    vreme: `${hhmm(r.start_time)}–${hhmm(r.end_time)}`,
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
  const [named, carded] = await Promise.all([
    byName.gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(10),
    clientIds.length
      ? ctx.db.from("reservations").select(RES_COLUMNS).in("client_id", clientIds)
          .gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const seen = new Set<string>();
  const upcoming = [...((named.data ?? []) as unknown as ResRow[]), ...((carded.data ?? []) as unknown as ResRow[])]
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((x, y) => (x.date + x.start_time).localeCompare(y.date + y.start_time))
    .slice(0, 10)
    .map(resForModel);

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
  const upcoming = await ctx.db.from("reservations").select(RES_COLUMNS).eq("client_id", card.client_id)
    .gte("date", ctx.today).in("status", ["pending", "confirmed"]).order("date").limit(5);
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
    zakazani_termini: ((upcoming.data ?? []) as unknown as ResRow[]).map(resForModel),
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
  const rows = (res.data ?? []) as unknown as ResRow[];
  const out = [];
  for (const loc of locs) {
    const ids = staffOvr.data?.find((o) => o.location === loc)?.staff_ids
      ?? staffTpl.data?.find((t) => t.location === loc)?.staff_ids ?? [];
    const mine = rows.filter((r) => r.location === loc);
    out.push({
      studio: loc,
      radno_vreme: fmtWindows(await windowsOn(ctx, loc, date)),
      radi: ids.map((id) => names.get(id)).filter(Boolean),
      termini: mine.filter((r) => r.status === "pending" || r.status === "confirmed").map(resForModel),
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
};
type FreeDay = { date: string; windows: BusinessWindow[]; slots: string[] };

/**
 * Free start times on each day from..to - the same check the proposals make
 * (getAvailableSlots and clashWith both treat touching bookings as free).
 */
async function freeByDay(ctx: ToolContext, loc: string, from: string, to: string, o: FreeOpts): Promise<FreeDay[]> {
  const busy = (await busyBetween(ctx, loc, from, to)).filter((b) => b.id !== o.exceptId);
  const days: FreeDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const windows = o.anyHour ? ADMIN_WINDOW : await windowsOn(ctx, loc, date);
    const slots = windows.length
      ? getAvailableSlots(
          busy.filter((b) => b.date === date).map((b) => ({ ...b, status: "confirmed" })),
          o.minutes, date === ctx.today ? ctx.nowMinute : undefined, windows,
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
  novi_klijent?: unknown; posle?: unknown; pre?: unknown; van_radnog_vremena?: unknown;
}) {
  const loc = isLocationId(a.studio) ? a.studio : ctx.location;
  if (!isIsoDate(a.od)) return fail("Neispravan datum 'od' (YYYY-MM-DD).");
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
  };

  const found = await freeByDay(ctx, loc, from, to, opts);
  // "Najbliži slobodan": the first free time, looked for past 'do' too.
  let first: FreeTime | null = gapStarts(found, 1)[0] ?? null;
  const last = addDays(from, FREE_SEARCH_DAYS - 1);
  if (!first && to < last) first = gapStarts(await freeByDay(ctx, loc, addDays(to, 1), last, opts), 1)[0] ?? null;

  return {
    studio: loc,
    trajanje_min: minutes,
    novi_klijent: newClient,
    ...(guessed ? { upozorenje: "Trajanje nije zadato - računato je 30 min. Za zakazivanje pozovi ponovo sa usluge_ids." } : {}),
    prvi_slobodan: first ?? `Nema slobodnog termina u narednih ${FREE_SEARCH_DAYS} dana.`,
    dani: found.map((d) => (d.windows.length
      ? {
          datum: d.date,
          dan: shortDay(d.date),
          radno_vreme: fmtWindows(d.windows),
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
        termina: d.count, rupe: d.gaps.map((g) => `${g.start}–${g.end}`), bez_osoblja: d.noStaff,
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

function clashWith(busy: Busy[], date: string, start: number, end: number, except?: string): Busy | undefined {
  return busy.find((b) => b.id !== except && b.date === date &&
    toMinutes(b.start_time) < end && toMinutes(b.end_time) > start);
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
  promo_kod?: unknown; napomena?: unknown;
}) {
  const loc = isLocationId(a.studio) ? a.studio : ctx.location;
  if (!isIsoDate(a.datum)) return fail("Neispravan datum (YYYY-MM-DD).");
  if (typeof a.vreme !== "string" || !TIME_RE.test(a.vreme)) return fail("Vreme mora biti HH:MM, na 10 minuta.");
  const date = a.datum;
  const start = toMinutes(a.vreme);
  const ids = Array.isArray(a.usluge_ids) ? [...new Set(a.usluge_ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))] : [];
  if (!ids.length || ids.length > 20) return fail("Fale usluge (id-jevi iz alata 'usluge').");

  // The client: from the card when one is named, then what was said.
  const kartonId = typeof a.karton_id === "string" && UUID_RE.test(a.karton_id) ? a.karton_id : null;
  let card: { name: string; phone: string | null; email: string | null } | null = null;
  if (kartonId) {
    const { data } = await ctx.db.from("kartoni").select("clients(name, phone, email)").eq("id", kartonId).maybeSingle();
    card = (data as unknown as { clients: typeof card } | null)?.clients ?? null;
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
    return fail("To vreme je prošlo.", await nearestFree(ctx, loc, date, { minutes }));
  }
  const busy = await busyBetween(ctx, loc, date, date);
  const clash = clashWith(busy, date, start, end);
  if (clash) {
    return fail(
      `${a.vreme}–${fromMinutes(end)} (${minutes} min) se preklapa sa: ${clash.customer_name} ${hhmm(clash.start_time)}–${hhmm(clash.end_time)}.`,
      await nearestFree(ctx, loc, date, { minutes }),
    );
  }

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

  const windows = await windowsOn(ctx, loc, date);
  const warnings: string[] = [];
  if (!inWindows(start, end, windows)) warnings.push(`Van radnog vremena (${fmtWindows(windows)})`);
  if (!email && !phone) warnings.push("Nema ni telefona ni emaila");
  else if (!email) warnings.push("Bez emaila - potvrda se ne šalje");
  if (promo === STUDENT_PROMO_CODE && returning) warnings.push("Klijent već postoji - studentski popust je za prvi tretman");

  const payload: BookPayload = {
    k: "book", id: randomUUID(), loc, date, start: a.vreme, svc: ids, name, email, phone,
    cons: !returning, promo, notes: notes.join(" · ") || null,
    lines: effective.map((s) => ({ name: s.name, price: s.price })), list,
    exp: Date.now() + PROPOSAL_TTL_MS,
  };
  const token = signProposal(payload);
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `book:${name.toLowerCase()}`, {
    kind: "book",
    title: name,
    studio: studioName(loc),
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

async function proposeMove(ctx: ToolContext, a: { rezervacija_id?: unknown; datum?: unknown; vreme?: unknown }) {
  const r = await loadReservation(ctx, a.rezervacija_id);
  if ("greska" in r) return r;
  if (r.status !== "pending" && r.status !== "confirmed") return fail("Termin je otkazan ili na crnoj listi - ne može se pomeriti.");
  if (!isIsoDate(a.datum)) return fail("Neispravan datum (YYYY-MM-DD).");
  if (typeof a.vreme !== "string" || !TIME_RE.test(a.vreme)) return fail("Vreme mora biti HH:MM, na 10 minuta.");
  const date = a.datum;
  const start = toMinutes(a.vreme);
  if (date === r.date && a.vreme === hhmm(r.start_time)) return fail("Termin je već tada.");
  const end = start + r.total_duration;
  if (end >= 24 * 60) return fail("Termin bi trajao posle ponoći.");

  const freeOpts: FreeOpts = { minutes: r.total_duration, exceptId: r.id };
  if (date < ctx.today || (date === ctx.today && start < ctx.nowMinute - 5)) {
    return fail("To vreme je prošlo.", await nearestFree(ctx, r.location, date, freeOpts));
  }
  const busy = await busyBetween(ctx, r.location, date, date);
  const clash = clashWith(busy, date, start, end, r.id);
  if (clash) {
    return fail(
      `${a.vreme}–${fromMinutes(end)} se preklapa sa: ${clash.customer_name} ${hhmm(clash.start_time)}–${hhmm(clash.end_time)}.`,
      await nearestFree(ctx, r.location, date, freeOpts),
    );
  }

  const windows = await windowsOn(ctx, r.location, date);
  const warnings: string[] = [];
  if (!inWindows(start, end, windows)) warnings.push(`Van radnog vremena (${fmtWindows(windows)})`);
  const email = r.customer_email.trim();
  if (!email) warnings.push("Bez emaila - klijent ne dobija obaveštenje");

  const price = await sheetPrice(ctx, r.id);
  const token = signProposal({ k: "move", id: r.id, date, start: a.vreme, exp: Date.now() + PROPOSAL_TTL_MS });
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `move:${r.id}`, {
    kind: "move",
    title: r.customer_name,
    studio: studioName(r.location),
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
  return { ok: true, poruka: "Papir sa predlogom pomeranja je prikazan. Čeka se Potvrdi.", upozorenja: warnings };
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

  const price = await sheetPrice(ctx, r.id);
  const token = signProposal({ k: "cancel", id: r.id, reason, exp: Date.now() + PROPOSAL_TTL_MS });
  if (!token) return fail("Server nije podešen za potvrde.");
  pushProposal(ctx, token, `cancel:${r.id}`, {
    kind: "cancel",
    title: r.customer_name,
    studio: studioName(r.location),
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

function tool(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } };
}

export const TOOL_SPECS: ToolSpec[] = [
  tool("pronadji_osobu", "Traži osobu po imenu ili telefonu: kartone, upite i njene zakazane termine (od danas).",
    { upit: str("Ime, prezime ili broj telefona") }, ["upit"]),
  tool("karton", "Karton klijenta: kontakt, beleška, tretmani sa regijama i energijom, zakazani termini.",
    { karton_id: str("id kartona iz pronadji_osobu") }, ["karton_id"]),
  tool("raspored_dana", "Svi termini jednog dana (oba studija ili jedan), radno vreme i ko radi.",
    { datum: day("Dan"), studio }, ["datum"]),
  tool("slobodni_termini",
    "Slobodna vremena za zakazivanje u periodu (najviše 14 dana), u radnom vremenu. prvi_slobodan je najbliže slobodno vreme od 'od' (traži i posle 'do', do 30 dana).",
    {
      studio, od: day("Prvi dan"), do: day("Poslednji dan, može isti kao od"),
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
    "Pravi PREDLOG novog termina na papiru. Ništa ne zakazuje: osoblje mora da pritisne Potvrdi. Server računa trajanje, konsultaciju i cenu. Ako vrati greska, papir NIJE napravljen; najbliza_slobodna su prava slobodna vremena za ovo trajanje.",
    {
      studio, datum: day("Dan termina"), vreme: str("Početak HH:MM - iz slobodni_termini ili najbliza_slobodna"),
      usluge_ids: { type: "array", items: { type: "string" }, description: "id-jevi iz alata usluge" },
      ime: str("Ime i prezime"), telefon: str("Telefon"), email: str("Email"),
      karton_id: str("Ako klijent ima karton - kontakt se uzima iz njega"),
      novi_klijent: { type: "boolean", description: "Samo ako je izričito poznato; inače server proverava istoriju" },
      promo_kod: str("student20 ili ils-... kod, samo ako ga je osoblje navelo"),
      napomena: str("Interna napomena uz termin"),
    }, ["datum", "vreme", "usluge_ids", "ime"]),
  tool("predlog_pomeranja", "Pravi PREDLOG pomeranja postojećeg termina na papiru. Ništa ne menja dok osoblje ne pritisne Potvrdi.",
    { rezervacija_id: str("id termina"), datum: day("Novi dan"), vreme: str("Novi početak HH:MM") }, ["rezervacija_id", "datum", "vreme"]),
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

