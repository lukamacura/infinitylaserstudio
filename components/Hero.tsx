"use client";

import { useState } from "react";
import BookingModal from "./BookingModal";

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 64 64" fill="none">
      <path d="M32 4L36 28L60 32L36 36L32 60L28 36L4 32L28 28L32 4Z" fill="#E85D8A" />
      <circle cx="18" cy="14" r="4" fill="#E85D8A" opacity="0.6" />
      <circle cx="14" cy="22" r="2.5" fill="#E85D8A" opacity="0.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function ExploreCircleBadge() {
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
        <defs>
          <path id="circlePath" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
        </defs>
        <text className="fill-foreground text-[11px] font-medium tracking-[3px]" style={{ fontFamily: "var(--font-poppins)" }}>
          <textPath href="#circlePath">
            TVOJA KOŽA, TVOJ SJAJ • TVOJA KOŽA, TVOJ SJAJ •{" "}
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15 9.5L22 12L15 14.5L12 22L9 14.5L2 12L9 9.5L12 2Z" fill="#E85D8A" />
        </svg>
      </div>
    </div>
  );
}

function EpilationSteps() {
  return (
    <div className="flex flex-col items-start gap-1">
      {/* Step 1: Shaving – crossed out */}
      <div
        className="flex items-center gap-7 animate-step-in"
        style={{ animationDelay: "0.4s" }}
      >
        <div className="relative w-36 h-36 rounded-full bg-pink/30 flex items-center justify-center shrink-0">
          {/* Animated outer ring */}
          <svg className="absolute inset-0 w-full h-full animate-ring-rotate" viewBox="0 0 144 144" fill="none">
            <circle cx="72" cy="72" r="68" stroke="#E85D8A" strokeWidth="1" strokeDasharray="8 12" opacity="0.3" />
          </svg>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Razor – clear recognizable shape */}
            {/* Handle */}
            <rect x="28" y="30" width="8" height="24" rx="3" fill="#6B7280" />
            <rect x="27" y="50" width="10" height="6" rx="3" fill="#4B5563" />
            {/* Head – wide rectangle with rounded corners */}
            <rect x="14" y="6" width="36" height="24" rx="4" fill="#9CA3AF" />
            {/* Blade strips */}
            <rect x="18" y="10" width="28" height="3" rx="1" fill="#D1D5DB" />
            <rect x="18" y="16" width="28" height="3" rx="1" fill="#D1D5DB" />
            <rect x="18" y="22" width="28" height="3" rx="1" fill="#D1D5DB" />
            {/* Guard strip at bottom */}
            <rect x="16" y="27" width="32" height="3" rx="1.5" fill="#ACE6E4" opacity="0.6" />
          </svg>
          {/* Red cross-out circle + X */}
          <svg className="absolute inset-0" viewBox="0 0 144 144" fill="none">
            {/* Red circle border */}
            <circle cx="72" cy="72" r="50" stroke="#EF4444" strokeWidth="3" opacity="0.3"
              className="animate-strike-through"
              style={{ strokeDasharray: 314, strokeDashoffset: 314, animationDelay: "1.4s" }}
            />
            <line
              x1="44" y1="44" x2="100" y2="100"
              stroke="#EF4444" strokeWidth="5" strokeLinecap="round"
              className="animate-strike-through"
              style={{ strokeDasharray: 80, strokeDashoffset: 80, animationDelay: "1.6s" }}
            />
            <line
              x1="100" y1="44" x2="44" y2="100"
              stroke="#EF4444" strokeWidth="5" strokeLinecap="round"
              className="animate-strike-through"
              style={{ strokeDasharray: 80, strokeDashoffset: 80, animationDelay: "1.9s" }}
            />
          </svg>
        </div>
        <div>
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">KORAK 01</p>
          <p className="text-xl font-bold font-poppins mt-1">Brijanje</p>
          <p className="text-sm text-foreground/50 font-poppins mt-1">72h godišnje potrošenog vremena</p>
        </div>
      </div>

      {/* Connector line with dots */}
      <div className="flex flex-col items-center ml-17.5 animate-line-grow origin-top" style={{ animationDelay: "2.3s" }}>
        <div className="w-px h-5 bg-foreground/10" />
        <div className="w-2 h-2 rounded-full bg-pink/60 animate-dot-pulse" style={{ animationDelay: "2.5s" }} />
        <div className="w-px h-5 bg-foreground/10" />
        <div className="w-2 h-2 rounded-full bg-teal/60 animate-dot-pulse" style={{ animationDelay: "2.7s" }} />
        <div className="w-px h-5 bg-foreground/10" />
      </div>

      {/* Step 2: Laser treatment */}
      <div
        className="flex items-center gap-7 animate-step-in"
        style={{ animationDelay: "2.8s" }}
      >
        <div className="relative w-36 h-36 rounded-full bg-teal/25 flex items-center justify-center shrink-0">
          {/* Animated scanning rings */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 144 144" fill="none">
            <circle cx="72" cy="72" r="66" stroke="#ACE6E4" strokeWidth="1.5" strokeDasharray="6 10" opacity="0.4" className="animate-ring-rotate" />
            <circle cx="72" cy="72" r="60" stroke="#ACE6E4" strokeWidth="0.75" strokeDasharray="3 8" opacity="0.2" className="animate-ring-rotate-reverse" />
          </svg>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Laser gun – barrel pointing right */}
            {/* Main barrel */}
            <rect x="6" y="22" width="34" height="12" rx="3" fill="#E85D8A" />
            {/* Barrel tip / nozzle */}
            <rect x="38" y="24" width="12" height="8" rx="2" fill="#D14A78" />
            <rect x="48" y="25" width="6" height="6" rx="1.5" fill="#E85D8A" />
            {/* Lens at barrel end */}
            <circle cx="54" cy="28" r="3" fill="#ACE6E4" opacity="0.9" />
            <circle cx="54" cy="28" r="1.5" fill="#7DD3D0" />
            {/* Grip / handle */}
            <path d="M16 34L14 52L24 52L22 34Z" fill="#D14A78" />
            <rect x="13" y="50" width="12" height="4" rx="2" fill="#E85D8A" />
            {/* Grip ridges */}
            <line x1="16" y1="38" x2="22" y2="38" stroke="#C0407A" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="15.5" y1="42" x2="22.5" y2="42" stroke="#C0407A" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="15" y1="46" x2="23" y2="46" stroke="#C0407A" strokeWidth="1.2" strokeLinecap="round" />
            {/* Trigger */}
            <path d="M22 34Q26 38 24 42" stroke="#FCD6ED" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Top rail / sight */}
            <rect x="10" y="19" width="20" height="3" rx="1" fill="#D14A78" />
            {/* Power indicator */}
            <circle cx="28" cy="28" r="2.5" fill="#ACE6E4" className="animate-laser-pulse" />
            {/* Laser beam shooting out */}
            <line x1="57" y1="28" x2="64" y2="28" stroke="#ACE6E4" strokeWidth="3" strokeLinecap="round" className="animate-laser-pulse" />
            {/* Impact glow */}
            <circle cx="64" cy="28" r="5" fill="#ACE6E4" opacity="0.2" className="animate-laser-glow svg-center-origin" />
            <circle cx="64" cy="28" r="2.5" fill="#ACE6E4" opacity="0.4" className="animate-laser-glow svg-center-origin" style={{ animationDelay: "0.3s" }} />
            {/* Scatter light from beam */}
            <line x1="62" y1="26" x2="64" y2="20" stroke="#ACE6E4" strokeWidth="1" strokeLinecap="round" opacity="0.4" className="animate-laser-pulse" />
            <line x1="62" y1="30" x2="64" y2="36" stroke="#ACE6E4" strokeWidth="1" strokeLinecap="round" opacity="0.4" className="animate-laser-pulse" />
          </svg>
        </div>
        <div>
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">KORAK 02</p>
          <p className="text-xl font-bold font-poppins mt-1">Laser tretman</p>
          <p className="text-sm text-foreground/50 font-poppins mt-1">Bezbolno, za 6–8 seansi</p>
        </div>
      </div>

      {/* Connector line with dots */}
      <div className="flex flex-col items-center ml-17.5 animate-line-grow origin-top" style={{ animationDelay: "4.0s" }}>
        <div className="w-px h-5 bg-foreground/10" />
        <div className="w-2 h-2 rounded-full bg-teal/60 animate-dot-pulse" style={{ animationDelay: "4.2s" }} />
        <div className="w-px h-5 bg-foreground/10" />
        <div className="w-2 h-2 rounded-full bg-mint/80 animate-dot-pulse" style={{ animationDelay: "4.4s" }} />
        <div className="w-px h-5 bg-foreground/10" />
      </div>

      {/* Step 3: Smooth skin result */}
      <div
        className="flex items-center gap-7 animate-step-in"
        style={{ animationDelay: "4.5s" }}
      >
        <div className="relative w-36 h-36 rounded-full bg-mint/35 flex items-center justify-center shrink-0">
          {/* Celebration ring */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 144 144" fill="none">
            <circle cx="72" cy="72" r="66" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 8" opacity="0.3" className="animate-ring-rotate" />
          </svg>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Woman silhouette – full body, elegant pose */}
            {/* Hair */}
            <path d="M28 6C26 4 24 3 26 1C28 0 34 0 36 1C38 3 36 5 34 6C36 6 38 8 37 10L25 10C24 8 26 6 28 6Z" fill="#4B3621" />
            {/* Head */}
            <circle cx="31" cy="10" r="5" fill="#F9C4B8" />
            {/* Neck */}
            <rect x="29.5" y="14.5" width="3" height="3" rx="1" fill="#F9C4B8" />
            {/* Body / torso – dress silhouette */}
            <path
              d="M26 17.5C26 17.5 24 18 23 20
                 C22 22 22 26 23 28
                 L24 32C23 34 22 36 22 38
                 L39 38C39 36 38 34 37 32
                 L38 28C39 26 39 22 38 20
                 C37 18 36 17.5 35 17.5Z"
              fill="#E85D8A"
            />
            {/* Waist accent */}
            <path d="M25 26Q31 24 36 26" stroke="#D14A78" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.5" />
            {/* Left leg */}
            <path
              d="M24 38C24 38 23 44 22.5 48C22 52 22 56 22 58L26 58C26 56 26 52 26.5 48C27 44 27 40 27 38Z"
              fill="#F9C4B8"
            />
            {/* Right leg */}
            <path
              d="M34 38C34 38 34 44 34.5 48C35 52 35 56 35 58L39 58C39 56 39 52 38.5 48C38 44 37 40 37 38Z"
              fill="#F9C4B8"
            />
            {/* Left foot */}
            <path d="M22 58Q21 60 23 60.5L26 60.5Q27 60 26 58Z" fill="#F5B8AA" />
            {/* Right foot */}
            <path d="M35 58Q34 60 36 60.5L39 60.5Q40 60 39 58Z" fill="#F5B8AA" />
            {/* Left arm */}
            <path d="M26 18C24 20 20 22 18 21" stroke="#F9C4B8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Right arm – raised with confidence */}
            <path d="M35 18C37 17 40 14 42 12" stroke="#F9C4B8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Hand on raised arm */}
            <circle cx="42.5" cy="11.5" r="1.5" fill="#F9C4B8" />
            {/* Smile */}
            <path d="M29.5 11.5Q31 13 32.5 11.5" stroke="#E85D8A" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            {/* Shine lines on skin */}
            <path d="M20 44Q18 44 16 42" stroke="#ACE6E4" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M41 44Q43 44 45 42" stroke="#ACE6E4" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.4" />
            {/* Sparkle stars around */}
            <path
              d="M42 6L44 10L48 12L44 14L42 18L40 14L36 12L40 10Z"
              fill="#ACE6E4"
              className="animate-sparkle-pop svg-center-origin"
              style={{ animationDelay: "5.4s" }}
            />
            <path
              d="M50 24L51.5 28L55.5 29.5L51.5 31L50 35L48.5 31L44.5 29.5L48.5 28Z"
              fill="#E85D8A"
              className="animate-sparkle-pop svg-center-origin"
              style={{ animationDelay: "5.7s" }}
            />
            <path
              d="M46 46L47.5 49L50.5 50L47.5 51L46 54L44.5 51L41.5 50L44.5 49Z"
              fill="#10B981"
              className="animate-sparkle-pop svg-center-origin"
              style={{ animationDelay: "6.0s" }}
            />
            <path
              d="M56 12L57.5 15L60.5 16L57.5 17L56 20L54.5 17L51.5 16L54.5 15Z"
              fill="#ACE6E4"
              className="animate-sparkle-pop svg-center-origin"
              style={{ animationDelay: "6.2s" }}
            />
            {/* Checkmark */}
            <path
              d="M38 52L44 58L58 44"
              stroke="#10B981" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
              className="animate-check-draw"
              style={{ strokeDasharray: 32, strokeDashoffset: 32, animationDelay: "5.7s" }}
            />
          </svg>
          {/* Success glow pulse */}
          <div
            className="absolute inset-0 rounded-full bg-mint/20 animate-success-glow"
            style={{ animationDelay: "5.8s" }}
          />
        </div>
        <div>
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">KORAK 03</p>
          <p className="text-xl font-bold font-poppins mt-1">Glatka koža</p>
          <p className="text-sm text-foreground/50 font-poppins mt-1">Trajno, bez održavanja</p>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const navLinks = ["O nama", "Usluge", "Cenovnik", "Kontakt"] as const;

  return (
    <section className="relative h-screen overflow-hidden bg-cream">
      {/* Radial background blobs */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[80%] rounded-full bg-pink/40 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[70%] rounded-full bg-mint/50 blur-[120px]" />
        <div className="absolute top-[30%] left-[40%] w-[40%] h-[50%] rounded-full bg-rose/20 blur-[100px]" />
      </div>
      {/* Navigation */}
      <nav className="relative z-20 max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-4">
        <span className="text-xl font-bold tracking-widest font-playfair">INFINITY</span>
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link}>
              <a href="#" className="text-sm font-poppins text-foreground/80 hover:text-foreground transition-colors">
                {link}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <button aria-label="Pretraga" className="p-2 hover:opacity-70 transition-opacity">
            <SearchIcon />
          </button>
          <button aria-label="Korpa" className="p-2 bg-foreground text-background rounded-full hover:opacity-80 transition-opacity">
            <CartIcon />
          </button>
        </div>
      </nav>

      {/* Content grid */}
      <div className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 h-[calc(100%-72px)] px-6 lg:px-12">
        {/* Left Content */}
        <div className="lg:col-span-5 flex flex-col justify-center gap-5">
          <SparkleIcon className="mb-1" />
          <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-bold leading-[1.1] font-playfair text-foreground">
            72 sata godišnje trošiš na brijanje.
            <br />
            <span className="bg-linear-to-r from-teal to-[#ff3998] bg-clip-text text-transparent decoration-teal/40 ">A možeš</span> na bilo šta drugo.
          </h1>
          <p className="text-base md:text-lg text-foreground/60 font-poppins max-w-sm leading-relaxed">
            Posle 6-8 tretmana epilacije, brijač postaje suvenir iz prošlosti.
          </p>
          <button
            onClick={() => setBookingOpen(true)}
            className="bg-teal inline-flex items-center justify-center w-fit mt-1 px-8 py-3 rounded-full text-xs font-semibold tracking-widest font-poppins hover:bg-foreground hover:text-background transition-colors cursor-pointer"
          >
            ZAKAŽI TRETMAN
          </button>
        </div>

        {/* Center – stats */}
        <div className="lg:col-span-3 flex flex-col items-center justify-between py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white bg-linear-to-br from-pink to-rose"
                />
              ))}
            </div>
            <span className="text-4xl md:text-5xl font-bold font-playfair">120K+</span>
            <p className="text-sm text-foreground/60 font-poppins">Zadovoljnih klijenata</p>
          </div>
          <ExploreCircleBadge />
        </div>

        {/* Right – 3-step epilation animation */}
        <div className="hidden lg:flex lg:col-span-4 items-center justify-end">
          <EpilationSteps />
        </div>
      </div>

      <BookingModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </section>
  );
}
