"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  ChevronLeft, ChevronRight, LogOut, X,
  Clock, User, Mail, Phone, Calendar,
} from "lucide-react";
import { supabase, timeToMinutes } from "@/lib/supabase";
import type { ReservationStatus } from "@/lib/database.types";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_PWD   = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "laser2024";
const SLOT_PX     = 14;           // px per 10-minute slot
const PX_PER_MIN  = SLOT_PX / 10; // 1.4 px/min
const GRID_H      = 60 * SLOT_PX; // 840px (07:00–17:00)
const BIZ_START   = 7 * 60;       // 420 min

const SR_DAYS_LONG  = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const SR_DAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const SR_MONTHS     = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; border: string; label: string }> = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-300", label: "Na čekanju" },
  confirmed: { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-300", label: "Potvrđeno" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-500",   border: "border-gray-300",  label: "Otkazano" },
};

// ── Types ─────────────────────────────────────────────────────────────────────
type ServiceRef = { id: string; name: string };
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
  created_at: string;
  reservation_services: { services: ServiceRef | null }[];
};

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
  return d.toISOString().split("T")[0];
}

function fmtShort(d: Date) {
  return `${d.getDate()}. ${SR_MONTHS[d.getMonth()]}`;
}

function fmtFull(d: Date) {
  return `${SR_DAYS_LONG[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()}. ${SR_MONTHS[d.getMonth()]}. ${d.getFullYear()}`;
}

// ── Positioning helpers ───────────────────────────────────────────────────────
function toTop(timeStr: string) {
  return (timeToMinutes(timeStr) - BIZ_START) * PX_PER_MIN;
}
function toHeight(minutes: number) {
  return minutes * PX_PER_MIN;
}

