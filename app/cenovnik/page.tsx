import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import PricingGrid, { type PricedService } from "./PricingGrid";
import { fetchPriceRows, PriceBook } from "@/lib/prices";
import { LOCATIONS } from "@/lib/locations";
import BookingCTA from "./BookingCTA";
import CenovnikFooter from "./CenovnikFooter";
import { OG_BASE } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cenovnik laserske epilacije",
  description:
    "Pregledni cenovnik svih tretmana laserske epilacije u Infinity Laser Studiju u Novom Sadu i Somboru. Paketi za žene i muškarce, mogućnost plaćanja na rate.",
  alternates: { canonical: "https://www.infinitylaserstudio.com/cenovnik" },
  openGraph: {
    ...OG_BASE,
    title: "Cenovnik laserske epilacije | Infinity Laser Studio",
    description:
      "Pregledni cenovnik svih tretmana laserske epilacije u Infinity Laser Studiju. Paketi za žene i muškarce, mogućnost plaćanja na rate.",
    url: "https://www.infinitylaserstudio.com/cenovnik",
  },
};

export default async function CenovnikPage() {
  const [{ data, error }, priceRows] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, gender, price")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    fetchPriceRows(),
  ]);

  // A failed read must not be published as an empty price list for the next
  // hour - throwing keeps the last good version of the page online.
  if (error || !data || data.length === 0 || !priceRows) {
    throw new Error("cenovnik: services could not be loaded");
  }

  // Each studio has its own prices - today's price per studio for every
  // treatment. A treatment a studio does not offer has no entry there.
  const book = new PriceBook(priceRows);
  const services: PricedService[] = data.map((s) => ({
    id: s.id,
    name: s.name,
    gender: s.gender,
    prices: Object.fromEntries(
      LOCATIONS.flatMap((l) => {
        const price = book.priceAt(s.id, l.id);
        return price == null ? [] : [[l.id, price]];
      }),
    ),
  }));

  const zene = services.filter((s) => s.gender === "zene");
  const muskarci = services.filter((s) => s.gender === "muskarci");

  return (
    <main>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="bg-surface pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "var(--accent)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "var(--accent-deep)" }}
        />

        <div className="relative max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/50 mb-6">
            <span className="w-6 h-px bg-accent inline-block" />
            Infinity Laser Studio
          </span>

          <h1 className="font-playfair text-5xl sm:text-6xl text-foreground mb-4 leading-tight">
            Cenovnik
          </h1>

          <p className="font-poppins text-base text-foreground/60">
            Trajno uklanjanje dlačica laserskom tehnologijom
          </p>

          <div
            className="mx-auto mt-8 h-px w-32 rounded-full"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--accent), transparent)",
            }}
          />
        </div>
      </section>

      {/* ── Services grid ──────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-background-alt">
        <div className="max-w-6xl mx-auto">
          <PricingGrid zene={zene} muskarci={muskarci} />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-background text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-playfair text-3xl sm:text-4xl text-foreground mb-3">
            Spreman/a za tretman?
          </h2>
          <p className="font-poppins text-sm text-foreground/60 mb-8">
            Odaberi uslugu i zakaži termin u nekoliko klikova.
          </p>
          <BookingCTA />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <CenovnikFooter />
    </main>
  );
}
