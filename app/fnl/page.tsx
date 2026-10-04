/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Filter, AlertCircle, AlertTriangle, CheckCircle2, ArrowDown,
  Users, CalendarCheck, Percent, RefreshCw, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAuth } from "@/lib/adminAuth";
import AdminLogin from "@/components/AdminLogin";
import AdminHeader from "@/components/AdminHeader";
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

type SourceRow = { source: string; utm: string; opened: number; picked_studio: number; booked: number };

/** What opened the form, in the owner's words (see FunnelSource in lib/funnel.ts). */
const SOURCE_LABELS: Record<string, string> = {
  hero:      "Dugme na vrhu stranice",
  plutajuce: "Plutajuće dugme (dole)",
  navbar:    "Meni",
  footer:    "Dugme u futeru",
  zajednica: "Sekcija zajednica",
  cenovnik:  "Stranica cenovnik",
  link:      "Link koji sam otvara formu",
  nepoznato: "Pre početka merenja",
};

/** Phone screenshots of each step (public/fnl/<stage>.webp, 390×844 screens at 560px wide). */
const SHOT_W = 560;
const SHOT_H = 1212;

// ═══════════════════════════════════════════════════════════════════════════════
export default function FunnelPage() {
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  /** Only the colours follow the admin's studio - the data filter is separate. */
  const { location } = useAdminLocation();

  const [range, setRange]       = useState<RangeKey>("30");
  const [studio, setStudio]     = useState<LocationId | null>(null);
  const [counts, setCounts]     = useState<Record<string, number> | null>(null);
  const [sources, setSources]   = useState<SourceRow[]>([]);
  const [loading, setLoading]   = useState(false);
  /** Why the numbers are missing, in words for the owner. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Screenshot opened full size. */
  const [zoom, setZoom] = useState<Row | null>(null);

  /** Only the newest request may write - a slow one never overwrites a newer filter. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    const args = {
      p_from: rangeStart(range).toISOString(),
      p_to: new Date(Date.now() + 60_000).toISOString(),
      p_location: studio,
    };
    const [{ data, error }, bySource] = await Promise.all([
      supabase.rpc("admin_booking_funnel", args),
      supabase.rpc("admin_funnel_sources", args),
    ]);
    if (seq !== loadSeq.current) return;
    // The breakdown is extra - without it (sql/funnel_source.sql not run) the funnel still shows.
    if (bySource.error) console.error("[fnl] sources failed:", bySource.error.code, bySource.error.message);
    setSources((bySource.data ?? []).map((r) => ({
      ...r, opened: Number(r.opened), picked_studio: Number(r.picked_studio), booked: Number(r.booked),
    })));
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

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

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
    <main className="min-h-dvh flex flex-col bg-background text-foreground admin-theme" style={locationTheme(location)}>
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>

      <AdminHeader current="fnl" location={location} onLogout={() => void signOut()} />

      {/* Filters - one row above the data */}
      <div className="bg-surface border-b border-foreground/5 px-3 md:px-8 py-2.5 md:py-4 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-foreground/3 rounded-xl p-1 sm:w-fit" role="group" aria-label="Period">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`h-9 sm:h-auto px-2 sm:px-3 sm:py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-wider sm:tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
                  range === r.key ? "bg-accent text-on-accent shadow-sm" : "text-foreground/60 hover:text-foreground/82"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 sm:flex-none grid grid-cols-3 sm:flex items-center gap-1 bg-foreground/3 rounded-xl p-1" role="group" aria-label="Studio">
              <button
                type="button"
                onClick={() => setStudio(null)}
                aria-pressed={studio === null}
                className={`h-9 sm:h-auto px-2 sm:px-3 sm:py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-wider sm:tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
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
                    className={`h-9 sm:h-auto flex items-center justify-center gap-1.5 px-2 sm:px-3 sm:py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-poppins uppercase tracking-wider sm:tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
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
              className="w-11 h-11 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-xl bg-foreground/3 text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 md:px-8 py-4 md:py-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 md:gap-8">

          {loadError && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-400/10 border border-red-400/30 text-red-300 text-sm font-poppins">
              <AlertCircle size={18} className="shrink-0" />
              {loadError}
            </div>
          )}

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-4">
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
          <section className="bg-surface rounded-3xl border border-foreground/8 p-3 md:p-8 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4 md:mb-7 px-1 md:px-0">
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
                        <div className="flex items-center gap-3 pl-3 md:pl-5 py-1.5">
                          <ArrowDown size={14} className="text-foreground/30 shrink-0" />
                          {prev > 0 ? (
                            <span
                              className="inline-flex flex-wrap items-center gap-x-1.5 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-bold font-poppins"
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
                        className="group relative grid grid-cols-[4.5rem_1fr_auto] sm:grid-cols-[5.5rem_1fr_auto] md:grid-cols-[9rem_1fr_auto] items-center gap-3 md:gap-6 p-2.5 md:p-4 rounded-2xl bg-foreground/3 hover:bg-foreground/6 transition-colors"
                        title={`${r.label}: ${r.count} ljudi (${fmtPct(share)} od početka)`}
                      >
                        <button
                          type="button"
                          onClick={() => setZoom(r)}
                          aria-label={`Uvećaj: ${r.label}`}
                          className="relative block rounded-xl md:rounded-2xl overflow-hidden border border-foreground/10 shadow-md cursor-zoom-in transition-transform hover:scale-[1.03]"
                        >
                          <Image
                            src={`/fnl/${r.key}.webp`}
                            alt={r.label}
                            width={SHOT_W}
                            height={SHOT_H}
                            sizes="(min-width: 768px) 144px, (min-width: 640px) 88px, 72px"
                            className="w-full h-auto"
                          />
                          <span className="absolute top-1.5 left-1.5 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[11px] md:text-xs font-bold font-poppins bg-accent text-on-accent shadow">
                            {i + 1}
                          </span>
                        </button>
                        <div className="min-w-0">
                          <p className="text-[13px] sm:text-sm md:text-base font-bold font-poppins leading-snug">{r.label}</p>
                          <p className="text-[11px] md:text-sm text-foreground/50 font-poppins leading-snug line-clamp-2">{r.hint}</p>
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
                        <div className="text-right sm:pl-2">
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

          {/* Where people opened the form from */}
          {sources.length > 0 && (
            <section className="bg-surface rounded-3xl border border-foreground/8 p-3 md:p-8 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3 md:mb-5 px-1 md:px-0">
                <h2 className="text-lg md:text-2xl font-bold font-playfair">Odakle dolaze</h2>
                <p className="text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest text-foreground/50">
                  Otvorilo · izabralo grad · zakazalo
                </p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {sources.map((s) => {
                  const studioPct = s.opened > 0 ? (s.picked_studio / s.opened) * 100 : 0;
                  const bookedPct = s.opened > 0 ? (s.booked / s.opened) * 100 : 0;
                  return (
                    <li
                      key={`${s.source}|${s.utm}`}
                      className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_6rem_8rem_8rem] items-center gap-x-4 gap-y-1 p-3 md:px-4 rounded-2xl bg-foreground/3 font-poppins"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] md:text-sm font-bold leading-snug">{SOURCE_LABELS[s.source] ?? s.source}</p>
                        {s.utm && <p className="text-[11px] md:text-xs text-foreground/50">iz reklame / izvora: {s.utm}</p>}
                      </div>
                      <p className="text-right text-lg md:text-xl font-bold tabular-nums">{s.opened.toLocaleString("sr-RS")}</p>
                      <p className="col-span-2 md:col-span-1 text-[11px] md:text-sm text-foreground/60 md:text-right tabular-nums">
                        {s.picked_studio.toLocaleString("sr-RS")} izabralo grad <span className="text-foreground/40">({fmtPct(studioPct)})</span>
                      </p>
                      <p className="col-span-2 md:col-span-1 text-[11px] md:text-sm text-foreground/60 md:text-right tabular-nums">
                        {s.booked.toLocaleString("sr-RS")} zakazalo <span className="text-foreground/40">({fmtPct(bookedPct)})</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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

      {/* Full-size screenshot */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoom.label}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-3 p-4 bg-black/80 backdrop-blur-sm cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Zatvori"
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X size={20} />
          </button>
          <Image
            src={`/fnl/${zoom.key}.webp`}
            alt={zoom.label}
            width={SHOT_W}
            height={SHOT_H}
            className="w-auto h-auto max-h-[82dvh] max-w-full rounded-2xl shadow-2xl"
          />
          <p className="text-white font-poppins font-bold text-sm md:text-base">{zoom.label}</p>
        </div>
      )}
    </main>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="relative overflow-hidden bg-surface rounded-2xl md:rounded-3xl border border-foreground/8 p-3 sm:p-4 md:p-6 shadow-sm min-w-0">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tint }} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-foreground/60">
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}22`, color: tint }}>
          <Icon size={15} />
        </span>
        <p className="text-[9px] sm:text-[10px] md:text-xs font-bold font-poppins uppercase tracking-wider sm:tracking-widest leading-tight">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl md:text-4xl font-bold font-poppins tabular-nums mt-2 sm:mt-3">{value}</p>
    </div>
  );
}
