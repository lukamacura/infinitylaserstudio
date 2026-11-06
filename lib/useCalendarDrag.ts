"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Dragging appointment cards on the admin calendar to another time or day.
 *
 * Mouse / pen: press and move a few pixels. Touch: hold the card for a moment
 * (a quick swipe still scrolls the calendar or flips the day), then drag.
 * The card snaps to the slot grid; near the top or bottom edge the calendar
 * scrolls by itself. Nothing is saved here - a drop on a free spot hands the
 * new time to `onDrop`, which asks the admin to confirm.
 *
 * The calendar hands its elements over through the returned refs: the
 * scrolling area, its sticky day header, and every day column (with its date).
 */

/** Where the dragged card would land right now. */
export interface CalendarDrop {
  id: string;
  date: string;
  /** Start, in minutes since midnight, on the snap grid. */
  start: number;
  /** False when it would overlap another appointment. */
  free: boolean;
}

export interface DragItem {
  id: string;
  date: string;
  /** Minutes since midnight. */
  start: number;
  duration: number;
}

interface Options {
  pxPerMin: number;
  snapMin: number;
  /** The earliest start and latest end a card may be dropped at, minutes since midnight. */
  minStart: number;
  maxEnd: number;
  isFree: (id: string, date: string, start: number, end: number) => boolean;
  onDrop: (item: DragItem, date: string, start: number) => void;
  /** Dropped on another appointment - nothing moved. */
  onBlocked: () => void;
}

const LONG_PRESS_MS   = 350;
const MOUSE_SLOP_PX   = 5;
const TOUCH_SLOP_PX   = 8;
const EDGE_PX         = 56;
const MAX_SCROLL_STEP = 18;
/** The click / touchend that follows a drop must not open the card or flip the day. */
const AFTER_DROP_MS   = 400;

interface Gesture {
  active: boolean;
  /** Stops the gesture without dropping (unmount, cancelled pointer). */
  cancel: () => void;
}

