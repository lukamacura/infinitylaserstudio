/**
 * Everything the booking sheet shows for one saved reservation - the same
 * sheet as the booking modal's last step and the confirmation email: the
 * treatments, the consultation for a new client, the price with its discount.
 * Used where only the reservation is known (/otkazivanje and its email).
 * Server-only (takes the service-role client).
 *
 * Priced exactly like the admin calendar prices it: its regions at the
 * studio's prices when it was booked, combos applied, then the promo code or
 * a price corrected by hand (lib/pricing.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BookingDiscount } from "@/lib/email/bookingEmail";
import { escapeLike } from "@/lib/fetchAll";
import { PriceBook } from "@/lib/prices";
import {
  applyComboRules, computeReservationPrice, isGiftPromoCode, isGiftService, lateCancelFee,
  type DiscountKind,
} from "@/lib/pricing";

export interface ReservationSheet {
  /** As priced - a combo is one line. */
  services: { name: string; price: number }[];
  /** New client when booked - the sheet lists the consultation first. */
  withConsultation: boolean;
  listPrice: number;
  finalPrice: number;
  discount: BookingDiscount;
  /** Treatments in the bundle - only for "bundle" and "bundle_redeem". */
  bundleSessions: number | null;
  /** What a late cancellation of it costs at the next visit (50%). */
  lateFee: number;
}

/** The sheet's discount line for each pricing rule. "fifty" is the retired first-visit −50%. */
const DISCOUNT: Record<DiscountKind, BookingDiscount> = {
  none: "none", fifty: "none", fifty_promo: "promo", promo: "promo", student: "student",
  link: "link", gift: "gift", bundle: "bundle", bundle_redeem: "bundle_redeem",
};

type Service = { id: string; name: string; price: number };
type Row = {
  id: string;
  customer_email: string;
  created_at: string | null;
  location: string;
  promo_code: string | null;
  price_override: number | null;
  reservation_services: { services: Service | null }[];
};

const sum = (list: { price: number }[]) => list.reduce((total, s) => total + s.price, 0);

/** null when something could not be read - the caller shows the sheet without a price. */
export async function loadReservationSheet(db: SupabaseClient<Database>, id: string): Promise<ReservationSheet | null> {
  const [res, services, prices] = await Promise.all([
    db.from("reservations")
      .select("id, customer_email, created_at, location, promo_code, price_override, reservation_services(services(id, name, price))")
      .eq("id", id)
      .maybeSingle(),
    db.from("services").select("id, name, price"),
    db.from("service_prices").select("service_id, location, price, valid_from"),
  ]);
  if (res.error || !res.data || services.error || !services.data || prices.error || !prices.data) {
    console.error("[reservation-sheet] could not read", id, res.error ?? services.error ?? prices.error);
    return null;
  }
  const r = res.data as unknown as Row;

  // New client = no confirmed visit booked before this one (as public_is_returning saw it).
  const email = r.customer_email.trim();
  let withConsultation = false;
  if (email && r.created_at) {
    const { count, error } = await db.from("reservations")
      .select("id", { count: "exact", head: true })
      .ilike("customer_email", escapeLike(email))
      .eq("status", "confirmed")
      .neq("id", r.id)
      .lt("created_at", r.created_at);
    withConsultation = !error && (count ?? 0) === 0;
  }

  const book = new PriceBook(prices.data.map((p) => ({ ...p, price: Number(p.price) })));
  const own = r.reservation_services.map((rs) => rs.services).filter((s): s is Service => s !== null);
  const base = book.apply(own, r.location, r.created_at);
  const all = book.apply(services.data as Service[], r.location, r.created_at);
  const effective = applyComboRules(base, all);

  const price = computeReservationPrice({
    listPrice: sum(effective),
    giftPrice: isGiftPromoCode(r.promo_code) ? sum(applyComboRules(base.filter((s) => !isGiftService(s.name)), all)) : null,
    isFirstTreatment: withConsultation,
    createdAt: r.created_at,
    promoCode: r.promo_code,
    priceOverride: r.price_override,
  });

  return {
    services: effective.map((s) => ({ name: s.name, price: s.price })),
    withConsultation,
    listPrice: price.listPrice,
    finalPrice: price.finalPrice,
    discount: DISCOUNT[price.kind],
    bundleSessions: price.bundleSessions,
    lateFee: lateCancelFee(price),
  };
}
