import { Caveat, Courier_Prime } from "next/font/google";

// The paper pages (/kartoni, /upiti) and only they load these. Both cover
// š č ć ž đ through latin-ext. Numbers are always in the typewriter face: a
// handwritten 1 reads like a 7.
const typewriter = Courier_Prime({
  variable: "--font-typewriter",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// No `weight`: Caveat is a variable font (400-700), so 500 and 700 both come
// out of the one variable file. Asking for fixed weights makes Google answer
// with /l/font?kit=...&skey=... URLs, and Turbopack's next/font loader fails on
// the "&" ("next/font/google queries have exactly one entry"). The landing's
// Caveat calls (ServiceHighlights, CostComparison, BookingSheet) ask the same way.
const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/** Put on a paper page's root: sets --font-typewriter and --font-hand. */
export const paperFontVars = `${typewriter.variable} ${hand.variable}`;
