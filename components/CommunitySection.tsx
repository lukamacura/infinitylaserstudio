"use client";

import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

interface Props { onOpen: () => void; }

const perks = [
  "Konsultacija je besplatna",
  "Odaberi regije",
  "Zakaži kad ti odgovara",
];

export default function CommunitySection({ onOpen }: Props) {
  return (
    <section className="scroll-mt-24 section-y px-6 bg-background" id="book">
      <div data-rv="zoom" className="relative max-w-6xl mx-auto overflow-hidden rounded-[2rem] border border-foreground/10 bg-surface">
        {/* Decorative glow */}
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent opacity-10 blur-3xl pointer-events-none" />

        {/* Artwork: the whole-body poster. The 4:3 frame shows only its top
            three quarters, which leaves out the title baked in along the bottom.
            Below the fold of the frame it melts into the card. */}
        <div className="relative lg:absolute lg:top-0 lg:right-0 lg:w-[70%] aspect-[4/3] overflow-hidden">
          <Image
            src="/regije/zene/celo-telo.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 780px, 100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-surface to-transparent" />
          <div className="hidden lg:block absolute inset-y-0 left-0 w-3/5 bg-linear-to-r from-surface from-15% to-transparent" />

          <div className="hidden sm:block absolute top-6 right-6 rounded-2xl border border-foreground/15 bg-background/60 px-4 py-2.5 text-right backdrop-blur-md">
            <p className="metal-text font-playfair text-2xl leading-none">10 min</p>
            <p className="font-poppins text-eyebrow text-foreground/65 mt-1">besplatna procena</p>
          </div>
        </div>

        {/* Copy */}
        <div className="relative -mt-12 lg:mt-0 lg:w-1/2 px-7 pb-9 sm:px-10 sm:pb-11 lg:p-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-rose/10 px-4 py-1.5 font-poppins text-xs font-semibold tracking-widest text-accent uppercase">
            Besplatna konsultacija
          </span>

          <h2 className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15] mt-5">
            Gotova si s <span className="metal-text">brijanjem?</span>
          </h2>
          <p className="font-poppins text-foreground/70 text-base leading-relaxed mt-4 max-w-md">
            Zakaži svoj prvi tretman i dobijaš konsultaciju, <b>BESPLATNO</b>. U 10 minuta pričamo, sagledamo tvoj tip kože i odgovaramo na sva pitanja.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 font-poppins text-copy text-foreground/85">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          {/* The halo breathes behind the button; the button itself clips the light sweep */}
          <span className="cta-halo relative mt-8 flex sm:inline-flex">
            <button
              onClick={onOpen}
              className="group metal relative overflow-hidden w-full inline-flex items-center justify-between gap-5 h-14 lg:h-16 pl-8 pr-2.5 rounded-full font-poppins text-base lg:text-[17px] font-bold tracking-[0.06em] cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <span className="cta-sweep" aria-hidden="true" />
              <span className="relative">ZAKAŽI ODMAH</span>
              <span className="relative flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-on-accent text-accent transition-transform duration-300 ease-out group-hover:translate-x-1">
                <ArrowRight size={18} strokeWidth={2.2} />
              </span>
            </button>
          </span>

          <p className="flex items-center gap-2.5 font-poppins text-meta text-foreground/60 mt-5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Slobodni termini dostupni ove nedelje.
          </p>
        </div>
      </div>
    </section>
  );
}
