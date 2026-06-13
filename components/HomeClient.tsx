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
import MapSection from "@/components/MapSection";
import Footer from "@/components/Footer";
import WistiaVideo from "@/components/WistiaVideo";

// Region slug → service-name keywords (matched as substrings in BookingModal).
// Combos map to their component parts, just like the FeaturedServices cards.
const REGION_SLUGS: Record<string, string[]> = {
  "nausnice": ["nausnice"],
  "brada": ["brada"],
  "nausnice-brada": ["nausnice", "brada"],
  "celo-lice": ["celo lice"],
  "pazuh": ["pazuh"],
  "ruke": ["ruke"],
  "pola-ruku": ["1/2 ruku"],
  "noge": ["noge"],
  "pola-nogu": ["1/2 nogu"],
  "intima": ["intima"],
  "noge-intima": ["noge", "intima"],
  "celo-telo": ["celo telo"],
};

export default function HomeClient() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedNames, setPreselectedNames] = useState<string[]>([]);
  function open() {
    setPreselectedNames([]);
    setBookingOpen(true);
  }

  function openWithPreselect(keywords: string[]) {
    setPreselectedNames(keywords);
    setBookingOpen(true);
  }

  // Open the modal preselected to Žene + a region from a ?regija= link.
  // Runs once on mount (after hydration) to read the URL — an external system.
  useEffect(() => {
    const regija = new URLSearchParams(window.location.search).get("regija");
    if (!regija) return;
    const keywords = REGION_SLUGS[regija.toLowerCase()];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (keywords) openWithPreselect(keywords);
  }, []);

  useEffect(() => {
    let depth50Fired = false;
    const onScroll = () => {
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
      <MapSection/>
      <Footer onOpen={open} />
      <BookingModal
        isOpen={bookingOpen}
        onClose={() => { setBookingOpen(false); setPreselectedNames([]); }}
        preselectedNames={preselectedNames}
      />

    </main>
  );
}
