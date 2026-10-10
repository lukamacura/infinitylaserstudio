"use client";

import { useCallback, useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import ScrollReveal from "@/components/ScrollReveal";
import { OpenBookingContext } from "@/components/OpenBooking";
import type { LocationId } from "@/lib/locations";
import { trackLanding, type FunnelSource } from "@/lib/funnel";
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

/** Wraps the home page: booking form state, link params, page-wide effects. */
export default function HomeClient({ children }: { children: ReactNode }) {
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
  const open = useCallback((source: FunnelSource) => {
    setBookingSource(source);
    setPreselectedNames([]);
    setPreselectedBundle(undefined);
    setPreselectedGender(undefined);
    setPreselectedStudio(undefined);
    setBookingOpen(true);
  }, []);

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

    const opensForm = !!(keywords || gender || studio || params.get("book") === "1" || urlHasLinkPromo());
    trackLanding(opensForm ? "link" : "root");
    if (!opensForm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreselectedNames(keywords ?? []);
    setPreselectedBundle(undefined);
    setPreselectedGender(gender);
    setPreselectedStudio(studio);
    setBookingSource("link");
    setBookingOpen(true);
  }, []);

  // Switch on the handwriting font (see `.hand` in globals.css) on the first
  // scroll, or 3 s after the page has loaded - whichever comes first.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      document.documentElement.classList.add("hand-ready");
      cleanup();
    };
    const later = () => { timer = setTimeout(on, 3000); };
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("scroll", on);
      window.removeEventListener("load", later);
    }
    window.addEventListener("scroll", on, { once: true, passive: true });
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return cleanup;
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
    <OpenBookingContext.Provider value={open}>
    <main>
      {children}
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
    </OpenBookingContext.Provider>
  );
}
