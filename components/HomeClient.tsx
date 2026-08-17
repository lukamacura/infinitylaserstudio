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

// Region slug → service-name keywords (matched as substrings in BookingModal).
// Combos map to their component parts, just like the FeaturedServices cards.
type Gender = "zene" | "muskarci";

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
  const [preselectedBundle, setPreselectedBundle] = useState<number | undefined>(undefined);
  const [preselectedGender, setPreselectedGender] = useState<Gender | undefined>(undefined);
  function open() {
    setPreselectedNames([]);
    setPreselectedBundle(undefined);
    setPreselectedGender(undefined);
    setBookingOpen(true);
  }

  function openWithPreselect(keywords: string[], bundleSize?: number) {
    setPreselectedNames(keywords);
    setPreselectedBundle(bundleSize);
    setPreselectedGender(undefined);
    setBookingOpen(true);
  }

  function openWithGender(g: Gender) {
    setPreselectedNames([]);
    setPreselectedBundle(undefined);
    setPreselectedGender(g);
    setBookingOpen(true);
  }

  // Open the modal preselected to Žene + a region from a ?regija= link,
  // straight into a gender's treatment list from a ?pol= link,
  // or with nothing selected from a ?book=1 link.
  // Runs once on mount (after hydration) to read the URL — an external system.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regija = params.get("regija");
    if (regija) {
      const keywords = REGION_SLUGS[regija.toLowerCase()];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (keywords) openWithPreselect(keywords);
      return;
    }
    const pol = params.get("pol")?.toLowerCase();
    if (pol === "zene" || pol === "muskarci") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openWithGender(pol);
      return;
    }
    if (params.get("book") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      open();
    }
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
        onClose={() => { setBookingOpen(false); setPreselectedNames([]); setPreselectedBundle(undefined); setPreselectedGender(undefined); }}
        preselectedNames={preselectedNames}
        preselectedBundle={preselectedBundle}
        preselectedGender={preselectedGender}
      />

    </main>
  );
}
