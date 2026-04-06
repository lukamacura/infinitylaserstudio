"use client";

import { Sparkles, Tag } from "lucide-react";

export default function PromoBanner() {
  return (
    <div className="fixed top-17 right-2 sm:top-20 sm:right-4 z-60 animate-promo-in">
      <div className="relative">
        {/* Glow */}
        <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-pink-500 via-fuchsia-500 to-rose-500 opacity-70 blur-lg animate-promo-glow" />

        {/* Card */}
        <div className="relative flex items-center gap-2 sm:gap-3 rounded-2xl bg-linear-to-br from-rose-600 via-pink-600 to-fuchsia-700 px-2.5 py-2 sm:px-4 sm:py-3 shadow-2xl ring-1 ring-white/20 backdrop-blur-sm">
          <div className="relative flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 shrink-0">
            <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" strokeWidth={2.5} />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-200 animate-promo-spark" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.15em] text-pink-100/90">
              Ekskluzivna ponuda
            </span>
            <span className="text-[11px] sm:text-sm font-bold text-white">
              -50% za 1. tretman
            </span>
            <span className="text-[9px] sm:text-[11px] font-medium text-pink-100/90">
              (sve regije)
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes promo-in {
          0% {
            opacity: 0;
            transform: translateX(40px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes promo-glow {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 0.95;
          }
        }
        @keyframes promo-spark {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.25) rotate(15deg);
            opacity: 1;
          }
        }
        :global(.animate-promo-in) {
          animation: promo-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        :global(.animate-promo-glow) {
          animation: promo-glow 2.6s ease-in-out infinite;
        }
        :global(.animate-promo-spark) {
          animation: promo-spark 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
