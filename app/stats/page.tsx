"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import {
  LogOut, DollarSign, Target, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, CalendarCheck, Users
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_PWD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "laser2024";

const SR_MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"
];

// ── Types ─────────────────────────────────────────────────────────────────────
type AppointmentRow = {
  date: string;
  status: "confirmed" | "cancelled" | "no_show";
};

type MonthStat = {
  year: number;
  month: number;
  confirmed: number;
  cancelled: number;
  noShow: number;
  showUpRate: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRateColor(rate: number) {
  if (rate >= 80) return "text-teal";
  if (rate >= 60) return "text-amber-500";
  return "text-red-400";
}

function getRateBg(rate: number) {
  if (rate >= 80) return "bg-teal/10";
  if (rate >= 60) return "bg-amber-500/10";
  return "bg-red-400/10";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Marketing Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function MarketingPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword]           = useState("");
  const [pwdError, setPwdError]           = useState(false);

  const [appointments, setAppointments]   = useState<AppointmentRow[]>([]);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("ils_admin") === "1") setAuthenticated(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = toDateStr(new Date());

    const { data } = await supabase
      .from("reservations")
      .select("date, status")
      .lte("date", today)
      .in("status", ["confirmed", "cancelled", "no_show"])
      .order("date", { ascending: false });

    setAppointments((data as AppointmentRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

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

  // ── Calculations ─────────────────────────────────────────────────────────────
  const confirmed  = appointments.filter(a => a.status === "confirmed").length;
  const cancelled  = appointments.filter(a => a.status === "cancelled").length;
  const noShow     = appointments.filter(a => a.status === "no_show").length;
  const total      = confirmed + cancelled + noShow;
  const showUpRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  // Monthly breakdown — last 12 months
  const monthlyStats: MonthStat[] = (() => {
    const map = new Map<string, { confirmed: number; cancelled: number; noShow: number }>();

    for (const a of appointments) {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = map.get(key) ?? { confirmed: 0, cancelled: 0, noShow: 0 };
      if (a.status === "confirmed") existing.confirmed++;
      else if (a.status === "cancelled") existing.cancelled++;
      else existing.noShow++;
      map.set(key, existing);
    }

    const now = new Date();
    const results: MonthStat[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const stats = map.get(key) ?? { confirmed: 0, cancelled: 0, noShow: 0 };
      const tot = stats.confirmed + stats.cancelled + stats.noShow;
      results.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        confirmed: stats.confirmed,
        cancelled: stats.cancelled,
        noShow: stats.noShow,
        showUpRate: tot > 0 ? Math.round((stats.confirmed / tot) * 100) : 0,
      });
    }

    return results;
  })();

  // Trend: compare this month vs last month
  const thisMonth = monthlyStats[0];
  const lastMonth = monthlyStats[1];
  const trend = thisMonth && lastMonth && lastMonth.showUpRate > 0
    ? thisMonth.showUpRate - lastMonth.showUpRate
    : null;

  // ── Password screen ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="min-h-dvh bg-linear-to-br from-[#0D1117] to-[#1A2332] flex items-center justify-center p-4">
        <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 md:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-teal to-pink flex items-center justify-center shadow-lg shadow-teal/20">
              <DollarSign size={32} className="text-white" />
            </div>
          </div>
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold font-playfair mb-2">Admin Panel</h1>
            <p className="text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-[0.2em]">Infinity Laser Studio</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-2">
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
            <button type="submit" className="w-full py-4.5 rounded-2xl bg-linear-to-r from-teal to-[#14B8A6] text-white text-xs font-bold tracking-[0.2em] font-poppins cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-teal/10">PRIJAVA</button>
          </form>
        </div>
      </main>
    );
  }

  // ── Dashboard screen ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh flex flex-col bg-[#F8F9FA] pt-16">
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      {/* Header */}
      <header className="bg-white border-b border-foreground/5 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between gap-3 shrink-0 z-20 shadow-sm sticky top-0">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <div className="border-r border-foreground/10 pr-3 md:pr-6 shrink-0">
            <h1 className="text-base md:text-xl font-bold font-playfair tracking-tight whitespace-nowrap">Infinity Laser Studio</h1>
            <p className="text-[9px] md:text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
          <nav className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1 shrink-0">
            <Link href="/finances" className="px-2.5 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold font-poppins text-foreground/30 hover:text-foreground/60 uppercase tracking-widest transition-colors">Finansije</Link>
            <span className="px-2.5 md:px-3 py-1.5 rounded-lg bg-white shadow-sm text-[10px] md:text-xs font-bold font-poppins text-foreground uppercase tracking-widest">Statistike</span>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all font-poppins text-xs font-bold cursor-pointer">
          <LogOut size={16} /><span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

          {/* Show-up rate — featured card */}
          <div className="sm:col-span-2 bg-white p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${getRateBg(showUpRate)}`}>
                  <Target className={getRateColor(showUpRate)} size={24} />
                </div>
                <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Stopa dolazaka (sve vreme)</p>
                <h3 className={`text-5xl font-bold font-playfair ${getRateColor(showUpRate)}`}>{total > 0 ? `${showUpRate}%` : "—"}</h3>
                {trend !== null && (
                  <div className={`flex items-center gap-1 mt-2 text-[11px] font-bold font-poppins ${trend >= 0 ? "text-teal" : "text-red-400"}`}>
                    {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trend >= 0 ? "+" : ""}{trend}% u odnosu na prošli mesec
                  </div>
                )}
              </div>
              {total > 0 && (
                <div className="flex flex-col items-end gap-1 mt-1">
                  <div className={`text-right px-3 py-1.5 rounded-xl ${getRateBg(showUpRate)}`}>
                    <p className={`text-2xl font-bold font-playfair ${getRateColor(showUpRate)}`}>{showUpRate}%</p>
                    <div className="w-full bg-foreground/5 rounded-full h-1.5 mt-1.5 min-w-24">
                      <div
                        className={`h-1.5 rounded-full transition-all ${showUpRate >= 80 ? "bg-teal" : showUpRate >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                        style={{ width: `${showUpRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80} /></div>
          </div>

          <div className="bg-white p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center mb-4"><CheckCircle2 className="text-teal" size={24} /></div>
              <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Dolasci</p>
              <h3 className="text-3xl font-bold font-playfair">{confirmed}</h3>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><CalendarCheck size={80} /></div>
          </div>

          <div className="bg-white p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center mb-4"><XCircle className="text-red-400" size={24} /></div>
              <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Otkazivanja</p>
              <h3 className="text-3xl font-bold font-playfair text-red-400">{cancelled}</h3>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><XCircle size={80} /></div>
          </div>

          <div className="sm:col-start-2 lg:col-start-auto bg-white p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4"><AlertCircle className="text-orange-500" size={24} /></div>
              <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Nije se pojavila</p>
              <h3 className="text-3xl font-bold font-playfair text-orange-500">{noShow}</h3>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle size={80} /></div>
          </div>
        </div>

        {/* Monthly Breakdown Table */}
        <div className="bg-white rounded-4xl border border-foreground/5 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-foreground/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-playfair">Mesečni pregled</h2>
              <p className="text-[11px] font-bold font-poppins text-foreground/30 uppercase tracking-widest mt-1">Show-up rate po mesecima — poslednjih 12 meseci</p>
            </div>
            {loading && <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-foreground/5">
            {monthlyStats.every(m => m.confirmed === 0 && m.cancelled === 0) ? (
              <div className="px-6 py-16 text-center opacity-20">
                <Target size={40} className="mx-auto mb-2" />
                <p className="font-poppins text-sm font-medium uppercase tracking-widest">Nema podataka</p>
              </div>
            ) : (
              monthlyStats.map((m) => {
                const tot = m.confirmed + m.cancelled + m.noShow;
                const isCurrentMonth = m.month === new Date().getMonth() && m.year === new Date().getFullYear();
                return (
                  <div key={`${m.year}-${m.month}`} className={`px-5 py-4 ${isCurrentMonth ? "bg-teal/2" : ""}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-poppins text-foreground/80 capitalize">
                          {SR_MONTHS[m.month]} {m.year}.
                        </p>
                        {isCurrentMonth && (
                          <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[9px] font-bold font-poppins uppercase tracking-widest">tekući</span>
                        )}
                      </div>
                      {tot > 0 ? (
                        <span className={`text-sm font-bold font-poppins ${getRateColor(m.showUpRate)}`}>{m.showUpRate}%</span>
                      ) : (
                        <span className="text-sm font-poppins text-foreground/20">—</span>
                      )}
                    </div>
                    {tot > 0 && (
                      <>
                        <div className="w-full bg-foreground/5 rounded-full h-1.5 mb-3">
                          <div
                            className={`h-1.5 rounded-full transition-all ${m.showUpRate >= 80 ? "bg-teal" : m.showUpRate >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${m.showUpRate}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[9px] font-bold font-poppins text-foreground/30 uppercase tracking-wider mb-0.5">Dolasci</p>
                            <p className="text-sm font-bold font-poppins text-teal">{m.confirmed}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-bold font-poppins text-foreground/30 uppercase tracking-wider mb-0.5">Otkazivanja</p>
                            <p className="text-sm font-bold font-poppins text-red-400">{m.cancelled}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-bold font-poppins text-foreground/30 uppercase tracking-wider mb-0.5">Nije došla</p>
                            <p className="text-sm font-bold font-poppins text-orange-500">{m.noShow > 0 ? m.noShow : <span className="text-foreground/20">—</span>}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/2">
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Mesec</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest text-center">Dolasci</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest text-center">Otkazivanja</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest text-center">Nije se pojavila</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest text-center">Ukupno</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Stopa dolazaka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {monthlyStats.every(m => m.confirmed === 0 && m.cancelled === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center opacity-20">
                      <Target size={48} className="mx-auto mb-2" />
                      <p className="font-poppins text-sm font-medium uppercase tracking-widest">Nema podataka</p>
                    </td>
                  </tr>
                ) : (
                  monthlyStats.map((m) => {
                    const tot = m.confirmed + m.cancelled + m.noShow;
                    const isCurrentMonth = m.month === new Date().getMonth() && m.year === new Date().getFullYear();
                    return (
                      <tr key={`${m.year}-${m.month}`} className={`hover:bg-foreground/1 transition-colors ${isCurrentMonth ? "bg-teal/2" : ""}`}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold font-poppins text-foreground/80 capitalize">
                              {SR_MONTHS[m.month]} {m.year}.
                            </p>
                            {isCurrentMonth && (
                              <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[9px] font-bold font-poppins uppercase tracking-widest">tekući</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-bold font-poppins text-teal">{m.confirmed}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-bold font-poppins text-red-400">{m.cancelled}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-bold font-poppins text-orange-500">{m.noShow > 0 ? m.noShow : <span className="text-foreground/20">—</span>}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-medium font-poppins text-foreground/50">{tot}</span>
                        </td>
                        <td className="px-8 py-5">
                          {tot === 0 ? (
                            <span className="text-sm font-poppins text-foreground/20">—</span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-foreground/5 rounded-full h-1.5 max-w-28">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${m.showUpRate >= 80 ? "bg-teal" : m.showUpRate >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                                  style={{ width: `${m.showUpRate}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold font-poppins min-w-10 ${getRateColor(m.showUpRate)}`}>{m.showUpRate}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 md:px-8 py-4 bg-foreground/2 border-t border-foreground/5 flex justify-between items-center gap-2">
            <p className="text-[10px] md:text-xs font-bold font-poppins text-foreground/40 uppercase tracking-widest">Sve vreme</p>
            <p className="text-[10px] md:text-xs font-bold font-poppins text-foreground/40 uppercase tracking-widest">
              Show-up rate: <span className={`ml-1 md:ml-2 ${getRateColor(showUpRate)}`}>{total > 0 ? `${showUpRate}%` : "—"}</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
