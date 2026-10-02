"use client";

import { MapPin } from "lucide-react";
import { LOCATIONS, type LocationId } from "@/lib/locations";

/**
 * Studio switcher for the admin headers - everything below it shows one studio.
 * Each button carries its own studio's colour (not the active theme's), so the
 * other studio is recognisable before it is even opened.
 */
export default function AdminLocationSwitch({
  value,
  onChange,
}: {
  value: LocationId;
  onChange: (next: LocationId) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1 shrink-0" role="group" aria-label="Lokacija">
      <MapPin size={14} className="hidden sm:block text-accent ml-2 mr-0.5 shrink-0" />
      {LOCATIONS.map((loc) => {
        const active = value === loc.id;
        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => onChange(loc.id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 h-8 md:h-auto px-2.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
              active ? "shadow-sm" : "text-foreground/60 hover:text-foreground/82"
            }`}
            style={active ? { backgroundColor: loc.palette.accent, color: loc.palette.onAccent } : undefined}
          >
            {!active && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: loc.palette.accent }} />
            )}
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
