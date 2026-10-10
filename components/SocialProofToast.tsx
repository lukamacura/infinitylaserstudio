"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { isAdminPath } from "@/lib/adminRoutes";

// framer-motion (~40 KB) is fetched only when the banner is due, 10 s in.
const SocialProofBanner = dynamic(() => import("@/components/SocialProofBanner"), { ssr: false });

const NAMES = [
  "Tara", "Mina", "Katarina", "Stefana", "Svetlana",
  "Petra", "Branka", "Lena", "Melanija", "Zorica", "Mirjana",
];

const SESSION_KEY = "social_proof_shown";

/** Same iOS-style banner as the Ana notices in BookingModal. */
export default function SocialProofToast() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (isAdminPath(window.location.pathname)) return;

    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
    // Start the download a little early so the banner appears on time.
    const prefetch = setTimeout(() => { void import("@/components/SocialProofBanner"); }, 8000);
    const show = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setName(randomName);
    }, 10000);

    return () => { clearTimeout(prefetch); clearTimeout(show); };
  }, []);

  return name ? <SocialProofBanner name={name} /> : null;
}
