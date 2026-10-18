// ── Google Ads conversion tracking ────────────────────────────────────────────
// The Google tag itself is set up in app/layout.tsx (deferred like the Meta
// Pixel). This file sends the booking conversion.

export const GOOGLE_ADS_ID = "AW-18503108271";

/**
 * Label of the "Purchase" conversion action - Google Ads → Goals →
 * Conversions → the action → Tag setup → "send_to: 'AW-…/<label>'".
 * Empty = the conversion is not sent.
 */
export const GOOGLE_ADS_BOOKING_LABEL = "o7OMCPPX15YdEK-N_PZE";

type Gtag = (...args: unknown[]) => void;

/**
 * Google Ads wants the phone in E.164 (+381…). Visitors type it any way they
 * like, so local numbers (06x…) get the Serbian prefix. Anything that can't be
 * read as a full number is left out rather than sent wrong.
 */
function toE164(phone: string): string | undefined {
  const hasPlus = phone.trim().startsWith("+");
  let digits = phone.replace(/\D/g, "");
  if (!hasPlus) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = "381" + digits.slice(1);
  }
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : undefined;
}

/**
 * One booking = one conversion with its real value in dinars. The reservation
 * id is the transaction id, so a repeated send is counted once. Email and
 * phone go as enhanced-conversion data - gtag hashes them before sending.
 */
export function trackGoogleAdsBooking(booking: {
  reservationId: string;
  value: number;
  email: string;
  phone?: string;
  newCustomer: boolean;
}) {
  if (!GOOGLE_ADS_BOOKING_LABEL) return;
  try {
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (!gtag) return;
    gtag("set", "user_data", {
      email: booking.email.toLowerCase(),
      phone_number: booking.phone ? toE164(booking.phone) : undefined,
    });
    gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_BOOKING_LABEL}`,
      value: booking.value,
      currency: "RSD",
      transaction_id: booking.reservationId,
      new_customer: booking.newCustomer,
    });
  } catch { /* tracking must never break the booking */ }
}
