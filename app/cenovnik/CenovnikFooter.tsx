"use client";

import { useState } from "react";
import Footer from "@/components/Footer";
import BookingModal from "@/components/BookingModal";

export default function CenovnikFooter() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Footer onOpen={() => setOpen(true)} />
      <BookingModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
