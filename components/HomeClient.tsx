"use client";

import { useState, useEffect } from "react";
import BookingModal from "@/components/BookingModal";
import Hero from "@/components/Hero";
import FeaturedServices from "@/components/FeaturedServices";
import BrandStory from "@/components/BrandStory";
import ServiceHighlights from "@/components/ServiceHighlights";
import StatsSection from "@/components/StatsSection";
// import MenSection from "@/components/MenSection";
import FAQSection from "@/components/FAQSection";
import CostComparison from "@/components/CostComparison";
import TeamSection from "@/components/TeamSection";
import CommunitySection from "@/components/CommunitySection";
import Footer from "@/components/Footer";
import WistiaVideo from "@/components/WistiaVideo";

export default function HomeClient() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedNames, setPreselectedNames] = useState<string[]>([]);
  const [showSticky, setShowSticky] = useState(false);

  function open() {
    setPreselectedNames([]);
    setBookingOpen(true);
  }

  function openWithPreselect(keywords: string[]) {
    setPreselectedNames(keywords);
    setBookingOpen(true);
  }

  useEffect(() => {
    let depth50Fired = false;
    const onScroll = () => {
      setShowSticky(window.scrollY > 400);
      if (!depth50Fired) {
        const scrolled = window.scrollY + window.innerHeight;
        const total = document.documentElement.scrollHeight;
        if (scrolled / total >= 0.5) {
          depth50Fired = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).fbq?.("trackCustom", "ScrollDepth50");
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main>
      <Hero onOpen={open} />
      <FeaturedServices onOpen={open} onOpenService={openWithPreselect} />
      <BrandStory />
      <WistiaVideo />
      <ServiceHighlights />
      <StatsSection />
      <CostComparison onOpen={open} />
      <TeamSection />
      {/* <MenSection onOpen={open} /> */}
<CommunitySection onOpen={open} />
      <FAQSection />
      <Footer onOpen={open} />
      <BookingModal
        isOpen={bookingOpen}
        onClose={() => { setBookingOpen(false); setPreselectedNames([]); }}
        preselectedNames={preselectedNames}
      />

      {/* Promo banner — fixed top-right */}
      <div className="fixed top-4 right-4 z-40 pointer-events-none select-none">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold font-poppins tracking-wide shadow-lg"
          style={{ backgroundColor: "#E85D8A" }}
        >
          <span className="text-xs leading-none">🏷</span>
          50% popusta na 1. tretman
        </div>
      </div>

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
