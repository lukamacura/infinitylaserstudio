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
const SLOT_PX     = 14;           
const PX_PER_MIN  = SLOT_PX / 10; 
const GRID_H      = 54 * SLOT_PX; 
const BIZ_START   = 10 * 60;      

const SR_DAYS_LONG  = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const SR_DAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const SR_MONTHS     = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; border: string; label: string; dot: string }> = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-200", label: "Na čekanju", dot: "bg-amber-400" },
  confirmed: { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-200", label: "Potvrđeno", dot: "bg-green-500" },
  cancelled: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   label: "Otkazano",  dot: "bg-red-500" },
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
  const [selectedDate, setSelectedDate]   = useState<Date>(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  });
  
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

  const fetchRange = useCallback(async (monday: Date) => {
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
    if (authenticated) fetchRange(weekStart);
  }, [authenticated, weekStart, fetchRange]);

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

  const ds        = toDateStr(selectedDate);
  const todayStr  = toDateStr(new Date());
  const dayRsvs   = reservations.filter(r => r.date === ds);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd   = addDays(weekStart, 6);
  const resByDay  = weekDates.map(d => reservations.filter(r => r.date === toDateStr(d)));

  // ── Password screen ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="min-h-dvh bg-linear-to-br from-[#0D1117] to-[#1A2332] flex items-center justify-center p-4">
        <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 md:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-teal to-pink flex items-center justify-center shadow-lg shadow-teal/20">
              <Calendar size={32} className="text-white" />
            </div>
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold font-playfair mb-2">Admin Panel</h1>
            <p className="text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-[0.2em]">Infinity Laser Studio</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="hidden md:block text-[10px] font-bold tracking-[0.2em] text-foreground/30 font-poppins uppercase px-1">Lozinka</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwdError(false); }}
                placeholder="Unesite lozinku"
                autoFocus
                className={`w-full px-5 py-4 rounded-2xl border-2 font-poppins text-sm focus:outline-none transition-all ${
                  pwdError ? "border-red-400 bg-red-50" : "border-foreground/5 bg-foreground/2 focus:border-teal/50 focus:bg-white"
                }`}
              />
              {pwdError && <p className="text-[11px] text-red-500 font-poppins font-medium mt-1.5 ml-1">Neispravna lozinka.</p>}
            </div>
            <button
              type="submit"
              className="w-full py-4.5 rounded-2xl bg-linear-to-r from-teal to-[#14B8A6] text-white text-xs font-bold tracking-[0.2em] font-poppins cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-teal/10"
            >
              PRIJAVA
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Calendar screen ─────────────────────────────────────────────────────────
  return (
    <main className="box-border h-dvh max-h-dvh flex flex-col bg-[#F8F9FA] overflow-hidden pt-16">
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      {/* Header */}
      <header className="bg-white border-b border-foreground/5 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between gap-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="hidden md:block border-r border-foreground/10 pr-6">
            <h1 className="text-xl font-bold font-playfair tracking-tight">Infinity Laser Studio</h1>
            <p className="text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-widest mt-0.5">Control Center</p>
          </div>
          
          <div className="flex items-center gap-4">
             {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).map(([key, s]) => (
              <div key={key} className="flex items-center gap-2 group">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot} shadow-sm transition-transform group-hover:scale-125`} />
                <span className="hidden lg:inline text-[11px] font-bold font-poppins text-foreground/40 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all font-poppins text-xs font-bold cursor-pointer"
        >
          <LogOut size={16} />
          <span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-foreground/5 px-4 md:px-8 py-3 md:py-4 shrink-0 z-10 shadow-xs">
        <div className="max-w-400 mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between md:justify-start gap-4 flex-1">
            <div className="flex items-center bg-foreground/3 rounded-2xl p-1 shadow-inner">
              <button onClick={handlePrev} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all active:scale-90"><ChevronLeft size={20}/></button>
              <div className="px-4 md:px-8 text-center min-w-35 md:min-w-55">
                <p className="text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/30 leading-none mb-1 md:hidden">
                  {SR_DAYS_LONG[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}
                </p>
                <p className="hidden md:block text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/30 leading-none mb-1">Pregled nedelje</p>
                <p className="text-sm md:text-base font-bold font-poppins truncate">
                  <span className="md:hidden">{selectedDate.getDate()}. {SR_MONTHS[selectedDate.getMonth()]}</span>
                  <span className="hidden md:inline">{fmtShort(weekStart)} – {fmtShort(weekEnd)}</span>
                </p>
              </div>
              <button onClick={handleNext} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all active:scale-90"><ChevronRight size={20}/></button>
            </div>
            <button onClick={goToday} className="hidden md:flex h-11 px-6 items-center justify-center rounded-2xl border-2 border-teal/10 text-teal text-xs font-bold font-poppins hover:bg-teal/5 transition-all shadow-sm">DANAS</button>
          </div>

          <div className="flex gap-2">
            <button onClick={goToday} className="md:hidden flex-1 h-12 rounded-2xl border-2 border-teal/10 text-teal text-xs font-bold font-poppins active:bg-teal/5 transition-colors">DANAS</button>
            <button
              onClick={() => setReservationModalOpen(true)}
              className="flex-2 md:flex-none h-12 md:h-11 flex items-center justify-center gap-2 px-6 md:px-10 rounded-2xl bg-[#0B8078] text-white text-xs font-bold font-poppins hover:shadow-lg hover:shadow-teal/20 transition-all active:scale-95"
            >
              <CalendarPlus size={18} />
              <span className="uppercase tracking-widest">Nova rezervacija</span>
            </button>
          </div>
        </div>
      </div>

      <AdminReservationModal
        isOpen={reservationModalOpen}
        onClose={() => setReservationModalOpen(false)}
        onSuccess={() => fetchRange(weekStart)}
      />

      {/* Grid */}
      <div className="flex-1 min-h-0 flex flex-col relative isolate bg-white/50">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center z-30 transition-opacity">
            <div className="w-10 h-10 border-3 border-teal border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto overscroll-y-contain custom-scrollbar">
          <div className="max-w-400 mx-auto min-w-full">
            
            {/* Day Headers */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-foreground/5 shadow-xs grid grid-cols-[60px_1fr] md:grid-cols-[80px_repeat(7,1fr)]">
              <div className="flex items-center justify-center border-r border-foreground/3"><Clock size={14} className="text-foreground/20" /></div>
              
              {/* Mobile Header */}
              <div className="md:hidden py-4 text-center">
                <p className="text-[10px] font-bold font-poppins uppercase tracking-[0.2em] mb-0.5 text-teal">{SR_DAYS_SHORT[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}</p>
                <p className="text-lg font-bold font-poppins text-teal">{selectedDate.getDate()}</p>
              </div>

              {/* Desktop Headers */}
              {weekDates.map((d, i) => {
                const dateStr = toDateStr(d);
                const isDayToday = dateStr === todayStr;
                return (
                  <div key={dateStr} className={`hidden md:block py-4 text-center border-l border-foreground/3 first:border-l-0 ${isDayToday ? "bg-teal/2" : ""}`}>
                    <p className={`text-[10px] font-bold font-poppins uppercase tracking-[0.2em] mb-0.5 ${isDayToday ? "text-teal" : "text-foreground/30"}`}>{SR_DAYS_SHORT[i]}</p>
                    <p className={`text-lg font-bold font-poppins ${isDayToday ? "text-teal" : "text-foreground"}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>

            {/* Content Body */}
            <div className="grid grid-cols-[60px_1fr] md:grid-cols-[80px_repeat(7,1fr)] relative">
              <div className="relative border-r border-foreground/3 bg-white/50" style={{ height: GRID_H }}>
                {HOUR_LABELS.map(({ label, top }) => (
                  <div key={label} className="absolute right-0 left-0 flex items-center justify-end px-3 -translate-y-1/2" style={{ top }}>
                    <span className="text-[10px] md:text-[11px] font-bold font-poppins text-foreground/20">{label}</span>
                  </div>
                ))}
              </div>

              {/* Mobile Col */}
              <div className={`md:hidden relative h-full ${toDateStr(selectedDate) === todayStr ? "bg-teal/2" : ""}`}>
                {HOUR_LABELS.map(({ top }) => <div key={top} className="absolute left-0 right-0 border-t border-foreground/4" style={{ top }} />)}
                {dayRsvs.map(r => renderReservation(r, true))}
              </div>

              {/* Desktop Cols */}
              {weekDates.map((d, colIdx) => {
                const dateStr = toDateStr(d);
                return (
                  <div key={dateStr} className={`hidden md:block relative h-full border-l border-foreground/3 first:border-l-0 transition-colors ${dateStr === todayStr ? "bg-teal/2" : "hover:bg-foreground/1"}`}>
                    {HOUR_LABELS.map(({ top }) => <div key={top} className="absolute left-0 right-0 border-t border-foreground/4" style={{ top }} />)}
                    {resByDay[colIdx].map(r => renderReservation(r, false))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelected(null)} />
          <div className="relative z-10 bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[92dvh] overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)] sm:animate-in sm:zoom-in-95 sm:duration-200">
            <div className="md:hidden w-12 h-1.5 bg-foreground/10 rounded-full mx-auto mt-4 mb-2" />
            
            <div className="flex items-center justify-between px-8 py-6 border-b border-foreground/5">
              <div>
                <h2 className="text-2xl font-bold font-playfair">Rezervacija</h2>
                <p className="text-[11px] font-bold font-poppins text-foreground/30 uppercase tracking-widest mt-1">Detaljni pregled klijenta</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-foreground/3 text-foreground/40 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"><X size={24}/></button>
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
                      <Icon size={14} className="text-foreground/20" />
                      <span className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-semibold font-poppins text-foreground/80 truncate px-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-foreground/2 border border-foreground/3">
                 <div className="flex items-center gap-3 mb-2">
                  <Calendar size={14} className="text-foreground/20" />
                  <span className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-wider">Datum tretmana</span>
                </div>
                <p className="text-sm font-semibold font-poppins text-foreground/80">{fmtFull(new Date(`${selected.date}T00:00:00`))}</p>
                <div className="mt-3 text-[11px] font-bold font-poppins text-teal bg-teal/5 inline-flex px-3 py-1.5 rounded-xl border border-teal/10">Trajanje: {selected.total_duration} min</div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest px-1">Usluge</p>
                <div className="flex flex-wrap gap-2">
                  {selected.reservation_services.map(rs => rs.services && (
                    <span key={rs.services.id} className="px-5 py-2.5 bg-white border border-foreground/5 rounded-2xl text-[13px] font-bold font-poppins text-foreground/70 shadow-sm">
                      {rs.services.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  {(Object.entries(STATUS_STYLES) as [ReservationStatus, typeof STATUS_STYLES[ReservationStatus]][]).filter(([key]) => key !== "pending").map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => setNewStatus(key)}
                      className={`h-16 rounded-2xl border-2 font-bold font-poppins transition-all flex flex-col items-center justify-center gap-1 ${
                        newStatus === key ? `${s.bg} ${s.border} ${s.text} shadow-md` : "bg-white border-foreground/5 text-foreground/20 grayscale hover:grayscale-0 hover:border-foreground/10"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className="text-[10px] uppercase tracking-widest">{s.label}</span>
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleStatusSave}
                  disabled={saving || newStatus === selected.status}
                  className="w-full h-16 rounded-2xl bg-teal text-white text-sm font-bold tracking-[0.2em] font-poppins shadow-xl shadow-teal/20 disabled:opacity-40 transition-all active:scale-95 cursor-pointer uppercase"
                >
                  {saving ? "..." : "Sačuvaj izmene"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  function renderReservation(r: ReservationFull, isMobile: boolean) {
    const topPx    = toTop(r.start_time);
    const heightPx = toHeight(r.total_duration);
    const s        = STATUS_STYLES[r.status];
    const services = r.reservation_services.map(rs => rs.services?.name).filter(Boolean).join(", ");
    
    return (
      <button
        key={r.id}
        onClick={() => openModal(r)}
        className={`absolute inset-x-2 md:inset-x-1.5 rounded-2xl md:rounded-xl border-2 md:border-l-4 ${s.bg} ${s.border} ${s.text} p-3 md:p-2.5 text-left overflow-hidden cursor-pointer active:scale-[0.98] transition-all group shadow-sm hover:shadow-md hover:z-10`}
        style={{ top: topPx, height: Math.max(heightPx, isMobile ? 48 : 35) }}
      >
        <div className="flex flex-col h-full justify-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            {!isMobile && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
            <p className="text-[12px] md:text-[11px] font-bold font-poppins leading-none truncate">{r.customer_name}</p>
          </div>
          {(heightPx >= 45 || isMobile) && <p className="text-[11px] md:text-[10px] font-medium font-poppins opacity-70 truncate px-0.5">{services}</p>}
        </div>
      </button>
    );
  }
}
