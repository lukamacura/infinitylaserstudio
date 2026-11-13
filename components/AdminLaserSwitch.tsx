"use client";

import { Zap } from "lucide-react";
import { laserLabel, type Laser } from "@/lib/lasers";

/**
 * Laser switcher for the admin calendar of a studio with more than one laser
 * (Novi Sad: Stari | Novi). Works like the studio switch next to it: the
 * calendar below shows one laser's appointments at a time.
 */
export default function AdminLaserSwitch({
  lasers,
  value,
  onChange,
}: {
  lasers: Laser[];
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1 shrink-0" role="group" aria-label="Laser">
      <Zap size={14} className="hidden sm:block text-accent ml-2 mr-0.5 shrink-0" />
      {lasers.map((l) => {
        const active = value === l.laser;
        return (
          <button
            key={l.laser}
            type="button"
            onClick={() => onChange(l.laser)}
            aria-pressed={active}
            title={laserLabel(l)}
            className={`h-8 md:h-auto px-2.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold font-poppins uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
              active ? "bg-accent text-on-accent shadow-sm" : "text-foreground/60 hover:text-foreground/82"
            }`}
          >
            {l.name}
          </button>
        );
      })}
    </div>
  );
}
