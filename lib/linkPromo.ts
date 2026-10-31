// ── ?promo=<code> - the links that carry a discount or the free earrings ───────
// Remembered for the tab, so the offer is still there when the visitor closes
// the form and opens it again from any other button, or moves to another page
// of the site.

import { isGiftPromoCode, isLinkPromoCode } from "./pricing";

const KEY = "ils_link_code";

const isOfferCode = (code: string | null | undefined) =>
  isLinkPromoCode(code) || isGiftPromoCode(code);

/** The offer code in this URL, lowercased - null when there is none. */
export function urlLinkPromo(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("promo");
  return isOfferCode(code) ? code!.trim().toLowerCase() : null;
}

/** The offer code the visitor arrived on at some point in this tab. */
export function readLinkPromo(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = urlLinkPromo();
  try {
    if (fromUrl) sessionStorage.setItem(KEY, fromUrl);
    if (fromUrl) return fromUrl;
    const stored = sessionStorage.getItem(KEY);
    return isOfferCode(stored) ? stored : null;
  } catch {
    return fromUrl; // storage blocked - the link still works on this page
  }
}
