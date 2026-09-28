"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

export default function FloatingBookingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (isOpen && !mounted) setMounted(true);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > window.innerHeight * 0.8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Warm the booking-modal chunk (modal + Supabase client) once the page has
  // settled, so the first tap on any "Zakaži" button opens instantly instead of
  // waiting on a network round-trip. Kept off the critical path: a few seconds
  // after load, and only when the browser is idle.
  useEffect(() => {
    let idleId: number | undefined;
    const warm = () => { void import("./BookingModal"); };
    const t = setTimeout(() => {
      if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(warm, { timeout: 3000 });
      else warm();
    }, 3000);
    return () => {
      clearTimeout(t);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, []);

  return (
    <>
      <style>{`
        /* The shadow is painted once and only its opacity breathes: animating
           box-shadow itself repaints on every frame, for as long as the page is open. */
        @keyframes floatingGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .floating-glow::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: 0 0 28px 10px rgba(230,100,140,0.55), 0 0 56px 18px rgba(230,100,140,0.25);
          animation: floatingGlow 2.2s ease-in-out infinite;
          will-change: opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-glow::before { animation: none; }
        }
      `}</style>

      {/* Always rendered; `invisible` removes it from focus/clicks while hidden. */}
      <button
        onClick={() => setIsOpen(true)}
        className={`floating-glow cursor-pointer fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-poppins font-semibold text-base px-10 py-3.5 rounded-full bg-pink text-black tracking-wide transition-[opacity,translate,scale,visibility] duration-300 ease-out hover:scale-106 active:scale-97 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 invisible"
        }`}
        aria-label="Zakaži tretman"
      >
        Zakaži
      </button>

      {mounted && <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
