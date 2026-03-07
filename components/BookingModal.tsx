"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X, ChevronRight, Smile, SmilePlus, Hand, Footprints,
  CircleDot, Sparkles, User, Shirt, ArrowLeft,
  PersonStanding, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  supabase, calcBookingDuration, getAvailableSlots, getBusinessHours,
  minutesToTime, timeToMinutes, SLOT_SIZE,
} from "@/lib/supabase";
import type { Service } from "@/lib/database.types";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | "success";
type Gender = "zene" | "muskarci";

// ── Icon mapping ──────────────────────────────────────────────────────────────
function getIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("nausnice") && n.includes("brada")) return SmilePlus;
  if (n.includes("nausnice")) return Smile;
  if (n.includes("lice") || n.includes("lica") || n.includes("brada")) return Smile;
  if (n.includes("intimna")) return Sparkles;
  if (n.includes("pazuh") || n.includes("ruke")) return Hand;
  if (n.includes("linija") || n.includes("stomak")) return CircleDot;
  if (n.includes("noge")) return Footprints;
  if (n.includes("telo")) return PersonStanding;
  if (n.includes("grudi")) return Shirt;
  if (n.includes("leđ") || n.includes("ledj")) return User;
  return CircleDot;
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
 * Build the next 6 bookable days (Mon–Sat; Sun is closed).
 * Today is included only when there is theoretical time left within the day's business hours.
 * Mon–Fri: 14:00–19:00 | Sat: 10:00–15:00
 */
function buildDayOptions(totalDuration: number): DayOption[] {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minStartToday = nowMinutes + 120; // 2-hour notice

  const days: DayOption[] = [];

  for (let offset = 0; days.length < 6 && offset < 14; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);

    const dateStr = toDateStr(d);
    const biz = getBusinessHours(dateStr);
    if (!biz) continue; // Sunday or other closed day

    const idx = monIdx(d);
    const isToday = offset === 0;

    // For today: only show if at least one slot fits within this day's business hours
    if (isToday) {
      const earliestSlot = Math.ceil(minStartToday / SLOT_SIZE) * SLOT_SIZE;
      if (earliestSlot + totalDuration > biz.end) continue;
    }

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
  1: ["KORAK 1 OD 3", "Za koga zakazuješ?"],
  2: ["KORAK 2 OD 3", "Odaberi regije za tretman"],
  3: ["KORAK 3 OD 3", "Izaberi datum i vreme"],
  success: ["POTVRĐENO", "Termin je uspešno zakazan"],
};

