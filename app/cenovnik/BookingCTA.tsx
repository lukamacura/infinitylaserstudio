"use client";

import { useState } from "react";
import BookingModal from "@/components/BookingModal";

export default function BookingCTA() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-poppins text-sm font-medium tracking-widest text-gray-800 bg-teal hover:bg-foreground hover:text-white transition-colors cursor-pointer"
      >
        ZAKAŽI TERMIN
      </button>
      <BookingModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
