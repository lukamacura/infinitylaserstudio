"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, Wallet, BarChart3, Filter, LogOut, ChevronDown, Check } from "lucide-react";
import AdminLocationSwitch from "@/components/AdminLocationSwitch";
import type { LocationId } from "@/lib/locations";

const PAGES = [
  { key: "admin",    href: "/admin",    label: "Admin",      Icon: Calendar  },
  { key: "finances", href: "/finances", label: "Finansije",  Icon: Wallet    },
  { key: "stats",    href: "/stats",    label: "Statistike", Icon: BarChart3 },
  { key: "fnl",      href: "/fnl",      label: "Funnel",     Icon: Filter    },
] as const;

export type AdminPageKey = (typeof PAGES)[number]["key"];

/**
 * Header shared by every admin page. On a phone it is a single row - a page
 * menu and the studio switch - so the screen goes to the content; from `md` up
 * it shows the brand, the page tabs, the studio switch and the page's extras.
 */
export default function AdminHeader({
  current,
  location,
  onLocationChange,
  onLogout,
  children,
}: {
  current: AdminPageKey;
  location: LocationId;
  /** Leave out on pages that are not about a single studio. */
  onLocationChange?: (next: LocationId) => void;
  onLogout: () => void;
  /** Desktop-only extras next to the studio switch (status, legend...). */
  children?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const page = PAGES.find((p) => p.key === current) ?? PAGES[0];

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-surface border-b-2 border-accent/40 shadow-sm pt-[env(safe-area-inset-top)]">
      {/* Phone */}
      <div className="md:hidden relative h-14 px-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="h-10 pl-2.5 pr-2 flex items-center gap-2 rounded-xl bg-foreground/3 active:bg-foreground/8 transition-colors cursor-pointer min-w-0"
        >
          <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <page.Icon size={15} />
          </span>
          <span className="text-sm font-bold font-poppins truncate">{page.label}</span>
          <ChevronDown size={16} className={`shrink-0 text-foreground/50 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {onLocationChange && <AdminLocationSwitch value={location} onChange={onLocationChange} />}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 admin-fade-in" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="absolute left-3 top-[calc(100%+6px)] z-50 w-60 p-1.5 rounded-2xl bg-surface border border-foreground/10 shadow-2xl shadow-black/50 admin-sheet-in"
            >
              {PAGES.map((p) => {
                const active = p.key === current;
                return (
                  <Link
                    key={p.key}
                    href={p.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`h-12 px-3 flex items-center gap-3 rounded-xl text-sm font-bold font-poppins transition-colors ${
                      active ? "bg-accent/12 text-accent" : "text-foreground/80 active:bg-foreground/5"
                    }`}
                  >
                    <p.Icon size={18} className={active ? "" : "text-foreground/50"} />
                    <span className="flex-1">{p.label}</span>
                    {active && <Check size={16} />}
                  </Link>
                );
              })}
              <div className="my-1.5 h-px bg-foreground/8" />
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onLogout(); }}
                className="w-full h-12 px-3 flex items-center gap-3 rounded-xl text-sm font-bold font-poppins text-red-400 active:bg-red-400/10 transition-colors cursor-pointer"
              >
                <LogOut size={18} />
                Odjava
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tablet / desktop */}
      <div className="hidden md:flex items-center justify-between gap-6 px-8 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 min-w-0">
          <div className="hidden lg:block border-r border-foreground/10 pr-6">
            <p className="text-xl font-bold font-playfair tracking-tight leading-tight">Infinity Laser Studio</p>
            <p className="text-[10px] text-foreground/50 font-bold font-poppins uppercase tracking-widest mt-0.5">Control Center</p>
          </div>

          <nav className="flex items-center gap-1 bg-foreground/3 rounded-xl p-1 shrink-0">
            {PAGES.map((p) =>
              p.key === current ? (
                <span key={p.key} aria-current="page" className="px-3 py-1.5 rounded-lg bg-accent/15 text-xs font-bold font-poppins text-accent uppercase tracking-widest">
                  {p.label}
                </span>
              ) : (
                <Link key={p.key} href={p.href} className="px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/50 hover:text-foreground/76 uppercase tracking-widest transition-colors">
                  {p.label}
                </Link>
              ),
            )}
          </nav>

          {onLocationChange && <AdminLocationSwitch value={location} onChange={onLocationChange} />}
          {children}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-foreground/3 text-foreground/60 hover:text-red-400 hover:bg-red-400/10 transition-all font-poppins text-xs font-bold cursor-pointer"
        >
          <LogOut size={16} />
          <span className="uppercase tracking-widest">Odjava</span>
        </button>
      </div>
    </header>
  );
}
