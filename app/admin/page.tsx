"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronLeft, ChevronRight, LogOut, X,
  Clock, User, Mail, Phone, Calendar, CalendarPlus,
  PhoneCall, PhoneOff, AlertTriangle, StickyNote, HeartPulse, Tag, Package,
  Plus, RotateCcw, Ban, Search, Users,
} from "lucide-react";
import { fetchAll, escapeLike } from "@/lib/fetchAll";
import { supabase, timeToMinutes, type BusinessWindow } from "@/lib/supabase";
import AdminReservationModal from "@/components/AdminReservationModal";
import AdminLogin from "@/components/AdminLogin";
import AdminLocationSwitch from "@/components/AdminLocationSwitch";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminLocation } from "@/lib/adminLocation";
import { locationTheme, type LocationId } from "@/lib/locations";
import { fetchPriceRows, PriceBook } from "@/lib/prices";
import type { ReservationStatus, Json } from "@/lib/database.types";
import {
  fetchAvailability, resolveWindows, weekdayOf, EMPTY_AVAILABILITY, type AvailabilityData,
} from "@/lib/availability";
import {
  fetchStaff, fetchStaffSchedule, resolveStaff, sameStaff, EMPTY_STAFF_SCHEDULE,
  type StaffMember, type StaffSchedule,
} from "@/lib/staff";
import { computeReservationPrice, type PriceResult } from "@/lib/pricing";
import { parseBundlePromo } from "@/lib/bundles";

// ── Constants ─────────────────────────────────────────────────────────────────
const SLOT_PX     = 16;
const PX_PER_MIN  = SLOT_PX / 10;
// The grid follows the week's working hours and appointments; this range is
// only the fallback while nothing has loaded yet.
const FALLBACK_START = 8 * 60;
const FALLBACK_END   = 22 * 60;
/** Shortest card the calendar draws, so even a 10-minute slot stays readable / tappable. */
const MIN_CARD_PX_DESKTOP = 26;
const MIN_CARD_PX_MOBILE  = 44;
/** A background refresh (tab refocus, timer) is skipped if one ran this recently. */
const REFRESH_THROTTLE_MS = 5_000;
const REFRESH_EVERY_MS    = 20_000;

const SR_DAYS_LONG  = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const SR_DAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const SR_MONTHS     = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; border: string; label: string; dot: string }> = {
  pending:   { bg: "bg-amber-400/15",  text: "text-amber-300",  border: "border-amber-400/30", label: "Na čekanju",         dot: "bg-amber-400" },
  confirmed: { bg: "bg-green-400/15",  text: "text-green-400",  border: "border-green-400/30", label: "Potvrđeno",          dot: "bg-green-400" },
  cancelled: { bg: "bg-red-400/15",    text: "text-red-400",    border: "border-red-400/30",   label: "Otkazano",           dot: "bg-red-400"   },
  blacklisted: { bg: "bg-foreground/10", text: "text-foreground/80", border: "border-foreground/35", label: "Crna lista", dot: "bg-foreground/70" },
};

/** Fallback for rows whose status predates the current set (e.g. legacy "no_show"),
 *  so an unmigrated value renders greyed out instead of crashing the calendar. */
const UNKNOWN_STATUS_STYLE = {
  bg: "bg-foreground/5", text: "text-foreground/60", border: "border-foreground/10",
  label: "Nepoznat status", dot: "bg-foreground/30",
};

/** A confirmed appointment - green, as everywhere else in the panel. */
const CONFIRMED_CARD_STYLE = {
  box: "bg-green-400/15 hover:bg-green-400/25", bar: "bg-green-400", sub: "text-green-300", name: "text-foreground",
};

/** How a card looks when the appointment is not a normal confirmed one. */
const CARD_STATUS_STYLES: Partial<Record<ReservationStatus, { box: string; bar: string; sub: string; name: string }>> = {
  pending:     { box: "bg-amber-400/15 hover:bg-amber-400/25 border border-dashed border-amber-400/50", bar: "bg-amber-400", sub: "text-amber-200", name: "text-foreground" },
  cancelled:   { box: "bg-red-400/5 hover:bg-red-400/10 border border-dashed border-red-400/40",        bar: "bg-red-400/60", sub: "text-red-300/70", name: "text-red-300/80 line-through" },
  blacklisted: { box: "bg-foreground/8 hover:bg-foreground/12 border border-foreground/25",             bar: "bg-foreground/50", sub: "text-foreground/64", name: "text-foreground/76" },
};

const UNKNOWN_CARD_STYLE = {
  box: "bg-foreground/5 hover:bg-foreground/10 border border-foreground/10",
  bar: "bg-foreground/30", sub: "text-foreground/60", name: "text-foreground/68",
};

/** Appointments that take up the studio's time (not cancelled, not blacklisted). */
function isActive(r: { status: ReservationStatus }) {
  return r.status !== "cancelled" && r.status !== "blacklisted";
}

// ── Combo packages — replace component services with their combo price ─────────
const COMBO_RULES = [
  { parts: ["nausnice", "brada"],  comboKey: "nausnice i brada" },
  { parts: ["noge", "intima"],     comboKey: "noge + intima" },
  { parts: ["stomak", "grudi"],    comboKey: "stomak + grudi" },
];

function applyComboRules(selected: ServiceRef[], all: ServiceRef[]): ServiceRef[] {
  let effective = [...selected];
  for (const rule of COMBO_RULES) {
    const matched = rule.parts
      .map(part => effective.find(s => s.name.toLowerCase().includes(part)))
      .filter((s): s is ServiceRef => s !== undefined);
    if (matched.length === rule.parts.length) {
      const combo = all.find(s => s.name.toLowerCase().includes(rule.comboKey));
      if (combo) { effective = effective.filter(s => !matched.includes(s)); effective.push(combo); }
    }
  }
  return effective;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ServiceRef = { id: string; name: string; price: number };
type CallStatus = "none" | "no_answer" | "answered";
type ReservationFull = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  date: string;
  start_time: string;
  end_time: string;
  total_duration: number;
  status: ReservationStatus;
  notes: string | null;
  customer_note: string | null;
  created_at: string;
  promo_code: string | null;
  location: LocationId;
  call_status: CallStatus;
  call_attempted_at: string | null;
  reservation_services: { services: ServiceRef | null }[];
};

/** Serbian plural: 1 dolazak · 2–4 dolaska · 5+ dolazaka (11–14 take the last form). */
function srPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** One person's whole history, keyed by lower-cased email. */
type ClientGroup = {
  email: string;
  name: string;              // name from the most recent booking
  phone: string | null;
  reservations: ReservationFull[];  // newest first
  visits: number;            // confirmed appointments — times she actually came
  cancelled: number;
  blacklisted: boolean;
  lastVisit: string | null;  // date of the newest confirmed appointment
};

/** Collapse a flat reservation list into one entry per person, newest first. */
function groupByClient(rows: ReservationFull[]): ClientGroup[] {
  const map = new Map<string, ReservationFull[]>();
  for (const r of rows) {
    const key = (r.customer_email ?? "").trim().toLowerCase();
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(r); else map.set(key, [r]);
  }

  const groups: ClientGroup[] = [];
  for (const [email, list] of map) {
    const sorted = [...list].sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : b.start_time.localeCompare(a.start_time));
    const confirmed = sorted.filter(r => r.status === "confirmed");
    groups.push({
      email,
      name: sorted[0].customer_name,
      phone: sorted.find(r => r.customer_phone)?.customer_phone ?? null,
      reservations: sorted,
      visits: confirmed.length,
      cancelled: sorted.filter(r => r.status === "cancelled").length,
      blacklisted: sorted.some(r => r.status === "blacklisted"),
      lastVisit: confirmed[0]?.date ?? null,
    });
  }

  // Most recent activity first, so the person you just dealt with is on top.
  return groups.sort((a, b) => b.reservations[0].date.localeCompare(a.reservations[0].date));
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMonday(d: Date) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(d: Date) {
  return `${d.getDate()}. ${SR_MONTHS[d.getMonth()]}`;
}

function fmtFull(d: Date) {
  return `${SR_DAYS_LONG[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()}. ${SR_MONTHS[d.getMonth()]}. ${d.getFullYear()}`;
}

// ── Positioning helpers ───────────────────────────────────────────────────────
function toHeight(minutes: number) {
  return minutes * PX_PER_MIN;
}

/** Diagonal hatch over the hours the studio is closed. */
const CLOSED_HATCH = {
  backgroundColor: "rgb(0 0 0 / 0.28)",
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in srgb, var(--foreground) 9%, transparent) 0 1px, transparent 1px 8px)",
};

/** The parts of [start, end] that fall outside every working window. */
function closedSegments(windows: BusinessWindow[] | null, start: number, end: number) {
  const segments: BusinessWindow[] = [];
  let cursor = start;
  for (const w of [...(windows ?? [])].sort((a, b) => a.start - b.start)) {
    const s = Math.max(w.start, start);
    const e = Math.min(w.end, end);
    if (e <= s) continue;
    if (s > cursor) segments.push({ start: cursor, end: s });
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) segments.push({ start: cursor, end });
  return segments;
}

/** "14:00–20:00", several windows joined with " · ", or null when closed. */
function fmtWindows(windows: BusinessWindow[] | null) {
  if (!windows || windows.length === 0) return null;
  return windows.map(w => `${fmtMin(w.start)}–${fmtMin(w.end)}`).join(" · ");
}

