"use client";

import Script from "next/script";
import { motion } from "framer-motion";

export default function WistiaVideo() {
  return (
    <section className="py-16 md:py-20 px-6 bg-cream">
      <motion.div
        className="max-w-lg mx-auto flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
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
              background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/vwpjkz1l7z/swatch');
              display: block;
              filter: blur(5px);
              padding-top: 177.78%;
            }
          `}</style>
          <Script src="https://fast.wistia.com/player.js" strategy="lazyOnload" />
          <Script src="https://fast.wistia.com/embed/vwpjkz1l7z.js" strategy="lazyOnload" />
          {/* @ts-expect-error - wistia-player is a web component */}
          <wistia-player media-id="vwpjkz1l7z" wistia-popover="true" aspect="0.5625" />
        </div>
      </motion.div>
    </section>
  );
}
