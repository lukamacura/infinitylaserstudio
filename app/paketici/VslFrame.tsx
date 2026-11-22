"use client";

import Image from "next/image";
import Script from "next/script";
import { Play } from "lucide-react";
import { VSL_ASPECT, VSL_WISTIA_ID } from "@/lib/paketici";

/**
 * Branka's video, sized to whatever height the screen leaves it: the landing
 * is one screen tall and this frame takes the rest. Wistia opens it as a
 * popover (full screen on a phone). Until the video exists (VSL_WISTIA_ID)
 * the frame shows Branka with "Video uskoro".
 */
export default function VslFrame() {
  const tall = VSL_ASPECT < 1;
  // Vertical video: the height decides the width. Wide video: the width decides.
  const size = tall ? "h-full max-w-full" : "w-full max-h-full";

  return (
    <div
      className={`relative ${size} overflow-hidden rounded-[22px] bg-[#1E1017] ring-1 ring-accent/35 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]`}
      style={{ aspectRatio: `${VSL_ASPECT}` }}
    >
      {VSL_WISTIA_ID ? (
        <>
          <style>{`
            wistia-player[media-id='${VSL_WISTIA_ID}']:not(:defined) {
              background: center / cover no-repeat url('https://fast.wistia.com/embed/medias/${VSL_WISTIA_ID}/swatch');
              display: block;
              width: 100%;
              height: 100%;
            }
          `}</style>
          {/* After the page has loaded: the player costs ~1.2s of main thread on a mid-range phone. */}
          <Script src="https://fast.wistia.com/player.js" strategy="lazyOnload" type="module" />
          <Script src={`https://fast.wistia.com/embed/${VSL_WISTIA_ID}.js`} strategy="lazyOnload" type="module" />
          {/* @ts-expect-error - wistia-player is a web component */}
          <wistia-player media-id={VSL_WISTIA_ID} wistia-popover="true" aspect={String(VSL_ASPECT)} style={{ width: "100%", height: "100%" }} />
        </>
      ) : (
        <>
          <Image
            src="/team/branka.webp"
            alt="Branka iz Infinity Laser Studija"
            fill
            priority
            sizes="(max-width: 1024px) 60vw, 420px"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-black/20" />
          <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-poppins text-[11px] font-semibold text-foreground/90 backdrop-blur-sm">
            Video uskoro
          </span>
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full metal shadow-xl" aria-hidden="true">
            <Play size={26} className="ml-1" fill="currentColor" />
          </span>
          <span className="absolute inset-x-3 bottom-3 text-left">
            <span className="block font-playfair text-lg leading-tight text-foreground">Branka</span>
            <span className="block font-poppins text-[11px] text-foreground/70">Šta žene stvarno žele - i kada epilacija nije moguća</span>
          </span>
        </>
      )}
    </div>
  );
}
