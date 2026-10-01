 
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, LogOut,
  DollarSign, CalendarCheck, Clock,
  TrendingUp, TrendingDown, Wallet, Tag, Users, AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import { useAdminAuth } from "@/lib/adminAuth";
import AdminLogin from "@/components/AdminLogin";
import type { ReservationStatus } from "@/lib/database.types";
import { computeReservationPrice } from "@/lib/pricing";
import { fetchPriceRows, PriceBook } from "@/lib/prices";
import AdminLocationSwitch from "@/components/AdminLocationSwitch";
import { useAdminLocation } from "@/lib/adminLocation";
import { getLocation, locationTheme } from "@/lib/locations";

// ── Constants ─────────────────────────────────────────────────────────────────
const SR_MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const SR_MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

/** Background refresh: every 20s while the tab is visible, and on refocus. */
const REFRESH_EVERY_MS    = 20_000;
const REFRESH_THROTTLE_MS = 5_000;

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
  promo_code: string | null;
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
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  /** Every number on this page belongs to one studio. */
  const { location, setLocation } = useAdminLocation();
  const MARKETING_FEE = getLocation(location).marketingFee;

  const [currentDate, setCurrentDate]     = useState<Date>(() => new Date());
  const [reservations, setReservations]   = useState<ReservationFull[]>([]);
  const [allServices, setAllServices]     = useState<ServiceWithPrice[]>([]);
  /** Every studio's price history - a booking counts at the price it was booked for. */
  const [priceBook, setPriceBook]         = useState<PriceBook>(() => new PriceBook([]));
  const [userHistories, setUserHistories] = useState<UserHistory[]>([]);
  const [loading, setLoading]             = useState(false);
  const [projected, setProjected]         = useState(false);
  const [adSpend, setAdSpend]             = useState(0);
  /** The month could not be loaded - say so instead of showing zeros. */
  const [loadError, setLoadError]         = useState(false);
  /** False until this month's ad spend is known - the field stays locked, so a
      failed load can never be overwritten with a fresh "0". */
  const [adSpendReady, setAdSpendReady]   = useState(false);
  const [adSpendError, setAdSpendError]   = useState<string | null>(null);

  // Per-month, per-studio ad spend, persisted in Supabase (marketing_spend, key 'YYYY-MM').
  const adSpendKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setAdSpendReady(false);
    setAdSpendError(null);
    (async () => {
      const { data, error } = await supabase
        .from("marketing_spend")
        .select("amount")
        .eq("location", location)
        .eq("month", adSpendKey)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setAdSpendError("Iznos za oglase nije učitan. Osveži stranicu.");
        return;
      }
      setAdSpend(data?.amount ?? 0);
      setAdSpendReady(true);
    })();
    return () => { active = false; };
  }, [authenticated, adSpendKey, location]);

  /** Saved once, when the field is left - not on every keystroke, where the
      requests could land out of order and keep a half-typed amount. */
  async function saveAdSpend() {
    if (!adSpendReady) return;
    const { error } = await supabase
      .from("marketing_spend")
      .upsert(
        { location, month: adSpendKey, amount: adSpend, updated_at: new Date().toISOString() },
        { onConflict: "location,month" },
      );
    setAdSpendError(error ? "Iznos za oglase NIJE sačuvan. Pokušaj ponovo." : null);
  }

  /** Only the latest request may write to the screen. */
  const monthReq    = useRef(0);
  const lastRefresh = useRef(0);

  const fetchMonthData = useCallback(async (date: Date, projectFuture: boolean, silent = false) => {
    const req = ++monthReq.current;
    if (!silent) setLoading(true);
    const today    = toDateStr(new Date());
    const monthEnd = toDateStr(getMonthEnd(date));
    const start    = toDateStr(getMonthStart(date));
    // Projected: include the whole month (future confirmed appointments).
    // Realized: cap at today so only elapsed appointments count.
    const end      = projectFuture ? monthEnd : (monthEnd < today ? monthEnd : today);

    try {
      const [{ data: svs, error: svsError }, priceRows] = await Promise.all([
        supabase.from("services").select("id, name, price"),
        fetchPriceRows(),
      ]);
      if (svsError) throw svsError;
      if (!priceRows) throw new Error("finances: prices could not be loaded");
      const book = new PriceBook(priceRows);

      if (req !== monthReq.current) return;
      if (!projectFuture && start > today) {
        setAllServices((svs as ServiceWithPrice[]) ?? []);
        setPriceBook(book);
        setReservations([]);
        setUserHistories([]);
        setLoadError(false);
        setLoading(false);
        return;
      }

      const monthRsvs = await fetchAll<ReservationFull>((from, to) =>
        supabase
          .from("reservations")
          .select(`*, reservation_services(services(id, name, price))`)
          .eq("location", location)
          .gte("date", start).lte("date", end)
          .eq("status", "confirmed")
          .order("date", { ascending: false })
          .order("id")
          .range(from, to));

      // History spans both studios: a first treatment is the client's first
      // with the brand. Read whole and matched here in lowercase - the same
      // client is stored as "Ana@x.com" and "ana@x.com".
      const hist = monthRsvs.length === 0 ? [] : await fetchAll<UserHistory>((from, to) =>
        supabase
          .from("reservations")
          .select("customer_email, date, start_time")
          .eq("status", "confirmed")
          .lte("date", end)
          .order("id")
          .range(from, to));

      if (req !== monthReq.current) return;
      // All three together, so the screen never mixes a new month with old prices.
      setAllServices((svs as ServiceWithPrice[]) ?? []);
      setPriceBook(book);
      setReservations(monthRsvs);
      setUserHistories(hist);
      setLoadError(false);
    } catch {
      if (req !== monthReq.current) return;
      // A failed background refresh keeps the figures already on screen.
      if (!silent) {
        setReservations([]);
        setUserHistories([]);
        setLoadError(true);
      }
    }
    setLoading(false);
  }, [location]);

  useEffect(() => {
    if (authenticated) fetchMonthData(currentDate, projected);
  }, [authenticated, currentDate, projected, fetchMonthData]);

  // Keep the figures current without a manual reload.
  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current < REFRESH_THROTTLE_MS) return;
      lastRefresh.current = Date.now();
      void fetchMonthData(currentDate, projected, true);
    };
    const timer = setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [authenticated, currentDate, projected, fetchMonthData]);

  function handleLogout() {
    void signOut();
  }

  const handlePrev = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNext = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday    = () => setCurrentDate(new Date());

  // ── Calculations ──────────────────────────────────────────────────────────
  const calculateReservationPrice = (r: ReservationFull) => {
    const base = priceBook.apply(
      r.reservation_services.map(rs => rs.services).filter((s): s is ServiceWithPrice => s !== null),
      location, r.created_at);
    const effectiveServices = applyComboRules(base, priceBook.apply(allServices, location, r.created_at));
    const totalPrice = effectiveServices.reduce((sum, s) => sum + s.price, 0);

    const email   = r.customer_email.trim().toLowerCase();
    const userAll = userHistories.filter(h => h.customer_email.trim().toLowerCase() === email);
    const sorted  = [...userAll].sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.start_time.localeCompare(b.start_time));
    const isFirst = sorted[0]?.date === r.date && sorted[0]?.start_time === r.start_time;

    const price = computeReservationPrice({
      listPrice: totalPrice,
      isFirstTreatment: isFirst,
      createdAt: r.created_at,
      promoCode: r.promo_code,
    });

    return { totalPrice, effectiveServices, ...price };
  };

  const calculated      = reservations.map(r => ({ ...r, calc: calculateReservationPrice(r) }));
  const prihod          = calculated.reduce((s, r) => s + r.calc.finalPrice, 0);
  const troskovi        = calculated.reduce((s, r) => s + Math.round(r.calc.totalPrice * 0.25), 0);
  const zarada          = prihod - troskovi;
  const totalMarketing  = MARKETING_FEE + adSpend;
  const totalBookings   = reservations.length;
  const uniqueKlijenti  = new Set(reservations.map(r => r.customer_email.trim().toLowerCase())).size;

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return <AdminLogin icon={DollarSign} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh flex flex-col bg-background pt-16 text-foreground admin-theme" style={locationTheme(location)}>
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      {/* Header */}
      <header className="bg-surface border-b-2 border-accent/40 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between gap-6 shrink-0 z-20 shadow-sm sticky top-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-6">
          <div className="border-r border-foreground/10 pr-4 md:pr-6">
            <h1 className="text-xl font-bold font-playfair tracking-tight">Infinity Laser Studio</h1>
            <p className="text-[10px] text-foreground/50 font-bold font-poppins uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
          <nav className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1">
            <span className="px-3 py-1.5 rounded-lg bg-accent/15 text-xs font-bold font-poppins text-accent uppercase tracking-widest">Finansije</span>
            <Link href="/stats" className="px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/50 hover:text-foreground/76 uppercase tracking-widest transition-colors">Statistike</Link>
          </nav>
          <AdminLocationSwitch
            value={location}
            onChange={(next) => { setReservations([]); setUserHistories([]); setAdSpend(0); setLocation(next); }}
          />
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/60 hover:text-red-400 hover:bg-red-400/10 transition-all font-poppins text-xs font-bold cursor-pointer">
          <LogOut size={16} /><span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      {/* Month navigation */}
      <div className="bg-surface border-b border-foreground/5 px-4 md:px-8 py-3 md:py-4 shrink-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center bg-foreground/3 rounded-2xl p-1 shadow-inner">
            <button onClick={handlePrev} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/8 transition-all active:scale-90"><ChevronLeft size={20}/></button>
            <div className="px-4 md:px-8 text-center min-w-40 md:min-w-60">
              <p className="text-[10px] font-bold font-poppins uppercase tracking-[0.2em] text-foreground/50 leading-none mb-1">Period</p>
              <p className="text-sm md:text-base font-bold font-poppins truncate capitalize">{fmtMonthYear(currentDate)}</p>
            </div>
            <button onClick={handleNext} className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/8 transition-all active:scale-90"><ChevronRight size={20}/></button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProjected(p => !p)}
              role="switch" aria-checked={projected}
              className={`flex items-center gap-3 h-11 pl-4 pr-2 rounded-2xl border-2 transition-all shadow-sm font-poppins text-xs font-bold ${
                projected ? "border-accent/30 bg-accent/5 text-accent" : "border-foreground/10 bg-foreground/2 text-foreground/60"
              }`}
            >
              <span className="uppercase tracking-widest">Projektovane finansije</span>
              <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${projected ? "bg-accent" : "bg-foreground/15"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-foreground shadow transition-transform ${projected ? "translate-x-4" : ""}`} />
              </span>
            </button>
            <button onClick={goToday} className="hidden md:flex h-11 px-6 items-center justify-center rounded-2xl border-2 border-accent/30 text-accent text-xs font-bold font-poppins hover:bg-accent/10 transition-all shadow-sm">OVAJ MESEC</button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-6">

        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-red-400/40 bg-red-400/10 text-red-300 text-sm font-semibold font-poppins">
            <span className="flex items-center gap-2"><AlertCircle size={16} />Podaci nisu učitani. Brojevi ispod nisu tačni.</span>
            <button onClick={() => fetchMonthData(currentDate, projected)} className="px-4 py-1.5 rounded-xl bg-red-400/20 hover:bg-red-400/30 transition-colors cursor-pointer">Pokušaj ponovo</button>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-surface p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center mb-3"><Wallet className="text-accent" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-[0.2em] mb-1">Prihod</p>
            <p className="text-2xl md:text-3xl font-bold font-playfair">{prihod.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold text-foreground/50 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={64} /></div>
          </div>

          <div className="bg-surface p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-red-400/10 flex items-center justify-center mb-3"><TrendingDown className="text-red-400" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-[0.2em] mb-1">Troškovi <span className="normal-case opacity-60">(25%)</span></p>
            <p className="text-2xl md:text-3xl font-bold font-playfair text-red-400">{troskovi.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold text-red-400/60 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={64} /></div>
          </div>

          <div className={`p-5 md:p-6 rounded-4xl border shadow-sm relative overflow-hidden group ${zarada >= 0 ? "bg-surface border-foreground/5" : "bg-red-400/10 border-red-400/30"}`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${zarada >= 0 ? "bg-amber-500/10" : "bg-red-400/20"}`}>
              <Wallet className={zarada >= 0 ? "text-amber-500" : "text-red-400"} size={20} />
            </div>
            <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-[0.2em] mb-1">Zarada</p>
            <p className={`text-2xl md:text-3xl font-bold font-playfair ${zarada >= 0 ? "text-amber-500" : "text-red-400"}`}>{zarada.toLocaleString("sr-RS")}<span className="text-base font-poppins font-semibold opacity-50 ml-1">RSD</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={64} /></div>
          </div>

          <div className="bg-surface p-5 md:p-6 rounded-4xl border border-foreground/5 shadow-sm relative overflow-hidden group">
            <div className="w-10 h-10 rounded-2xl bg-sky-400/10 flex items-center justify-center mb-3"><Users className="text-sky-400" size={20} /></div>
            <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-[0.2em] mb-1">Klijenti</p>
            <p className="text-2xl md:text-3xl font-bold font-playfair">{uniqueKlijenti}<span className="text-sm font-poppins font-medium text-foreground/50 ml-2">/ {totalBookings} termina</span></p>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><CalendarCheck size={64} /></div>
          </div>
        </div>

        {/* Marketing investicija */}
        <div className="bg-surface rounded-3xl border border-foreground/5 shadow-sm px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mb-0.5">Investicija u marketing</p>
            <p className="text-sm font-bold font-poppins text-foreground/76">Jednokratno + oglasi (mesečno) · praćenje povrata</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest">Marketing fee</p>
                <p className="text-sm font-bold font-poppins text-foreground/82">{MARKETING_FEE.toLocaleString("sr-RS")} RSD</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest">Oglasi (Ad spend)</p>
                <div className="flex items-center gap-1.5 rounded-xl border-2 border-foreground/10 focus-within:border-accent/40 bg-foreground/2 px-3 py-1 transition-colors">
                  <input
                    type="text" inputMode="numeric"
                    value={adSpend ? adSpend.toLocaleString("sr-RS") : ""}
                    onChange={e => setAdSpend(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    onBlur={saveAdSpend}
                    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    disabled={!adSpendReady}
                    placeholder="0"
                    className="w-24 bg-transparent text-sm font-bold font-poppins text-foreground/82 focus:outline-none text-right disabled:opacity-40"
                  />
                  <span className="text-[11px] font-bold font-poppins text-foreground/50">RSD</span>
                </div>
              </div>
              {adSpendError && (
                <p className="text-[11px] font-bold font-poppins text-red-400 text-right">{adSpendError}</p>
              )}
              <div className="flex items-center justify-between gap-4 border-t border-foreground/10 pt-2">
                <p className="text-[10px] font-bold font-poppins text-foreground/60 uppercase tracking-widest">Ukupno</p>
                <p className="text-base font-bold font-poppins text-accent">{totalMarketing.toLocaleString("sr-RS")} RSD</p>
              </div>
            </div>
            <div className="w-px h-16 bg-foreground/10 hidden sm:block" />
            <div className="text-right">
              <p className="text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mb-0.5">Zarada ovog meseca pokriva</p>
              <p className={`text-base font-bold font-poppins ${zarada > 0 ? "text-accent" : "text-foreground/50"}`}>
                {zarada > 0 && totalMarketing > 0 ? `${Math.round((zarada / totalMarketing) * 100)}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-surface rounded-4xl border border-foreground/5 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-foreground/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-playfair">Termini</h2>
              <p className="text-[11px] font-bold font-poppins text-foreground/50 uppercase tracking-widest mt-1">{projected ? "Sve potvrđene rezervacije — uključujući buduće" : "Sve potvrđene rezervacije za ovaj period"}</p>
            </div>
            {loading && <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/2">
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest">Datum</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest">Klijent</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest">Usluge</th>
                  <th className="px-8 py-4 text-[10px] font-bold font-poppins text-foreground/50 uppercase tracking-widest text-right">Iznos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {calculated.length === 0 ? (
                  <tr><td colSpan={4} className="px-8 py-20 text-center opacity-20"><Wallet size={48} className="mx-auto mb-2"/><p className="font-poppins text-sm font-medium uppercase tracking-widest">Nema podataka</p></td></tr>
                ) : (
                  calculated.map(r => {
                    const { finalPrice, effectiveServices, fiftyOff, promoOff, studentOff, promoCode, listPrice } = r.calc;
                    const services = effectiveServices.map(s => s.name).join(", ");
                    const hasDiscount = finalPrice !== listPrice;
                    const d = new Date(`${r.date}T00:00:00`);
                    return (
                      <tr key={r.id} className="hover:bg-foreground/1 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-foreground/2 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-foreground/50 leading-none">{SR_MONTHS_SHORT[d.getMonth()]}</span>
                              <span className="text-sm font-bold text-foreground leading-none mt-0.5">{d.getDate()}</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-foreground/38 uppercase tracking-wider"><Clock size={10} />{r.start_time.slice(0, 5)}</div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold font-poppins text-foreground/80">{r.customer_name}</p>
                          <p className="text-[11px] font-medium font-poppins text-foreground/50">{r.customer_email}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium font-poppins text-foreground/76 line-clamp-1 max-w-xs">{services}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {fiftyOff && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-rose uppercase tracking-widest">
                                  <Tag size={10} /> −50% (prvi put)
                                </div>
                              )}
                              {promoOff && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-green-400 uppercase tracking-widest">
                                  <Tag size={10} /> −10% promo{promoCode ? ` · ${promoCode}` : ""}
                                </div>
                              )}
                              {studentOff && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-amber-300 uppercase tracking-widest">
                                  <Tag size={10} /> −20% student
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <p className="text-sm font-bold font-poppins text-accent">{finalPrice.toLocaleString("sr-RS")} RSD</p>
                          {hasDiscount && <p className="text-[10px] font-medium font-poppins text-foreground/38 line-through">{listPrice.toLocaleString("sr-RS")} RSD</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-8 py-4 bg-foreground/2 border-t border-foreground/5 flex justify-end">
            <p className="text-xs font-bold font-poppins text-foreground/60 uppercase tracking-widest">
              Ukupno: <span className="text-accent ml-2">{prihod.toLocaleString("sr-RS")} RSD</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
