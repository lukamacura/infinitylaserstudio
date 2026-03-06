"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface PromoPopupProps {
  onOpenBooking: () => void;
  isBookingOpen: boolean;
}

type PopupState =
  | "idle"
  | "success"
  | "error_duplicate"
  | "error_invalid_email"
  | "error_network";

const MONTH_NAMES_GEN = [
  "januara", "februara", "marta", "aprila", "maja", "juna",
  "jula", "avgusta", "septembra", "oktobra", "novembra", "decembra",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PromoPopup({ onOpenBooking, isBookingOpen }: PromoPopupProps) {
  const [visible, setVisible]         = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [popupState, setPopupState]   = useState<PopupState>("idle");
  const [email, setEmail]             = useState("");
  const [submitting, setSubmitting]   = useState(false);

  const triggeredRef = useRef(false);

  const currentMonthName = MONTH_NAMES_GEN[new Date().getMonth()];

  // ── Mount: show after 5s every visit ────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return;

    const timer = setTimeout(() => {
      if (triggeredRef.current || isBookingOpen) return;
      triggeredRef.current = true;
      setVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    }, 5000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleClose() {
    setIsAnimating(false);
    setTimeout(() => setVisible(false), 300);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!EMAIL_REGEX.test(email.trim())) {
      setPopupState("error_invalid_email");
      return;
    }

    setSubmitting(true);
    setPopupState("idle");

    const { error } = await supabase
      .from("leads")
      .insert({ email: email.trim(), source: "popup" });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setPopupState("error_duplicate");
      } else {
        setPopupState("error_network");
      }
      return;
    }

    setPopupState("success");
  }

  function handleBookNow() {
    handleClose();
    onOpenBooking();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Modal shell */}
      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
          aria-label="Zatvori"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="px-7 pt-8 pb-6">
          <AnimatePresence mode="wait">
            {popupState !== "success" ? (
              <motion.div
                key="idle"
                initial={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {/* Label chip */}
                <p className="font-poppins text-xs tracking-[3px] text-foreground/50 mb-4 uppercase">
                  EKSKLUZIVNA PONUDA
                </p>

                {/* Headline */}
                <h2 className="font-playfair text-3xl font-bold leading-tight mb-3">
                  -50% na tvoj prvi tretman.
                </h2>

                {/* Body */}
                <p className="font-poppins text-sm text-foreground/60 mb-2">
                  Ostavi email i odmah dobijaš promo kod.
                  Važi za sve zone - noge, pazuhe, lice, intimna zona.
                </p>

                {/* Reassurance */}
                <p className="font-poppins text-xs text-foreground/35 mb-5">
                  Bez neželjene pošte. Koristimo email samo za slanje koda.
                </p>

                {/* Error: duplicate */}
                {popupState === "error_duplicate" && (
                  <div className="bg-amber-50 text-amber-700 rounded-xl p-3 text-xs font-poppins mb-3">
                    Ovaj email je već iskoristio ponudu. Ako misliš da je greška, kontaktiraj nas.
                  </div>
                )}

                {/* Error: network */}
                {popupState === "error_network" && (
                  <div className="bg-red-50 text-red-600 rounded-xl p-3 text-xs font-poppins mb-3">
                    Nešto nije pošlo po planu. Pokušaj ponovo.
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Email input */}
                  <div className="mb-1">
                    <input
                      type="email"
                      placeholder="tvoj@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (popupState === "error_invalid_email") setPopupState("idle");
                      }}
                      className="w-full border-2 border-foreground/10 rounded-xl px-4 py-3 font-poppins text-sm focus:outline-none transition-colors"
                      onFocus={(e) => (e.target.style.borderColor = "#E85D8A")}
                      onBlur={(e) => (e.target.style.borderColor = "")}
                    />
                    {/* Error: invalid email */}
                    {popupState === "error_invalid_email" && (
                      <p className="text-xs text-red-500 font-poppins mt-1">
                        Unesite ispravnu email adresu.
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-4 py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    style={{ backgroundColor: "#E85D8A" }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Slanje...
                      </span>
                    ) : "POŠALJI MI KOD"}
                  </button>
                </form>

                {/* Below-CTA */}
                <p className="font-poppins text-xs text-foreground/35 text-center mt-3">
                  Ponuda važi do kraja {currentMonthName}.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col items-center text-center"
              >
                {/* Label chip */}
                <p className="font-poppins text-xs tracking-[3px] text-foreground/50 mb-5 uppercase">
                  TVOJ PROMO KOD
                </p>

                {/* Code block */}
                <div className="bg-teal/10 border border-teal/30 rounded-2xl px-6 py-4 mb-5">
                  <p
                    className="text-3xl font-bold font-poppins tracking-widest"
                    style={{ color: "#0D9488" }}
                  >
                    tb-2026
                  </p>
                </div>

                {/* Instruction */}
                <p className="font-poppins text-sm text-foreground/60 mb-6">
                  Unesi ovaj kod u koraku &ldquo;Promo kod&rdquo; prilikom zakazivanja.
                  50% popust se automatski primenjuje na ukupnu cenu.
                </p>

                {/* CTA */}
                <button
                  onClick={handleBookNow}
                  className="w-full py-3.5 rounded-full text-sm font-semibold tracking-widest font-poppins text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: "#E85D8A" }}
                >
                  ZAKAŽI ODMAH
                </button>

                {/* Below-CTA */}
                <p className="font-poppins text-xs text-foreground/35 text-center mt-3">
                  Kod je vezan za tvoj email. Važi za jedan tretman.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-linear-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
