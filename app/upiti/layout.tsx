import type { Metadata } from "next";
import type { ReactNode } from "react";
import { paperFontVars } from "@/lib/paperFonts";
// The card paper (colours, sheets, buttons) is shared with /kartoni.
import "../kartoni/karton.css";
import "./upiti.css";

export const metadata: Metadata = {
  title: "Upiti",
  robots: { index: false, follow: false },
};

export default function UpitiLayout({ children }: { children: ReactNode }) {
  return <div className={paperFontVars}>{children}</div>;
}
