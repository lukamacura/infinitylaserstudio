"use client";

interface Props { onOpen: () => void; }

export default function CommunitySection({ onOpen }: Props) {
  return (
    <section className="py-24 px-6 bg-pink/30 relative overflow-hidden" id="book">
      {/* Decorative blobs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-teal opacity-20 pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-rose opacity-30 pointer-events-none" />

      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Sparkle */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
            <path d="M20 4v7M20 29v7M4 20h7M29 20h7" stroke="#ACE6E4" strokeWidth="2" strokeLinecap="round" />
            <path d="M8.6 8.6l5 5M26.4 26.4l5 5M8.6 31.4l5-5M26.4 13.6l5-5" stroke="#FCCAE2" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="20" cy="20" r="5" fill="#ACE6E4" opacity="0.7" />
          </svg>
        </div>

        <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 mb-4">
          Gotova si s brijanjem?
        </h2>
        <p className="font-poppins text-gray-600 text-base leading-relaxed mb-3">
          Zakaži svoj prvi tretman i dobijaš konsultaciju, BESPLATNO.
        </p>
        <p className="font-poppins text-gray-500 text-sm leading-relaxed mb-10 max-w-md mx-auto">
          U 15 minuta procene sagledavamo tvoj tip kože, odgovaramo na sva pitanja i pravimo plan tretmana po tvojoj meri. Bez obaveze. Bez žurbe.
        </p>

        <button
          onClick={onOpen}
          className="inline-block px-10 py-4 rounded-full bg-foreground text-background font-poppins text-sm font-semibold tracking-wide hover:bg-teal hover:text-foreground transition-colors"
        >
          Zakaži odmah
        </button>

        <p className="font-poppins text-xs text-gray-400 mt-5">
          Slobodni termini dostupni ove nedelje.
        </p>
      </div>
    </section>
  );
}
