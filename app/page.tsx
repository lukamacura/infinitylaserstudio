"use client";

import { useState, useEffect } from "react";
import BookingModal from "@/components/BookingModal";
import PromoPopup from "@/components/PromoPopup";
import Hero from "@/components/Hero";
import FeaturedServices from "@/components/FeaturedServices";
import BrandStory from "@/components/BrandStory";
import ServiceHighlights from "@/components/ServiceHighlights";
import StatsSection from "@/components/StatsSection";
import MenSection from "@/components/MenSection";
import FAQSection from "@/components/FAQSection";
import CostComparison from "@/components/CostComparison";
import CommunitySection from "@/components/CommunitySection";
import Footer from "@/components/Footer";

export default function Home() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const open = () => setBookingOpen(true);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main>
      <Hero onOpen={open} />
      <FeaturedServices onOpen={open} />
      <BrandStory />
      <ServiceHighlights />
      <StatsSection />
      <CostComparison onOpen={open} />
      <MenSection onOpen={open} />
      <FAQSection />
      <CommunitySection onOpen={open} />
      <Footer onOpen={open} />
      <BookingModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
      <PromoPopup onOpenBooking={open} isBookingOpen={bookingOpen} />
      {showSticky && (
        <button
          onClick={open}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-white text-xs font-semibold tracking-widest font-poppins shadow-lg hover:bg-foreground/90 transition-all cursor-pointer"
          style={{ animation: "fadeInUp 0.3s ease forwards" }}
        >
          ZAKAŽI
        </button>
      )}
    </main>
  );
}
