"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X, ScanFace, Hand, Footprints,
  Flower2, Minus, Target, Shirt, ArrowLeft,
  PersonStanding, Loader2, CheckCircle2, AlertCircle, Info, MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  supabase, calcBookingDuration, calcTotalDuration, getAvailableSlots,
  minutesToTime, timeToMinutes,
} from "@/lib/supabase";
import {
  fetchAvailability, resolveWindows, buildCandidateDates,
  PUBLIC_HORIZON_DAYS, EMPTY_AVAILABILITY, type AvailabilityData,
} from "@/lib/availability";
import type { Service } from "@/lib/database.types";
import {
  eligibleBundleSizes, computeBundle, parseBundlePromo,
  bundlePurchaseCode, bundleRedeemCode, type BundleResult,
} from "@/lib/bundles";
import { STUDENT_PROMO_CODE, isStudentPromoCode } from "@/lib/pricing";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedNames?: string[];
  /** Pre-select a bundle size when the modal opens (used by landing-page examples). */
  preselectedBundle?: number;
  /** Skip the gender step and open straight into this gender's treatment list. */
  preselectedGender?: "zene" | "muskarci";
}

type Step = 1 | 2 | "plan" | 3 | 4 | 5 | "success" | "preparation";
type BookingMode = "single" | "bundle";
type Gender = "zene" | "muskarci";

// ── Icon mapping ──────────────────────────────────────────────────────────────
function getIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("nausnice")) return ScanFace;
  if (n.includes("lice") || n.includes("lica") || n.includes("brada")) return ScanFace;
  if (n.includes("intimna") || n.includes("intima")) return Flower2;
  if (n.includes("pazuh")) return Hand;
  if (n.includes("ruk")) return Hand;
  if (n.includes("linija")) return Minus;
  if (n.includes("stomak")) return Target;
  if (n.includes("nog")) return Footprints;
  if (n.includes("telo")) return PersonStanding;
  if (n.includes("grudi")) return Shirt;
  if (n.includes("leđ") || n.includes("ledj")) return PersonStanding;
  return Target;
}

// ── Date & day helpers ────────────────────────────────────────────────────────
const SR_DAYS_FULL = [
  "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja",
];
const SR_MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];
const SR_MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "avg", "sep", "okt", "nov", "dec",
];

/** Returns Monday-index (0=Mon, 6=Sun) for a JS Date */
function monIdx(d: Date) { return (d.getDay() + 6) % 7; }

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateFull(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${SR_DAYS_FULL[monIdx(d)]}, ${d.getDate()}. ${SR_MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

interface DayOption {
  date: string;       // YYYY-MM-DD
  label: string;      // "Ponedeljak"
  shortDate: string;  // "24. feb"
  isToday: boolean;
}

/**
 * Candidate days within the rolling public horizon where the booking duration fits
 * the effective business windows (ignores existing reservations - use after a
 * reservations query to hide fully booked days).
 */
function buildDayOptions(totalDuration: number, availability: AvailabilityData): DayOption[] {
  if (totalDuration <= 0) return [];

  const now = new Date();
  const todayStr = toDateStr(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minStartToday = nowMinutes + 120; // 2-hour notice

  const days: DayOption[] = [];

  for (const dateStr of buildCandidateDates(PUBLIC_HORIZON_DAYS, availability, now)) {
    const windows = resolveWindows(dateStr, availability);
    if (!windows) continue;

    const isToday = dateStr === todayStr;
    const minStart = isToday ? minStartToday : undefined;
    if (getAvailableSlots([], totalDuration, minStart, windows).length === 0) {
      continue;
    }

    const d = new Date(`${dateStr}T00:00:00`);
    const idx = monIdx(d);

    days.push({
      date: dateStr,
      label: SR_DAYS_FULL[idx],
      shortDate: `${d.getDate()}. ${SR_MONTHS_SHORT[d.getMonth()]}`,
      isToday,
    });
  }

  return days;
}

function formatPrice(price: number): string {
  return price.toLocaleString("sr-RS");
}

/* `ils-` promo codes (−10%) are deliberately NOT honoured here. They are an
   admin-only discount, applied from the admin panel when creating/editing a
   reservation - see AdminReservationModal. The public form accepts bundle
   codes only. */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A reachable phone number has at least 8 digits (e.g. 065 373 8991, +381…). */
function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 8;
}

/**
 * crypto.randomUUID is missing on older iOS Safari (<15.4) - a throw there
 * would block the whole booking flow, so fall back to a v4 built by hand.
 */
function safeUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Meta Pixel + CAPI + Clarity. Tracking must never be able to break the booking flow. */
function trackEvent(eventName: string, extra: Record<string, unknown> = {}, pixelParams: Record<string, unknown> = {}) {
  try {
    const eventId = safeUUID();
    const w = window as Window & { fbq?: (...args: unknown[]) => void; clarity?: (...args: unknown[]) => void };
    w.fbq?.("track", eventName, pixelParams, { eventID: eventId });
    // Clarity custom event - lets recordings be filtered by funnel step. No-op until Clarity loads.
    w.clarity?.("event", eventName);
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url: window.location.href,
        ...extra,
      }),
    }).catch(() => {});
  } catch { /* ignore */ }
}

type SlotRow = { start_time: string; end_time: string; status: string };

// ── Combo detection ───────────────────────────────────────────────────────────
interface ComboRule {
  parts: string[];   // lowercase substrings that identify the component services
  comboKey: string;  // lowercase substring that identifies the combo service
}

const COMBO_RULES: ComboRule[] = [
  { parts: ["nausnice", "brada"],  comboKey: "nausnice i brada" },
  { parts: ["noge", "intima"],     comboKey: "noge + intima" },
  { parts: ["stomak", "grudi"],    comboKey: "stomak + grudi" },
];

/** Returns true if this service is a combo product (should be hidden from the list) */
function isComboService(name: string): boolean {
  const n = name.toLowerCase();
  return COMBO_RULES.some((r) => n.includes(r.comboKey));
}

// ── "Celo telo" exclusivity ─────────────────────────────────────────────────
// When the whole body is selected, only earrings, chin and whole face may be
// added alongside it - every other region is already covered by "Celo telo".
const FULL_BODY_KEY = "celo telo";
const FULL_BODY_ALLOWED = ["nausnice", "brada", "celo lice"];

function isFullBody(name: string): boolean {
  return name.toLowerCase().includes(FULL_BODY_KEY);
}

/** Services that may stay selectable when "Celo telo" is chosen. */
function isAllowedWithFullBody(name: string): boolean {
  const n = name.toLowerCase();
  return isFullBody(name) || FULL_BODY_ALLOWED.some((k) => n.includes(k));
}

/**
 * Given the currently selected services and all loaded services,
 * returns the effective list for price/duration calculation:
 * combo component pairs are replaced with the combo service.
 * Also returns which combos were applied (for UI badge).
 */
function applyComboRules(
  selected: Service[],
  all: Service[]
): { effective: Service[]; appliedCombos: Service[] } {
  let effective = [...selected];
  const appliedCombos: Service[] = [];

  for (const rule of COMBO_RULES) {
    const matchedParts = rule.parts
      .map((part) => effective.find((s) => s.name.toLowerCase().includes(part)))
      .filter((s): s is Service => s !== undefined);

    if (matchedParts.length === rule.parts.length) {
      const combo = all.find((s) => s.name.toLowerCase().includes(rule.comboKey));
      if (combo) {
        effective = effective.filter((s) => !matchedParts.includes(s));
        effective.push(combo);
        appliedCombos.push(combo);
      }
    }
  }

  return { effective, appliedCombos };
}

// ── Accent theme ──────────────────────────────────────────────────────────────
// Both genders run on a dark sheet (see `.bm-theme-*` in globals.css):
// zene = midnight plum + rose gold, muskarci = obsidian + antique gold.
const ACCENTS = {
  zene: {
    hex: "#DCA8A6",
    onHex: "#1E1017",
    border: "border-[#DCA8A6]",
    bg: "bg-[#DCA8A6]",
    bgLight: "bg-[#DCA8A6]/10",
    bgMed: "bg-[#DCA8A6]/20",
  },
  muskarci: {
    hex: "#D4AF67",
    onHex: "#0B0B0C",
    border: "border-[#D4AF67]",
    bg: "bg-[#D4AF67]",
    bgLight: "bg-[#D4AF67]/10",
    bgMed: "bg-[#D4AF67]/20",
  },
} as const;

/** Per-gender social proof - shown on the services step and the date step. */
const SOCIAL_PROOF: Record<Gender, { mark: string; line: string }> = {
  zene: { mark: "♥", line: "Preko 2000 ljudi se uspešno rešilo dlačica" },
  muskarci: { mark: "◆", line: "Preko 2000 ljudi se uspešno rešilo dlačica" },
};

const STEP_LABELS: Record<Step, [string, string]> = {
  1: ["KORAK 1 OD 5", "Za koga zakazuješ?"],
  2: ["KORAK 1 OD 5", "Odaberi regije za tretman"],
  plan: ["KORAK 2 OD 5", "Pojedinačno ili paket sa popustom?"],
  3: ["KORAK 3 OD 5", "Izaberi datum"],
  4: ["KORAK 4 OD 5", "Izaberi vreme"],
  5: ["KORAK 5 OD 5", "Vaši podaci"],
  success: ["POTVRĐENO", "Termin je uspešno zakazan"],
  preparation: ["PRE TRETMANA", "Šta treba da uradiš?"],
};

const PAYMENT_TERMS =
  "Ceo paket plaćaš na prvom tretmanu - svi preostali termini su ti zagarantovani.";

