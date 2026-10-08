import type { CSSProperties } from "react";
import Image from "next/image";
import { CircleCheck, Crosshair } from "lucide-react";

// Ordered shallow → deep, so the left side covers the finer hair and the
// right side the coarser, deeper-rooted hair. Each wavelength goes by the
// name of the laser it comes from.
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

// Two branches split from one node beside the machine and reach out to the
// centres of the two entries (25% and 75% of the column). Drawn for the left
// side; the right side mirrors it.
function Branches({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={`relative hidden w-14 shrink-0 md:block lg:w-20 ${side === "right" ? "-scale-x-100" : ""}`}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {["M100 50 C55 50 55 25 20 25 H0", "M100 50 C55 50 55 75 20 75 H0"].map((d) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            className="tech-branch"
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.55"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span className="tech-node absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_var(--accent)]" />
      {["top-1/4", "top-3/4"].map((top) => (
        <span
          key={top}
          className={`tech-tip absolute left-0 ${top} h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent bg-background`}
        />
      ))}
    </div>
  );
}

function Wavelengths({ items, side }: { items: typeof wavelengths; side: "left" | "right" }) {
  return (
    // The branches stop short of the text: each side is two equal rows with
    // the entry centred in its row, so a branch tip (at 25% / 75%) lines up
    // with the middle of its entry across the gap.
    <div className={`flex min-w-0 md:gap-6 lg:gap-10 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <ul
        className="grid min-w-0 flex-1 grid-rows-2 items-center gap-8 md:gap-0"
        // Each side slides in from its own edge, toward the machine.
        style={{ "--tech-from": side === "left" ? "-0.875rem" : "0.875rem" } as CSSProperties}
      >
        {items.map((w, i) => (
          <li
            key={w.nm}
            style={{ "--rv-i": i } as CSSProperties}
            className={`tech-callout md:py-6 ${side === "left" ? "md:text-right" : ""}`}
          >
            <p className="font-poppins text-eyebrow uppercase tracking-[0.25em] text-accent/70 sm:text-xs">
              {w.nm} nm
            </p>
            <p className="metal-text mt-1 font-playfair text-2xl leading-tight sm:text-3xl lg:text-4xl">
              {w.name}
            </p>
            <span
              className={`my-3 block h-px w-10 bg-linear-to-r from-accent/60 to-transparent sm:w-12 ${
                side === "left" ? "md:ml-auto md:from-transparent md:to-accent/60" : ""
              }`}
            />
            {/* Problem → solution: the crosshair is the laser locking onto that
                hair, the check is the zone it clears. */}
            <div className="space-y-1.5 font-poppins text-meta leading-snug sm:text-sm">
              {[
                { label: "Za", value: w.za, Icon: Crosshair, tone: "text-accent" },
                { label: "Gde", value: w.gde, Icon: CircleCheck, tone: "text-emerald-300/80" },
              ].map(({ label, value, Icon, tone }) => (
                <div key={label} className={`flex items-start gap-1.5 ${side === "left" ? "md:justify-end" : ""}`}>
                  <Icon className={`mt-px h-3.5 w-3.5 shrink-0 sm:mt-0.5 ${tone}`} strokeWidth={2} aria-hidden />
                  <p>
                    <span className="font-medium text-foreground/50">{label}:</span>{" "}
                    <span className="text-foreground">{value}</span>
                  </p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Branches side={side} />
    </div>
  );
}

export default function ServiceHighlights() {
  return (
    <section id="tech" className="scroll-mt-24 section-y px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div data-rv className="text-center section-head">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
            <span className="w-6 h-px bg-accent inline-block" />
            Tehnologija
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
          <h2 className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15]">
            Tip dlake je apsolutno <b>nebitan</b>.
          </h2>
        </div>

        {/* Wavelengths | image | wavelengths. On phones the machine sits on
            top and the four wavelengths fall into a 2×2 grid below it.
            One trigger for the whole figure (`.tech-*` in globals.css), held
            back until a good part of the machine is on screen. */}
        <div
          data-rv="group"
          data-rv-ratio="0.35"
          className="grid grid-cols-2 items-stretch gap-x-5 gap-y-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-2 md:gap-y-0"
        >
          <Wavelengths items={wavelengths.slice(0, 2)} side="left" />

          {/* Center image */}
          <div className="relative col-span-2 order-first aspect-213/474 h-72 self-center justify-self-center sm:h-80 md:order-none md:col-span-1 md:h-120">
            <div className="tech-glow absolute -inset-x-8 inset-y-10 rounded-full bg-accent blur-2xl md:inset-y-16" />
            <Image
              src="/services/laser.webp"
              alt="ATON Magnum laser uređaj"
              fill
              className="tech-machine object-contain z-10"
              sizes="(max-width: 768px) 144px, 216px"
            />
          </div>

          <Wavelengths items={wavelengths.slice(2, 4)} side="right" />
        </div>
      </div>
    </section>
  );
}
