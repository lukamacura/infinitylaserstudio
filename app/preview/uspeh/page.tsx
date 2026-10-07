"use client";

// Dev-only preview of the booking confirmation screen with mock data -
// lets the design be checked without making a real reservation.
import { useState } from "react";
import { notFound } from "next/navigation";
import BookingSuccess, { type SuccessDiscount } from "@/components/booking/BookingSuccess";
import { ACCENTS, COL_W } from "@/components/booking/shared";

const VARIANTS: Record<string, SuccessDiscount> = {
  Redovna: null,
  Paket: { kind: "bundle", size: 3, pct: 20 },
  Student: { kind: "student" },
  Link: { kind: "link" },
  "Iz paketa": { kind: "redeem" },
};

const LIST_TOTAL = 14_500;
const FINAL: Record<string, number> = { Redovna: LIST_TOTAL, Paket: 34_800, Student: 11_600, Link: 11_600, "Iz paketa": 0 };

export default function SuccessPreview() {
  const [variant, setVariant] = useState("Redovna");
  const [gender, setGender] = useState<"zene" | "muskarci">("zene");
  const [run, setRun] = useState(0);
  if (process.env.NODE_ENV === "production") notFound();

  const list = variant === "Paket" ? 43_500 : LIST_TOTAL;
  const btn = "px-3 py-1.5 rounded-full text-xs font-poppins border border-foreground/20 cursor-pointer";

  return (
    <div className={`bm-theme bm-theme-${gender} min-h-screen`}>
      <div className="bm-sheet min-h-screen px-4 py-6">
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {Object.keys(VARIANTS).map((v) => (
            <button key={v} className={`${btn} ${v === variant ? "bg-foreground/15" : ""}`} onClick={() => { setVariant(v); setRun((r) => r + 1); }}>{v}</button>
          ))}
          <button className={btn} onClick={() => { setGender((g) => (g === "zene" ? "muskarci" : "zene")); setRun((r) => r + 1); }}>
            {gender === "zene" ? "Žene" : "Muškarci"}
          </button>
          <button className={btn} onClick={() => setRun((r) => r + 1)}>↻ Ponovi</button>
        </div>

        <div className={COL_W}>
          <BookingSuccess
            key={run}
            headline="Termin zakazan! Čekamo Vas u Miloja Čiplića 51 u Novom Sadu"
            email="ana.petrovic@gmail.com"
            date="Utorak, 14. oktobar"
            timeRange="10:00 – 11:10"
            duration={70}
            withConsultation
            services={["Pazuh", "Cele noge", "Bikini zona"]}
            listTotal={list}
            finalPrice={FINAL[variant]}
            discount={VARIANTS[variant]}
            bookingRef="A7K29Q"
            accentHex={ACCENTS[gender].hex}
          />
        </div>
      </div>
    </div>
  );
}