/**
 * iOS-style banners "from Ana", each tied to the step it argues for.
 * One per step, shown once per modal session.
 */
type NoticeKey = "guarantee" | "plan" | "student";
/** `step: null` = never auto-fires on a step; raised by hand from the flow. */
const NOTICES: Record<NoticeKey, { step: Step | null; message: string }> = {
  guarantee: {
    step: 2,
    message: "Ako se ne rešiš 70–90% dlačica, vraćamo ti novac.",
  },
  plan: {
    step: "plan",
    message:
      "Za potpune rezultate telu treba 6–8, a licu 10 tretmana. Uzmi paket i uštedi - plaćaš jednom, dolaziš koliko ti treba.",
  },
  student: {
    step: null,
    message:
      "Ponesi indeks na tretman. Bez njega studentski popust ne važi i plaćaš punu cenu.",
  },
};
const NOTICE_ORDER = Object.keys(NOTICES) as NoticeKey[];

/**
 * The modal is full-screen on every device, so on desktop the content would
 * otherwise stretch across the whole viewport. Header, body and footer all share
 * this centered column - mobile is untouched (max-width kicks in only from sm).
 */
const COL_W = "w-full sm:max-w-[680px] md:max-w-[760px] sm:mx-auto";

/** Bundle-size illustrations (gift-box stacks matching the tier size). */
const BUNDLE_IMAGES: Record<number, string> = {
  3: "/paketi/3.webp",
  6: "/paketi/6.webp",
  8: "/paketi/8.webp",
  10: "/paketi/10.webp",
};

