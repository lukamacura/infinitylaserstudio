import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Caveat, Courier_Prime } from "next/font/google";
import "./karton.css";

// Only these pages load them. Both cover š č ć ž đ through latin-ext. Numbers on
// the card are always in the typewriter face: a handwritten 1 reads like a 7.
const typewriter = Courier_Prime({
  variable: "--font-typewriter",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const hand = Caveat({
  variable: "--font-hand",
  weight: ["500", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kartoni",
  robots: { index: false, follow: false },
};

export default function KartoniLayout({ children }: { children: ReactNode }) {
  return <div className={`${typewriter.variable} ${hand.variable}`}>{children}</div>;
}
