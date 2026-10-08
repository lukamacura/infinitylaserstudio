"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { Check, RotateCw } from "lucide-react";

const stats = [
  { value: "2000+", label: "Zadovoljnih klijenata" },
  { value: "20+", label: "Godina iskustva" },
  { value: "97%", label: "Klijenata koji se vraćaju" },
];

/** Phones: the photo carries the headline; a tap flips it to the details. */
function FounderFlipCard() {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  return (
    <div data-rv="zoom" className="md:hidden mx-auto w-full max-w-sm [perspective:1200px]">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "Vrati na sliku" : "Prikaži više o osnivaču"}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={`relative grid cursor-pointer select-none transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
      >
        {/* Front: photo + dark gradient with the headline. Stretches to the
            taller back face so no empty band shows below the photo. */}
        <div
          aria-hidden={flipped}
          className="col-start-1 row-start-1 self-stretch w-full min-w-0 relative aspect-[4/5] overflow-hidden rounded-3xl shadow-lg [backface-visibility:hidden]"
        >
          <Image
            src="/team/ana.webp"
            alt="Ana Kasap, osnivač Infinity Laser Studio"
            fill
            sizes="90vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 via-35% to-transparent to-65%" />
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-sm px-3 py-1.5">
            <Check className="w-3.5 h-3.5 text-accent" strokeWidth={2.5} />
            <span className="font-poppins text-meta font-medium text-white/90">Dr Ana Kasap · Osnivač &amp; Lekar</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
            <p className="font-poppins text-eyebrow uppercase tracking-[0.18em] text-accent mb-2">Reč osnivača</p>
            <h2 className="font-playfair text-title text-white leading-[1.15]">
              Medicina mi je dala znanje. <span className="text-accent">Vi ste mi dali razlog.</span>
            </h2>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 font-poppins text-sm font-medium text-white/80 tracking-wide backdrop-blur-sm">
              Pročitaj više o osnivaču
              <RotateCw className="w-4 h-4" strokeWidth={2} />
            </p>
          </div>
        </div>

        {/* Back: the details */}
        <div
          aria-hidden={!flipped}
          className="col-start-1 row-start-1 flex flex-col justify-center rounded-3xl border border-foreground/10 bg-surface-raised p-5 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <p className="font-poppins text-eyebrow uppercase tracking-[0.18em] text-accent mb-2">Dr Ana Kasap</p>
          <p className="font-poppins text-foreground/75 text-copy mb-2.5">
            Specijalistkinja urgentne medicine i dugogodišnji lekar hitne pomoći. Majka, supruga - žena koja zna šta znači brinuti o sebi i drugima.
          </p>
          <p className="font-poppins text-foreground/75 text-copy mb-2.5">
            Individualni pristup i lični saveti pre i posle tretmana - za kvalitetne i trajne rezultate.
          </p>
          <p className="font-poppins text-foreground/75 text-copy">
            Njena misija: da budete najlepša verzija sebe - diskretno i prirodno. Niko neće znati šta ste ulepšali. Samo će videti razliku.
          </p>

          <blockquote className="border-l-4 border-accent pl-3 my-3.5">
            <p className="font-playfair italic text-foreground/85 text-base leading-relaxed">
              &ldquo;Moja svrha je da pomažem drugima.&rdquo;
            </p>
          </blockquote>

          <div className="flex justify-between gap-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-playfair text-xl text-foreground">{stat.value}</p>
                <p className="font-poppins text-eyebrow leading-tight text-foreground/65 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrandStory() {
  return (
    <section id="o-nama" className="scroll-mt-24 section-y px-6 bg-background-alt">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        <FounderFlipCard />

        {/* Text (tablet/desktop) */}
        <div data-rv className="hidden md:block">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
            <span className="w-6 h-px bg-accent inline-block" />
            Reč osnivača
          </span>

          <h2 className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15] mb-6">
            Medicina mi je dala znanje.{" "}
            <span className="relative inline-block">
              Vi ste mi dali razlog.
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>

          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            Specijalistkinja urgentne medicine i dugogodišnji lekar u službi hitne medicinske pomoći. Obrazovana, uspešna, majka, supruga - žena koja zna šta znači istinski brinuti o sebi i drugima.
          </p>
          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            U svom radu neguje strogo individualni pristup svakom klijentu, jer čvrsto veruje da se pravi rezultati postižu jedino tako. Uz svaki tretman dobijate i njene lične savete pre i posle procedure - savete koji direktno utiču na kvalitet i trajnost rezultata.
          </p>
          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            Njena misija je da budete najlepša verzija sebe - diskretno, prirodno i sa punim samopouzdanjem. Niko neće znati šta ste tačno ulepšali. Samo će videti razliku.
          </p>

          {/* Pull quote */}
          <blockquote className="border-l-4 border-accent pl-4 my-6">
            <p className="font-playfair italic text-foreground/85 text-base leading-relaxed">
              &ldquo;Moja svrha je da pomažem drugima.&rdquo;
            </p>
            <p className="font-poppins text-xs text-foreground/60 mt-2">
              - Ana Kasap, osnivač &amp; doktor medicine
            </p>
          </blockquote>

          {/* Trust stats */}
          <div className="flex gap-8 mt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-playfair text-2xl text-foreground">{stat.value}</p>
                <p className="font-poppins text-xs text-foreground/60 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Image */}
        <div data-rv="zoom" style={{ "--rv-i": 1 } as CSSProperties} className="relative hidden md:flex justify-center order-first md:order-last">
          <Image
            src="/team/ana.webp"
            alt="Ana Kasap, osnivač Infinity Laser Studio"
            width={400}
            height={500}
            sizes="(max-width: 640px) 90vw, 384px"
            className="relative z-10 w-full max-w-sm rounded-3xl shadow-lg object-cover"
          />

          {/* Top-right badge: Dr. med. */}
          <div className="absolute -top-4 -right-4 z-20 bg-surface-raised border border-foreground/10 rounded-2xl shadow-lg shadow-black/40 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-on-accent" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-poppins text-xs font-semibold text-foreground">Dr Ana Kasap</p>
              <p className="font-poppins text-xs text-foreground/60">Osnivač &amp; Lekar</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
