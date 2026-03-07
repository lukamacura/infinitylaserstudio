"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "Šta je ustvari laserska epilacija?",
    a: "Trajna epilacija funkcioniše tako što laser emituje svetlost određene talasne dužine koja prepoznaje pigment dlake i deluje na nju tako što je termički oštećuje do korena bez oštećenja okolnih tkiva i kože.",
  },
  {
    q: "Da li boli?",
    a: "Onaj ko vam kaže NE – laže! Istina je da se bol ne može uporediti sa bolom depilacije. Može se osetiti samo blago peckanje koje prestaje odmah po završetku tretmana.",
  },
  {
    q: "Da li je tretman bezbedan?",
    a: "Apsolutno! Laserski snop prodire samo nekoliko milimetara u kožu pa ne ugrožava žlezde niti okolna tkiva.",
  },
  {
    q: "Kada se vide prvi rezultati?",
    a: "Već posle jednog tretmana uništava se oko 20% dlačica.",
  },
  {
    q: "Koliko tretmana treba?",
    a: "Između 6 i 10 tretmana, na svakih 4–6 nedelja. Dlake prolaze kroz različite faze rasta, a laser deluje samo u aktivnoj fazi - zbog toga je serija ključna za trajni rezultat. Posle serije, dlaka se ne vraća.",
  },

  {
    q: "Ko ne sme da radi tretmane laserske epilacije?",
    a: "Osobe koje imaju epilepsiju ne smeju na tretmane laserske epilacije. Trudnicama se ne preporučuju tretmani, kao i osobama koje imaju psorijazu.",
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
