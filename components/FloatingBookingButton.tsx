"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BookingModal from "./BookingModal";

export default function FloatingBookingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);

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

      <AnimatePresence>
        {visible && (
          <motion.button
            onClick={() => setIsOpen(true)}
            className="cursor-pointer fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-poppins font-semibold text-base px-10 py-3.5 rounded-full bg-pink text-black tracking-wide"
            style={{ animation: "floatingGlow 2.2s ease-in-out infinite" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Zakaži tretman"
          >
            Zakaži
          </motion.button>
        )}
      </AnimatePresence>

      <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
