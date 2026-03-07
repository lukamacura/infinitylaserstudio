"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Check } from "lucide-react";

export default function BrandStory() {
  return (
    <section id="o-nama" className="py-20 px-6 bg-cream">
      <motion.div
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Text */}
        <div>
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Reč osnivača
          </span>

          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 leading-tight mb-6">
            Medicina mi je dala znanje.{" "}
            <span className="relative inline-block">
              Vi ste mi dali razlog.
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#FCCAE2" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>

          <p className="font-poppins text-gray-600 text-base leading-relaxed mb-4">
            Specijalistkinja urgentne medicine i dugogodišnji lekar u službi hitne medicinske pomoći. Obrazovana, uspešna, majka, supruga - žena koja zna šta znači istinski brinuti o sebi i drugima.
          </p>
          <p className="font-poppins text-gray-600 text-base leading-relaxed mb-4">
            U svom radu neguje strogo individualni pristup svakom klijentu, jer čvrsto veruje da se pravi rezultati postižu jedino tako. Uz svaki tretman dobijate i njene lične savete pre i posle procedure - savete koji direktno utiču na kvalitet i trajnost rezultata.
          </p>
          <p className="font-poppins text-gray-600 text-base leading-relaxed mb-4">
            Njena misija je da budete najlepša verzija sebe - diskretno, prirodno i sa punim samopouzdanjem. Niko neće znati šta ste tačno ulepšali. Samo će videti razliku.
          </p>

          {/* Pull quote */}
          <blockquote className="border-l-4 border-teal pl-4 my-6">
            <p className="font-playfair italic text-gray-700 text-base leading-relaxed">
              &ldquo;Moja svrha je da pomažem drugima.&rdquo;
            </p>
            <p className="font-poppins text-xs text-gray-500 mt-2">
              - Ana Kasap, osnivač &amp; doktor medicine
            </p>
          </blockquote>

          {/* Trust stats */}
          <div className="flex gap-8 mt-8">
            {[
              { value: "4000+", label: "Zadovoljnih klijenata" },
              { value: "20+", label: "Godina iskustva" },
              { value: "99%", label: "Klijenata koji se vraćaju" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-playfair text-2xl text-gray-800">{stat.value}</p>
                <p className="font-poppins text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Image */}
        <div className="relative flex justify-center order-first md:order-last">
          <Image
            src="/ana.jpeg"
            alt="Ana Kasap, osnivač Infinity Laser Studio"
            width={400}
            height={500}
            className="relative z-10 w-full max-w-sm rounded-3xl shadow-lg object-cover"
          />

          {/* Top-right badge: Dr. med. */}
          <div className="absolute -top-4 -right-4 z-20 bg-white rounded-2xl shadow-md px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-poppins text-xs font-semibold text-gray-800">Dr. med. Ana Kasap</p>
              <p className="font-poppins text-xs text-gray-500">Osnivač &amp; Lekar</p>
            </div>
          </div>

          {/* Bottom-left badge: Certified studio */}
          <div className="absolute -bottom-4 -left-4 z-20 bg-white rounded-2xl shadow-md px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none">
                <path d="M10 3l1.8 3.6L16 7.6l-3 2.9.7 4.1L10 12.5l-3.7 2.1.7-4.1L4 7.6l4.2-.9L10 3z" fill="#FCFAE5" stroke="#ACE6E4" strokeWidth="0.5" />
              </svg>
            </div>
            <div>
              <p className="font-poppins text-xs font-semibold text-gray-800">Sertifikovani studio</p>
              <p className="font-poppins text-xs text-gray-500">EU standardi bezbednosti</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
