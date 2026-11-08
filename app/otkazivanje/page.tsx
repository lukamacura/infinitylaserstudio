import type { Metadata } from "next";
import { cancelSheet, clientCancel, isValidCancelLink, type CancelSheet } from "@/lib/cancelLink";
import { formatEmailDay, firstNameOf } from "@/lib/email/layout";
import { BUNDLE_TIERS } from "@/lib/bundles";
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import type { SuccessDiscount } from "@/components/booking/BookingSheet";
import CancelView, { type CancelAppointment, type CancelViewState } from "./CancelView";

/**
 * Where the "Otkaži termin" link in the emails leads (lib/cancelLink.ts).
 *
 * Opening it only shows the appointment - mail scanners open every link in an
 * email on their own, so the cancelling itself is the button on the page
 * (POST /api/reservation-cancel). Less than 24 h before the treatment the
 * page says up front what the policy says: 50% at the next visit, unless the
 * reason is health. The appointment is the same sheet as the confirmation
 * (BookingSheet): treatments, price, total.
 */
export const metadata: Metadata = {
  title: "Otkazivanje termina",
  robots: { index: false, follow: false },
  // The link carries the booking's key - it never goes out as a Referer.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const r = typeof sp.r === "string" ? sp.r.toLowerCase() : null;
  const k = typeof sp.k === "string" ? sp.k : null;

  if (!isValidCancelLink(r, k)) {
    return <CancelView initial="invalid" late={false} appointment={null} link={null} />;
  }

  const result = await clientCancel(r, false);
  if (!result) {
    return <CancelView initial="error" late={false} appointment={null} link={null} />;
  }
  if (result.status === "not_found" || result.status === "inactive") {
    return <CancelView initial="invalid" late={false} appointment={null} link={null} />;
  }

  const studio = getLocation(isLocationId(result.location) ? result.location : DEFAULT_LOCATION);
  const sheet = await cancelSheet(result);
  const appointment: CancelAppointment = {
    firstName: firstNameOf(result.customer_name),
    city:      studio.cityLocative,
    lateFee:   sheet.lateFee,
    sheet: {
      date:             formatEmailDay(result.date),
      timeRange:        `${result.start_time} – ${result.end_time}`,
      duration:         result.total_duration,
      withConsultation: sheet.withConsultation,
      services:         sheet.services.map((s) => s.name),
      listTotal:        sheet.listPrice,
      finalPrice:       sheet.noPrice ? null : sheet.finalPrice,
      discount:         sheet.noPrice ? null : sheetDiscount(sheet),
    },
  };
  const initial: CancelViewState =
    result.status === "open" ? "open" :
    result.status === "past" ? "past" :
    "already";
  const late = result.status === "open" || result.status === "already" || result.status === "cancelled"
    ? result.late
    : false;

  return <CancelView initial={initial} late={late} appointment={appointment} link={{ r: result.id, k: k as string }} />;
}

/** The sheet's red discount note - as the booking modal writes it. */
function sheetDiscount(s: CancelSheet): SuccessDiscount {
  switch (s.discount) {
    case "bundle":        return { kind: "bundle", size: s.bundleSessions ?? 0, pct: BUNDLE_TIERS[s.bundleSessions ?? 0] ?? 0 };
    case "bundle_redeem": return { kind: "redeem" };
    case "student":       return { kind: "student" };
    case "link":          return { kind: "link" };
    case "gift":          return { kind: "gift" };
    case "promo":         return { kind: "promo" };
    default:              return null;
  }
}
