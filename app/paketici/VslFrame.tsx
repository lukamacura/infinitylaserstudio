"use client";

import Image from "next/image";
import Script from "next/script";
import { Play } from "lucide-react";
import { VSL_ASPECT, VSL_WISTIA_ID } from "@/lib/paketici";

/**
 * Branka's video. Full column width, but never taller than the screen leaves
 * it (`--vsl-h`, paketici.css), so the headline, the video and the button
 * are all in view at once. Wistia opens it as a popover (full screen on a
 * phone). Until the video exists (VSL_WISTIA_ID) the frame shows Branka with
 * "Video uskoro".
 */
export default function VslFrame() {
  return (
    <div
      className="pk-vsl relative w-full overflow-hidden rounded-[18px] bg-[#1E1017] ring-1 ring-accent/35 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
      style={{ aspectRatio: `${VSL_ASPECT}`, maxWidth: `calc(var(--vsl-h) * ${VSL_ASPECT})` }}
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
          {/* Portrait photo in a wide frame: keep her face in the band that shows. */}
          <Image
            src="/team/branka.webp"
            alt="Branka iz Infinity Laser Studija"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover object-[50%_22%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-black/25" />
          <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-poppins text-[11px] font-semibold text-foreground/90 backdrop-blur-sm">
            Video uskoro
          </span>
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full metal shadow-xl sm:h-16 sm:w-16" aria-hidden="true">
            <Play size={24} className="ml-1" fill="currentColor" />
          </span>
          <span className="absolute inset-x-3 bottom-2.5 text-left sm:inset-x-4 sm:bottom-3.5">
            <span className="block font-playfair text-base leading-tight text-foreground sm:text-lg">Branka</span>
            <span className="block font-poppins text-[11px] text-foreground/70 sm:text-[12px]">Šta žene stvarno žele - i kada epilacija nije moguća</span>
          </span>
        </>
      )}
    </div>
  );
}