// ── Hour grid labels ──────────────────────────────────────────────────────────
const HOUR_LABELS = Array.from({ length: 11 }, (_, i) => {
  const h = 7 + i;
  return { label: `${String(h).padStart(2, "0")}:00`, top: i * 60 * PX_PER_MIN };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword]           = useState("");
  const [pwdError, setPwdError]           = useState(false);

  const [weekStart, setWeekStart]         = useState<Date>(() => getMonday(new Date()));
  const [reservations, setReservations]   = useState<ReservationFull[]>([]);
  const [loading, setLoading]             = useState(false);
  const [selected, setSelected]           = useState<ReservationFull | null>(null);
  const [newStatus, setNewStatus]         = useState<ReservationStatus>("pending");
  const [saving, setSaving]               = useState(false);

  // Check session on mount
  useEffect(() => {
    if (sessionStorage.getItem("ils_admin") === "1") setAuthenticated(true);
  }, []);

  // Fetch reservations for visible week
  const fetchWeek = useCallback(async (monday: Date) => {
    setLoading(true);
    const start = toDateStr(monday);
    const end   = toDateStr(addDays(monday, 6));
    const { data } = await supabase
      .from("reservations")
      .select(`*, reservation_services(services(id, name))`)
      .gte("date", start)
      .lte("date", end)
      .order("date")
      .order("start_time");
    setReservations((data as ReservationFull[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authenticated) fetchWeek(weekStart);
  }, [authenticated, weekStart, fetchWeek]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PWD) {
      sessionStorage.setItem("ils_admin", "1");
      setAuthenticated(true);
    } else {
      setPwdError(true);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("ils_admin");
    setAuthenticated(false);
    setPassword("");
  }

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday()  { setWeekStart(getMonday(new Date())); }

  function openModal(r: ReservationFull) {
    setSelected(r);
    setNewStatus(r.status);
  }

  async function handleStatusSave() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("reservations").update({ status: newStatus }).eq("id", selected.id);
    setReservations((prev) =>
      prev.map((r) => r.id === selected.id ? { ...r, status: newStatus } : r)
    );
    setSaving(false);
    setSelected(null);
  }

  // Derived week data
  const weekDates  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd    = addDays(weekStart, 6);
  const todayStr   = toDateStr(new Date());

  const resByDay = weekDates.map((d) => {
    const ds = toDateStr(d);
    return reservations.filter((r) => r.date === ds);
  });

  // ── Password screen ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#0D1117] to-[#1A2332] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal to-pink flex items-center justify-center">
              <Calendar size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-playfair text-center mb-1">Admin Panel</h1>
          <p className="text-sm text-foreground/50 font-poppins text-center mb-8">Infinity Laser Studio</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">
                LOZINKA
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwdError(false); }}
                placeholder="••••••••"
                autoFocus
                className={`w-full px-4 py-3 rounded-xl border-2 font-poppins text-sm focus:outline-none transition-colors ${
                  pwdError ? "border-red-400 bg-red-50" : "border-foreground/10 focus:border-teal"
                }`}
              />
              {pwdError && (
                <p className="text-xs text-red-500 font-poppins mt-1.5">Pogrešna lozinka.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-teal to-[#14B8A6] text-white text-sm font-semibold tracking-widest font-poppins cursor-pointer hover:opacity-90 transition-opacity"
            >
              PRIJAVI SE
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Calendar screen ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#F8F9FA] flex flex-col">

      {/* Top bar */}
      <header className="bg-white border-b border-foreground/10 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <h1 className="text-xl font-bold font-playfair">Infinity Laser Studio</h1>
          <p className="text-xs text-foreground/40 font-poppins">Kalendar rezervacija</p>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4">
          {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs font-poppins text-foreground/60">
              <span className={`w-3 h-3 rounded-sm ${s.bg} ${s.border} border`} />
              {s.label}
            </span>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-foreground/10 hover:border-foreground/20 text-sm font-poppins text-foreground/60 cursor-pointer transition-colors"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Odjavi se</span>
        </button>
      </header>

      {/* Week navigation */}
      <div className="bg-white border-b border-foreground/10 px-6 py-3 flex items-center gap-4 shrink-0">
        <button
          onClick={prevWeek}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 text-center">
          <p className="text-sm font-semibold font-poppins">
            {fmtShort(weekStart)} – {fmtShort(weekEnd)} {weekEnd.getFullYear()}
          </p>
        </div>

        <button
          onClick={nextWeek}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>

        <button
          onClick={goToday}
          className="px-4 py-1.5 rounded-full border-2 border-teal text-teal text-xs font-semibold font-poppins cursor-pointer hover:bg-teal/10 transition-colors"
        >
          Danas
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Day header row */}
        <div className="sticky top-0 z-10 bg-white border-b border-foreground/10 grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div /> {/* spacer for time column */}
          {weekDates.map((d, i) => {
            const ds  = toDateStr(d);
            const isToday = ds === todayStr;
            return (
              <div key={ds} className="py-3 px-2 text-center border-l border-foreground/5 first:border-l-0">
                <p className={`text-xs font-poppins ${isToday ? "text-teal font-bold" : "text-foreground/40"}`}>
                  {SR_DAYS_SHORT[i]}
                </p>
                <p className={`text-sm font-semibold font-poppins mt-0.5 ${isToday ? "text-teal" : "text-foreground"}`}>
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>

          {/* Time labels column */}
          <div className="relative" style={{ height: GRID_H }}>
            {HOUR_LABELS.map(({ label, top }) => (
              <span
                key={label}
                className="absolute right-2 text-[10px] font-poppins text-foreground/30 -translate-y-1/2"
                style={{ top }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((d, colIdx) => {
            const ds      = toDateStr(d);
            const isToday = ds === todayStr;
            const dayRsvs = resByDay[colIdx];

            return (
              <div
                key={ds}
                className={`relative border-l border-foreground/5 ${isToday ? "bg-teal/[0.02]" : ""}`}
                style={{ height: GRID_H }}
              >
                {/* Hour grid lines */}
                {HOUR_LABELS.map(({ label, top }) => (
                  <div
                    key={label}
                    className="absolute left-0 right-0 border-t border-foreground/8"
                    style={{ top }}
                  />
                ))}

                {/* 30-min grid lines (lighter) */}
                {HOUR_LABELS.slice(0, -1).map(({ label, top }) => (
                  <div
                    key={`${label}-30`}
                    className="absolute left-0 right-0 border-t border-foreground/4"
                    style={{ top: top + 30 * PX_PER_MIN }}
                  />
                ))}

                {/* Reservation blocks */}
                {dayRsvs.map((r) => {
                  const topPx    = toTop(r.start_time);
                  const heightPx = toHeight(r.total_duration);
                  const s        = STATUS_STYLES[r.status];
                  const services = r.reservation_services
                    .map((rs) => rs.services?.name)
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <button
                      key={r.id}
                      onClick={() => openModal(r)}
                      className={`absolute inset-x-0.5 rounded-lg border ${s.bg} ${s.border} ${s.text} p-1.5 text-left overflow-hidden cursor-pointer hover:brightness-95 transition-all group`}
                      style={{ top: topPx, height: Math.max(heightPx, 22) }}
                    >
                      <p className="text-[11px] font-semibold font-poppins leading-tight truncate">
                        {r.customer_name}
                      </p>
                      {heightPx >= 36 && (
                        <p className="text-[10px] font-poppins leading-tight truncate opacity-70 mt-0.5">
                          {services}
                        </p>
                      )}
                      {heightPx >= 52 && (
                        <p className="text-[10px] font-poppins opacity-60 mt-0.5">
                          {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status change modal ─────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold font-playfair">Detalji rezervacije</h2>
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer info */}
            <div className="px-6 pb-4 space-y-2">
              {[
                { icon: User,     value: selected.customer_name },
                { icon: Mail,     value: selected.customer_email },
                { icon: Phone,    value: selected.customer_phone ?? "—" },
                {
                  icon: Calendar,
                  value: `${fmtFull(new Date(`${selected.date}T00:00:00`))}`,
                },
                {
                  icon: Clock,
                  value: `${selected.start_time.slice(0, 5)} – ${selected.end_time.slice(0, 5)} (${selected.total_duration} min)`,
                },
              ].map(({ icon: Icon, value }) => (
                <div key={value} className="flex items-center gap-3 text-sm font-poppins text-foreground/70">
                  <Icon size={15} className="shrink-0 text-foreground/30" />
                  {value}
                </div>
              ))}

              {/* Services */}
              {selected.reservation_services.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-foreground/40 font-poppins mb-1.5">USLUGE</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.reservation_services.map((rs) =>
                      rs.services ? (
                        <span
                          key={rs.services.id}
                          className="px-2.5 py-1 bg-foreground/5 rounded-lg text-xs font-poppins text-foreground/70"
                        >
                          {rs.services.name}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div className="px-6 pb-6">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-3">PROMENI STATUS</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setNewStatus(key)}
                    className={`py-2.5 rounded-xl border-2 text-xs font-semibold font-poppins cursor-pointer transition-all ${
                      newStatus === key ? `${s.bg} ${s.border} ${s.text}` : "border-foreground/10 text-foreground/50 hover:border-foreground/20"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStatusSave}
                disabled={saving || newStatus === selected.status}
                className="mt-4 w-full py-3.5 rounded-full bg-teal text-white text-sm font-semibold tracking-widest font-poppins cursor-pointer hover:bg-[#0B8078] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Čuvanje..." : "SAČUVAJ PROMENE"}
              </button>
            </div>

            {/* Accent bar */}
            <div className="h-1 bg-linear-to-r from-teal via-pink to-rose" />
          </div>
        </div>
      )}
    </main>
  );
}
