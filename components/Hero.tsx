"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 64 64" fill="none">
      <path d="M32 4L36 28L60 32L36 36L32 60L28 36L4 32L28 28L32 4Z" fill="currentColor" opacity="0.85" />
      <circle cx="18" cy="14" r="4" fill="currentColor" opacity="0.4" />
      <circle cx="14" cy="22" r="2.5" fill="currentColor" opacity="0.25" />
    </svg>
  );
}


const heroHeadings = [
  {
    line1: "72 sata godišnje trošiš na brijanje.",
    gradient: "A možeš",
    after: " na bilo šta drugo.",
  },
  {
    line1: "Brijanje, depilacija, crvenilo, urasle dlake.",
    gradient: "Postoji bolje",
    after: " rešenje.",
  },
  {
    line1: "Jednom epilacija. Zauvek bez dlaka.",
    gradient: "Tvoja koža,",
    after: " tvoja sloboda.",
  },
] as const;

const STAGGER = 0.018;
const CHAR_DUR = 0.18;
const INTERVAL_MS = 4500;

/** Renders text letter-by-letter with stagger, but wraps at word boundaries (not mid-word). */
function AnimatedChars({
  text,
  startDelay,
  reduced,
}: {
  text: string;
  startDelay: number;
  reduced: boolean | null | undefined;
}) {
  const words = text.split(" ");
  let globalIdx = 0;

  return (
    <>
      {words.map((word, wIdx) => {
        const wordStartIdx = globalIdx;
        globalIdx += word.length + 1; // +1 for the space

        return (
          <span key={wIdx} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {word.split("").map((char, cIdx) => (
              <motion.span
                key={cIdx}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: CHAR_DUR, delay: startDelay + (wordStartIdx + cIdx) * STAGGER, ease: "easeOut" }}
                style={{ display: "inline-block" }}
              >
                {char}
              </motion.span>
            ))}
            {wIdx < words.length - 1 && (
              <motion.span
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: CHAR_DUR, delay: startDelay + (wordStartIdx + word.length) * STAGGER }}
                style={{ display: "inline-block" }}
              >
                {"\u00A0"}
              </motion.span>
            )}
          </span>
        );
      })}
    </>
  );
}

const steps = [
  { dot: "bg-rose-300",  phase: "Danas",        label: "Svaki dan se briješ" },
  { dot: "bg-pink-400",  phase: "8-10 tretmana", label: "Epilacija" },
  { dot: "bg-teal",      phase: "Zauvek",        label: "Glatka koža" },
] as const;

const stats = [
  { value: "4000+",   label: "Klijenata" },
  { value: "5 god.", label: "Iskustva" },
  { value: "99%",    label: "Zadovoljnih" },
] as const;


