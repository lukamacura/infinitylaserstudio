"use client";

import Reveal from "@/components/Reveal";
import { LOCATIONS, fullAddress } from "@/lib/locations";
import { useOpenBooking } from "@/components/OpenBooking";

const navLinks = [
  { label: "Naša priča", href: "/#o-nama" },
  { label: "Cenovnik",   href: "/cenovnik" },
  { label: "Tehnologija", href: "/#tech" },
];

/** Without `onOpen` (the home page) it opens HomeClient's booking form. */
interface Props { onOpen?: () => void; }

export default function Footer({ onOpen }: Props) {
  const openBooking = useOpenBooking();
  return (
    <footer id="kontakt" className="bg-background border-t border-foreground/8 pt-10 md:pt-14 pb-24 px-6">
      <Reveal className="max-w-6xl mx-auto flex flex-col items-center gap-8">
        {/* Logo + tagline */}
        <div className="text-center">
          <p className="font-playfair text-2xl text-foreground mb-1">Infinity Laser Studio</p>
          <p className="font-poppins text-sm text-foreground/60 italic">
            Prihvati slobodu glatke kože. Zauvek.
          </p>
          {LOCATIONS.map((loc) => (
            <p key={loc.id} className="font-poppins text-sm text-foreground/60 italic">
              {fullAddress(loc)}
            </p>
          ))}
        </div>

        {/* Nav */}
        <nav className="flex flex-wrap justify-center gap-6">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-poppins text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={() => (onOpen ? onOpen() : openBooking("footer"))}
            className="font-poppins text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            Zakaži
          </button>
        </nav>

        {/* Social icons */}
        <div className="flex gap-5">
          {/* Email */}
          <a
            href="mailto:ana.infinitystudio@gmail.com"
            aria-label="Email"
            className="w-9 h-9 rounded-full bg-foreground/6 hover:bg-accent hover:text-on-accent text-foreground/70 transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </a>
          {/* Instagram */}
          <a
            href="https://www.instagram.com/infinitylaserstudio/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-9 h-9 rounded-full bg-foreground/6 hover:bg-accent hover:text-on-accent text-foreground/70 transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          {/* Phone */}
          <a
            href="tel:+381653738991"
            aria-label="Pozovi"
            className="w-9 h-9 rounded-full bg-foreground/6 hover:bg-accent hover:text-on-accent text-foreground/70 transition-colors flex items-center justify-center"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => (window as any).fbq?.("track", "Contact")}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="7" y="2" width="10" height="20" rx="3" />
              <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
              <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" strokeLinecap="round" />
            </svg>
          </a>
          {/* Phone 2 */}
          <a
            href="tel:+381677747301"
            aria-label="Pozovi"
            className="w-9 h-9 rounded-full bg-foreground/6 hover:bg-accent hover:text-on-accent text-foreground/70 transition-colors flex items-center justify-center"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => (window as any).fbq?.("track", "Contact")}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="7" y="2" width="10" height="20" rx="3" />
              <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
              <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" strokeLinecap="round" />
            </svg>
          </a>
        </div>

        {/* Bottom line */}
        <div className="w-full border-t border-foreground/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-poppins text-xs text-foreground/50">
            © {new Date().getFullYear()} Infinity Laser Studio. Sva prava zadržana.
          </p>
          <p className="font-poppins text-xs text-foreground/50">
            Designed and developed by{" "}
            <a href="https://www.instagram.com/luka_macura" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-foreground/70 transition-colors">Luka Macura</a>
            {" & "}
            <a href="https://www.instagram.com/_kasapb" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-foreground/70 transition-colors">Branka Kasap</a>
          </p>
          <p className="font-poppins text-xs text-foreground/50">
            <a href="/uslovi-koriscenja#privatnost" className="underline underline-offset-4 decoration-foreground/25 hover:text-foreground/80 transition-colors">
              Politika privatnosti
            </a>
            {" · "}
            <a href="/uslovi-koriscenja" className="underline underline-offset-4 decoration-foreground/25 hover:text-foreground/80 transition-colors">
              Uslovi korišćenja
            </a>
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
