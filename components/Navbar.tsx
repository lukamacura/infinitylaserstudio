"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isAdminPath } from "@/lib/adminRoutes";

const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

const navLinks = [
  { label: "Naša priča",   href: "/#o-nama"   },
  { label: "Cenovnik", href: "/cenovnik" },
  { label: "Tehnologija",  href: "/#tech"  },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingMounted, setBookingMounted] = useState(false);
  if (bookingOpen && !bookingMounted) setBookingMounted(true);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onBreakpoint = () => mq.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onBreakpoint);
    };
  }, [menuOpen]);

  // The admin pages bring their own header.
  if (isAdminPath(pathname)) return null;

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className="relative z-10 border-b border-accent/10 md:backdrop-blur-xl bg-background/95 md:bg-background/85"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-3">
          {/* No prefetch of the page you are already on (it would re-download the home page). */}
          <Link href="/" prefetch={pathname === "/" ? false : undefined} aria-label="Infinity Laser Studio" className="flex items-center gap-3">
            <Image
              src="/brand/logo.webp"
              alt="Infinity Laser Studio"
              width={40}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
            <span className="hidden sm:flex flex-col leading-none text-accent">
              <span className="font-playfair text-xl tracking-[0.18em] -mr-[0.18em]">INFINITY</span>
              <span aria-hidden className="flex justify-between mt-1.5 font-poppins text-[8px] text-accent/70">
                {"LASER STUDIO".split("").map((ch, i) => (
                  <span key={i}>{ch}</span>
                ))}
              </span>
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                {link.label === "Cenovnik" ? (
                  <Link
                    href={link.href}
                    className="text-sm font-poppins text-accent/85 hover:text-accent-soft transition-colors duration-500"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    className="text-sm font-poppins text-accent/85 hover:text-accent-soft transition-colors duration-500"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 text-accent/85">
            <a
              href="tel:+381653738991"
              aria-label="Pozovi"
              className="p-2 hover:text-accent-soft transition-colors duration-500"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="7" y="2" width="10" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="18.5" r="1" fill="currentColor" />
                <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
            <a
              href="tel:+381677747301"
              aria-label="Pozovi"
              className="p-2 hover:text-accent-soft transition-colors duration-500"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="7" y="2" width="10" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="18.5" r="1" fill="currentColor" />
                <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
            <a
              href="mailto:ana.infinitystudio@gmail.com"
              aria-label="Email"
              className="p-2 hover:text-accent-soft transition-colors duration-500"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 7l10 7 10-7" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/infinitylaserstudio/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="p-2 hover:text-accent-soft transition-colors duration-500"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>

            <button
              aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 hover:text-accent-soft transition-colors duration-500 cursor-pointer"
            >
              <span className="relative block w-5 h-5">
                <span
                  className={`absolute left-0 top-1/2 h-[1.8px] w-5 -mt-px rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    menuOpen ? "rotate-45" : "-translate-y-1.5"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 h-[1.8px] w-5 -mt-px rounded-full bg-current transition-opacity duration-300 ${
                    menuOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 h-[1.8px] w-5 -mt-px rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    menuOpen ? "-rotate-45" : "translate-y-1.5"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        aria-hidden={!menuOpen}
        className={`md:hidden fixed inset-x-0 top-0 z-0 h-dvh w-full overflow-y-auto bg-background transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <ul className="min-h-full flex flex-col items-center justify-center gap-2 px-6 pt-24 pb-16">
          {navLinks.map((link, i) => {
            const className = `block py-3 font-playfair text-3xl tracking-wide text-accent/90 hover:text-accent-soft transition-colors duration-500`;
            return (
              <li
                key={link.label}
                style={{ transitionDelay: menuOpen ? `${120 + i * 70}ms` : "0ms" }}
                className={`transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  menuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {link.label === "Cenovnik" ? (
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    tabIndex={menuOpen ? 0 : -1}
                    className={className}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    tabIndex={menuOpen ? 0 : -1}
                    className={className}
                  >
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
          <li
            style={{ transitionDelay: menuOpen ? `${120 + navLinks.length * 70}ms` : "0ms" }}
            className={`mt-6 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              menuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                setBookingOpen(true);
              }}
              tabIndex={menuOpen ? 0 : -1}
              aria-label="Zakaži tretman"
              className="cursor-pointer rounded-full bg-accent px-12 py-3.5 font-playfair text-2xl tracking-wide text-background transition-[background-color,scale] duration-500 hover:bg-accent-soft active:scale-97"
            >
              Zakaži
            </button>
          </li>
        </ul>
      </div>
    </nav>

    {bookingMounted && <BookingModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} source="navbar" />}
    </>
  );
}
