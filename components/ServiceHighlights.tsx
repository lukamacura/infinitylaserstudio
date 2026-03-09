import Image from "next/image";

const highlights = [
  {
    title: "Ugodnije nego što misliš.",
    description: "ATON Magnum hladi kožu - većina klijentkinja kaže da je najgore što su osećale bio strah pre prvog tretmana.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#ACE6E4" opacity="0.3" />
        <path d="M20 8l2 6h6l-5 3.6 1.9 6L20 20l-4.9 3.6 1.9-6L12 14h6L20 8z" fill="#ACE6E4" />
      </svg>
    ),
  },
  {
    title: "Tvoja koža. Naši parametri.",
    description: "Svetla, tamna, osetljiva - laser se podešava za svaki tip kože posebno. Nema šablona. Nema kompromisa.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#C6F5E9" opacity="0.4" />
        <path d="M13 20h14M20 13v14" stroke="#ACE6E4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="5" fill="#ACE6E4" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: "72 sata godišnje. Vraćena tebi.",
    description: "Noge gotove za 15 minuta. Nausnice za 5. Jedan tretman u 6 nedelja - i to je to. Vreme koje si trošila na brijanje, sada troši gde hoćeš.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#FCD6ED" opacity="0.4" />
        <circle cx="20" cy="20" r="8" stroke="#FCCAE2" strokeWidth="2" fill="none" />
        <path d="M20 14v6l4 2" stroke="#FCCAE2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Jednom godišnje. To je sve.",
    description: "Posle serije tretmana, 70–90% dlaka nestaje trajno - a jedino što te čeka je kratka kontrola jednom godišnje. Umesto 52 brijanja, jedan termin.",
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
    <section id="tech" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Tehnologija
            <span className="w-6 h-px bg-teal inline-block" />
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800">
            Koža kakvu si uvek htela.
          </h2>
        </div>
        <p className="text-center font-poppins text-gray-500 text-sm mb-16 max-w-xl mx-auto leading-relaxed">
          Bez brijača, bez crvenila, bez jutarnjeg rituala koji niko nije tražio. Više od 4.000 klijentkinja već zna kako izgleda sloboda.
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
