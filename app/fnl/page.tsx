/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LogOut, Filter, AlertCircle, AlertTriangle, CheckCircle2, ArrowDown,
  Users, CalendarCheck, Percent, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAuth } from "@/lib/adminAuth";
import AdminLogin from "@/components/AdminLogin";
import { useAdminLocation } from "@/lib/adminLocation";
import { LOCATIONS, locationTheme, type LocationId } from "@/lib/locations";
import { FUNNEL_STAGES, type FunnelStage } from "@/lib/funnel";

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES = [
  { key: "today", label: "Danas",    days: 0 },
  { key: "7",     label: "7 dana",   days: 7 },
  { key: "30",    label: "30 dana",  days: 30 },
  { key: "90",    label: "90 dana",  days: 90 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** Live view: refresh every 10s while the tab is visible, and on refocus. */
const REFRESH_EVERY_MS = 10_000;

/** Drop-off severity - status colours always come with an icon and a word. */
const SEVERITY = {
  good:     { color: "#4ADE80", bg: "rgba(74,222,128,0.12)",  Icon: CheckCircle2,  word: "Odlično" },
  warning:  { color: "#FBBF24", bg: "rgba(251,191,36,0.12)",  Icon: AlertTriangle, word: "Pažnja" },
  critical: { color: "#F87171", bg: "rgba(248,113,113,0.14)", Icon: AlertCircle,   word: "Veliki gubitak" },
} as const;

function severityOf(dropPct: number): keyof typeof SEVERITY {
  if (dropPct < 20) return "good";
  if (dropPct < 40) return "warning";
  return "critical";
}

function fmtPct(n: number) {
  return `${n.toLocaleString("sr-RS", { maximumFractionDigits: 1 })}%`;
}

function rangeStart(key: RangeKey): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const days = RANGES.find((r) => r.key === key)!.days;
  if (days > 0) d.setDate(d.getDate() - (days - 1));
  return d;
}

type Row = { key: FunnelStage; label: string; hint: string; count: number };

// ═══════════════════════════════════════════════════════════════════════════════
export default function FunnelPage() {
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  /** Only the colours follow the admin's studio - the data filter is separate. */
  const { location } = useAdminLocation();

  const [range, setRange]       = useState<RangeKey>("30");
  const [studio, setStudio]     = useState<LocationId | null>(null);
  const [counts, setCounts]     = useState<Record<string, number> | null>(null);
  const [loading, setLoading]   = useState(false);
  /** Why the numbers are missing, in words for the owner. */
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Only the newest request may write - a slow one never overwrites a newer filter. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_booking_funnel", {
      p_from: rangeStart(range).toISOString(),
      p_to: new Date(Date.now() + 60_000).toISOString(),
      p_location: studio,
    });
    if (seq !== loadSeq.current) return;
    setLoading(false);
    if (error) {
      console.error("[fnl] load failed:", error.code, error.message);
      // PGRST202 = the function does not exist yet: sql/booking_funnel.sql not applied.
      setLoadError(error.code === "PGRST202"
        ? "Brojanje još nije uključeno u bazi (sql/booking_funnel.sql nije pokrenut)."
        : "Podaci nisu učitani. Proverite internet i kliknite na osveži.");
      return;
    }
    setLoadError(null);
    setCounts(Object.fromEntries((data ?? []).map((r) => [r.stage, Number(r.sessions)])));
  }, [range, studio]);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authenticated, load]);

  if (!authenticated) {
    return <AdminLogin icon={Filter} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  // With a studio picked, people who never picked one can't be judged - start at "studio".
  const stages = studio ? FUNNEL_STAGES.filter((s) => s.key !== "open") : FUNNEL_STAGES;
  const rows: Row[] = stages.map((s) => ({ ...s, count: counts?.[s.key] ?? 0 }));
  const top = rows[0].count;
  const booked = rows[rows.length - 1].count;
  const conversion = top > 0 ? (booked / top) * 100 : 0;

  // Step with the biggest share of people leaving (needs someone to arrive there).
  let worstIdx = -1;
  let worstDrop = 0;
  rows.forEach((r, i) => {
    if (i === 0) return;
    const prev = rows[i - 1].count;
    if (prev === 0) return;
    const drop = ((prev - r.count) / prev) * 100;
    if (drop > worstDrop) { worstDrop = drop; worstIdx = i; }
  });

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
            <Link href="/finances" className="px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/50 hover:text-foreground/76 uppercase tracking-widest transition-colors">Finansije</Link>
            <Link href="/stats" className="px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/50 hover:text-foreground/76 uppercase tracking-widest transition-colors">Statistike</Link>
            <span className="px-3 py-1.5 rounded-lg bg-accent/15 text-xs font-bold font-poppins text-accent uppercase tracking-widest">Funnel</span>
          </nav>
        </div>
        <button onClick={() => void signOut()} className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl bg-foreground/3 text-foreground/60 hover:text-red-400 hover:bg-red-400/10 transition-all font-poppins text-xs font-bold cursor-pointer">
          <LogOut size={16} /><span className="hidden md:inline uppercase tracking-widest">Odjava</span>
        </button>
      </header>

      {/* Filters - one row above the data */}
      <div className="bg-surface border-b border-foreground/5 px-4 md:px-8 py-3 md:py-4 shrink-0 z-10 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1 w-fit" role="group" aria-label="Period">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-widest transition-colors cursor-pointer ${
                  range === r.key ? "bg-accent text-on-accent shadow-sm" : "text-foreground/60 hover:text-foreground/82"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1" role="group" aria-label="Studio">
              <button
                type="button"
                onClick={() => setStudio(null)}
                aria-pressed={studio === null}
                className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-widest transition-colors cursor-pointer ${
                  studio === null ? "bg-foreground/12 text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground/82"
                }`}
              >
                Oba
              </button>
              {LOCATIONS.map((loc) => {
                const active = studio === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setStudio(loc.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
                      active ? "shadow-sm" : "text-foreground/60 hover:text-foreground/82"
                    }`}
                    style={active ? { backgroundColor: loc.palette.accent, color: loc.palette.onAccent } : undefined}
                  >
                    {!active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: loc.palette.accent }} />}
                    {loc.name}
                  </button>
                );
              })}
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/50" title="Osvežava se na svakih 10 sekundi">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Uživo
            </span>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Osveži"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-foreground/3 text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 py-6 md:py-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-6 md:gap-8">

          {loadError && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-400/10 border border-red-400/30 text-red-300 text-sm font-poppins">
              <AlertCircle size={18} className="shrink-0" />
              {loadError}
            </div>
          )}

          {/* KPI tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <Kpi
              icon={Users}
              label={studio ? "Izabralo studio" : "Otvorilo formu"}
              value={top.toLocaleString("sr-RS")}
              tint="#60A5FA"
            />
            <Kpi icon={CalendarCheck} label="Zakazalo termin" value={booked.toLocaleString("sr-RS")} tint="#4ADE80" />
            <Kpi icon={Percent} label="Konverzija" value={fmtPct(conversion)} tint="#C084FC" />
          </div>

          {/* Biggest leak */}
          {worstIdx > 0 && (
            <div
              className="flex items-start gap-3 md:gap-4 p-4 md:p-5 rounded-2xl border"
              style={{ backgroundColor: SEVERITY[severityOf(worstDrop)].bg, borderColor: `${SEVERITY[severityOf(worstDrop)].color}55` }}
            >
              <AlertTriangle size={22} className="shrink-0 mt-0.5" style={{ color: SEVERITY[severityOf(worstDrop)].color }} />
              <div className="font-poppins">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-foreground/60">Najviše ljudi odlazi ovde</p>
                <p className="text-base md:text-lg font-bold mt-1">
                  {rows[worstIdx - 1].label} → {rows[worstIdx].label}
                </p>
                <p className="text-sm text-foreground/70 mt-0.5">
                  {fmtPct(worstDrop)} ljudi ({(rows[worstIdx - 1].count - rows[worstIdx].count).toLocaleString("sr-RS")}) je odustalo na ovom koraku.
                </p>
              </div>
            </div>
          )}

          {/* Funnel */}
          <section className="bg-surface rounded-3xl border border-foreground/8 p-4 md:p-8 shadow-sm">
            <div className="flex items-baseline justify-between gap-4 mb-5 md:mb-7">
              <h2 className="text-lg md:text-2xl font-bold font-playfair">Koraci zakazivanja</h2>
              <p className="text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest text-foreground/50">
                Broj ljudi · % od početka
              </p>
            </div>

            {counts && top === 0 && !loading ? (
              <p className="py-10 text-center text-sm text-foreground/60 font-poppins">
                Još nema podataka za ovaj period. Brojanje počinje od trenutka kada je ova verzija sajta objavljena.
              </p>
            ) : (
              <ol className="flex flex-col">
                {rows.map((r, i) => {
                  const share = top > 0 ? (r.count / top) * 100 : 0;
                  const prev = i > 0 ? rows[i - 1].count : 0;
                  const lost = i > 0 ? prev - r.count : 0;
                  const dropPct = i > 0 && prev > 0 ? (lost / prev) * 100 : 0;
                  const sev = SEVERITY[severityOf(dropPct)];
                  return (
                    <li key={r.key}>
                      {/* Drop between the previous step and this one */}
                      {i > 0 && (
                        <div className="flex items-center gap-3 pl-4 md:pl-5 py-1.5">
                          <ArrowDown size={14} className="text-foreground/30 shrink-0" />
                          {prev > 0 ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-bold font-poppins"
                              style={{ backgroundColor: sev.bg, color: sev.color }}
                              title={sev.word}
                            >
                              <sev.Icon size={13} />
                              {fmtPct(dropPct)} otišlo
                              <span className="font-medium text-foreground/60">· {lost.toLocaleString("sr-RS")} ljudi</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-foreground/40 font-poppins">-</span>
                          )}
                        </div>
                      )}

                      <div
                        className="group relative grid grid-cols-[2rem_1fr_auto] md:grid-cols-[2.5rem_1fr_auto] items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl bg-foreground/3 hover:bg-foreground/6 transition-colors"
                        title={`${r.label}: ${r.count} ljudi (${fmtPct(share)} od početka)`}
                      >
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold font-poppins bg-accent/15 text-accent">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm md:text-base font-bold font-poppins">{r.label}</p>
                          <p className="text-[11px] md:text-xs text-foreground/50 font-poppins truncate">{r.hint}</p>
                          <div className="mt-2 h-2.5 md:h-3 rounded-full bg-foreground/6 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-[width] duration-700 ease-out"
                              style={{
                                width: `${Math.max(share, r.count > 0 ? 1.5 : 0)}%`,
                                backgroundImage: "linear-gradient(90deg, var(--accent-deep), var(--accent))",
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right pl-2">
                          <p className="text-lg md:text-2xl font-bold font-poppins tabular-nums leading-none">
                            {r.count.toLocaleString("sr-RS")}
                          </p>
                          <p className="text-[11px] md:text-xs text-foreground/50 font-poppins tabular-nums mt-1">{fmtPct(share)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] md:text-xs font-poppins text-foreground/60">
            {(["good", "warning", "critical"] as const).map((k) => {
              const s = SEVERITY[k];
              return (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <s.Icon size={13} style={{ color: s.color }} />
                  {s.word} ({k === "good" ? "ispod 20%" : k === "warning" ? "20-40%" : "preko 40%"} otišlo)
                </span>
              );
            })}
            <span className="text-foreground/40">Jedna osoba = jedan tab u pretraživaču.</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="relative overflow-hidden bg-surface rounded-2xl md:rounded-3xl border border-foreground/8 p-4 md:p-6 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tint }} />
      <div className="flex items-center gap-2 text-foreground/60">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tint}22`, color: tint }}>
          <Icon size={16} />
        </span>
        <p className="text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl md:text-4xl font-bold font-poppins tabular-nums mt-3">{value}</p>
    </div>
  );
}
