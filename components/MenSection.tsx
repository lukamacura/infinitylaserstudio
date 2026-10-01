interface Props { onOpen: () => void; }

export default function MenSection({ onOpen }: Props) {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="bg-linear-to-br from-surface-raised to-surface border border-foreground/8 rounded-3xl p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
              <span className="w-6 h-px bg-accent inline-block" />
              Za muškarce
            </span>
            <h2 className="font-playfair text-4xl md:text-5xl text-foreground leading-tight mb-6">
              Uredno, bez kompromisa.
            </h2>
            <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
              Dlake na leđima, ramenima ili vratu ne bi trebalo da budu razlog za nelagodnost.
            </p>
            <p className="font-poppins text-foreground/70 text-base leading-relaxed mb-4">
              Sportisti, aktivni muškarci i svi koji cene uredan izgled &apos;&apos; laserska epilacija je isto što i redovan frizer. Samo ređe.
            </p>
            <p className="font-poppins text-foreground/60 text-sm leading-relaxed mb-8">
              Tretmani su brzi i prilagođeni muškoj koži.
            </p>
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full metal font-poppins text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Zakaži svoj 1. tretman
              <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Visual – zones list */}
          <div className="flex flex-col gap-4">
            {[
              { zone: "Leđa i ramena", desc: "Najtraženija regija kod muškaraca" },
              { zone: "Vrat i brada", desc: "Preciznost bez svakodnevnog brijanja" },
              { zone: "Grudi i stomak", desc: "Glatkoća koja traje mesecima" },
              { zone: "Noge i ruke", desc: "Za sportiste i aktivne stilove života" },
            ].map((item) => (
              <div
                key={item.zone}
                className="flex items-center gap-4 bg-foreground/4 border border-foreground/8 rounded-2xl px-5 py-4"
              >
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="font-poppins text-sm font-semibold text-foreground">{item.zone}</p>
                  <p className="font-poppins text-xs text-foreground/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
