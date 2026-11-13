"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Mail, X, Zap } from "lucide-react";
import { supabase, timeToMinutes, minutesToTime, pickFreeLaser, type BusinessWindow } from "@/lib/supabase";
import { resolveWindows, startedLaserDays, toDateStr, type AvailabilityData } from "@/lib/availability";
import { laserLabel } from "@/lib/lasers";
import type { LocationId } from "@/lib/locations";

/**
 * "Pomeri termin" - confirms a move dragged on the calendar, or lets the admin
 * pick the new day and time (opened from a reservation). Saving goes through
 * /api/reservation-move, which also emails the client when asked.
 */

/** The appointment being moved, as the calendar has it. */
export interface MoveSubject {
  id: string;
  customer_name: string;
  customer_email: string;
  date: string;
  /** "HH:MM:SS", as stored. */
  start_time: string;
  end_time: string;
  total_duration: number;
  location: LocationId;
  /** It keeps this laser when that is free at the new time (sql/lasers_phase1.sql). */
  laser: number;
  services: string[];
}

/** What the database now holds, times as "HH:MM"; `laser` = the one it is on now. */
export interface MovedTo { date: string; start_time: string; end_time: string; laser?: number }
export type MoveEmail = "sent" | "failed" | "skipped";

interface Props {
  subject: MoveSubject;
  /** Where it was dropped on the calendar; null = the admin picks here. */
  proposed: { date: string; time: string } | null;
  availability: AvailabilityData;
  /** The page's clock - decides whether the new term is still ahead (email or not). */
  now: Date;
  onClose: () => void;
  onMoved: (moved: MovedTo, email: MoveEmail) => void;
  /** The answer never came (or the appointment changed meanwhile) - reload the calendar. */
  onStale: () => void;
}

/** Times offered: the same span as a new admin booking, widened to the day's working hours. */
const ADMIN_DAY = { start: 7 * 60, end: 22 * 60 };
const STEP = 10;

const DAYS_SHORT = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];
const MONTHS     = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

type DayRow = { id: string; start_time: string; end_time: string; status: string; laser: number };

/** What /api/reservation-move answers. */
type MoveReply =
  | { ok: true; moved: MovedTo; email: MoveEmail }
  | { ok: false; error?: string; clash?: { name: string; start: string; end: string } };

function parseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Uto, 11. nov" */
function fmtDay(date: string) {
  const d = parseDate(date);
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

function shiftDate(date: string, days: number) {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function fitsWindows(windows: BusinessWindow[] | null, start: number, end: number) {
  return (windows ?? []).some((w) => start >= w.start && end <= w.end);
}

const MESSAGES = {
  offline:   "Nema odgovora servera. Kalendar je osvežen - proveri da li je termin pomeren.",
  session:   "Prijava je istekla. Odjavi se i prijavi ponovo.",
  notFound:  "Ovaj termin više ne postoji - kalendar je osvežen.",
  inactive:  "Termin je otkazan, ne može da se pomeri - kalendar je osvežen.",
  failed:    "Termin nije pomeren. Pokušaj ponovo.",
  loadFail:  "Termini za ovaj dan nisu učitani.",
} as const;

export default function AdminMoveDialog({ subject, proposed, availability, now, onClose, onMoved, onStale }: Props) {
  const todayStr = toDateStr(now);
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const duration = subject.total_duration;
  const oldStart = subject.start_time.slice(0, 5);

  const [picking, setPicking] = useState(proposed === null);
  const [date, setDate]       = useState(proposed?.date ?? (subject.date > todayStr ? subject.date : todayStr));
  const [time, setTime]       = useState<string | null>(proposed?.time ?? null);
  const [notify, setNotify]   = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // The chosen day's appointments, fresh every time the day (or reloadKey) changes.
  const [reloadKey, setReloadKey] = useState(0);
  const dayKey = `${date}:${reloadKey}`;
  const [day, setDay] = useState<{ key: string; rows: DayRow[] | null } | null>(null);
  const dayLoading = picking && day?.key !== dayKey;

  useEffect(() => {
    if (!picking) return;
    let live = true;
    supabase
      .from("reservations")
      .select("id, start_time, end_time, status, laser")
      .eq("date", date)
      .eq("location", subject.location)
      .then(
        ({ data, error: err }) => { if (live) setDay({ key: dayKey, rows: err ? null : data ?? [] }); },
        () => { if (live) setDay({ key: dayKey, rows: null }); },
      );
    return () => { live = false; };
  }, [picking, date, dayKey, subject.location]);

  // Escape closes the dialog - but never in the middle of saving.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  /** The studio's hours that day (every laser's together) - the span of times shown. */
  const windows = resolveWindows(date, availability);
  /** The studio has more than one laser - say which one a new time goes on. */
  const multiLaser = availability.lasers.length > 1;

  /**
   * Every start time of the day, one row per hour, with what stands in the way
   * of each. `laser` = where it would go, as the database decides: a free laser
   * that works then, its own first; otherwise its own / any free one outside
   * hours (null = every laser taken). `offHours` = outside that laser's hours.
   */
  const slots: {
    time: string; taken: boolean; past: boolean; current: boolean; offHours: boolean; laser: number | null;
  }[] = [];
  // Past days are not offered; today starts at the current hour.
  if (picking && day?.key === dayKey && day.rows && date >= todayStr) {
    const others = day.rows.filter((r) => r.id !== subject.id);
    const lasers = startedLaserDays(date, availability);
    const from  = Math.min(ADMIN_DAY.start, ...(windows ?? []).map((w) => w.start));
    const to    = Math.min(24 * 60 - STEP, Math.max(ADMIN_DAY.end, ...(windows ?? []).map((w) => w.end)));
    const first = Math.floor((date === todayStr ? Math.max(from, nowMin) : from) / 60) * 60;
    for (let t = first; t + duration <= to; t += STEP) {
      const end = t + duration;
      const laser = pickFreeLaser(others, t, end, lasers, { prefer: subject.laser, anyHour: true });
      const lands = lasers.find((d) => d.laser === laser);
      slots.push({
        laser,
        time:     minutesToTime(t),
        taken:    laser === null,
        past:     date === todayStr && t <= nowMin,
        current:  date === subject.date && minutesToTime(t) === oldStart,
        offHours: !fitsWindows(lands ? lands.windows : windows, t, end),
      });
    }
  }

  const newStart  = time ? timeToMinutes(time) : null;
  const newEnd    = newStart !== null ? newStart + duration : null;
  const unchanged = date === subject.date && time === oldStart;
  const upcoming  = newStart !== null && (date > todayStr || (date === todayStr && newStart > nowMin));
  const chosen    = slots.find((s) => s.time === time);
  // A dragged-in time (no list) is judged by its own laser's hours.
  const offHours  = newStart !== null && newEnd !== null && (chosen
    ? chosen.offHours
    : !fitsWindows(resolveWindows(date, availability, subject.laser), newStart, newEnd));
  const email     = subject.customer_email.trim();
  const willEmail = notify && !!email && upcoming;
  /** At the chosen time the database puts it on the other laser (that one works / is free then). */
  const landsOn   = multiLaser ? chosen?.laser ?? null : null;
  const otherLaser = landsOn !== null && landsOn !== subject.laser
    ? availability.lasers.find((l) => l.laser === landsOn)
    : undefined;

  function pickDate(next: string) {
    if (!next || next === date) return;
    setDate(next);
    setTime(null);
    setError(null);
  }

  async function submit() {
    if (!time || unchanged || saving) return;
    setSaving(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError(MESSAGES.session);
      setSaving(false);
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/reservation-move", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: subject.id, date, start_time: time, notify: willEmail }),
      });
    } catch {
      setError(MESSAGES.offline);
      setSaving(false);
      onStale();
      return;
    }
    const body = (await res.json().catch(() => null)) as MoveReply | null;
    if (body && body.ok) {
      onMoved(body.moved, body.email);
      return;
    }
    const failure = body && !body.ok ? body : null;
    setSaving(false);
    switch (failure?.error) {
      case "slot_taken": {
        const clash = failure?.clash;
        setError(clash
          ? `Zauzeto: ${clash.name}, ${clash.start}–${clash.end}. Izaberi drugo vreme.`
          : "To vreme je u međuvremenu zauzeto. Izaberi drugo.");
        setTime(null);
        setPicking(true);
        setReloadKey((k) => k + 1);
        onStale();
        break;
      }
      case "unchanged":
        onClose();
        break;
      case "forbidden":
        setError(MESSAGES.session);
        break;
      case "not_found":
        setError(MESSAGES.notFound);
        onStale();
        break;
      case "inactive":
        setError(MESSAGES.inactive);
        onStale();
        break;
      default:
        // No readable answer from the server: the move may still have gone through.
        setError(failure ? MESSAGES.failed : MESSAGES.offline);
        if (!failure) onStale();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="move-title">
      <div className="absolute inset-0 bg-black/75 admin-fade-in" onClick={() => { if (!saving) onClose(); }} />
      <div className="relative z-10 bg-surface border border-foreground/10 rounded-t-4xl sm:rounded-3xl shadow-2xl shadow-black/60 w-full max-w-lg max-h-[92dvh] overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)] admin-sheet-in">
        <div className="sm:hidden w-10 h-1.5 bg-foreground/15 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-foreground/5">
          <div className="min-w-0">
            <h2 id="move-title" className="text-xl sm:text-2xl font-bold font-playfair">Pomeri termin</h2>
            <p className="text-[12px] font-semibold font-poppins text-foreground/60 truncate mt-0.5">
              {subject.customer_name}
              {subject.services.length > 0 && ` · ${subject.services.join(", ")}`}
              {` · ${duration} min`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Zatvori"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/3 text-foreground/60 hover:bg-red-400/10 hover:text-red-400 transition-all cursor-pointer shrink-0 ml-3 disabled:opacity-40"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 space-y-5 custom-scrollbar">
          {/* From → to */}
          <div className="rounded-2xl bg-foreground/2 border border-foreground/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold font-poppins uppercase tracking-widest text-foreground/50">Sada</span>
              <span className="text-sm font-semibold font-poppins text-foreground/55 line-through tabular-nums">
                {fmtDay(subject.date)} · {oldStart}–{subject.end_time.slice(0, 5)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-bold font-poppins uppercase tracking-widest text-accent">
                <ArrowRight size={12} strokeWidth={2.5} /> Novo
              </span>
              {newStart !== null && newEnd !== null ? (
                <span className="text-base font-bold font-poppins text-accent tabular-nums">
                  {fmtDay(date)} · {time}–{minutesToTime(newEnd)}
                </span>
              ) : (
                <span className="text-sm font-semibold font-poppins text-foreground/45">Izaberi vreme ispod</span>
              )}
            </div>
            {offHours && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold font-poppins text-amber-300">
                <AlertTriangle size={13} className="shrink-0" /> Van radnog vremena tog dana
              </p>
            )}
            {otherLaser && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold font-poppins text-accent">
                <Zap size={13} className="shrink-0" /> Termin prelazi na {laserLabel(otherLaser)}
              </p>
            )}
            {!picking && (
              <button
                type="button"
                onClick={() => { setPicking(true); setError(null); }}
                disabled={saving}
                className="text-[11px] font-bold font-poppins uppercase tracking-widest text-accent hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
              >
                Izaberi drugo vreme
              </button>
            )}
          </div>

          {/* Day + time picker */}
          {picking && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pickDate(shiftDate(date, -1))}
                  disabled={date <= todayStr}
                  aria-label="Prethodni dan"
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-foreground/10 text-foreground/70 hover:bg-foreground/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft size={18} />
                </button>
                <label className="relative flex-1 min-w-0 h-11 flex items-center justify-center rounded-xl border-2 border-foreground/10 bg-foreground/4 focus-within:border-accent cursor-pointer">
                  <span className="text-sm font-bold font-poppins text-foreground tabular-nums pointer-events-none">{fmtDay(date)}</span>
                  <input
                    type="date"
                    value={date}
                    min={todayStr}
                    onChange={(e) => pickDate(e.target.value)}
                    // Desktop browsers only open the calendar from its icon - open it from anywhere.
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* not supported - typing still works */ } }}
                    aria-label="Datum"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ colorScheme: "dark" }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => pickDate(shiftDate(date, 1))}
                  aria-label="Sledeći dan"
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-foreground/10 text-foreground/70 hover:bg-foreground/5 transition-colors cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {dayLoading ? (
                <p className="py-6 text-center text-xs font-bold font-poppins uppercase tracking-widest text-foreground/50" role="status">Učitavam…</p>
              ) : !day?.rows ? (
                <div className="flex flex-col items-center gap-3 py-4 text-sm font-poppins text-foreground/70">
                  {MESSAGES.loadFail}
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="h-9 px-4 rounded-xl border border-accent/30 text-accent text-[11px] font-bold font-poppins uppercase tracking-widest hover:bg-accent/10 transition-colors cursor-pointer"
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : slots.length === 0 ? (
                <p className="py-6 text-center text-sm font-poppins text-foreground/60">Nema više termina tog dana - izaberi drugi datum.</p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {slots.map((s) => {
                    const disabled = s.taken || s.past || s.current;
                    const chosen   = time === s.time && !disabled;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={disabled || saving}
                        onClick={() => { setTime(s.time); setError(null); }}
                        title={s.current ? "Trenutno vreme" : s.taken ? "Zauzeto" : s.offHours ? "Van radnog vremena" : undefined}
                        aria-pressed={chosen}
                        className={`h-10 rounded-lg border text-[13px] font-bold font-poppins tabular-nums transition-colors ${
                          chosen
                            ? "bg-accent border-accent text-on-accent cursor-pointer"
                            : s.current
                            ? "border-accent/40 text-accent/70 cursor-default"
                            : s.taken || s.past
                            ? "border-transparent text-foreground/25 line-through cursor-not-allowed"
                            : s.offHours
                            ? "border-dashed border-foreground/12 text-foreground/50 hover:border-accent/40 hover:text-accent cursor-pointer"
                            : "bg-foreground/5 border-foreground/8 text-foreground/85 hover:bg-accent/10 hover:border-accent/30 hover:text-accent cursor-pointer"
                        }`}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Email to the client */}
          {email ? (
            upcoming || newStart === null ? (
              <button
                type="button"
                role="switch"
                aria-checked={notify}
                onClick={() => setNotify((v) => !v)}
                disabled={saving}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-foreground/8 bg-foreground/2 text-left cursor-pointer hover:border-accent/30 transition-colors disabled:opacity-60"
              >
                <Mail size={18} className={notify ? "text-accent shrink-0" : "text-foreground/40 shrink-0"} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold font-poppins text-foreground/85">Pošalji klijentu mejl o promeni</span>
                  <span className="block text-[12px] font-medium font-poppins text-foreground/55 truncate">{email}</span>
                </span>
                <span className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${notify ? "bg-accent" : "bg-foreground/15"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${notify ? "translate-x-5" : ""}`} />
                </span>
              </button>
            ) : (
              <p className="flex items-center gap-2 p-4 rounded-2xl bg-foreground/2 border border-foreground/5 text-[13px] font-poppins text-foreground/60">
                <Mail size={16} className="shrink-0 text-foreground/40" /> Novo vreme je prošlo - klijent ne dobija mejl.
              </p>
            )
          ) : (
            <p className="flex items-center gap-2 p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-[13px] font-poppins text-amber-300">
              <Mail size={16} className="shrink-0" /> Klijent nema email - javi mu novo vreme telefonom.
            </p>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 p-3.5 rounded-2xl bg-red-400/10 border border-red-400/30 text-[13px] font-semibold font-poppins text-red-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-foreground/8 bg-surface px-5 sm:px-7 pt-3 pb-4 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-13 px-5 rounded-2xl bg-foreground/4 border border-foreground/10 text-foreground/76 text-[11px] font-bold tracking-widest font-poppins uppercase hover:bg-foreground/8 transition-colors cursor-pointer disabled:opacity-50"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!time || unchanged || saving}
            autoFocus={!picking}
            className="flex-1 h-13 rounded-2xl bg-accent text-on-accent text-xs font-bold tracking-[0.2em] font-poppins uppercase shadow-xl shadow-accent/20 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
          >
            {saving ? "Pomeram…" : willEmail ? "Pomeri i pošalji mejl" : "Pomeri termin"}
          </button>
        </div>
      </div>
    </div>
  );
}
