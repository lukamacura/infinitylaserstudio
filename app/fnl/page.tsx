/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Filter, AlertCircle, AlertTriangle, CheckCircle2, ArrowDown,
  Users, CalendarCheck, Percent, RefreshCw, X, Globe, Search, Link2, History, MousePointerClick,
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
  hero:      "dugme na vrhu",
  plutajuce: "plutajuće dugme",
  navbar:    "meni",
  footer:    "futer",
  zajednica: "sekcija zajednica",
  cenovnik:  "cenovnik",
};

/**
 * utm_source values Meta fills in for its ads ({{site_source_name}}): ig, fb,
 * msg (Messenger), an (Audience Network), th (Threads) - plus our own "meta"
 * for a bare fbclid. All one ad, just shown in different places.
 */
const META_UTM = /^(ig|insta|instagram|fb|facebook|meta|msg|messenger|an|th|threads)/;

type Tally = { opened: number; booked: number };
const tally = (): Tally => ({ opened: 0, booked: 0 });
const add = (t: Tally, r: SourceRow) => { t.opened += r.opened; t.booked += r.booked; };

/** A few clear groups: the ad (split by how it opened the form), then everything without an ad. */
function groupSources(rows: SourceRow[]) {
  const ad = { all: tally(), link: tally(), site: tally(), instagram: 0, facebook: 0, rest: 0 };
  const link = tally();
  const site = tally();
  const before = tally();
  const other = { ...tally(), names: [] as string[] };
  const buttons = new Map<string, number>();

  for (const r of rows) {
    const u = r.utm.toLowerCase();
    if (u && META_UTM.test(u)) {
      add(ad.all, r);
      add(r.source === "link" ? ad.link : ad.site, r);
      if (/^(ig|insta)/.test(u)) ad.instagram += r.opened;
      else if (/^(fb|facebook)/.test(u)) ad.facebook += r.opened;
      else ad.rest += r.opened;
    } else if (u) {
      add(other, r);
      if (!other.names.includes(u)) other.names.push(u);
    } else if (r.source === "link") {
      add(link, r);
    } else if (r.source === "nepoznato") {
      add(before, r);
    } else {
      add(site, r);
      buttons.set(r.source, (buttons.get(r.source) ?? 0) + r.opened);
    }
  }
  const topButton = [...buttons.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  return { ad, link, site, before, other, topButton: topButton ? SOURCE_LABELS[topButton] ?? topButton : null };
}

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
          {sources.length > 0 && (() => {
            const g = groupSources(sources);
            const platforms = [
              g.ad.instagram > 0 && `Instagram ${g.ad.instagram.toLocaleString("sr-RS")}`,
              g.ad.facebook > 0 && `Facebook ${g.ad.facebook.toLocaleString("sr-RS")}`,
              g.ad.rest > 0 && `ostalo ${g.ad.rest.toLocaleString("sr-RS")}`,
            ].filter(Boolean).join(" · ");
            return (
              <section className="bg-surface rounded-3xl border border-foreground/8 p-3 md:p-8 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3 md:mb-5 px-1 md:px-0">
                  <h2 className="text-lg md:text-2xl font-bold font-playfair">Odakle dolaze</h2>
                  <p className="text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest text-foreground/50">
                    Otvorilo formu · zakazalo
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.ad.all.opened > 0 && (
                    <li className="rounded-2xl bg-foreground/3">
                      <SourceLine
                        icon={<span className="flex -space-x-2"><InstagramLogo /><FacebookLogo /></span>}
                        label="Reklama (Instagram / Facebook)"
                        detail={platforms}
                        t={g.ad.all}
                      />
                      <div className="flex flex-col gap-1 px-2 pb-2 md:px-3 md:pb-3">
                        {g.ad.link.opened > 0 && (
                          <SourceLine sub icon={<IconBadge Icon={Link2} />} label="Direktan link (na BookingModal)" detail="forma se otvorila odmah" t={g.ad.link} />
                        )}
                        {g.ad.site.opened > 0 && (
                          <SourceLine sub icon={<IconBadge Icon={MousePointerClick} />} label="Preko sajta" detail="pogledali sajt, pa kliknuli dugme" t={g.ad.site} />
                        )}
                      </div>
                    </li>
                  )}
                  {g.link.opened > 0 && (
                    <li className="rounded-2xl bg-foreground/3">
                      <SourceLine icon={<IconBadge Icon={Link2} />} label="Direktan link (bez reklame)" detail="link poslat porukom, bio, QR..." t={g.link} />
                    </li>
                  )}
                  {g.site.opened > 0 && (
                    <li className="rounded-2xl bg-foreground/3">
                      <SourceLine icon={<IconBadge Icon={Globe} />} label="Sa sajta (bez reklame)" detail={g.topButton && `najčešće: ${g.topButton}`} t={g.site} />
                    </li>
                  )}
                  {g.other.opened > 0 && (
                    <li className="rounded-2xl bg-foreground/3">
                      <SourceLine icon={<IconBadge Icon={Search} />} label="Drugi izvor" detail={g.other.names.join(", ")} t={g.other} />
                    </li>
                  )}
                  {g.before.opened > 0 && (
                    <li className="rounded-2xl bg-foreground/3 opacity-70">
                      <SourceLine icon={<IconBadge Icon={History} />} label="Pre početka merenja" detail="izvor nije zapisan" t={g.before} />
                    </li>
                  )}
                </ul>
              </section>
            );
          })()}

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