// ── Working-hours editor ────────────────────────────────────────────────────
const HOUR_PRESETS: { label: string; windows: BusinessWindow[] }[] = [
  { label: "10–16", windows: [{ start: 600, end: 960 }] },
  { label: "14–20", windows: [{ start: 840, end: 1200 }] },
  { label: "15–20", windows: [{ start: 900, end: 1200 }] },
  { label: "13–18", windows: [{ start: 780, end: 1080 }] },
  { label: "13–20", windows: [{ start: 780, end: 1200 }] },
  { label: "10–21", windows: [{ start: 600, end: 1260 }] },
];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:MM" or "H:MM" → minutes since midnight, or null if invalid. */
function parseHM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Chips + presets + custom "od–do" for editing a day's list of open windows. */
function WindowsEditor({
  windows,
  onChange,
}: {
  windows: BusinessWindow[];
  onChange: (next: BusinessWindow[]) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function addCustom() {
    const s = parseHM(from);
    const e = parseHM(to);
    if (s == null || e == null || e <= s) return;
    onChange([...windows, { start: s, end: e }].sort((a, b) => a.start - b.start));
    setFrom("");
    setTo("");
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Current windows */}
      <div className="flex flex-wrap items-center gap-2 min-h-8">
        {windows.length === 0 ? (
          <span className="text-xs font-poppins text-foreground/60 italic">Zatvoreno</span>
        ) : (
          windows.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg bg-accent/10 border border-accent/15 text-accent text-xs font-bold font-poppins">
              {fmtMin(w.start)}–{fmtMin(w.end)}
              <button
                type="button"
                onClick={() => onChange(windows.filter((_, j) => j !== i))}
                className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-accent/20 transition-colors cursor-pointer"
                aria-label="Ukloni prozor"
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {HOUR_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.windows)}
            className="px-3 py-1.5 rounded-lg bg-foreground/4 border border-foreground/8 text-[11px] font-bold font-poppins text-foreground/76 hover:bg-accent/10 hover:border-accent/20 hover:text-accent transition-all cursor-pointer"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange([])}
          className="px-3 py-1.5 rounded-lg bg-red-400/10 border border-red-400/30 text-[11px] font-bold font-poppins text-red-400 hover:bg-red-400/20 transition-all cursor-pointer"
        >
          Zatvoreno
        </button>
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-2">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="14:00"
          inputMode="numeric"
          className="w-20 px-3 py-2 rounded-lg border border-foreground/10 font-poppins text-xs focus:outline-none focus:border-accent/40 transition-colors"
        />
        <span className="text-foreground/50 text-xs">–</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="20:00"
          inputMode="numeric"
          className="w-20 px-3 py-2 rounded-lg border border-foreground/10 font-poppins text-xs focus:outline-none focus:border-accent/40 transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/15 text-accent text-[11px] font-bold font-poppins hover:bg-accent/15 transition-all cursor-pointer flex items-center gap-1"
        >
          <Plus size={13} /> Dodaj
        </button>
      </div>
    </div>
  );
}

