"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, X } from "lucide-react";

const NAMES = [
  "Tara", "Mina", "Katarina", "Stefana", "Svetlana",
  "Petra", "Branka", "Lena", "Melanija", "Zorica", "Mirjana",
];

const SESSION_KEY = "social_proof_shown";

/** Same iOS-style banner as the Ana notices in BookingModal. */
export default function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (/^\/(admin|finances|stats)(\/|$)/.test(window.location.pathname)) return;

    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(randomName);

    const show = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(true);
    }, 3000);

    return () => clearTimeout(show);
  }, []);

  // Auto-dismiss like a real notification (X / swipe up dismisses instantly).
  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(hide);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="social-proof"
          className="bm-theme bm-theme-zene fixed top-0 left-0 right-0 z-60 flex justify-center px-3 pt-3 pointer-events-none"
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
              if (info.offset.y < -32 || info.velocity.y < -450) setVisible(false);
            }}
            className="pointer-events-auto relative w-full max-w-[430px] sm:max-w-[520px] rounded-[24px] sm:rounded-[28px] border border-foreground/10 bg-[var(--bm-surface)] p-3.5 sm:p-5 pr-9 sm:pr-11 shadow-[0_16px_44px_-10px_rgba(0,0,0,0.7)] cursor-grab active:cursor-grabbing"
          >
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 active:scale-90 transition-all cursor-pointer"
              aria-label="Zatvori obaveštenje"
            >
              <X size={13} strokeWidth={2.6} className="text-foreground/60" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-[14px] sm:rounded-[18px] flex items-center justify-center shrink-0 ring-1 ring-white/10 shadow-sm bg-[var(--bm-accent)]/15">
                <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--bm-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-[13px] sm:text-[15px] font-bold font-poppins text-foreground tracking-tight truncate">
                    Nova rezervacija
                  </p>
                  <span className="text-[10px] sm:text-xs font-poppins text-foreground/40 shrink-0 ml-auto mr-1">sada</span>
                </div>
                <p className="mt-0.5 sm:mt-1 text-[13px] sm:text-[15px] leading-snug font-poppins text-foreground/80">
                  {name} je rezervisala svoj 1. tretman.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
