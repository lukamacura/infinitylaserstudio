"use client";

import { useState } from "react";
import {
  Smile,
  SmilePlus,
  Hand,
  Footprints,
  CircleDot,
  Sparkles,
  User,
  Shirt,
  PersonStanding,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Service } from "@/lib/database.types";

// ── Icon mapping (matches BookingModal) ───────────────────────────────────────
function getIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("nausnice") && n.includes("brada")) return SmilePlus;
  if (n.includes("nausnice")) return Smile;
  if (n.includes("lice") || n.includes("lica") || n.includes("brada")) return Smile;
  if (n.includes("intimna") || n.includes("intima")) return Sparkles;
  if (n.includes("pazuh") || n.includes("ruke")) return Hand;
  if (n.includes("linija") || n.includes("stomak")) return CircleDot;
  if (n.includes("noge")) return Footprints;
  if (n.includes("telo")) return PersonStanding;
  if (n.includes("grudi")) return Shirt;
  if (n.includes("leđ") || n.includes("ledj")) return User;
  return CircleDot;
}

// ── Description map ───────────────────────────────────────────────────────────
const DESCRIPTIONS: Record<string, string> = {
  // Žene
  "nausnice":           "Precizno uklanjanje dlačica u predelu ušnih resica.",
  "brada":              "Glatka koža bez neželjenih dlačica na bradi.",
  "nausnice i brada":   "Kombinovani tretman za usnice i bradu po povoljnijoj ceni.",
  "celo lice":          "Kompletan tretman lica za savršeno glatku kožu.",
  "pazuh":              "Trajno rešenje za predeo pazuha bez iritacije.",
  "ruke":               "Uklanjanje dlačica na celim rukama od zapešća do ramena.",
  "1/2 ruku":           "Tretman od zapešća do lakta ili od lakta do ramena.",
  "noge":               "Potpuno uklanjanje dlačica na celim nogama.",
  "1/2 nogu":           "Tretman potkolenica ili natkoljenica.",
  "intima":             "Diskretni i pažljivi tretman intimne zone.",
  "noge + intima":      "Kombinovani tretman nogu i intimne zone.",
  "celo telo":          "Sveobuhvatan tretman celog tela jednom posetom.",
  // Muškarci
  "1/2 lica":           "Tretman dela lica — brada, obrazi ili gornja usna.",
  "lice":               "Kompletan tretman lica za urednu i glatku kožu.",
  "grudi":              "Glatke grudi bez potrebe za brijanjem.",
  "stomak":             "Čist i uredan stomak bez dlačica.",
  "stomak + grudi":     "Kombinovani tretman stomaka i grudi.",
  "1/2 leđa":           "Tretman gornje ili donje polovine leđa.",
  "leđa":               "Kompletno uklanjanje dlačica na leđima.",
};

function getDescription(name: string): string {
  const key = name.toLowerCase().trim();
  return DESCRIPTIONS[key] ?? "Profesionalni laserski tretman uklanjanja dlačica.";
}

// ── Combo badge detection ─────────────────────────────────────────────────────
function isCombo(name: string): boolean {
  const n = name.toLowerCase();
  return (
    (n.includes("nausnice") && n.includes("brada")) ||
    n.includes("+ intima") ||
    n.includes("+ grudi") ||
    n.includes("+ leđa") ||
    n.includes("noge + ") ||
    n.includes("stomak + ")
  );
}

// ── Price formatter ───────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  return price.toLocaleString("sr-RS") + " RSD";
}

// ── Card ──────────────────────────────────────────────────────────────────────
interface CardProps {
  service: Service;
  accent: { bg: string; text: string; badge: string };
}

function ServiceCard({ service, accent }: CardProps) {
  const Icon = getIcon(service.name);
  const combo = isCombo(service.name);
  const description = getDescription(service.name);

  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300">
      {combo && (
        <span
          className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 font-poppins text-[10px] font-semibold tracking-widest"
          style={{ background: accent.badge, color: "#171717" }}
        >
          COMBO
        </span>
      )}

      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
        style={{ background: accent.bg }}
      >
        <Icon size={20} strokeWidth={1.6} className="text-gray-700" />
      </div>

      {/* Name + description */}
      <div className="flex-1">
        <p className="font-poppins text-sm font-semibold text-gray-800 mb-1 leading-snug">
          {service.name}
        </p>
        <p className="font-poppins text-xs text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Price + duration */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <span
          className="font-poppins text-base font-bold"
          style={{ color: accent.text }}
        >
          {formatPrice(service.price)}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 font-poppins text-xs text-gray-400">
          ≈ {service.service_duration} min
        </span>
      </div>
    </div>
  );
}

// ── Tab toggle ────────────────────────────────────────────────────────────────
type Tab = "zene" | "muskarci";

interface PricingGridProps {
  zene: Service[];
  muskarci: Service[];
}

const ZENE_ACCENT    = { bg: "rgba(252,202,226,0.35)", text: "#c0306a", badge: "#FCCAE2" };
const MUSKARCI_ACCENT = { bg: "rgba(172,230,228,0.35)", text: "#0a7c78", badge: "#ACE6E4" };

export default function PricingGrid({ zene, muskarci }: PricingGridProps) {
  const [tab, setTab] = useState<Tab>("zene");

  const services = tab === "zene" ? zene : muskarci;
  const accent   = tab === "zene" ? ZENE_ACCENT : MUSKARCI_ACCENT;

  return (
    <div>
      {/* Tab toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 gap-1">
          <button
            onClick={() => setTab("zene")}
            className={`px-6 py-2 rounded-full font-poppins text-sm font-medium transition-all duration-200 cursor-pointer ${
              tab === "zene"
                ? "bg-rose text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Žene
          </button>
          <button
            onClick={() => setTab("muskarci")}
            className={`px-6 py-2 rounded-full font-poppins text-sm font-medium transition-all duration-200 cursor-pointer ${
              tab === "muskarci"
                ? "bg-teal text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Muškarci
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} accent={accent} />
        ))}
      </div>

      {/* Empty state */}
      {services.length === 0 && (
        <p className="text-center font-poppins text-sm text-gray-400 py-16">
          Nema dostupnih usluga.
        </p>
      )}
    </div>
  );
}
