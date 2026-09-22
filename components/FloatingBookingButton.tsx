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

  return (
    <>
      <style>{`
        @keyframes floatingGlow {
          0%, 100% { box-shadow: 0 0 16px 4px rgba(230,100,140,0.35), 0 0 32px 8px rgba(230,100,140,0.15); }
          50% { box-shadow: 0 0 28px 10px rgba(230,100,140,0.55), 0 0 56px 18px rgba(230,100,140,0.25); }
        }
      `}</style>

      {/* Always rendered; `invisible` removes it from focus/clicks while hidden. */}
      <button
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-poppins font-semibold text-base px-10 py-3.5 rounded-full bg-pink text-black tracking-wide transition-[opacity,translate,scale,visibility] duration-300 ease-out hover:scale-106 active:scale-97 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 invisible"
        }`}
        style={{ animation: "floatingGlow 2.2s ease-in-out infinite" }}
        aria-label="Zakaži tretman"
      >
        Zakaži
      </button>

      {mounted && <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
