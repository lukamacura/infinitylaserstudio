import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { Lock, Snowflake } from "lucide-react";
import "./paketici.css";
import Snow from "./Snow";
import VslFrame from "./VslFrame";
import LandingCta from "./LandingCta";
import { unlockPaketici } from "./actions";
import { loadGiftCatalog, loadGiftStock } from "@/lib/server/paketici";
import { hasPaketiciAccess } from "@/lib/server/paketiciAccess";
import { GIFT_LIMIT } from "@/lib/paketici";
import { OG_BASE } from "@/lib/seo";

// While the page sits behind a password (lib/server/paketiciAccess.ts) it reads
// a cookie, so it renders on every request - no ISR until the password goes.

// Handwriting for the dedication card inside the order steps - not preloaded
// against the first screen.
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

const TITLE = "Infinity paketić - novogodišnji poklon";
const DESCRIPTION =
  "Premium novogodišnja kutija sa voucherom za lasersku epilaciju, slatkišima i posvetom. Dostava u Novom Sadu, poštom ili lično preuzimanje u studiju. Samo 50 paketića.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://www.infinitylaserstudio.com/paketici" },
  // Behind a password for now - drop this together with the password.
  robots: { index: false, follow: false },
  openGraph: {
    ...OG_BASE,
    title: `${TITLE} | Infinity Laser Studio`,
    description: DESCRIPTION,
    url: "https://www.infinitylaserstudio.com/paketici",
  },
};

/**
 * One screen: headline, Branka's video, one button. The button opens the
 * order as steps (GiftFlow). On a phone the text and the button keep their
 * size and the video takes whatever height is left, so everything is in view
 * without scrolling; from lg up the video stands beside the text.
 */
export default async function PaketiciPage({ searchParams }: { searchParams: Promise<{ greska?: string }> }) {
  if (!(await hasPaketiciAccess())) {
    const { greska } = await searchParams;
    return <PasswordGate wrong={greska === "1"} />;
  }

  const [catalog, stock] = await Promise.all([loadGiftCatalog(), loadGiftStock()]);
  // A failed price read must not be cached as an empty shop - throwing keeps
  // the last good version of the page online (same as /cenovnik).
  if (!catalog || catalog.zenska.length === 0) throw new Error("paketici: prices could not be loaded");
  const initialStock = { total: stock?.total ?? GIFT_LIMIT, remaining: stock?.remaining ?? null };

  return (
    <main className={`pk ${caveat.variable} relative`}>
      <Snow />

      <section className="pk-screen relative flex flex-col overflow-hidden px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Lights />

        {/* Logo + the occasion */}
        <header className="relative mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between">
          <Link href="/" aria-label="Infinity Laser Studio" className="flex items-center gap-2">
            <Image src="/brand/logo.webp" alt="" width={32} height={32} className="h-8 w-auto" priority />
            <span className="font-playfair text-[15px] tracking-[0.18em] text-accent">INFINITY</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-3 py-1 font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Snowflake size={12} /> Nova godina
          </span>
        </header>

        <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col lg:flex-row lg:items-center lg:gap-16">
          {/* Phones: this wrapper dissolves (`contents`) so the text, the video
              and the button stack in that order; lg: text + button side by side
              with the video. */}
          <div className="contents lg:flex lg:flex-1 lg:flex-col lg:justify-center">
            <div className="order-1 shrink-0 pt-4 text-center lg:pt-0 lg:text-left">
              <h1 className="font-playfair text-[2rem] leading-[1.08] text-foreground sm:text-[2.6rem] lg:text-[3.6rem]">
                Ne znaš šta da <span className="metal-text">joj kupiš?</span>
              </h1>
              <p className="mx-auto mt-2 max-w-sm font-poppins text-[14px] leading-snug text-foreground/70 sm:max-w-md sm:text-base lg:mx-0 lg:mt-5 lg:max-w-lg lg:text-lg">
                Ako ne znaš šta tvoja devojka želi, pogledaj ovo - pa joj pokloni premium kutiju sa voucherom za lasersku epilaciju, spremnu za ispod jelke.
              </p>
            </div>
            <div className="order-3 shrink-0 pt-4 lg:pt-8">
              <LandingCta catalog={catalog} initialStock={initialStock} />
            </div>
          </div>

          <div className="order-2 flex min-h-0 flex-1 items-center justify-center pt-4 lg:h-[80svh] lg:flex-none lg:pt-0">
            <VslFrame />
          </div>
        </div>
      </section>
    </main>
  );
}

/** The password form - a plain server form, works before any JS loads. */
function PasswordGate({ wrong }: { wrong: boolean }) {
  return (
    <main className="pk relative">
      <section className="pk-screen relative flex flex-col items-center justify-center overflow-hidden px-5">
        <Lights />
        <form action={unlockPaketici} className="relative flex w-full max-w-xs flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full metal">
            <Lock size={22} />
          </span>
          <h1 className="mt-4 font-playfair text-[1.75rem] leading-tight text-foreground">Infinity paketić</h1>
          <p className="mt-1 font-poppins text-[14px] text-foreground/60">Stranica je u pripremi. Unesi šifru.</p>
          <label htmlFor="pk-lozinka" className="sr-only">Šifra</label>
          <input
            id="pk-lozinka"
            name="lozinka"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className={`mt-5 h-12 w-full rounded-xl border bg-foreground/[0.04] px-4 text-center font-poppins text-[16px] text-foreground outline-none focus:border-accent ${
              wrong ? "border-red-400/70" : "border-foreground/15"
            }`}
          />
          {wrong && <p className="mt-2 font-poppins text-[13px] text-red-300">Pogrešna šifra.</p>}
          <button type="submit" className="metal mt-4 h-12 w-full rounded-full font-poppins text-[15px] font-semibold tracking-widest cursor-pointer">
            UĐI
          </button>
        </form>
      </section>
    </main>
  );
}

/** Soft blurred lights, like a string of fairy lights out of focus. */
function Lights() {
  const lights = [
    { top: "6%", left: "4%", size: 70, color: "var(--accent)", t: "5s", d: "0s" },
    { top: "16%", left: "84%", size: 90, color: "var(--pk-rose)", t: "6s", d: "1.2s" },
    { top: "58%", left: "6%", size: 60, color: "var(--pk-rose)", t: "4.6s", d: "0.6s" },
    { top: "72%", left: "86%", size: 80, color: "var(--accent)", t: "5.6s", d: "2s" },
    { top: "38%", left: "46%", size: 160, color: "var(--accent)", t: "7s", d: "0.3s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {lights.map((l, i) => (
        <span
          key={i}
          className="pk-bokeh"
          style={{
            top: l.top, left: l.left, width: l.size, height: l.size,
            background: `color-mix(in srgb, ${l.color} 45%, transparent)`,
            ["--t" as string]: l.t, ["--delay" as string]: l.d,
          }}
        />
      ))}
    </div>
  );
}
