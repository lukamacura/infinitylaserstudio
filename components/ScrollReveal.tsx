"use client";

import { useEffect } from "react";

// Drives every `[data-rv]` element on the page (styles in globals.css, under
// "Scroll reveals"). One shared IntersectionObserver flips `data-rv-in` and CSS
// does the rest, so there is no per-element state, no re-render and no scroll
// listener. Mount it once, after the sections it should watch.
export default function ScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          // `data-rv-ratio` holds a tall piece back until that much of it shows.
          const need = Number(el.dataset.rvRatio) || 0;
          const inView = entry.isIntersecting && entry.intersectionRatio >= need;
          // Already scrolled past (anchor link, restored scroll position).
          const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          if (inView || passed) {
            el.setAttribute("data-rv-in", "");
            io.unobserve(el);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: [0, 0.35] },
    );
    document.querySelectorAll("[data-rv]:not([data-rv-in])").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
