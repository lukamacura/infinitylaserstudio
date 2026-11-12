import type { Metadata } from "next";
import type { ReactNode } from "react";
import { paperFontVars } from "@/lib/paperFonts";
import "./karton.css";

export const metadata: Metadata = {
  title: "Kartoni",
  robots: { index: false, follow: false },
};

export default function KartoniLayout({ children }: { children: ReactNode }) {
  return <div className={paperFontVars}>{children}</div>;
}
