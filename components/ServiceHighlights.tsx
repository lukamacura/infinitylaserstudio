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

const highlights: { text: string; icon: LucideIcon }[] = [
  { text: "4 talasne dužine (755, 808, 940, 1064 nm), za sve tipove kože i dlačica", icon: Palette },
  { text: "Dioda snage 2400 W, maksimalna efikasnost i brzi rezultati", icon: Zap },
  { text: "Superhladna sonda do -15 °C, bezbolan i siguran tretman", icon: Snowflake },
  { text: "Više nastavaka za svaku regiju tela, od manje pristupačnih do velikih površina", icon: LayoutGrid },
  { text: "Kamera sa 20x uvećanjem, analiza kože i dlake u realnom vremenu", icon: ScanSearch },
  { text: "Android softver nove generacije, lak rad, čuvanje slika i video zapisa tretmana", icon: Smartphone },
  { text: "Bluetooth i Wi-Fi, pametne opcije i dodatni komfor za operatera i klijenta", icon: Wifi },
  { text: "Do 10 Hz frekvencija, epilacija, podmlađivanje i zatezanje kože", icon: Activity },
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
          Bez brijača, bez crvenila, bez jutarnjeg rituala koji niko nije tražio. Više od 1.700 klijentkinja već zna kako izgleda sloboda.
        </p>

        {/* Three-column layout: 4 highlights | image | 4 highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 items-center">
          {/* Left highlights */}
          <div className="flex flex-col gap-4">
            {highlights.slice(0, 4).map((h, i) => {
              const Icon = h.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl bg-gray-50/90 border border-gray-100 px-4 py-3.5 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="font-poppins text-sm text-gray-600 leading-relaxed flex-1 text-left md:text-right">{h.text}</p>
                </div>
              );
            })}
          </div>

          {/* Center image */}
          <div className="flex justify-center order-first md:order-0">
            <div className="relative w-[20rem] h-96 md:w-md md:h-136">
              <div className="absolute inset-12 md:inset-20 rounded-full bg-pink opacity-50" />
              <Image
                src="/ATON-magnum.png"
                alt="ATON Magnum laser uređaj"
                fill
                className="object-contain z-10"
                sizes="(max-width: 768px) 320px, 448px"
              />
            </div>
          </div>

          {/* Right highlights */}
          <div className="flex flex-col gap-4">
            {highlights.slice(4, 8).map((h, i) => {
              const Icon = h.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl bg-gray-50/90 border border-gray-100 px-4 py-3.5 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="font-poppins text-sm text-gray-600 leading-relaxed flex-1">{h.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
