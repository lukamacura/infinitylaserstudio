"use client";

import Reveal from "@/components/Reveal";
import Image from "next/image";

const members = [
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
];

export default function TeamSection() {
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
          className="font-playfair text-4xl md:text-5xl text-foreground text-center leading-tight mb-4"
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

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {members.map((m, i) => (
            <Reveal key={m.name} y={40} delay={0.15 + i * 0.18} margin="-60px" className="flex">
            <div className="group relative flex-1 bg-surface rounded-3xl overflow-hidden shadow-sm border border-foreground/8 flex flex-col transition-transform duration-300 ease-out hover:-translate-y-1.5">
              {/* Photo */}
              <div className="relative w-full aspect-4/5 overflow-hidden">
                <Image
                  src={m.src}
                  alt={m.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 372px"
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />

                {/* Name on photo */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-playfair text-2xl text-white leading-none">{m.name}</p>
                  <p className="font-poppins text-xs text-white/80 mt-0.5 tracking-wide">{m.role}</p>
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
                <p className="font-poppins text-sm text-foreground/60 leading-relaxed">{m.bio}</p>
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
