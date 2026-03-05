"use client";

import { motion } from "framer-motion";

interface Props { onOpen: () => void; }

export default function CostComparison({ onOpen }: Props) {
  return (
    <section className="py-20 px-6 bg-cream">
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
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
            <div className="flex items-center justify-between mb-2">
              <span className="font-poppins text-sm text-gray-500">Brijanje, vosak i kreme - 20 godina</span>
              <span className="font-poppins text-sm font-semibold" style={{ color: "#C0627A" }}>500.000+ RSD</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "#C0627A" }}
                initial={{ width: "0%" }}
                whileInView={{ width: "91%" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
          </div>

          {/* Laser */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-poppins text-sm text-gray-500">Infinity Laser — po tretmanu</span>
              <span className="font-poppins text-sm font-semibold text-teal">~7.790 RSD / tretman</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-teal"
                initial={{ width: "0%" }}
                whileInView={{ width: "2%" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { value: "500.000+ RSD", label: "ostaje u tvom džepu" },
            { value: "72 sata", label: "svake godine - na ništa" },
            { value: "Za 2 godine", label: "laser se već isplatio" },
          ].map((s) => (
            <div key={s.label} className="text-center bg-white rounded-2xl py-5 px-3 shadow-sm border border-gray-100">
              <p className="font-playfair text-xl text-gray-800 mb-1">{s.value}</p>
              <p className="font-poppins text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onOpen}
            className="inline-block px-8 py-3 rounded-full bg-teal font-poppins text-sm font-medium text-gray-800 hover:bg-mint transition-colors cursor-pointer"
          >
            Izračunaj svoju uštedu - besplatno
          </button>
        </div>
      </motion.div>
    </section>
  );
}
