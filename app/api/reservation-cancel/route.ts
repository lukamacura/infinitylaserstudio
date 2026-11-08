import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import { cancelSheet, clientCancel, isValidCancelLink } from "@/lib/cancelLink";
import { cancelledEmailHtml, cancelledEmailSubject, cancelledEmailText } from "@/lib/email/cancelledEmail";
import { sendClientEmail } from "@/lib/email/send";

/**
 * The client cancels their appointment: the button on /otkazivanje.
 *
 * Body: { r: reservation id, k: the link's signature } - straight from the
 * link in the email (lib/cancelLink.ts). The database does the rest in one
 * transaction (sql/client_cancel.sql): the status, whether it is late (under
 * 24 h), the note on the booking and on the client's card.
 *
 * Then the client gets "Termin je otkazan" with the studio in hidden copy. A
 * cancellation that worked is never reported as failed because the email did
 * not go out - the page already says it is cancelled.
 *
 * Pressing the button twice, or opening the link again, is harmless: the
 * second answer is "already", and the email is sent once (idempotency key).
 */
/** The cancellation plus two tries at Resend must fit, even on a slow day. */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    payload = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 400 });
  }

  const { r, k } = payload;
  if (!isValidCancelLink(r, k)) {
    return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 403 });
  }

  const result = await clientCancel(r, true);
  if (!result) return NextResponse.json({ ok: false, error: "db" }, { status: 502 });

  switch (result.status) {
    case "cancelled":
      break;
    case "already":
      return NextResponse.json({ ok: true, status: "already", late: result.late });
    case "past":
      return NextResponse.json({ ok: false, error: "past" }, { status: 409 });
    default:
      return NextResponse.json({ ok: false, error: "inactive" }, { status: 404 });
  }

  if (result.customer_email) {
    const data = {
      ...(await cancelSheet(result)),
      customerName: result.customer_name,
      studio:       getLocation(isLocationId(result.location) ? result.location : DEFAULT_LOCATION),
      late:         result.late,
    };
    const sent = await sendClientEmail({
      to:             result.customer_email,
      subject:        cancelledEmailSubject(data),
      html:           cancelledEmailHtml(data),
      text:           cancelledEmailText(data),
      idempotencyKey: `reservation-cancel-${result.id}`,
      tag:            "[reservation-cancel]",
    });
    if (!sent) console.error(`[reservation-cancel] client NOT emailed about cancelled booking ${result.id}`);
  }

  return NextResponse.json({ ok: true, status: "cancelled", late: result.late });
}
