"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  ChevronLeft, ChevronRight, LogOut, X,
  Clock, User, Mail, Phone, Calendar, CalendarPlus,
} from "lucide-react";
import { supabase, timeToMinutes } from "@/lib/supabase";
import AdminReservationModal from "@/components/AdminReservationModal";
import type { ReservationStatus } from "@/lib/database.types";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_PWD   = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "laser2024";
const SLOT_PX     = 14;           // px per 10-minute slot
const PX_PER_MIN  = SLOT_PX / 10; // 1.4 px/min
const GRID_H      = 54 * SLOT_PX; // 756px (10:00–19:00)
const BIZ_START   = 10 * 60;      // 600 min – earliest open hour (Sat 10:00)

const SR_DAYS_LONG  = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const SR_DAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const SR_MONTHS     = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; border: string; label: string }> = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-300", label: "Na čekanju" },
  confirmed: { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-300", label: "Potvrđeno" },
  cancelled: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300",   label: "Otkazano" },
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
function toTop(timeStr: string) {
  return (timeToMinutes(timeStr) - BIZ_START) * PX_PER_MIN;
}
function toHeight(minutes: number) {
  return minutes * PX_PER_MIN;
}

// ── Hour grid labels ──────────────────────────────────────────────────────────
const HOUR_LABELS = Array.from({ length: 10 }, (_, i) => {
  const h = 10 + i;
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
  const [reservationModalOpen, setReservationModalOpen] = useState(false);

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
      <main className="min-h-dvh bg-gradient-to-br from-[#0D1117] to-[#1A2332] flex items-center justify-center p-4 pt-20 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
    <main className="box-border h-dvh max-h-dvh flex flex-col bg-[#F8F9FA] overflow-hidden pt-16 max-md:pb-24">
      {/* h-dvh + overflow: one scroll surface inside calendar; pt-16 clears fixed navbar; pb clears floating CTA */}

      {/* Top bar */}
      <header className="bg-white border-b border-foreground/10 px-3 py-3 sm:px-6 sm:py-4 flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold font-playfair truncate">Infinity Laser Studio</h1>
          <p className="text-[11px] sm:text-xs text-foreground/40 font-poppins">Kalendar rezervacija</p>
        </div>

        {/* Legend — desktop */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs font-poppins text-foreground/60">
              <span className={`w-3 h-3 rounded-sm ${s.bg} ${s.border} border`} />
              {s.label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4 rounded-full border-2 border-foreground/10 hover:border-foreground/20 text-xs sm:text-sm font-poppins text-foreground/60 cursor-pointer transition-colors touch-manipulation"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="hidden sm:inline">Odjavi se</span>
        </button>
      </header>

      {/* Legend — mobile: horizontal chip row, no layout squeeze */}
      <div className="md:hidden bg-white border-b border-foreground/10 px-3 py-2 shrink-0">
        <div className="flex gap-3 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 overscroll-x-contain touch-pan-x scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).map(([key, s]) => (
            <span key={key} className="flex shrink-0 items-center gap-1.5 text-[11px] font-poppins text-foreground/60 whitespace-nowrap">
              <span className={`w-2.5 h-2.5 rounded-sm ${s.bg} ${s.border} border`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Week navigation */}
      <div className="bg-white border-b border-foreground/10 px-3 py-2.5 sm:px-6 sm:py-3 shrink-0">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-1 min-w-0 sm:flex-1 sm:gap-2">
            <button
              type="button"
              onClick={prevWeek}
              className="w-10 h-10 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer touch-manipulation"
              aria-label="Prethodna nedelja"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex-1 text-center min-w-0 px-1">
              <p className="text-xs sm:text-sm font-semibold font-poppins leading-tight">
                <span className="block sm:inline">{fmtShort(weekStart)} – {fmtShort(weekEnd)}</span>
                <span className="text-foreground/50 font-normal sm:ml-1">{weekEnd.getFullYear()}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={nextWeek}
              className="w-10 h-10 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer touch-manipulation"
              aria-label="Sledeća nedelja"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              onClick={goToday}
              className="shrink-0 px-3 py-2 sm:px-4 sm:py-1.5 rounded-full border-2 border-teal text-teal text-[11px] sm:text-xs font-semibold font-poppins cursor-pointer hover:bg-teal/10 active:bg-teal/15 transition-colors touch-manipulation"
            >
              Danas
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReservationModalOpen(true)}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-full bg-[#0B8078] text-white text-xs font-semibold font-poppins cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity touch-manipulation"
          >
            <CalendarPlus size={16} className="shrink-0" />
            Nova rezervacija
          </button>
        </div>
      </div>

      <AdminReservationModal
        isOpen={reservationModalOpen}
        onClose={() => setReservationModalOpen(false)}
        onSuccess={() => fetchWeek(weekStart)}
      />

      {/* Calendar grid — min-h-0 lets this flex child shrink so overflow scrolls here, not on body */}
      <div className="flex-1 min-h-0 flex flex-col relative isolate">
        {loading && (
          <div
            className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 pointer-events-auto"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {/* Day header row */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-foreground/10 grid shadow-sm" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
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
                      type="button"
                      key={r.id}
                      onClick={() => openModal(r)}
                      className={`absolute inset-x-0.5 rounded-lg border ${s.bg} ${s.border} ${s.text} p-1.5 text-left overflow-hidden cursor-pointer hover:brightness-95 active:brightness-90 transition-all group touch-manipulation`}
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
      </div>

      {/* ── Status change modal ─────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
            role="presentation"
          />
          <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[92dvh] sm:max-h-[90dvh] overflow-hidden flex flex-col mb-[env(safe-area-inset-bottom)] sm:mb-0">

            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-foreground/5">
              <h2 className="text-lg sm:text-xl font-bold font-playfair pr-2">Detalji rezervacije</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-foreground/5 active:bg-foreground/10 cursor-pointer touch-manipulation"
                aria-label="Zatvori"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-5 sm:px-6 py-4 [-webkit-overflow-scrolling:touch]">
            {/* Customer info */}
            <div className="space-y-2">
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
            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-3">PROMENI STATUS</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).filter(([key]) => key !== "pending").map(([key, s]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setNewStatus(key)}
                    className={`py-2.5 rounded-xl border-2 text-xs font-semibold font-poppins cursor-pointer transition-all touch-manipulation ${
                      newStatus === key ? `${s.bg} ${s.border} ${s.text}` : "border-foreground/10 text-foreground/50 hover:border-foreground/20"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleStatusSave}
                disabled={saving || newStatus === selected.status}
                className="mt-4 w-full py-3.5 rounded-full bg-teal text-white text-sm font-semibold tracking-widest font-poppins cursor-pointer hover:bg-[#0B8078] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                {saving ? "Čuvanje..." : "SAČUVAJ PROMENE"}
              </button>
            </div>
            </div>

            {/* Accent bar */}
            <div className="h-1 shrink-0 bg-linear-to-r from-teal via-pink to-rose" />
          </div>
        </div>
      )}
    </main>
  );
}
