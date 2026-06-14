"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  onOpen: () => void;
  onOpenService: (keywords: string[]) => void;
}

type ServiceCard =
  | {
      name: string;
      description: string;
      price: string;
      keywords: string[];
      type: "photo";
      photo: string;
    }
  | {
      name: string;
      description: string;
      price: string;
      keywords: string[];
      type: "icon";
      gradient: string;
      icon: React.ReactNode;
    };

const services: ServiceCard[] = [
  {
    name: "Noge + Intima",
    description: "Sloboda na plaži i u svakom trenutku. Glatka koža bez posledica brijanja i voska.",
    price: "6000 rsd",
    keywords: ["noge", "intima"],
    type: "photo",
    photo: "/intime.png",
  },
  {
    name: "Nausnice + brada",
    description: "Čista linija lica, bez senke, dlaka i redovnog brijanja. Prirodan, uredan izgled koji ostaje dugo.",
    price: "1800 rsd",
    keywords: ["nausnice", "brada"],
    type: "photo",
    photo: "/face.png",
  },

];

export default function FeaturedServices({ onOpen, onOpenService }: Props) {
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
          Popularne kombinacije tretmana. Jedno trajno rešenje.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {services.map((s) => (
            <button
              key={s.name}
              onClick={() => onOpenService(s.keywords)}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:border-pink/30 transition-all duration-300 text-left cursor-pointer w-full"
            >
              {/* Image area */}
              {s.type === "photo" ? (
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={s.photo}
                    alt={s.name}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div className={`bg-linear-to-br ${s.gradient} h-56 flex items-center justify-center p-10`}>
                  <div className="w-32 h-32">
                    {s.icon}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                <h3 className="font-playfair text-xl text-gray-800 mb-1">{s.name}</h3>
                <p className="font-poppins text-sm text-gray-500 mb-3 leading-relaxed">{s.description}</p>
                <div className="flex items-center justify-between">
                  <p className="font-poppins text-base font-semibold text-gray-700">{s.price}</p>
                  <span className="text-xs font-poppins font-semibold tracking-widest text-[#E85D8A] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    ZAKAŽI →
                  </span>
                </div>
              </div>
            </button>
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
