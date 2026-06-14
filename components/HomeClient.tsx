"use client";

import { useState, useEffect } from "react";
import BookingModal from "@/components/BookingModal";
import Hero from "@/components/Hero";
import FeaturedServices from "@/components/FeaturedServices";
import BundleBuilderSection from "@/components/BundleBuilderSection";
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

export default function HomeClient() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedNames, setPreselectedNames] = useState<string[]>([]);
  const [preselectedBundle, setPreselectedBundle] = useState<number | undefined>(undefined);
  function open() {
    setPreselectedNames([]);
    setPreselectedBundle(undefined);
    setBookingOpen(true);
  }

  function openWithPreselect(keywords: string[], bundleSize?: number) {
    setPreselectedNames(keywords);
    setPreselectedBundle(bundleSize);
    setBookingOpen(true);
  }

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
      <BundleBuilderSection onOpen={open} onOpenBundle={openWithPreselect} />
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
        onClose={() => { setBookingOpen(false); setPreselectedNames([]); setPreselectedBundle(undefined); }}
        preselectedNames={preselectedNames}
        preselectedBundle={preselectedBundle}
      />

    </main>
  );
}
