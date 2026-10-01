"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import {
  X, ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText, ChevronRight,
} from "lucide-react";
import {
  supabase, calcBookingDuration, calcTotalDuration, getAvailableSlots,
  minutesToTime, timeToMinutes,
} from "@/lib/supabase";
import {
  fetchAvailability, resolveWindows,
  ADMIN_HORIZON_DAYS, EMPTY_AVAILABILITY, type AvailabilityData,
} from "@/lib/availability";
import type { Service } from "@/lib/database.types";
import { parseBundlePromo, bundleRedeemCode } from "@/lib/bundles";
import { STUDENT_PROMO_CODE, isStudentPromoCode } from "@/lib/pricing";
import { fetchPriceRows, PriceBook } from "@/lib/prices";
import { getLocation, fullAddress, type LocationId } from "@/lib/locations";
import { escapeLike } from "@/lib/fetchAll";
import {
  type Gender, type DayOption,
  getIcon, getRegionArt, preloadRegionArt, RegionThumb, CARD_IN_MS, THUMB_SIZES, HERO_THUMB_SIZES,
  SR_DAYS_FULL, SR_MONTHS_SHORT, monIdx, toDateStr, formatDateFull, formatPrice, EMAIL_REGEX,
  lockBodyScroll, unlockBodyScroll,
  isFullBody, isAllowedWithFullBody, applyComboRules, orderPickableServices,
  ACCENTS, GENDER_OPTIONS, COL_W, cascade, Skeleton, PREPARATION_STEPS,
} from "@/components/booking/shared";

/*
 * Admin flavour of the booking flow. Same look as the public BookingModal
 * (both build on components/booking/shared.tsx and the `.bm-*` theme in
 * globals.css) but with the staff rules: no plan/bundle step, a much longer
 * booking horizon, no 2-hour notice, `ils-` promo codes, an internal note and
 * no cancellation-policy consent.
 */

