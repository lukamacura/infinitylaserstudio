"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const members = [
  {
    name: "Mila",
    role: "Medicinska sestra",
    quote: "Svaki tretman je priča za sebe.",
    bio: "Preciznost, toplina i posvećenost - Mila svaku klijentkinju dočeka s pažnjom kakvu zaslužuje.",
    src: "/mila.jpg",
    accent: "#ACE6E4",
  },
  {
    name: "Tanja",
    role: "Medicinska sestra",
    quote: "Rezultati govore. Osmesi potvrđuju.",
    bio: "Mirna ruka, brz tretman i uvek raspoložena za razgovor. Tanja se stara da se iz ordinacije izađe s osmehom - i bez dlaka. Specijalizovana za tretmane lica i osetljivih zona.",
    src: "/tanja.jpg",
    accent: "#FCCAE2",
  },
];

const cardVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.15 + i * 0.18,
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export default function TeamSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500">
            <span className="w-6 h-px bg-teal inline-block" />
            Upoznaj tim
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-playfair text-4xl md:text-5xl text-gray-800 text-center leading-tight mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          Ruke kojima{" "}
          <span className="relative inline-block">
            možeš verovati
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#FCCAE2" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </motion.h2>

        <motion.p
          className="text-center font-poppins text-gray-500 text-base mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          Sertifikovane terapeutkinje sa stotinama zadovoljnih klijentkinja.
        </motion.p>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {members.map((m, i) => (
            <motion.div
              key={m.name}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              whileHover={{ y: -6, transition: { duration: 0.3, ease: "easeOut" } }}
              className="group relative bg-cream rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col"
            >
              {/* Photo */}
              <div className="relative w-full aspect-4/5 overflow-hidden">
                <Image
                  src={m.src}
                  alt={m.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
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
                  className="font-playfair italic text-gray-700 text-base leading-snug border-l-[3px] pl-3"
                  style={{ borderColor: m.accent }}
                >
                  &ldquo;{m.quote}&rdquo;
                </blockquote>
                <p className="font-poppins text-sm text-gray-500 leading-relaxed">{m.bio}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
