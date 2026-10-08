"use client";

import Reveal from "@/components/Reveal";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Phone carousel: time per person, and how long a touch holds it still.
const INTERVAL = 3000;
const PAUSE_AFTER_TOUCH = 9000;

const members: { name: string; role?: string; quote: string; bio: string; src: string; accent: string }[] = [
  {
    name: "Mila",
    role: "Medicinska sestra",
    quote: "Svaki tretman je priča za sebe.",
    bio: "Preciznost, toplina i posvećenost - Mila svaku klijentkinju dočeka s pažnjom kakvu zaslužuje.",
    src: "/team/mila.webp",
    accent: "#DCA8A6",
  },
  {
    name: "Tanja",
    role: "Medicinska sestra",
    quote: "Rezultati govore. Osmesi potvrđuju.",
    bio: "Mirna ruka, brz tretman i uvek raspoložena za razgovor. Tanja se stara da se iz ordinacije izađe s osmehom - i bez dlaka. Specijalizovana za tretmane lica i osetljivih zona.",
    src: "/team/tanja.webp",
    accent: "#9E6769",
  },
  {
    name: "Branka",
    role: "Menadžer",
    quote: "Za mene je Infinity više od posla.",
    bio: "Branka se trudi da svakome pristupi lično - sasluša je, prilagodi tretman njenoj koži i potrebama i pobrine se da se oseća sigurno od prvog do poslednjeg tretmana.",
    src: "/team/branka.webp",
    accent: "#9E6769",
  },
];

export default function TeamSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pausedUntil = useRef(0);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // Bumped on every auto turn so the dot's fill animation restarts.
  const [cycle, setCycle] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const card = cardRefs.current[i];
    if (!track || !card) return;
    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2,
      behavior: "smooth",
    });
  }, []);

  const pause = useCallback(() => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH;
    setAutoplay(false);
  }, []);

  // Whichever card sits closest to the track's centre is the active one.
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - centre);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    activeRef.current = best;
    setActive(best);
  }, []);

  // Auto-rotate only on phones, only while the section is on screen,
  // and never for users who asked for reduced motion.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const mobile = window.matchMedia("(max-width: 639px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.4 });
    io.observe(track);

    const id = window.setInterval(() => {
      if (!mobile.matches || !visible) return;
      if (Date.now() < pausedUntil.current) return;
      setAutoplay(true);
      goTo((activeRef.current + 1) % members.length);
      setCycle((c) => c + 1);
    }, INTERVAL);

    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [goTo]);

  return (
    <section className="section-y px-6 bg-background">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <Reveal className="text-center mb-4" y={16} duration={0.6} margin="-60px">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60">
            <span className="w-6 h-px bg-accent inline-block" />
            Upoznaj tim
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
        </Reveal>

        {/* Headline */}
        <Reveal
          as="h2"
          className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground text-center leading-[1.15] mb-4"
          y={20}
          delay={0.08}
          margin="-60px"
        >
          Ruke kojima{" "}
          <span className="relative inline-block">
            možeš verovati
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
          Sertifikovane terapeutkinje sa stotinama zadovoljnih klijentkinja.
        </Reveal>

        {/* Cards — grid on desktop; on phones a snap carousel that rotates itself */}
        <Reveal y={40} delay={0.15} margin="-60px">
          <div
            ref={trackRef}
            onScroll={onScroll}
            onTouchStart={pause}
            onPointerDown={pause}
            onWheel={pause}
            className="relative flex sm:grid sm:grid-cols-2 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-6 px-[11%] sm:mx-0 sm:px-0 py-2 sm:py-0 perspective-[1200px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {members.map((m, i) => (
              <div
                key={m.name}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`flex shrink-0 w-[78%] sm:w-auto snap-center transition-all duration-500 ease-out ${
                  i === active
                    ? ""
                    : `max-sm:scale-[0.88] max-sm:opacity-55 max-sm:saturate-50 ${i < active ? "max-sm:rotate-y-[14deg]" : "max-sm:-rotate-y-[14deg]"}`
                }`}
              >
            <div className="group relative flex-1 bg-surface rounded-3xl overflow-hidden shadow-sm border border-foreground/8 flex flex-col transition-transform duration-300 ease-out hover:-translate-y-1.5">
              {/* Photo */}
              <div className="relative w-full aspect-4/5 overflow-hidden">
                <Image
                  src={m.src}
                  alt={m.name}
                  fill
                  sizes="(max-width: 640px) 78vw, 372px"
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />

                {/* Name on photo */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-playfair text-2xl text-white leading-none">{m.name}</p>
                  {m.role && <p className="font-poppins text-meta text-white/80 mt-0.5 tracking-wide">{m.role}</p>}
                </div>

                {/* Accent dot */}
                <div
                  className="absolute top-4 right-4 w-3 h-3 rounded-full"
                  style={{ backgroundColor: m.accent }}
                />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <blockquote
                  className="font-playfair italic text-foreground/85 text-base leading-snug border-l-[3px] pl-3"
                  style={{ borderColor: m.accent }}
                >
                  &ldquo;{m.quote}&rdquo;
                </blockquote>
                <p className="font-poppins text-copy text-foreground/70">{m.bio}</p>
              </div>
            </div>
              </div>
            ))}
          </div>

          {/* Dots (phones only) — the active one fills up until the next turn */}
          <div className="sm:hidden flex justify-center gap-2 mt-5">
            {members.map((m, i) => (
              <button
                key={m.name}
                type="button"
                aria-label={`Prikaži ${m.name}`}
                onClick={() => {
                  pause();
                  goTo(i);
                }}
                className={`relative h-2 rounded-full overflow-hidden transition-all duration-300 ${
                  i === active ? "w-7 bg-accent/30" : "w-2 bg-foreground/15"
                }`}
              >
                {i === active && (
                  <span
                    key={cycle}
                    className="absolute inset-y-0 left-0 bg-accent rounded-full motion-reduce:animate-none! motion-reduce:w-full!"
                    style={autoplay ? { animation: `teamDotFill ${INTERVAL}ms linear forwards` } : { width: "100%" }}
                  />
                )}
              </button>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
