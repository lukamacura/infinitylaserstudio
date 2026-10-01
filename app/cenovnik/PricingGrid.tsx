"use client";

import { createElement, useState } from "react";
import Image from "next/image";
import { LOCATIONS, DEFAULT_LOCATION, type LocationId } from "@/lib/locations";
import { getIcon } from "@/components/booking/shared";

type Tab = "zene" | "muskarci";

/** A treatment with today's price in each studio that offers it. */
export interface PricedService {
  id: string;
  name: string;
  gender: string;
  prices: Partial<Record<LocationId, number>>;
}

// Posters available in /public/regije/<gender>/<slug>.webp
const REGION_IMAGES: Record<Tab, Set<string>> = {
  zene: new Set([
    "nausnice", "brada", "celo-lice", "pazuh", "ruke", "pola-ruku",
    "noge", "pola-nogu", "intima", "celo-telo",
  ]),
  muskarci: new Set([
    "pola-lica", "celo-lice", "pazuh", "ruke", "pola-ruku", "grudi",
    "stomak", "pola-ledja", "cela-ledja", "celo-telo",
  ]),
};

const SLUG_ALIASES: Record<string, string> = {
  lice: "celo-lice",
  ledja: "cela-ledja",
};

/** "Noge + Intima" → two posters, "1/2 Leđa" → pola-ledja. Unknown regions are skipped. */
function getRegionImages(name: string, gender: Tab): { label: string; src: string }[] {
  return name
    .split(/\s*\+\s*|\s+i\s+/i)
    .map((part) => {
      const slug = part
        .trim()
        .toLowerCase()
        .replace(/đ/g, "dj")
        .replace(/^1\/2\s*/, "pola-")
        .replace(/\s+/g, "-");
      return { label: part.trim(), slug: SLUG_ALIASES[slug] ?? slug };
    })
    .filter((r) => REGION_IMAGES[gender].has(r.slug))
    .map((r) => ({ label: r.label, src: `/regije/${gender}/${r.slug}.webp` }));
}

function formatPrice(price: number): string {
  return price.toLocaleString("sr-RS") + " RSD";
}

interface CardProps {
  service: PricedService;
  price: number;
  gender: Tab;
  accent: { text: string; badge: string; border: string; on: string };
  eager: boolean;
}

function ServiceCard({ service, price, gender, accent, eager }: CardProps) {
  const regions = getRegionImages(service.name, gender);
  const combo = regions.length > 1;
  // No poster for this region yet - its icon stands in.
  const noPoster = regions.length === 0;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
      style={{ border: `1px solid ${accent.border}` }}
    >
      {/* The posters carry a baked-in title along the bottom — a 4/3 frame
          anchored to the top crops it out; combo halves are scaled instead. */}
      <div
        className={`relative aspect-[4/3] bg-black ${combo ? "grid grid-cols-2" : ""}`}
      >
        {noPoster && (
          <div className="flex h-full items-center justify-center bg-surface-raised">
            {createElement(getIcon(service.name), {
              className: "h-12 w-12 opacity-70",
              style: { color: accent.text },
              strokeWidth: 1.4,
              "aria-hidden": true,
            })}
          </div>
        )}
        {regions.map((r, i) => (
          <div
            key={r.src}
            className={`relative overflow-hidden ${combo ? "" : "h-full"} ${
              i > 0 ? "border-l border-white/15" : ""
            }`}
          >
            <Image
              src={r.src}
              alt={`Laserska epilacija - ${r.label}`}
              fill
              quality={70}
              loading={eager ? "eager" : "lazy"}
              sizes={
                combo
                  ? "(max-width: 1024px) 40vw, 300px"
                  : "(max-width: 1024px) 50vw, 380px"
              }
              className={`object-cover object-top ${combo ? "origin-top scale-[1.3]" : ""}`}
            />
          </div>
        ))}

        {combo && (
          <span
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 rounded-full px-2.5 py-0.5 font-poppins text-[10px] font-semibold tracking-widest"
            style={{ background: accent.badge, color: accent.on }}
          >
            COMBO
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="flex-1 font-poppins text-sm font-semibold text-foreground leading-snug">
          {service.name}
        </h3>
        <span
          className="font-poppins text-base font-bold"
          style={{ color: accent.text }}
        >
          {formatPrice(price)}
        </span>
      </div>
    </div>
  );
}

interface PricingGridProps {
  zene: PricedService[];
  muskarci: PricedService[];
}

// Same accents as the booking modal: rose gold for women, antique gold for men.
const ZENE_ACCENT = {
  text: "#DCA8A6",
  badge: "#DCA8A6",
  border: "rgba(220,168,166,0.22)",
  on: "#1E1017",
};
const MUSKARCI_ACCENT = {
  text: "#D4AF67",
  badge: "#D4AF67",
  border: "rgba(212,175,103,0.22)",
  on: "#0B0B0C",
};

export default function PricingGrid({ zene, muskarci }: PricingGridProps) {
  const [tab, setTab] = useState<Tab>("zene");
  const [studio, setStudio] = useState<LocationId>(DEFAULT_LOCATION);

  return (
    <div>
      {/* Studio toggle - every studio has its own prices */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <p className="font-poppins text-xs uppercase tracking-widest text-foreground/50">Studio</p>
        <div className="inline-flex rounded-full border border-foreground/12 bg-foreground/6 p-1 gap-1">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              onClick={() => setStudio(l.id)}
              aria-pressed={studio === l.id}
              className={`px-6 py-2 rounded-full font-poppins text-sm font-medium transition-all duration-200 cursor-pointer ${
                studio === l.id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground/60 hover:text-foreground/85"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex rounded-full border border-foreground/12 bg-foreground/6 p-1 gap-1">
          <button
            onClick={() => setTab("zene")}
            aria-pressed={tab === "zene"}
            className={`px-8 py-2.5 rounded-full font-poppins text-sm font-medium transition-all duration-200 cursor-pointer ${
              tab === "zene"
                ? "bg-[#DCA8A6] text-[#1E1017] shadow-sm"
                : "text-foreground/60 hover:text-foreground/85"
            }`}
          >
            Žene
          </button>
          <button
            onClick={() => setTab("muskarci")}
            aria-pressed={tab === "muskarci"}
            className={`px-8 py-2.5 rounded-full font-poppins text-sm font-medium transition-all duration-200 cursor-pointer ${
              tab === "muskarci"
                ? "bg-[#D4AF67] text-[#0B0B0C] shadow-sm"
                : "text-foreground/60 hover:text-foreground/85"
            }`}
          >
            Muškarci
          </button>
        </div>
      </div>

      {/* Every list is in the page, so Google reads all prices - the ones
          that are not chosen are only hidden. */}
      {([
        { key: "zene", services: zene, accent: ZENE_ACCENT },
        { key: "muskarci", services: muskarci, accent: MUSKARCI_ACCENT },
      ] as const).flatMap((group) => LOCATIONS.map((l) => {
        const offered = group.services.filter((s) => s.prices[l.id] != null);
        return (
        <div key={`${l.id}-${group.key}`} hidden={tab !== group.key || studio !== l.id}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {offered.map((service, i) => (
              <ServiceCard
                key={service.id}
                service={service}
                price={service.prices[l.id]!}
                gender={group.key}
                accent={group.accent}
                eager={group.key === "zene" && l.id === DEFAULT_LOCATION && i < 3}
              />
            ))}
          </div>

          {offered.length === 0 && (
            <p className="text-center font-poppins text-sm text-foreground/50 py-16">
              Nema dostupnih usluga.
            </p>
          )}
        </div>
        );
      }))}
    </div>
  );
}
