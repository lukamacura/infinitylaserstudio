"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import type { FreeDay } from "@/lib/nextFreeDays";
import { DEFAULT_LOCATION, getLocation } from "@/lib/locations";
import { useOpenBooking } from "@/components/OpenBooking";
import {
  SR_DAYS_FULL, SR_MONTHS_SHORT, monIdx, Skeleton, StaffAvatars, freeSlotsLabel,
} from "@/components/booking/shared";


const perks = [
  "Konsultacija je besplatna",
  "Odaberi regije",
  "Zakaži kad ti odgovara",
];

const DAY_COUNT = 3;

export default function CommunitySection() {
  const openBooking = useOpenBooking();
  const onOpen = () => openBooking("zajednica");
  const sectionRef = useRef<HTMLElement>(null);
  // null = still loading; [] = nothing to show, so the plain button stands in.
  const [days, setDays] = useState<FreeDay[] | null>(null);

  // Ask for the calendar only once the section is about to scroll into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      // Imported here, not at the top: it brings the Supabase client, which the
      // page should not download before the visitor gets near this section.
      void import("@/lib/nextFreeDays")
        .then(({ loadNextFreeDays }) => loadNextFreeDays(DEFAULT_LOCATION, DAY_COUNT))
        .then((d) => { if (!cancelled) setDays(d); }, () => { if (!cancelled) setDays([]); });
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, []);

  return (
    <section ref={sectionRef} className="scroll-mt-24 section-y px-6 bg-background" id="book">
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

          {days && days.length === 0 ? (
            /* The halo breathes behind the button; the button itself clips the light sweep */
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
          ) : (
            <div className="mt-8">
              <p className="flex items-center gap-2.5 font-poppins text-meta text-foreground/60 mb-3">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Prvi slobodni dani · {getLocation(DEFAULT_LOCATION).name}
              </p>

              {/* Same cards as the modal's date step; any of them just opens the form. */}
              <div className="flex flex-col gap-2 sm:gap-3" aria-busy={!days}>
                {days
                  ? days.map((day) => {
                      const d = new Date(`${day.date}T00:00:00`);
                      return (
                        <button
                          key={day.date}
                          onClick={onOpen}
                          className="flex items-center justify-between gap-3 min-w-0 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl sm:rounded-3xl border-2 border-foreground/8 hover:border-accent/60 text-left cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-base md:text-lg font-bold font-poppins leading-tight">
                              {SR_DAYS_FULL[monIdx(d)]}
                              {day.isToday && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bm-metal bg-accent">
                                  DANAS
                                </span>
                              )}
                            </p>
                            <p className="text-xs sm:text-sm text-foreground/50 font-poppins mt-0.5">
                              {d.getDate()}. {SR_MONTHS_SHORT[d.getMonth()]} · {freeSlotsLabel(day.freeSlots)}
                            </p>
                          </div>
                          {day.staff.length > 0 && (
                            <div className="shrink-0 [&>div]:mt-0">
                              <StaffAvatars names={day.staff} />
                            </div>
                          )}
                        </button>
                      );
                    })
                  : Array.from({ length: DAY_COUNT }, (_, i) => (
                      <div key={i} className="flex flex-col items-start gap-2 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl sm:rounded-3xl border-2 border-foreground/8">
                        <Skeleton className="h-4 sm:h-5 w-2/5 rounded" />
                        <Skeleton className="h-3 sm:h-3.5 w-1/3 rounded" />
                      </div>
                    ))}
              </div>

              <button
                onClick={onOpen}
                className="group mt-4 inline-flex items-center gap-1.5 font-poppins text-meta font-semibold text-accent cursor-pointer"
              >
                Svi termini
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
