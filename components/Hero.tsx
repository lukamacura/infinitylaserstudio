"use client";

import Image from "next/image";

const steps = [
  { dot: "bg-rose-300", phase: "Danas",         label: "Svaki dan se briješ" },
  { dot: "bg-pink-400", phase: "8-10 tretmana", label: "Epilacija" },
  { dot: "bg-teal",     phase: "Zauvek",         label: "Glatka koža" },
] as const;

const stats = [
  { value: "1700+",  label: "Klijenata" },
  { value: "5 god.", label: "Iskustva" },
  { value: "99%",    label: "Zadovoljnih" },
] as const;

export default function Hero({ onOpen }: { onOpen: () => void }) {
  return (
    <section
      className="relative overflow-hidden min-h-screen lg:h-screen"
      style={{
        background: "linear-gradient(115deg, #7DD8D5 0%, #ACE6E4 25%, #FCD6ED 65%, #FCCAE2 100%)",
      }}
    >
      {/* Background image — mobile only */}
      <div className="absolute inset-0 z-10 lg:hidden">
        <Image
          src="/phone.JPG"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Dark overlay — mobile only */}
      <div className="absolute inset-0 z-15 bg-black/55 lg:hidden" />

      {/* Background image — desktop only */}
      <div className="absolute inset-0 z-10 pointer-events-none hidden lg:block">
        <Image
          src="/desktop.JPG"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Dark gradient overlay — desktop only */}
      <div className="absolute inset-0 z-15 pointer-events-none hidden lg:block"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.40) 55%, rgba(0,0,0,0.10) 100%)" }}
      />

      {/* Ambient blobs — desktop only */}
      <div className="absolute inset-0 z-20 pointer-events-none hidden lg:block">
        <div className="absolute top-[-10%] left-[-5%] w-[55%] h-[65%] rounded-full bg-pink/15 blur-[110px] mix-blend-soft-light" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[60%] rounded-full bg-teal/10 blur-[110px] mix-blend-soft-light" />
      </div>

      {/* Static H1 for SEO crawlers — visually hidden, always present in HTML */}
      <h1 className="sr-only">
        Laserska epilacija Novi Sad — Infinity Laser Studio
      </h1>

      {/* ── MOBILE layout ──────────────────────────────────────────────────────── */}
      <div className="lg:hidden relative z-30 flex flex-col px-6 pt-24 pb-6 gap-4"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Heading */}
        <div
          className="text-[2.4rem] leading-[1.18] font-bold font-playfair text-white"
          style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
        >
          Reši se 70–90% dlačica ili{" "}
          <span
            style={{
              background: "linear-gradient(to right, #F72585, #FF6EB4, #FFB3D9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            VRAĆAMO NOVAC
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-white font-poppins max-w-xs leading-relaxed" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
          Za 6-8 tretmana, zauvek se opraštaš od brijača, iritacija i uraslih dlaka.
        </p>

        {/* Stats */}
        <div className="flex items-center w-full py-1 mt-2">
          {stats.map((s, i) => (
            <div key={s.value} className="flex items-center flex-1">
              <div className="flex flex-col items-center text-center flex-1">
                <span className="text-2xl font-bold font-playfair text-white">{s.value}</span>
                <span className="text-[10px] font-poppins text-white/60 tracking-widest uppercase mt-0.5">{s.label}</span>
              </div>
              {i < stats.length - 1 && <div className="w-px h-8 bg-white/30 shrink-0" />}
            </div>
          ))}
        </div>

        {/* Steps card */}
        <div className="w-full flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 gap-3">
          {steps.map((step, i) => (
            <div key={step.phase} className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${step.dot}`} />
                <p className="text-[10px] text-white/60 font-poppins tracking-[1.5px] uppercase leading-none">{step.phase}</p>
              </div>
              <p className="text-sm font-semibold font-poppins text-white leading-tight mt-0.5 pl-4">{step.label}</p>
              {i < steps.length - 1 && <div className="h-px w-full bg-white/10 mt-3" />}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onOpen}
          className="inline-flex items-center justify-center w-full px-8 py-4 rounded-full text-white text-sm font-semibold tracking-widest font-poppins transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: "linear-gradient(to right, #E85D8A, #FCCAE2)" }}
        >
          ZAKAŽI TERMIN
        </button>
        <p className="text-xs text-white/60 font-poppins text-center -mt-1">
          Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.
        </p>
      </div>

      {/* ── DESKTOP layout ────────────────────────────────────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-12 relative z-30 h-full max-w-7xl mx-auto px-12">

        {/* Left — Headline */}
        <div className="col-span-5 flex flex-col justify-center gap-5">
          <div
            className="text-[3.75rem] leading-[1.12] font-bold font-playfair text-white"
            style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
          >
            Reši se 70–90% dlačica ili{" "}
            <span
              style={{
                background: "linear-gradient(to right, #F72585, #FF6EB4, #FFB3D9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              VRAĆAMO NOVAC
            </span>
          </div>

          <p className="text-lg text-white font-poppins max-w-sm leading-relaxed" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.85)" }}>
            Za 6-8 tretmana, zauvek se opraštaš od brijača, iritacija i uraslih dlaka.
          </p>

          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={onOpen}
              className="self-start inline-flex items-center justify-center px-8 py-3 rounded-full text-white text-xs font-semibold tracking-widest font-poppins transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: "linear-gradient(to right, #E85D8A, #FCCAE2)" }}
            >
              ZAKAŽI TERMIN
            </button>
            <p className="text-xs text-white/60 font-poppins">
              Ništa se ne brini. Na prvom tretmanu se sve dogovaramo.
            </p>
          </div>
        </div>

        {/* Center — Stats */}
        <div className="col-span-3 flex flex-col items-center justify-center gap-0">
          {stats.map((s, i) => (
            <div key={s.value} className="flex flex-col items-center text-center">
              <span className="text-4xl font-bold font-playfair text-white">{s.value}</span>
              <span className="text-xs font-poppins text-white/60 tracking-widest uppercase mt-1">{s.label}</span>
              {i < stats.length - 1 && <div className="w-px h-7 bg-white/20 mt-5 mb-5" />}
            </div>
          ))}
        </div>

        {/* Right — 3-step card */}
        <div className="col-span-4 flex items-center justify-end">
          <div className="bg-black/30 supports-backdrop-filter:bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-7 flex flex-col gap-6 w-72">
            <p className="text-[10px] font-poppins text-white/50 tracking-[3px] uppercase">Vaš put</p>
            {steps.map((step) => (
              <div key={step.phase} className="flex items-start gap-4">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${step.dot}`} />
                <div>
                  <p className="text-xs text-white/50 font-poppins tracking-[2px] uppercase">{step.phase}</p>
                  <p className="text-base font-semibold font-poppins text-white mt-0.5">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
