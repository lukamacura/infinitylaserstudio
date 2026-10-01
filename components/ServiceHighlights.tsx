import type { CSSProperties } from "react";
import Image from "next/image";
import {
  Palette,
  Zap,
  Snowflake,
  LayoutGrid,
  ScanSearch,
  Smartphone,
  Wifi,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const highlights: { title: string; detail: string; icon: LucideIcon }[] = [
  { title: "Android softver", detail: "Lak rad i čuvanje zapisa tretmana", icon: Smartphone },
  { title: "4 talasne dužine", detail: "Za sve tipove kože i dlačica", icon: Palette },
  { title: "Dioda 2400 W", detail: "Brzi i efikasni rezultati", icon: Zap },
  { title: "Do 10 Hz", detail: "Epilacija i zatezanje kože", icon: Activity },
  { title: "Kamera 20x", detail: "Analiza kože i dlake uživo", icon: ScanSearch },
  { title: "Sonda do -15 °C", detail: "Bezbolan i siguran tretman", icon: Snowflake },
  { title: "Više nastavaka", detail: "Za svaku regiju tela", icon: LayoutGrid },
  { title: "Bluetooth i Wi-Fi", detail: "Pametne opcije i komfor", icon: Wifi },
];

function Arrow({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`flex w-5 shrink-0 items-center text-accent sm:w-10 lg:w-16 ${
        side === "right" ? "-scale-x-100" : ""
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span className="tech-line h-px flex-1 bg-accent/60" />
      <svg viewBox="0 0 8 10" className="tech-tip -ml-px h-2.5 w-2 shrink-0" fill="currentColor">
        <path d="M0 0l8 5-8 5z" />
      </svg>
    </span>
  );
}

function Callouts({ items, side }: { items: typeof highlights; side: "left" | "right" }) {
  return (
    <ul
      className="flex flex-col justify-around gap-3"
      // Each side slides in from its own edge, toward the machine.
      style={{ "--tech-from": side === "left" ? "-0.875rem" : "0.875rem" } as CSSProperties}
    >
      {items.map((h, i) => {
        const Icon = h.icon;
        return (
          <li
            key={h.title}
            style={{ "--rv-i": i } as CSSProperties}
            className={`tech-callout flex items-center gap-1.5 sm:gap-3 ${
              side === "right" ? "flex-row-reverse" : ""
            }`}
          >
            <div className={`min-w-0 flex-1 ${side === "left" ? "text-right" : "text-left"}`}>
              <p className="font-poppins text-xs font-semibold leading-snug text-foreground sm:text-sm lg:text-base">
                {h.title}
              </p>
              <p className="hidden font-poppins text-xs leading-snug text-foreground/60 sm:block lg:text-sm">
                {h.detail}
              </p>
            </div>
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent md:flex">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <Arrow side={side} />
          </li>
        );
      })}
    </ul>
  );
}

export default function ServiceHighlights() {
  return (
    <section id="tech" className="scroll-mt-24 section-y px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div data-rv className="text-center mb-4">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/60 mb-4">
            <span className="w-6 h-px bg-accent inline-block" />
            Tehnologija
            <span className="w-6 h-px bg-accent inline-block" />
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-foreground">
            Tehnologija iza epilacije.
          </h2>
        </div>
        <p data-rv style={{ "--rv-i": 1 } as CSSProperties} className="text-center font-poppins text-foreground/60 text-sm section-head max-w-xl mx-auto leading-relaxed">
          Bez brijača, bez crvenila, bez jutarnjeg rituala koji niko nije tražio. Više od 2.000 klijentkinja već zna kako izgleda sloboda.
        </p>

        {/* Callouts with arrows | image | callouts with arrows.
            One trigger for the whole figure (`.tech-*` in globals.css), held
            back until a good part of the machine is on screen. */}
        <div
          data-rv="group"
          data-rv-ratio="0.35"
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5 sm:gap-3"
        >
          <Callouts items={highlights.slice(0, 4)} side="left" />

          {/* Center image */}
          <div className="relative aspect-213/474 h-60 self-center sm:h-80 md:h-112">
            <div className="tech-glow absolute -inset-x-8 inset-y-10 rounded-full bg-accent blur-2xl md:inset-y-16" />
            <Image
              src="/services/laser.webp"
              alt="ATON Magnum laser uređaj"
              fill
              className="tech-machine object-contain z-10"
              sizes="(max-width: 768px) 144px, 202px"
            />
          </div>

          <Callouts items={highlights.slice(4, 8)} side="right" />
        </div>
      </div>
    </section>
  );
}
