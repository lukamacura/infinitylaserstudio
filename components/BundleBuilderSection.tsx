"use client";

import { Sparkles, CheckCircle2, CalendarHeart } from "lucide-react";
import { computeBundle } from "@/lib/bundles";

interface BundleBuilderSectionProps {
  /** Open the modal at the region picker (build from scratch). */
  onOpen: () => void;
  /** Open the modal with regions preselected and a bundle size chosen. */
  onOpenBundle: (keywords: string[], size: number) => void;
}

function formatPrice(n: number): string {
  return n.toLocaleString("sr-RS");
}

/** Pre-calculated showcase bundles (women's list prices from the catalog). */
const EXAMPLES = [
  { title: "Celo telo", subtitle: "Cela površina tela", price: 8500, sessions: 8, keywords: ["telo"], category: "body" as const },
  { title: "Celo lice", subtitle: "Kompletan tretman lica", price: 2500, sessions: 10, keywords: ["lice"], category: "face" as const },
  { title: "Noge + Intima", subtitle: "Najtraženija kombinacija", price: 6000, sessions: 6, keywords: ["noge", "intima"], category: "body" as const },
];

const STEPS = [
  { Icon: Sparkles, title: "1. Izaberi regije", text: "Označi sve regije koje želiš da rešiš — kombinuj lice i telo kako ti odgovara." },
  { Icon: CheckCircle2, title: "2. Izaberi paket", text: "Veći paket = veći popust. Za pun rezultat telu treba 6–8, a licu 10 tretmana." },
  { Icon: CalendarHeart, title: "3. Plati jednom", text: "Platiš ceo paket na prvom tretmanu i rezervišeš sve preostale termine uz zagarantovanu dostupnost." },
];

export default function BundleBuilderSection({ onOpen, onOpenBundle }: BundleBuilderSectionProps) {
  return (
    <section id="paketi" className="scroll-mt-24 bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Heading */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-pink/10 px-4 py-1.5 text-xs font-poppins font-semibold tracking-widest text-[#c0306a] uppercase">
            <Sparkles size={14} /> Napravi svoj paket
          </span>
          <h2 className="font-playfair text-3xl md:text-4xl text-foreground mt-5 leading-tight">
            Uzmi više tretmana — plati znatno manje
          </h2>
          <p className="font-poppins text-sm md:text-base text-foreground/55 mt-4 leading-relaxed">
            Trajni rezultat dolazi sa serijom tretmana. Zato smo napravili pakete: što više tretmana uzmeš, to je veći popust — do <span className="font-semibold text-foreground/80">21%</span>. Posle početne serije, održavanje je potrebno samo 1–2 puta godišnje.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {STEPS.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-foreground/8 bg-foreground/2 p-6">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-pink/10 mb-4">
                <Icon size={20} className="text-[#c0306a]" />
              </div>
              <h3 className="font-poppins text-sm font-bold text-foreground">{title}</h3>
              <p className="font-poppins text-xs text-foreground/55 mt-1.5 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Pre-calculated examples */}
        <div className="text-center mb-8">
          <h3 className="font-playfair text-2xl text-foreground">Primeri paketa</h3>
          <p className="font-poppins text-sm text-foreground/50 mt-2">Cene za žene · popust se obračunava po regiji</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {EXAMPLES.map((ex) => {
            const b = computeBundle([{ name: ex.title, price: ex.price }], ex.sessions);
            return (
              <div
                key={ex.title}
                className="relative flex flex-col rounded-3xl border-2 border-foreground/8 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="absolute -top-3 right-5 rounded-full bg-green-500 px-3 py-1 text-[11px] font-poppins font-bold text-white tracking-wide">
                  Ušteda {formatPrice(b.savings)} RSD
                </span>

                <p className="font-poppins text-base font-bold text-foreground">{ex.title}</p>
                <p className="font-poppins text-xs text-foreground/45 mt-0.5">{ex.subtitle}</p>

                <div className="flex items-center gap-2 mt-5">
                  <span className="rounded-md bg-pink/10 px-2 py-0.5 text-xs font-poppins font-bold text-[#c0306a]">
                    {ex.sessions} tretmana
                  </span>
                  <span className="rounded-md bg-foreground/5 px-2 py-0.5 text-xs font-poppins font-bold text-foreground/60">
                    −{b.blendedPct}%
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-poppins text-sm text-foreground/35 line-through leading-none">
                    {formatPrice(b.originalTotal)} RSD
                  </p>
                  <p className="font-playfair text-3xl text-[#c0306a] leading-tight mt-1">
                    {formatPrice(b.finalTotal)} RSD
                  </p>
                  <p className="font-poppins text-xs text-foreground/55 mt-1.5">
                    samo <span className="font-semibold text-foreground/75">{formatPrice(b.pricePerSession)} RSD</span> po tretmanu
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenBundle(ex.keywords, ex.sessions)}
                  className="mt-6 w-full rounded-full bg-pink py-3 text-sm font-poppins font-semibold text-black tracking-wide hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Uzmi ovaj paket
                </button>
              </div>
            );
          })}
        </div>

        {/* Primary CTA — build your own */}
        <div className="text-center mt-14">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-poppins font-semibold text-white tracking-wide hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles size={16} /> Napravi svoj paket
          </button>
          <p className="font-poppins text-xs text-foreground/40 mt-3">
            Izaberi svoje regije i otkrij koliko štediš.
          </p>
        </div>
      </div>
    </section>
  );
}
