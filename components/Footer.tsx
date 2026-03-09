"use client";

import { motion } from "framer-motion";

const navLinks = [
  { label: "Naša priča", href: "/#o-nama" },
  { label: "Usluge",     href: "/#usluge" },
  { label: "Cenovnik",   href: "/cenovnik" },
  { label: "Tehnologija", href: "/#tech" },
];

interface Props { onOpen: () => void; }

export default function Footer({ onOpen }: Props) {
  return (
    <footer id="kontakt" className="bg-white border-t border-gray-100 py-14 px-6">
      <motion.div
        className="max-w-6xl mx-auto flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Logo + tagline */}
        <div className="text-center">
          <p className="font-playfair text-2xl text-gray-800 mb-1">Infinity Laser Studio</p>
          <p className="font-poppins text-sm text-gray-500 italic">
            Prihvati slobodu glatke kože. Zauvek.
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-wrap justify-center gap-6">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-poppins text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={onOpen}
            className="font-poppins text-sm text-gray-500 hover:text-gray-800 transition-colors"
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
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-pink transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </a>
          {/* Instagram */}
          <a
            href="https://www.instagram.com/infinitystudio021/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-pink transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          {/* Facebook */}
          <a
            href="#"
            aria-label="Facebook"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-pink transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="currentColor">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          {/* TikTok */}
          <a
            href="#"
            aria-label="TikTok"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-pink transition-colors flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34v-7a8.16 8.16 0 0 0 4.78 1.52V6.41a4.85 4.85 0 0 1-1.01-.28z" />
            </svg>
          </a>
        </div>

        {/* Bottom line */}
        <div className="w-full border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-poppins text-xs text-gray-400">
            © {new Date().getFullYear()} Infinity Laser Studio. Sva prava zadržana.
          </p>
          <p className="font-poppins text-xs text-gray-400">
            Designed and developed by{" "}
            <a href="https://www.instagram.com/macura.fullstack" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Luka Macura</a>
            {" & "}
            <a href="https://www.instagram.com/_kasapb" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Branka Kasap</a>
          </p>
          <p className="font-poppins text-xs text-gray-400">
            Politika privatnosti · Uslovi korišćenja
          </p>
        </div>
      </motion.div>
    </footer>
  );
}
