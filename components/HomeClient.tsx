"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Hero from "@/components/Hero";
import BrandStory from "@/components/BrandStory";
import ServiceHighlights from "@/components/ServiceHighlights";
import StatsSection from "@/components/StatsSection";
import CostComparison from "@/components/CostComparison";
// import MenSection from "@/components/MenSection";
import FAQSection from "@/components/FAQSection";
import TeamSection from "@/components/TeamSection";
import CommunitySection from "@/components/CommunitySection";
import LocationsSection from "@/components/LocationsSection";
import Footer from "@/components/Footer";
import WistiaVideo from "@/components/WistiaVideo";
import ScrollReveal from "@/components/ScrollReveal";
import type { LocationId } from "@/lib/locations";
import type { FunnelSource } from "@/lib/funnel";
import { urlHasLinkPromo } from "@/lib/linkPromo";

// Heavy (Supabase + framer-motion) and never visible on first paint — load it on demand.
const BookingModal = dynamic(() => import("@/components/BookingModal"), { ssr: false });

// Region slug → service-name keywords (matched as substrings in BookingModal).
// Combos map to their component parts.
type Gender = "zene" | "muskarci";

const REGION_SLUGS_ZENE: Record<string, string[]> = {
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

const REGION_SLUGS_MUSKARCI: Record<string, string[]> = {
  "lice": ["lice"],
  "pola-lica": ["1/2 lica"],
  "pazuh": ["pazuh"],
  "ruke": ["ruke"],
  "pola-ruku": ["1/2 ruku"],
  "grudi": ["grudi"],
  "stomak": ["stomak"],
  "stomak-grudi": ["stomak", "grudi"],
  "ledja": ["leđa"],
  "pola-ledja": ["1/2 leđa"],
  "noge": ["noge"],
  "pola-nogu": ["1/2 nogu"],
};

const REGION_SLUGS: Record<Gender, Record<string, string[]>> = {
  zene: REGION_SLUGS_ZENE,
  muskarci: REGION_SLUGS_MUSKARCI,
};

// ?lokacija= slug → studio id.
const LOCATION_SLUGS: Record<string, LocationId> = {
  "novi-sad": "novi_sad",
  "sombor": "sombor",
};

export default function HomeClient() {
  const [bookingOpen, setBookingOpen] = useState(false);
  // Mount the modal only after the first open, then keep it mounted for exit animations.
  const [bookingMounted, setBookingMounted] = useState(false);
  if (bookingOpen && !bookingMounted) setBookingMounted(true);
  const [preselectedNames, setPreselectedNames] = useState<string[]>([]);
  const [preselectedBundle, setPreselectedBundle] = useState<number | undefined>(undefined);
  const [preselectedGender, setPreselectedGender] = useState<Gender | undefined>(undefined);
  const [preselectedStudio, setPreselectedStudio] = useState<LocationId | undefined>(undefined);
  /** Which button (or link) opened the modal - for /fnl. */
  const [bookingSource, setBookingSource] = useState<FunnelSource>("hero");
  function open(source: FunnelSource) {
    setBookingSource(source);
    setPreselectedNames([]);
    setPreselectedBundle(undefined);
    setPreselectedGender(undefined);
    setPreselectedStudio(undefined);
    setBookingOpen(true);
  }

  // Open the modal from a link. Every param is optional and they combine:
  //   ?lokacija=novi-sad|sombor  skips the studio step
  //   ?pol=zene|muskarci         skips the gender step
  //   ?regija=<slug>             preselects regions (implies Žene without ?pol=)
  //   ?book=1                    opens with nothing preselected
  //   ?promo=popust20            −20% on everything (see lib/linkPromo.ts)
  // An unknown value is ignored, the rest of the link still applies.
  // Runs once on mount (after hydration) to read the URL — an external system.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const polParam = params.get("pol")?.toLowerCase();
    const pol: Gender | undefined =
      polParam === "zene" || polParam === "muskarci" ? polParam : undefined;
    const regija = params.get("regija")?.toLowerCase();
    const studio = LOCATION_SLUGS[params.get("lokacija")?.toLowerCase() ?? ""];
    const keywords = regija ? REGION_SLUGS[pol ?? "zene"][regija] : undefined;
    const gender: Gender | undefined = pol ?? (keywords ? "zene" : undefined);

    if (!keywords && !gender && !studio && params.get("book") !== "1" && !urlHasLinkPromo()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreselectedNames(keywords ?? []);
    setPreselectedBundle(undefined);
    setPreselectedGender(gender);
    setPreselectedStudio(studio);
    setBookingSource("link");
    setBookingOpen(true);
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
      <Hero onOpen={() => open("hero")} />
      <StatsSection />
      <CostComparison />
      <ServiceHighlights />
      <WistiaVideo />
      <BrandStory />
      <TeamSection />
      {/* <MenSection onOpen={open} /> */}
<CommunitySection onOpen={() => open("zajednica")} />
      <FAQSection />
      <LocationsSection />
      <Footer onOpen={() => open("footer")} />
      <ScrollReveal />
      {bookingMounted && <BookingModal
        isOpen={bookingOpen}
        onClose={() => { setBookingOpen(false); setPreselectedNames([]); setPreselectedBundle(undefined); setPreselectedGender(undefined); setPreselectedStudio(undefined); }}
        preselectedNames={preselectedNames}
        preselectedBundle={preselectedBundle}
        preselectedGender={preselectedGender}
        preselectedStudio={preselectedStudio}
        source={bookingSource}
      />}

    </main>
  );
}
