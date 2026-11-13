"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AtSign, BellRing, CalendarCheck2, CalendarX2, Check, Clock4, Copy, ExternalLink, Gauge,
  MessageCircle, NotebookPen, Phone, PhoneMissed, Sparkles, UserRoundCheck, Users,
} from "lucide-react";
import { getLocation, type LocationId } from "@/lib/locations";
import { laserLabel } from "@/lib/lasers";
import { telHref } from "@/lib/upiti";
import { followUpText } from "@/lib/infy/client";
import { addDays, daysBetween, relativeDay, shortDay, SR_WEEKDAYS_SHORT, mondayIndex } from "@/lib/infy/time";
import type { Brief, FactCall, FactUpit, InfyLocation } from "@/lib/infy/types";

export type CallAction = "answered" | "no_answer";
export type UpitAction = "done" | "later" | "booked";

const SHORT: Record<InfyLocation, string> = { novi_sad: "NS", sombor: "SO" };
const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", viber: "Viber", telefon: "Telefon", drugo: "Drugo",
};

function studioName(loc: InfyLocation) {
  return getLocation(loc as LocationId).name;
}

function Section({ icon, title, count, children }: { icon: ReactNode; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="infy-rise rounded-2xl bg-foreground/[0.035] border border-foreground/8 p-3.5">
      <h3 className="flex items-center gap-2 text-[11px] font-bold font-poppins uppercase tracking-widest text-foreground/60 mb-2.5">
        <span className="text-accent">{icon}</span>
        {title}
        {count != null && count > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-accent/15 text-accent text-[11px] tabular-nums inline-flex items-center justify-center">{count}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Chip({ onClick, href, children, tone = "plain", disabled, external }: {
  onClick?: () => void; href?: string; children: ReactNode; tone?: "plain" | "accent" | "good";
  disabled?: boolean; external?: boolean;
}) {
  const cls = `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold font-poppins transition-colors cursor-pointer disabled:opacity-50 ${
    tone === "accent" ? "bg-accent text-on-accent hover:opacity-90"
    : tone === "good" ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
    : "bg-foreground/6 text-foreground/80 hover:bg-foreground/10"
  }`;
  if (href) {
    return external
      ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
      : <a href={href} className={cls}>{children}</a>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

/** Infy's sentences, written out letter by letter the first time they appear. */
export function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(text.length); onDone?.(); return; }
    setShown(0);
    const total = Math.min(1600, text.length * 16);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / total, 1);
      setShown(Math.round(text.length * p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <span>
      {text.slice(0, shown)}
      {shown < text.length && <span className="infy-caret" aria-hidden />}
    </span>
  );
}

function CallRow({ c, today, busy, onCall }: { c: FactCall; today: string; busy: boolean; onCall: (a: CallAction) => void }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0 border-b last:border-b-0 border-foreground/8">
      <div className="flex items-start gap-2.5">
        <Phone size={15} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold font-poppins leading-snug">{c.name}</p>
          <p className="text-xs text-foreground/60 font-poppins mt-0.5">
            Prvi dolazak {relativeDay(c.date, today)} u {c.start} · {SHORT[c.location]} · potvrdi termin
            {c.call_status === "no_answer" && <span className="text-amber-300"> · nije se javio/la</span>}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {c.phone && <Chip href={telHref(c.phone)} tone="accent"><Phone size={13} /> Pozovi</Chip>}
            <Chip tone="good" disabled={busy} onClick={() => onCall("answered")}><Check size={13} /> Potvrđeno</Chip>
            <Chip disabled={busy} onClick={() => onCall("no_answer")}><PhoneMissed size={13} /> Ne javlja se</Chip>
          </div>
        </div>
      </div>
    </li>
  );
}

