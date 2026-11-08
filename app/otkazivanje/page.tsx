import type { Metadata } from "next";
import { clientCancel, isValidCancelLink } from "@/lib/cancelLink";
import { formatEmailDay, firstNameOf } from "@/lib/email/layout";
import { DEFAULT_LOCATION, fullAddress, getLocation, isLocationId } from "@/lib/locations";
import CancelView, { type CancelAppointment, type CancelViewState } from "./CancelView";

/**
 * Where the "Otkaži termin" link in the emails leads (lib/cancelLink.ts).
 *
 * Opening it only shows the appointment - mail scanners open every link in an
 * email on their own, so the cancelling itself is the button on the page
 * (POST /api/reservation-cancel). Less than 24 h before the treatment the
 * page says up front what the policy says: 50% at the next visit, unless the
 * reason is health.
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
  const appointment: CancelAppointment = {
    firstName: firstNameOf(result.customer_name),
    day:       formatEmailDay(result.date),
    time:      `${result.start_time} – ${result.end_time}`,
    studio:    fullAddress(studio),
    services:  result.services,
    ref:       result.id.slice(-8).toUpperCase(),
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
