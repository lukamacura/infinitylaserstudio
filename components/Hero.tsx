"use client";

import Image, { getImageProps } from "next/image";
import { ArrowRight } from "lucide-react";
import { JOURNEY_STEPS as steps } from "@/lib/journey";

// One photo serves both layouts: full-bleed behind the text on phones, inside
// the arch on desktop. `sizes` tells the browser how wide it is in each.
const { props: photo } = getImageProps({
  src: "/hero/phone.webp",
  alt: "",
  fill: true,
  sizes: "(min-width: 1024px) 460px, 100vw",
  quality: 70,
  fetchPriority: "high",
  loading: "eager",
});

const stats = [
  { value: "2000+",  label: "Klijenata" },
  { value: "5 god.", label: "Iskustva" },
  { value: "97%",    label: "Zadovoljnih" },
] as const;

export default function Hero({ onOpen }: { onOpen: () => void }) {
  return (
    // On desktop the whole hero fits one screen, so the journey timeline is
    // visible without scrolling: the stage takes the free height, the timeline
    // sits at the bottom.
    <section className="relative overflow-hidden bg-background font-poppins min-h-svh flex flex-col">
      {/* Static H1 for SEO crawlers — visually hidden, always present in HTML */}
      <h1 className="sr-only">
        Laserska epilacija Novi Sad i Sombor — Infinity Laser Studio
      </h1>

      {/* Ambient glow — desktop only, the phone has the photo behind the text */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block" aria-hidden="true">
        <div className="absolute -top-[20%] -left-[10%] w-[55%] h-[70%] rounded-full bg-accent-deep/20 blur-[140px]" />
        <div className="absolute top-[15%] right-[5%] w-[40%] h-[70%] rounded-full bg-accent/10 blur-[140px]" />
      </div>

      {/* ── Stage: the offer ───────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col justify-end lg:justify-center">
        <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 max-w-7xl mx-auto w-full px-6 lg:px-12 pt-20 pb-5 lg:pt-24 lg:pb-8">

          {/* Photo — behind the text on phones, an arch on desktop */}
          <div className="absolute inset-0 lg:relative lg:inset-auto lg:order-2 lg:col-span-5 lg:justify-self-end lg:w-full lg:max-w-[440px]">
            {/* Offset outline + glow around the arch */}
            <div className="hidden lg:block absolute -inset-3 rounded-t-full rounded-b-[2.5rem] border border-accent/30 pointer-events-none" aria-hidden="true" />
            <div className="hidden lg:block absolute inset-6 rounded-full bg-accent/25 blur-[90px] pointer-events-none" aria-hidden="true" />

            <div className="absolute inset-0 lg:relative lg:inset-auto lg:aspect-[4/5.4] lg:max-h-[calc(100svh-19rem)] lg:min-h-[22rem] lg:w-full overflow-hidden lg:rounded-t-full lg:rounded-b-[2rem] lg:shadow-2xl lg:shadow-black/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                {...photo}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-[50%_35%] lg:object-center"
              />
              {/* Phone scrim: photo stays clear up top, text sits on plum below */}
              <div
                className="absolute inset-0 lg:hidden"
                style={{ background: "linear-gradient(to bottom, rgba(18,10,14,0.55) 0%, rgba(18,10,14,0.15) 22%, rgba(18,10,14,0.78) 48%, #120A0E 72%)" }}
              />
              {/* Desktop: a light vignette so the arch sits in the page */}
              <div className="absolute inset-0 hidden lg:block bg-linear-to-t from-background/50 via-transparent to-transparent" />
            </div>
          </div>

          {/* Copy */}
          <div className="relative lg:order-1 lg:col-span-7 flex flex-col">
            <p className="font-playfair font-bold text-foreground text-[2.5rem] leading-[1.1] sm:text-6xl lg:text-[clamp(3.25rem,3.4vw+1rem,4.1rem)] lg:leading-[1.06]">
              Reši se{" "}
              {/* Highlighter stroke, drawn left to right on landing (see `.marker` in globals.css) */}
              <span className="marker">
                70–90%
                <span className="marker-ink" aria-hidden="true">
                  <span className="marker-stroke" />
                  <span className="relative">70–90%</span>
                </span>
              </span>{" "}
              dlačica{" "}
              <span className="block">
                ili <span className="text-accent">vraćamo novac</span>
              </span>
            </p>

            <p className="mt-3 lg:mt-7 text-base lg:text-lg text-foreground/80 max-w-md leading-relaxed">
              Zauvek se opraštaš od brijača, iritacija i uraslih dlaka.
            </p>

            <div className="mt-5 lg:mt-9 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              {/* The halo breathes behind the button; the button itself clips the light sweep */}
              <span className="cta-halo relative inline-flex">
                <button
                  onClick={onOpen}
                  className="group metal relative overflow-hidden w-full inline-flex items-center justify-between gap-5 h-14 lg:h-16 pl-8 pr-2.5 rounded-full text-base lg:text-[17px] font-bold tracking-[0.06em] cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <span className="cta-sweep" aria-hidden="true" />
                  <span className="relative">ZAKAŽI TERMIN</span>
                  <span className="relative flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-on-accent text-accent transition-transform duration-300 ease-out group-hover:translate-x-1">
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </span>
                </button>
              </span>
              {/* The reassurance, said by Ana */}
              <div className="flex items-center gap-3.5 sm:max-w-[20rem]">
                <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden shrink-0 ring-1 ring-white/15">
                  <Image src="/team/ana.webp" alt="Ana" fill sizes="(min-width: 1024px) 64px, 56px" className="object-cover object-top origin-top scale-125" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground tracking-tight">
                    Ana <span className="font-medium text-foreground/50">(Vlasnik)</span>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground/80">
                    Ništa se ne brini. Na prvom tretmanu pričamo i sve dogovaramo.
                  </p>
                </div>
              </div>
            </div>

            {/* Proof */}
            <dl className="mt-5 lg:mt-10 pt-4 lg:pt-7 border-t border-foreground/10 grid grid-cols-3 max-w-lg">
              {stats.map((s, i) => (
                <div key={s.value} className={`flex flex-col-reverse ${i > 0 ? "pl-5 lg:pl-8 border-l border-foreground/10" : ""}`}>
                  <dt className="mt-1 text-[10px] lg:text-[11px] font-semibold text-foreground/55 tracking-[0.2em] uppercase">{s.label}</dt>
                  <dd className="font-[family-name:var(--font-instrument)] font-normal text-[2rem] lg:text-[2.75rem] leading-none text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* ── Journey: a light travels Danas → 6-8 tretmana → Zauvek, on a loop.
             Everything here is CSS (see `.journey` in globals.css). ─────────── */}
      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pb-4 lg:pb-8 w-full">
        <div className="rounded-3xl border border-accent/20 bg-surface/70 backdrop-blur-md px-6 py-4 lg:px-12 lg:py-6">
          <ol className="journey relative grid lg:grid-cols-3 [--journey-step:3.25rem] lg:[--journey-step:4.5rem]">
            {/* Track + travelling light: vertical on phones, horizontal on desktop */}
            <li className="journey-track" aria-hidden="true">
              <span className="journey-fill" />
              <span className="journey-head" />
            </li>

            {steps.map((step, i) => (
              <li
                key={step.phase}
                className="journey-step relative flex lg:flex-col gap-4 lg:gap-3.5 h-(--journey-step) last:h-auto lg:h-auto lg:pr-8"
              >
                <span className="journey-dot">
                  <span className="journey-dot-on" />
                  {i === steps.length - 1 && <span className="journey-dot-pulse" />}
                </span>
                <div className="journey-text">
                  <p className="text-[11px] font-semibold text-accent tracking-[0.2em] uppercase leading-none">{step.phase}</p>
                  <p className="mt-2 text-base lg:text-lg font-semibold text-foreground leading-tight">{step.label}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
