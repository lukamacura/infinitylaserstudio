"use client";

import type { CSSProperties } from "react";
import Image from "next/image";

interface Props {
  onOpenService: (keywords: string[]) => void;
}

interface ServiceCard {
  name: string;
  price: string;
  keywords: string[];
  /** One poster per region in the combo, blended into a single image.
   *  They must share the same base artwork (all body or all face). */
  regions: { label: string; src: string }[];
}

const services: ServiceCard[] = [
  {
    name: "Noge + Intima",
    price: "6000 rsd",
    keywords: ["noge", "intima"],
    regions: [
      { label: "Noge", src: "/regije/zene/noge.webp" },
      { label: "Intima", src: "/regije/zene/intima.webp" },
    ],
  },
  {
    name: "Nausnice + brada",
    price: "1800 rsd",
    keywords: ["nausnice", "brada"],
    regions: [
      { label: "Nausnice", src: "/regije/zene/nausnice.webp" },
      { label: "Brada", src: "/regije/zene/brada.webp" },
    ],
  },
];

export default function FeaturedServices({ onOpenService }: Props) {
  return (
    <section id="usluge" className="scroll-mt-24 section-y px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div data-rv className="text-center mb-4">
          <h2 className="font-playfair text-4xl md:text-5xl text-foreground mb-3">
            Tretmani koji ti štede vreme
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <svg viewBox="0 0 180 14" className="w-44 h-3" fill="none">
              <path d="M4 10 Q30 2 60 8 Q90 14 120 6 Q150 -2 176 7" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </div>
        <p data-rv style={{ "--rv-i": 1 } as CSSProperties} className="text-center font-poppins text-foreground/60 text-base section-head">
          Popularne kombinacije tretmana. Jedno trajno rešenje.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {services.map((s, i) => (
            // The wrapper carries the scroll reveal; the card keeps its own hover transition.
            <div key={s.name} data-rv style={{ "--rv-i": i } as CSSProperties} className="flex">
            <button
              onClick={() => onOpenService(s.keywords)}
              className="group bg-surface rounded-3xl overflow-hidden shadow-sm border border-foreground/8 hover:shadow-xl hover:border-rose/30 transition-all duration-300 text-left cursor-pointer w-full"
            >
              {/* Image area — the posters of a combo share the same artwork and
                  differ only in which zone is lit, so they are stacked and
                  blended with `lighten` into one figure with every zone glowing.
                  The posters carry a baked-in title along the bottom; the 4:3
                  frame shows only the top three quarters, which leaves it out. */}
              <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                <div className="absolute inset-0 isolate origin-top group-hover:scale-[1.04] transition-transform duration-700 ease-out">
                  {s.regions.map((r, i) => (
                    <Image
                      key={r.src}
                      src={r.src}
                      alt={i === 0 ? s.name : ""}
                      fill
                      className={`object-cover object-top ${i > 0 ? "mix-blend-lighten" : ""}`}
                      sizes="(max-width: 768px) 92vw, 370px"
                    />
                  ))}
                </div>
                {/* Melts the artwork into the card */}
                <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent pointer-events-none" />
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-playfair text-xl text-foreground mb-2">{s.name}</h3>
                <div className="flex items-center justify-between">
                  <p className="font-poppins text-base font-semibold text-foreground/85">{s.price}</p>
                  <span className="text-xs font-poppins font-semibold tracking-widest text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    ZAKAŽI →
                  </span>
                </div>
              </div>
            </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
