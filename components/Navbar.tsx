"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const navLinks = [
  { label: "O nama",   href: "#o-nama"   },
  { label: "Usluge",   href: "#usluge"   },
  { label: "Cenovnik", href: "#cenovnik" },
  { label: "Kontakt",  href: "#kontakt"  },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className={`border-b backdrop-blur-xl transition-all duration-500 ${
          scrolled
            ? "bg-black/55 border-white/10"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-3">
          <a href="#" aria-label="Infinity Laser Studio" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Infinity Laser Studio"
              width={140}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
            <span
              className={`hidden sm:block font-playfair text-lg leading-tight tracking-wide transition-colors duration-500 ${
                scrolled ? "text-white/90" : "text-foreground/80"
              }`}
            >
              INFINITY
            </span>
          </a>

          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className={`text-sm font-poppins transition-colors duration-500 ${
                    scrolled
                      ? "text-white/70 hover:text-white"
                      : "text-foreground/65 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div
            className={`flex items-center gap-3 transition-colors duration-500 ${
              scrolled ? "text-white/60" : "text-foreground/55"
            }`}
          >
            <button
              aria-label="Pozovi"
              className={`p-2 transition-colors duration-500 cursor-pointer ${
                scrolled ? "hover:text-white" : "hover:text-foreground"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="7" y="2" width="10" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="18.5" r="1" fill="currentColor" />
                <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              aria-label="Email"
              className={`p-2 transition-colors duration-500 cursor-pointer ${
                scrolled ? "hover:text-white" : "hover:text-foreground"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 7l10 7 10-7" />
              </svg>
            </button>
            <a
              href="https://www.instagram.com/infinitystudio021/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={`p-2 transition-colors duration-500 ${
                scrolled ? "hover:text-white" : "hover:text-foreground"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>

            <button
              aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
              onClick={() => setMenuOpen((v) => !v)}
              className={`md:hidden p-2 transition-colors duration-500 cursor-pointer ${
                scrolled ? "hover:text-white" : "hover:text-foreground"
              }`}
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="4" y1="4" x2="20" y2="20" />
                  <line x1="20" y1="4" x2="4" y2="20" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-b border-white/10 backdrop-blur-xl bg-black/55">
          <ul className="max-w-7xl mx-auto flex flex-col px-6 py-4 gap-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-sm font-poppins text-white/70 hover:text-white transition-colors border-b border-white/10 last:border-0"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
