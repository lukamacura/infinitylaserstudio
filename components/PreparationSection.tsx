"use client";

import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    text: "Pre prvog tretmana mora proći minimum mesec dana od poslednjeg čupanja dlačica bilo koje vrste.",
  },
  {
    num: "02",
    text: "Dlačice uklanjati isključivo brijačem ili kremom za depilaciju — nikako čupanjem.",
  },
  {
    num: "03",
    text: "Dan pre dolaska na tretman obrijati dlačice ili ih ukloniti depilacijskom kremom.",
  },
  {
    num: "04",
    text: "Na dan tretmana na kožu ne nanositi nikakve preparate (kreme, ulja, dezodorans).",
  },
];

export default function PreparationSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Pre tretmana
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800">
            Priprema za{" "}
            <span className="relative inline-block">
              tretman
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 3" stroke="#FCD6ED" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>
          <p className="font-poppins text-sm text-gray-500 mt-5 leading-relaxed max-w-lg mx-auto">
            Pravilna priprema direktno utiče na efikasnost i bezbednost tretmana. Molimo te da se pridržavaš sledećih koraka.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-5">
              <span className="font-playfair text-3xl text-pink/60 leading-none shrink-0 w-10 text-right">
                {step.num}
              </span>
              <div className="border-l-2 border-pink/30 pl-5 py-0.5">
                <p className="font-poppins text-sm text-gray-600 leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
