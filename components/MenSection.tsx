interface Props { onOpen: () => void; }

export default function MenSection({ onOpen }: Props) {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-teal/20 to-mint/30 rounded-3xl p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
              <span className="w-6 h-px bg-teal inline-block" />
              Za muškarce
            </span>
            <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 leading-tight mb-6">
              Uredno, bez kompromisa.
            </h2>
            <p className="font-poppins text-gray-600 text-base leading-relaxed mb-4">
              Dlake na leđima, ramenima ili vratu ne bi trebalo da budu razlog za nelagodnost.
            </p>
            <p className="font-poppins text-gray-600 text-base leading-relaxed mb-4">
              Sportisti, aktivni muškarci i svi koji cene uredan izgled '' laserska epilacija je isto što i redovan frizer. Samo ređe.
            </p>
            <p className="font-poppins text-gray-500 text-sm leading-relaxed mb-8">
              Tretmani su brzi i prilagođeni muškoj koži.
            </p>
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-foreground text-background font-poppins text-sm font-medium hover:bg-teal hover:text-foreground transition-colors"
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
                className="flex items-center gap-4 bg-white/70 backdrop-blur-sm rounded-2xl px-5 py-4"
              >
                <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                <div>
                  <p className="font-poppins text-sm font-semibold text-gray-800">{item.zone}</p>
                  <p className="font-poppins text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
