"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface Props { onOpen: () => void; }

type ServiceCard =
  | {
      name: string;
      description: string;
      price: string;
      type: "photo";
      photo: string;
    }
  | {
      name: string;
      description: string;
      price: string;
      type: "icon";
      gradient: string;
      icon: React.ReactNode;
    };

const services: ServiceCard[] = [
  {
    name: "Noge + Intima",
    description: "Sloboda na plaži i u svakom trenutku. Glatka koža bez posledica brijanja i voska.",
    price: "6000 rsd",
    type: "photo",
    photo: "/intime.png",
  },
  {
    name: "Nausnice + brada",
    description: "Savršeno definisane linije. Jednom epilacija i zauvek uredno.",
    price: "1800 rsd",
    type: "photo",
    photo: "/face.png",
  },
  {
    name: "Stomak + Grudi",
    description: "Čisto i uredno. Zauvek rešeno - bez brijanja, bez iritacija.",
    price: "5700 rsd",
    type: "photo",
    photo: "/full_body.png",
  },
];

export default function FeaturedServices({ onOpen }: Props) {
  return (
    <section id="usluge" className="py-20 px-6 bg-white">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Heading */}
        <div className="text-center mb-4">
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 mb-3">
            Tretmani koji ti štede vreme
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <svg viewBox="0 0 180 14" className="w-44 h-3" fill="none">
              <path d="M4 10 Q30 2 60 8 Q90 14 120 6 Q150 -2 176 7" stroke="#FCCAE2" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </div>
        <p className="text-center font-poppins text-gray-500 text-base mb-14">
          Popularni paketi. Jedno trajno rešenje.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((s) => (
            <div
              key={s.name}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300"
            >
              {/* Image area */}
              {s.type === "photo" ? (
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={s.photo}
                    alt={s.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div className={`bg-gradient-to-br ${s.gradient} h-56 flex items-center justify-center p-10`}>
                  <div className="w-32 h-32">
                    {s.icon}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                <h3 className="font-playfair text-xl text-gray-800 mb-1">{s.name}</h3>
                <p className="font-poppins text-sm text-gray-500 mb-3 leading-relaxed">{s.description}</p>
                <p className="font-poppins text-base font-semibold text-gray-700 mb-4">{s.price}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <button
            onClick={onOpen}
            className="inline-block px-8 py-3 rounded-full bg-teal font-poppins text-sm font-medium text-gray-800 hover:bg-mint transition-colors"
          >
            Zakaži tretman
          </button>
        </div>
      </motion.div>
    </section>
  );
}