export default function Hero({ onOpen }: { onOpen: () => void }) {
  const prefersReduced = useReducedMotion();
  const [hIdx, setHIdx] = useState(0);

  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => setHIdx((i) => (i + 1) % heroHeadings.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [prefersReduced]);

  const h = heroHeadings[hIdx];
  const gradientDelay = h.line1.length * STAGGER + 0.05;
  const afterDelay = gradientDelay + 0.35;

  return (
    <section
      className="relative overflow-hidden min-h-dvh"
      style={{
        background: "linear-gradient(115deg, #7DD8D5 0%, #ACE6E4 25%, #FCD6ED 65%, #FCCAE2 100%)",
        width: "100dvw",
      }}
    >

      {/* Background image — mobile only */}
      <div className="absolute inset-0 z-10 lg:hidden">
        <Image
          src="/hero.jpeg"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Dark overlay over background image — mobile only */}
      <div className="absolute inset-0 z-[15] bg-black/45 lg:hidden" />

      {/* Ambient blobs */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[55%] h-[65%] rounded-full bg-pink/15 blur-[110px] mix-blend-soft-light" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[60%] rounded-full bg-teal/10 blur-[110px] mix-blend-soft-light" />
      </div>

      {/* Model image — top-right on desktop, bottom-right on mobile */}
      <div
        className="absolute right-0 z-[25] pointer-events-none hidden lg:block lg:top-0 lg:h-[100dvh]"
      >
        <motion.div
          className="h-full w-auto"
          initial={prefersReduced ? false : { x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        >
          <Image
            src="/hero_right.png"
            alt=""
            fill={false}
            height={900}
            width={700}
            className="h-full w-auto object-contain object-bottom lg:object-top"
            style={{ height: "100%", width: "auto" }}
            priority
          />
        </motion.div>
      </div>

      {/* Content grid */}
      <div className="relative z-30 max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:h-dvh px-6 lg:px-12">

        {/* Left - Headline */}
        <div className="lg:col-span-5 flex flex-col justify-start pt-24 lg:justify-center lg:pt-0 gap-4 lg:gap-5">
          {/* <SparkleIcon className="mb-1 text-foreground/70" /> */}
          <div className="min-h-[11rem] md:min-h-[13rem] lg:min-h-[15rem]">
            <AnimatePresence mode="wait">
              <motion.h1
                key={hIdx}
                exit={{ opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }}
                className="text-[2.6rem] leading-[1.08] md:text-5xl lg:text-[3.5rem] font-bold font-playfair text-white lg:text-foreground"
              >
                <AnimatedChars text={h.line1} startDelay={0} reduced={prefersReduced} />
                <br />
                <motion.span
                  initial={prefersReduced ? false : { opacity: 0, scaleX: 0.85 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.35, delay: gradientDelay, ease: "easeOut" }}
                  className="bg-gradient-to-r from-pink to-rose bg-clip-text text-transparent inline-block origin-left"
                >
                  {h.gradient}
                </motion.span>
                <motion.span
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, delay: afterDelay }}
                  style={{ display: "inline-block" }}
                >{"\u00A0"}</motion.span>
                <AnimatedChars text={h.after.trimStart()} startDelay={afterDelay} reduced={prefersReduced} />
              </motion.h1>
            </AnimatePresence>
          </div>
          <p className="text-base md:text-lg text-white/80 lg:text-foreground/60 font-poppins max-w-sm leading-relaxed">
            Za 8 do 10 tretmana, zauvek se opraštaš od brijača, iritacija i uraslih dlaka.
          </p>

          {/* CTA — desktop only inline */}
          <div className="hidden lg:flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-4">
              <button
                onClick={onOpen}
                className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-foreground text-white text-xs font-semibold tracking-widest font-poppins border border-foreground hover:bg-foreground/90 hover:text-white transition-colors cursor-pointer"
              >
                ZAKAŽI TERMIN
              </button>
            </div>
            <p className="text-xs text-foreground/45 font-poppins">Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.</p>
          </div>
        </div>

        {/* Center - Stats column (desktop only) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col items-center justify-center gap-0">
          {stats.map((s, i) => (
            <div key={s.value} className="flex flex-col items-center text-center">
              <span className="text-4xl font-bold font-playfair text-foreground">{s.value}</span>
              <span className="text-xs font-poppins text-foreground/50 tracking-widest uppercase mt-1">{s.label}</span>
              {i < stats.length - 1 && (
                <div className="w-px h-7 bg-foreground/10 mt-5 mb-5" />
              )}
            </div>
          ))}
        </div>

        {/* Right - Frosted glass 3-step card (desktop only) */}
        <div className="hidden lg:flex lg:col-span-4 items-center justify-end">
          <div className="supports-[backdrop-filter]:bg-white bg-black/50 md:bg-white/50 backdrop-blur-md border border-foreground/10 rounded-2xl px-8 py-7 flex flex-col gap-6 w-72">
            <p className="text-[10px] font-poppins text-foreground/40 tracking-[3px] uppercase">Vaš put</p>
            {steps.map((step) => (
              <div key={step.phase} className="flex items-start gap-4">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${step.dot}`} />
                <div>
                  <p className="text-xs text-foreground/45 font-poppins tracking-[2px] uppercase">{step.phase}</p>
                  <p className="text-base font-semibold font-poppins text-foreground mt-0.5">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats — mobile only, centered in remaining space */}
        <div className="lg:hidden flex items-center justify-center py-4">
          <div className="flex items-center w-full py-4">
            {stats.map((s, i) => (
              <div key={s.value} className="flex items-center flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <span className="text-2xl font-bold font-playfair text-white lg:text-foreground">{s.value}</span>
                  <span className="text-[10px] font-poppins text-white/60 lg:text-foreground/50 tracking-widest uppercase mt-0.5">{s.label}</span>
                </div>
                {i < stats.length - 1 && <div className="w-px h-8 bg-white/30 lg:bg-foreground/15 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile steps bar */}
        <div className="lg:hidden pb-3 pt-0">
          <div className="w-full flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 gap-3">
            {steps.map((step, i) => (
              <div key={step.phase} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${step.dot}`} />
                  <p className="text-[10px] text-white/60 lg:text-foreground/45 font-poppins tracking-[1.5px] uppercase leading-none">{step.phase}</p>
                </div>
                <p className="text-sm font-semibold font-poppins text-white lg:text-foreground leading-tight mt-0.5 pl-4">{step.label}</p>
                {i < steps.length - 1 && (
                  <div className="h-px w-full bg-foreground/10 mt-3" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA — mobile only, pinned to bottom */}
        <div className="lg:hidden pb-6 pt-4 flex flex-col gap-2">
          <button
            onClick={onOpen}
            className="inline-flex items-center justify-center w-full px-8 py-4 rounded-full text-white text-sm font-semibold tracking-widest font-poppins transition-opacity hover:opacity-90 cursor-pointer"
            style={{ background: "linear-gradient(to right, #E85D8A, #FCCAE2)" }}
          >
            ZAKAŽI TERMIN
          </button>
          <p className="text-xs text-white/60 lg:text-foreground/45 font-poppins text-center">Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.</p>
        </div>

      </div>

      {/* Scroll indicator (desktop only) */}
      <motion.div
        className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex-col items-center gap-1 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <span className="text-[10px] font-poppins text-foreground/40 tracking-[3px] uppercase">Scroll</span>
        <motion.div
          className="w-px h-6 bg-foreground/30 origin-top"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
        />
      </motion.div>
    </section>
  );
}
