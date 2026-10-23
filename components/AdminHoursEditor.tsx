"use client";

import { Fragment, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Plus, X } from "lucide-react";
import type { BusinessWindow } from "@/lib/supabase";

/** The slider runs 08:00–22:00 (wider if a saved day reaches past that). */
const DAY_FROM = 8 * 60;
const DAY_TO   = 22 * 60;
/** One step of the slider - working hours move by half an hour. */
const STEP = 30;
/** Hour labels under the slider. */
const TICK_EVERY = 120;

export function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 360 → "6 h", 330 → "5 h 30 min". */
function fmtLength(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} min`;
  return mm === 0 ? `${h} h` : `${h} h ${mm} min`;
}

/** Sorted, with overlapping or touching windows joined into one. */
function normalize(windows: BusinessWindow[]): BusinessWindow[] {
  const out: BusinessWindow[] = [];
  for (const w of [...windows].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

/**
 * One day's working hours: a switch for open / closed and a slider per open
 * stretch - nothing to type. While a handle is dragged the day lives here; it
 * is handed up (and, in the weekly template, saved) when the finger lets go.
 */
export default function HoursEditor({
  title,
  windows,
  fallback,
  onChange,
}: {
  title: string;
  windows: BusinessWindow[];
  /** What the day opens with when it is switched on. */
  fallback: BusinessWindow[];
  onChange: (next: BusinessWindow[]) => void;
}) {
  const [draft, setDraft] = useState<BusinessWindow[] | null>(null);
  const shown = draft ?? windows;
  const open = shown.length > 0;

  // Every slider of the day shares one scale, so stacked stretches line up.
  const lo = Math.min(DAY_FROM, ...windows.map((w) => Math.floor(w.start / 60) * 60));
  const hi = Math.max(DAY_TO, ...windows.map((w) => Math.ceil(w.end / 60) * 60));

  function move(i: number, w: BusinessWindow) {
    setDraft((prev) => (prev ?? windows).map((x, j) => (j === i ? w : x)));
  }

  function commit(i: number, w: BusinessWindow) {
    setDraft(null);
    const cur = windows[i];
    if (cur && cur.start === w.start && cur.end === w.end) return;
    onChange(normalize(windows.map((x, j) => (j === i ? w : x))));
  }

  // A break: the longest stretch gets an hour off in its middle.
  const longest = windows.reduce((best, w, i) =>
    w.end - w.start > windows[best].end - windows[best].start ? i : best, 0);
  const canPause = open && windows[longest].end - windows[longest].start >= 3 * 60;

  function addPause() {
    const w = windows[longest];
    const mid = Math.round((w.start + w.end) / 2 / STEP) * STEP;
    onChange([
      ...windows.slice(0, longest),
      { start: w.start, end: mid - STEP },
      { start: mid + STEP, end: w.end },
      ...windows.slice(longest + 1),
    ]);
  }

  function removePause(i: number) {
    onChange(normalize([
      ...windows.slice(0, i - 1),
      { start: windows[i - 1].start, end: windows[i].end },
      ...windows.slice(i + 1),
    ]));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold font-poppins text-foreground/82">{title}</p>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={`${title} - radi`}
          onClick={() => onChange(open ? [] : fallback)}
          className="flex items-center gap-2.5 -my-1 py-1 cursor-pointer"
        >
          <span className={`text-[11px] font-bold font-poppins uppercase tracking-widest ${open ? "text-accent" : "text-foreground/50"}`}>
            {open ? "Radi" : "Zatvoreno"}
          </span>
          <span className={`relative w-11 h-6.5 rounded-full transition-colors ${open ? "bg-accent" : "bg-foreground/15"}`}>
            <span className={`absolute top-0.75 left-0.75 w-5 h-5 rounded-full shadow-sm transition-transform ${
              open ? "translate-x-4.5 bg-on-accent" : "bg-foreground/70"
            }`} />
          </span>
        </button>
      </div>

      {open && shown.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className="flex items-center gap-2 pl-0.5">
              <span className="text-[11px] font-bold font-poppins text-foreground/55 tabular-nums">
                Pauza {fmtMin(shown[i - 1].end)}–{fmtMin(w.start)}
              </span>
              <button
                type="button"
                onClick={() => removePause(i)}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-bold font-poppins uppercase tracking-wider text-foreground/55 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
              >
                <X size={12} /> Ukloni
              </button>
            </div>
          )}
          <div>
            <p className="flex items-baseline gap-2 pl-0.5">
              <span className="text-xl font-bold font-poppins text-foreground tabular-nums leading-none">
                {fmtMin(w.start)} – {fmtMin(w.end)}
              </span>
              <span className="text-xs font-medium font-poppins text-foreground/55">{fmtLength(w.end - w.start)}</span>
            </p>
            <HoursSlider
              value={w}
              lo={lo}
              hi={hi}
              minStart={i > 0 ? windows[i - 1].end + STEP : lo}
              maxEnd={i < windows.length - 1 ? windows[i + 1].start - STEP : hi}
              onMove={(next) => move(i, next)}
              onCommit={(next) => commit(i, next)}
            />
          </div>
        </Fragment>
      ))}

      {canPause && (
        <button
          type="button"
          onClick={addPause}
          className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg text-[10px] font-bold font-poppins uppercase tracking-wider text-foreground/55 hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
        >
          <Plus size={12} /> Pauza u toku dana
        </button>
      )}
    </div>
  );
}

type Thumb = "start" | "end";

/**
 * Two handles on one track. A handle is dragged; a tap on the bare track moves
 * the nearer handle there. A swipe that starts on the track scrolls the page
 * and changes nothing, so the list of days stays easy to scroll on a phone.
 */
function HoursSlider({
  value,
  lo,
  hi,
  minStart,
  maxEnd,
  onMove,
  onCommit,
}: {
  value: BusinessWindow;
  lo: number;
  hi: number;
  minStart: number;
  maxEnd: number;
  onMove: (next: BusinessWindow) => void;
  onCommit: (next: BusinessWindow) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; thumb: Thumb | null; x: number; last: BusinessWindow } | null>(null);

  const pct = (m: number) => ((m - lo) / (hi - lo)) * 100;

  function minuteAt(clientX: number, snap = true) {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const m = lo + f * (hi - lo);
    return snap ? lo + Math.round((m - lo) / STEP) * STEP : m;
  }

  function nearest(clientX: number): Thumb {
    const m = minuteAt(clientX, false);
    if (m <= value.start) return "start";
    if (m >= value.end) return "end";
    return m - value.start < value.end - m ? "start" : "end";
  }

  /** One end of the window at minute m - inside its limits, at least one step long. */
  function place(w: BusinessWindow, thumb: Thumb, m: number): BusinessWindow {
    return thumb === "start"
      ? { start: Math.max(minStart, Math.min(m, w.end - STEP)), end: w.end }
      : { start: w.start, end: Math.min(maxEnd, Math.max(m, w.start + STEP)) };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A mouse never scrolls the page, so it may grab from anywhere on the track.
    const grab = e.pointerType === "mouse" || (e.target as HTMLElement).dataset.thumb !== undefined;
    drag.current = { id: e.pointerId, thumb: grab ? nearest(e.clientX) : null, x: e.clientX, last: value };
    if (grab) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const next = place(value, drag.current.thumb!, minuteAt(e.clientX));
      if (e.pointerType === "mouse") {
        drag.current.last = next;
        onMove(next);
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !d.thumb) return;
    const next = place(d.last, d.thumb, minuteAt(e.clientX));
    if (next.start === d.last.start && next.end === d.last.end) return;
    d.last = next;
    onMove(next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.thumb) {
      onCommit(d.last);
    } else if (Math.abs(e.clientX - d.x) < 8) {
      onCommit(place(value, nearest(e.clientX), minuteAt(e.clientX)));
    }
  }

  function onPointerCancel(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.thumb) onCommit(d.last);
  }

  function onKey(thumb: Thumb, e: KeyboardEvent<HTMLDivElement>) {
    const at = thumb === "start" ? value.start : value.end;
    const by: Record<string, number> = {
      ArrowLeft: -STEP, ArrowDown: -STEP, ArrowRight: STEP, ArrowUp: STEP,
      PageDown: -60, PageUp: 60, Home: lo - at, End: hi - at,
    };
    if (!(e.key in by)) return;
    e.preventDefault();
    onCommit(place(value, thumb, at + by[e.key]));
  }

  const ticks: number[] = [];
  for (let t = Math.ceil(lo / TICK_EVERY) * TICK_EVERY; t <= hi; t += TICK_EVERY) ticks.push(t);

  return (
    <div className="px-3">
      <div
        className="relative h-11 touch-pan-y select-none cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div ref={trackRef} className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-foreground/10">
          {/* Hour marks */}
          {Array.from({ length: (hi - lo) / 60 - 1 }, (_, k) => (
            <span
              key={k}
              className="absolute top-0 bottom-0 w-px bg-foreground/15"
              style={{ left: `${pct(lo + (k + 1) * 60)}%` }}
            />
          ))}
          <div
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{ left: `${pct(value.start)}%`, width: `${pct(value.end) - pct(value.start)}%` }}
          />
        </div>
        {(["start", "end"] as const).map((thumb) => {
          const at = thumb === "start" ? value.start : value.end;
          return (
            <div
              key={thumb}
              data-thumb=""
              role="slider"
              tabIndex={0}
              aria-label={thumb === "start" ? "Početak radnog vremena" : "Kraj radnog vremena"}
              aria-valuemin={thumb === "start" ? minStart : value.start + STEP}
              aria-valuemax={thumb === "start" ? value.end - STEP : maxEnd}
              aria-valuenow={at}
              aria-valuetext={fmtMin(at)}
              onKeyDown={(e) => onKey(thumb, e)}
              className="group absolute top-1/2 w-11 h-11 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center touch-none focus:outline-none"
              style={{ left: `${pct(at)}%` }}
            >
              <span className="pointer-events-none w-6 h-6 rounded-full bg-foreground border-[3px] border-accent shadow-md shadow-black/40 group-focus-visible:ring-4 group-focus-visible:ring-accent/30" />
            </div>
          );
        })}
      </div>
      <div className="relative h-4" aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 text-[10px] font-medium font-poppins text-foreground/50 tabular-nums"
            style={{ left: `${pct(t)}%` }}
          >
            {String(t / 60).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