export function useCalendarDrag(options: Options) {
  const opts = useRef(options);
  useEffect(() => { opts.current = options; });

  const [drop, setDrop] = useState<CalendarDrop | null>(null);
  const gesture  = useRef<Gesture | null>(null);
  const scroller = useRef<HTMLElement | null>(null);
  const header   = useRef<HTMLElement | null>(null);
  const columns  = useRef(new Map<string, { date: string; mobile: boolean; el: HTMLElement }>());
  const endedAt  = useRef(-Infinity);

  // A gesture still running when the calendar goes away must not leave listeners behind.
  const cancelGesture = useCallback(() => gesture.current?.cancel(), []);
  useEffect(() => cancelGesture, [cancelGesture]);

  /**
   * Ref for the scrolling calendar. Holds the one non-passive `touchmove`
   * listener that keeps the page from scrolling under a dragged card - it has
   * to exist before the touch starts, or iOS ignores it.
   */
  const scrollerRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    scroller.current = el;
    const block = (e: TouchEvent) => { if (gesture.current?.active && e.cancelable) e.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => {
      el.removeEventListener("touchmove", block);
      if (scroller.current === el) scroller.current = null;
    };
  }, []);

  /** Ref for the sticky day header - the top auto-scroll zone starts below it. */
  const headerRef = useCallback((el: HTMLElement | null) => { header.current = el; }, []);

  /** Ref for one day column; `mobile` = the phone's one-day column. */
  const bindColumn = useCallback((date: string, mobile: boolean) => (el: HTMLElement | null) => {
    if (!el) return;
    const key = `${mobile ? "m" : "d"}:${date}`;
    columns.current.set(key, { date, mobile, el });
    return () => { if (columns.current.get(key)?.el === el) columns.current.delete(key); };
  }, []);

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, item: DragItem, mobile: boolean) => {
    if (gesture.current || !e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const touch  = e.pointerType === "touch";
    const id     = e.pointerId;
    const x0     = e.clientX;
    const y0     = e.clientY;
    // Where on the card it was grabbed, so the card does not jump under the pointer.
    const grabPx = e.clientY - e.currentTarget.getBoundingClientRect().top;
    let x = x0;
    let y = y0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    let landing: CalendarDrop | null = null;
    const g: Gesture = { active: false, cancel: () => finish(false) };
    gesture.current = g;

    /** Work out the slot under the pointer; re-render only when it changes. */
    const locate = () => {
      const o = opts.current;
      // The columns of the layout the card is in, left to right; the pointer is over the last one it passed.
      const cols = [...columns.current.values()]
        .filter((c) => c.mobile === mobile)
        .map((c) => ({ date: c.date, rect: c.el.getBoundingClientRect() }))
        .sort((a, b) => a.rect.left - b.rect.left);
      if (cols.length === 0) return;
      let col = cols[0];
      for (const c of cols) if (x >= c.rect.left) col = c;
      const rect = col.rect;
      const lo  = Math.ceil(o.minStart / o.snapMin) * o.snapMin;
      const hi  = Math.floor((o.maxEnd - item.duration) / o.snapMin) * o.snapMin;
      const raw = o.minStart + (y - grabPx - rect.top) / o.pxPerMin;
      const at  = Math.max(lo, Math.min(hi, Math.round(raw / o.snapMin) * o.snapMin));
      if (landing && landing.date === col.date && landing.start === at) return;
      landing = { id: item.id, date: col.date, start: at, free: o.isFree(item.id, col.date, at, at + item.duration) };
      setDrop(landing);
    };

    /** Near the top or bottom edge the calendar scrolls, faster the closer the pointer. */
    const autoScroll = () => {
      const el = scroller.current;
      if (el) {
        const box    = el.getBoundingClientRect();
        const top    = Math.max(box.top, header.current?.getBoundingClientRect().bottom ?? box.top);
        const bottom = box.bottom;
        let step = 0;
        if (y < top + EDGE_PX)         step = -((top + EDGE_PX - y) / EDGE_PX) * MAX_SCROLL_STEP;
        else if (y > bottom - EDGE_PX) step = ((y - (bottom - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_STEP;
        step = Math.max(-MAX_SCROLL_STEP, Math.min(MAX_SCROLL_STEP, Math.round(step)));
        if (step !== 0) {
          const before = el.scrollTop;
          el.scrollTop += step;
          if (el.scrollTop !== before) locate();
        }
      }
      raf = requestAnimationFrame(autoScroll);
    };

    const activate = () => {
      timer = null;
      g.active = true;
      document.body.style.userSelect = "none";
      if (!touch) document.body.style.cursor = "grabbing";
      if (touch) navigator.vibrate?.(10);
      locate();
      raf = requestAnimationFrame(autoScroll);
    };

    function finish(commit: boolean) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      if (timer !== null) clearTimeout(timer);
      if (raf !== null) cancelAnimationFrame(raf);
      if (gesture.current === g) gesture.current = null;
      if (!g.active) return;

      g.active = false;
      endedAt.current = performance.now();
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setDrop(null);
      if (!commit || !landing) return;
      if (landing.date === item.date && landing.start === item.start) return;
      if (landing.free) opts.current.onDrop(item, landing.date, landing.start);
      else opts.current.onBlocked();
    }

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== id) return;
      x = ev.clientX;
      y = ev.clientY;
      if (g.active) { locate(); return; }
      const moved = Math.hypot(x - x0, y - y0);
      // Touch: moving before the hold is up means scrolling or swiping, not dragging.
      if (touch) { if (moved > TOUCH_SLOP_PX) finish(false); }
      else if (moved > MOUSE_SLOP_PX) activate();
    }
    function onUp(ev: PointerEvent) { if (ev.pointerId === id) finish(true); }
    function onCancel(ev: PointerEvent) { if (ev.pointerId === id) finish(false); }
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || !g.active) return;
      // Escape puts the card back - it must not also close a dialog underneath.
      ev.preventDefault();
      ev.stopPropagation();
      finish(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    if (touch) timer = setTimeout(activate, LONG_PRESS_MS);
  }, []);

  /** True while a card is dragged or was just dropped - its click and swipe are not real ones. */
  const justDragged = useCallback(
    () => !!gesture.current?.active || performance.now() - endedAt.current < AFTER_DROP_MS,
    [],
  );

  return { drop, start, scrollerRef, headerRef, bindColumn, justDragged };
}
