"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Phone } from "lucide-react";
import { useStock, type Stock } from "./stock";
import { MIN_TOTAL, formatNumber, type GiftCatalog } from "@/lib/paketici";

// The steps load on the first tap (warmed in the background before that).
const GiftFlow = dynamic(() => import("./GiftFlow"), { ssr: false });

/** The landing's one button, the box count under it, and the order sheet it opens. */
export default function LandingCta({ catalog, initialStock }: { catalog: GiftCatalog; initialStock: Stock }) {
  const { total, remaining } = useStock(initialStock);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);

  // Warm the steps' code once the page has settled, so the first tap opens at once.
  useEffect(() => {
    let idle: number | undefined;
    const warm = () => { void import("./GiftFlow"); };
    const t = setTimeout(() => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(warm, { timeout: 3000 });
      else warm();
    }, 2500);
    return () => {
      clearTimeout(t);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);

  const soldOut = remaining === 0;

  return (
    <div className="flex flex-col items-center lg:items-start">
      {soldOut ? (
        <a
          href="tel:+381653738991"
          className="metal inline-flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-full font-poppins text-[15px] font-bold tracking-[0.04em]"
        >
          <Phone size={18} /> Rasprodato - pozovi za voucher
        </a>
      ) : (
        <span className="cta-halo relative inline-flex w-full max-w-sm">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group metal relative w-full overflow-hidden inline-flex h-14 items-center justify-between gap-4 rounded-full pl-8 pr-2.5 font-poppins text-base font-bold tracking-[0.06em] cursor-pointer transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            <span className="cta-sweep" aria-hidden="true" />
            <span className="relative">IZABERI PAKETIĆ</span>
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-on-accent text-accent transition-transform duration-300 group-hover:translate-x-1">
              <ArrowRight size={18} strokeWidth={2.2} />
            </span>
          </button>
        </span>
      )}

      <p className="mt-2.5 font-poppins text-[12px] text-foreground/55">
        Samo {total} paketića
        {remaining != null && !soldOut && <> · <span className="font-semibold text-accent">još {remaining}</span></>}
        {" "}· od {formatNumber(MIN_TOTAL)} RSD
      </p>

      {mounted && <GiftFlow open={open} onClose={() => setOpen(false)} catalog={catalog} />}
    </div>
  );
}
