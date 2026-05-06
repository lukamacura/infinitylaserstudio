"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X, ScanFace, Hand, Footprints,
  Flower2, Minus, Target, Shirt, ArrowLeft,
  PersonStanding, Loader2, CheckCircle2, AlertCircle, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  supabase, calcBookingDuration, calcTotalDuration, getAvailableSlots, getBusinessWindows,
  minutesToTime, timeToMinutes, SLOT_SIZE,
} from "@/lib/supabase";
import type { Service } from "@/lib/database.types";

interface AdminReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedNames?: string[];
}

type Step = 1 | 2 | 3 | 4 | 5 | "success" | "preparation";
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

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

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
 * Build bookable days for Admin. Shows next 90 days.
 * Admins are not restricted by SPECIAL_AVAILABILITY whitelist.
 */
function buildAdminDayOptions(totalDuration: number): DayOption[] {
  const now = new Date();
  const days: DayOption[] = [];

  for (let i = 0; i < 90; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = toDateStr(d);

    const windows = getBusinessWindows(dateStr) || [{ start: 8 * 60, end: 21 * 60 }];
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

function isComboService(name: string): boolean {
  const n = name.toLowerCase();
  return COMBO_RULES.some((r) => n.includes(r.comboKey));
}

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
  1: ["KORAK 1 OD 4", "Za koga zakazuješ?"],
  2: ["KORAK 1 OD 4", "Odaberi regije za tretman"],
  3: ["KORAK 2 OD 4", "Izaberi datum"],
  4: ["KORAK 3 OD 4", "Izaberi vreme"],
  5: ["KORAK 4 OD 4", "Vaši podaci"],
  success: ["POTVRĐENO", "Rezervacija je kreirana"],
  preparation: ["PRE TRETMANA", "Šta klijent treba da uradi?"],
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminReservationModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedNames,
}: AdminReservationModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [step, setStep]               = useState<Step>(1);
  const [gender, setGender]           = useState<Gender | null>("zene");
  const [services, setServices]       = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 3 state
  const [selectedDate, setSelectedDate]   = useState("");
  const [selectedTime, setSelectedTime]   = useState("");
  const [daySlots, setDaySlots]           = useState<{ start_time: string; end_time: string; status: string }[]>([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [form, setForm]                   = useState({ name: "", email: "", phone: "", notes: "" });
  const [fieldErrors, setFieldErrors]     = useState({ name: false, email: false });
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [bookingRef, setBookingRef]       = useState<string | null>(null);
  const [promoCode, setPromoCode]               = useState("");
  const [promoStatus, setPromoStatus]           = useState<"idle" | "valid" | "invalid">("idle");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [displayedPrice, setDisplayedPrice]   = useState(0);
  const animFrameRef = useRef<number>(0);
  const appliedPreselect = useRef(false);
  const emailCheckSeqRef = useRef(0);

  /** null = not checked yet for current email; true = exists in reservations */
  const [isReturningCustomer, setIsReturningCustomer] = useState<boolean | null>(null);
  const [checkingReturningEmail, setCheckingReturningEmail] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
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

  const firstTreatmentEligible = isReturningCustomer !== true;
  const baseFirstTreatmentPrice = firstTreatmentEligible ? Math.round(totalPrice * 0.5) : totalPrice;
  const ilsPromoActive =
    promoStatus === "valid" && appliedPromoCode != null && isIlsPromoCode(appliedPromoCode);
  const finalPrice = ilsPromoActive ? Math.round(baseFirstTreatmentPrice * 0.9) : baseFirstTreatmentPrice;
  const savingsVsList = totalPrice - finalPrice;

  // Day options rebuild whenever slot duration (incl. consultation) changes
  const dayOptions = useMemo(() => buildAdminDayOptions(slotDuration), [slotDuration]);

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const isToday = dayOptions.find((d) => d.date === selectedDate)?.isToday ?? false;
  // For Admin: no 2-hour buffer
  const minStart = isToday ? nowMinutes : undefined;

  const windows = selectedDate ? (getBusinessWindows(selectedDate) || [{ start: 8 * 60, end: 21 * 60 }]) : null;
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

  useEffect(() => {
    if (step !== "success") return;
    const target = finalPrice;
    const from   = totalPrice;

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
  }, [step, finalPrice, totalPrice]);

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
    if (services.length === 0) return;
    const matchedIds = services
      .filter((s) => !isComboService(s.name))
      .filter((s) => preselectedNames.some((kw) => s.name.toLowerCase().includes(kw)))
      .map((s) => s.id);
    if (matchedIds.length > 0) {
      setSelectedIds(matchedIds);
      setStep(2);
    }
    appliedPreselect.current = true;
  }, [isOpen, preselectedNames, services]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function resetAll() {
    setStep(1); setGender("zene"); setSelectedIds([]);
    setSelectedDate(""); setSelectedTime(""); setDaySlots([]);
    setForm({ name: "", email: "", phone: "", notes: "" });
    setFieldErrors({ name: false, email: false });
    setSubmitError(null); setBookingRef(null);
    setPromoCode(""); setPromoStatus("idle"); setAppliedPromoCode(null);
    emailCheckSeqRef.current += 1;
    setIsReturningCustomer(null);
    setCheckingReturningEmail(false);
  }

  function handleClose() {
    setIsAnimating(false);
    setTimeout(() => { onClose(); resetAll(); }, 300);
  }

  function handleBack() {
    if (step === 2) { setStep(1); }
    else if (step === 3) { setStep(2); setSelectedDate(""); setSelectedTime(""); }
    else if (step === 4) { setStep(3); setSelectedTime(""); }
    else if (step === 5) { setStep(4); }
    else if (step === "preparation") { setStep("success"); }
  }

  function toggleService(id: string) {
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
      .in("status", ["confirmed", "no_show"])
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

  function handleApplyPromo() {
    const raw = promoCode.trim();
    if (!raw) {
      setPromoStatus("idle");
      setAppliedPromoCode(null);
      return;
    }
    if (isIlsPromoCode(raw)) {
      setPromoStatus("valid");
      setAppliedPromoCode(raw);
    } else {
      setPromoStatus("invalid");
      setAppliedPromoCode(null);
    }
  }

  async function handleSubmit() {
    const errors = { name: !form.name.trim(), email: !form.email.trim() };
    setFieldErrors(errors);
    if (errors.name || errors.email || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    setSubmitError(null);

    const emailTrim = form.email.trim();
    const { data: existingReservation } = await supabase
      .from("reservations")
      .select("id")
      .ilike("customer_email", emailTrim)
      .in("status", ["confirmed", "no_show"])
      .limit(1)
      .maybeSingle();
    const returningSubmit = !!existingReservation;
    const baseForSubmit = returningSubmit ? totalPrice : Math.round(totalPrice * 0.5);
    const ilsAppliedSubmit =
      promoStatus === "valid" && appliedPromoCode != null && isIlsPromoCode(appliedPromoCode);
    const finalForSubmit = ilsAppliedSubmit ? Math.round(baseForSubmit * 0.9) : baseForSubmit;

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
        date:           selectedDate,
        start_time:     `${selectedTime}:00`,
        end_time:       `${endTime}:00`,
        total_duration: durationForReservation,
        status:         "confirmed",
        notes:          form.notes.trim() || null,
      })
      .select()
      .single();

    if (error || !res) {
      setSubmitError("Greška pri kreiranju rezervacije. Pokušajte ponovo.");
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
        total_price:      totalPrice,
        discounted_price: finalForSubmit,
        promo_code:       ilsAppliedSubmit ? appliedPromoCode! : returningSubmit ? "redovna cena" : "50% promo",
        booking_ref:      bookingRefValue,
      }),
    }).catch(() => {});

    setIsReturningCustomer(returningSubmit);
    setStep("success");
    setSubmitting(false);
    onSuccess?.();
  }

  if (!isOpen) return null;

  const [stepLabel, stepSub] = STEP_LABELS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <style>{`
        @keyframes nastaviGlow {
          0%, 100% { box-shadow: 0 0 14px rgba(232,93,138,0.45), 0 4px 14px rgba(232,93,138,0.25); }
          50% { box-shadow: 0 0 28px rgba(232,93,138,0.75), 0 6px 22px rgba(232,93,138,0.45); }
        }
      `}</style>
      <div
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {(step === 2 || step === 3 || step === 4 || step === 5 || step === "preparation") && (
              <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Nazad">
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-2xl font-bold font-playfair">Nova rezervacija</h2>
          </div>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" aria-label="Zatvori">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-4 shrink-0">
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">{stepLabel}</p>
          <p className="text-sm text-foreground/60 font-poppins mt-1">{stepSub}</p>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-2">

          {/* ══ STEP 1: Gender ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">ZA KOGA JE REZERVACIJA?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setGender("zene"); setStep(2); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all cursor-pointer ${gender === "zene" ? "border-pink bg-pink/5" : "border-foreground/10 hover:border-foreground/20"}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${gender === "zene" ? "bg-pink text-white" : "bg-foreground/5 text-foreground/40"}`}>
                    <ScanFace size={28} />
                  </div>
                  <span className="font-poppins font-bold">ŽENE</span>
                </button>
                <button
                  onClick={() => { setGender("muskarci"); setStep(2); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all cursor-pointer ${gender === "muskarci" ? "border-teal bg-teal/5" : "border-foreground/10 hover:border-foreground/20"}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${gender === "muskarci" ? "bg-teal text-white" : "bg-foreground/5 text-foreground/40"}`}>
                    <PersonStanding size={28} />
                  </div>
                  <span className="font-poppins font-bold">MUŠKARCI</span>
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2: Services ════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {loadingServices ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-foreground/30" />
                </div>
              ) : services.filter((s) => !isComboService(s.name)).map((service) => {
                const isSelected = selectedIds.includes(service.id);
                const Icon = getIcon(service.name);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                      isSelected
                        ? `${accent.border} ${accent.bgLight}`
                        : "border-foreground/8 hover:border-foreground/20"
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

          {/* ══ STEP 3: Date only ══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">IZABERI DAN</p>
              {dayOptions.length === 0 ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-foreground/5 text-foreground/50 text-sm font-poppins">
                  <AlertCircle size={16} />
                  Nema dostupnih dana.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {dayOptions.map((day) => {
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
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">PODACI O KLIJENTU</p>

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
                    😊 Postojeći klijent u bazi.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">Telefon</label>
                <input
                  type="tel"
                  placeholder="+381 60 123 4567"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1 flex items-center gap-1.5">
                  <FileText size={12} />
                  Napomena (admin)
                </label>
                <textarea
                  placeholder="Interna napomena..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors resize-none"
                  onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                  onBlur={(e) => (e.target.style.borderColor = "")}
                />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PROMO KOD</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="npr. promokod"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoStatus("idle");
                      setAppliedPromoCode(null);
                    }}
                    disabled={checkingReturningEmail}
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors disabled:opacity-60"
                    onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                    onBlur={(e) => (e.target.style.borderColor = "")}
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || checkingReturningEmail}
                    className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide font-poppins text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: accent.hex }}
                  >
                    Primeni
                  </button>
                </div>
                {promoStatus === "valid" && ilsPromoActive && (
                  <p className="text-xs text-green-600 font-poppins mt-2">
                    Kod primenjen — −10% popusta.
                  </p>
                )}
                {promoStatus === "invalid" && (
                  <p className="text-xs text-red-500 font-poppins mt-2">
                    Nevažeći promo kod.
                  </p>
                )}
              </div>

              {/* Price summary */}
              {selectedIds.length > 0 && (
                <div className="rounded-2xl bg-foreground/4 p-4">
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PREGLED CENE</p>
                  <div className="mb-3">
                    {effectiveServices.map((s) => (
                      <div key={s.id} className="flex justify-between items-center py-0.5">
                        <span className="text-xs font-poppins text-foreground/60">{s.name}</span>
                        <span className="text-xs font-poppins text-foreground/40">{formatPrice(s.price)} RSD</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-foreground/10 pt-2.5">
                    {firstTreatmentEligible ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-poppins text-foreground/50">Redovna cena</span>
                          <span className="text-sm font-poppins font-semibold text-foreground/40 line-through">{formatPrice(totalPrice)} RSD</span>
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-sm font-poppins text-green-700 font-semibold">Cena za 1. tretman (−50%)</span>
                          <span className="text-sm font-poppins font-bold text-green-700">{formatPrice(baseFirstTreatmentPrice)} RSD</span>
                        </div>
                        {ilsPromoActive && (
                          <div className="flex justify-between items-center mt-1.5">
                            <span className="text-sm font-poppins text-green-800 font-semibold">Sa promo kodom (−10%)</span>
                            <span className="text-sm font-poppins font-bold text-green-800">{formatPrice(finalPrice)} RSD</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-poppins text-foreground/50">Redovna cena</span>
                          <span className={`text-sm font-poppins font-semibold ${ilsPromoActive ? "text-foreground/40 line-through" : "font-bold text-foreground"}`}>
                            {formatPrice(totalPrice)} RSD
                          </span>
                        </div>
                        {ilsPromoActive && (
                          <div className="flex justify-between items-center mt-1.5">
                            <span className="text-sm font-poppins text-green-800 font-semibold">Sa promo kodom (−10%)</span>
                            <span className="text-sm font-poppins font-bold text-green-800">{formatPrice(finalPrice)} RSD</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

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
              <h3 className="text-2xl font-bold font-playfair mb-2">Rezervacija kreirana!</h3>
              <p className="text-sm text-foreground/50 font-poppins mb-6">Potvrda je poslata na {form.email}</p>

              <div className="grid grid-cols-2 gap-3 w-full mb-4">
                <div className="flex flex-col items-center justify-center bg-foreground/5 rounded-2xl py-4 px-3">
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">TRAJANJE</p>
                  <p className="text-3xl font-bold font-poppins leading-none">{reservationDuration}</p>
                  <p className="text-xs text-foreground/40 font-poppins mt-1">min</p>
                </div>

                <div
                  className="flex flex-col items-center justify-center rounded-2xl py-4 px-3 relative overflow-hidden"
                  style={{ backgroundColor: `${accent.hex}12` }}
                >
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">CENA</p>
                  <p className="text-3xl font-bold font-poppins leading-none tabular-nums" style={{ color: accent.hex }}>
                    {formatPrice(displayedPrice)}
                  </p>
                  <p className="text-xs font-semibold font-poppins mt-1" style={{ color: accent.hex }}>RSD</p>
                </div>
              </div>

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

          {(step === 1 || step === 2 || step === 3 || step === 4 || step === 5 || step === "success" || step === "preparation") && (
            <div className="shrink-0 border-t border-foreground/10 bg-white px-4 pt-3 pb-3 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)]">
              {step === 1 && (
                 <p className="text-center text-[10px] font-poppins text-foreground/40 py-2">Izaberite pol za nastavak</p>
              )}

              {step === 2 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    {selectedIds.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-foreground/35 font-poppins line-through">{formatPrice(totalPrice)} RSD</span>
                          <span className="text-base font-bold font-poppins leading-none" style={{ color: accent.hex }}>{formatPrice(Math.round(totalPrice * 0.5))} RSD</span>
                        </div>
                        <span className="text-[10px] text-green-700 font-poppins font-semibold mt-0.5">
                           Ušteda {formatPrice(Math.round(totalPrice * 0.5))} RSD · {slotDuration} min
                        </span>
                      </>
                    ) : (
                      <p className="text-xs text-foreground/45 font-poppins pr-2">Odaberite usluge.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
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
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!selectedDate}
                  className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accent.hex, animation: selectedDate ? "nastaviGlow 2s ease-in-out infinite" : undefined }}
                >
                  NASTAVI
                </button>
              )}

              {step === 4 && (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={!selectedTime}
                  className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accent.hex, animation: selectedTime ? "nastaviGlow 2s ease-in-out infinite" : undefined }}
                >
                  NASTAVI
                </button>
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
                    className="w-full py-3 rounded-full text-sm font-semibold tracking-widest font-poppins border-2 cursor-pointer transition-all hover:opacity-80"
                    style={{ borderColor: accent.hex, color: accent.hex }}
                  >
                    PRE-TRETMAN UPUTSTVA
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

        <div className="h-1 bg-linear-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
