import type { CSSProperties } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

export default function BrandStory() {
  return (
    <section id="o-nama" className="scroll-mt-24 section-y px-6 bg-background-alt">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text */}
        <div data-rv>
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
            <span className="w-6 h-px bg-accent inline-block" />
            Reč osnivača
          </span>

          <h2 className="font-playfair text-4xl md:text-5xl text-foreground leading-tight mb-6">
            Medicina mi je dala znanje.{" "}
            <span className="relative inline-block">
              Vi ste mi dali razlog.
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#DCA8A6" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h2>

          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            Specijalistkinja urgentne medicine i dugogodišnji lekar u službi hitne medicinske pomoći. Obrazovana, uspešna, majka, supruga - žena koja zna šta znači istinski brinuti o sebi i drugima.
          </p>
          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            U svom radu neguje strogo individualni pristup svakom klijentu, jer čvrsto veruje da se pravi rezultati postižu jedino tako. Uz svaki tretman dobijate i njene lične savete pre i posle procedure - savete koji direktno utiču na kvalitet i trajnost rezultata.
          </p>
          <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
            Njena misija je da budete najlepša verzija sebe - diskretno, prirodno i sa punim samopouzdanjem. Niko neće znati šta ste tačno ulepšali. Samo će videti razliku.
          </p>

          {/* Pull quote */}
          <blockquote className="border-l-4 border-accent pl-4 my-6">
            <p className="font-playfair italic text-foreground/85 text-base leading-relaxed">
              &ldquo;Moja svrha je da pomažem drugima.&rdquo;
            </p>
            <p className="font-poppins text-xs text-foreground/60 mt-2">
              - Ana Kasap, osnivač &amp; doktor medicine
            </p>
          </blockquote>

          {/* Trust stats */}
          <div className="flex gap-8 mt-8">
            {[
              { value: "2000+", label: "Zadovoljnih klijenata" },
              { value: "20+", label: "Godina iskustva" },
              { value: "99%", label: "Klijenata koji se vraćaju" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-playfair text-2xl text-foreground">{stat.value}</p>
                <p className="font-poppins text-xs text-foreground/60 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Image */}
        <div data-rv="zoom" style={{ "--rv-i": 1 } as CSSProperties} className="relative flex justify-center order-first md:order-last">
          <Image
            src="/team/ana.webp"
            alt="Ana Kasap, osnivač Infinity Laser Studio"
            width={400}
            height={500}
            sizes="(max-width: 640px) 90vw, 384px"
            className="relative z-10 w-full max-w-sm rounded-3xl shadow-lg object-cover"
          />

          {/* Top-right badge: Dr. med. */}
          <div className="absolute -top-4 -right-4 z-20 bg-surface-raised border border-foreground/10 rounded-2xl shadow-lg shadow-black/40 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-on-accent" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-poppins text-xs font-semibold text-foreground">Dr Ana Kasap</p>
              <p className="font-poppins text-xs text-foreground/60">Osnivač &amp; Lekar</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
