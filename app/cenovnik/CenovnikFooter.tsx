"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";

// Supabase + framer-motion stay out of the page bundle until the first open.
const BookingModal = dynamic(() => import("@/components/BookingModal"), { ssr: false });

export default function CenovnikFooter() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);
  return (
    <>
      <Footer onOpen={() => setOpen(true)} />
      {mounted && <BookingModal isOpen={open} onClose={() => setOpen(false)} />}
    </>
  );
}
