"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Reveal from "@/components/Reveal";

export default function WistiaVideo() {
  // Everything Wistia (swatch image + player scripts) is far below the fold,
  // so load it only once the section is getting close.
  const sectionRef = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-20 px-6 bg-cream">
      <Reveal className="max-w-lg mx-auto flex flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500">
          <span className="w-6 h-px bg-teal inline-block" />
          Pogledajte video
          <span className="w-6 h-px bg-teal inline-block" />
        </span>

        <h2 className="font-playfair text-3xl md:text-4xl text-gray-800 text-center leading-tight">
          Zašto baš{" "}
          <span className="relative inline-block">
            Infinity Laser?
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#FCCAE2" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </h2>

        <div className="w-full rounded-2xl overflow-hidden shadow-lg">
          <style>{`
            wistia-player[media-id='vwpjkz1l7z']:not(:defined) {
              ${near ? "background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/vwpjkz1l7z/swatch');" : ""}
              display: block;
              filter: blur(5px);
              padding-top: 177.78%;
            }
          `}</style>
          {/* Wistia ships these as ES modules - without type="module" the embed
              script throws "Unexpected token 'export'" and its media data is lost.
              Rendered only once the section is near: the player costs ~1.2s of
              main-thread time on a mid-range phone. */}
          {near && (
            <>
              <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" type="module" />
              <Script src="https://fast.wistia.com/embed/vwpjkz1l7z.js" strategy="afterInteractive" type="module" />
            </>
          )}
          {/* @ts-expect-error - wistia-player is a web component */}
          <wistia-player media-id="vwpjkz1l7z" wistia-popover="true" aspect="0.5625" />
        </div>
      </Reveal>
    </section>
  );
}