/** Toggle chips: tap a name to put that person on (or take them off) the day. */
function StaffPicker({
  staff,
  selected,
  onChange,
}: {
  staff: StaffMember[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // Someone removed from the team still shows here while they are on the day,
  // so they can be taken off it.
  const shown = staff.filter((m) => m.active || selected.includes(m.id));
  if (shown.length === 0) {
    return (
      <p className="text-xs font-poppins text-foreground/60 italic">
        Još nema zaposlenih. Dodaj ih u kartici Radno vreme.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== m.id) : [...selected, m.id])}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold font-poppins transition-all cursor-pointer ${
              on
                ? "bg-accent text-on-accent border-accent"
                : "bg-foreground/4 border-foreground/8 text-foreground/76 hover:bg-accent/10 hover:border-accent/20 hover:text-accent"
            }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Day layout ────────────────────────────────────────────────────────────────
// Layout reservations into columns so overlaps render side-by-side instead of stacked.
// Returns each reservation with its assigned column index and the total columns its cluster spans.
// `minMinutes` is the shortest card drawn: a short appointment takes up that much
// room on screen, so whatever follows it goes beside it rather than underneath.
type LaidOut = ReservationFull & { _col: number; _cols: number };
function layoutDay(rs: ReservationFull[], minMinutes: number): LaidOut[] {
  if (rs.length === 0) return [];
  const sorted = [...rs].sort((a, b) => {
    const sa = timeToMinutes(a.start_time);
    const sb = timeToMinutes(b.start_time);
    if (sa !== sb) return sa - sb;
    return timeToMinutes(a.end_time) - timeToMinutes(b.end_time);
  });

  const out: LaidOut[] = [];
  let cluster: { item: ReservationFull; start: number; end: number; col: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const cols = cluster.reduce((m, c) => Math.max(m, c.col + 1), 0);
    for (const c of cluster) out.push({ ...c.item, _col: c.col, _cols: cols });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const r of sorted) {
    const start = timeToMinutes(r.start_time);
    const end   = Math.max(timeToMinutes(r.end_time), start + Math.max(r.total_duration, minMinutes));
    if (start >= clusterEnd) flush();

    // pick lowest free column
    const used = new Set(
      cluster.filter(c => c.end > start).map(c => c.col)
    );
    let col = 0;
    while (used.has(col)) col++;

    cluster.push({ item: r, start, end, col });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return out;
}

// ── Countdown helper ──────────────────────────────────────────────────────────
function hoursUntilExpiry(attemptedAt: string): number {
  const diff = Date.now() - new Date(attemptedAt).getTime();
  return Math.max(0, 24 - diff / 3_600_000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  /** Calendar, calls, clients and working hours all show this one studio. */
  const { location, setLocation } = useAdminLocation();

  const [activeTab, setActiveTab]         = useState<"calendar" | "calls" | "clients" | "hours">("calendar");
  const [expandedExpired, setExpandedExpired] = useState<string | null>(null);

  // Client search
  const [clientQuery, setClientQuery]     = useState("");
  const [clientGroups, setClientGroups]   = useState<ClientGroup[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsSearched, setClientsSearched] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Working-hours schedule (weekly template + per-date overrides)
  const [availability, setAvailability]   = useState<AvailabilityData>(EMPTY_AVAILABILITY);
  const [overrideDate, setOverrideDate]   = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<BusinessWindow[]>([]);
  // ── Who works which day ──
  const [staff, setStaff]                 = useState<StaffMember[]>([]);
  const [staffSchedule, setStaffSchedule] = useState<StaffSchedule>(EMPTY_STAFF_SCHEDULE);
  const [overrideStaffDraft, setOverrideStaffDraft] = useState<string[]>([]);
  const [newStaffName, setNewStaffName]   = useState("");

  const [weekStart, setWeekStart]         = useState<Date>(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate]   = useState<Date>(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  });

  const [reservations, setReservations]   = useState<ReservationFull[]>([]);
  const [callReservations, setCallReservations] = useState<ReservationFull[]>([]);
  const [allServices, setAllServices]     = useState<ServiceRef[]>([]);
  const [priceBook, setPriceBook]         = useState<PriceBook | null>(null);
  const [loading, setLoading]             = useState(false);
  const [callsLoading, setCallsLoading]   = useState(false);
  const [selected, setSelected]           = useState<ReservationFull | null>(null);
  const [selectedIsReturning, setSelectedIsReturning] = useState<boolean | null>(null);
  const [selectedIsBlacklisted, setSelectedIsBlacklisted] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<PriceResult | null>(null);
  const [newStatus, setNewStatus]         = useState<ReservationStatus>("pending");
  const [newNotes, setNewNotes]           = useState<string>("");
  const [saving, setSaving]               = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);

  // Current time, for the "now" line and the open / closed indicator.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Error toast — a failed save must never pass silently.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Weeks already loaded, keyed "location|monday" — revisiting one paints instantly. */
  const weekCache   = useRef(new Map<string, ReservationFull[]>());
  /** Only the latest request of each kind may write to the screen. */
  const rangeReq    = useRef(0);
  const callsReq    = useRef(0);
  const modalReq    = useRef(0);
  const lastRefresh = useRef(0);

  /** Apply a change to one reservation on screen and in every cached week. */
  const patchReservation = useCallback((id: string, patch: Partial<ReservationFull>) => {
    const apply = (rows: ReservationFull[]) => rows.map(r => (r.id === id ? { ...r, ...patch } : r));
    setReservations(apply);
    for (const [key, rows] of weekCache.current) weekCache.current.set(key, apply(rows));
  }, []);

  const fetchRange = useCallback(async (monday: Date, silent = false) => {
    const req    = ++rangeReq.current;
    const cached = weekCache.current.get(`${location}|${toDateStr(monday)}`);
    if (cached) setReservations(cached);
    if (!silent) setLoading(!cached);

    // One query covers the previous and the next week too, so stepping through
    // the calendar shows appointments immediately.
    const { data, error } = await supabase
      .from("reservations")
      .select(`*, reservation_services(services(id, name, price))`)
      .eq("location", location)
      .gte("date", toDateStr(addDays(monday, -7)))
      .lte("date", toDateStr(addDays(monday, 13)))
      .order("date")
      .order("start_time");

    if (error) {
      if (req === rangeReq.current) {
        setLoading(false);
        setNotice("Termini nisu učitani. Proveri internet vezu.");
      }
      return;
    }

    const rows = (data as ReservationFull[]) ?? [];
    for (const offset of [-7, 0, 7]) {
      const from = toDateStr(addDays(monday, offset));
      const to   = toDateStr(addDays(monday, offset + 6));
      weekCache.current.set(`${location}|${from}`, rows.filter(r => r.date >= from && r.date <= to));
    }

    if (req !== rangeReq.current) return;
    setReservations(weekCache.current.get(`${location}|${toDateStr(monday)}`) ?? []);
    setLoading(false);
  }, [location]);

  // All services (for combo-package pricing in the detail modal) and every
  // studio's price history - a reservation is priced as it was when booked.
  useEffect(() => {
    if (!authenticated) return;
    supabase.from("services").select("id, name, price")
      .then(({ data }) => setAllServices((data as ServiceRef[]) ?? []));
    void fetchPriceRows().then(rows => { if (rows) setPriceBook(new PriceBook(rows)); });
  }, [authenticated]);

  const fetchPendingCalls = useCallback(async (silent = false) => {
    const req = ++callsReq.current;
    if (!silent) setCallsLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select(`*, reservation_services(services(id, name, price))`)
      .eq("location", location)
      .eq("status", "confirmed")
      .neq("call_status", "answered")
      .gte("date", toDateStr(new Date()))
      .order("date")
      .order("start_time");

    if (req !== callsReq.current) return;
    if (error) {
      // Keep the queue already on screen rather than showing "no calls".
      setCallsLoading(false);
      if (!silent) setNotice("Pozivi nisu učitani. Proveri internet vezu.");
      return;
    }

    const queue = (data as ReservationFull[]) ?? [];

    // Keep only first-time clients: email must appear exactly once across all
    // confirmed reservations - in either studio, a client is new to the brand,
    // not to the address. Cancelled and blacklisted bookings do not count —
    // the client never actually came. Compared case-insensitively because the
    // email column has mixed casing.
    if (queue.length === 0) {
      setCallReservations([]);
      setCallsLoading(false);
      return;
    }

    // Every page of it: cut off at 1000 rows, a new client could drop out of
    // the call list, or a regular could be shown as new.
    let history: { customer_email: string | null }[];
    try {
      history = await fetchAll<{ customer_email: string | null }>((from, to) =>
        supabase
          .from("reservations")
          .select("customer_email")
          .eq("status", "confirmed")
          .order("id")
          .range(from, to));
    } catch {
      if (req !== callsReq.current) return;
      setCallsLoading(false);
      if (!silent) setNotice("Pozivi nisu učitani. Proveri internet vezu.");
      return;
    }
    if (req !== callsReq.current) return;

    const counts = new Map<string, number>();
    for (const row of history) {
      const key = (row.customer_email ?? "").trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const firstTimers = queue.filter((r) => {
      const key = (r.customer_email ?? "").trim().toLowerCase();
      return counts.get(key) === 1;
    });

    setCallReservations(firstTimers);
    setCallsLoading(false);
  }, [location]);

  const searchReq = useRef(0);

  // ── Client search — debounced, matches name / email / phone ───────────────
  const searchClients = useCallback(async (raw: string) => {
    // Commas and parentheses are PostgREST `or=` syntax; strip them so a stray
    // character can't turn into a broken filter.
    const q = raw.trim().replace(/[,()]/g, "");
    if (q.length < 2) {
      setClientGroups([]);
      setClientsSearched(false);
      return;
    }
    setClientsLoading(true);
    const req = ++searchReq.current;
    const { data, error } = await supabase
      .from("reservations")
      .select(`*, reservation_services(services(id, name, price))`)
      .eq("location", location)
      .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      .order("date", { ascending: false })
      .limit(300);
    // A slower answer to an older query must not replace the newer one.
    if (req !== searchReq.current) return;
    if (error) {
      // Not "no results" - staff would conclude the client does not exist.
      setClientsLoading(false);
      setNotice("Pretraga nije uspela. Proveri internet vezu.");
      return;
    }
    setClientGroups(groupByClient((data as ReservationFull[]) ?? []));
    setClientsSearched(true);
    setClientsLoading(false);
  }, [location]);

  useEffect(() => {
    if (!authenticated || activeTab !== "clients") return;
    const t = setTimeout(() => { void searchClients(clientQuery); }, 300);
    return () => clearTimeout(t);
  }, [authenticated, activeTab, clientQuery, searchClients]);

  useEffect(() => {
    if (authenticated) fetchRange(weekStart);
  }, [authenticated, weekStart, fetchRange]);

  useEffect(() => {
    if (authenticated) fetchPendingCalls();
  }, [authenticated, fetchPendingCalls]);

  // ── Working hours: load + edit ─────────────────────────────────────────────
  const availReq = useRef(0);
  const fetchAvail = useCallback(async () => {
    const req = ++availReq.current;
    // On a failed load keep the schedule already on screen.
    try {
      const data = await fetchAvailability(location);
      if (req === availReq.current) setAvailability(data);
    } catch { /* keep current */ }
  }, [location]);

  const staffReq = useRef(0);
  const fetchStaffAll = useCallback(async () => {
    const req = ++staffReq.current;
    // Same as hours: a failed load keeps what is on screen.
    try {
      const [people, schedule] = await Promise.all([fetchStaff(), fetchStaffSchedule(location)]);
      if (req !== staffReq.current) return;
      setStaff(people);
      setStaffSchedule(schedule);
    } catch { /* keep current */ }
  }, [location]);

  function handleLocationChange(next: typeof location) {
    if (next === location) return;
    // Nothing from the other studio may linger on screen while the new one loads.
    setReservations([]);
    setCallReservations([]);
    setClientGroups([]);
    setClientsSearched(false);
    setAvailability(EMPTY_AVAILABILITY);
    setStaffSchedule(EMPTY_STAFF_SCHEDULE);
    setSelected(null);
    setOverrideDate(null);
    setLocation(next);
  }

  useEffect(() => {
    if (authenticated) fetchAvail();
  }, [authenticated, fetchAvail]);

  useEffect(() => {
    if (authenticated) fetchStaffAll();
  }, [authenticated, fetchStaffAll]);

  // Keep the calendar current without a manual reload: new bookings come in
  // from the public site while the panel is open.
  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current < REFRESH_THROTTLE_MS) return;
      lastRefresh.current = Date.now();
      void fetchRange(weekStart, true);
      void fetchPendingCalls(true);
      void fetchAvail();
      void fetchStaffAll();
    };
    const timer = setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [authenticated, weekStart, fetchRange, fetchPendingCalls, fetchAvail, fetchStaffAll]);

  // Escape closes whichever dialog is on top.
  useEffect(() => {
    if (!selected && !overrideDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelected(null);
      setOverrideDate(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, overrideDate]);

  /** A working-hours save failed: say so and put the real schedule back on screen. */
  function hoursSaveFailed() {
    setNotice("Radno vreme nije sačuvano. Pokušaj ponovo.");
    void fetchAvail();
  }

  async function saveTemplateDay(weekday: number, windows: BusinessWindow[]) {
    setAvailability((prev) => ({
      ...prev,
      template: prev.template.map((w, i) => (i === weekday ? windows : w)),
    }));
    const { error } = await supabase
      .from("weekly_schedule")
      .upsert({ location, weekday, windows: windows as unknown as Json }, { onConflict: "location,weekday" });
    if (error) hoursSaveFailed();
  }

  function openOverride(dateStr: string) {
    setOverrideDraft(resolveWindows(dateStr, availability) ?? []);
    setOverrideStaffDraft(resolveStaff(dateStr, staffSchedule));
    setOverrideDate(dateStr);
  }

  function sameWindows(a: BusinessWindow[], b: BusinessWindow[]) {
    return a.length === b.length && a.every((w, i) => w.start === b[i].start && w.end === b[i].end);
  }

  /**
   * Saves the day's dialog. Hours and staff are separate exceptions: one that
   * still matches the weekly template (and was not an exception already) is
   * not written, so changing only who works does not freeze that day's hours.
   */
  async function saveOverride(dateStr: string, windows: BusinessWindow[], staffIds: string[]) {
    setOverrideDate(null);
    const tasks: Promise<void>[] = [];

    const hoursOverridden = dateStr in availability.overrides;
    const templateWindows = availability.template[weekdayOf(dateStr)] ?? [];
    if (hoursOverridden || !sameWindows(windows, templateWindows)) {
      setAvailability((prev) => ({
        ...prev,
        overrides: { ...prev.overrides, [dateStr]: windows },
      }));
      tasks.push((async () => {
        const { error } = await supabase.from("availability_overrides").upsert(
          { location, date: dateStr, windows: windows as unknown as Json, updated_at: new Date().toISOString() },
          { onConflict: "location,date" },
        );
        if (error) hoursSaveFailed();
      })());
    }

    const staffOverridden = dateStr in staffSchedule.overrides;
    const templateStaff = staffSchedule.template[weekdayOf(dateStr)] ?? [];
    if (staffOverridden || !sameStaff(staffIds, templateStaff)) {
      setStaffSchedule((prev) => ({
        ...prev,
        overrides: { ...prev.overrides, [dateStr]: staffIds },
      }));
      tasks.push((async () => {
        const { error } = await supabase.from("staff_overrides").upsert(
          { location, date: dateStr, staff_ids: staffIds, updated_at: new Date().toISOString() },
          { onConflict: "location,date" },
        );
        if (error) staffSaveFailed();
      })());
    }

    await Promise.all(tasks);
  }

  /** Back to the weekly template - both the hours and who works. */
  async function clearOverride(dateStr: string) {
    setAvailability((prev) => {
      const overrides = { ...prev.overrides };
      delete overrides[dateStr];
      return { ...prev, overrides };
    });
    setStaffSchedule((prev) => {
      const overrides = { ...prev.overrides };
      delete overrides[dateStr];
      return { ...prev, overrides };
    });
    setOverrideDate(null);
    const [hoursRes, staffRes] = await Promise.all([
      supabase.from("availability_overrides").delete().eq("location", location).eq("date", dateStr),
      supabase.from("staff_overrides").delete().eq("location", location).eq("date", dateStr),
    ]);
    if (hoursRes.error) hoursSaveFailed();
    if (staffRes.error) staffSaveFailed();
  }

  // ── Who works: team list + weekly template ─────────────────────────────────
  function staffSaveFailed() {
    setNotice("Raspored zaposlenih nije sačuvan. Pokušaj ponovo.");
    void fetchStaffAll();
  }

  async function saveTemplateStaff(weekday: number, staffIds: string[]) {
    setStaffSchedule((prev) => ({
      ...prev,
      template: prev.template.map((ids, i) => (i === weekday ? staffIds : ids)),
    }));
    const { error } = await supabase
      .from("staff_weekly")
      .upsert({ location, weekday, staff_ids: staffIds }, { onConflict: "location,weekday" });
    if (error) staffSaveFailed();
  }

  async function addStaffMember() {
    const name = newStaffName.trim();
    if (!name) return;
    setNewStaffName("");
    const { data, error } = await supabase.from("staff").insert({ name }).select("id, name, active").single();
    if (error || !data) { staffSaveFailed(); return; }
    setStaff((prev) => [...prev, data]);
  }

  async function renameStaffMember(id: string, name: string) {
    const trimmed = name.trim();
    const current = staff.find((m) => m.id === id);
    if (!trimmed || !current || current.name === trimmed) return;
    setStaff((prev) => prev.map((m) => (m.id === id ? { ...m, name: trimmed } : m)));
    const { error } = await supabase.from("staff").update({ name: trimmed }).eq("id", id);
    if (error) staffSaveFailed();
  }

  /**
   * Takes someone off the team. They are only hidden, never deleted, and are
   * taken off both studios' weekly templates so they stop showing up. Dates
   * already set as exceptions keep them until edited.
   */
  async function removeStaffMember(id: string) {
    setStaff((prev) => prev.map((m) => (m.id === id ? { ...m, active: false } : m)));
    setStaffSchedule((prev) => ({ ...prev, template: prev.template.map((ids) => ids.filter((x) => x !== id)) }));
    const { error } = await supabase.from("staff").update({ active: false }).eq("id", id);
    if (error) { staffSaveFailed(); return; }
    const { data: rows, error: readError } = await supabase
      .from("staff_weekly")
      .select("location, weekday, staff_ids")
      .contains("staff_ids", [id]);
    if (readError) { staffSaveFailed(); return; }
    const results = await Promise.all((rows ?? []).map((row) =>
      supabase
        .from("staff_weekly")
        .update({ staff_ids: row.staff_ids.filter((x) => x !== id) })
        .eq("location", row.location)
        .eq("weekday", row.weekday)));
    if (results.some((r) => r.error)) staffSaveFailed();
  }

  function handleLogout() {
    void signOut();
  }

  const handlePrev = () => {
    if (window.innerWidth < 768) {
      const next = addDays(selectedDate, -1);
      setSelectedDate(next);
      setWeekStart(getMonday(next));
    } else {
      setWeekStart(d => addDays(d, -7));
    }
  };

  const handleNext = () => {
    if (window.innerWidth < 768) {
      const next = addDays(selectedDate, 1);
      setSelectedDate(next);
      setWeekStart(getMonday(next));
    } else {
      setWeekStart(d => addDays(d, 7));
    }
  };

  const goToday = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    setSelectedDate(d);
    setWeekStart(getMonday(d));
  };

  function priceFor(r: ReservationFull, isFirstTreatment: boolean): PriceResult | null {
    // Without the price list a wrong number would be worse than none.
    if (!priceBook) return null;
    const bookedAt = r.created_at;
    const base = priceBook.apply(
      r.reservation_services.map(rs => rs.services).filter((s): s is ServiceRef => s !== null),
      r.location, bookedAt);
    const effective = applyComboRules(base, priceBook.apply(allServices, r.location, bookedAt));
    const listPrice = effective.reduce((sum, s) => sum + s.price, 0);
    return computeReservationPrice({
      listPrice,
      isFirstTreatment,
      createdAt: r.created_at,
      promoCode: r.promo_code,
    });
  }

  async function openModal(r: ReservationFull) {
    setSelected(r);
    setNewStatus(r.status);
    setNewNotes(r.notes ?? "");
    setSelectedIsReturning(null);
    setSelectedIsBlacklisted(false);
    // Show a price immediately (assume first treatment); refine once history loads.
    setSelectedPrice(priceFor(r, true));
    const req = ++modalReq.current;
    if (r.customer_email) {
      // One round trip for the client's whole relevant history.
      const { data, error } = await supabase
        .from("reservations")
        .select("id, date, start_time, status")
        .ilike("customer_email", escapeLike(r.customer_email))
        .in("status", ["confirmed", "blacklisted"]);
      // Another reservation was opened meanwhile — this answer is not for it.
      if (req !== modalReq.current) return;
      // Without the history, leave the badges out rather than guess.
      if (error) return;

      const history = (data as { id: string; date: string; start_time: string; status: ReservationStatus }[] | null) ?? [];
      const rows = history.filter(h => h.status === "confirmed");
      const others = rows.filter(h => h.id !== r.id);
      setSelectedIsReturning(others.length > 0);
      // First treatment = this reservation is the client's earliest confirmed one.
      const sorted = [...rows].sort((a, b) =>
        a.date !== b.date ? a.date.localeCompare(b.date) : a.start_time.localeCompare(b.start_time));
      const isFirst = rows.length === 0 ? true : sorted[0]?.id === r.id;
      setSelectedPrice(priceFor(r, isFirst));

      // The blacklist marks a person, not a single booking: flag the client if
      // ANY of their other reservations was blacklisted.
      setSelectedIsBlacklisted(history.some(h => h.status === "blacklisted" && h.id !== r.id));
    } else {
      setSelectedIsReturning(false);
    }
  }

  async function handleStatusSave() {
    if (!selected) return;
    setSaving(true);
    const trimmedNotes = newNotes.trim() || null;
    const { error } = await supabase
      .from("reservations")
      .update({ status: newStatus, notes: trimmedNotes })
      .eq("id", selected.id);
    if (error) {
      console.error("Status update failed:", error);
      setNotice("Izmene nisu sačuvane. Pokušaj ponovo.");
      setSaving(false);
      return;
    }
    patchReservation(selected.id, { status: newStatus, notes: trimmedNotes });
    // Only confirmed appointments are waiting for a call.
    if (newStatus !== "confirmed") {
      setCallReservations(prev => prev.filter(r => r.id !== selected.id));
    }
    // The client search holds its own copy of the same rows — re-group it so a
    // status changed from the search results is reflected there too (badges,
    // visit counts and the blacklist flag are all derived from status).
    setClientGroups((prev) => {
      if (prev.length === 0) return prev;
      const touched = prev.some(g => g.reservations.some(r => r.id === selected.id));
      if (!touched) return prev;
      return groupByClient(
        prev.flatMap(g => g.reservations).map(r =>
          r.id === selected.id ? { ...r, status: newStatus, notes: trimmedNotes } : r),
      );
    });
    setSaving(false);
    setSelected(null);
  }

  /**
   * No student ID at the treatment - strip the code so every price in the app
   * (calendar, finances, stats) recomputes at full price, and record why.
   */
  async function handleRevokeStudentDiscount() {
    if (!selected) return;
    setSaving(true);
    const stamp = new Date().toLocaleDateString("sr-RS");
    const revokedNote = [newNotes.trim(), `Studentski popust ukinut ${stamp} - bez indeksa.`]
      .filter(Boolean)
      .join(" · ");
    const { error } = await supabase
      .from("reservations")
      .update({ promo_code: null, notes: revokedNote })
      .eq("id", selected.id);
    if (error) {
      console.error("Revoking the student discount failed:", error);
      setNotice("Popust nije ukinut. Pokušaj ponovo.");
      setSaving(false);
      return;
    }
    patchReservation(selected.id, { promo_code: null, notes: revokedNote });
    setNewNotes(revokedNote);
    setSelectedPrice((prev) =>
      prev ? { ...prev, finalPrice: prev.listPrice, studentOff: false, promoCode: null, kind: "none" } : prev
    );
    setSaving(false);
  }

  // ── Call action handlers ───────────────────────────────────────────────────
  // Each one touches the screen only after the database accepted the change.
  const CALL_SAVE_FAILED = "Poziv nije sačuvan. Pokušaj ponovo.";

  async function handleCallAnswered(reservationId: string) {
    const { error } = await supabase
      .from("reservations")
      .update({ call_status: "answered" })
      .eq("id", reservationId);
    if (error) { setNotice(CALL_SAVE_FAILED); return; }
    setCallReservations(prev => prev.filter(r => r.id !== reservationId));
    patchReservation(reservationId, { call_status: "answered" });
  }

  async function handleCallNoAnswer(reservationId: string) {
    const attemptedAt = new Date().toISOString();
    const { error } = await supabase
      .from("reservations")
      .update({ call_status: "no_answer", call_attempted_at: attemptedAt })
      .eq("id", reservationId);
    if (error) { setNotice(CALL_SAVE_FAILED); return; }
    setCallReservations(prev =>
      prev.map(r => r.id === reservationId ? { ...r, call_status: "no_answer", call_attempted_at: attemptedAt } : r)
    );
    patchReservation(reservationId, { call_status: "no_answer", call_attempted_at: attemptedAt });
  }

  async function handleExpiredCancel(reservationId: string) {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId);
    if (error) { setNotice("Termin nije otkazan. Pokušaj ponovo."); return; }
    setCallReservations(prev => prev.filter(r => r.id !== reservationId));
    // The calendar holds the same appointment — it must show as cancelled too.
    patchReservation(reservationId, { status: "cancelled" });
    setExpandedExpired(null);
  }

  // ── Derived state — confirmed future reservations not yet answered ────────
  const callQueue = callReservations;
  const badgeCount = callQueue.length;

  const ds        = toDateStr(selectedDate);
  const todayStr  = toDateStr(now);
  const nowMin    = now.getHours() * 60 + now.getMinutes();
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd   = addDays(weekStart, 6);

  const staffById = useMemo(() => new Map(staff.map((m) => [m.id, m])), [staff]);

  /** Everything the calendar needs to know about each of the seven days. */
  const days = useMemo(() => weekDates.map((date) => {
    const dateStr = toDateStr(date);
    const rows    = reservations.filter(r => r.date === dateStr);
    return {
      date,
      dateStr,
      windows: resolveWindows(dateStr, availability),
      hasOverride: dateStr in availability.overrides || dateStr in staffSchedule.overrides,
      staffNames: resolveStaff(dateStr, staffSchedule)
        .map((id) => staffById.get(id)?.name)
        .filter((n): n is string => !!n),
      activeCount: rows.filter(isActive).length,
      desktop: layoutDay(rows, MIN_CARD_PX_DESKTOP / PX_PER_MIN),
      mobile:  layoutDay(rows, MIN_CARD_PX_MOBILE / PX_PER_MIN),
    };
  }), [weekDates, reservations, availability, staffSchedule, staffById]);

  // The grid spans the week's working hours and appointments (plus a margin),
  // so the screen is not spent on hours when nobody is in the studio.
  const { gridStart, gridEnd } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const day of days) {
      for (const w of day.windows ?? []) { lo = Math.min(lo, w.start); hi = Math.max(hi, w.end); }
      for (const r of day.desktop) {
        const start = timeToMinutes(r.start_time);
        lo = Math.min(lo, start);
        hi = Math.max(hi, start + r.total_duration, timeToMinutes(r.end_time));
      }
    }
    if (!Number.isFinite(lo)) return { gridStart: FALLBACK_START, gridEnd: FALLBACK_END };
    return {
      gridStart: Math.max(0, Math.floor((lo - 30) / 60) * 60),
      gridEnd:   Math.min(24 * 60, Math.ceil((hi + 30) / 60) * 60),
    };
  }, [days]);
  const gridHeight = toHeight(gridEnd - gridStart);
  const hourMarks  = useMemo(
    () => Array.from({ length: (gridEnd - gridStart) / 60 + 1 }, (_, i) => gridStart + i * 60),
    [gridStart, gridEnd],
  );

  const overrideIsException = !!overrideDate
    && (overrideDate in availability.overrides || overrideDate in staffSchedule.overrides);

  /** The day the phone layout shows (it has room for one). */
  const mobileDay = days.find(d => d.dateStr === ds) ?? days[0];

  /** Today's working hours for the header — from the schedule, whichever week is on screen. */
  const todayWindows = resolveWindows(todayStr, availability);
  const openNow      = (todayWindows ?? []).find(w => nowMin >= w.start && nowMin < w.end) ?? null;
  const opensLater   = (todayWindows ?? []).find(w => w.start > nowMin) ?? null;

  // ── Password screen ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return <AdminLogin icon={Calendar} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  // ── Calendar screen ─────────────────────────────────────────────────────────
  return (
    <main className="box-border h-dvh max-h-dvh flex flex-col bg-background overflow-hidden pt-16 text-foreground admin-theme" style={locationTheme(location)}>
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      {/* Header */}
      <header className="bg-surface border-b-2 border-accent/40 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between gap-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="hidden md:block border-r border-foreground/10 pr-6">
            <h1 className="text-xl font-bold font-playfair tracking-tight">Infinity Laser Studio</h1>
            <p className="text-[10px] text-foreground/50 font-bold font-poppins uppercase tracking-widest mt-0.5">Control Center</p>
          </div>

          <AdminLocationSwitch value={location} onChange={handleLocationChange} />

          {/* Is the studio working right now */}
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-foreground/3 border border-foreground/5">
            <span className="relative flex w-2.5 h-2.5 shrink-0">
              {openNow && <span className="absolute inset-0 rounded-full bg-green-400/60 animate-ping" />}
              <span className={`relative w-2.5 h-2.5 rounded-full ${openNow ? "bg-green-400" : "bg-foreground/25"}`} />
            </span>
            <div className="leading-tight">
              <p className={`text-[11px] font-bold font-poppins uppercase tracking-wider ${openNow ? "text-green-400" : "text-foreground/68"}`}>
                {openNow ? `Otvoreno do ${fmtMin(openNow.end)}` : opensLater ? `Otvara se u ${fmtMin(opensLater.start)}` : "Zatvoreno"}
              </p>
              <p className="text-[10px] font-medium font-poppins text-foreground/55 tabular-nums">
                Danas: {fmtWindows(todayWindows) ?? "ne radi"}
              </p>
            </div>
          </div>

          {/* Legend — what a card's look means */}
          <div className="hidden xl:flex items-center gap-4 text-[11px] font-bold font-poppins text-foreground/60 uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <span className="w-4 h-3.5 rounded border-l-4 border-green-400 bg-green-400/20" />
              Potvrđeno
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-3.5 rounded border border-dashed border-red-400/60 bg-red-400/10" />
              Otkazano
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-3.5 rounded border border-foreground/30 bg-foreground/10" />
              Crna lista
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/60 hover:text-red-400 hover:bg-red-400/10 transition-all font-poppins text-xs font-bold cursor-pointer"
        >
          <LogOut size={16} />
          <span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      {/* Navigation */}
      <div className="bg-surface border-b border-foreground/5 px-4 md:px-8 py-3 md:py-4 shrink-0 z-10 shadow-xs">
        <div className="max-w-400 mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Tab Switcher */}
          <div className="flex items-center bg-foreground/3 rounded-2xl p-1 shadow-inner self-start md:self-auto">
            <button
              onClick={() => setActiveTab("calendar")}
              className={`h-9 px-5 flex items-center gap-2 rounded-xl text-xs font-bold font-poppins uppercase tracking-widest transition-all ${
                activeTab === "calendar"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-foreground/60 hover:text-foreground/76"
              }`}
            >
              <Calendar size={14} />
              <span className="hidden sm:inline">Kalendar</span>
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              className={`h-9 px-5 flex items-center gap-2 rounded-xl text-xs font-bold font-poppins uppercase tracking-widest transition-all ${
                activeTab === "calls"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-foreground/60 hover:text-foreground/76"
              }`}
            >
              <Phone size={14} />
              <span className="hidden sm:inline">Pozivi</span>
              {badgeCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-amber-400 text-[#241703]">
                  {badgeCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("clients")}
              className={`h-9 px-5 flex items-center gap-2 rounded-xl text-xs font-bold font-poppins uppercase tracking-widest transition-all ${
                activeTab === "clients"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-foreground/60 hover:text-foreground/76"
              }`}
            >
              <Search size={14} />
              <span className="hidden sm:inline">Klijenti</span>
            </button>
            <button
              onClick={() => setActiveTab("hours")}
              className={`h-9 px-5 flex items-center gap-2 rounded-xl text-xs font-bold font-poppins uppercase tracking-widest transition-all ${
                activeTab === "hours"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-foreground/60 hover:text-foreground/76"
              }`}
            >
              <Clock size={14} />
              <span className="hidden sm:inline">Radno vreme</span>
            </button>
          </div>

          {/* Calendar nav — only visible in calendar tab */}
          {activeTab === "calendar" && (
            <>
              <div className="flex items-center justify-between md:justify-start gap-4 flex-1">
                <div className="flex items-center bg-foreground/3 rounded-2xl p-1 shadow-inner">
                  <button onClick={handlePrev} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/8 transition-all active:scale-90"><ChevronLeft size={20}/></button>
                  <div className="px-4 md:px-8 text-center min-w-35 md:min-w-55">
                    <p className="text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/50 leading-none mb-1 md:hidden">
                      {SR_DAYS_LONG[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}
                    </p>
                    <p className="hidden md:block text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/50 leading-none mb-1">Pregled nedelje</p>
                    <p className="text-sm md:text-base font-bold font-poppins truncate">
                      <span className="md:hidden">{selectedDate.getDate()}. {SR_MONTHS[selectedDate.getMonth()]}</span>
                      <span className="hidden md:inline">{fmtShort(weekStart)} – {fmtShort(weekEnd)}</span>
                    </p>
                  </div>
                  <button onClick={handleNext} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/8 transition-all active:scale-90"><ChevronRight size={20}/></button>
                </div>
                <button onClick={goToday} className="hidden md:flex h-11 px-6 items-center justify-center rounded-2xl border-2 border-accent/30 text-accent text-xs font-bold font-poppins hover:bg-accent/10 transition-all shadow-sm">DANAS</button>
              </div>

              <div className="flex gap-2">
                <button onClick={goToday} className="md:hidden flex-1 h-12 rounded-2xl border-2 border-accent/30 text-accent text-xs font-bold font-poppins active:bg-accent/5 transition-colors">DANAS</button>
                <button
                  onClick={() => setReservationModalOpen(true)}
                  className="flex-2 md:flex-none h-12 md:h-11 flex items-center justify-center gap-2 px-6 md:px-10 rounded-2xl bg-accent text-on-accent text-xs font-bold font-poppins hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95"
                >
                  <CalendarPlus size={18} />
                  <span className="uppercase tracking-widest">Nova rezervacija</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AdminReservationModal
        isOpen={reservationModalOpen}
        location={location}
        onClose={() => setReservationModalOpen(false)}
        onSuccess={() => fetchRange(weekStart)}
      />

      {/* ── Calls Tab ───────────────────────────────────────────────────────── */}
      {activeTab === "calls" && (
        <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain custom-scrollbar">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
            {callsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin shadow-lg" />
              </div>
            )}

            {!callsLoading && callQueue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-green-400/10 border border-green-400/30 flex items-center justify-center">
                  <PhoneCall size={28} className="text-green-400" />
                </div>
                <p className="text-sm font-bold font-poppins text-foreground/60 uppercase tracking-widest">Nema čekajućih poziva</p>
              </div>
            )}

            {!callsLoading && callQueue.map(r => {
              const isExpired = r.call_status === "no_answer" && r.call_attempted_at
                && (Date.now() - new Date(r.call_attempted_at).getTime()) >= 24 * 3_600_000;
              const isNoAnswerRecent = r.call_status === "no_answer" && !isExpired;
              const hoursLeft = (isNoAnswerRecent && r.call_attempted_at)
                ? hoursUntilExpiry(r.call_attempted_at)
                : null;
              const showConfirm = expandedExpired === r.id;

              return (
                <div
                  key={r.id}
                  className={`rounded-2xl border-2 bg-surface shadow-sm overflow-hidden transition-all ${
                    isExpired
                      ? "border-red-400/30"
                      : isNoAnswerRecent
                      ? "border-amber-400/30"
                      : "border-foreground/5"
                  }`}
                >
                  {/* Row */}
                  <div className="p-4 flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      isExpired ? "bg-red-400/10" : isNoAnswerRecent ? "bg-amber-400/10" : "bg-foreground/3"
                    }`}>
                      {isExpired
                        ? <AlertTriangle size={18} className="text-red-400" />
                        : isNoAnswerRecent
                        ? <PhoneOff size={18} className="text-amber-500" />
                        : <Phone size={18} className="text-foreground/50" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold font-poppins text-foreground truncate">{r.customer_name}</p>
                        {r.call_status === "none" && (
                          <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/60 bg-foreground/5 px-2 py-0.5 rounded-lg border border-foreground/8">
                            Nije pozvan
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded-lg border border-red-400/30">
                            Rok istekao
                          </span>
                        )}
                        {isNoAnswerRecent && hoursLeft !== null && (
                          <span className="text-[10px] font-bold font-poppins text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/30">
                            Ponovi za {hoursLeft < 1 ? `${Math.ceil(hoursLeft * 60)} min` : `${Math.ceil(hoursLeft)}h`}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-medium font-poppins text-foreground/68 mt-0.5">
                        {r.customer_phone ?? "—"}
                      </p>
                      <p className="text-[11px] font-poppins text-foreground/50 mt-1">
                        {fmtFull(new Date(`${r.date}T00:00:00`))} · {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      {isExpired ? (
                        <>
                          <button
                            onClick={() => handleCallAnswered(r.id)}
                            className="h-9 px-4 rounded-xl bg-green-400/10 text-green-400 text-[11px] font-bold font-poppins border border-green-400/30 hover:bg-green-400/20 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <PhoneCall size={13} />
                            Javio se
                          </button>
                          <button
                            onClick={() => setExpandedExpired(showConfirm ? null : r.id)}
                            className="h-9 px-4 rounded-xl bg-red-400/10 text-red-400 text-[11px] font-bold font-poppins border border-red-400/30 hover:bg-red-400/20 transition-all active:scale-95"
                          >
                            Otkaži?
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCallAnswered(r.id)}
                            className="h-9 px-4 rounded-xl bg-green-400/10 text-green-400 text-[11px] font-bold font-poppins border border-green-400/30 hover:bg-green-400/20 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <PhoneCall size={13} />
                            Javio se
                          </button>
                          <button
                            onClick={() => handleCallNoAnswer(r.id)}
                            className="h-9 px-4 rounded-xl bg-foreground/3 text-foreground/68 text-[11px] font-bold font-poppins border border-foreground/5 hover:bg-amber-400/10 hover:text-amber-300 hover:border-amber-400/30 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <PhoneOff size={13} />
                            Nije se javio
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline confirm for expired */}
                  {showConfirm && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="rounded-xl bg-red-400/10 border border-red-400/30 p-4 space-y-3">
                        <p className="text-[12px] font-poppins text-red-400 font-medium">
                          Rok od 24h je istekao. Otkazati ovaj termin?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleExpiredCancel(r.id)}
                            className="flex-1 h-10 rounded-xl bg-red-500 text-white text-[11px] font-bold font-poppins hover:bg-red-600 transition-all active:scale-95"
                          >
                            Otkaži termin
                          </button>
                          <button
                            onClick={() => setExpandedExpired(null)}
                            className="flex-1 h-10 rounded-xl bg-surface text-foreground/68 text-[11px] font-bold font-poppins border border-foreground/10 hover:bg-foreground/3 transition-all active:scale-95"
                          >
                            Ostavi na čekanju
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Clients Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "clients" && (
        <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain custom-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-6">

            {/* Search field */}
            <div className="relative mb-5">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/42 pointer-events-none" />
              <input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Ime, email ili telefon…"
                autoFocus
                className="w-full h-13 pl-12 pr-11 rounded-2xl border-2 border-foreground/10 bg-surface font-poppins text-sm focus:outline-none focus:border-accent/40 transition-colors shadow-sm"
              />
              {clientQuery && (
                <button
                  type="button"
                  onClick={() => setClientQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/5 hover:text-foreground/76 transition-colors cursor-pointer"
                  aria-label="Očisti pretragu"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {clientsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin shadow-lg" />
              </div>
            )}

            {!clientsLoading && clientQuery.trim().length < 2 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-foreground/3 border border-foreground/8 flex items-center justify-center">
                  <Search size={28} className="text-foreground/38" />
                </div>
                <p className="text-sm font-bold font-poppins text-foreground/60 uppercase tracking-widest">Unesite bar dva slova</p>
                <p className="text-xs font-poppins text-foreground/55 text-center max-w-xs leading-relaxed">
                  Pretražuje se cela istorija — ime, email i telefon, bez obzira na datum termina.
                </p>
              </div>
            )}

            {!clientsLoading && clientsSearched && clientGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-foreground/3 border border-foreground/8 flex items-center justify-center">
                  <User size={28} className="text-foreground/38" />
                </div>
                <p className="text-sm font-bold font-poppins text-foreground/60 uppercase tracking-widest">Nema rezultata</p>
              </div>
            )}

            {!clientsLoading && clientGroups.length > 0 && (
              <>
                <p className="text-[11px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mb-3 px-1">
                  {clientGroups.length} {srPlural(clientGroups.length, "klijent", "klijenta", "klijenata")}
                </p>
                <div className="space-y-3">
                  {clientGroups.map((c) => {
                    const open = expandedClient === c.email;
                    return (
                      <div
                        key={c.email}
                        className={`rounded-2xl border-2 bg-surface shadow-sm overflow-hidden transition-all ${
                          c.blacklisted ? "border-red-400/30" : "border-foreground/5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedClient(open ? null : c.email)}
                          className="w-full p-4 flex items-start gap-4 text-left cursor-pointer hover:bg-foreground/1 transition-colors"
                        >
                          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                            c.blacklisted ? "bg-red-400/10" : "bg-accent/8"
                          }`}>
                            {c.blacklisted
                              ? <Ban size={18} className="text-red-400" />
                              : <User size={18} className="text-accent" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold font-poppins text-foreground truncate">{c.name}</p>
                              {c.blacklisted && (
                                <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded-lg border border-red-400/30">
                                  Crna lista
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] font-medium font-poppins text-foreground/68 mt-0.5 truncate">{c.email}</p>
                            <p className="text-[11px] font-poppins text-foreground/55 mt-0.5">{c.phone ?? "—"}</p>

                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-[11px] font-bold font-poppins text-accent bg-accent/8 px-2 py-0.5 rounded-lg">
                                {c.visits} {srPlural(c.visits, "dolazak", "dolaska", "dolazaka")}
                              </span>
                              {c.cancelled > 0 && (
                                <span className="text-[11px] font-poppins text-foreground/60">
                                  {c.cancelled} otkazano
                                </span>
                              )}
                              {c.lastVisit && (
                                <span className="text-[11px] font-poppins text-foreground/60">
                                  poslednji put {fmtShort(new Date(`${c.lastVisit}T00:00:00`))}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight
                            size={18}
                            className={`shrink-0 text-foreground/38 mt-1 transition-transform ${open ? "rotate-90" : ""}`}
                          />
                        </button>

                        {open && (
                          <div className="px-4 pb-4 pt-0 space-y-2">
                            {c.reservations.map((r) => {
                              const st = STATUS_STYLES[r.status] ?? UNKNOWN_STATUS_STYLE;
                              const services = r.reservation_services
                                .map(rs => rs.services?.name).filter(Boolean).join(", ");
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => openModal(r)}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-foreground/8 hover:border-accent/30 hover:bg-accent/10 transition-all text-left cursor-pointer"
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold font-poppins text-foreground/82">
                                      {fmtFull(new Date(`${r.date}T00:00:00`))} · {r.start_time.slice(0, 5)}
                                    </p>
                                    {services && (
                                      <p className="text-[11px] font-poppins text-foreground/60 truncate mt-0.5">{services}</p>
                                    )}
                                  </div>
                                  <span className={`shrink-0 text-[10px] font-bold font-poppins uppercase tracking-wider px-2 py-1 rounded-lg ${st.bg} ${st.text}`}>
                                    {st.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Working Hours Tab ────────────────────────────────────────────────── */}
      {activeTab === "hours" && (
        <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain custom-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Team */}
            <div className="mb-8">
              <h2 className="text-lg font-bold font-playfair">Zaposleni</h2>
              <p className="text-xs font-poppins text-foreground/64 mt-1 mb-4 leading-relaxed">
                Ista lista važi za oba studija. Ime možeš da izmeniš direktno u polju.
              </p>
              <div className="rounded-2xl border border-foreground/8 bg-surface p-4 shadow-sm space-y-2">
                {staff.filter((m) => m.active).map((m) => (
                  <div key={`${m.id}:${m.name}`} className="flex items-center gap-2">
                    <input
                      defaultValue={m.name}
                      onBlur={(e) => renameStaffMember(m.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      aria-label="Ime zaposlenog"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-foreground/10 bg-transparent font-poppins text-sm focus:outline-none focus:border-accent/40 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => removeStaffMember(m.id)}
                      className="shrink-0 h-9 px-3 rounded-lg bg-red-400/10 border border-red-400/30 text-[11px] font-bold font-poppins text-red-400 hover:bg-red-400/20 transition-all cursor-pointer"
                    >
                      Ukloni
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => { e.preventDefault(); void addStaffMember(); }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Ime novog zaposlenog"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-foreground/10 bg-transparent font-poppins text-sm focus:outline-none focus:border-accent/40 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newStaffName.trim()}
                    className="shrink-0 h-9 px-3 rounded-lg bg-accent/10 border border-accent/15 text-accent text-[11px] font-bold font-poppins hover:bg-accent/15 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default flex items-center gap-1"
                  >
                    <Plus size={13} /> Dodaj
                  </button>
                </form>
              </div>
            </div>

            <div className="mb-5">
              <h2 className="text-lg font-bold font-playfair">Nedeljni šablon radnog vremena</h2>
              <p className="text-xs font-poppins text-foreground/64 mt-1 leading-relaxed">
                Podrazumevano radno vreme i ko radi po danu. Izmene se čuvaju odmah. Za poseban
                raspored na pojedinačan datum, klikni na zaglavlje dana u kalendaru (izuzetak).
              </p>
            </div>
            <div className="space-y-3">
              {SR_DAYS_LONG.map((dayName, idx) => (
                <div key={dayName} className="rounded-2xl border border-foreground/8 bg-surface p-4 shadow-sm">
                  <p className="text-sm font-bold font-poppins text-foreground/82 mb-3">{dayName}</p>
                  <WindowsEditor
                    windows={availability.template[idx] ?? []}
                    onChange={(next) => saveTemplateDay(idx, next)}
                  />
                  <p className="mt-4 mb-2 text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/55">Ko radi</p>
                  <StaffPicker
                    staff={staff}
                    selected={staffSchedule.template[idx] ?? []}
                    onChange={(next) => saveTemplateStaff(idx, next)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "calendar" && (
        <div className="flex-1 min-h-0 flex flex-col relative isolate bg-background">
          {/* Loading: a thin bar — the calendar underneath stays readable */}
          <div
            aria-hidden
            className={`absolute top-0 inset-x-0 h-0.5 z-30 overflow-hidden pointer-events-none transition-opacity duration-300 ${loading ? "opacity-100" : "opacity-0"}`}
          >
            {loading && <div className="admin-loading-bar h-full w-1/3 bg-accent" />}
          </div>

          <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain custom-scrollbar">
            <div className="max-w-400 mx-auto min-w-full">

              {/* Day headers */}
              <div className="sticky top-0 z-20 bg-surface border-b border-foreground/8 shadow-md shadow-black/20">

                {/* Phone — the whole week as a strip, then the chosen day's hours */}
                <div className="md:hidden">
                  <div className="grid grid-cols-7 gap-1 px-2 pt-2">
                    {days.map((day, i) => {
                      const isSelected = day.dateStr === mobileDay.dateStr;
                      const isDayToday = day.dateStr === todayStr;
                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          onClick={() => setSelectedDate(day.date)}
                          aria-pressed={isSelected}
                          className={`flex flex-col items-center py-1.5 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-accent border-accent text-on-accent"
                              : isDayToday
                              ? "border-accent/50 text-accent"
                              : day.windows
                              ? "border-transparent text-foreground/82 active:bg-foreground/5"
                              : "border-transparent text-foreground/50 active:bg-foreground/5"
                          }`}
                        >
                          <span className="text-[9px] font-bold font-poppins uppercase tracking-wider opacity-70">{SR_DAYS_SHORT[i]}</span>
                          <span className="text-base font-bold font-poppins leading-tight tabular-nums">{day.date.getDate()}</span>
                          <span className="text-[9px] font-bold font-poppins leading-none h-2.5 tabular-nums">
                            {day.activeCount > 0 ? day.activeCount : day.windows ? "" : "✕"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold font-poppins tabular-nums ${
                        mobileDay.windows ? "bg-accent/15 text-accent" : "bg-foreground/5 text-foreground/60"
                      }`}>
                        {fmtWindows(mobileDay.windows) ?? "Zatvoreno"}
                      </span>
                      <span className="text-[11px] font-medium font-poppins text-foreground/60 truncate">
                        {mobileDay.activeCount} {srPlural(mobileDay.activeCount, "termin", "termina", "termina")}
                        {mobileDay.staffNames.length > 0 ? ` · ${mobileDay.staffNames.join(", ")}` : ""}
                        {mobileDay.hasOverride ? " · izuzetak" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openOverride(mobileDay.dateStr)}
                      className="shrink-0 h-8 px-3 rounded-lg border border-foreground/10 text-[10px] font-bold font-poppins uppercase tracking-wider text-foreground/68 active:bg-foreground/5 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Clock size={12} /> Izmeni dan
                    </button>
                  </div>
                </div>

                {/* Desktop — click a day to edit its hours */}
                <div className="hidden md:grid grid-cols-[80px_repeat(7,1fr)]">
                  <div className="flex items-center justify-center border-r border-foreground/5"><Clock size={14} className="text-foreground/38" /></div>
                  {days.map((day, i) => {
                    const isDayToday = day.dateStr === todayStr;
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => openOverride(day.dateStr)}
                        title="Izmeni radno vreme i ko radi ovaj dan"
                        className={`py-3 px-2 flex flex-col items-center gap-1.5 w-full border-l border-foreground/5 first:border-l-0 cursor-pointer transition-colors ${
                          isDayToday ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-foreground/3"
                        }`}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className={`text-[10px] font-bold font-poppins uppercase tracking-[0.2em] ${isDayToday ? "text-accent" : day.windows ? "text-foreground/64" : "text-foreground/42"}`}>
                            {SR_DAYS_SHORT[i]}
                          </span>
                          <span className={`text-lg font-bold font-poppins leading-none tabular-nums ${isDayToday ? "text-accent" : day.windows ? "text-foreground" : "text-foreground/55"}`}>
                            {day.date.getDate()}
                          </span>
                        </span>
                        <span className={`max-w-full truncate px-2 py-0.5 rounded-md text-[10px] font-bold font-poppins tabular-nums ${
                          day.windows ? "bg-accent/15 text-accent" : "bg-foreground/5 text-foreground/55 uppercase tracking-wider"
                        }`}>
                          {fmtWindows(day.windows) ?? "Zatvoreno"}
                        </span>
                        {day.staffNames.length > 0 && (
                          <span
                            className="max-w-full truncate flex items-center gap-1 text-[10px] font-bold font-poppins text-foreground/72 leading-none"
                            title={day.staffNames.join(", ")}
                          >
                            <Users size={11} className="shrink-0 text-foreground/50" />
                            <span className="truncate">{day.staffNames.join(", ")}</span>
                          </span>
                        )}
                        <span className="text-[10px] font-medium font-poppins text-foreground/55 leading-none">
                          {day.activeCount > 0
                            ? `${day.activeCount} ${srPlural(day.activeCount, "termin", "termina", "termina")}`
                            : "bez termina"}
                          {day.hasOverride && <span className="text-rose font-bold"> · izuzetak</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Body */}
              <div className="grid grid-cols-[52px_1fr] md:grid-cols-[80px_repeat(7,1fr)] py-3">
                <div className="relative border-r border-foreground/5" style={{ height: gridHeight }}>
                  {hourMarks.map((m) => (
                    <div key={m} className="absolute right-0 left-0 flex items-center justify-end px-2 md:px-3 -translate-y-1/2" style={{ top: toHeight(m - gridStart) }}>
                      <span className="text-[10px] md:text-[11px] font-bold font-poppins text-foreground/55 tabular-nums">{fmtMin(m)}</span>
                    </div>
                  ))}
                  {nowMin >= gridStart && nowMin <= gridEnd && days.some(d => d.dateStr === todayStr) && (
                    <div
                      className={`absolute right-1 -translate-y-1/2 z-10 px-1.5 py-0.5 rounded-md bg-accent-soft text-on-accent text-[10px] font-bold font-poppins tabular-nums ${
                        mobileDay.dateStr === todayStr ? "" : "hidden md:block"
                      }`}
                      style={{ top: toHeight(nowMin - gridStart) }}
                    >
                      {fmtMin(nowMin)}
                    </div>
                  )}
                </div>

                {/* Mobile Col */}
                <div className="md:hidden relative" style={{ height: gridHeight }}>
                  {renderDayBody(mobileDay, true)}
                </div>

                {/* Desktop Cols */}
                {days.map((day) => (
                  <div key={day.dateStr} className="hidden md:block relative border-l border-foreground/5 first:border-l-0" style={{ height: gridHeight }}>
                    {renderDayBody(day, false)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {notice && (
        <div className="fixed bottom-6 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
          <button
            type="button"
            role="alert"
            onClick={() => setNotice(null)}
            className="admin-sheet-in pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-red-500 text-white text-xs font-bold font-poppins shadow-2xl shadow-black/50 cursor-pointer"
          >
            <AlertTriangle size={16} className="shrink-0" />
            {notice}
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/75 admin-fade-in" onClick={() => setSelected(null)} />
          <div className="relative z-10 bg-surface border border-foreground/10 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl shadow-black/60 w-full max-w-xl max-h-[92dvh] overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)] admin-sheet-in">
            <div className="md:hidden w-12 h-1.5 bg-foreground/10 rounded-full mx-auto mt-4 mb-2" />

            <div className="flex items-center justify-between px-8 py-6 border-b border-foreground/5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold font-playfair">Rezervacija</h2>
                  {selectedIsReturning === true && (
                    <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded-lg border border-accent/15">
                      Postojeći klijent
                    </span>
                  )}
                  {selectedIsReturning === false && (
                    <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-rose bg-rose/10 px-2.5 py-1 rounded-lg border border-rose/15">
                      Prvi tretman
                    </span>
                  )}
                  {selectedIsBlacklisted && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-poppins uppercase tracking-widest text-red-400 bg-red-400/10 px-2.5 py-1 rounded-lg border border-red-400/30">
                      <Ban size={11} strokeWidth={2.5} />
                      Crna lista
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mt-1">Detaljni pregled klijenta</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-foreground/3 text-foreground/60 hover:bg-red-400/10 hover:text-red-400 transition-all cursor-pointer shrink-0 ml-3"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: User,     label: "Klijent", value: selected.customer_name },
                  { icon: Phone,    label: "Telefon", value: selected.customer_phone ?? "—" },
                  { icon: Mail,     label: "E-mail",  value: selected.customer_email },
                  { icon: Clock,    label: "Vreme",   value: `${selected.start_time.slice(0, 5)} – ${selected.end_time.slice(0, 5)}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-4 rounded-2xl bg-foreground/2 border border-foreground/3">
                    <div className="flex items-center gap-3 mb-1">
                      <Icon size={14} className="text-foreground/38" />
                      <span className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-semibold font-poppins text-foreground/80 truncate px-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-foreground/2 border border-foreground/3">
                 <div className="flex items-center gap-3 mb-2">
                  <Calendar size={14} className="text-foreground/38" />
                  <span className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-wider">Datum tretmana</span>
                </div>
                <p className="text-sm font-semibold font-poppins text-foreground/80">{fmtFull(new Date(`${selected.date}T00:00:00`))}</p>
                <div className="mt-3 text-[11px] font-bold font-poppins text-accent bg-accent/5 inline-flex px-3 py-1.5 rounded-xl border border-accent/10">Trajanje: {selected.total_duration} min</div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest px-1">Usluge</p>
                <div className="flex flex-wrap gap-2">
                  {selected.reservation_services.map(rs => rs.services && (
                    <span key={rs.services.id} className="px-5 py-2.5 bg-surface border border-foreground/5 rounded-2xl text-[13px] font-bold font-poppins text-foreground/82 shadow-sm">
                      {rs.services.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cena i popust */}
              {selectedPrice && (
                <div className="p-4 rounded-2xl bg-foreground/2 border border-foreground/3">
                  <div className="flex items-center gap-3 mb-3">
                    <Tag size={14} className="text-foreground/38" />
                    <span className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-wider">Cena i popust</span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedPrice.fiftyOff && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-rose bg-rose/10 px-2.5 py-1 rounded-lg border border-rose/15">−50% prvi tretman</span>
                      )}
                      {selectedPrice.promoOff && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-green-400 bg-green-400/10 px-2.5 py-1 rounded-lg border border-green-400/30">
                          −10% promo{selectedPrice.promoCode ? ` · ${selectedPrice.promoCode}` : ""}
                        </span>
                      )}
                      {selectedPrice.kind === "bundle" && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded-lg border border-accent/15">
                          Paket{selectedPrice.bundleSessions ? ` ${selectedPrice.bundleSessions}×` : ""} · pun iznos
                        </span>
                      )}
                      {selectedPrice.kind === "bundle_redeem" && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/68 bg-foreground/5 px-2.5 py-1 rounded-lg border border-foreground/8">
                          Paket{selectedPrice.bundleSessions ? ` ${selectedPrice.bundleSessions}×` : ""} · iskorišćen tretman
                        </span>
                      )}
                      {selectedPrice.studentOff && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/30">
                          −20% student · uz indeks
                        </span>
                      )}
                      {selectedPrice.kind === "none" && (
                        <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/60 bg-foreground/5 px-2.5 py-1 rounded-lg border border-foreground/8">Bez popusta</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {(() => {
                        const crossed =
                          selectedPrice.bundleSessions != null
                            ? selectedPrice.listPrice * selectedPrice.bundleSessions
                            : selectedPrice.listPrice;
                        return selectedPrice.finalPrice !== crossed ? (
                          <p className="text-[11px] font-medium font-poppins text-foreground/50 line-through leading-none">{crossed.toLocaleString("sr-RS")} RSD</p>
                        ) : null;
                      })()}
                      <p className="text-lg font-bold font-poppins text-accent leading-tight mt-0.5">{selectedPrice.finalPrice.toLocaleString("sr-RS")} RSD</p>
                    </div>
                  </div>
                  {/* The student discount is the one code nobody could verify while
                      booking - this is where it gets settled against a real index. */}
                  {selectedPrice.studentOff && (
                    <button
                      onClick={handleRevokeStudentDiscount}
                      disabled={saving}
                      className="w-full mt-3 py-2.5 rounded-xl border-2 border-amber-400/30 bg-amber-400/10 text-[11px] font-bold font-poppins uppercase tracking-wider text-amber-300 hover:bg-amber-400/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Čuvam…" : "Nije donela indeks — naplati punu cenu"}
                    </button>
                  )}
                </div>
              )}

              {selected.customer_note && selected.customer_note.trim() && (
                <div className="rounded-2xl bg-amber-400/10 border-2 border-amber-400/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HeartPulse size={16} className="text-amber-300 shrink-0" />
                    <span className="text-[10px] font-bold font-poppins text-amber-300 uppercase tracking-widest">
                      Zdravstvena napomena klijenta
                    </span>
                  </div>
                  <p className="text-sm font-poppins text-amber-300 leading-relaxed whitespace-pre-wrap break-words">
                    {selected.customer_note}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest px-1">
                  <StickyNote size={12} className="text-foreground/50" />
                  Napomena
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Interna napomena (vidi samo admin)…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-foreground/2 border border-foreground/5 font-poppins text-sm text-foreground/80 placeholder:text-foreground/42 focus:outline-none focus:border-accent/40 focus:bg-foreground/4 transition-all resize-none"
                />
              </div>
            </div>

            {/* Status + save stay pinned below the scroll area so they are
                always reachable, however long the details get. */}
            <div className="shrink-0 border-t border-foreground/8 bg-surface px-8 pt-4 pb-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).filter(([key]) => key !== "pending").map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setNewStatus(key)}
                    className={`h-14 rounded-2xl border-2 font-bold font-poppins transition-all flex flex-col items-center justify-center gap-1 ${
                      newStatus === key ? `${s.bg} ${s.border} ${s.text} shadow-md` : "bg-surface border-foreground/5 text-foreground/38 grayscale hover:grayscale-0 hover:border-foreground/10"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="text-[10px] uppercase tracking-widest">{s.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleStatusSave}
                disabled={saving || (newStatus === selected.status && (newNotes.trim() || "") === (selected.notes ?? ""))}
                className="w-full h-14 rounded-2xl bg-accent text-on-accent text-sm font-bold tracking-[0.2em] font-poppins shadow-xl shadow-accent/20 disabled:opacity-40 transition-all active:scale-95 cursor-pointer uppercase"
              >
                {saving ? "..." : "Sačuvaj izmene"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-date override editor */}
      {overrideDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/75 admin-fade-in" onClick={() => setOverrideDate(null)} />
          <div className="relative z-10 bg-surface border border-foreground/10 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl shadow-black/60 w-full max-w-md overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)] admin-sheet-in">
            <div className="md:hidden w-12 h-1.5 bg-foreground/10 rounded-full mx-auto mt-4 mb-1" />
            <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/5">
              <div className="min-w-0">
                <h2 className="text-lg font-bold font-playfair">Raspored za dan</h2>
                <p className="text-[11px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mt-0.5 truncate">
                  {fmtFull(new Date(`${overrideDate}T00:00:00`))}
                </p>
              </div>
              <button onClick={() => setOverrideDate(null)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-foreground/3 text-foreground/60 hover:bg-red-400/10 hover:text-red-400 transition-all cursor-pointer shrink-0 ml-3"><X size={22} /></button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <p className="text-[11px] font-poppins text-foreground/64 leading-relaxed">
                {overrideIsException
                  ? "Ovaj dan ima poseban raspored (izuzetak). Izmeni ga ili ga vrati na nedeljni šablon."
                  : "Ovaj dan prati nedeljni šablon. Sve što ovde promeniš postaje izuzetak samo za ovaj datum."}
              </p>

              <p className="text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/55">Radno vreme</p>
              <WindowsEditor windows={overrideDraft} onChange={setOverrideDraft} />

              <p className="pt-2 text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/55">Ko radi</p>
              <StaffPicker staff={staff} selected={overrideStaffDraft} onChange={setOverrideStaffDraft} />

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => saveOverride(overrideDate, overrideDraft, overrideStaffDraft)}
                  className="flex-1 h-12 rounded-2xl bg-accent text-on-accent text-xs font-bold tracking-[0.2em] font-poppins uppercase hover:opacity-90 transition-all active:scale-95 cursor-pointer"
                >
                  Sačuvaj
                </button>
                {overrideIsException && (
                  <button
                    onClick={() => clearOverride(overrideDate)}
                    className="h-12 px-4 rounded-2xl bg-foreground/4 border border-foreground/10 text-foreground/76 text-[11px] font-bold tracking-widest font-poppins uppercase hover:bg-foreground/8 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Default
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  // One day's column: closed hours hatched, open hours framed, then the cards.
  function renderDayBody(day: (typeof days)[number], isMobile: boolean) {
    const isDayToday = day.dateStr === todayStr;
    const cards = isMobile ? day.mobile : day.desktop;
    return (
      <>
        {isDayToday && <div className="absolute inset-0 bg-accent/[0.06] pointer-events-none" />}

        {/* Closed — hatched, so working hours read as the clear part of the day */}
        {closedSegments(day.windows, gridStart, gridEnd).map((seg) => (
          <div
            key={`closed-${seg.start}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: toHeight(seg.start - gridStart), height: toHeight(seg.end - seg.start), ...CLOSED_HATCH }}
          />
        ))}
        {!day.windows && cards.length === 0 && (
          <p className="absolute top-4 inset-x-0 text-center text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/50 pointer-events-none">
            Zatvoreno
          </p>
        )}

        {/* Hour and half-hour lines */}
        {hourMarks.map((m) => (
          <div key={m} className="absolute left-0 right-0 border-t border-foreground/8 pointer-events-none" style={{ top: toHeight(m - gridStart) }} />
        ))}
        {hourMarks.slice(0, -1).map((m) => (
          <div key={`half-${m}`} className="absolute left-0 right-0 border-t border-dashed border-foreground/4 pointer-events-none" style={{ top: toHeight(m + 30 - gridStart) }} />
        ))}

        {/* Open — framed by the studio's colour at opening and closing time */}
        {(day.windows ?? []).map((w) => (
          <div
            key={`open-${w.start}`}
            className="absolute left-0 right-0 border-y-2 border-accent/45 pointer-events-none"
            style={{ top: toHeight(w.start - gridStart), height: toHeight(w.end - w.start) }}
          />
        ))}

        {cards.map(r => renderReservation(r, isMobile))}

        {/* Now */}
        {isDayToday && nowMin >= gridStart && nowMin <= gridEnd && (
          <div
            className="absolute left-0 right-0 z-10 flex items-center -translate-y-1/2 pointer-events-none"
            style={{ top: toHeight(nowMin - gridStart) }}
          >
            <span className="w-2 h-2 -ml-1 rounded-full bg-accent-soft" />
            <span className="flex-1 h-0.5 bg-accent-soft" />
          </div>
        )}
      </>
    );
  }

  function renderReservation(r: LaidOut, isMobile: boolean) {
    const topPx    = toHeight(timeToMinutes(r.start_time) - gridStart);
    const minPx    = isMobile ? MIN_CARD_PX_MOBILE : MIN_CARD_PX_DESKTOP;
    // 2px short, so back-to-back appointments read as separate cards.
    const heightPx = Math.max(toHeight(r.total_duration), minPx) - 2;
    const services = r.reservation_services.map(rs => rs.services?.name).filter(Boolean).join(", ");
    const bundle   = parseBundlePromo(r.promo_code);
    const hasHealthNote = !!r.customer_note?.trim();

    const special = r.status === "confirmed" ? null : (CARD_STATUS_STYLES[r.status] ?? UNKNOWN_CARD_STYLE);
    const look    = special ?? CONFIRMED_CARD_STYLE;
    const label   = (STATUS_STYLES[r.status] ?? UNKNOWN_STATUS_STYLE).label;

    const cols = Math.max(1, r._cols);
    const col  = r._col;
    const gapPx = isMobile ? 4 : 3;
    const padPx = isMobile ? 8 : 6;

    const time     = `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`;
    const oneLine  = heightPx < 40;
    const narrow   = !isMobile && cols >= 3;
    const showServices = heightPx >= 58 && !!services;

    const icons = (
      <>
        {r.status === "blacklisted" && <Ban size={11} strokeWidth={2.5} className="shrink-0 text-foreground/68" />}
        {hasHealthNote && <HeartPulse size={12} strokeWidth={2.5} className="shrink-0 text-amber-300" />}
        {bundle && (
          <span
            className={`inline-flex items-center justify-center rounded-md shrink-0 ${bundle.redeem ? "text-accent/60 bg-accent/10" : "text-on-accent bg-accent"}`}
            style={{ width: 16, height: 16 }}
          >
            <Package size={11} strokeWidth={2.5} />
          </span>
        )}
      </>
    );

    return (
      <button
        key={r.id}
        onClick={() => openModal(r)}
        title={[r.customer_name, time, services, label, hasHealthNote ? "Zdravstvena napomena" : ""].filter(Boolean).join(" · ")}
        className={`absolute rounded-lg ${look.box} pl-2.5 pr-1.5 text-left overflow-hidden cursor-pointer transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] hover:shadow-lg hover:shadow-black/40 hover:z-10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:z-10`}
        style={{
          top: topPx,
          height: heightPx,
          left:  `calc(${(col / cols) * 100}% + ${col === 0 ? padPx : gapPx / 2}px)`,
          width: `calc(${100 / cols}% - ${col === 0 || col === cols - 1 ? padPx + gapPx / 2 : gapPx}px)`,
        }}
      >
        <span className={`absolute left-0 inset-y-0 w-1 ${look.bar}`} />
        {oneLine ? (
          <span className="flex items-center gap-1.5 h-full">
            {!narrow && (
              <span className={`shrink-0 text-[10px] font-bold font-poppins tabular-nums ${look.sub}`}>{r.start_time.slice(0, 5)}</span>
            )}
            {icons}
            <span className={`text-[11px] md:text-[11px] font-bold font-poppins leading-none truncate ${look.name}`}>{r.customer_name}</span>
          </span>
        ) : (
          <span className="flex flex-col justify-center h-full gap-0.5">
            <span className="flex items-center gap-1.5">
              {icons}
              <span className={`text-[13px] md:text-xs font-bold font-poppins leading-tight truncate ${look.name}`}>{r.customer_name}</span>
            </span>
            <span className={`text-[11px] md:text-[10px] font-bold font-poppins leading-none tabular-nums truncate ${look.sub}`}>
              {narrow ? r.start_time.slice(0, 5) : time}
            </span>
            {showServices && (
              <span className="text-[11px] md:text-[10px] font-medium font-poppins leading-tight text-foreground/76 truncate">{services}</span>
            )}
          </span>
        )}
      </button>
    );
  }
}
