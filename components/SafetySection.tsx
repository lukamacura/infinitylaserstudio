"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Activity, Crosshair, BookOpen, ChevronDown } from "lucide-react";

// Put the generated illustration in /public/bezbednost/ and set its path here.
// Until then the section draws its own skin cross-section (SkinDiagram below).
const SAFETY_IMAGE: string | null = "/hero/bezbednost.webp";

const facts = [
  {
    icon: Activity,
    title: "Reakcije su blage i prolazne",
    text: "Naučna literatura pokazuje da su najčešće reakcije posle tretmana crvenilo i blagi otok oko folikula - i brzo prolaze. Trajne komplikacije su veoma retke.",
  },
  {
    icon: Crosshair,
    title: "Laser gađa samo folikul",
    text: "Svetlost upija melanin u dlaci, a toplota uništava samo koren. Do folikula je nekoliko milimetara - nema dokaza da laser oštećuje nerve, limfni sistem, organe, jajnike ili matericu, niti da utiče na plodnost.",
  },
  {
    icon: BookOpen,
    title: "104 publikacije, jedan zaključak",
    text: "Veliki pregled iz 2023. godine zaključuje da se većina komplikacija može sprečiti pravilnom procenom kože, dobro odabranim parametrima i obučenim operaterom.",
  },
];

// Collapsed like a paywalled article: the TEXT is cut at PEEK of its height and
// fades into the background from CLEAR on, with the "Pročitaj više" CTA below.
// On phones the picture sits above the text and stays fully visible.
const CLEAR = 0.3;
const PEEK = 0.45;

