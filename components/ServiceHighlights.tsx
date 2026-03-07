import Image from "next/image";

const highlights = [
  {
    title: "Bez bola. Stvarno.",
    description: "Uređaj hladi kožu u trenutku tretmana, tako da većina klijentkinja opisuje osećaj kao lagano peckanje - i ništa više.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#ACE6E4" opacity="0.3" />
        <path d="M20 8l2 6h6l-5 3.6 1.9 6L20 20l-4.9 3.6 1.9-6L12 14h6L20 8z" fill="#ACE6E4" />
      </svg>
    ),
  },
  {
    title: "Za tvoju kožu",
    description: "Svetla, tamna, osetljiva - svaki tip kože se tretira bezbedno. Parametri se podešavaju individualno, za tebe.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#C6F5E9" opacity="0.4" />
        <path d="M13 20h14M20 13v14" stroke="#ACE6E4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="5" fill="#ACE6E4" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: "Uštedi sat vremena - danas",
    description: "Lice gotovo za 5 minuta. Leđa za 10. Zakaži na pauzi - završi pre ručka.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#FCD6ED" opacity="0.4" />
        <circle cx="20" cy="20" r="8" stroke="#FCCAE2" strokeWidth="2" fill="none" />
        <path d="M20 14v6l4 2" stroke="#FCCAE2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Jednom. Zauvek.",
    description: "Posle serije tretmana dlaka se ne vraća. Nema više brijača, nema crvenila, nema sledećeg termina.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#FCFAE5" opacity="0.8" />
        <path d="M13 21l5 5 9-10" stroke="#ACE6E4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function ServiceHighlights() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Tehnologija
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800">
            Zašto klijenti ostaju?
          </h2>
        </div>
        <p className="text-center font-poppins text-gray-500 text-sm mb-16 max-w-xl mx-auto leading-relaxed">
          Više od 4.000 klijenata odabralo je Infinity Laser Studio. Evo šta ih je ubedilo  i zašto se uvek vraćaju.
        </p>

        {/* Three-column layout: highlights | image | highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Left highlights */}
          <div className="flex flex-col gap-10">
            {highlights.slice(0, 2).map((h) => (
              <div key={h.title} className="flex flex-col items-start gap-3 md:items-end md:text-right">
                <div>{h.icon}</div>
                <div>
                  <h3 className="font-playfair text-lg text-gray-800 mb-1">{h.title}</h3>
                  <p className="font-poppins text-sm text-gray-500 leading-relaxed">{h.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Center image */}
          <div className="flex justify-center">
            <div className="relative w-[32rem] h-[38rem]">
              <div className="absolute inset-20 rounded-full bg-pink opacity-50" />
              <Image
                src="/ATON-magnum.png"
                alt="ATON Magnum laser uređaj"
                fill
                className="object-contain z-10"
                sizes="384px"
              />
            </div>
          </div>

          {/* Right highlights */}
          <div className="flex flex-col gap-10">
            {highlights.slice(2, 4).map((h) => (
              <div key={h.title} className="flex flex-col items-start gap-3">
                <div>{h.icon}</div>
                <div>
                  <h3 className="font-playfair text-lg text-gray-800 mb-1">{h.title}</h3>
                  <p className="font-poppins text-sm text-gray-500 leading-relaxed">{h.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