function UpitRow({ u, today, busy, onAction }: { u: FactUpit; today: string; busy: boolean; onAction: (a: UpitAction) => void }) {
  const [copied, setCopied] = useState(false);
  const writes = u.source === "instagram" || u.source === "facebook" || u.source === "tiktok" || !u.phone;
  const waited = daysBetween(u.created_at.slice(0, 10), today);
  async function copy() {
    try {
      await navigator.clipboard.writeText(followUpText(u.name));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked - the text is on screen to copy by hand */ }
  }
  return (
    <li className="py-2.5 first:pt-0 last:pb-0 border-b last:border-b-0 border-foreground/8">
      <div className="flex items-start gap-2.5">
        {writes ? <MessageCircle size={15} className="mt-0.5 shrink-0 text-accent" /> : <Phone size={15} className="mt-0.5 shrink-0 text-accent" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold font-poppins leading-snug">
            {writes ? "Pošalji poruku" : "Pozovi"} {u.name}
            <span className="font-normal text-foreground/60"> · {SOURCE_LABEL[u.source] ?? u.source}</span>
          </p>
          <p className="text-xs text-foreground/60 font-poppins mt-0.5">
            {u.note ? `${u.note} · ` : ""}upisano {waited <= 0 ? "danas" : waited === 1 ? "juče" : `pre ${waited} dana`}
            {u.attempts > 0 && ` · ne javlja se ${u.attempts}×`}
          </p>
          {writes && (
            <p className="mt-2 text-[13px] leading-snug font-poppins text-foreground/85 bg-foreground/5 rounded-xl px-3 py-2 border border-foreground/8">
              „{followUpText(u.name)}”
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {writes && <Chip tone="accent" onClick={() => void copy()}><Copy size={13} /> {copied ? "Kopirano" : "Kopiraj poruku"}</Chip>}
            {u.source === "instagram" && <Chip href="https://www.instagram.com/direct/inbox/" external><AtSign size={13} /> Instagram</Chip>}
            {u.source === "facebook" && <Chip href="https://business.facebook.com/latest/inbox" external><ExternalLink size={13} /> Inbox</Chip>}
            {u.phone && <Chip href={telHref(u.phone)} tone={writes ? "plain" : "accent"}><Phone size={13} /> {u.phone}</Chip>}
            <Chip tone="good" disabled={busy} onClick={() => onAction("done")}><Check size={13} /> Urađeno</Chip>
            <Chip disabled={busy} onClick={() => onAction("later")}><Clock4 size={13} /> Za 2 dana</Chip>
            <Chip disabled={busy} onClick={() => onAction("booked")}><CalendarCheck2 size={13} /> Zakazan</Chip>
          </div>
        </div>
      </div>
    </li>
  );
}

function CapacityBars({ brief }: { brief: Brief }) {
  return (
    <div className="space-y-3">
      {brief.studios.map((s) => {
        const pctAll = s.open > 0 ? Math.round((s.booked / s.open) * 100) : null;
        return (
          <div key={s.location}>
            <div className="flex items-baseline justify-between text-xs font-poppins mb-1.5">
              <span className="font-semibold">{studioName(s.location)}</span>
              <span className="tabular-nums text-foreground/70">{pctAll != null ? `${pctAll}% popunjeno` : "nema radnog vremena"}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 items-end h-14" role="img" aria-label={`${studioName(s.location)}: popunjenost po danima`}>
              {s.days.map((d, i) => {
                const p = d.open > 0 ? d.booked / d.open : 0;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1 h-full justify-end" title={`${shortDay(d.date)}: ${d.closed ? "zatvoreno" : `${Math.round(p * 100)}%, ${d.count} termina`}`}>
                    <div className="w-full rounded-md bg-foreground/8 relative overflow-hidden" style={{ height: "2.5rem" }}>
                      {!d.closed && (
                        <div
                          className={`infy-bar absolute inset-x-0 bottom-0 rounded-md ${p >= 0.85 ? "bg-emerald-400/80" : p >= 0.5 ? "bg-accent" : "bg-amber-400/80"}`}
                          style={{ height: `${Math.max(p * 100, 6)}%`, animationDelay: `${i * 50}ms` }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-poppins text-foreground/55">{SR_WEEKDAYS_SHORT[mondayIndex(d.date)].slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BriefView({
  brief, tab, busy, onCall, onUpit, onAsk,
}: {
  brief: Brief;
  tab: "dan" | "nedelja";
  busy: Set<string>;
  onCall: (id: string, action: CallAction) => void;
  onUpit: (id: string, action: UpitAction) => void;
  /** Hands a question to the conversation below. */
  onAsk: (text: string) => void;
}) {
  const f = brief.facts;
  const [allReturn, setAllReturn] = useState(false);
  const today = brief.today;

  if (tab === "nedelja") {
    const weekFrom = addDays(today, -7);
    return (
      <div className="space-y-3">
        <Section icon={<Gauge size={14} />} title={`Prošla nedelja · ${shortDay(weekFrom)} – ${shortDay(addDays(today, -1))}`}>
          <div className="grid grid-cols-2 gap-2">
            {f.week.map((w) => (
              <div key={w.location} className="rounded-xl bg-foreground/5 p-3">
                <p className="text-xs font-bold font-poppins mb-2">{studioName(w.location)}</p>
                <dl className="space-y-1 text-xs font-poppins">
                  {([
                    ["Obavljeno", w.visits],
                    ["Otkazano", w.cancelled],
                    ["Novih rezervacija", w.created],
                    ["Sa sajta", w.online],
                    ["Narednih 7 dana", w.next_week],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-foreground/60">{k}</dt>
                      <dd className="font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/60 font-poppins mt-2.5">
            Novih kartona: <b className="text-foreground">{f.week_new_clients}</b> · upisanih upita: <b className="text-foreground">{f.week_upiti_added}</b>
          </p>
        </Section>
        <Section icon={<Gauge size={14} />} title="Kapacitet narednih 7 dana">
          <CapacityBars brief={brief} />
        </Section>
        <Section icon={<UserRoundCheck size={14} />} title="Za vraćanje" count={f.return_total}>
          <p className="text-xs text-foreground/70 font-poppins">
            {f.return_total} klijenata nije dolazilo {f.return_weeks}+ nedelja i nema zakazano.
          </p>
          <div className="mt-2"><Chip tone="accent" onClick={() => onAsk("Koje klijente treba da vratimo ove nedelje? Predloži kome prvo da se javimo.")}><Sparkles size={13} /> Pitaj Infy</Chip></div>
        </Section>
      </div>
    );
  }

  const toCall = f.calls.length + f.upiti_due.length;
  const gaps = brief.studios.flatMap((s) =>
    s.days.flatMap((d) => d.gaps.map((g) => ({ ...g, date: d.date, location: s.location }))),
  ).slice(0, 6);
  const noStaff = brief.studios.flatMap((s) => s.days.filter((d) => d.noStaff).map((d) => ({ date: d.date, location: s.location })));
  const returns = allReturn ? f.return_due : f.return_due.slice(0, 4);
  const adminBooked = f.booked_total - f.booked_online;

  return (
    <div className="space-y-3">
      <Section icon={<BellRing size={14} />} title="Javi se danas" count={toCall}>
        {toCall === 0 ? (
          <p className="text-sm text-foreground/70 font-poppins">
            Niko ne čeka. {f.upiti_open > 0 && f.upiti_next_due ? `Sledeći podsetnik: ${relativeDay(f.upiti_next_due, today)}.` : ""}
          </p>
        ) : (
          <ul>
            {f.calls.map((c) => (
              <CallRow key={c.id} c={c} today={today} busy={busy.has(c.id)} onCall={(a) => onCall(c.id, a)} />
            ))}
            {f.upiti_due.map((u) => (
              <UpitRow key={u.id} u={u} today={today} busy={busy.has(u.id)} onAction={(a) => onUpit(u.id, a)} />
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<CalendarCheck2 size={14} />} title="Zakazali su se od juče" count={f.booked_total}>
        {f.booked_total === 0 ? (
          <p className="text-sm text-foreground/70 font-poppins">Od juče nema novih rezervacija.</p>
        ) : (
          <>
            <p className="text-sm font-poppins">
              <b>{f.booked_online}</b> sa sajta · <b>{adminBooked}</b> iz admina
            </p>
            <ul className="mt-2 space-y-1">
              {f.booked.slice(0, 5).map((b) => (
                <li key={b.id} className="text-xs font-poppins text-foreground/75 flex justify-between gap-2">
                  <span className={`truncate ${b.status === "cancelled" ? "line-through text-foreground/45" : ""}`}>{b.name}</span>
                  <span className="shrink-0 tabular-nums text-foreground/55">
                    {relativeDay(b.date, today)} {b.start} · {SHORT[b.location]}{b.online ? " · sajt" : ""}
                  </span>
                </li>
              ))}
            </ul>
            {f.booked.length > 5 && <p className="text-[11px] text-foreground/50 font-poppins mt-1">i još {f.booked_total - 5}</p>}
          </>
        )}
        {f.upiti_booked.map((u) => (
          <p key={u.id} className="mt-2 text-xs font-poppins text-emerald-300 flex items-center gap-1.5">
            <Check size={13} /> {u.name} iz upita se zakazao/la{u.booked_date ? ` za ${relativeDay(u.booked_date, today)} ${u.booked_time ?? ""}` : ""}
          </p>
        ))}
        {f.client_cancels.map((c) => (
          <p key={c.id} className="mt-2 text-xs font-poppins text-red-300 flex items-center gap-1.5">
            <CalendarX2 size={13} /> {c.name} je otkazao/la {relativeDay(c.date, today)} {c.start} ({SHORT[c.location]})
          </p>
        ))}
      </Section>

      {(gaps.length > 0 || noStaff.length > 0) && (
        <Section icon={<Clock4 size={14} />} title="Rupe u kalendaru">
          <ul className="space-y-1.5">
            {gaps.map((g) => (
              <li key={`${g.location}${g.date}${g.start}${g.laser ?? ""}`} className="flex items-center justify-between gap-2 text-xs font-poppins">
                <span>
                  <b>{relativeDay(g.date, today)}</b> {g.start}–{g.end}
                  <span className="text-foreground/55"> · {g.minutes} min · {SHORT[g.location]}{g.laser ? ` · ${g.laser}` : ""}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onAsk(`Kako da popunimo rupu ${relativeDay(g.date, today)} ${g.start}–${g.end} u ${studioName(g.location)}${g.laser ? ` (${laserLabel({ name: g.laser })})` : ""}? Pogledaj upite i klijente za vraćanje.`)}
                  className="shrink-0 text-accent font-semibold hover:underline cursor-pointer"
                >
                  Popuni
                </button>
              </li>
            ))}
            {noStaff.map((n) => (
              <li key={`staff${n.location}${n.date}`} className="text-xs font-poppins text-amber-300 flex items-center gap-1.5">
                <Users size={13} /> {relativeDay(n.date, today)} · {studioName(n.location)}: radno vreme, a niko nije na rasporedu
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={<Gauge size={14} />} title="Kapacitet 7 dana">
        <CapacityBars brief={brief} />
      </Section>

      {f.return_total > 0 && (
        <Section icon={<UserRoundCheck size={14} />} title="Vreme je za sledeći tretman" count={f.return_total}>
          <p className="text-xs text-foreground/60 font-poppins mb-2">Poslednji tretman pre {f.return_weeks}+ nedelja, ništa zakazano.</p>
          <ul>
            {returns.map((r) => (
              <li key={r.karton_id} className="flex items-center gap-2 py-1.5 border-b last:border-b-0 border-foreground/8">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold font-poppins truncate">{r.name}</p>
                  <p className="text-[11px] text-foreground/55 font-poppins">
                    poslednji put {shortDay(r.last_date)} · {r.visits} {r.visits === 1 ? "dolazak" : r.visits < 5 ? "dolaska" : "dolazaka"} · {SHORT[r.location]}
                  </p>
                </div>
                <Link href={`/kartoni/${r.karton_id}`} className="shrink-0 w-8 h-8 rounded-lg bg-foreground/6 hover:bg-foreground/10 flex items-center justify-center" aria-label={`Karton: ${r.name}`}>
                  <NotebookPen size={14} />
                </Link>
                {r.phone && (
                  <a href={telHref(r.phone)} className="shrink-0 w-8 h-8 rounded-lg bg-accent text-on-accent flex items-center justify-center" aria-label={`Pozovi ${r.name}`}>
                    <Phone size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {f.return_due.length > 4 && (
            <button type="button" onClick={() => setAllReturn((v) => !v)} className="mt-2 text-xs font-semibold font-poppins text-accent hover:underline cursor-pointer">
              {allReturn ? "Manje" : `Prikaži ${f.return_due.length - 4} više`}
            </button>
          )}
        </Section>
      )}
    </div>
  );
}
