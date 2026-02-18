"use client";

import { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  Smile,
  SmilePlus,
  Frown,
  Hand,
  Footprints,
  CircleDot,
  Sparkles,
  User,
  Shirt,
  ArrowLeft,
  Clock,
  PersonStanding,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceItem {
  id: string;
  name: string;
  duration: number;
  pause: number;
  total: number;
  icon: LucideIcon;
}

const zenski: ServiceItem[] = [
  { id: "z-nausnice", name: "Nausnice", duration: 5, pause: 5, total: 10, icon: Smile },
  { id: "z-nausnice-brada", name: "Nausnice i brada", duration: 5, pause: 5, total: 10, icon: SmilePlus },
  { id: "z-celo-lice", name: "Celo lice", duration: 5, pause: 5, total: 10, icon: Frown },
  { id: "z-pazuh", name: "Pazuh", duration: 5, pause: 5, total: 10, icon: Hand },
  { id: "z-ruke", name: "Ruke", duration: 10, pause: 10, total: 20, icon: Hand },
  { id: "z-linija-stomaka", name: "Linija stomaka", duration: 5, pause: 5, total: 10, icon: CircleDot },
  { id: "z-stomak", name: "Stomak", duration: 5, pause: 5, total: 10, icon: CircleDot },
  { id: "z-intimna", name: "Intimna regija", duration: 10, pause: 10, total: 20, icon: Sparkles },
  { id: "z-noge", name: "Noge", duration: 15, pause: 15, total: 30, icon: Footprints },
  { id: "z-celo-telo", name: "Celo telo", duration: 40, pause: 10, total: 50, icon: PersonStanding },
];

const muski: ServiceItem[] = [
  { id: "m-grudi", name: "Grudi", duration: 10, pause: 10, total: 20, icon: Shirt },
  { id: "m-stomak", name: "Stomak", duration: 5, pause: 5, total: 10, icon: CircleDot },
  { id: "m-pola-ledja", name: "1/2 leđa", duration: 5, pause: 5, total: 10, icon: User },
  { id: "m-cela-ledja", name: "Cela leđa", duration: 10, pause: 10, total: 20, icon: User },
  { id: "m-lice", name: "Lice", duration: 5, pause: 5, total: 10, icon: Smile },
  { id: "m-pola-lica", name: "1/2 lica", duration: 5, pause: 5, total: 10, icon: SmilePlus },
  { id: "m-ruke", name: "Ruke", duration: 10, pause: 10, total: 20, icon: Hand },
  { id: "m-noge", name: "Noge", duration: 15, pause: 15, total: 30, icon: Footprints },
  { id: "m-celo-telo", name: "Celo telo", duration: 45, pause: 15, total: 60, icon: PersonStanding },
];

type Gender = "zene" | "muskarci";

export default function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = "hidden";
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAnimating(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleClose() {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
      setGender(null);
      setSelected([]);
    }, 300);
  }

  function handleBack() {
    setGender(null);
    setSelected([]);
  }

  function toggleService(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const services = gender === "muskarci" ? muski : zenski;
  const selectedServices = services.filter((s) => selected.includes(s.id));
  const totalTime =
    selectedServices.length === 1
      ? selectedServices[0].duration
      : selectedServices.reduce((sum, s) => sum + s.total, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {gender && (
              <button
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
                aria-label="Nazad"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-2xl font-bold font-playfair">Zakaži tretman</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors cursor-pointer"
            aria-label="Zatvori"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pb-4 shrink-0">
          <p className="text-xs text-foreground/50 tracking-[3px] font-semibold font-poppins">
            {gender ? "KORAK 2 OD 3" : "KORAK 1 OD 3"}
          </p>
          <p className="text-sm text-foreground/60 font-poppins mt-1">
            {gender ? "Odaberi regije za tretman" : "Za koga zakazuješ?"}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {!gender ? (
            /* Gender selection */
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setGender("zene")}
                className="group flex items-center gap-4 w-full p-5 rounded-2xl border-2 border-foreground/10 hover:border-pink transition-colors text-left cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-pink/15 flex items-center justify-center shrink-0 group-hover:bg-pink/25 transition-colors">
                  <Sparkles size={28} className="text-[#E85D8A]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold font-poppins">Ženske usluge</p>
                  <p className="text-sm text-foreground/50 font-poppins mt-0.5">10 regija dostupno</p>
                </div>
                <ChevronRight size={20} className="text-foreground/30 group-hover:text-pink transition-colors" />
              </button>

              <button
                onClick={() => setGender("muskarci")}
                className="group flex items-center gap-4 w-full p-5 rounded-2xl border-2 border-foreground/10 hover:border-teal transition-colors text-left cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-teal/15 flex items-center justify-center shrink-0 group-hover:bg-teal/25 transition-colors">
                  <User size={28} className="text-[#0D9488]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold font-poppins">Muške usluge</p>
                  <p className="text-sm text-foreground/50 font-poppins mt-0.5">9 regija dostupno</p>
                </div>
                <ChevronRight size={20} className="text-foreground/30 group-hover:text-teal transition-colors" />
              </button>
            </div>
          ) : (
            /* Service selection */
            <div className="flex flex-col gap-2">
              {services.map((service) => {
                const isSelected = selected.includes(service.id);
                const Icon = service.icon;
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`group flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                      isSelected
                        ? gender === "zene"
                          ? "border-pink bg-pink/8"
                          : "border-teal bg-teal/8"
                        : "border-foreground/8 hover:border-foreground/20"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? gender === "zene"
                            ? "bg-pink/25"
                            : "bg-teal/25"
                          : "bg-foreground/5"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={
                          isSelected
                            ? gender === "zene"
                              ? "text-[#E85D8A]"
                              : "text-[#0D9488]"
                            : "text-foreground/40"
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-poppins">{service.name}</p>
                      <span className="flex items-center gap-1 text-xs text-foreground/40 font-poppins mt-0.5">
                        <Clock size={11} />
                        {service.duration} min
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? gender === "zene"
                              ? "border-pink bg-pink"
                              : "border-teal bg-teal"
                            : "border-foreground/20"
                        }`}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with total & continue */}
        {gender && selected.length > 0 && (
          <div className="px-6 py-4 border-t border-foreground/10 shrink-0 flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground/50 font-poppins">Ukupno trajanje (pauze su uključene)</p>
              <p className="text-lg font-bold font-poppins">{totalTime} min</p>
            </div>
            <button
              className={`px-6 py-3 rounded-full text-xs font-semibold tracking-widest font-poppins transition-colors cursor-pointer ${
                gender === "zene"
                  ? "bg-pink text-white hover:bg-[#D14A78]"
                  : "bg-teal hover:bg-[#7DD3D0]"
              }`}
            >
              NASTAVI
            </button>
          </div>
        )}

        {/* Bottom accent */}
        <div className="h-1 bg-linear-to-r from-teal via-pink to-rose shrink-0" />
      </div>
    </div>
  );
}
