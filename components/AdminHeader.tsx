"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, NotebookPen, PhoneCall, Wallet, BarChart3, Filter, LogOut } from "lucide-react";
import AdminLocationSwitch from "@/components/AdminLocationSwitch";
import type { LocationId } from "@/lib/locations";
import { fetchUpitiOpenCount } from "@/lib/upiti";

const PAGES = [
  { key: "admin",    href: "/admin",    label: "Admin",      Icon: Calendar  },
  { key: "kartoni",  href: "/kartoni",  label: "Kartoni",    Icon: NotebookPen },
  { key: "upiti",    href: "/upiti",    label: "Upiti",      Icon: PhoneCall },
  { key: "finances", href: "/finances", label: "Finansije",  Icon: Wallet    },
  { key: "stats",    href: "/stats",    label: "Statistike", Icon: BarChart3 },
  { key: "fnl",      href: "/fnl",      label: "Funnel",     Icon: Filter    },
] as const;

export type AdminPageKey = (typeof PAGES)[number]["key"];

/** How many inquiries wait for a call, next to "Upiti" - so nobody is forgotten. */
function CountBadge({ count, strong }: { count: number; strong?: boolean }) {
  return (
    <span
      className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-bold font-poppins leading-none tabular-nums ${
        strong ? "bg-accent text-on-accent" : "bg-accent/20 text-accent"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Header shared by every admin page. On a phone every page is a tab in one
 * row (icon + name, logout at the end) with the studio switch under it; from
 * `md` up it shows the brand, the page tabs, the studio switch and the page's
 * extras.
 */
export default function AdminHeader({
  current,
  location,
  onLocationChange,
  onLogout,
  upitiCount,
  children,
}: {
  current: AdminPageKey;
  location: LocationId;
  /** Leave out on pages that are not about a single studio. */
  onLocationChange?: (next: LocationId) => void;
  onLogout: () => void;
  /** The /upiti page passes its own live count; elsewhere the header asks. */
  upitiCount?: number;
  /** Desktop-only extras next to the studio switch (status, legend...). */
  children?: ReactNode;
}) {
  const [fetchedCount, setFetchedCount] = useState<number | null>(null);
  const waiting = upitiCount ?? fetchedCount ?? 0;

  useEffect(() => {
    if (upitiCount !== undefined) return;
    let active = true;
    fetchUpitiOpenCount()
      .then((n) => { if (active) setFetchedCount(n); })
      .catch(() => { /* no badge, the page still works */ });
    return () => { active = false; };
  }, [upitiCount]);

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-surface border-b-2 border-accent/40 shadow-sm pt-[env(safe-area-inset-top)]">
      {/* Phone: every page in sight, one tap away; the studio switch under them */}
      <div className="md:hidden">
        <nav
          aria-label="Admin stranice"
          className="h-14 px-1.5 flex items-center justify-between gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PAGES.map((p) => {
            const active = p.key === current;
            return (
              <Link
                key={p.key}
                href={p.href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 h-12 px-1.5 flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold font-poppins leading-none whitespace-nowrap transition-colors ${
                  active ? "bg-accent/15 text-accent" : "text-foreground/60 active:bg-foreground/5"
                }`}
              >
                <p.Icon size={19} />
                {p.label}
                {p.key === "upiti" && waiting > 0 && (
                  <span className="absolute top-0.5 right-0">
                    <CountBadge count={waiting} strong={!active} />
                  </span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Odjava"
            className="shrink-0 w-9 h-12 flex items-center justify-center rounded-xl text-red-400 active:bg-red-400/10 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </nav>

        {onLocationChange && (
          <div className="px-3 pb-2 flex justify-center">
            <AdminLocationSwitch value={location} onChange={onLocationChange} />
          </div>
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
                <span key={p.key} aria-current="page" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-xs font-bold font-poppins text-accent uppercase tracking-widest">
                  {p.label}
                  {p.key === "upiti" && waiting > 0 && <CountBadge count={waiting} />}
                </span>
              ) : (
                <Link key={p.key} href={p.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-poppins text-foreground/50 hover:text-foreground/76 uppercase tracking-widest transition-colors">
                  {p.label}
                  {p.key === "upiti" && waiting > 0 && <CountBadge count={waiting} strong />}
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