interface AdminReservationModalProps {
  isOpen: boolean;
  /** The studio the reservation is created for - the one open in the admin panel. */
  location: LocationId;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | "success" | "preparation";

/**
 * Build bookable days for Admin. Unlike the public site (2-week horizon), admin can
 * schedule across a much larger window — any open day per the effective schedule
 * (weekly template + overrides). Closed days (e.g. Sundays) are skipped.
 */
function buildAdminDayOptions(totalDuration: number, availability: AvailabilityData): DayOption[] {
  const now = new Date();
  const days: DayOption[] = [];

  for (let i = 0; i < ADMIN_HORIZON_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = toDateStr(d);

    const windows = resolveWindows(dateStr, availability);
    if (!windows) continue; // closed day (e.g. Sunday)
    const isToday = i === 0;

    if (isToday) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const fitsAnyWindow = windows.some(
        (w) => Math.max(w.start, nowMinutes) + totalDuration <= w.end,
      );
      if (!fitsAnyWindow) continue;
    }

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

/** Promo codes: `ils-` + any non-empty suffix (e.g. ils-leyla). Case-insensitive. */
function isIlsPromoCode(raw: string): boolean {
  return /^ils-.+$/i.test(raw.trim());
}

const STEP_LABELS: Record<Step, string> = {
  1: "Za koga zakazuješ?",
  2: "Odaberi regije za tretman",
  3: "Izaberi datum",
  4: "Izaberi vreme",
  5: "Podaci o klijentu",
  success: "Rezervacija je kreirana",
  preparation: "Šta klijent treba da uradi?",
};

/** The flow in order - the progress line fills one share per screen. */
const STEP_ORDER: Step[] = [1, 2, 3, 4, 5];

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminReservationModal({
  isOpen,
  location,
  onClose,
  onSuccess,
}: AdminReservationModalProps) {
  const studio = getLocation(location);
  const [isAnimating, setIsAnimating] = useState(false);
  const [step, setStep]               = useState<Step>(1);
  const [gender, setGender]           = useState<Gender | null>(null);
  const [services, setServices]       = useState<Service[]>([]);
  /** Which request the current `services` answer - loading until it matches the request key. */
  const [servicesFor, setServicesFor] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState(false);
  const [servicesReloadKey, setServicesReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 3 state
  const [selectedDate, setSelectedDate]   = useState("");
  const [selectedTime, setSelectedTime]   = useState("");
  const [daySlots, setDaySlots]           = useState<{ start_time: string; end_time: string; status: string }[]>([]);
  /** Which request the current `daySlots` answer - loading until it matches the request key. */
  const [slotsFor, setSlotsFor]           = useState<string | null>(null);
  const [slotsError, setSlotsError]       = useState(false);
  const [slotsReloadKey, setSlotsReloadKey] = useState(0);
  /** Synchronous double-submit guard (state updates land a render too late). */
  const submitLockRef = useRef(false);
  const [form, setForm]                   = useState({ name: "", email: "", phone: "", notes: "" });
  const [fieldErrors, setFieldErrors]     = useState({ name: false, email: false });
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [bookingRef, setBookingRef]       = useState<string | null>(null);
  const [promoCode, setPromoCode]               = useState("");
  const [promoStatus, setPromoStatus]           = useState<"idle" | "valid" | "invalid">("idle");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoKind, setPromoKind]               = useState<"none" | "ils" | "bundle_redeem" | "student">("none");
  const [checkingPromo, setCheckingPromo]       = useState(false);
  /** Success tile count-down value; null until the first animation frame lands. */
  const [displayedPrice, setDisplayedPrice]   = useState<number | null>(null);
  const animFrameRef = useRef<number>(0);
  const emailCheckSeqRef = useRef(0);
  /** Scrollable step body - reset to top on every step change */
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  /** The dialog sheet - receives focus on open so keyboard handling works. */
  const sheetRef = useRef<HTMLDivElement>(null);

  /** null = not checked yet for current email; true = exists in reservations */
  const [isReturningCustomer, setIsReturningCustomer] = useState<boolean | null>(null);
  const [checkingReturningEmail, setCheckingReturningEmail] = useState(false);

  /** Working-hours schedule (weekly template + overrides), shared with the public site. */
  const [availability, setAvailability] = useState<AvailabilityData>(EMPTY_AVAILABILITY);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  /** Whole body is selected - lock out every region except earrings, chin & whole face. */
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
  const pickableServices = orderPickableServices(services);
  const servicesKey      = gender ? `${gender}:${servicesReloadKey}` : null;
  const loadingServices  = servicesKey !== null && servicesFor !== servicesKey;
  const slotsKey         = selectedDate ? `${selectedDate}:${slotsReloadKey}` : null;
  const loadingSlots     = slotsKey !== null && slotsFor !== slotsKey;

  // Discounts are mutually exclusive: bundle redemption > ils promo > student.
  const redeemActive =
    promoKind === "bundle_redeem" && promoStatus === "valid" && appliedPromoCode != null;
  const ilsPromoActive =
    promoKind === "ils" && promoStatus === "valid" &&
    appliedPromoCode != null && isIlsPromoCode(appliedPromoCode);
  const studentActive =
    !redeemActive && !ilsPromoActive && promoKind === "student" && promoStatus === "valid";
  const anyDiscount = redeemActive || ilsPromoActive || studentActive;
  const finalPrice = redeemActive
    ? 0
    : ilsPromoActive
      ? Math.round(totalPrice * 0.9)
      : studentActive
        ? Math.round(totalPrice * 0.8)
        : totalPrice;
  const savingsVsList = totalPrice - finalPrice;
  /** Success tile: counts down from list to final price; no discount = nothing to animate. */
  const priceShown = totalPrice === finalPrice ? finalPrice : (displayedPrice ?? totalPrice);

  // Day options rebuild whenever slot duration (incl. consultation) or schedule changes
  const dayOptions = buildAdminDayOptions(slotDuration, availability);

  // Read the clock on every render - the modal stays mounted between opens.
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isToday = selectedDate !== "" && selectedDate === toDateStr(nowDate);
  // For Admin: no 2-hour buffer
  const minStart = isToday ? nowMinutes : undefined;

  const windows = selectedDate ? resolveWindows(selectedDate, availability) : null;
  const availableSlots = windows?.length
    ? getAvailableSlots(daySlots, slotDuration, minStart, windows)
    : [];

  // ── Side-effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      unlockBodyScroll();
      return;
    }
    lockBodyScroll();
    const raf = requestAnimationFrame(() => {
      setIsAnimating(true);
      // Focus moves into the dialog so Escape and Tab work from the start.
      sheetRef.current?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(raf); unlockBodyScroll(); };
  }, [isOpen]);

