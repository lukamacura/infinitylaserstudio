// ── ?promo=popust20 - the link that carries the −20% discount ──────────────────
// Remembered for the tab, so the discount is still there when the visitor
// closes the form and opens it again from any other button, or moves to
// another page of the site.

import { isLinkPromoCode } from "./pricing";

const KEY = "ils_link_promo";

/** This URL carries the link discount. */
export function urlHasLinkPromo(): boolean {
  if (typeof window === "undefined") return false;
  return isLinkPromoCode(new URLSearchParams(window.location.search).get("promo"));
}

/** The visitor arrived on the discount link at some point in this tab. */
export function hasLinkPromo(): boolean {
  if (typeof window === "undefined") return false;
  const fromUrl = urlHasLinkPromo();
  try {
    if (fromUrl) sessionStorage.setItem(KEY, "1");
    return fromUrl || sessionStorage.getItem(KEY) === "1";
  } catch {
    return fromUrl; // storage blocked - the link still works on this page
  }
}
