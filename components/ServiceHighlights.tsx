import type { CSSProperties } from "react";
import Image from "next/image";
import { Caveat } from "next/font/google";

// Same handwriting as the landing page's "Računica" sheet (CostComparison).
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

// Ordered shallow → deep, from the finer hair to the coarser, deeper-rooted
// hair. Each wavelength goes by the name of the laser it comes from.
const wavelengths = [
  {
    nm: "755",
    name: "Aleksandrit",
    za: "Svetle dlačice i paperje",
    gde: "Lice, nausnice, vrat",
  },
  {
    nm: "808",
    name: "Dioda",
    za: "Standardne tamne dlačice",
    gde: "Noge i ruke",
  },
  {
    nm: "940",
    name: "Infracrveni",
    za: "Tvrdokorne dlačice",
    gde: "Dlačice koje se stalno vraćaju",
  },
  {
    nm: "1064",
    name: "Nd:YAG",
    za: "Dubok, jak i crn koren",
    gde: "Intimna zona i pazuh",
  },
];

/** Place in the writing order of a notes page (`--w` in globals.css). */
function write(i: number): CSSProperties {
  return { "--w": i } as CSSProperties;
}

export default function ServiceHighlights() {
  return (
    <section id="tech" className="scroll-mt-24 section-y px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div data-rv className="text-center section-head">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-3">
            <span className="w-6 h-px bg-accent inline-block" />
            Tehnologija
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
          <h2 className="font-playfair text-[1.875rem] sm:text-4xl md:text-[2.75rem] text-foreground leading-tight text-balance">
            Tip dlake je apsolutno <b>nebitan</b>.
          </h2>
        </div>

        {/* The machine with its name pencilled in beside it, and the four
            wavelengths written out on a sheet next to it (below it on phones).
            Each half has its own trigger, so on phones the sheet only starts
            writing once it is the thing on screen. */}
        <div className="grid items-center gap-y-12 md:grid-cols-[auto_minmax(0,1fr)] md:gap-x-12 lg:gap-x-16">
          {/* Room on the left for the label */}
          <div className="justify-self-center md:pl-36">
            <div
              data-rv="group"
              data-rv-ratio="0.35"
              className="notes-body relative aspect-213/474 h-64 sm:h-72 md:h-112"
            >
              <div className="tech-glow absolute -inset-x-8 inset-y-10 rounded-full bg-accent blur-2xl md:inset-y-16" />
              <Image
                src="/services/laser.webp"
                alt="ATON Magnum laser uređaj"
                fill
                className="tech-machine object-contain z-10"
                sizes="(max-width: 768px) 130px, 202px"
              />

              {/* "Aton Magnum", with a hand-drawn arrow onto the lettering on
                  the machine's side. */}
              <div
                aria-hidden
                className={`${caveat.variable} hand absolute right-full top-[22%] z-20 w-20 text-accent md:top-[32%] md:w-36`}
              >
                <p
                  className="notes-write -rotate-6 text-2xl font-bold leading-[0.9] md:whitespace-nowrap md:text-[1.75rem]"
                  style={write(2)}
                >
                  Aton <br className="md:hidden" />
                  Magnum
                </p>
                <svg viewBox="0 0 100 80" fill="none" className="mt-1 block w-full overflow-visible">
                  <path
                    className="notes-draw"
                    style={write(3)}
                    pathLength={1}
                    d="M30 4 C12 34 42 68 110 62"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    className="notes-draw"
                    style={write(3.6)}
                    pathLength={1}
                    d="M100 53 L111 62 L99 70"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* The four wavelengths, on a rose sheet so it reads apart from the
              "Računica" page further down. */}
          <div data-rv="zoom" className="w-full max-w-xl justify-self-center md:max-w-none">
            <div className={`notes-paper notes-rose ${caveat.variable} hand px-5 pt-8 pb-6 sm:px-9 md:pt-10 md:pb-8`}>
              <span className="notes-tape" aria-hidden />

              <div data-rv="group" data-rv-ratio="0.35" className="notes-body">
                <p className="notes-write relative inline-block text-2xl md:text-[2rem] font-bold leading-none mb-6 md:mb-7">
                  4 talasne dužine, 1 aparat
                  <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
                    <path d="M2 5 Q40 1 90 4 T198 3" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </p>

                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 lg:gap-y-7">
                  {wavelengths.map((w, i) => (
                    <li key={w.nm} className="notes-write" style={write(1 + i * 2)}>
                      <p className="flex items-baseline gap-2 leading-none">
                        <span className="text-lg md:text-xl font-bold text-(--pen)">{w.nm} nm</span>
                        <span className="text-2xl md:text-[1.75rem] font-bold">{w.name}</span>
                      </p>
                      <p className="mt-1.5 text-lg md:text-[1.3rem] leading-tight">{w.za}</p>
                      <p className="text-lg md:text-[1.3rem] leading-tight opacity-70">↳ {w.gde}</p>
                    </li>
                  ))}
                </ul>

                {/* Red-pen remark */}
                <p
                  className="notes-write mt-5 md:mt-7 -rotate-2 origin-left text-xl md:text-[1.75rem] font-bold leading-none text-(--pen)"
                  style={write(1 + wavelengths.length * 2)}
                >
                  = svaka dlaka dobije svoj laser!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
