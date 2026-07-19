"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X, ScanFace, Hand, Footprints,
  Flower2, Minus, Target, Shirt, ArrowLeft,
  PersonStanding, Loader2, CheckCircle2, AlertCircle,
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

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedNames?: string[];
  /** Pre-select a bundle size when the modal opens (used by landing-page examples). */
  preselectedBundle?: number;
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
 * the effective business windows (ignores existing reservations — use after a
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

/** Promo codes: `ils-` + any non-empty suffix (e.g. ils-leyla). Case-insensitive. */
function isIlsPromoCode(raw: string): boolean {
  return /^ils-.+$/i.test(raw.trim());
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
// added alongside it — every other region is already covered by "Celo telo".
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
const ACCENTS = {
  zene: {
    hex: "#E85D8A",
    border: "border-pink",
    bg: "bg-pink",
    bgLight: "bg-pink/8",
    bgMed: "bg-pink/25",
  },
  muskarci: {
    hex: "#0D9488",
    border: "border-teal",
    bg: "bg-teal",
    bgLight: "bg-teal/8",
    bgMed: "bg-teal/25",
  },
} as const;

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
  "Plati ceo iznos paketa na prvom tretmanu i rezerviši sve preostale termine uz zagarantovanu dostupnost.";

// ═════════════════════════════════════════════════════════════════════════════
export default function BookingModal({ isOpen, onClose, preselectedNames, preselectedBundle }: BookingModalProps) {
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
  const [daySlots, setDaySlots]           = useState<{ start_time: string; end_time: string; status: string }[]>([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [form, setForm]                   = useState({ name: "", email: "", phone: "" });
  const [customerNote, setCustomerNote]   = useState("");
  const [fieldErrors, setFieldErrors]     = useState({ name: false, email: false, phone: false, policy: false });
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [bookingRef, setBookingRef]       = useState<string | null>(null);
  const [promoCode, setPromoCode]               = useState("");
  const [promoStatus, setPromoStatus]           = useState<"idle" | "valid" | "invalid">("idle");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  /** "ils" = −10% promo, "bundle_redeem" = pre-paid bundle session (price 0). */
  const [promoKind, setPromoKind]               = useState<"none" | "ils" | "bundle_redeem">("none");
  const [checkingPromo, setCheckingPromo]       = useState(false);

  // Step "plan" state
  const [bookingMode, setBookingMode] = useState<BookingMode>("single");
  const [bundleSize, setBundleSize]   = useState<number | null>(null);
  const [displayedPrice, setDisplayedPrice]   = useState(0);
  const animFrameRef = useRef<number>(0);
  const appliedPreselect = useRef(false);
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
  /** Whole body is selected — lock out every region except earrings, chin & whole face. */
  const fullBodySelected = selectedServices.some((s) => isFullBody(s.name));
  const { effective: effectiveServices, appliedCombos } = applyComboRules(selectedServices, services);
  /** With 10 min consultation — used for day/slot picking so first-time bookings always fit. */
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

  // ── Bundle ("Napravi svoj paket") ───────────────────────────────────────────
  const eligibleSizes = eligibleBundleSizes(effectiveServices);
  const bundleResult: BundleResult | null =
    bundleSize != null && eligibleSizes.includes(bundleSize) && effectiveServices.length > 0
      ? computeBundle(effectiveServices, bundleSize)
      : null;
  const bundleActive = bookingMode === "bundle" && bundleResult != null;

  // ── Discounts (mutually exclusive: bundle > redeem > ils) ────────────────────
  const ilsPromoActive =
    !bundleActive && promoKind === "ils" && promoStatus === "valid" &&
    appliedPromoCode != null && isIlsPromoCode(appliedPromoCode);
  const redeemActive =
    !bundleActive && promoKind === "bundle_redeem" && promoStatus === "valid" &&
    appliedPromoCode != null;

  const listTotal = bundleActive ? bundleResult!.originalTotal : totalPrice;
  const finalPrice = bundleActive
    ? bundleResult!.finalTotal
    : redeemActive
      ? 0
      : ilsPromoActive
        ? Math.round(totalPrice * 0.9)
        : totalPrice;
  const savingsVsList = listTotal - finalPrice;

  // For today: slots must start ≥ now+120min
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const isToday =
    bookableDayOptions.find((d) => d.date === selectedDate)?.isToday ?? false;
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
      (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.("track", "ViewContent");
    } else {
      setIsAnimating(false);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Load the working-hours schedule once per open — one query for the whole horizon.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchAvailability()
      .then((data) => { if (!cancelled) setAvailability(data); })
      .catch(() => { if (!cancelled) setAvailability(EMPTY_AVAILABILITY); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Preselected treatments are women's regions — open straight into her list,
  // skipping the gender choice. Plain opens start on Step 1 (gender).
  useEffect(() => {
    if (isOpen && preselectedNames && preselectedNames.length > 0) {
      setGender("zene");
      setStep(2);
    }
  }, [isOpen, preselectedNames]);

  useEffect(() => {
    if (!gender) return;
    setLoadingServices(true);
    supabase
      .from("services")
      .select("*")
      .eq("gender", gender)
      .order("sort_order")
      .then(({ data }) => { setServices(data ?? []); setLoadingServices(false); });
  }, [gender]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, finalPrice, listTotal]);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedTime("");
    supabase
      .from("reservations")
      .select("start_time, end_time, status")
      .eq("date", selectedDate)
      .then(({ data }) => { setDaySlots(data ?? []); setLoadingSlots(false); });
  }, [selectedDate]);

  // Step 3: load reservations for all candidate days, hide dates with no free slot
  useEffect(() => {
    if (!isOpen || step !== 3 || slotDuration <= 0) {
      setLoadingBookableDays(false);
      return;
    }
    if (!availability) {
      // Schedule still loading — keep the spinner until it arrives.
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
          .from("reservations")
          .select("date, start_time, end_time, status")
          .in("date", dates);
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

  // Note: if the region selection changes so the chosen bundle size is no longer
  // eligible (e.g. an all-face basket gains a body region, dropping the 10-pack),
  // `bundleResult` becomes null and `bundleActive` is false — the flow falls back
  // to single-session pricing automatically, no state reset needed.

  // ── Handlers ──────────────────────────────────────────────────────────────
  function resetAll() {
    bookableDaysFetchIdRef.current += 1;
    setBookableDayOptions([]);
    setLoadingBookableDays(false);
    setStep(1); setGender(null); setSelectedIds([]);
    setSelectedDate(""); setSelectedTime(""); setDaySlots([]);
    setForm({ name: "", email: "", phone: "" });
    setCustomerNote("");
    setFieldErrors({ name: false, email: false, phone: false, policy: false });
    setAcceptedPolicy(false);
    setSubmitError(null); setBookingRef(null);
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null);
    setPromoKind("none"); setCheckingPromo(false);
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
    if (step === 2) { setStep(1); setGender(null); setSelectedIds([]); }
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
  }

  function toggleService(id: string) {
    const svc = services.find((s) => s.id === id);
    // Block adding regions that are already covered by a selected "Celo telo".
    if (svc && fullBodySelected && !selectedIds.includes(id) && !isAllowedWithFullBody(svc.name)) {
      return;
    }
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function handleDaySelect(date: string) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedTime("");
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
    const { data, error } = await supabase
      .from("reservations")
      .select("id")
      .ilike("customer_email", trimmed)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    if (emailCheckSeqRef.current !== seq) return;
    setCheckingReturningEmail(false);
    if (error) {
      setIsReturningCustomer(false);
      return;
    }
    setIsReturningCustomer(!!data);
  }

  async function handleApplyPromo() {
    const raw = promoCode.trim();
    if (!raw) {
      setPromoStatus("idle");
      setAppliedPromoCode(null);
      setPromoKind("none");
      return;
    }

    // −10% ils- promo
    if (isIlsPromoCode(raw)) {
      setPromoStatus("valid");
      setAppliedPromoCode(raw);
      setPromoKind("ils");
      return;
    }

    // Bundle code — redeeming a pre-paid follow-up session (price 0).
    const bundle = parseBundlePromo(raw);
    if (bundle && !bundle.redeem) {
      const email = form.email.trim();
      if (!EMAIL_REGEX.test(email)) {
        setPromoStatus("invalid");
        setAppliedPromoCode(null);
        setPromoKind("none");
        return;
      }
      setCheckingPromo(true);
      // Verify a matching bundle purchase exists for this email before granting it.
      const { data, error } = await supabase
        .from("reservations")
        .select("id")
        .ilike("customer_email", email)
        .eq("promo_code", raw)
        .eq("status", "confirmed")
        .limit(1)
        .maybeSingle();
      setCheckingPromo(false);
      if (!error && data) {
        setPromoStatus("valid");
        setAppliedPromoCode(raw);
        setPromoKind("bundle_redeem");
      } else {
        setPromoStatus("invalid");
        setAppliedPromoCode(null);
        setPromoKind("none");
      }
      return;
    }

    setPromoStatus("invalid");
    setAppliedPromoCode(null);
    setPromoKind("none");
  }

  async function handleSubmit() {
    // Validate – highlight empty required fields instead of blocking silently
    const errors = {
      name: !form.name.trim(),
      email: !form.email.trim(),
      phone: !form.phone.trim(),
      policy: !acceptedPolicy,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.phone || errors.policy || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    setSubmitError(null);

    const emailTrim = form.email.trim();
    const { data: existingReservation } = await supabase
      .from("reservations")
      .select("id")
      .ilike("customer_email", emailTrim)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    const returningSubmit = !!existingReservation;

    // Resolve the recorded promo code, prices and admin note for this booking.
    let promoForRecord: string | null = null;
    let notesForRecord: string | null = null;
    if (bundleActive) {
      promoForRecord = bundlePurchaseCode(bundleSize!, bundleResult!.finalTotal);
      notesForRecord =
        `Paket ${bundleSize}× — ukupno ${formatPrice(bundleResult!.finalTotal)} RSD ` +
        `(ušteda ${formatPrice(bundleResult!.savings)} RSD)`;
    } else if (redeemActive) {
      promoForRecord = bundleRedeemCode(appliedPromoCode!);
      notesForRecord = `Iskorišćen tretman iz paketa ${appliedPromoCode}`;
    } else if (ilsPromoActive) {
      promoForRecord = appliedPromoCode;
    }
    const listForSubmit  = listTotal;
    const finalForSubmit = finalPrice;

    const durationForReservation = returningSubmit
      ? calcTotalDuration(selectedServices)
      : calcBookingDuration(selectedServices);
    const endTime = minutesToTime(timeToMinutes(selectedTime) + durationForReservation);

    const { data: res, error } = await supabase
      .from("reservations")
      .insert({
        customer_name:  form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim() || null,
        customer_note:  customerNote.trim() || null,
        notes:          notesForRecord,
        date:           selectedDate,
        start_time:     `${selectedTime}:00`,
        end_time:       `${endTime}:00`,
        total_duration: durationForReservation,
        status:         "confirmed",
        promo_code:     promoForRecord,
      })
      .select()
      .single();

    if (error || !res) {
      setSubmitError("Greška pri zakazivanju. Pokušajte ponovo.");
      setSubmitting(false);
      return;
    }

    if (selectedIds.length > 0) {
      await supabase.from("reservation_services").insert(
        selectedIds.map((id) => ({ reservation_id: res.id, service_id: id }))
      );
    }

    const bookingRefValue = res.id.slice(-8).toUpperCase();
    setBookingRef(bookingRefValue);

    fetch("/api/booking-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name:    form.name.trim(),
        customer_email:   form.email.trim(),
        customer_phone:   form.phone.trim() || null,
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
        booking_ref:      bookingRefValue,
      }),
    }).catch(() => {});

    setIsReturningCustomer(returningSubmit);

    const usdValue = +(finalForSubmit / 102).toFixed(2);
    const eventId = crypto.randomUUID();

    // Browser Pixel — include eventID for deduplication with CAPI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fbq?.("track", "Purchase", {
      value: usdValue,
      currency: "USD",
    }, { eventID: eventId });

    // Server-side CAPI — mirrors the Pixel event
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: eventId,
        event_source_url: window.location.href,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        value: usdValue,
        currency: "USD",
        fbclid: fbclidRef.current || undefined,
      }),
    }).catch(() => {});

    setStep("success");
    setSubmitting(false);
  }

  function handleAddToCart() {
    const eventId = crypto.randomUUID();
    (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.("track", "AddToCart", {}, { eventID: eventId });
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "AddToCart",
        event_id: eventId,
        event_source_url: window.location.href,
        fbclid: fbclidRef.current || undefined,
      }),
    }).catch(() => {});
    setStep("plan");
  }

  function handlePlanContinue() {
    setStep(3);
  }

  function handleSelectSingle() {
    setBookingMode("single");
    setBundleSize(null);
  }

  function handleSelectBundle(size: number) {
    setBookingMode("bundle");
    setBundleSize(size);
    // A bundle is paid in full upfront — drop any single-session promo.
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null); setPromoKind("none");
  }

  function handleInitiateCheckout() {
    const eventId = crypto.randomUUID();
    (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.("track", "InitiateCheckout", {}, { eventID: eventId });
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "InitiateCheckout",
        event_id: eventId,
        event_source_url: window.location.href,
        fbclid: fbclidRef.current || undefined,
      }),
    }).catch(() => {});
    setStep(5);
  }

  if (!isOpen) return null;

  const [stepLabel, stepSub] = STEP_LABELS[step];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <style>{`
        @keyframes nastaviGlow {
          0%, 100% { box-shadow: 0 0 14px rgba(232,93,138,0.45), 0 4px 14px rgba(232,93,138,0.25); }
          50% { box-shadow: 0 0 28px rgba(232,93,138,0.75), 0 6px 22px rgba(232,93,138,0.45); }
        }
      `}</style>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Modal shell */}
      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {(step === 2 || step === 3 || step === 4 || step === 5 || step === "preparation") && (
              <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Nazad">
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-2xl font-bold font-playfair">Zakaži tretman</h2>
          </div>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Zatvori">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pb-4 shrink-0">
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">{stepLabel}</p>
          <p className="text-sm text-foreground/60 font-poppins mt-1">{stepSub}</p>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable content — primary actions live in sticky footer below */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-2">


          {/* ══ STEP 1: Gender ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="flex flex-col gap-3 py-2">
              {([
                { key: "zene",     label: "Žene",      sub: "Tretmani za žene",      Icon: Flower2,         hex: ACCENTS.zene.hex },
                { key: "muskarci", label: "Muškarci",  sub: "Tretmani za muškarce",  Icon: PersonStanding,  hex: ACCENTS.muskarci.hex },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleGenderSelect(opt.key)}
                  className="flex items-center gap-4 w-full p-5 rounded-2xl border-2 border-foreground/8 hover:border-foreground/20 active:scale-[0.99] transition-all text-left cursor-pointer"
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${opt.hex}1A` }}
                  >
                    <opt.Icon size={28} style={{ color: opt.hex }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold font-poppins">{opt.label}</p>
                    <p className="text-xs text-foreground/45 font-poppins mt-0.5">{opt.sub}</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={opt.hex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* ══ STEP 2: Services ════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {/* Social proof signals */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-100 border border-green-100">
                  <span className="text-green-500 text-base leading-none shrink-0">✓</span>
                  <p className="text-xs font-poppins text-green-700 font-semibold leading-snug">70–90% manje dlačica nakon 6-8 tretmana</p>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-pink-100 border border-pink/15">
                  <span className="text-[#E85D8A] text-base leading-none shrink-0">♥</span>
                  <p className="text-xs font-poppins text-foreground/65 font-medium leading-snug">Preko 1700 žena se uspešno rešilo dlačica</p>
                </div>
              </div>
              {loadingServices ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-foreground/30" />
                </div>
              ) : services.filter((s) => !isComboService(s.name)).map((service) => {
                const isSelected = selectedIds.includes(service.id);
                const isBlocked = fullBodySelected && !isSelected && !isAllowedWithFullBody(service.name);
                const Icon = getIcon(service.name);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    disabled={isBlocked}
                    className={`flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left ${
                      isBlocked
                        ? "border-foreground/8 opacity-40 cursor-not-allowed"
                        : isSelected
                          ? `${accent.border} ${accent.bgLight} cursor-pointer`
                          : "border-foreground/8 hover:border-foreground/20 cursor-pointer"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? accent.bgMed : "bg-foreground/5"}`}>
                      <Icon size={20} style={{ color: isSelected ? accent.hex : undefined }} className={isSelected ? "" : "text-foreground/40"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-poppins">{service.name}</p>
                      <span className="text-xs text-foreground/40 font-poppins mt-0.5">
                        {formatPrice(service.price)} RSD
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? `${accent.border} ${accent.bg}` : "border-foreground/20"}`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ══ STEP "plan": Single vs Bundle ═══════════════════════════════ */}
          {step === "plan" && (
            <div className="flex flex-col gap-3 py-1">
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-pink-100 border border-pink/15">
                <span className="text-[#E85D8A] text-base leading-none shrink-0 mt-0.5">★</span>
                <p className="text-xs font-poppins text-foreground/65 font-medium leading-snug">
                  Za potpune rezultate telu treba 6–8, a licu 10 tretmana. Uzmi paket i uštedi — plaćaš jednom, dolaziš koliko ti treba.
                </p>
              </div>

              {/* Single session */}
              <button
                type="button"
                onClick={handleSelectSingle}
                className={`flex items-center gap-3 w-full p-4 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                  !bundleActive
                    ? `${accent.border} ${accent.bgLight}`
                    : "border-foreground/8 hover:border-foreground/20"
                }`}
                style={
                  !bundleActive
                    ? { boxShadow: `0 0 0 2px ${accent.hex}33, 0 4px 16px ${accent.hex}22` }
                    : undefined
                }
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-poppins">1 tretman</p>
                  <p className="text-xs text-foreground/45 font-poppins mt-0.5">Zakaži jedan tretman, kao i do sada</p>
                </div>
                <span className="text-base font-bold font-poppins shrink-0" style={{ color: accent.hex }}>
                  {formatPrice(totalPrice)} RSD
                </span>
              </button>

              {/* Bundle options */}
              {eligibleSizes.map((size, idx) => {
                const b = computeBundle(effectiveServices, size);
                const isSelected = bundleActive && bundleSize === size;
                const isBest = idx === eligibleSizes.length - 1;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleSelectBundle(size)}
                    className={`relative flex flex-col w-full p-4 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                      isSelected
                        ? `${accent.border} ${accent.bgLight}`
                        : "border-foreground/8 hover:border-foreground/20"
                    }`}
                  >
                    {isBest && (
                      <span
                        className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[9px] font-bold font-poppins tracking-widest text-white"
                        style={{ backgroundColor: accent.hex }}
                      >
                        NAJBOLJA VREDNOST
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold font-poppins">Paket {size} tretmana</p>
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold font-poppins text-white"
                            style={{ backgroundColor: accent.hex }}
                          >
                            −{b.blendedPct}%
                          </span>
                        </div>
                        <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-green-700 bg-green-50 border border-green-100">
                          Ušteda {formatPrice(b.savings)} RSD
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-foreground/35 font-poppins line-through leading-none">
                          {formatPrice(b.originalTotal)}
                        </p>
                        <p className="text-base font-bold font-poppins leading-tight" style={{ color: accent.hex }}>
                          {formatPrice(b.finalTotal)} RSD
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {bundleActive && (
                <p className="text-xs font-poppins text-foreground/50 leading-snug px-1 mt-1">
                  {PAYMENT_TERMS}
                </p>
              )}
            </div>
          )}

          {/* ══ STEP 3: Date only ══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">IZABERI DAN</p>
              {loadingBookableDays ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={22} className="animate-spin text-foreground/30" />
                </div>
              ) : bookableDayOptions.length === 0 ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-foreground/5 text-foreground/50 text-sm font-poppins">
                  <AlertCircle size={16} />
                  Nema dana u kalendaru kada se izabrani tretman uklapa.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {bookableDayOptions.map((day) => {
                    const isSelected = selectedDate === day.date;
                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDaySelect(day.date)}
                        className={`relative flex flex-col items-start p-4 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? `${accent.border} ${accent.bgLight}`
                            : "border-foreground/8 hover:border-foreground/20"
                        }`}
                      >
                        {day.isToday && (
                          <span
                            className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-poppins text-white"
                            style={{ backgroundColor: accent.hex }}
                          >
                            DANAS
                          </span>
                        )}
                        <p
                          className="text-sm font-bold font-poppins leading-tight"
                          style={isSelected ? { color: accent.hex } : undefined}
                        >
                          {day.label}
                        </p>
                        <p className="text-xs text-foreground/50 font-poppins mt-0.5">{day.shortDate}</p>
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
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">SLOBODNI TERMINI</p>
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={22} className="animate-spin text-foreground/30" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-foreground/5 text-foreground/50 text-sm font-poppins">
                  <AlertCircle size={16} />
                  Nema slobodnih termina za ovaj datum.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className="py-2.5 rounded-lg text-sm font-semibold font-poppins transition-all cursor-pointer"
                      style={
                        selectedTime === slot
                          ? { backgroundColor: accent.hex, color: "white" }
                          : { backgroundColor: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.6)" }
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
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">VAŠI PODACI</p>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">Ime i prezime *</label>
                <input
                  type="text"
                  placeholder="Ana Marković"
                  value={form.name}
                  onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFieldErrors((p) => ({ ...p, name: false })); }}
                  className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.name) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => { e.target.style.borderColor = ""; }}
                />
                {fieldErrors.name && <p className="text-xs text-red-500 font-poppins mt-1">Unesite ime i prezime.</p>}
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="ana@primer.rs"
                  value={form.email}
                  onChange={(e) => {
                    emailCheckSeqRef.current += 1;
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setFieldErrors((p) => ({ ...p, email: false }));
                    setIsReturningCustomer(null);
                  }}
                  className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.email) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "";
                    void runReturningEmailCheck(e.target.value);
                  }}
                />
                {fieldErrors.email && <p className="text-xs text-red-500 font-poppins mt-1">Unesite email adresu.</p>}
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
                <label className="block text-xs text-foreground/50 font-poppins mb-1">Telefon *</label>
                <input
                  type="tel"
                  placeholder="065 373 8991"
                  value={form.phone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, phone: e.target.value }));
                    setFieldErrors((p) => ({ ...p, phone: false }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${fieldErrors.phone ? "border-red-400 bg-red-50" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.phone) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => { e.target.style.borderColor = ""; }}
                />
                {fieldErrors.phone && <p className="text-xs text-red-500 font-poppins mt-1">Unesite broj telefona.</p>}
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">Zdravstvena napomena <span className="text-foreground/35">(opcionalno)</span></label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Hronične bolesti, alergije ili lekovi"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors resize-none"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              {/* Promo / bundle code — hidden while buying a bundle (mutually exclusive) */}
              {!bundleActive && (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PROMO ILI KOD PAKETA</p>
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
                      }}
                      disabled={checkingReturningEmail || checkingPromo}
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors disabled:opacity-60"
                      onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                      onBlur={(e) => (e.target.style.borderColor = "")}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={!promoCode.trim() || checkingReturningEmail || checkingPromo}
                      className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide font-poppins text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: accent.hex }}
                    >
                      {checkingPromo ? "…" : "Primeni"}
                    </button>
                  </div>
                  {promoStatus === "valid" && ilsPromoActive && (
                    <p className="text-xs text-green-600 font-poppins mt-2">
                      Kod primenjen — −10% na redovnu cenu.
                    </p>
                  )}
                  {promoStatus === "valid" && redeemActive && (
                    <p className="text-xs text-green-600 font-poppins mt-2">
                      Paket potvrđen — ovaj tretman je već plaćen. Cena: 0 RSD.
                    </p>
                  )}
                  {promoStatus === "invalid" && (
                    <p className="text-xs text-red-500 font-poppins mt-2">
                      Nevažeći kod. Unesite promo kod ili tačan kod paketa uz email kojim je paket plaćen.
                    </p>
                  )}
                </div>
              )}

              {/* Price summary with savings */}
              {selectedIds.length > 0 && (
                <div className="rounded-2xl bg-foreground/4 p-4">
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PREGLED CENE</p>
                  {/* Selected regions */}
                  <div className="mb-3">
                    {effectiveServices.map((s) => (
                      <div key={s.id} className="flex justify-between items-center py-0.5">
                        <span className="text-xs font-poppins text-foreground/60">{s.name}</span>
                        <span className="text-xs font-poppins text-foreground/40">{formatPrice(s.price)} RSD</span>
                      </div>
                    ))}
                    {bundleActive && (
                      <div className="flex justify-between items-center py-0.5 mt-1">
                        <span className="text-xs font-poppins text-foreground/60 font-semibold">Paket — {bundleSize} tretmana</span>
                        <span className="text-xs font-poppins text-foreground/40">× {bundleSize}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-foreground/10 pt-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-poppins text-foreground/50">
                        {bundleActive ? `Redovna cena (${bundleSize}×)` : "Redovna cena"}
                      </span>
                      <span className={`text-sm font-poppins font-semibold ${ilsPromoActive || bundleActive || redeemActive ? "text-foreground/40 line-through" : "font-bold text-foreground"}`}>
                        {formatPrice(listTotal)} RSD
                      </span>
                    </div>
                    {ilsPromoActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm font-poppins text-green-800 font-semibold">Sa promo kodom (−10%)</span>
                        <span className="text-sm font-poppins font-bold text-green-800">{formatPrice(finalPrice)} RSD</span>
                      </div>
                    )}
                    {bundleActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm font-poppins text-green-800 font-semibold">Cena paketa (−{bundleResult!.blendedPct}%)</span>
                        <span className="text-sm font-poppins font-bold text-green-800">{formatPrice(finalPrice)} RSD</span>
                      </div>
                    )}
                    {redeemActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm font-poppins text-green-800 font-semibold">Plaćeno u paketu</span>
                        <span className="text-sm font-poppins font-bold text-green-800">0 RSD</span>
                      </div>
                    )}
                    {savingsVsList > 0 && (
                      <div className="flex justify-between items-center mt-1 pt-2 border-t border-foreground/8">
                        <span className="text-xs font-poppins text-foreground/40">Ušteda</span>
                        <span className="text-xs font-poppins font-semibold" style={{ color: "#E85D8A" }}>{formatPrice(savingsVsList)} RSD</span>
                      </div>
                    )}
                    {bundleActive && (
                      <p className="text-[11px] font-poppins text-foreground/45 leading-snug mt-2.5 pt-2.5 border-t border-foreground/8">
                        {PAYMENT_TERMS}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation policy — explicit consent, required before booking */}
              <div>
                <label
                  className={`flex gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors ${
                    fieldErrors.policy ? "border-red-400 bg-red-50" : "border-foreground/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedPolicy}
                    onChange={(e) => {
                      setAcceptedPolicy(e.target.checked);
                      setFieldErrors((p) => ({ ...p, policy: false }));
                    }}
                    className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer"
                    style={{ accentColor: accent.hex }}
                  />
                  <span className="text-xs font-poppins text-foreground/65 leading-relaxed">
                    <span className="font-semibold text-foreground/80">Prihvatam uslove otkazivanja.</span>{" "}
                    Termin mogu besplatno da otkažem ili pomerim najkasnije 24 sata pre tretmana.
                    Ako otkažem u poslednja 24 sata <span className="font-semibold text-foreground/80">bez opravdanog razloga</span> ili
                    se ne pojavim, naplaćuje se 50% cene tretmana pri sledećem zakazivanju.
                  </span>
                </label>
                {fieldErrors.policy && (
                  <p className="text-xs text-red-500 font-poppins mt-1">Potrebno je prihvatiti uslove otkazivanja.</p>
                )}
                <p className="text-[11px] font-poppins text-foreground/40 leading-snug mt-2 pl-1">
                  Bolest, povreda ili hitan slučaj se ne naplaćuju — samo nas obavestite i naći ćemo novi termin.
                </p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-poppins">
                  <AlertCircle size={15} />
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* ══ SUCCESS ════════════════════════════════════════════════════ */}
          {step === "success" && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
                <CheckCircle2 size={44} className="text-green-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold font-playfair mb-2">Termin zakazan! Čekamo Vas u Miloja Čiplića 51 u Novom Sadu</h3>
              <p className="text-sm text-foreground/50 font-poppins mb-6">Potvrda je poslata na {form.email}</p>

              {/* ── Stats banner: duration + animated price ── */}
              <div className="grid grid-cols-2 gap-3 w-full mb-4">
                {/* Duration tile */}
                <div className="flex flex-col items-center justify-center bg-foreground/5 rounded-2xl py-4 px-3">
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">TRAJANJE</p>
                  <p className="text-3xl font-bold font-poppins leading-none">{reservationDuration}</p>
                  <p className="text-xs text-foreground/40 font-poppins mt-1">min</p>
                </div>

                {/* Price tile */}
                <div
                  className="flex flex-col items-center justify-center rounded-2xl py-4 px-3 relative overflow-hidden"
                  style={{ backgroundColor: `${accent.hex}12` }}
                >
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">CENA</p>

                  {(ilsPromoActive || bundleActive || redeemActive) && (
                    <p className="text-xs text-foreground/35 font-poppins line-through leading-none mb-0.5">
                      {formatPrice(listTotal)} RSD
                    </p>
                  )}
                  <p className="text-3xl font-bold font-poppins leading-none tabular-nums" style={{ color: accent.hex }}>
                    {formatPrice(displayedPrice)}
                  </p>
                  <p className="text-xs font-semibold font-poppins mt-1" style={{ color: accent.hex }}>RSD</p>
                  {bundleActive ? (
                    <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-white bg-green-500">
                      PAKET {bundleSize}× · −{bundleResult!.blendedPct}%
                    </span>
                  ) : redeemActive ? (
                    <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-white bg-green-500">
                      PLAĆENO U PAKETU
                    </span>
                  ) : ilsPromoActive ? (
                    <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-white bg-green-500">
                      −10% PROMO
                    </span>
                  ) : (
                    <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-foreground/70 bg-foreground/10">
                      Redovna cena
                    </span>
                  )}
                </div>
              </div>

              {/* ── Detailed summary card ── */}
              <div className="w-full bg-foreground/4 rounded-2xl p-5 text-left space-y-3">
                {[
                  ["Datum", selectedDate ? formatDateFull(selectedDate) : ""],
                  ["Vreme", `${selectedTime} – ${minutesToTime(timeToMinutes(selectedTime) + reservationDuration)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm font-poppins">
                    <span className="text-foreground/50">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
                {promoStatus === "valid" && appliedPromoCode && isIlsPromoCode(appliedPromoCode) && (
                  <p className="text-xs text-green-600 font-poppins text-right">
                    Promo kod {appliedPromoCode} primenjen (−10% na redovnu cenu)
                  </p>
                )}
                <div className="border-t border-foreground/10 pt-3">
                  <p className="text-xs text-foreground/40 font-poppins mb-1.5">USLUGE</p>
                  {!isReturningCustomer && (
                    <p className="text-sm font-poppins font-semibold text-foreground/50">Konsultacija (10 min)</p>
                  )}
                  {effectiveServices.map((s) => (
                    <p key={s.id} className="text-sm font-poppins font-semibold">{s.name}</p>
                  ))}
                </div>
                {bookingRef && (
                  <div className="border-t border-foreground/10 pt-3">
                    <p className="text-xs text-foreground/40 font-poppins mb-1">REF. BROJ</p>
                    <p className="text-sm font-mono font-bold tracking-wider" style={{ color: accent.hex }}>
                      #{bookingRef}
                    </p>
                  </div>
                )}
              </div>

              {/* Bundle — remaining pre-paid sessions; the code is handed over in person at the first treatment */}
              {bundleActive && bundleResult && (
                <div className="w-full mt-4 rounded-2xl p-4 text-left border-2" style={{ borderColor: `${accent.hex}33`, backgroundColor: `${accent.hex}0A` }}>
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">PAKET OD {bundleSize} TRETMANA</p>
                  <p className="text-xs font-poppins text-foreground/55 leading-snug">
                    Na prvom tretmanu dobićete kod paketa kojim ćete zakazati preostalih {bundleSize! - 1} {bundleSize! - 1 === 1 ? "tretman" : "tretmana"} — ti termini su već plaćeni.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ PREPARATION ═══════════════════════════════════════════════ */}
          {step === "preparation" && (
            <div className="flex flex-col gap-6 py-2">
              {[
                { num: "01", text: "Pre prvog tretmana mora proći minimum mesec dana od poslednjeg čupanja dlačica bilo koje vrste." },
                { num: "02", text: "Dlačice uklanjati isključivo brijačem ili kremom za depilaciju — nikako čupanjem." },
                { num: "03", text: "Dan pre dolaska na tretman obrijati dlačice ili ih ukloniti depilacijskom kremom." },
                { num: "04", text: "Na dan tretmana na kožu ne nanositi nikakve preparate (kreme, ulja, dezodorans)." },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-5">
                  <span className="font-playfair text-3xl leading-none shrink-0 w-10 text-right" style={{ color: `${accent.hex}99` }}>
                    {step.num}
                  </span>
                  <div className="border-l-2 pl-5 py-0.5" style={{ borderColor: `${accent.hex}4D` }}>
                    <p className="font-poppins text-sm text-foreground/60 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* ── Sticky footer: primary CTA always visible while scrolling ───────── */}
          {(step === 2 || step === "plan" || step === 3 || step === 4 || step === 5 || step === "success" || step === "preparation") && (
            <div className="shrink-0 border-t border-foreground/10 bg-white px-4 pt-3 pb-3 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)]">
              {step === "plan" && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    {bundleActive ? (
                      <>
                        <span className="text-base font-bold font-poppins leading-none" style={{ color: accent.hex }}>
                          {formatPrice(finalPrice)} RSD
                        </span>
                        <span className="text-[10px] text-foreground/40 font-poppins mt-1">
                          Paket {bundleSize}× · ušteda {formatPrice(savingsVsList)} RSD
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-base font-bold font-poppins leading-none" style={{ color: accent.hex }}>
                          {formatPrice(totalPrice)} RSD
                        </span>
                        <span className="text-[10px] text-foreground/40 font-poppins mt-1">Pojedinačni tretman</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handlePlanContinue}
                    className="shrink-0 px-5 py-3 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer"
                    style={{ backgroundColor: accent.hex, animation: "nastaviGlow 2s ease-in-out infinite" }}
                  >
                    NASTAVI
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    {selectedIds.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold font-poppins leading-none" style={{ color: accent.hex }}>{formatPrice(totalPrice)} RSD</span>
                          <span className="text-[10px] text-foreground/40 font-poppins">· {slotDuration} min</span>
                        </div>
                        {appliedCombos.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-poppins text-white" style={{ backgroundColor: accent.hex }}>COMBO</span>
                            <span className="text-[10px] font-poppins text-foreground/40">paket popust uračunat</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-foreground/45 font-poppins pr-2">Odaberite bar jednu uslugu za nastavak.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={selectedIds.length === 0}
                    className="shrink-0 px-5 py-3 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: accent.hex,
                      animation: selectedIds.length > 0 ? "nastaviGlow 2s ease-in-out infinite" : undefined,
                    }}
                  >
                    NASTAVI
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    disabled={!selectedDate}
                    className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: accent.hex, animation: selectedDate ? "nastaviGlow 2s ease-in-out infinite" : undefined }}
                  >
                    NASTAVI
                  </button>
                  <p className="text-center text-[10px] font-poppins text-foreground/40">Preko 1700 žena se uspešno rešilo dlačica</p>
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleInitiateCheckout}
                    disabled={!selectedTime}
                    className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: accent.hex, animation: selectedTime ? "nastaviGlow 2s ease-in-out infinite" : undefined }}
                  >
                    NASTAVI
                  </button>
                  <p className="text-center text-[10px] font-poppins text-foreground/40">Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.</p>
                </div>
              )}

              {step === 5 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accent.hex }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
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
                    className="w-full py-3 rounded-full text-sm font-semibold tracking-widest font-poppins border-2 cursor-pointer transition-all hover:opacity-80"
                    style={{ borderColor: accent.hex, color: accent.hex }}
                  >
                    ŠTA TREBA DA URADIM PRE TERMINA
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3 rounded-full text-sm font-semibold tracking-widest font-poppins text-white cursor-pointer transition-opacity hover:opacity-90"
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
                  className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent.hex }}
                >
                  ZATVORI
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-linear-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
