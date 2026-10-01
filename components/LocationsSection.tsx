"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import Reveal from "@/components/Reveal";
import { LOCATIONS } from "@/lib/locations";

export default function LocationsSection() {
  return (
    <section id="lokacije" className="scroll-mt-24 section-y px-6 bg-background">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <Reveal className="text-center mb-4" y={16} duration={0.6} margin="-60px">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60">
            <span className="w-6 h-px bg-accent inline-block" />
            Gde se nalazimo
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
        </Reveal>

        {/* Headline */}
        <Reveal
          as="h2"
          className="font-playfair text-4xl md:text-5xl text-foreground text-center leading-tight mb-4"
          y={20}
          delay={0.08}
          margin="-60px"
        >
          Čekamo te na{" "}
          <span className="relative inline-block">
            dve lokacije
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </Reveal>

        <Reveal
          as="p"
          className="text-center font-poppins text-foreground/60 text-base section-head"
          y={16}
          duration={0.6}
          delay={0.15}
          margin="-60px"
        >
          Ista tehnologija i ista nega u oba studija. Izaberi grad koji ti je bliži.
        </Reveal>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {LOCATIONS.map((loc, i) => (
            <Reveal key={loc.id} y={40} delay={0.15 + i * 0.18} margin="-60px" className="flex">
              <div className="group relative flex-1 aspect-4/5 rounded-3xl overflow-hidden shadow-sm border border-foreground/8 bg-surface transition-transform duration-300 ease-out hover:-translate-y-1.5">
                {loc.image && (
                  <Image
                    src={loc.image}
                    alt={`Infinity Laser Studio ${loc.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 384px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />

                {/* City on photo */}
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <p className="font-playfair text-3xl text-white leading-none">{loc.name}</p>
                  {loc.address && (
                    <p className="flex items-center gap-1.5 font-poppins text-sm text-white/80 mt-2">
                      <MapPin size={14} className="shrink-0 text-accent" />
                      {loc.address}
                    </p>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
