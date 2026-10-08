"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Review = { name: string; quote: string };

const INTERVAL_MS = 3000;

// One card per view on phones, two from md up; slides one card every 3s.
// Pauses while hovered/focused/touched and stays still for reduced motion.
export default function ReviewsCarousel({ reviews, header }: { reviews: Review[]; header: ReactNode }) {
  const [perView, setPerView] = useState(1);
  const [rawIndex, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);

  const maxIndex = Math.max(0, reviews.length - perView);
  // Going from 1 to 2 per view can leave the index past the end
  const index = Math.min(rawIndex, maxIndex);

  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPerView(md.matches ? 2 : 1);
      setReduced(rm.matches);
    };
    sync();
    md.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    return () => {
      md.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (paused || reduced || maxIndex === 0) return;
    const id = window.setInterval(() => setIndex((i) => (i >= maxIndex ? 0 : i + 1)), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, maxIndex]);

  const go = (i: number) => setIndex(Math.min(Math.max(i, 0), maxIndex));

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Recenzije klijentkinja"
    >
      <div className="overflow-hidden -mx-2">
        <ul
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${(index * 100) / perView}%)` }}
        >
          {reviews.map((t, i) => (
            <li
              key={t.name}
              className="shrink-0 basis-full md:basis-1/2 px-2"
              aria-hidden={i < index || i >= index + perView}
            >
              <div className="h-full bg-surface rounded-2xl shadow-sm border border-foreground/8 px-5 py-5 flex flex-col gap-3">
                {header}
                <p className="font-poppins text-copy text-foreground/85">{t.quote}</p>
                <p className="mt-auto font-poppins text-meta font-semibold text-foreground/60">{t.name}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {maxIndex > 0 && (
        <div className="flex justify-center gap-2 mt-5">
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Recenzija ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-accent" : "w-1.5 bg-foreground/20 hover:bg-foreground/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
