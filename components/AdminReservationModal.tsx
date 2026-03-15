"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X, ArrowLeft, Calendar, Clock, User, Mail, Phone, FileText,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  supabase, calcBookingDuration, getAvailableSlots, getBusinessHours,
  minutesToTime, timeToMinutes, SLOT_SIZE,
} from "@/lib/supabase";
import type { Service } from "@/lib/database.types";

const DEFAULT_DURATION = 30; // min when no services selected

interface AdminReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4 | "success";

const CTA_BASE =
  "w-full py-3.5 rounded-full text-white text-sm font-semibold tracking-widest font-poppins transition-all duration-200 ";
const CTA_ENABLED =
  "bg-[#0D9488] hover:scale-[1.02] hover:shadow-lg hover:shadow-teal/30 active:scale-[0.99] cursor-pointer";
const CTA_DISABLED = "bg-teal/70 cursor-not-allowed opacity-50";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatPrice(price: number): string {
  return price.toLocaleString("sr-RS");
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminReservationModal({
  isOpen,
  onClose,
  onSuccess,
}: AdminReservationModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [selectedDate, setSelectedDate] = useState("");

  // Step 2
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [daySlots, setDaySlots] = useState<{ start_time: string; end_time: string; status: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 4 (customer form)
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState({ name: false, email: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [promoChecking, setPromoChecking] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);

  const selectedServices = useMemo(
    () => services.filter((s) => selectedIds.includes(s.id)),
    [services, selectedIds]
  );
  const totalDuration =
    selectedServices.length > 0 ? calcBookingDuration(selectedServices) : DEFAULT_DURATION;
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const isToday = selectedDate === todayStr;
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
  const minStart = isToday ? nowMinutes : undefined;

  const biz = selectedDate ? getBusinessHours(selectedDate) : null;
  const availableSlots = biz
    ? getAvailableSlots(daySlots, totalDuration, minStart, biz.start, biz.end)
    : [];

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingServices(true);
    supabase
      .from("services")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        setServices(data ?? []);
        setLoadingServices(false);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedTime("");
    supabase
      .from("reservations")
      .select("start_time, end_time, status")
      .eq("date", selectedDate)
      .then(({ data }) => {
        setDaySlots(data ?? []);
        setLoadingSlots(false);
      });
  }, [selectedDate]);

  function resetAll() {
    setStep(1);
    setSelectedDate("");
    setSelectedIds([]);
    setSelectedTime("");
    setForm({ name: "", email: "", phone: "", notes: "" });
    setFieldErrors({ name: false, email: false });
    setSubmitError(null);
    setPromoCode("");
    setPromoStatus("idle");
    setDiscountedPrice(null);
    setAppliedPromoCode(null);
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
    setTimeout(() => {
      onClose();
      resetAll();
    }, 300);
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
      setSelectedTime("");
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    }
  }

  function toggleService(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    const errors = { name: !form.name.trim(), email: !form.email.trim() };
    setFieldErrors(errors);
    if (errors.name || errors.email || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    setSubmitError(null);

    const endTime = minutesToTime(timeToMinutes(selectedTime) + totalDuration);

    const { data: res, error } = await supabase
      .from("reservations")
      .insert({
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim() || null,
        date: selectedDate,
        start_time: `${selectedTime}:00`,
        end_time: `${endTime}:00`,
        total_duration: totalDuration,
        status: "confirmed",
        notes: form.notes.trim() || null,
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
        selectedIds.map((serviceId) => ({
          reservation_id: res.id,
          service_id: serviceId,
        }))
      );
    }

    if (promoStatus === "valid" && appliedPromoCode === "tb-2026") {
      await supabase
        .from("leads")
        .update({ promo_used: true })
        .eq("email", form.email.trim());
    }

    const bookingRefValue = res.id.slice(-8).toUpperCase();

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
        services:         selectedServices.map((s) => ({ name: s.name, price: s.price })),
        total_duration:   totalDuration,
        total_price:      totalPrice,
        discounted_price: discountedPrice,
        promo_code:       appliedPromoCode,
        booking_ref:      bookingRefValue,
      }),
    }).catch(() => {});

    setStep("success");
    setSubmitting(false);
    onSuccess?.();
  }

  if (!isOpen) return null;

  const stepLabels: Record<Step, [string, string]> = {
    1: ["KORAK 1 OD 4", "Izaberi datum"],
    2: ["KORAK 2 OD 4", "Izaberi vreme"],
    3: ["KORAK 3 OD 4", "Regije za tretman"],
    4: ["KORAK 4 OD 4", "Vaši podaci"],
    success: ["GOTOVO", "Rezervacija kreirana"],
  };
  const [stepLabel, stepSub] = stepLabels[step];
  const minDate = todayStr;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {(step === 2 || step === 3 || step === 4) && (
              <button
                type="button"
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
                aria-label="Nazad"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-xl font-bold font-playfair">Nova rezervacija</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
            aria-label="Zatvori"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-4 shrink-0">
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">
            {stepLabel}
          </p>
          <p className="text-sm text-foreground/60 font-poppins mt-1">{stepSub}</p>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {/* Step 1: Date */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins">
                DATUM
              </p>
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-foreground/30 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-foreground/10 focus:border-teal focus:outline-none font-poppins text-sm transition-colors"
                />
              </div>
              {selectedDate && !biz && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-foreground/5 text-foreground/50 text-sm font-poppins">
                  <AlertCircle size={16} />
                  Radnim danom nije radno (nedelja).
                </div>
              )}
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedDate || !biz}
                className={CTA_BASE + (selectedDate && biz ? CTA_ENABLED : CTA_DISABLED)}
              >
                NASTAVI
              </button>
            </div>
          )}

          {/* Step 2: Time slots only */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1 flex items-center gap-2">
                <Clock size={14} className="text-foreground/40" />
                SLOBODNI TERMINI
              </p>
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
                      className={`py-2.5 rounded-lg text-sm font-semibold font-poppins transition-all cursor-pointer ${
                        selectedTime === slot
                          ? "bg-teal text-white"
                          : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedTime}
                className={CTA_BASE + (selectedTime ? CTA_ENABLED : CTA_DISABLED)}
              >
                NASTAVI
              </button>
            </div>
          )}

          {/* Step 3: Service regions only */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-1">
                REGIJE ZA TRETMAN (opciono)
              </p>
              {loadingServices ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={22} className="animate-spin text-foreground/30" />
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {services.map((service) => {
                    const isSelected = selectedIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`flex items-center gap-3 w-full p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-teal bg-teal/10"
                            : "border-foreground/8 hover:border-foreground/20"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? "border-teal bg-teal" : "border-foreground/20"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-poppins flex-1 truncate">
                          {service.name}
                        </span>
                        <span className="text-xs text-foreground/50 font-poppins shrink-0">
                          {service.service_duration} min · {formatPrice(service.price)} RSD
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-foreground/40 font-poppins">
                Trajanje: {totalDuration} min
                {selectedServices.length > 0 && (
                  <> · Ukupno: <span className="font-semibold text-foreground/70">{formatPrice(totalPrice)} RSD</span></>
                )}
              </p>
              <button
                type="button"
                onClick={() => setStep(4)}
                className={CTA_BASE + CTA_ENABLED}
              >
                NASTAVI
              </button>
            </div>
          )}

          {/* Step 4: Customer form (Vaši podaci) — prices + promo */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {/* Price summary */}
              {selectedServices.length > 0 && (
                <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10">
                  <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">CENA</p>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-poppins text-foreground/60">Ukupno ({selectedServices.length} usluge)</span>
                    <span className="text-lg font-bold font-poppins text-teal">{formatPrice(discountedPrice ?? totalPrice)} RSD</span>
                  </div>
                  {promoStatus === "valid" && discountedPrice != null && (
                    <p className="text-xs text-foreground/50 font-poppins mt-1 line-through">{formatPrice(totalPrice)} RSD</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">
                  Ime i prezime *
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    type="text"
                    placeholder="Ana Marković"
                    value={form.name}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, name: e.target.value }));
                      setFieldErrors((p) => ({ ...p, name: false }));
                    }}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${
                      fieldErrors.name ? "border-red-400 bg-red-50" : "border-foreground/10 focus:border-teal"
                    }`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-xs text-red-500 font-poppins mt-1">Unesite ime i prezime.</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    type="email"
                    placeholder="ana@primer.rs"
                    value={form.email}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, email: e.target.value }));
                      setFieldErrors((p) => ({ ...p, email: false }));
                    }}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 focus:outline-none font-poppins text-sm transition-colors ${
                      fieldErrors.email ? "border-red-400 bg-red-50" : "border-foreground/10 focus:border-teal"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 font-poppins mt-1">Unesite email adresu.</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">
                  Telefon
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    type="tel"
                    placeholder="+381 60 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-foreground/10 focus:border-teal focus:outline-none font-poppins text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-foreground/50 font-poppins mb-1">
                  Napomena
                </label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3 top-3 text-foreground/30" />
                  <textarea
                    placeholder="Opciono..."
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-foreground/10 focus:border-teal focus:outline-none font-poppins text-sm transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Promo code — same UX as BookingModal */}
              <div>
                <p className="text-xs font-semibold tracking-widest text-foreground/40 font-poppins mb-2">PROMO KOD</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="npr. xx-yyyy"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoStatus("idle");
                      setDiscountedPrice(null);
                      setAppliedPromoCode(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-foreground/10 focus:border-teal focus:outline-none font-poppins text-sm transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoChecking}
                    className="px-4 py-3 rounded-xl text-xs font-semibold tracking-widest font-poppins text-white bg-teal hover:bg-[#0B8078] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                        ? "Kod primenjen - 10% popusta."
                        : "Kod primenjen - 50% popusta."}
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
                      ? "Nema prethodnih rezervacija."
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

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={CTA_BASE + (submitting ? CTA_DISABLED : CTA_ENABLED)}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Kreiranje...
                  </span>
                ) : (
                  "KREIRAJ REZERVACIJU"
                )}
              </button>
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
                <CheckCircle2 size={44} className="text-green-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold font-playfair mb-2">Rezervacija kreirana</h3>
              <p className="text-sm text-foreground/50 font-poppins mb-6">
                {selectedDate} · {selectedTime} · {form.name}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className={CTA_BASE + CTA_ENABLED}
              >
                ZATVORI
              </button>
            </div>
          )}
        </div>

        <div className="h-1 bg-gradient-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
