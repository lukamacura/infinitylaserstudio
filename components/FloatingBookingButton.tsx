"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import BookingModal from "./BookingModal";

export default function FloatingBookingButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="cursor-pointer fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-poppins font-semibold text-base px-10 py-3.5 rounded-full bg-pink text-black tracking-wide shadow-lg"
        animate={{
          boxShadow: [
            "0 0 16px 4px rgba(230,100,140,0.35), 0 0 32px 8px rgba(230,100,140,0.15)",
            "0 0 28px 10px rgba(230,100,140,0.55), 0 0 56px 18px rgba(230,100,140,0.25)",
            "0 0 16px 4px rgba(230,100,140,0.35), 0 0 32px 8px rgba(230,100,140,0.15)",
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
        aria-label="Zakaži tretman"
      >
        Zakaži
      </motion.button>

      <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