  // Load the working-hours schedule once per open (fresh each time the modal opens).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchAvailability(location)
      .then((data) => { if (!cancelled) setAvailability(data); })
      .catch(() => { if (!cancelled) setAvailability(EMPTY_AVAILABILITY); });
    return () => { cancelled = true; };
  }, [isOpen, location]);

  // Always a fresh services fetch here (no session cache): prices can be edited
  // in the database and this modal must reflect them right away. Prices are
  // this studio's current ones.
  useEffect(() => {
    if (!servicesKey || !gender) return;
    preloadRegionArt(gender);
    let cancelled = false;
    Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("gender", gender)
        .eq("active", true)
        .order("sort_order"),
      fetchPriceRows(),
    ])
      .then(
        ([{ data, error }, prices]) => {
          if (cancelled) return;
          const priced = data && prices ? new PriceBook(prices).apply(data, location) : [];
          if (error || !prices || priced.length === 0) setServicesError(true);
          setServices(priced);
          setServicesFor(servicesKey);
        },
        () => {
          if (cancelled) return;
          setServicesError(true);
          setServices([]);
          setServicesFor(servicesKey);
        },
      );
    return () => { cancelled = true; };
  }, [gender, servicesKey, location]);

  // ── Animated price count-down on success screen ───────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    const target = finalPrice;
    const from   = totalPrice;
    if (from === target) return; // nothing to count down - `priceShown` uses the final price

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
  }, [step, finalPrice, totalPrice]);

  // Reservations for the chosen day - refetched every time the time step opens,
  // so coming back to a day never shows slots that were booked in the meantime.
  useEffect(() => {
    if (!slotsKey || !selectedDate || step !== 4) return;
    let cancelled = false;
    supabase
      .from("reservations")
      .select("start_time, end_time, status")
      .eq("date", selectedDate)
      .eq("location", location)
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          if (error) setSlotsError(true);
          else setDaySlots(data ?? []);
          setSlotsFor(slotsKey);
        },
        () => {
          if (cancelled) return;
          setSlotsError(true);
          setSlotsFor(slotsKey);
        },
      );
    return () => { cancelled = true; };
  }, [selectedDate, step, slotsKey, location]);

  // Every step starts at the top - otherwise a long previous step (services)
  // leaves the next one scrolled past its opening.
  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function resetAll() {
    setIsAnimating(false);
    setStep(1); setGender(null); setSelectedIds([]);
    setSelectedDate(""); setSelectedTime(""); setDaySlots([]); setSlotsFor(null);
    setSlotsError(false); setServicesError(false); setServicesFor(null);
    setForm({ name: "", email: "", phone: "", notes: "" });
    setFieldErrors({ name: false, email: false });
    setSubmitError(null); setBookingRef(null); setDisplayedPrice(null);
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null);
    setPromoKind("none"); setCheckingPromo(false);
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
    else if (step === 2) { setStep(1); setGender(null); setServicesError(false); setSelectedIds([]); }
    else if (step === 3) { setStep(2); setSelectedDate(""); setSelectedTime(""); }
    else if (step === 4) { setStep(3); setSelectedTime(""); }
    else if (step === 5) { setStep(4); }
    else if (step === "preparation") { setStep("success"); }
  }

  function handleGenderSelect(g: Gender) {
    setGender(g);
    setServicesError(false);
    setSelectedIds([]);
    setSelectedDate(""); setSelectedTime("");
    setStep(2);
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
      setDaySlots([]);
    }
    // Always a fresh fetch when the time step opens (see the slots effect).
    setSlotsError(false);
    setSlotsReloadKey((k) => k + 1);
    setStep(4);
  }

  function handleTimeSelect(slot: string) {
    setSelectedTime(slot);
    setStep(5);
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
      .ilike("customer_email", escapeLike(trimmed))
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

    // −20% student promo. No first-treatment check here: Ana is on the phone with
    // the client and can see the booking history herself.
    if (isStudentPromoCode(raw)) {
      setPromoStatus("valid");
      setAppliedPromoCode(STUDENT_PROMO_CODE);
      setPromoKind("student");
      return;
    }

    // Bundle code — redeeming a pre-paid follow-up session (price 0).
    // The client enters their original purchase code (no `-r`); we verify a
    // matching bundle purchase exists for this email before granting it.
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
      // Same check as the public form: pre-paid sessions still free for this
      // email + code. A bundle of 3 can no longer be redeemed a 4th time.
      const { data: left, error } = await supabase.rpc("bundle_sessions_left", {
        p_email: email, p_code: raw.toLowerCase(), p_location: location,
      });
      setCheckingPromo(false);
      if (!error && (left ?? 0) > 0) {
        setPromoStatus("valid");
        setAppliedPromoCode(raw.toLowerCase());
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
    if (submitLockRef.current) return;
    const errors = { name: !form.name.trim(), email: !form.email.trim() };
    setFieldErrors(errors);
    if (errors.name || errors.email) return;
    if (!selectedDate || !selectedTime) {
      setStep(selectedDate ? 4 : 3);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReservation();
    } catch {
      setSubmitError("Greška pri kreiranju rezervacije. Proveri internet vezu i pokušaj ponovo.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  async function submitReservation() {
    const emailTrim = form.email.trim();
    const { data: existingReservation } = await supabase
      .from("reservations")
      .select("id")
      .ilike("customer_email", escapeLike(emailTrim))
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    const returningSubmit = !!existingReservation;

    // Resolve the recorded promo code + final price for this booking. Mutually
    // exclusive: bundle redemption (pre-paid follow-up, price 0) > ils −10% > student −20%.
    const redeemSubmit =
      promoKind === "bundle_redeem" && promoStatus === "valid" && appliedPromoCode != null;
    const ilsAppliedSubmit =
      !redeemSubmit && promoKind === "ils" && promoStatus === "valid" &&
      appliedPromoCode != null && isIlsPromoCode(appliedPromoCode);
    const studentAppliedSubmit =
      !redeemSubmit && !ilsAppliedSubmit && promoKind === "student" && promoStatus === "valid";

    let promoForRecord: string | null = null;
    let notesFromPromo: string | null = null;
    if (redeemSubmit) {
      promoForRecord = bundleRedeemCode(appliedPromoCode!);
      notesFromPromo = `Iskorišćen tretman iz paketa ${appliedPromoCode}`;
    } else if (ilsAppliedSubmit) {
      promoForRecord = appliedPromoCode;
    } else if (studentAppliedSubmit) {
      promoForRecord = STUDENT_PROMO_CODE;
      notesFromPromo = "STUDENTSKI POPUST −20% - proveri indeks pri dolasku!";
    }
    const finalForSubmit = redeemSubmit
      ? 0
      : ilsAppliedSubmit
        ? Math.round(totalPrice * 0.9)
        : studentAppliedSubmit
          ? Math.round(totalPrice * 0.8)
          : totalPrice;

    // Append the bundle redemption note to any admin note already entered.
    const adminNote = form.notes.trim();
    const notesForRecord =
      [adminNote || null, notesFromPromo].filter(Boolean).join(" · ") || null;

    const durationForReservation = returningSubmit
      ? calcTotalDuration(selectedServices)
      : calcBookingDuration(selectedServices);
    const endTime = minutesToTime(timeToMinutes(selectedTime) + durationForReservation);

    // The free times on screen were loaded when the time step opened. A client
    // may have booked the same one from the site since - look again right
    // before saving, so two people never get the same term.
    const { data: busy, error: busyError } = await supabase
      .from("reservations")
      .select("start_time, end_time, status")
      .eq("date", selectedDate)
      .eq("location", location);
    if (busyError || !busy) {
      setSubmitError("Provera termina nije uspela. Proveri internet vezu i pokušaj ponovo.");
      return;
    }
    const startMin = timeToMinutes(selectedTime);
    const endMin   = startMin + durationForReservation;
    const clash = busy.some((r) =>
      r.status !== "cancelled" && r.status !== "blacklisted" &&
      startMin < timeToMinutes(r.end_time) && endMin > timeToMinutes(r.start_time));
    if (clash) {
      setSubmitError("Ovaj termin je upravo zauzet. Vrati se korak nazad i izaberi drugo vreme.");
      setSlotsReloadKey((k) => k + 1);
      return;
    }

    const { data: res, error } = await supabase
      .from("reservations")
      .insert({
        customer_name:  form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim() || null,
        date:           selectedDate,
        start_time:     `${selectedTime}:00`,
        end_time:       `${endTime}:00`,
        total_duration: durationForReservation,
        status:         "confirmed",
        notes:          notesForRecord,
        promo_code:     promoForRecord,
        location,
      })
      .select()
      .single();

    if (error || !res) {
      setSubmitError("Greška pri kreiranju rezervacije. Pokušajte ponovo.");
      return;
    }

    if (selectedIds.length > 0) {
      const { error: servicesError } = await supabase.from("reservation_services").insert(
        selectedIds.map((id) => ({ reservation_id: res.id, service_id: id }))
      );
      if (servicesError) {
        // A reservation without regions would sit in the calendar empty and
        // count as 0 RSD - take it back and let the admin try again.
        await supabase.from("reservations").delete().eq("id", res.id);
        setSubmitError("Regije nisu sačuvane, rezervacija nije napravljena. Pokušajte ponovo.");
        return;
      }
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
        total_price:      totalPrice,
        discounted_price: finalForSubmit,
        promo_code:       promoForRecord ?? "redovna cena",
        booking_ref:      bookingRefValue,
        location,
        location_name:    studio.name,
        location_address: fullAddress(studio),
      }),
    }).catch(() => {});

    setIsReturningCustomer(returningSubmit);
    setStep("success");
    onSuccess?.();
  }

  if (!isOpen) return null;

  const flowIdx = STEP_ORDER.indexOf(step);
  const progress = flowIdx === -1 ? 1 : (flowIdx + 1) / (STEP_ORDER.length + 1);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`bm-theme ${gender ? `bm-theme-${gender}` : ""} fixed inset-0 z-50 flex items-center justify-center`}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (!submitting) handleClose();
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Modal shell */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arm-title"
        tabIndex={-1}
        /* The open/close transition lives in `.bm-sheet` (globals.css). */
        className={`bm-sheet relative shadow-2xl w-full h-full flex flex-col overflow-hidden outline-none ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* Header - from sm up, content lives in the centered COL_W column */}
        <div className={`flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-4 shrink-0 ${COL_W}`}>
          <div className="flex items-center gap-3">
            {(step === 1 || step === 2 || step === 3 || step === 4 || step === 5 || step === "preparation") && (
              <button onClick={handleBack} className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Nazad">
                <ArrowLeft size={18} className="sm:w-[22px] sm:h-[22px]" />
              </button>
            )}
            <h2 id="arm-title" className={`text-2xl sm:text-3xl md:text-4xl font-bold font-playfair ${gender ? "bm-metal-text" : ""}`}>Nova rezervacija</h2>
          </div>
          <button onClick={handleClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Zatvori">
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Step indicator */}
        <div className={`px-4 sm:px-6 pb-3 sm:pb-6 shrink-0 ${COL_W}`}>
          <div
            className="h-1 rounded-full bg-foreground/10 overflow-hidden"
            role="progressbar"
            aria-label="Napredak zakazivanja"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-foreground/50 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress * 100}%`, ...(gender ? { backgroundColor: accent.hex } : {}) }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-4">
            <p className="text-lg sm:text-xl font-medium leading-snug text-foreground/90 font-poppins">{STEP_LABELS[step]}</p>
            {/* Admin only: which studio this reservation is being created for. */}
            <span
              className="shrink-0 text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/68 font-poppins"
              style={gender ? { color: accent.hex } : undefined}
            >
              {studio.name.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable content - primary actions live in sticky footer below */}
          <div ref={scrollBodyRef} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2 ${COL_W}`}>

          {/* ══ STEP 1: Gender ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 py-2">
              {GENDER_OPTIONS.map((opt, index) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleGenderSelect(opt.key)}
                  onPointerEnter={() => preloadRegionArt(opt.key)}
                  onFocus={() => preloadRegionArt(opt.key)}
                  style={{ ...cascade(index, 60, 4), backgroundImage: opt.surface, borderColor: `${opt.hex}40` }}
                  className="bm-card-in flex flex-row sm:flex-col items-center text-left sm:text-center gap-4 w-full px-4 sm:px-3 py-5 sm:py-8 rounded-2xl sm:rounded-3xl border-2 hover:brightness-125 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div
                    className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 shrink-0"
                    style={{ backgroundColor: `${opt.hex}1A`, borderColor: `${opt.hex}55` }}
                  >
                    <Image
                      src={opt.image}
                      alt={opt.sub}
                      fill
                      sizes="(max-width: 640px) 96px, 128px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <p className="text-xl font-bold font-playfair tracking-wide" style={{ color: opt.hex }}>{opt.label}</p>
                    <p className="text-sm text-foreground/68 font-poppins mt-0.5">{opt.sub}</p>
                  </div>
                  <ChevronRight size={20} className="sm:hidden shrink-0" style={{ color: `${opt.hex}80` }} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {/* ══ STEP 2: Services ════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {loadingServices ? (
                /* Same grid as the real list: one full-width hero card, then
                   thumbnail + two lines per region. */
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3" role="status" aria-label="Učitavanje tretmana">
                  <Skeleton className="sm:col-span-2 mt-2 sm:mt-2.5 h-[104px] sm:h-[124px] rounded-2xl" />
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 border-foreground/8">
                      <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full shrink-0" />
                      <div className="flex-1 flex flex-col gap-2">
                        <Skeleton className="h-3.5 sm:h-4 w-2/3 rounded" />
                        <Skeleton className="h-3 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : servicesError ? (
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/76 text-sm sm:text-base font-poppins text-center">
                  <span className="flex items-center gap-2"><AlertCircle size={16} />Tretmani trenutno ne mogu da se učitaju.</span>
                  <button
                    type="button"
                    onClick={() => { setServicesError(false); setServicesReloadKey((k) => k + 1); }}
                    className="px-5 py-2 rounded-full text-sm font-semibold font-poppins bm-metal cursor-pointer"
                    style={{ backgroundColor: accent.hex }}
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : (
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
              {pickableServices.map((service, index) => {
                const enterDelay = Math.min(index, 9) * 45;
                const enterStyle = { animationDelay: `${enterDelay}ms` } as CSSProperties;
                const isSelected = selectedIds.includes(service.id);
                const isBlocked = fullBodySelected && !isSelected && !isAllowedWithFullBody(service.name);
                const Icon = getIcon(service.name);
                const art = gender ? getRegionArt(service.name, gender) : null;

                /* "Celo telo" gets the hero treatment: full width, always in the
                   accent colour and softly glowing so it reads as the best deal. */
                if (isFullBody(service.name)) {
                  return (
                    <div
                      key={service.id}
                      className="bm-card-in glow-halo relative sm:col-span-2 mt-2 sm:mt-2.5 rounded-2xl"
                      style={{ "--glow": accent.hex, ...enterStyle } as CSSProperties}
                    >
                      <span
                        className="absolute -top-2 sm:-top-2.5 left-4 sm:left-5 z-10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold font-poppins tracking-widest bm-metal"
                        style={{ backgroundColor: accent.hex }}
                      >
                        NAJISPLATIVIJE
                      </span>
                      <button
                        onClick={() => toggleService(service.id)}
                        className={`group glow-card relative overflow-hidden flex items-center gap-3 sm:gap-4 w-full p-4 sm:p-5 rounded-2xl border-2 ${accent.border} ${isSelected ? accent.bgLight : "bg-transparent"} transition-all text-left cursor-pointer`}
                      >
                        <span className="shimmer-sweep" aria-hidden="true" />
                        {art ? (
                          <RegionThumb
                            art={art}
                            selected={isSelected}
                            sizes={HERO_THUMB_SIZES}
                            revealDelay={enterDelay + CARD_IN_MS}
                            className="w-24 h-24 sm:w-28 sm:h-28 -my-2 -ml-1"
                          />
                        ) : (
                          <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${accent.bgMed}`}>
                            <Icon size={24} style={{ color: accent.hex }} className="sm:w-7 sm:h-7" />
                          </div>
                        )}
                        <div className="relative flex-1 min-w-0">
                          <p className="text-base sm:text-lg font-bold font-poppins">{service.name}</p>
                          <span className="block text-[11px] sm:text-[13px] text-foreground/68 font-poppins leading-snug mt-0.5">
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
                    style={enterStyle}
                    className={`bm-card-in group flex items-center gap-3 sm:gap-4 w-full ${art ? "p-2.5 sm:p-3" : "p-3.5 sm:p-4"} rounded-xl sm:rounded-2xl border-2 transition-all text-left ${
                      isBlocked
                        ? "border-foreground/8 opacity-40 cursor-not-allowed"
                        : isSelected
                          ? `${accent.border} ${accent.bgLight} cursor-pointer`
                          : "border-foreground/8 hover:border-foreground/20 cursor-pointer"
                    }`}
                  >
                    {art ? (
                      <RegionThumb
                        art={art}
                        selected={isSelected}
                        sizes={THUMB_SIZES}
                        revealDelay={enterDelay + CARD_IN_MS}
                        className="w-20 h-20 sm:w-24 sm:h-24 -my-2 -ml-1"
                      />
                    ) : (
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? accent.bgMed : "bg-foreground/5"}`}>
                        <Icon size={20} style={{ color: isSelected ? accent.hex : undefined }} className={`sm:w-6 sm:h-6 ${isSelected ? "" : "text-foreground/60"}`} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-semibold font-poppins">{service.name}</p>
                      <span className="text-xs sm:text-sm text-foreground/60 font-poppins mt-0.5">
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

          {/* ══ STEP 3: Date only ══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/60 font-poppins mb-1">IZABERI DAN</p>
              {dayOptions.length === 0 ? (
                <div className="flex items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/68 text-sm sm:text-base font-poppins">
                  <AlertCircle size={16} />
                  Nema dostupnih dana.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {dayOptions.map((day, index) => {
                    const isSelected = selectedDate === day.date;
                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDaySelect(day.date)}
                        style={cascade(index, 45, 8)}
                        className={`bm-card-in relative flex flex-col items-start p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 text-left cursor-pointer transition-all ${
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
                        <p className="text-xs sm:text-sm text-foreground/68 font-poppins mt-0.5">{day.shortDate}</p>
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
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/60 font-poppins mb-1">SLOBODNI TERMINI</p>
              {loadingSlots ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2.5" role="status" aria-label="Učitavanje termina">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="h-[42px] sm:h-[52px] rounded-lg sm:rounded-xl" />
                  ))}
                </div>
              ) : slotsError ? (
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/76 text-sm sm:text-base font-poppins text-center">
                  <span className="flex items-center gap-2"><AlertCircle size={16} />Termini trenutno ne mogu da se učitaju.</span>
                  <button
                    type="button"
                    onClick={() => { setSlotsError(false); setSlotsReloadKey((k) => k + 1); }}
                    className="px-5 py-2 rounded-full text-sm font-semibold font-poppins bm-metal cursor-pointer"
                    style={{ backgroundColor: accent.hex }}
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex items-center gap-2 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-foreground/5 text-foreground/68 text-sm sm:text-base font-poppins">
                  <AlertCircle size={16} />
                  Nema slobodnih termina za ovaj datum.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2.5">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleTimeSelect(slot)}
                      className="bm-card-in py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold font-poppins transition-colors cursor-pointer"
                      style={{
                        ...cascade(index, 25, 17),
                        ...(selectedTime === slot
                          ? { backgroundColor: accent.hex, color: accent.onHex }
                          : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }),
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 5: Podaci o klijentu ═══════════════════════════════════════════ */}
          {step === 5 && (
            <div className="flex flex-col gap-4 sm:gap-6">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/60 font-poppins mb-1">PODACI O KLIJENTU</p>

              <div>
                <label htmlFor="arm-name" className="block text-xs sm:text-sm text-foreground/68 font-poppins mb-1 sm:mb-1.5">Ime i prezime *</label>
                <input
                  id="arm-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
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
                <label htmlFor="arm-email" className="block text-xs sm:text-sm text-foreground/68 font-poppins mb-1 sm:mb-1.5">Email *</label>
                <input
                  id="arm-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="ana@primer.rs"
                  value={form.email}
                  onChange={(e) => {
                    emailCheckSeqRef.current += 1;
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setFieldErrors((p) => ({ ...p, email: false }));
                    setIsReturningCustomer(null);
                    // A package code was checked against the old email.
                    if (promoKind === "bundle_redeem") {
                      setPromoStatus("idle");
                      setAppliedPromoCode(null);
                      setPromoKind("none");
                    }
                  }}
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 focus:outline-none font-poppins text-sm sm:text-base transition-colors ${fieldErrors.email ? "border-red-400/70 bg-red-500/10" : "border-foreground/10"}`}
                  onFocus={(e) => { if (!fieldErrors.email) e.target.style.borderColor = accent.hex; }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "";
                    void runReturningEmailCheck(e.target.value);
                  }}
                />
                {fieldErrors.email && <p className="text-xs text-red-400 font-poppins mt-1">Unesite email adresu.</p>}
                {checkingReturningEmail && (
                  <p className="text-xs text-foreground/64 font-poppins mt-1.5">Proveravamo istoriju zakazivanja…</p>
                )}
                {!checkingReturningEmail && isReturningCustomer === true && (
                  <p className="text-xs text-foreground/72 font-poppins mt-1.5">
                    😊 Postojeći klijent u bazi.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="arm-phone" className="block text-xs sm:text-sm text-foreground/68 font-poppins mb-1 sm:mb-1.5">Telefon <span className="text-foreground/55">(opcionalno)</span></label>
                <input
                  id="arm-phone"
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  enterKeyHint="next"
                  placeholder="065 373 8991"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm sm:text-base transition-colors"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              <div>
                <label htmlFor="arm-note" className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground/68 font-poppins mb-1 sm:mb-1.5">
                  <FileText size={12} className="sm:w-3.5 sm:h-3.5" />
                  Napomena (admin)
                </label>
                <textarea
                  id="arm-note"
                  name="note"
                  autoComplete="off"
                  placeholder="Interna napomena..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm sm:text-base transition-colors resize-none"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              <div>
                <p className="text-xs sm:text-sm font-semibold tracking-widest text-foreground/60 font-poppins mb-2">PROMO KOD</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="promo"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="npr. ils-ime, student ili kod paketa"
                    aria-label="Promo kod"
                    value={promoCode}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (promoCode.trim() && !checkingReturningEmail && !checkingPromo) void handleApplyPromo();
                    }}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoStatus("idle");
                      setAppliedPromoCode(null);
                      setPromoKind("none");
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
                {promoStatus === "valid" && ilsPromoActive && (
                  <p className="text-xs text-emerald-400 font-poppins mt-2">
                    Kod primenjen - −10% popusta.
                  </p>
                )}
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
                        Traži indeks pri dolasku - bez njega naplati punu cenu.
                      </p>
                      {/* The public form refuses this outright; here it only warns, so
                          Ana can still make an exception when she means to. */}
                      {isReturningCustomer === true && (
                        <p className="text-[11px] sm:text-xs font-poppins text-red-300 font-bold leading-snug mt-1.5">
                          Pažnja: ovo nije prvi tretman - klijent već postoji u bazi.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {promoStatus === "invalid" && (
                  <p className="text-xs text-red-400 font-poppins mt-2">
                    Nevažeći promo kod.
                  </p>
                )}
              </div>

              {/* Price summary with savings */}
              {selectedIds.length > 0 && (
                <div className="rounded-2xl sm:rounded-3xl bg-foreground/4 p-4 sm:p-6">
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/60 font-poppins mb-2 sm:mb-3">PREGLED CENE</p>
                  <div className="mb-3">
                    {effectiveServices.map((s) => (
                      <div key={s.id} className="flex justify-between items-center py-0.5">
                        <span className="text-xs sm:text-sm font-poppins text-foreground/76">{s.name}</span>
                        <span className="text-xs sm:text-sm font-poppins text-foreground/60">{formatPrice(s.price)} RSD</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-foreground/10 pt-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm sm:text-base font-poppins text-foreground/68">Redovna cena</span>
                      <span className={`text-sm sm:text-base font-poppins font-semibold ${anyDiscount ? "text-foreground/60 line-through" : "font-bold text-foreground"}`}>
                        {formatPrice(totalPrice)} RSD
                      </span>
                    </div>
                    {studentActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm sm:text-base font-poppins text-emerald-300 font-semibold">Studentski popust (−20%)</span>
                        <span className="text-sm sm:text-base font-poppins font-bold text-emerald-300">{formatPrice(finalPrice)} RSD</span>
                      </div>
                    )}
                    {ilsPromoActive && (
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-sm sm:text-base font-poppins text-emerald-300 font-semibold">Sa promo kodom (−10%)</span>
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
                        <span className="text-xs sm:text-sm font-poppins text-foreground/60">Ušteda</span>
                        <span className="text-xs sm:text-sm font-poppins font-semibold" style={{ color: accent.hex }}>{formatPrice(savingsVsList)} RSD</span>
                      </div>
                    )}
                    {studentActive && (
                      <p className="text-[11px] sm:text-[13px] font-poppins text-amber-300 font-semibold leading-snug mt-2.5 pt-2.5 border-t border-foreground/8">
                        Ova cena važi uz indeks. Bez njega se naplaćuje {formatPrice(totalPrice)} RSD.
                      </p>
                    )}
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
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair mb-2 sm:mb-3">Rezervacija kreirana!</h3>
              <p className="text-sm sm:text-base text-foreground/68 font-poppins mb-6 sm:mb-8">Potvrda je poslata na {form.email}</p>

              {/* ── Stats banner: duration + animated price ── */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center bg-foreground/5 rounded-2xl sm:rounded-3xl py-4 sm:py-7 px-3">
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/60 font-poppins mb-1 sm:mb-2">TRAJANJE</p>
                  <p className="text-3xl sm:text-5xl font-bold font-poppins leading-none">{reservationDuration}</p>
                  <p className="text-xs sm:text-sm text-foreground/60 font-poppins mt-1 sm:mt-2">min</p>
                </div>

                <div
                  className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl py-4 sm:py-7 px-3 relative overflow-hidden"
                  style={{ backgroundColor: `${accent.hex}12` }}
                >
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-foreground/60 font-poppins mb-1 sm:mb-2">CENA</p>
                  {anyDiscount && (
                    <p className="text-xs sm:text-sm text-foreground/55 font-poppins line-through leading-none mb-0.5">
                      {formatPrice(totalPrice)} RSD
                    </p>
                  )}
                  <p className="text-3xl sm:text-5xl font-bold font-poppins leading-none tabular-nums" style={{ color: accent.hex }}>
                    {formatPrice(priceShown)}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold font-poppins mt-1 sm:mt-2" style={{ color: accent.hex }}>RSD</p>
                  {redeemActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-green-500">
                      PLAĆENO U PAKETU
                    </span>
                  ) : ilsPromoActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-green-500">
                      PROMO −10%
                    </span>
                  ) : studentActive ? (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-white bg-amber-500">
                      STUDENT −20% · UZ INDEKS
                    </span>
                  ) : (
                    <span className="mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-poppins text-foreground/82 bg-foreground/10">
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
                    <span className="text-foreground/68">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
                {studentActive && (
                  <div className="flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl bg-amber-400/10 border-2 border-amber-400/50">
                    <AlertCircle size={18} className="text-amber-400 shrink-0 mt-px" />
                    <p className="text-[11px] sm:text-xs font-poppins text-amber-200 font-semibold leading-snug">
                      Proveri indeks pri dolasku. Bez njega studentski popust ne važi i naplaćuje se puna cena od {formatPrice(totalPrice)} RSD.
                    </p>
                  </div>
                )}
                <div className="border-t border-foreground/10 pt-3">
                  <p className="text-xs sm:text-sm text-foreground/60 font-poppins mb-1.5 sm:mb-2">USLUGE</p>
                  {!isReturningCustomer && (
                    <p className="text-sm sm:text-base font-poppins font-semibold text-foreground/68">Konsultacija (10 min)</p>
                  )}
                  {effectiveServices.map((s) => (
                    <p key={s.id} className="text-sm sm:text-base font-poppins font-semibold">{s.name}</p>
                  ))}
                </div>
                {bookingRef && (
                  <div className="border-t border-foreground/10 pt-3">
                    <p className="text-xs sm:text-sm text-foreground/60 font-poppins mb-1">REF. BROJ</p>
                    <p className="text-sm sm:text-lg font-mono font-bold tracking-wider" style={{ color: accent.hex }}>
                      #{bookingRef}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PREPARATION ═══════════════════════════════════════════════ */}
          {step === "preparation" && (
            <div className="flex flex-col gap-6 sm:gap-8 py-2 sm:py-4">
              {PREPARATION_STEPS.map((item) => (
                <div key={item.num} className="flex items-start gap-5 sm:gap-7">
                  <span className="font-playfair text-3xl sm:text-5xl leading-none shrink-0 w-10 sm:w-16 text-right" style={{ color: `${accent.hex}99` }}>
                    {item.num}
                  </span>
                  <div className="border-l-2 pl-5 sm:pl-7 py-0.5 sm:py-1" style={{ borderColor: `${accent.hex}4D` }}>
                    <p className="font-poppins text-sm sm:text-base md:text-lg text-foreground/76 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* ── Sticky footer: primary CTA always visible while scrolling ───────── */}
          {(step === 2 || step === 5 || step === "success" || step === "preparation") && (
            <div className="shrink-0 sm:border-t sm:border-foreground/10 bg-[var(--bm-bg)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-5 sm:pb-5 shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.6)]">
              <div className={COL_W}>
              {step === 2 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col items-center text-center">
                    {selectedIds.length > 0 ? (
                      <>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="text-base sm:text-xl font-bold font-poppins leading-none" style={{ color: accent.hex }}>{formatPrice(totalPrice)} RSD</span>
                          <span className="text-[10px] sm:text-xs text-foreground/60 font-poppins">· {slotDuration} min</span>
                        </div>
                        {appliedCombos.length > 0 && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] font-bold font-poppins bm-metal" style={{ backgroundColor: accent.hex }}>COMBO</span>
                            <span className="text-[10px] sm:text-xs font-poppins text-foreground/60">paket popust uračunat</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-foreground/64 font-poppins">Odaberite bar jednu uslugu za nastavak.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={selectedIds.length === 0}
                    className={`${selectedIds.length > 0 ? "glow-halo" : ""} relative w-full py-3.5 sm:py-4.5 rounded-full text-sm sm:text-base font-semibold tracking-widest font-poppins bm-metal active:scale-95 transition-transform cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: accent.hex, "--glow": accent.hex } as CSSProperties}
                  >
                    NASTAVI
                  </button>
                </div>
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
                      Kreiranje...
                    </span>
                  ) : "KREIRAJ REZERVACIJU"}
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
                    PRE-TRETMAN UPUTSTVA
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
      </div>
    </div>
  );
}
