"use client";

import Reveal from "@/components/Reveal";

interface Props { onOpen: () => void; }

export default function CostComparison({ onOpen }: Props) {
  return (
    <section className="py-20 px-6 bg-cream">
      <Reveal className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500">
            <span className="w-6 h-px bg-teal inline-block" />
            Jednom platiš. Zauvek slobodna.
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
        </div>

        {/* Headline */}
        <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 text-center leading-tight mb-4">
          Šta bi radila sa{" "}
          <span className="relative inline-block">
            500.000 dinara više?
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#FCCAE2" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </h2>

        <p className="text-center font-poppins text-gray-500 text-base mb-12">
          Brijanje, vosak, kreme - sve to se sabira. Za 20 godina, prosečna žena potroši{" "}
          <strong className="text-gray-700">više od 500.000 dinara</strong> na dlake koje ionako nestaju.
          Laser to rešava jednom, za mnogo manje.
        </p>


        {/* Bars */}
        <div className="flex flex-col gap-5 mb-10">
          {/* Traditional */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-0.5">
              <span className="font-poppins text-sm text-gray-500">Brijanje, vosak i kreme - 20 godina</span>
              <span className="font-poppins text-sm font-semibold" style={{ color: "#C0627A" }}>500.000+ RSD</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <Reveal
                className="h-full rounded-full"
                style={{ backgroundColor: "#C0627A" }}
                from={{ width: "0%" }}
                to={{ width: "91%" }}
                margin="0px"
                duration={0.9}
                delay={0.3}
              />
            </div>
          </div>

          {/* Laser */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-0.5">
              <span className="font-poppins text-sm text-gray-500">Infinity Laser - po tretmanu</span>
              <span className="font-poppins text-sm font-semibold text-teal">~8.500 RSD / tretman</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <Reveal
                className="h-full rounded-full bg-teal"
                from={{ width: "0%" }}
                to={{ width: "2%" }}
                margin="0px"
                duration={0.9}
                delay={0.5}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { value: "500.000+ RSD", label: "ostaje u tvom džepu" },
            { value: "72 sata", label: "svake godine - na ništa" },
            { value: "Za 1 godinu", label: "laser se već isplatio" },
          ].map((s) => (
            <div key={s.label} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 bg-white rounded-2xl py-4 px-5 sm:py-5 sm:px-3 shadow-sm border border-gray-100">
              <p className="font-playfair text-xl text-gray-800 sm:mb-1 shrink-0">{s.value}</p>
              <p className="font-poppins text-xs text-gray-400 sm:text-center">{s.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onOpen}
            className="inline-block px-8 py-3 rounded-full bg-teal font-poppins text-sm font-medium text-gray-800 hover:bg-mint transition-colors cursor-pointer"
          >
            Zakaži tretman i uštedi novac
          </button>
        </div>
      </Reveal>
    </section>
  );
}