// ═════════════════════════════════════════════════════════════════════════════
export default function BookingModal({ isOpen, onClose }: BookingModalProps) {
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
  const [fieldErrors, setFieldErrors]     = useState({ name: false, email: false });
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [bookingRef, setBookingRef]       = useState<string | null>(null);
  const [promoCode, setPromoCode]             = useState("");
  const [promoStatus, setPromoStatus]         = useState<"idle" | "valid" | "invalid">("idle");
  const [promoChecking, setPromoChecking]     = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [displayedPrice, setDisplayedPrice]   = useState(0);
  const animFrameRef = useRef<number>(0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const { effective: effectiveServices, appliedCombos } = applyComboRules(selectedServices, services);
  const totalDuration    = selectedServices.length > 0 ? calcBookingDuration(selectedServices) : 0;
  const basePrice        = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalPrice       = effectiveServices.reduce((sum, s) => sum + s.price, 0);
  const comboSaving      = basePrice - totalPrice;
  const accent           = ACCENTS[gender ?? "zene"];

  // Day options rebuild whenever totalDuration changes
  const dayOptions = useMemo(() => buildDayOptions(totalDuration), [totalDuration]);

  // For today: slots must start ≥ now+120min
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const isToday = dayOptions.find((d) => d.date === selectedDate)?.isToday ?? false;
  const minStart = isToday ? nowMinutes + 120 : undefined;

  const biz = selectedDate ? getBusinessHours(selectedDate) : null;
  const availableSlots = biz
    ? getAvailableSlots(daySlots, totalDuration, minStart, biz.start, biz.end)
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

  // ── Animated price count-down on success screen ───────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    const target = discountedPrice ?? totalPrice;
    const from   = discountedPrice !== null ? totalPrice : target;

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
  }, [step]);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  function resetAll() {
    setStep(1); setGender(null); setServices([]); setSelectedIds([]);
    setSelectedDate(""); setSelectedTime(""); setDaySlots([]);
    setForm({ name: "", email: "", phone: "" });
    setFieldErrors({ name: false, email: false });
    setSubmitError(null); setBookingRef(null);
    setPromoCode(""); setPromoStatus("idle"); setDiscountedPrice(null); setAppliedPromoCode(null);
  }

  async function handleApplyPromo() {
    const code = promoCode.trim().toLowerCase();
    const emailToCheck = form.email.trim();

    if (code === "tb-2026") {
      if (!emailToCheck) {
        setPromoStatus("invalid");
        setDiscountedPrice(null);
        setAppliedPromoCode(null);
        return;
      }
      setPromoChecking(true);
      const { data: lead } = await supabase
        .from("leads")
        .select("id, promo_used")
        .eq("email", emailToCheck)
        .maybeSingle();
      setPromoChecking(false);
      if (lead && !lead.promo_used) {
        setPromoStatus("valid");
        setDiscountedPrice(Math.round(totalPrice * 0.5));
        setAppliedPromoCode("tb-2026");
      } else {
        setPromoStatus("invalid");
        setDiscountedPrice(null);
        setAppliedPromoCode(null);
      }
    } else if (code === "ils-10") {
      if (!emailToCheck) {
        setPromoStatus("invalid");
        setDiscountedPrice(null);
        setAppliedPromoCode(null);
        return;
      }
      setPromoChecking(true);
      const { count } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("customer_email", emailToCheck);
      setPromoChecking(false);
      if (count && count >= 1) {
        setPromoStatus("valid");
        setDiscountedPrice(Math.round(totalPrice * 0.9));
        setAppliedPromoCode("ils-10");
      } else {
        setPromoStatus("invalid");
        setDiscountedPrice(null);
        setAppliedPromoCode(null);
      }
    } else {
      setPromoStatus("invalid");
      setDiscountedPrice(null);
      setAppliedPromoCode(null);
    }
  }

  function handleClose() {
    setIsAnimating(false);
    setTimeout(() => { onClose(); resetAll(); }, 300);
  }

  function handleBack() {
    if (step === 2) { setStep(1); setGender(null); setSelectedIds([]); setServices([]); }
    else if (step === 3) { setStep(2); setSelectedDate(""); setSelectedTime(""); }
  }

  function toggleService(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function handleDaySelect(date: string) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedTime("");
  }

  async function handleSubmit() {
    // Validate – highlight empty required fields instead of blocking silently
    const errors = { name: !form.name.trim(), email: !form.email.trim() };
    setFieldErrors(errors);
    if (errors.name || errors.email || !selectedDate || !selectedTime || !gender) return;

    setSubmitting(true);
    setSubmitError(null);

    const endTime = minutesToTime(timeToMinutes(selectedTime) + totalDuration);

    const { data: res, error } = await supabase
      .from("reservations")
      .insert({
        customer_name:  form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim() || null,
        date:           selectedDate,
        start_time:     `${selectedTime}:00`,
        end_time:       `${endTime}:00`,
        total_duration: totalDuration,
        status:         "confirmed",
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

    // Mark promo as used so it cannot be applied again
    if (promoStatus === "valid") {
      await supabase
        .from("leads")
        .update({ promo_used: true })
        .eq("email", form.email.trim());
    }

    setBookingRef(res.id.slice(-8).toUpperCase());
    setStep("success");
    setSubmitting(false);
  }

  if (!isOpen) return null;

  const [stepLabel, stepSub] = STEP_LABELS[step];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
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
            {(step === 2 || step === 3) && (
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

        {/* Scrollable content */}
        <div className="px-6 pb-6 overflow-y-auto flex-1">

          {/* ══ STEP 1: Gender ══════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setGender("zene"); setStep(2); }}
                className="group flex items-center gap-4 w-full p-5 rounded-2xl border-2 border-foreground/10 hover:border-pink transition-colors text-left cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-pink/15 flex items-center justify-center shrink-0 group-hover:bg-pink/25 transition-colors">
                  <Sparkles size={28} className="text-[#E85D8A]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold font-poppins">Ženske usluge</p>
                  <p className="text-sm text-foreground/50 font-poppins mt-0.5">10 regija dostupno</p>
                </div>
                <ChevronRight size={20} className="text-foreground/30 group-hover:text-pink transition-colors" />
              </button>

              <button
                onClick={() => { setGender("muskarci"); setStep(2); }}
                className="group flex items-center gap-4 w-full p-5 rounded-2xl border-2 border-foreground/10 hover:border-teal transition-colors text-left cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-teal/15 flex items-center justify-center shrink-0 group-hover:bg-teal/25 transition-colors">
                  <User size={28} className="text-[#0D9488]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold font-poppins">Muške usluge</p>
                  <p className="text-sm text-foreground/50 font-poppins mt-0.5">9 regija dostupno</p>
                </div>
                <ChevronRight size={20} className="text-foreground/30 group-hover:text-teal transition-colors" />
              </button>
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

          {/* ══ STEP 3: Date / Time / Form ══════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-6">

              {/* Day picker */}
              <div>
                <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-3">IZABERI DAN</p>

                {dayOptions.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-foreground/5 text-foreground/50 text-sm font-poppins">
                    <AlertCircle size={16} />
                    Nema dostupnih termina u narednih 7 dana.
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

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-3">SLOBODNI TERMINI</p>
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

              {/* Customer form - shown once a time is picked */}
              {selectedTime && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins">VAŠI PODACI</p>

                  {/* Name */}
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

                  {/* Email */}
                  <div>
                    <label className="block text-xs text-foreground/50 font-poppins mb-1">Email *</label>
                    <input
                      type="email"
                      placeholder="ana@primer.rs"
                      value={form.email}
                      onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setFieldErrors((p) => ({ ...p, email: false })); }}
                      className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-foreground/10"}`}
                      onFocus={(e) => { if (!fieldErrors.email) e.target.style.borderColor = accent.hex; }}
                      onBlur={(e) => { e.target.style.borderColor = ""; }}
                    />
                    {fieldErrors.email && <p className="text-xs text-red-500 font-poppins mt-1">Unesite email adresu.</p>}
                  </div>

                  {/* Phone */}
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

                  {/* Promo code */}
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PROMO KOD</p>
                    <p className="text-xs text-foreground/40 font-poppins mb-2">Imaš promo kod?</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="npr. xx-yyyy"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value); setPromoStatus("idle"); setDiscountedPrice(null); setAppliedPromoCode(null); }}
                        className="flex-1 px-4 py-3 rounded-xl border-2 border-foreground/10 focus:outline-none font-poppins text-sm transition-colors"
                        onFocus={(e) => (e.target.style.borderColor = accent.hex)}
                        onBlur={(e) => (e.target.style.borderColor = "")}
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={!promoCode.trim() || promoChecking}
                        className="px-4 py-3 rounded-xl text-xs font-semibold tracking-widest font-poppins text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        style={{ backgroundColor: accent.hex }}
                      >
                        {promoChecking ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : "PRIMENI"}
                      </button>
                    </div>
                    {promoStatus === "valid" && (
                      <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl bg-green-50">
                        <p className="text-xs text-green-700 font-poppins font-semibold">
                          {appliedPromoCode === "ils-10"
                            ? "Kod primenjen - 10% popusta aktivirano."
                            : "Kod primenjen - 50% popusta aktivirano."}
                        </p>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[10px] text-foreground/35 font-poppins line-through leading-none">{formatPrice(totalPrice)} RSD</p>
                          <p className="text-sm font-bold font-poppins text-green-700 leading-tight">{formatPrice(discountedPrice ?? totalPrice)} RSD</p>
                        </div>
                      </div>
                    )}
                    {promoStatus === "invalid" && (
                      <p className="text-xs text-red-500 font-poppins mt-1.5">
                        {promoCode.trim().toLowerCase() === "tb-2026"
                          ? "Kod je već iskorišćen."
                          : promoCode.trim().toLowerCase() === "ils-10"
                          ? "Nemaš prethodne rezervacije."
                          : "Nevažeći promo kod."}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-poppins">
                      <AlertCircle size={15} />
                      {submitError}
                    </div>
                  )}

                  {/* ── Submit button lives HERE, at the bottom of the form ── */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white mt-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: accent.hex }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Zakazivanje...
                      </span>
                    ) : "POTVRDI TERMIN"}
                  </button>
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
              <h3 className="text-2xl font-bold font-playfair mb-2">Termin zakazan!</h3>
              <p className="text-sm text-foreground/50 font-poppins mb-6">Potvrda je poslata na {form.email}</p>

              {/* ── Stats banner: duration + animated price ── */}
              <div className="grid grid-cols-2 gap-3 w-full mb-4">
                {/* Duration tile */}
                <div className="flex flex-col items-center justify-center bg-foreground/5 rounded-2xl py-4 px-3">
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">TRAJANJE</p>
                  <p className="text-3xl font-bold font-poppins leading-none">{totalDuration}</p>
                  <p className="text-xs text-foreground/40 font-poppins mt-1">min</p>
                </div>

                {/* Price tile */}
                <div
                  className="flex flex-col items-center justify-center rounded-2xl py-4 px-3 relative overflow-hidden"
                  style={{ backgroundColor: `${accent.hex}12` }}
                >
                  <p className="text-[10px] font-semibold tracking-widest text-foreground/40 font-poppins mb-1">CENA</p>

                  {/* Original price - struck through when promo is active */}
                  {promoStatus === "valid" && (
                    <p className="text-xs text-foreground/35 font-poppins line-through leading-none mb-0.5">
                      {formatPrice(totalPrice)} RSD
                    </p>
                  )}

                  {/* Animated number */}
                  <p className="text-3xl font-bold font-poppins leading-none tabular-nums" style={{ color: accent.hex }}>
                    {formatPrice(displayedPrice)}
                  </p>
                  <p className="text-xs font-semibold font-poppins mt-1" style={{ color: accent.hex }}>RSD</p>

                  {/* Promo badge */}
                  {promoStatus === "valid" && (
                    <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-white bg-green-500">
                      {appliedPromoCode === "ils-10" ? "−10% POPUST" : "−50% POPUST"}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Detailed summary card ── */}
              <div className="w-full bg-foreground/4 rounded-2xl p-5 text-left space-y-3">
                {[
                  ["Datum", selectedDate ? formatDateFull(selectedDate) : ""],
                  ["Vreme", `${selectedTime} – ${minutesToTime(timeToMinutes(selectedTime) + totalDuration)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm font-poppins">
                    <span className="text-foreground/50">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
                {promoStatus === "valid" && (
                  <p className="text-xs text-green-600 font-poppins text-right">
                    Promo kod {appliedPromoCode} primenjen ({appliedPromoCode === "ils-10" ? "−10%" : "−50%"})
                  </p>
                )}
                <div className="border-t border-foreground/10 pt-3">
                  <p className="text-xs text-foreground/40 font-poppins mb-1.5">USLUGE</p>
                  <p className="text-sm font-poppins font-semibold text-foreground/50">Konsultacija (15 min)</p>
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

              <button
                onClick={handleClose}
                className="mt-6 w-full py-3 rounded-full text-sm font-semibold tracking-widest font-poppins text-white cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent.hex }}
              >
                ZATVORI
              </button>
            </div>
          )}
        </div>

        {/* ── Footer: step 2 continue ───────────────────────────────────── */}
        {step === 2 && selectedIds.length > 0 && (
          <div className="px-6 py-4 border-t border-foreground/10 shrink-0 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-xs text-foreground/50 font-poppins">Ukupno vreme termina</p>
                <p className="text-lg font-bold font-poppins">{totalDuration} min</p>
                <p className="text-[11px] text-foreground/40 font-poppins">uklj. konsultacija i pauze</p>
              </div>
              <div>
                {appliedCombos.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold font-poppins text-white"
                      style={{ backgroundColor: accent.hex }}
                    >
                      COMBO
                    </span>
                    <span className="text-[11px] font-poppins text-green-600 font-semibold">
                      -{formatPrice(comboSaving)} RSD popusta
                    </span>
                  </div>
                )}
                <p className="text-xs text-foreground/50 font-poppins">Cena tretmana</p>
                {comboSaving > 0 && (
                  <p className="text-[11px] text-foreground/35 font-poppins line-through leading-none">
                    {formatPrice(basePrice)} RSD
                  </p>
                )}
                <p className="text-sm font-bold font-poppins" style={{ color: accent.hex }}>
                  {formatPrice(totalPrice)} RSD
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 rounded-full text-xs font-semibold tracking-widest font-poppins text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: accent.hex }}
            >
              NASTAVI
            </button>
          </div>
        )}

        {/* Bottom accent bar */}
        <div className="h-1 bg-linear-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
