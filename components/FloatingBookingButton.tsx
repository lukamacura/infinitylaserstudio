"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { isAdminPath } from "@/lib/adminRoutes";

const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

export default function FloatingBookingButton() {
  const pathname = usePathname();
  const isPrivatePage = isAdminPath(pathname);
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
    if (isPrivatePage) return;
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
  }, [isPrivatePage]);

  // The admin pages are for staff - no booking button over the calendar.
  if (isPrivatePage) return null;

  return (
    <>
      {/* Same CTA as the hero. Always rendered; `invisible` removes it from focus/clicks while hidden. */}
      <span
        className={`cta-halo fixed bottom-6 left-1/2 -translate-x-1/2 z-40 inline-flex transition-[opacity,translate,visibility] duration-300 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 invisible"
        }`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="group metal relative overflow-hidden inline-flex items-center justify-between gap-5 h-14 lg:h-16 pl-8 pr-2.5 rounded-full text-base lg:text-[17px] font-bold tracking-[0.06em] whitespace-nowrap cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <span className="cta-sweep" aria-hidden="true" />
          <span className="relative">ZAKAŽI TERMIN</span>
          <span className="relative flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-on-accent text-accent transition-transform duration-300 ease-out group-hover:translate-x-1">
            <ArrowRight size={18} strokeWidth={2.2} />
          </span>
        </button>
      </span>

      {mounted && <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