// ═════════════════════════════════════════════════════════════════════════════
export default function BookingModal({ isOpen, onClose, preselectedNames, preselectedBundle, preselectedGender }: BookingModalProps) {
  const fbclidRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("fbclid")
      : null,
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [step, setStep]               = useState<Step>(1);
  const [gender, setGender]           = useState<Gender | null>(null);
  const [services, setServices]       = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 3 state
  const [selectedDate, setSelectedDate]   = useState("");
  const [selectedTime, setSelectedTime]   = useState("");
  const [daySlots, setDaySlots]           = useState<SlotRow[]>([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  /** Reservations for the day failed to load - never show slots as free then. */
  const [slotsError, setSlotsError]       = useState(false);
  /** Bump to force a fresh reservations fetch for the selected day. */
  const [slotsReloadKey, setSlotsReloadKey] = useState(0);
  const [servicesError, setServicesError] = useState(false);
  /** The picked time got booked by someone else while the form was open. */
  const [slotTaken, setSlotTaken]         = useState(false);
  const [servicesReloadKey, setServicesReloadKey] = useState(0);
  /** Synchronous double-submit guard (state updates land a render too late). */
  const submitLockRef = useRef(false);
  /**
   * Client-generated reservation id, reused while the booking details stay the
   * same: if an insert succeeded but its response was lost, the retry hits the
   * primary key instead of creating a duplicate booking.
   */
  const pendingBookingRef = useRef<{ key: string; id: string } | null>(null);
  const [form, setForm]                   = useState({ name: "", email: "", phone: "" });
  const [customerNote, setCustomerNote]   = useState("");
  const [fieldErrors, setFieldErrors]     = useState({ name: false, email: false, phone: false, policy: false });
  const [acceptedPolicy, setAcceptedPolicy] = useState(true);
  const [showPolicyInfo, setShowPolicyInfo] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [bookingRef, setBookingRef]       = useState<string | null>(null);
  const [promoCode, setPromoCode]               = useState("");
  const [promoStatus, setPromoStatus]           = useState<"idle" | "valid" | "invalid">("idle");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  /** "bundle_redeem" = pre-paid bundle session (price 0), "student" = −20%. */
  const [promoKind, setPromoKind]               = useState<"none" | "bundle_redeem" | "student">("none");
  const [checkingPromo, setCheckingPromo]       = useState(false);
  /** Why a code was refused - a plain "invalid" reads as wrong for a real code. */
  const [promoErrorMsg, setPromoErrorMsg]       = useState<string | null>(null);

  // Step "plan" state
  const [bookingMode, setBookingMode] = useState<BookingMode>("single");
  const [bundleSize, setBundleSize]   = useState<number | null>(null);
  const [displayedPrice, setDisplayedPrice]   = useState(0);
  const animFrameRef = useRef<number>(0);
  const appliedPreselect = useRef(false);
  /** Scrollable step body - reset to top on every step change */
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // iOS-style notifications from Ana - each fires once per modal session.
  // "Already shown" lives in a ref, not state: as a dependency of the scheduling
  // effect below it would re-run that effect the moment a notice fires and
  // immediately dismiss it again.
  const shownNoticesRef = useRef<NoticeKey[]>([]);
  const [activeNotice, setActiveNotice] = useState<NoticeKey | null>(null);
  const emailCheckSeqRef = useRef(0);

  /** null = not checked yet for current email; true = exists in reservations */
  const [isReturningCustomer, setIsReturningCustomer] = useState<boolean | null>(null);
  const [checkingReturningEmail, setCheckingReturningEmail] = useState(false);

  /** Step 3: dates that still have ≥1 free slot for the current treatment duration */
  const [bookableDayOptions, setBookableDayOptions] = useState<DayOption[]>([]);
  const [loadingBookableDays, setLoadingBookableDays] = useState(false);
  const bookableDaysFetchIdRef = useRef(0);

  /** Working-hours schedule (weekly template + overrides) loaded from the DB. */
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  /** Whole body is selected - lock out every region except earrings, chin & whole face. */
  const fullBodySelected = selectedServices.some((s) => isFullBody(s.name));
  const { effective: effectiveServices, appliedCombos } = applyComboRules(selectedServices, services);
  /** With 10 min consultation - used for day/slot picking so first-time bookings always fit. */
  const slotDuration =
    selectedServices.length > 0 ? calcBookingDuration(selectedServices) : 0;
  /** Stored end time & UI after email check: returning clients skip consultation block. */
  const reservationDuration =
    selectedServices.length === 0
      ? 0
      : isReturningCustomer === true
        ? calcTotalDuration(selectedServices)
        : calcBookingDuration(selectedServices);
  const totalPrice       = effectiveServices.reduce((sum, s) => sum + s.price, 0);
  const accent           = ACCENTS[gender ?? "zene"];
  const reduceMotion     = useReducedMotion();
  const proof            = SOCIAL_PROOF[gender ?? "zene"];
  /** Step 2 list - "Celo telo" leads, it is the offer we most want booked. */
  const pickableServices = useMemo(() => {
    const visible = services.filter((s) => !isComboService(s.name));
    return [
      ...visible.filter((s) => isFullBody(s.name)),
      ...visible.filter((s) => !isFullBody(s.name)),
    ];
  }, [services]);

  // ── Bundle ("Napravi svoj paket") ───────────────────────────────────────────
  const eligibleSizes = eligibleBundleSizes(effectiveServices);
  const bundleResult: BundleResult | null =
    bundleSize != null && eligibleSizes.includes(bundleSize) && effectiveServices.length > 0
      ? computeBundle(effectiveServices, bundleSize)
      : null;
  const bundleActive = bookingMode === "bundle" && bundleResult != null;

  // ── Discounts (mutually exclusive: bundle > redeem > student) ───────────────
  const redeemActive =
    !bundleActive && promoKind === "bundle_redeem" && promoStatus === "valid" &&
    appliedPromoCode != null;
  const studentActive =
    !bundleActive && !redeemActive && promoKind === "student" && promoStatus === "valid";

  const listTotal = bundleActive ? bundleResult!.originalTotal : totalPrice;
  const finalPrice = bundleActive
    ? bundleResult!.finalTotal
    : redeemActive
      ? 0
      : studentActive
        ? Math.round(totalPrice * 0.8)
        : totalPrice;
  const savingsVsList = listTotal - finalPrice;

  // For today: slots must start ≥ now+120min. Read the clock on every render -
  // the modal stays mounted between opens, so a memoised value would be the
  // page-load time and offer same-day slots that are already too close.
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const isToday = selectedDate !== "" && selectedDate === toDateStr(nowDate);
  const minStart = isToday ? nowMinutes + 120 : undefined;

  const windows = selectedDate && availability ? resolveWindows(selectedDate, availability) : null;
  const availableSlots = windows?.length
    ? getAvailableSlots(daySlots, slotDuration, minStart, windows)
    : [];

  // ── Side-effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Load the working-hours schedule once per open - one query for the whole horizon.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchAvailability()
      .then((data) => { if (!cancelled) setAvailability(data); })
      .catch(() => { if (!cancelled) setAvailability(EMPTY_AVAILABILITY); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Preselected treatments are women's regions - open straight into her list,
  // skipping the gender choice. A ?pol= link does the same with nothing selected.
  // Plain opens start on Step 1 (gender).
  useEffect(() => {
    if (!isOpen) return;
    if (preselectedNames && preselectedNames.length > 0) {
      setGender("zene");
      setStep(2);
    } else if (preselectedGender) {
      setGender(preselectedGender);
      setStep(2);
    }
  }, [isOpen, preselectedNames, preselectedGender]);

  useEffect(() => {
    if (!gender) return;
    // Ignore a late response for the other gender (quick back + switch).
    let cancelled = false;
    setLoadingServices(true);
    setServicesError(false);
    supabase
      .from("services")
      .select("*")
      .eq("gender", gender)
      .order("sort_order")
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          if (error || !data || data.length === 0) setServicesError(true);
          setServices(data ?? []);
          setLoadingServices(false);
        },
        () => {
          if (cancelled) return;
          setServicesError(true);
          setServices([]);
          setLoadingServices(false);
        },
      );
    return () => { cancelled = true; };
  }, [gender, servicesReloadKey]);

  // ── Animated price count-down on success screen ───────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    const target = finalPrice;
    const from   = listTotal;

    if (from === target) { setDisplayedPrice(target); return; }

    const DURATION = 900;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayedPrice(Math.round(from + (target - from) * eased));
      if (progress < 1) animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [step, finalPrice, listTotal]);

  // Reservations for the chosen day - refetched every time the time step opens,
  // so coming back to a day never shows slots that were booked in the meantime.
  useEffect(() => {
    if (!selectedDate || step !== 4) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(false);
    setDaySlots([]);
    supabase
      .rpc("public_busy_slots", { p_from: selectedDate, p_to: selectedDate })
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          // On error show nothing as free - an empty list would mark the whole day open.
          if (error) setSlotsError(true);
          else setDaySlots(data ?? []);
          setLoadingSlots(false);
        },
        () => {
          if (cancelled) return;
          setSlotsError(true);
          setLoadingSlots(false);
        },
      );
    return () => { cancelled = true; };
  }, [selectedDate, step, slotsReloadKey]);

  // Step 3: load reservations for all candidate days, hide dates with no free slot
  useEffect(() => {
    if (!isOpen || step !== 3 || slotDuration <= 0) {
      setLoadingBookableDays(false);
      return;
    }
    if (!availability) {
      // Schedule still loading - keep the spinner until it arrives.
      setLoadingBookableDays(true);
      return;
    }

    const fetchId = ++bookableDaysFetchIdRef.current;
    const candidates = buildDayOptions(slotDuration, availability);
    setLoadingBookableDays(true);
    setBookableDayOptions([]);

    if (candidates.length === 0) {
      if (bookableDaysFetchIdRef.current === fetchId) {
        setBookableDayOptions([]);
        setLoadingBookableDays(false);
      }
      return;
    }

    const dates = candidates.map((d) => d.date);
    void (async () => {
      let rows: { date: string; start_time: string; end_time: string; status: string }[] | null = null;
      let loadError = false;
      try {
        const { data, error } = await supabase
          .rpc("public_busy_slots", { p_from: dates[0], p_to: dates[dates.length - 1] });
        if (error) loadError = true;
        else rows = data ?? [];
      } catch {
        loadError = true;
      }

      if (bookableDaysFetchIdRef.current !== fetchId) return;

      const now = new Date();
      const todayStr = toDateStr(now);
      const minStartToday = now.getHours() * 60 + now.getMinutes() + 120;

      const byDate = new Map<string, { start_time: string; end_time: string; status: string }[]>();
      if (rows) {
        for (const row of rows) {
          const list = byDate.get(row.date) ?? [];
          list.push({
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
          });
          byDate.set(row.date, list);
        }
      }

      const filtered = loadError
        ? candidates
        : candidates.filter((day) => {
            const windows = resolveWindows(day.date, availability);
            if (!windows) return false;
            const minStart = day.date === todayStr ? minStartToday : undefined;
            const res = byDate.get(day.date) ?? [];
            return getAvailableSlots(res, slotDuration, minStart, windows).length > 0;
          });

      setBookableDayOptions(filtered);
      setLoadingBookableDays(false);
    })();

    return () => {
      bookableDaysFetchIdRef.current += 1;
    };
  }, [isOpen, step, slotDuration, availability]);

  useEffect(() => {
    if (!selectedDate || bookableDayOptions.length === 0) return;
    if (!bookableDayOptions.some((d) => d.date === selectedDate)) {
      setSelectedDate("");
      setSelectedTime("");
    }
  }, [bookableDayOptions, selectedDate]);

  // ── Auto-select preselected services when modal opens ─────────────────────
  useEffect(() => {
    if (!isOpen) {
      appliedPreselect.current = false;
      return;
    }
    if (appliedPreselect.current) return;
    if (!preselectedNames || preselectedNames.length === 0) {
      appliedPreselect.current = true;
      return;
    }
    if (services.length === 0) return; // wait for services to load
    const matchedIds = services
      .filter((s) => !isComboService(s.name))
      .filter((s) => preselectedNames.some((kw) => s.name.toLowerCase().includes(kw)))
      .map((s) => s.id);
    if (matchedIds.length > 0) {
      setSelectedIds(matchedIds);
      // Landing-page examples jump straight into the bundle on the plan step.
      if (preselectedBundle != null) {
        setBookingMode("bundle");
        setBundleSize(preselectedBundle);
        setStep("plan");
      }
    }
    appliedPreselect.current = true;

  }, [isOpen, preselectedNames, preselectedBundle, services]);

  // Every step starts at the top - otherwise a long previous step (services)
  // leaves the next one scrolled past its opening.
  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // ── Notifications: slide in shortly after their step opens ──────────────────
  useEffect(() => {
    if (!isOpen) {
      shownNoticesRef.current = [];
      setActiveNotice(null);
      return;
    }
    // A notice belongs to its step - leaving the step takes it with you.
    // Safe only because this effect runs on step changes alone.
    setActiveNotice(null);
    const key = NOTICE_ORDER.find((k) => NOTICES[k].step === step);
    if (!key || shownNoticesRef.current.includes(key)) return;
    const t = setTimeout(() => {
      shownNoticesRef.current = [...shownNoticesRef.current, key];
      setActiveNotice(key);
    }, 700);
    return () => clearTimeout(t);
  }, [isOpen, step]);

  // The student-ID warning only makes sense while the student code is applied.
  useEffect(() => {
    if (promoKind !== "student") setActiveNotice((n) => (n === "student" ? null : n));
  }, [promoKind]);

  // Auto-dismiss the banner like a real notification (X dismisses it instantly).
  useEffect(() => {
    if (!activeNotice) return;
    const t = setTimeout(() => setActiveNotice(null), 7000);
    return () => clearTimeout(t);
  }, [activeNotice]);

  // Note: if the region selection changes so the chosen bundle size is no longer
  // eligible (e.g. an all-face basket gains a body region, dropping the 10-pack),
  // `bundleResult` becomes null and `bundleActive` is false - the flow falls back
  // to single-session pricing automatically, no state reset needed.

  // ── Handlers ──────────────────────────────────────────────────────────────
  function resetAll() {
    bookableDaysFetchIdRef.current += 1;
    setBookableDayOptions([]);
    setLoadingBookableDays(false);
    setStep(1); setGender(null); setSelectedIds([]);
    setSelectedDate(""); setSelectedTime(""); setDaySlots([]);
    setSlotsError(false); setServicesError(false); setSlotTaken(false);
    submitLockRef.current = false;
    pendingBookingRef.current = null;
    setSubmitting(false);
    setForm({ name: "", email: "", phone: "" });
    setCustomerNote("");
    setFieldErrors({ name: false, email: false, phone: false, policy: false });
    setAcceptedPolicy(true);
    setShowPolicyInfo(false);
    setSubmitError(null); setBookingRef(null);
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null);
    setPromoKind("none"); setCheckingPromo(false); setPromoErrorMsg(null);
    setBookingMode("single"); setBundleSize(null);
    emailCheckSeqRef.current += 1;
    setIsReturningCustomer(null);
    setCheckingReturningEmail(false);
  }


  function handleClose() {
    setIsAnimating(false);
    setTimeout(() => { onClose(); resetAll(); }, 300);
  }

  function handleBack() {
    if (step === 1) { handleClose(); }
    else if (step === 2) { setStep(1); setGender(null); setSelectedIds([]); }
    else if (step === "plan") { setStep(2); }
    else if (step === 3) { setStep("plan"); setSelectedDate(""); setSelectedTime(""); }
    else if (step === 4) { setStep(3); setSelectedTime(""); }
    else if (step === 5) { setStep(4); }
    else if (step === "preparation") { setStep("success"); }
  }

  function handleGenderSelect(g: Gender) {
    setGender(g);
    setSelectedIds([]);
    setSelectedDate(""); setSelectedTime("");
    setStep(2);
    (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.("track", "ViewContent");
  }

  function toggleService(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    const isSelected = selectedIds.includes(id);
    // Block adding regions that are already covered by a selected "Celo telo".
    if (fullBodySelected && !isSelected && !isAllowedWithFullBody(svc.name)) {
      return;
    }
    // Selecting "Celo telo" itself drops any already-selected regions it now covers.
    if (!isSelected && isFullBody(svc.name)) {
      setSelectedIds((prev) => [
        ...prev.filter((pid) => {
          const s = services.find((x) => x.id === pid);
          return s ? isAllowedWithFullBody(s.name) : false;
        }),
        id,
      ]);
      return;
    }
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function handleDaySelect(date: string) {
    if (date !== selectedDate) {
      setSelectedDate(date);
      setSelectedTime("");
      setSlotTaken(false);
    }
    setStep(4);
  }

  async function runReturningEmailCheck(email: string) {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setIsReturningCustomer(null);
      setCheckingReturningEmail(false);
      return;
    }
    const seq = ++emailCheckSeqRef.current;
    setCheckingReturningEmail(true);
    const { data, error } = await supabase.rpc("public_is_returning", { p_email: trimmed });
    if (emailCheckSeqRef.current !== seq) return;
    setCheckingReturningEmail(false);
    if (error) {
      setIsReturningCustomer(false);
      return;
    }
    setIsReturningCustomer(data === true);
  }

  /** Shared exit for a refused code - `msg` explains why, when a reason helps. */
  function rejectPromo(msg: string) {
    setPromoStatus("invalid");
    setAppliedPromoCode(null);
    setPromoKind("none");
    setPromoErrorMsg(msg);
  }

  async function handleApplyPromo() {
    const raw = promoCode.trim();
    setPromoErrorMsg(null);
    if (!raw) {
      setPromoStatus("idle");
      setAppliedPromoCode(null);
      setPromoKind("none");
      return;
    }

    // Student code - −20%, first treatment only. The student ID itself is checked
    // at the studio; all we can verify here is that this email has never booked.
    if (isStudentPromoCode(raw)) {
      const email = form.email.trim();
      if (!EMAIL_REGEX.test(email)) {
        rejectPromo("Unesi svoj email pa primeni kod.");
        return;
      }
      setCheckingPromo(true);
      const { data, error } = await supabase.rpc("public_is_returning", { p_email: email });
      setCheckingPromo(false);
      if (error) {
        rejectPromo("Provera koda nije uspela. Pokušaj ponovo.");
        return;
      }
      if (data === true) {
        rejectPromo("Studentski popust važi samo za prvi tretman.");
        return;
      }
      setPromoStatus("valid");
      setAppliedPromoCode(STUDENT_PROMO_CODE);
      setPromoKind("student");
      // Raised by hand - the index-card warning matters more than any step notice.
      setActiveNotice("student");
      return;
    }

    // Bundle code - redeeming a pre-paid follow-up session (price 0).
    // `ils-` promo codes are rejected here on purpose (admin-only, see above).
    const bundle = parseBundlePromo(raw);
    if (bundle && !bundle.redeem) {
      const email = form.email.trim();
      if (!EMAIL_REGEX.test(email)) {
        rejectPromo("Nevažeći promo kod.");
        return;
      }
      setCheckingPromo(true);
      // Pre-paid sessions still free for this email + code (0 = no such
      // purchase, or every session of the bundle is already booked).
      const { data: left, error } = await supabase.rpc("bundle_sessions_left", { p_email: email, p_code: raw });
      setCheckingPromo(false);
      if (error) {
        rejectPromo("Provera koda nije uspela. Pokušaj ponovo.");
        return;
      }
      if (!left || left <= 0) {
        rejectPromo("Nevažeći kod ili su svi tretmani iz paketa već zakazani.");
        return;
      }
      setPromoStatus("valid");
      setAppliedPromoCode(raw.toLowerCase());
      setPromoKind("bundle_redeem");
      return;
    }

    rejectPromo("Nevažeći promo kod.");
  }

  async function handleSubmit() {
    if (submitLockRef.current) return;
    // Validate – highlight empty required fields instead of blocking silently
    const errors = {
      name: !form.name.trim(),
      email: !EMAIL_REGEX.test(form.email.trim()),
      phone: !isValidPhone(form.phone),
      policy: !acceptedPolicy,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.phone || errors.policy) return;
    if (!selectedDate || !selectedTime) {
      setStep(selectedDate ? 4 : 3);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitBooking();
    } catch (err) {
      console.error("[booking] submit failed:", err);
      setSubmitError("Greška pri zakazivanju. Proverite internet konekciju i pokušajte ponovo.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  async function submitBooking() {
    const nameTrim  = form.name.trim();
    const emailTrim = form.email.trim();
    const phoneTrim = form.phone.trim();

    // Resolve the recorded promo code, prices and admin note for this booking.
    let promoForRecord: string | null = null;
    let notesForRecord: string | null = null;
    if (bundleActive) {
      promoForRecord = bundlePurchaseCode(bundleSize!, bundleResult!.finalTotal);
      notesForRecord =
        `Paket ${bundleSize}× - ukupno ${formatPrice(bundleResult!.finalTotal)} RSD ` +
        `(ušteda ${formatPrice(bundleResult!.savings)} RSD)`;
    } else if (redeemActive) {
      promoForRecord = bundleRedeemCode(appliedPromoCode!);
      notesForRecord = `Iskorišćen tretman iz paketa ${appliedPromoCode}`;
    } else if (studentActive) {
      promoForRecord = STUDENT_PROMO_CODE;
      notesForRecord = "STUDENTSKI POPUST −20% - proveri indeks pri dolasku!";
    }
    const listForSubmit  = listTotal;
    const finalForSubmit = finalPrice;

    // Same details as a previous (possibly lost) attempt → same id, so a retry
    // can never create a second reservation.
    const bookingKey = JSON.stringify([
      selectedDate, selectedTime, emailTrim.toLowerCase(), nameTrim, phoneTrim,
      [...selectedIds].sort(), promoForRecord,
    ]);
    if (pendingBookingRef.current?.key !== bookingKey) {
      pendingBookingRef.current = { key: bookingKey, id: safeUUID() };
    }
    const reservationId = pendingBookingRef.current.id;

    // The database does every check under a per-day lock - free slot, working
    // hours, promo validity, first-visit consultation - then saves the booking
    // and its regions together. Two clients can never get the same time.
    const { data, error } = await supabase.rpc("public_create_booking", {
      p_id:            reservationId,
      p_name:          nameTrim,
      p_email:         emailTrim,
      p_phone:         phoneTrim,
      p_customer_note: customerNote.trim() || null,
      p_date:          selectedDate,
      p_start_time:    `${selectedTime}:00`,
      p_service_ids:   selectedIds,
      p_promo_code:    promoForRecord,
      p_notes:         notesForRecord,
    });

    if (error || !data) {
      console.error("[booking] create failed:", error);
      setSubmitError("Greška pri zakazivanju. Proverite internet konekciju i pokušajte ponovo.");
      return;
    }

    const result = data as {
      status: "ok" | "slot_taken" | "too_late" | "invalid_promo" | "invalid_input";
      reason?: string;
      end_time?: string;
      total_duration?: number;
      returning?: boolean;
    };

    if (result.status === "slot_taken" || result.status === "too_late") {
      sendBackToTimes();
      return;
    }
    if (result.status === "invalid_promo") {
      rejectPromo(
        result.reason === "student_not_first"
          ? "Studentski popust važi samo za prvi tretman."
          : result.reason === "bundle_used"
            ? "Svi tretmani iz ovog paketa su već zakazani."
            : "Nevažeći promo kod.",
      );
      setSubmitError("Promo kod nije prihvaćen - ukloni ga ili unesi drugi.");
      return;
    }
    if (result.status !== "ok") {
      setSubmitError("Proverite unete podatke i pokušajte ponovo.");
      return;
    }

    const returningSubmit        = result.returning === true;
    const durationForReservation = result.total_duration ?? reservationDuration;
    const endTime = result.end_time ?? minutesToTime(timeToMinutes(selectedTime) + durationForReservation);

    pendingBookingRef.current = null;
    const bookingRefValue = reservationId.slice(-8).toUpperCase();
    setBookingRef(bookingRefValue);

    fetch("/api/booking-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive: the confirmation still goes out if the client closes the tab right away.
      keepalive: true,
      body: JSON.stringify({
        customer_name:    nameTrim,
        customer_email:   emailTrim,
        customer_phone:   phoneTrim || null,
        date:             selectedDate,
        start_time:       selectedTime,
        end_time:         endTime,
        services:         effectiveServices.map((s) => ({ name: s.name, price: s.price })),
        total_duration:   durationForReservation,
        total_price:      listForSubmit,
        discounted_price: finalForSubmit,
        promo_code:       promoForRecord ?? "redovna cena",
        bundle_sessions:  bundleActive ? bundleSize : null,
        bundle_code:      bundleActive ? promoForRecord : null,
        /* n8n uses this to add the "bring your student ID" line to the email. */
        student_discount: studentActive,
        booking_ref:      bookingRefValue,
      }),
    }).catch(() => {});

    setIsReturningCustomer(returningSubmit);

    const usdValue = +(finalForSubmit / 102).toFixed(2);
    // Browser Pixel + server-side CAPI share one eventID for deduplication.
    trackEvent(
      "Purchase",
      {
        email: emailTrim,
        phone: phoneTrim || undefined,
        value: usdValue,
        currency: "USD",
        fbclid: fbclidRef.current || undefined,
      },
      { value: usdValue, currency: "USD" },
    );

    setStep("success");
  }

  /** The picked time was taken (or passed) while the form was open. */
  function sendBackToTimes() {
    setSelectedTime("");
    setSlotTaken(true);
    setSlotsReloadKey((k) => k + 1);
    setStep(4);
  }

  function handleAddToCart() {
    trackEvent("AddToCart", { fbclid: fbclidRef.current || undefined });
    setStep("plan");
  }

  function handleSelectSingle() {
    setBookingMode("single");
    setBundleSize(null);
    setStep(3);
  }

  function handleSelectBundle(size: number) {
    setBookingMode("bundle");
    setBundleSize(size);
    // A bundle is paid in full upfront - drop any single-session promo.
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null); setPromoKind("none"); setPromoErrorMsg(null);
    setStep(3);
  }

  function handleInitiateCheckout() {
    trackEvent("InitiateCheckout", { fbclid: fbclidRef.current || undefined });
    setStep(5);
  }

  function handleTimeSelect(slot: string) {
    setSelectedTime(slot);
    setSlotTaken(false);
    handleInitiateCheckout();
  }

  if (!isOpen) return null;

  const [stepLabel, stepSub] = STEP_LABELS[step];

  // ── Render ────────────────────────────────────────────────────────────────
  // z-80: iznad SocialProofToast (z-60), da guarantee banner nikad ne ostane ispod njega
  return (
    <div className={`bm-theme ${gender ? `bm-theme-${gender}` : ""} fixed inset-0 z-80 flex items-center justify-center`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* iOS-style notification from Ana (guarantee on services, paket on plan) */}
      <AnimatePresence>
        {activeNotice && (
          <motion.div
            key={`notice-${activeNotice}`}
            className="absolute top-0 left-0 right-0 z-[70] flex justify-center px-3 pt-3 pointer-events-none"
            initial={{ y: -170, opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{
              y: -140, opacity: 0, scale: 0.94, filter: "blur(8px)",
              transition: { duration: 0.32, ease: [0.36, 0, 0.66, -0.06] },
            }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
          >
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.5, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y < -32 || info.velocity.y < -450) setActiveNotice(null);
              }}
              className="pointer-events-auto relative w-full max-w-[430px] sm:max-w-[520px] rounded-[24px] sm:rounded-[28px] border border-foreground/10 bg-[var(--bm-surface)]/95 backdrop-blur-xl p-3.5 sm:p-5 pr-9 sm:pr-11 shadow-[0_16px_44px_-10px_rgba(0,0,0,0.7)] cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 active:scale-90 transition-all cursor-pointer"
                aria-label="Zatvori obaveštenje"
              >
                <X size={13} strokeWidth={2.6} className="text-foreground/60" />
              </button>

              <div className="flex items-start gap-3">
                <div className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-[14px] sm:rounded-[18px] overflow-hidden shrink-0 ring-1 ring-white/10 shadow-sm">
                  <Image src="/ana.webp" alt="Ana" fill sizes="(max-width: 640px) 44px, 56px" className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] sm:text-[15px] font-bold font-poppins text-foreground tracking-tight truncate">
                      Ana <span className="font-medium text-foreground/50">(Vlasnik)</span>
                    </p>
                    <span className="text-[10px] sm:text-xs font-poppins text-foreground/40 shrink-0 ml-auto mr-1">sada</span>
                  </div>
                  <p className="mt-0.5 sm:mt-1 text-[13px] sm:text-[15px] leading-snug font-poppins text-foreground/80">
                    {NOTICES[activeNotice].message}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal shell */}
      <div
        className={`bm-sheet relative shadow-2xl w-full h-full flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* Header - from sm up, content lives in the centered COL_W column */}
        <div className={`flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-4 shrink-0 ${COL_W}`}>
          <div className="flex items-center gap-3">
            {(step === 1 || step === 2 || step === "plan" || step === 3 || step === 4 || step === 5 || step === "preparation") && (
              <button onClick={handleBack} className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Nazad">
                <ArrowLeft size={18} className="sm:w-[22px] sm:h-[22px]" />
              </button>
            )}
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold font-playfair ${gender ? "bm-metal-text" : ""}`}>Zakaži tretman</h2>
          </div>
          <button onClick={handleClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Zatvori">
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Step indicator */}
        <div className={`px-4 sm:px-6 pb-3 sm:pb-6 shrink-0 ${COL_W}`}>
          <p
            className="text-xs sm:text-[13px] text-foreground/50 tracking-[3px] font-semibold font-poppins"
            style={gender ? { color: accent.hex } : undefined}
          >
            {stepLabel}
          </p>
          <p className="text-sm sm:text-base text-foreground/60 font-poppins mt-1">{stepSub}</p>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable content - primary actions live in sticky footer below */}
          <div ref={scrollBodyRef} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2 ${COL_W}`}>


          {/* ══ STEP 1: Gender ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="flex flex-col gap-3 py-2">
              {([
                { key: "zene",     label: "Žene",      sub: "Tretmani za žene",      Icon: Flower2,         hex: ACCENTS.zene.hex,     surface: "linear-gradient(120deg, #1E1017 0%, #120A0E 100%)" },
                { key: "muskarci", label: "Muškarci",  sub: "Tretmani za muškarce",  Icon: PersonStanding,  hex: ACCENTS.muskarci.hex, surface: "linear-gradient(120deg, #161616 0%, #0B0B0C 100%)" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleGenderSelect(opt.key)}
                  className="flex items-center gap-4 sm:gap-5 w-full p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 hover:brightness-125 active:scale-[0.99] transition-all text-left cursor-pointer"
                  style={{ backgroundImage: opt.surface, borderColor: `${opt.hex}40` }}
                >
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: `${opt.hex}1A`, borderColor: `${opt.hex}33` }}
                  >
                    <opt.Icon size={28} style={{ color: opt.hex }} className="sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-bold font-playfair tracking-wide" style={{ color: opt.hex }}>{opt.label}</p>
                    <p className="text-xs sm:text-sm text-foreground/50 font-poppins mt-0.5">{opt.sub}</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={opt.hex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 sm:w-6 sm:h-6">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}

              {/* Lokacija */}
              <div className="mt-4 sm:mt-6">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <MapPin size={16} className="text-foreground/40 shrink-0 sm:w-5 sm:h-5" />
                  <p className="text-sm sm:text-base font-semibold font-poppins">Novi Sad, Miloja Čiplića 51</p>
                </div>
                <div className="relative w-full aspect-[16/10] sm:aspect-[16/8] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-foreground/8">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2808.952530282901!2d19.795792112493817!3d45.248752670950566!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b116b6f148971%3A0xbae20345f88572f7!2sInfinity%20Laser%20Studio!5e0!3m2!1sen!2srs!4v1775850629842!5m2!1sen!2srs"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Lokacija Infinity Laser Studio — Miloja Čiplića 51, Novi Sad"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 2: Services ════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {/* Social proof signals */}
              <div className="flex flex-col gap-2 mb-3 sm:mb-4">
                <div
                  className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border"
                  style={{
                    borderColor: `${accent.hex}33`,
                    backgroundImage: `linear-gradient(100deg, ${accent.hex}1F 0%, ${accent.hex}08 70%)`,
                  }}
                >
                  <span className="text-base sm:text-xl leading-none shrink-0" style={{ color: accent.hex }}>{proof.mark}</span>
                  <p className="text-xs sm:text-sm md:text-base font-poppins text-foreground/80 font-medium leading-snug">{proof.line}</p>
                </div>
              </div>
              {loadingServices ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-foreground/30" />
                </div>
              ) : servicesError ? (
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/60 text-sm sm:text-base font-poppins text-center">
                  <span className="flex items-center gap-2"><AlertCircle size={16} />Tretmani trenutno ne mogu da se učitaju.</span>
                  <button
                    type="button"
                    onClick={() => setServicesReloadKey((k) => k + 1)}
                    className="px-5 py-2 rounded-full text-sm font-semibold font-poppins bm-metal cursor-pointer"
                    style={{ backgroundColor: accent.hex }}
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : (
              /* Two columns from sm - the list is long enough that one column
                 wastes the horizontal room a desktop viewport gives us. */
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
              {pickableServices.map((service) => {
                const isSelected = selectedIds.includes(service.id);
                const isBlocked = fullBodySelected && !isSelected && !isAllowedWithFullBody(service.name);
                const Icon = getIcon(service.name);

                /* "Celo telo" gets the hero treatment: full width, always in the
                   accent colour and softly glowing so it reads as the best deal. */
                if (isFullBody(service.name)) {
                  return (
                    <div
                      key={service.id}
                      className="glow-halo relative sm:col-span-2 mt-2 sm:mt-2.5 rounded-2xl"
                      style={{ "--glow": accent.hex } as CSSProperties}
                    >
                      <span
                        className="absolute -top-2 sm:-top-2.5 left-4 sm:left-5 z-10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold font-poppins tracking-widest bm-metal"
                        style={{ backgroundColor: accent.hex }}
                      >
                        NAJISPLATIVIJE
                      </span>
                      <button
                        onClick={() => toggleService(service.id)}
                        className={`glow-card relative overflow-hidden flex items-center gap-3 sm:gap-4 w-full p-4 sm:p-5 rounded-2xl border-2 ${accent.border} ${isSelected ? accent.bgLight : "bg-transparent"} transition-all text-left cursor-pointer`}
                      >
                        <span className="shimmer-sweep" aria-hidden="true" />
                        <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${accent.bgMed}`}>
                          <Icon size={24} style={{ color: accent.hex }} className="sm:w-7 sm:h-7" />
                        </div>
                        <div className="relative flex-1 min-w-0">
                          <p className="text-base sm:text-lg font-bold font-poppins">{service.name}</p>
                          <span className="block text-[11px] sm:text-[13px] text-foreground/50 font-poppins leading-snug mt-0.5">
                            Sve regije u jednom tretmanu - najbolji odnos cene i rezultata
                          </span>
                          <span className="block text-sm sm:text-base font-bold font-poppins mt-1" style={{ color: accent.hex }}>
                            {formatPrice(service.price)} RSD
                          </span>
                        </div>
                        <div className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? `${accent.border} ${accent.bg}` : "border-foreground/20"}`}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent.onHex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    disabled={isBlocked}
                    className={`flex items-center gap-3 sm:gap-4 w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all text-left ${
                      isBlocked
                        ? "border-foreground/8 opacity-40 cursor-not-allowed"
                        : isSelected
                          ? `${accent.border} ${accent.bgLight} cursor-pointer`
                          : "border-foreground/8 hover:border-foreground/20 cursor-pointer"
                    }`}
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? accent.bgMed : "bg-foreground/5"}`}>
                      <Icon size={20} style={{ color: isSelected ? accent.hex : undefined }} className={`sm:w-6 sm:h-6 ${isSelected ? "" : "text-foreground/40"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-semibold font-poppins">{service.name}</p>
                      <span className="text-xs sm:text-sm text-foreground/40 font-poppins mt-0.5">
                        {formatPrice(service.price)} RSD
                      </span>
                    </div>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? `${accent.border} ${accent.bg}` : "border-foreground/20"}`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent.onHex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3.5 sm:h-3.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
              </div>
              )}
            </div>
          )}

          {/* ══ STEP "plan": Single vs Bundle ═══════════════════════════════ */}
          {step === "plan" && (
            <div className="flex flex-col gap-3 sm:gap-4 py-1 sm:py-2">
              {/* The "treba ti serija tretmana" argument now arrives as the
                  Ana notification (NOTICES.plan) instead of an inline banner. */}

              {/* Single session - first option, kept visually light so bundles still win */}
              <button
                type="button"
                onClick={handleSelectSingle}
                className="flex items-center justify-between gap-3 sm:gap-4 w-full px-3.5 py-3 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-foreground/8 hover:border-foreground/20 text-left cursor-pointer transition-all"
              >
                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                  <p className="text-sm sm:text-base md:text-lg font-bold font-poppins">Samo 1 tretman</p>
                  <span className="text-[11px] sm:text-[13px] font-poppins text-foreground/45 leading-snug">
                    Bez popusta
                  </span>
                </div>
                <p className="text-base sm:text-xl font-bold font-poppins leading-tight shrink-0 tabular-nums">
                  {formatPrice(totalPrice)}<span className="ml-1 text-[10px] sm:text-sm font-semibold">RSD</span>
                </p>
              </button>

              {/* Bundle options */}
              {eligibleSizes.map((size, idx) => {
                const b = computeBundle(effectiveServices, size);
                const isSelected = bundleActive && bundleSize === size;
                const isBest = idx === eligibleSizes.length - 1;
                return (
                  <motion.button
                    key={size}
                    type="button"
                    onClick={() => handleSelectBundle(size)}
                    whileTap="tap"
                    variants={{ tap: { scale: reduceMotion ? 1 : 0.985 } }}
                    /* transition-colors, not transition-all: a CSS transform
                       transition would fight framer's inline transforms. */
                    className={`relative flex items-center gap-2.5 sm:gap-4 w-full p-3 sm:p-4 rounded-2xl sm:rounded-3xl border-2 text-left cursor-pointer transition-colors ${
                      isSelected
                        ? `${accent.border} ${accent.bgLight}`
                        : "border-foreground/8 hover:border-foreground/20"
                    }`}
                  >
                    {isBest && (
                      <span
                        className="absolute -top-2.5 sm:-top-3 left-4 sm:left-5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold font-poppins tracking-widest bm-metal"
                        style={{ backgroundColor: accent.hex }}
                      >
                        NAJVEĆA UŠTEDA
                      </span>
                    )}
                    {BUNDLE_IMAGES[size] && (
                      /* Tilt-in, dealt one by one; the best-value package lands
                         last with extra overshoot so the eye ends on it. */
                      <motion.div
                        className="relative shrink-0 w-14 h-14 sm:w-[104px] sm:h-[104px]"
                        style={{ transformPerspective: 600 }}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -28, rotateX: 10, scale: 0.85 }}
                        animate={{ opacity: 1, rotateY: 0, rotateX: 0, scale: 1 }}
                        transition={
                          reduceMotion
                            ? { duration: 0.25 }
                            : {
                                type: "spring",
                                stiffness: isBest ? 240 : 300,
                                damping: isBest ? 13 : 22,
                                delay: 0.1 + idx * 0.08,
                                opacity: { duration: 0.2, delay: 0.1 + idx * 0.08 },
                              }
                        }
                      >
                        {/* Pops on press - inherits "tap" from the card. */}
                        <motion.div
                          className="relative w-full h-full"
                          variants={{ tap: { scale: reduceMotion ? 1 : 1.1 } }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          {/* scale-110 trims the whitespace baked into the source art */}
                          <div className="relative w-full h-full scale-110">
                            <Image
                              src={BUNDLE_IMAGES[size]}
                              alt={`Paket ${size} tretmana`}
                              fill
                              sizes="(max-width: 640px) 56px, 104px"
                              className="rounded-xl object-contain"
                            />
                            {isBest && (
                              <span
                                className="bm-shine"
                                aria-hidden="true"
                                style={{
                                  "--shine-mask": `url(${BUNDLE_IMAGES[size]})`,
                                  "--shine-delay": `${0.5 + idx * 0.08}s`,
                                } as CSSProperties}
                              />
                            )}
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                    {/* Two aligned rows (name | price, savings | list price) so
                        nothing wraps on a 360px screen. */}
                    <div className="flex flex-col gap-1 sm:gap-2 flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm sm:text-base md:text-lg font-bold font-poppins truncate">Paket {size} tretmana</p>
                        <p className="text-base sm:text-xl font-bold font-poppins leading-tight shrink-0 tabular-nums" style={{ color: accent.hex }}>
                          {formatPrice(b.finalTotal)}<span className="ml-1 text-[10px] sm:text-sm font-semibold">RSD</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold font-poppins bm-metal shrink-0"
                            style={{ backgroundColor: accent.hex }}
                          >
                            −{b.blendedPct}%
                          </span>
                          <span className="text-[11px] sm:text-sm font-semibold font-poppins text-emerald-300 truncate">
                            Ušteda {formatPrice(b.savings)}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-[13px] text-foreground/35 font-poppins line-through shrink-0 tabular-nums">
                          {formatPrice(b.originalTotal)}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}

              {bundleActive && (
                <p className="text-xs sm:text-sm font-poppins text-foreground/50 leading-snug px-1 mt-1 sm:mt-2">
                  {PAYMENT_TERMS}
                </p>
              )}
            </div>
          )}

          {/* ══ STEP 3: Date only ══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/40 font-poppins mb-1">IZABERI DAN</p>
              {loadingBookableDays ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={22} className="animate-spin text-foreground/30" />
                </div>
              ) : bookableDayOptions.length === 0 ? (
                <div className="flex items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/50 text-sm sm:text-base font-poppins">
                  <AlertCircle size={16} />
                  Nema dana u kalendaru kada se izabrani tretman uklapa.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {bookableDayOptions.map((day) => {
                    const isSelected = selectedDate === day.date;
                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDaySelect(day.date)}
                        className={`relative flex flex-col items-start p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? `${accent.border} ${accent.bgLight}`
                            : "border-foreground/8 hover:border-foreground/20"
                        }`}
                      >
                        {day.isToday && (
                          <span
                            className="absolute top-2 right-2 sm:top-3 sm:right-3 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold font-poppins bm-metal"
                            style={{ backgroundColor: accent.hex }}
                          >
                            DANAS
                          </span>
                        )}
                        <p
                          className="text-sm sm:text-base md:text-lg font-bold font-poppins leading-tight"
                          style={isSelected ? { color: accent.hex } : undefined}
                        >
                          {day.label}
                        </p>
                        <p className="text-xs sm:text-sm text-foreground/50 font-poppins mt-0.5">{day.shortDate}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 4: Time only ══════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/40 font-poppins mb-1">SLOBODNI TERMINI</p>
              {slotTaken && (
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-400/10 border border-amber-400/40 text-amber-200 text-sm sm:text-base font-poppins">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  Izabrani termin je upravo zauzet. Izaberi drugo vreme - tvoji podaci su sačuvani.
                </div>
              )}
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={22} className="animate-spin text-foreground/30" />
                </div>
              ) : slotsError ? (
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/60 text-sm sm:text-base font-poppins text-center">
                  <span className="flex items-center gap-2"><AlertCircle size={16} />Termini trenutno ne mogu da se učitaju.</span>
                  <button
                    type="button"
                    onClick={() => setSlotsReloadKey((k) => k + 1)}
                    className="px-5 py-2 rounded-full text-sm font-semibold font-poppins bm-metal cursor-pointer"
                    style={{ backgroundColor: accent.hex }}
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/50 text-sm sm:text-base font-poppins">
                  <AlertCircle size={16} />
                  Nema slobodnih termina za ovaj datum.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2.5">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleTimeSelect(slot)}
                      className="py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold font-poppins transition-all cursor-pointer"
                      style={
                        selectedTime === slot
                          ? { backgroundColor: accent.hex, color: accent.onHex }
                          : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }
                      }
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* ══ STEP 5: Vaši podaci only ══════════════════════════════════════════════ */}
          {step === 5 && (
            // Personal + health data: always masked in Clarity recordings.
            <div className="flex flex-col gap-4 sm:gap-6" data-clarity-mask="true">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/40 font-poppins mb-1">VAŠI PODACI</p>

              <div>
                <label className="block text-xs sm:text-sm text-foreground/50 font-poppins mb-1 sm:mb-1.5">Ime i prezime *</label>
                <input
                  type="text"
                  placeholder="Ana Marković"
                  value={form.name}
                  onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFieldErrors((p) => ({ ...p, name: false })); }}
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 focus:outline-none font-poppins text-sm sm:text-base transition-colors ${fieldErrors.name ? "border-red-400/70 bg-red-500/10" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.name) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => { e.target.style.borderColor = ""; }}
                />
                {fieldErrors.name && <p className="text-xs text-red-400 font-poppins mt-1">Unesite ime i prezime.</p>}
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-foreground/50 font-poppins mb-1 sm:mb-1.5">Email *</label>
                <input
                  type="email"
                  placeholder="ana@primer.rs"
                  value={form.email}
                  onChange={(e) => {
                    emailCheckSeqRef.current += 1;
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setFieldErrors((p) => ({ ...p, email: false }));
                    setIsReturningCustomer(null);
                    // Student & bundle codes were verified against the old email.
                    if (promoKind !== "none" || promoStatus === "invalid") {
                      setPromoStatus("idle");
                      setAppliedPromoCode(null);
                      setPromoKind("none");
                      setPromoErrorMsg(null);
                    }
                  }}
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 focus:outline-none font-poppins text-sm sm:text-base transition-colors ${fieldErrors.email ? "border-red-400/70 bg-red-500/10" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.email) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "";
                    void runReturningEmailCheck(e.target.value);
                  }}
                />
                {fieldErrors.email && <p className="text-xs text-red-400 font-poppins mt-1">Unesite ispravnu email adresu.</p>}
                {checkingReturningEmail && (
                  <p className="text-xs text-foreground/45 font-poppins mt-1.5">Proveravamo istoriju zakazivanja…</p>
                )}
                {!checkingReturningEmail && isReturningCustomer === true && (
                  <p className="text-xs text-foreground/55 font-poppins mt-1.5">
                    😊 Drago nam je što ste opet kod nas.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-foreground/50 font-poppins mb-1 sm:mb-1.5">Telefon *</label>
                <input
                  type="tel"
                  placeholder="065 373 8991"
                  value={form.phone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, phone: e.target.value }));
                    setFieldErrors((p) => ({ ...p, phone: false }));
                  }}
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 focus:outline-none font-poppins text-sm sm:text-base transition-colors ${fieldErrors.phone ? "border-red-400/70 bg-red-500/10" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.phone) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => { e.target.style.borderColor = ""; }}
                />
                {fieldErrors.phone && <p className="text-xs text-red-400 font-poppins mt-1">Unesite ispravan broj telefona.</p>}
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-foreground/50 font-poppins mb-1 sm:mb-1.5">Zdravstvena napomena <span className="text-foreground/35">(opcionalno)</span></label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Hronične bolesti, alergije ili lekovi"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm sm:text-base transition-colors resize-none"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              {/* Promo / bundle code - hidden while buying a bundle (mutually exclusive) */}
              {!bundleActive && (
                <div>
                  <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PROMO ILI KOD PAKETA</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Unesi kod"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        setPromoStatus("idle");
                        setAppliedPromoCode(null);
                        setPromoKind("none");
                        setPromoErrorMsg(null);
                      }}
                      disabled={checkingReturningEmail || checkingPromo}
                      className="flex-1 min-w-0 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm sm:text-base transition-colors disabled:opacity-60"
                      onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                      onBlur={(e) => (e.target.style.borderColor = "")}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={!promoCode.trim() || checkingReturningEmail || checkingPromo}
                      className="shrink-0 px-4 sm:px-7 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold tracking-wide font-poppins bm-metal transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: accent.hex }}
                    >
                      {checkingPromo ? "…" : "Primeni"}
                    </button>
                  </div>
                  {promoStatus === "valid" && redeemActive && (
                    <p className="text-xs text-emerald-400 font-poppins mt-2">
                      Paket potvrđen - ovaj tretman je već plaćen. Cena: 0 RSD.
                    </p>
                  )}
                  {/* Deliberately amber, not green: the discount is conditional and
                      the condition is the whole point of the message. */}
                  {studentActive && (
                    <div className="flex items-start gap-2.5 mt-2 p-3 sm:p-3.5 rounded-xl bg-amber-400/10 border-2 border-amber-400/50">
                      <AlertCircle size={18} className="text-amber-400 shrink-0 mt-px" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold font-poppins text-amber-200">
                          Studentski popust −20% primenjen
                        </p>
                        <p className="text-[11px] sm:text-xs font-poppins text-amber-300 leading-snug mt-0.5">
                          Obavezno ponesi indeks na tretman. Bez indeksa popust ne važi i plaćaš punu cenu.
                        </p>
                      </div>
                    </div>
                  )}
                  {promoStatus === "invalid" && (
                    <p className="text-xs text-red-400 font-poppins mt-2">
                      {promoErrorMsg ?? "Nevažeći promo kod."}
                    </p>
                  )}
                  {/* Discovery for anyone who never saw the ad. One tap fills the code. */}
                  {promoKind === "none" && isReturningCustomer !== true && (
                    <button
                      type="button"
                      onClick={() => { setPromoCode(STUDENT_PROMO_CODE); setPromoStatus("idle"); setPromoErrorMsg(null); }}
                      className="text-[11px] sm:text-xs font-poppins text-foreground/45 hover:text-foreground/70 underline underline-offset-2 mt-2 cursor-pointer transition-colors"
                    >
                      Student? Iskoristi −20% na prvi tretman
                    </button>
                  )}
                </div>
              )}

              {/* Price summary with savings */}
              {selectedIds.length > 0 && (
                <div className="rounded-2xl sm:rounded-3xl bg-foreground/4 p-4 sm:p-6">
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2 sm:mb-3">PREGLED CENE</p>
                  {/* Selected regions */}
                  <div className="mb-3">
                    {effectiveServices.map((s) => (
                      <div key={s.id} className="flex justify-between items-center py-0.5">
                        <span className="text-xs sm:text-sm font-poppins text-foreground/60">{s.name}</span>
                        <span className="text-xs sm:text-sm font-poppins text-foreground/40">{formatPrice(s.price)} RSD</span>
                      </div>
                    ))}
                    {bundleActive && (
                      <div className="flex justify-between items-center py-0.5 mt-1">
                        <span className="text-xs sm:text-sm font-poppins text-foreground/60 font-semibold">Paket - {bundleSize} tretmana</span>
                        <span className="text-xs sm:text-sm font-poppins text-foreground/40">× {bundleSize}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-foreground/10 pt-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm sm:text-base font-poppins text-foreground/50">
                        {bundleActive ? `Redovna cena (${bundleSize}×)` : "Redovna cena"}
                      </span>
                      <span className={`text-sm sm:text-base font-poppins font-semibold ${bundleActive || redeemActive || studentActive ? "text-foreground/40 line-through" : "font-bold text-foreground"}`}>
                        {formatPrice(listTotal)} RSD
                      </span>
                    </div>
                    {studentActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm sm:text-base font-poppins text-emerald-300 font-semibold">Studentski popust (−20%)</span>
                        <span className="text-sm sm:text-base font-poppins font-bold text-emerald-300">{formatPrice(finalPrice)} RSD</span>
                      </div>
                    )}
                    {bundleActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm sm:text-base font-poppins text-emerald-300 font-semibold">Cena paketa (−{bundleResult!.blendedPct}%)</span>
                        <span className="text-sm sm:text-base font-poppins font-bold text-emerald-300">{formatPrice(finalPrice)} RSD</span>
                      </div>
                    )}
                    {redeemActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm sm:text-base font-poppins text-emerald-300 font-semibold">Plaćeno u paketu</span>
                        <span className="text-sm sm:text-base font-poppins font-bold text-emerald-300">0 RSD</span>
                      </div>
                    )}
                    {savingsVsList > 0 && (
                      <div className="flex justify-between items-center mt-1 pt-2 border-t border-foreground/8">
                        <span className="text-xs sm:text-sm font-poppins text-foreground/40">Ušteda</span>
                        <span className="text-xs sm:text-sm font-poppins font-semibold" style={{ color: accent.hex }}>{formatPrice(savingsVsList)} RSD</span>
                      </div>
                    )}
                    {studentActive && (
                      <p className="text-[11px] sm:text-[13px] font-poppins text-amber-300 font-semibold leading-snug mt-2.5 pt-2.5 border-t border-foreground/8">
                        Ova cena važi uz indeks. Bez njega se naplaćuje {formatPrice(listTotal)} RSD.
                      </p>
                    )}
                    {bundleActive && (
                      <p className="text-[11px] sm:text-[13px] font-poppins text-foreground/45 leading-snug mt-2.5 pt-2.5 border-t border-foreground/8">
                        {PAYMENT_TERMS}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation policy - explicit consent, required before booking */}
              <div>
                <label
                  className={`flex gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 cursor-pointer transition-colors ${
                    fieldErrors.policy ? "border-red-400/70 bg-red-500/10" : "border-foreground/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedPolicy}
                    onChange={(e) => {
                      setAcceptedPolicy(e.target.checked);
                      setFieldErrors((p) => ({ ...p, policy: false }));
                    }}
                    className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 shrink-0 cursor-pointer"
                    style={{ accentColor: accent.hex }}
                  />
                  <span className="flex-1 text-xs sm:text-sm md:text-base font-semibold text-foreground/80 font-poppins leading-relaxed">
                    Prihvatam uslove otkazivanja.
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPolicyInfo(true); }}
                    className="shrink-0 mt-0.5 text-foreground/35 hover:text-foreground/60 transition-colors cursor-pointer"
                    aria-label="Prikaži uslove otkazivanja"
                  >
                    <Info size={16} className="sm:w-5 sm:h-5" />
                  </button>
                </label>
                {fieldErrors.policy && (
                  <p className="text-xs text-red-400 font-poppins mt-1">Potrebno je prihvatiti uslove otkazivanja.</p>
                )}
              </div>

              {/* Cancellation policy - large-text modal, opened via the info icon above */}
              {showPolicyInfo && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                  onClick={() => setShowPolicyInfo(false)}
                >
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative bg-[var(--bm-surface)] border border-foreground/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="text-xl font-bold font-playfair">Uslovi otkazivanja</h3>
                      <button
                        type="button"
                        onClick={() => setShowPolicyInfo(false)}
                        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
                        aria-label="Zatvori"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-base font-poppins text-foreground/75 leading-relaxed">
                      Termin mogu besplatno da otkažem ili pomerim najkasnije 24 sata pre tretmana.
                      Ako otkažem u poslednja 24 sata <span className="font-semibold text-foreground/90">bez opravdanog razloga</span> ili
                      se ne pojavim, naplaćuje se 50% cene tretmana pri sledećem zakazivanju.
                    </p>
                    <p className="text-sm font-poppins text-foreground/50 leading-snug mt-4">
                      Bolest, povreda ili hitan slučaj se ne naplaćuju - samo nas obavestite i naći ćemo novi termin.
                    </p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-red-500/10 text-red-300 text-sm sm:text-base font-poppins">
                  <AlertCircle size={15} />
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* ══ SUCCESS ════════════════════════════════════════════════════ */}
          {step === "success" && (
            <div className="flex flex-col items-center text-center py-4 sm:py-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-400/10 flex items-center justify-center mb-5 sm:mb-6">
                <CheckCircle2 size={44} className="text-emerald-400 sm:w-13 sm:h-13" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair mb-2 sm:mb-3">Termin zakazan! Čekamo Vas u Miloja Čiplića 51 u Novom Sadu</h3>
              <p className="text-sm sm:text-base text-foreground/50 font-poppins mb-6 sm:mb-8">Potvrda je poslata na {form.email}</p>

              {/* ── Stats banner: duration + animated price ── */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4 sm:mb-6">
                {/* Duration tile */}
                <div className="flex flex-col items-center justify-center bg-foreground/5 rounded-2xl sm:rounded-3xl py-4 sm:py-7 px-3">
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1 sm:mb-2">TRAJANJE</p>
                  <p className="text-3xl sm:text-5xl font-bold font-poppins leading-none">{reservationDuration}</p>
                  <p className="text-xs sm:text-sm text-foreground/40 font-poppins mt-1 sm:mt-2">min</p>
                </div>

                {/* Price tile */}
                <div
                  className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl py-4 sm:py-7 px-3 relative overflow-hidden"
                  style={{ backgroundColor: `${accent.hex}12` }}
                >
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1 sm:mb-2">CENA</p>

                  {(bundleActive || redeemActive || studentActive) && (
                    <p className="text-xs sm:text-sm text-foreground/35 font-poppins line-through leading-none mb-0.5">
                      {formatPrice(listTotal)} RSD
                    </p>
                  )}
                  <p className="text-3xl sm:text-5xl font-bold font-poppins leading-none tabular-nums" style={{ color: accent.hex }}>
                    {formatPrice(displayedPrice)}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold font-poppins mt-1 sm:mt-2" style={{ color: accent.hex }}>RSD</p>
                  {bundleActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-green-500">
                      PAKET {bundleSize}× · −{bundleResult!.blendedPct}%
                    </span>
                  ) : redeemActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-green-500">
                      PLAĆENO U PAKETU
                    </span>
                  ) : studentActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-amber-500">
                      STUDENT −20% · UZ INDEKS
                    </span>
                  ) : (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-foreground/70 bg-foreground/10">
                      Redovna cena
                    </span>
                  )}
                </div>
              </div>

              {/* ── Detailed summary card ── */}
              <div className="w-full bg-foreground/4 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-left space-y-3 sm:space-y-4">
                {[
                  ["Datum", selectedDate ? formatDateFull(selectedDate) : ""],
                  ["Vreme", `${selectedTime} – ${minutesToTime(timeToMinutes(selectedTime) + reservationDuration)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm sm:text-base font-poppins">
                    <span className="text-foreground/50">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
                {studentActive && (
                  <div className="flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl bg-amber-400/10 border-2 border-amber-400/50">
                    <AlertCircle size={18} className="text-amber-400 shrink-0 mt-px" />
                    <p className="text-[11px] sm:text-xs font-poppins text-amber-200 font-semibold leading-snug">
                      Ne zaboravi indeks! Bez njega studentski popust ne važi i naplaćuje se puna cena od {formatPrice(listTotal)} RSD.
                    </p>
                  </div>
                )}
                <div className="border-t border-foreground/10 pt-3">
                  <p className="text-xs sm:text-sm text-foreground/40 font-poppins mb-1.5 sm:mb-2">USLUGE</p>
                  {!isReturningCustomer && (
                    <p className="text-sm sm:text-base font-poppins font-semibold text-foreground/50">Konsultacija (10 min)</p>
                  )}
                  {effectiveServices.map((s) => (
                    <p key={s.id} className="text-sm sm:text-base font-poppins font-semibold">{s.name}</p>
                  ))}
                </div>
                {bookingRef && (
                  <div className="border-t border-foreground/10 pt-3">
                    <p className="text-xs sm:text-sm text-foreground/40 font-poppins mb-1">REF. BROJ</p>
                    <p className="text-sm sm:text-lg font-mono font-bold tracking-wider" style={{ color: accent.hex }}>
                      #{bookingRef}
                    </p>
                  </div>
                )}
              </div>

              {/* Bundle - remaining pre-paid sessions; the code is handed over in person at the first treatment */}
              {bundleActive && bundleResult && (
                <div className="w-full mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-left border-2" style={{ borderColor: `${accent.hex}33`, backgroundColor: `${accent.hex}0A` }}>
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1 sm:mb-2">PAKET OD {bundleSize} TRETMANA</p>
                  <p className="text-xs sm:text-sm md:text-base font-poppins text-foreground/55 leading-snug">
                    Na prvom tretmanu dobićete kod paketa kojim ćete zakazati preostalih {bundleSize! - 1} {bundleSize! - 1 === 1 ? "tretman" : "tretmana"} - ti termini su već plaćeni.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ PREPARATION ═══════════════════════════════════════════════ */}
          {step === "preparation" && (
            <div className="flex flex-col gap-6 sm:gap-8 py-2 sm:py-4">
              {[
                { num: "01", text: "Pre prvog tretmana mora proći minimum mesec dana od poslednjeg čupanja dlačica bilo koje vrste." },
                { num: "02", text: "Dlačice uklanjati isključivo brijačem ili kremom za depilaciju - nikako čupanjem." },
                { num: "03", text: "Dan pre dolaska na tretman obrijati dlačice ili ih ukloniti depilacijskom kremom." },
                { num: "04", text: "Na dan tretmana na kožu ne nanositi nikakve preparate (kreme, ulja, dezodorans)." },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-5 sm:gap-7">
                  <span className="font-playfair text-3xl sm:text-5xl leading-none shrink-0 w-10 sm:w-16 text-right" style={{ color: `${accent.hex}99` }}>
                    {step.num}
                  </span>
                  <div className="border-l-2 pl-5 sm:pl-7 py-0.5 sm:py-1" style={{ borderColor: `${accent.hex}4D` }}>
                    <p className="font-poppins text-sm sm:text-base md:text-lg text-foreground/60 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* ── Sticky footer: primary CTA always visible while scrolling ───────── */}
          {(step === 2 || step === 3 || step === 4 || step === 5 || step === "success" || step === "preparation") && (
            <div className="shrink-0 sm:border-t sm:border-foreground/10 bg-[var(--bm-bg)]/90 backdrop-blur-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-5 sm:pb-5 shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.6)]">
              <div className={COL_W}>
              {step === 2 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col items-center text-center">
                    {selectedIds.length > 0 ? (
                      <>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="text-base sm:text-xl font-bold font-poppins leading-none" style={{ color: accent.hex }}>{formatPrice(totalPrice)} RSD</span>
                          <span className="text-[10px] sm:text-xs text-foreground/40 font-poppins">· {slotDuration} min</span>
                        </div>
                        {appliedCombos.length > 0 && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] font-bold font-poppins bm-metal" style={{ backgroundColor: accent.hex }}>COMBO</span>
                            <span className="text-[10px] sm:text-xs font-poppins text-foreground/40">paket popust uračunat</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-foreground/45 font-poppins">Odaberite bar jednu uslugu za nastavak.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={selectedIds.length === 0}
                    className={`${selectedIds.length > 0 ? "glow-halo" : ""} relative w-full py-3.5 sm:py-4.5 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins bm-metal active:scale-95 transition-transform cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: accent.hex, "--glow": accent.hex } as CSSProperties}
                  >
                    NASTAVI
                  </button>
                </div>
              )}

              {step === 3 && (
                <p className="text-center text-[10px] sm:text-sm font-poppins text-foreground/45">
                  <span className="mr-1.5" style={{ color: accent.hex }}>{proof.mark}</span>{proof.line}
                </p>
              )}

              {step === 4 && (
                <p className="text-center text-[10px] sm:text-sm font-poppins text-foreground/40">Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.</p>
              )}

              {step === 5 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 sm:py-4.5 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins bm-metal transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accent.hex }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin sm:w-5 sm:h-5" />
                      Zakazivanje...
                    </span>
                  ) : "POTVRDI TERMIN"}
                </button>
              )}

              {step === "success" && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("preparation")}
                    className="w-full py-3 sm:py-4 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins border-2 cursor-pointer transition-all hover:opacity-80"
                    style={{ borderColor: accent.hex, color: accent.hex }}
                  >
                    ŠTA TREBA DA URADIM PRE TERMINA
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3 sm:py-4 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins bm-metal cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: accent.hex }}
                  >
                    ZATVORI
                  </button>
                </div>
              )}

              {step === "preparation" && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3.5 sm:py-4.5 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins bm-metal cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent.hex }}
                >
                  ZATVORI
                </button>
              )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom accent bar - desktop only; on phones it read as a stray border
            against the home indicator. */}
        <div className="hidden sm:block h-1 bm-metal shrink-0" />
      </div>
    </div>
  );
}
