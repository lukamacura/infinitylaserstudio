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
    <section ref={sectionRef} className="section-y px-6 bg-background-alt">
      <Reveal className="max-w-sm mx-auto flex flex-col items-center gap-6">
        <h2 className="font-playfair text-[1.5rem] sm:text-[1.75rem] text-foreground text-center leading-[1.25]">
          Pogledaj video da vidiš kako je nastao{" "}
          <span className="relative inline-block">
            naš studio
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </h2>

        <div className="w-full max-w-[18rem] rounded-2xl overflow-hidden shadow-lg">
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
