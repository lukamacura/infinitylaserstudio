"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";

const faqs = [
  {
    q: "Šta je ustvari laserska epilacija?",
    a: "Trajna epilacija funkcioniše tako što laser emituje svetlost određene talasne dužine koja prepoznaje pigment dlake i deluje na nju tako što je termički oštećuje do korena bez oštećenja okolnih tkiva i kože.",
  },
  {
    q: "Da li boli?",
    a: "Tokom tretmana može se osetiti nelagodnost u vidu peckanja slabijeg ili jačeg intenziteta koja vrlo kratko traje i prestaje odmah nakon završenog tretmana.",
  },
  {
    q: "Da li je tretman bezbedan?",
    a: "Apsolutno. Laserski snop prepoznaje talasnu dužinu melanina u dlaci i uništava koren dlake. Nema dejstvo na ostala tkiva.",
  },
  {
    q: "Kada se vide prvi rezultati?",
    a: "Već posle jednog tretmana uništava se oko 20% dlačica.",
  },
  {
    q: "Koliko tretmana treba?",
    a: "Za telo je obično dovoljno 6–8 tretmana, dok lice traži oko 10. Tretmani se rade na 6–8 nedelja. Dlake prolaze kroz različite faze rasta, a samo dlaka u aktivnoj fazi može biti uništena. Zbog toga je serija tretmana ključna za trajni rezultat.",
  },
  {
    q: "Ko ne sme da radi tretman?",
    a: "Trudnice, dojilje, osobe koje boluju od malignih bolesti i progresivnih neuroloških oboljenja. Oprez se preporučuje kod dijabetičara, osoba sa proširenim venama, psorijazom i osoba koje boluju od epilepsije. Nakon obavljenih konsultacija sa doktoricom odlučuje se o tretmanima.",
  },
  {
    q: "Da li tretmane laserske epilacije mogu da rade maloletne osobe?",
    a: "Epilacija se može raditi od 15. godine uz saglasnost roditelja i uz prethodnu konsultaciju sa doktoricom.",
  },
  {
    q: "Da li se laserska epilacija može raditi leti?",
    a: "Uz mere opreza kao što su izbegavanje direktnog izlaganja suncu/solarijumu minimalno 5 dana pre i nakon tretmana.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 section-y px-6 bg-background-alt">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Reveal className="max-w-3xl mx-auto">
        {/* Heading */}
        <div className="text-center section-head">
          <h2 className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15]">
            Tvoja pitanja,{" "}
            <span className="relative inline-block">
              naši odgovori
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 3" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>
        </div>

        {/* Accordion */}
        <div className="flex flex-col divide-y divide-foreground/8">
          {faqs.map((faq, i) => (
            <div key={i} className="py-5">
              <button
                className="w-full flex items-center justify-between gap-4 text-left group"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-poppins text-base font-medium text-foreground group-hover:text-accent transition-colors">
                  {faq.q}
                </span>
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    open === i ? "bg-accent" : "bg-foreground/6"
                  }`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}
                    fill="none"
                  >
                    <path d="M8 3v10M3 8h10" stroke={open === i ? "#1E1017" : "#B9A9AC"} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              {/* Always in the page, so Google reads every answer - closed ones are only hidden. */}
              <p
                hidden={open !== i}
                className="mt-3 font-poppins text-copy text-foreground/70 pr-6 sm:pr-12"
              >
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
