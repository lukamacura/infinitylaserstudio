/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, LogOut,
  DollarSign, CalendarCheck, Clock,
  TrendingUp, TrendingDown, Wallet, Tag, Users
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ReservationStatus } from "@/lib/database.types";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_PWD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "laser2024";
const MARKETING_FEE = 311110;

const SR_MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const SR_MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const COMBO_RULES = [
  { parts: ["nausnice", "brada"],  comboKey: "nausnice i brada" },
  { parts: ["noge", "intima"],     comboKey: "noge + intima" },
  { parts: ["stomak", "grudi"],    comboKey: "stomak + grudi" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ServiceWithPrice = { id: string; name: string; price: number };
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
  reservation_services: { services: ServiceWithPrice | null }[];
};
type UserHistory = {
  customer_email: string;
  date: string;
  start_time: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function getMonthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMonthYear(d: Date) {
  return `${SR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

function applyComboRules(selected: ServiceWithPrice[], all: ServiceWithPrice[]): ServiceWithPrice[] {
  let effective = [...selected];
  for (const rule of COMBO_RULES) {
    const matched = rule.parts
      .map(part => effective.find(s => s.name.toLowerCase().includes(part)))
      .filter((s): s is ServiceWithPrice => s !== undefined);
    if (matched.length === rule.parts.length) {
      const combo = all.find(s => s.name.toLowerCase().includes(rule.comboKey));
      if (combo) { effective = effective.filter(s => !matched.includes(s)); effective.push(combo); }
    }
  }
  return effective;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function FinancesPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword]           = useState("");
  const [pwdError, setPwdError]           = useState(false);

  const [currentDate, setCurrentDate]     = useState<Date>(() => new Date());
  const [reservations, setReservations]   = useState<ReservationFull[]>([]);
  const [allServices, setAllServices]     = useState<ServiceWithPrice[]>([]);
  const [userHistories, setUserHistories] = useState<UserHistory[]>([]);
  const [loading, setLoading]             = useState(false);
  const [projected, setProjected]         = useState(false);
  const [adSpend, setAdSpend]             = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem("ils_admin") === "1") setAuthenticated(true);
  }, []);

  // Per-month ad spend, persisted in Supabase (marketing_spend, key 'YYYY-MM').
  const adSpendKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("marketing_spend")
        .select("amount")
        .eq("month", adSpendKey)
        .maybeSingle();
      if (active) setAdSpend(data?.amount ?? 0);
    })();
    return () => { active = false; };
  }, [authenticated, adSpendKey]);

  async function handleAdSpendChange(value: number) {
    setAdSpend(value);
    await supabase
      .from("marketing_spend")
      .upsert({ month: adSpendKey, amount: value, updated_at: new Date().toISOString() }, { onConflict: "month" });
  }

  const fetchMonthData = useCallback(async (date: Date, projectFuture: boolean) => {
    setLoading(true);
    const today    = toDateStr(new Date());
    const monthEnd = toDateStr(getMonthEnd(date));
    const start    = toDateStr(getMonthStart(date));
    // Projected: include the whole month (future confirmed appointments).
    // Realized: cap at today so only elapsed appointments count.
    const end      = projectFuture ? monthEnd : (monthEnd < today ? monthEnd : today);

    const { data: svs } = await supabase.from("services").select("id, name, price");
    setAllServices((svs as ServiceWithPrice[]) ?? []);

    if (!projectFuture && start > today) {
      setReservations([]);
      setUserHistories([]);
      setLoading(false);
      return;
    }

    const { data: rsvs } = await supabase
      .from("reservations")
      .select(`*, reservation_services(services(id, name, price))`)
      .gte("date", start).lte("date", end)
      .eq("status", "confirmed")
      .order("date", { ascending: false });

    const monthRsvs = (rsvs as ReservationFull[]) ?? [];
    setReservations(monthRsvs);

    if (monthRsvs.length > 0) {
      const emails = Array.from(new Set(monthRsvs.map(r => r.customer_email)));
      const { data: hist } = await supabase
        .from("reservations")
        .select("customer_email, date, start_time")
        .in("customer_email", emails)
        .eq("status", "confirmed")
        .lte("date", end);
      setUserHistories((hist as UserHistory[]) ?? []);
    } else {
      setUserHistories([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authenticated) fetchMonthData(currentDate, projected);
  }, [authenticated, currentDate, projected, fetchMonthData]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PWD) { sessionStorage.setItem("ils_admin", "1"); setAuthenticated(true); }
    else setPwdError(true);
  }

  function handleLogout() {
    sessionStorage.removeItem("ils_admin"); setAuthenticated(false); setPassword("");
  }

  const handlePrev = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNext = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday    = () => setCurrentDate(new Date());

  // ── Calculations ──────────────────────────────────────────────────────────
  const calculateReservationPrice = (r: ReservationFull) => {
    const base = r.reservation_services.map(rs => rs.services).filter((s): s is ServiceWithPrice => s !== null);
    const effectiveServices = applyComboRules(base, allServices);
    const totalPrice = effectiveServices.reduce((sum, s) => sum + s.price, 0);

    const userAll = userHistories.filter(h => h.customer_email.toLowerCase() === r.customer_email.toLowerCase());
    const sorted  = [...userAll].sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.start_time.localeCompare(b.start_time));
    const isFirst = sorted[0]?.date === r.date && sorted[0]?.start_time === r.start_time;
    const finalPrice = isFirst ? Math.round(totalPrice * 0.5) : totalPrice;

    return { totalPrice, finalPrice, isFirst, effectiveServices };
  };

  const calculated      = reservations.map(r => ({ ...r, calc: calculateReservationPrice(r) }));
  const prihod          = calculated.reduce((s, r) => s + r.calc.finalPrice, 0);
  const troskovi        = calculated.reduce((s, r) => s + Math.round(r.calc.totalPrice * 0.25), 0);
  const zarada          = prihod - troskovi;
  const totalMarketing  = MARKETING_FEE + adSpend;
  const totalBookings   = reservations.length;
  const uniqueKlijenti  = new Set(reservations.map(r => r.customer_email)).size;

  // ── Login screen ──────────────────────────────────────────────────────────
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
                type="password" value={password}
                onChange={e => { setPassword(e.target.value); setPwdError(false); }}
                placeholder="Unesite lozinku" autoFocus
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

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh flex flex-col bg-[#F8F9FA] pt-16">
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      {/* Header */}
      <header className="bg-white border-b border-foreground/5 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between gap-6 shrink-0 z-20 shadow-sm sticky top-0">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="border-r border-foreground/10 pr-4 md:pr-6">
            <h1 className="text-xl font-bold font-playfair tracking-tight">Infinity Laser Studio</h1>
            <p className="text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
          <nav className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1">
            <span className="px-3 py-1.5 rounded-lg bg-white shadow-sm text-xs font-bold font-poppins text-foreground uppercase tracking-widest">Finansije</span>
            <Link href="/stats" className="px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/30 hover:text-foreground/60 uppercase tracking-widest transition-colors">Statistike</Link>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all font-poppins text-xs font-bold cursor-pointer">
          <LogOut size={16} /><span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      {/* Month navigation */}
      <div className="bg-white border-b border-foreground/5 px-4 md:px-8 py-3 md:py-4 shrink-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center bg-foreground/3 rounded-2xl p-1 shadow-inner">
            <button onClick={handlePrev} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all active:scale-90"><ChevronLeft size={20}/></button>
            <div className="px-4 md:px-8 text-center min-w-40 md:min-w-60">
              <p className="text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/30 leading-none mb-1">Period</p>
              <p className="text-sm md:text-base font-bold font-poppins truncate capitalize">{fmtMonthYear(currentDate)}</p>
            </div>
            <button onClick={handleNext} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all active:scale-90"><ChevronRight size={20}/></button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProjected(p => !p)}
              role="switch" aria-checked={projected}
              className={`flex items-center gap-3 h-11 pl-4 pr-2 rounded-2xl border-2 transition-all shadow-sm font-poppins text-xs font-bold ${
                projected ? "border-teal/30 bg-teal/5 text-teal" : "border-foreground/10 bg-foreground/2 text-foreground/40"
              }`}
            >
              <span className="uppercase tracking-widest">Projektovane finansije</span>
              <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${projected ? "bg-teal" : "bg-foreground/15"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${projected ? "translate-x-4" : ""}`} />
              </span>
            </button>
            <button onClick={goToday} className="hidden md:flex h-11 px-6 items-center justify-center rounded-2xl border-2 border-teal/10 text-teal text-xs font-bold font-poppins hover:bg-teal/5 transition-all shadow-sm">OVAJ MESEC</button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-teal/10 flex items-center justify-center mb-3"><Wallet className="text-teal" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Prihod</p>
            <p className="text-2xl md:text-3xl font-bold font-playfair">{prihod.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold text-foreground/30 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={64} /></div>
          </div>

          <div className="bg-white p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-red-400/10 flex items-center justify-center mb-3"><TrendingDown className="text-red-400" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Troškovi <span className="normal-case opacity-60">(25%)</span></p>
            <p className="text-2xl md:text-3xl font-bold font-playfair text-red-400">{troskovi.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold text-red-300 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={64} /></div>
          </div>

          <div className={`p-5 md:p-6 rounded-4xl border shadow-sm relative overflow-hidden group ${zarada >= 0 ? "bg-white border-foreground/5" : "bg-red-50 border-red-200/50"}`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${zarada >= 0 ? "bg-amber-500/10" : "bg-red-100"}`}>
              <Wallet className={zarada >= 0 ? "text-amber-500" : "text-red-400"} size={20} />
            </div>
            <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Zarada</p>
            <p className={`text-2xl md:text-3xl font-bold font-playfair ${zarada >= 0 ? "text-amber-500" : "text-red-400"}`}>{zarada.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold opacity-50 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={64} /></div>
          </div>

          <div className="bg-white p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center mb-3"><Users className="text-[#3B82F6]" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-[0.2em] mb-1">Klijenti</p>
            <p className="text-2xl md:text-3xl font-bold font-playfair">{uniqueKlijenti}<span className="text-sm font-poppins font-medium text-foreground/30 ml-2">/ {totalBookings} termina</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><CalendarCheck size={64} /></div>
          </div>
        </div>

        {/* Marketing investicija */}
        <div className="bg-white rounded-3xl border border-foreground/5 shadow-sm px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest mb-0.5">Investicija u marketing</p>
            <p className="text-sm font-bold font-poppins text-foreground/60">Jednokratno + oglasi (mesečno) · praćenje povrata</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Marketing fee</p>
                <p className="text-sm font-bold font-poppins text-foreground/70">{MARKETING_FEE.toLocaleString("sr-RS")} RSD</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Oglasi (Ad spend)</p>
                <div className="flex items-center gap-1.5 rounded-xl border-2 border-foreground/10 focus-within:border-teal/40 bg-foreground/2 px-3 py-1 transition-colors">
                  <input
                    type="text" inputMode="numeric"
                    value={adSpend ? adSpend.toLocaleString("sr-RS") : ""}
                    onChange={e => handleAdSpendChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    placeholder="0"
                    className="w-24 bg-transparent text-sm font-bold font-poppins text-foreground/70 focus:outline-none text-right"
                  />
                  <span className="text-[11px] font-bold font-poppins text-foreground/30">RSD</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-foreground/10 pt-2">
                <p className="text-[10px] font-bold font-poppins text-foreground/40 uppercase tracking-widest">Ukupno</p>
                <p className="text-base font-bold font-poppins text-teal">{totalMarketing.toLocaleString("sr-RS")} RSD</p>
              </div>
            </div>
            <div className="w-px h-16 bg-foreground/10 hidden sm:block" />
            <div className="text-right">
              <p className="text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest mb-0.5">Zarada ovog meseca pokriva</p>
              <p className={`text-base font-bold font-poppins ${zarada > 0 ? "text-teal" : "text-foreground/30"}`}>
                {zarada > 0 ? `${Math.round((zarada / totalMarketing) * 100)}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-white rounded-4xl border border-foreground/5 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-foreground/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-playfair">Termini</h2>
              <p className="text-[11px] font-bold font-poppins text-foreground/30 uppercase tracking-widest mt-1">{projected ? "Sve potvrđene rezervacije — uključujući buduće" : "Sve potvrđene rezervacije za ovaj period"}</p>
            </div>
            {loading && <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/2">
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Datum</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Klijent</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest">Usluge</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/30 uppercase tracking-widest text-right">Iznos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {calculated.length === 0 ? (
                  <tr><td colSpan={4} className="px-8 py-20 text-center opacity-20"><Wallet size={48} className="mx-auto mb-2"/><p className="font-poppins text-sm font-medium uppercase tracking-widest">Nema podataka</p></td></tr>
                ) : (
                  calculated.map(r => {
                    const { finalPrice, isFirst, effectiveServices } = r.calc;
                    const services = effectiveServices.map(s => s.name).join(", ");
                    const d = new Date(r.date);
                    return (
                      <tr key={r.id} className="hover:bg-foreground/1 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-foreground/2 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-foreground/30 leading-none">{SR_MONTHS_SHORT[d.getMonth()]}</span>
                              <span className="text-sm font-bold text-foreground leading-none mt-0.5">{d.getDate()}</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-foreground/20 uppercase tracking-wider"><Clock size={10} />{r.start_time.slice(0, 5)}</div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold font-poppins text-foreground/80">{r.customer_name}</p>
                          <p className="text-[11px] font-medium font-poppins text-foreground/30">{r.customer_email}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium font-poppins text-foreground/60 line-clamp-1 max-w-xs">{services}</p>
                            {isFirst && (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-pink uppercase tracking-widest">
                                <Tag size={10} /> 50% popusta (prvi put)
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <p className="text-sm font-bold font-poppins text-teal">{finalPrice.toLocaleString("sr-RS")} RSD</p>
                          {isFirst && <p className="text-[10px] font-medium font-poppins text-foreground/20 line-through">{(finalPrice * 2).toLocaleString("sr-RS")} RSD</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-8 py-4 bg-foreground/2 border-t border-foreground/5 flex justify-end">
            <p className="text-xs font-bold font-poppins text-foreground/40 uppercase tracking-widest">
              Ukupno: <span className="text-teal ml-2">{prihod.toLocaleString("sr-RS")} RSD</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