function SourceLine({ icon, label, detail, t, sub = false }: {
  icon: React.ReactNode; label: string; detail?: string | null | false; t: Tally; sub?: boolean;
}) {
  const pct = t.opened > 0 ? (t.booked / t.opened) * 100 : 0;
  return (
    <div className={`flex items-center gap-3 font-poppins ${sub ? "p-2 md:px-3 rounded-xl bg-foreground/4" : "p-3 md:px-4"}`}>
      <span className="shrink-0 flex items-center justify-center min-w-9">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-bold leading-snug ${sub ? "text-[12px] md:text-[13px]" : "text-[13px] md:text-sm"}`}>{label}</p>
        {detail && <p className="text-[11px] md:text-xs text-foreground/50 truncate">{detail}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold tabular-nums leading-none ${sub ? "text-base md:text-lg" : "text-lg md:text-xl"}`}>{t.opened.toLocaleString("sr-RS")}</p>
        <p className="text-[11px] md:text-xs text-foreground/60 tabular-nums mt-1 inline-flex items-center gap-1">
          <CalendarCheck size={12} className="text-green-400" />
          {t.booked.toLocaleString("sr-RS")} <span className="text-foreground/40">({fmtPct(pct)})</span>
        </p>
      </div>
    </div>
  );
}

function IconBadge({ Icon }: { Icon: typeof Users }) {
  return (
    <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-foreground/6 text-foreground/70">
      <Icon size={17} />
    </span>
  );
}

function InstagramLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9 rounded-xl ring-2 ring-surface" aria-label="Instagram" role="img">
      <defs>
        <radialGradient id="ig-grad" cx="0.3" cy="1.07" r="1.2">
          <stop offset="0" stopColor="#FDD56C" />
          <stop offset="0.3" stopColor="#F77737" />
          <stop offset="0.6" stopColor="#E1306C" />
          <stop offset="1" stopColor="#833AB4" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.1" cy="7.9" r="0.95" fill="#fff" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9 rounded-xl ring-2 ring-surface" aria-label="Facebook" role="img">
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path d="M15.6 24v-8.7h2.9l.45-3.4H15.6V9.75c0-.98.27-1.65 1.68-1.65h1.8V5.07a24 24 0 0 0-2.62-.13c-2.6 0-4.37 1.58-4.37 4.48v2.5H9.15v3.4h2.94V24z" fill="#fff" />
    </svg>
  );
}
