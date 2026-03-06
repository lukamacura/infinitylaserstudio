"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "Da li boli?",
    a: "Savremeni laseri dolaze sa sistemom hlađenja koji čini tretman prijatnim. Većina klijenata opisuje osećaj kao blag udarac elastičnom trakom - kratkotrajan i potpuno podnošljiv. Posle tretmana nema crvenila ni oporavka.",
  },
  {
    q: "Koliko tretmana treba?",
    a: "Između 6 i 8 tretmana, na svakih 4–6 nedelja. Dlake prolaze kroz različite faze rasta, a laser deluje samo u aktivnoj fazi - zbog toga je serija ključna za trajni rezultat. Posle serije, dlaka se ne vraća.",
  },
  {
    q: "Kako se pripremiti za tretman?",
    a: "Partiju tela obrij 24 sata pre dolaska - ne depilacijom voskom ili kremom. Izbegavaj sunce i samoposmeđujuće preparate 2 nedelje pre tretmana. Dođi sa čistom, nenavlaženom kožom. O svemu ostalom brinu naši stručnjaci.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="cenovnik" className="py-20 px-6 bg-cream">
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Heading */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Česta pitanja
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800">
            Tvoja pitanja,{" "}
            <span className="relative inline-block">
              naši odgovori
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 3" stroke="#FCD6ED" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>
        </div>

        {/* Accordion */}
        <div className="flex flex-col divide-y divide-gray-100">
          {faqs.map((faq, i) => (
            <div key={i} className="py-5">
              <button
                className="w-full flex items-center justify-between gap-4 text-left group"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-poppins text-base font-medium text-gray-800 group-hover:text-teal transition-colors">
                  {faq.q}
                </span>
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    open === i ? "bg-teal" : "bg-gray-100"
                  }`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}
                    fill="none"
                  >
                    <path d="M8 3v10M3 8h10" stroke={open === i ? "#1a1a1a" : "#6b7280"} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              {open === i && (
                <p className="mt-3 font-poppins text-sm text-gray-500 leading-relaxed pr-12">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
