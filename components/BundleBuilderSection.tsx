"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { computeBundle, SHOWCASE_BUNDLES } from "@/lib/bundles";
import BundlePhoneDemo from "@/components/BundlePhoneDemo";

interface BundleBuilderSectionProps {
  /** Open the modal with regions preselected and a bundle size chosen. */
  onOpenBundle: (keywords: string[], size: number) => void;
}

function formatPrice(n: number): string {
  return n.toLocaleString("sr-RS");
}

export default function BundleBuilderSection({ onOpenBundle }: BundleBuilderSectionProps) {
  return (
    <section id="paketi" className="scroll-mt-24 bg-background section-y">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Heading */}
        <div data-rv className="max-w-2xl mx-auto text-center section-head">
          <span className="inline-flex items-center gap-2 rounded-full bg-rose/10 px-4 py-1.5 text-xs font-poppins font-semibold tracking-widest text-accent uppercase">
            <Sparkles size={14} /> Napravi svoj paket
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-foreground mt-5 leading-tight">
            Uzmi više tretmana, plati znatno manje
          </h2>
          <p className="font-poppins text-sm md:text-base text-foreground/55 mt-4 leading-relaxed">
            Trajni rezultat dolazi sa serijom tretmana. do 21% popusta. 
          </p>
        </div>

        {/* How it works:the booking flow, played inside an iPhone */}
        <div data-rv className="mb-12 md:mb-24">
          <BundlePhoneDemo />
        </div>

        {/* Pre-calculated examples */}
        <div data-rv className="text-center section-head">
          <h3 className="font-playfair text-4xl md:text-5xl text-foreground leading-tight">
            Primeri{" "}
            <span className="relative inline-block">
              paketa
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h3>
          <p className="font-poppins text-sm text-foreground/50 mt-5">Cene za žene · popust se obračunava po regiji</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SHOWCASE_BUNDLES.map((ex, i) => {
            const b = computeBundle([{ name: ex.title, price: ex.price }], ex.sessions);
            return (
              // The wrapper carries the scroll reveal; the card keeps its own hover transition.
              <div key={ex.title} data-rv style={{ "--rv-i": i } as CSSProperties} className="flex">
              <div className="relative flex flex-1 flex-col rounded-3xl border-2 border-foreground/8 bg-surface p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                {/* Savings: rose-gold seal on the card's top edge */}
                <span className="metal absolute -top-3.5 right-5 inline-flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5 font-poppins shadow-lg shadow-black/40 ring-1 ring-white/25">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">Ušteda</span>
                  <span className="text-xs font-bold tabular-nums">{formatPrice(b.savings)} RSD</span>
                </span>

                {/* Package art (public/paketi, one per bundle size) + name */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 shrink-0 rounded-full overflow-hidden border-2 border-foreground/10 bg-rose/10 p-2">
                    <Image
                      src={`/paketi/${ex.sessions}.webp`}
                      alt=""
                      width={500}
                      height={500}
                      sizes="80px"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-poppins text-base font-bold text-foreground">{ex.title}</p>
                    <p className="font-poppins text-xs text-foreground/45 mt-0.5">{ex.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                  <span className="rounded-md bg-rose/10 px-2 py-0.5 text-xs font-poppins font-bold text-accent">
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
                  <p className="font-playfair text-3xl text-accent leading-tight mt-1">
                    {formatPrice(b.finalTotal)} RSD
                  </p>
                  <p className="font-poppins text-xs text-foreground/55 mt-1.5">
                    samo <span className="font-semibold text-foreground/75">{formatPrice(b.pricePerSession)} RSD</span> po tretmanu
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenBundle(ex.keywords, ex.sessions)}
                  className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-poppins font-semibold text-on-accent tracking-wide hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Uzmi ovaj paket
                </button>
              </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
