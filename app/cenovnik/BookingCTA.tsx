"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Supabase + framer-motion stay out of the page bundle until the first open.
const BookingModal = dynamic(() => import("@/components/BookingModal"), { ssr: false });

export default function BookingCTA() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-poppins text-sm font-medium tracking-widest text-on-accent bg-accent hover:bg-accent-soft transition-colors cursor-pointer"
      >
        ZAKAŽI TERMIN
      </button>
      {mounted && <BookingModal isOpen={open} onClose={() => setOpen(false)} />}
    </>
  );
}
