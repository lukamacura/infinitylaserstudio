import { supabase } from "@/lib/supabase";
import type { Service } from "@/lib/database.types";
import PricingGrid from "./PricingGrid";

export const revalidate = 3600;

export default async function CenovnikPage() {
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  const services: Service[] = data ?? [];

  const zene = services.filter((s) => s.gender === "zene");
  const muskarci = services.filter((s) => s.gender === "muskarci");

  return (
    <main>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="bg-foreground pt-32 pb-20 px-6 text-center relative overflow-hidden">
        {/* Decorative blobs */}
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: "var(--teal)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: "var(--pink)" }}
        />

        <div className="relative max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-white/40 mb-6">
            <span className="w-6 h-px bg-teal inline-block" />
            Infinity Laser Studio
          </span>

          <h1 className="font-playfair text-5xl sm:text-6xl text-white mb-4 leading-tight">
            Cenovnik
          </h1>

          <p className="font-poppins text-base text-white/50">
            Trajno uklanjanje dlačica laserskom tehnologijom
          </p>

          {/* Accent bar */}
          <div
            className="mx-auto mt-8 h-px w-32 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--teal), var(--pink), var(--rose))",
            }}
          />
        </div>
      </section>

      {/* ── Services grid ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <PricingGrid zene={zene} muskarci={muskarci} />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-cream/50 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-playfair text-3xl sm:text-4xl text-gray-800 mb-3">
            Spreman/a za tretman?
          </h2>
          <p className="font-poppins text-sm text-gray-500 mb-8">
            Odaberi uslugu i zakaži termin u nekoliko klikova.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-poppins text-sm font-medium tracking-widest text-gray-800 bg-teal hover:bg-foreground hover:text-white transition-colors"
          >
            ZAKAŽI TERMIN
          </a>
        </div>
      </section>

      {/* ── Minimal footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center">
        <p className="font-poppins text-xs text-gray-400">
          © {new Date().getFullYear()} Infinity Laser Studio. Sva prava zadržana.
        </p>
      </footer>
    </main>
  );
}