export default function SafetySection() {
  const contentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<{ full: number; top: number; text: number } | null>(null);
  // closed -> opening (animating to full height) -> open (no cap, so the sticky image works)
  const [state, setState] = useState<"closed" | "opening" | "open">("closed");

  useEffect(() => {
    const el = contentRef.current;
    const text = textRef.current;
    if (!el || !text) return;
    const measure = () => setM({ full: el.scrollHeight, top: text.offsetTop - el.offsetTop, text: text.offsetHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(text);
    return () => ro.disconnect();
  }, []);

  const closed = state === "closed";
  const cut = m ? m.top + m.text * PEEK : null;
  const maxHeight = state === "open" ? undefined : closed ? cut ?? "30rem" : m?.full;
  const fadeFrom = m && cut ? `${Math.round(((m.top + m.text * CLEAR) / cut) * 100)}%` : "60%";
  const fade = `linear-gradient(to bottom, black ${fadeFrom}, transparent)`;

  return (
    <section id="bezbednost" className="scroll-mt-24 section-y px-6 bg-background">
      <div
        // Animated only while opening: the first measurement (and resizes)
        // snap instead of re-laying out the page for 700 ms during load.
        className={`max-w-6xl mx-auto ${state === "open" ? "" : "overflow-hidden"} ${state === "opening" ? "transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""}`}
        style={{ maxHeight, maskImage: closed ? fade : undefined, WebkitMaskImage: closed ? fade : undefined }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && state === "opening") setState("open");
        }}
      >
      <div ref={contentRef} id="bezbednost-sadrzaj" className="grid grid-cols-1 md:grid-cols-[1fr_1.08fr] gap-10 md:gap-14 items-start max-md:gap-0 max-md:overflow-hidden max-md:rounded-3xl max-md:border max-md:border-foreground/10 max-md:bg-[#140A10] max-md:shadow-lg">
        {/* Visual */}
        <div data-rv="zoom" className="relative md:sticky md:top-28">
          {SAFETY_IMAGE ? (
            <figure className="relative aspect-[960/1192] md:aspect-square w-full overflow-hidden md:rounded-3xl md:border md:border-foreground/10 md:shadow-lg">
              {/* Square crop drops the empty dark band above the beam and below the skin block */}
              <Image
                src={SAFETY_IMAGE}
                alt="Laser deluje samo na folikul dlake, nekoliko milimetara ispod površine kože"
                fill
                sizes="(max-width: 768px) 100vw, 540px"
                className="object-cover md:object-[50%_35%] md:scale-[1.06]"
              />

              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#140A10] to-transparent md:hidden" />

              {/* Bottom band: what stays untouched */}
              <figcaption className="max-md:hidden absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent px-5 sm:px-6 pt-12 pb-5">
                <p className="font-poppins text-eyebrow uppercase tracking-[0.18em] text-accent">Par milimetara ispod kože</p>
                <p className="font-poppins text-sm sm:text-base text-foreground/85 mt-1">
                  Nervi, limfni sistem i organi ostaju netaknuti.
                </p>
              </figcaption>
            </figure>
          ) : (
            <SkinDiagram />
          )}
        </div>

        {/* Text */}
        <div ref={textRef} className="relative z-10 max-md:-mt-[30%] max-md:px-5 max-md:pb-6">
          <span data-rv className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
            <span className="w-6 h-px bg-accent inline-block" />
            Bezbednost
          </span>

          <h2 data-rv className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15] mb-4">
            Da li je laserska epilacija{" "}
            <span className="relative inline-block">
              bezbedna?
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>

          <p data-rv className="font-poppins text-foreground/70 text-base leading-relaxed mb-8">
            <span className="font-semibold text-foreground">Da.</span> Kada se izvodi pravilno - odgovarajućim
            laserom i parametrima prilagođenim tipu kože i dlake - laserska epilacija ima veoma dobar
            bezbednosni profil.
          </p>

          <ul className="flex flex-col gap-5 mb-8">
            {facts.map((f, i) => (
              <li
                key={f.title}
                data-rv
                style={{ "--rv-i": i + 1 } as CSSProperties}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                  <f.icon className="w-[18px] h-[18px] text-accent" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-poppins text-base font-semibold text-foreground">{f.title}</p>
                  <p className="font-poppins text-copy text-foreground/70 mt-1">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* The point: it is the hands, not the machine */}
          <blockquote data-rv className="border-l-4 border-accent pl-4">
            <p className="font-playfair italic text-foreground/85 text-[1.0625rem] sm:text-lg leading-relaxed">
              &ldquo;Bezbednost ne zavisi samo od lasera - već od toga ko ga koristi i kako. Vaša koža
              zaslužuje medicinski pristup, a ne samo aparat.&rdquo;
            </p>
            <p className="font-poppins text-meta text-foreground/60 mt-2">
              - Dr Ana Kasap, osnivač &amp; doktor medicine
            </p>
          </blockquote>

          <p data-rv className="font-poppins text-eyebrow text-foreground/50 mt-6">
            Izvori: Mallat et al., 2023; Lim &amp; Lanigan, 2006.
          </p>
        </div>
      </div>

      </div>

      {closed && (
        <div className="relative -mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setState("opening")}
            aria-expanded={false}
            aria-controls="bezbednost-sadrzaj"
            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-8 py-3.5 font-poppins text-sm font-medium text-foreground/80 tracking-wide backdrop-blur-sm hover:bg-foreground/10 hover:border-foreground/30 active:scale-95 transition-all cursor-pointer"
          >
            Pročitaj više
            <ChevronDown className="w-4 h-4" strokeWidth={2.25} />
          </button>
        </div>
      )}
    </section>
  );
}

/** Skin cross-section: the beam stops at the follicle, the layers below stay untouched. */
function SkinDiagram() {
  return (
    <svg
      viewBox="0 0 400 480"
      className="w-full max-w-md rounded-3xl border border-foreground/10 bg-surface shadow-lg"
      role="img"
      aria-label="Presek kože: laserski snop se zaustavlja na folikulu dlake, dublja tkiva ostaju netaknuta"
    >
      <defs>
        <linearGradient id="sd-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EBC6C3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#DCA8A6" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id="sd-glow">
          <stop offset="0" stopColor="#EBC6C3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#DCA8A6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Layers */}
      <rect x="0" y="120" width="400" height="22" fill="#3A2229" />
      <rect x="0" y="142" width="400" height="148" fill="#2A1821" />
      <rect x="0" y="290" width="400" height="190" fill="#1E1017" />
      <line x1="0" y1="290" x2="400" y2="290" stroke="#F5E6E6" strokeOpacity="0.12" strokeDasharray="4 6" />

      {/* Hair + follicle */}
      <path d="M200 40 Q204 90 200 120 L200 236" stroke="#120A0E" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="200" cy="246" rx="13" ry="17" fill="#120A0E" />

      {/* Beam converging on the bulb */}
      <path d="M150 20 L250 20 L206 244 L194 244 Z" fill="url(#sd-beam)" />
      <circle cx="200" cy="246" r="42" fill="url(#sd-glow)" />

      {/* Depth marker */}
      <line x1="320" y1="120" x2="320" y2="246" stroke="#DCA8A6" strokeWidth="1.5" />
      <line x1="312" y1="120" x2="328" y2="120" stroke="#DCA8A6" strokeWidth="1.5" />
      <line x1="312" y1="246" x2="328" y2="246" stroke="#DCA8A6" strokeWidth="1.5" />
      <text x="334" y="188" fill="#DCA8A6" fontSize="13" fontFamily="var(--font-poppins)">par mm</text>

      {/* Labels */}
      <text x="20" y="112" fill="#F5E6E6" fillOpacity="0.55" fontSize="12" fontFamily="var(--font-poppins)">Koža</text>
      <text x="20" y="276" fill="#F5E6E6" fillOpacity="0.55" fontSize="12" fontFamily="var(--font-poppins)">Folikul dlake</text>
      <text x="200" y="380" textAnchor="middle" fill="#F5E6E6" fillOpacity="0.7" fontSize="14" fontFamily="var(--font-poppins)">
        Nervi, limfni sistem, organi
      </text>
      <text x="200" y="402" textAnchor="middle" fill="#DCA8A6" fontSize="14" fontWeight="600" fontFamily="var(--font-poppins)">
        - netaknuti
      </text>
    </svg>
  );
}
