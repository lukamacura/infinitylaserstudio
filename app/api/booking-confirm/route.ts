import { NextRequest, NextResponse } from "next/server";
import { confirmBooking, isPrice, readServices } from "@/lib/server/bookingConfirm";

/**
 * Sends the booking confirmation email through Resend and tells the admin
 * group (n8n) - the site's booking modal and the admin's call this right after
 * a booking is saved. The work is lib/server/bookingConfirm.ts (shared with
 * Infy): everything that matters comes from the reservation as saved, the
 * request only says *which* reservation, plus the treatments as shown.
 * So nobody can make the studio send a "confirmation" for a booking that does
 * not exist, or to another address.
 */
const DATE_RE =/^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const STATUS = { config: 500, lookup: 502, not_found: 404, send: 502, crash: 500 } as const;

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    payload = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { customer_email, date, start_time, booking_ref } = payload;
  if (
    typeof customer_email !== "string" || customer_email.length > 200 ||
    typeof date !== "string" || !DATE_RE.test(date) ||
    typeof start_time !== "string" || !TIME_RE.test(start_time) ||
    typeof booking_ref !== "string" || booking_ref.trim().length !== 8
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await confirmBooking({
    customerEmail:    customer_email,
    date,
    startTime:        start_time,
    bookingRef:       booking_ref,
    services:         readServices(payload.services),
    totalPrice:       isPrice(payload.total_price) ? payload.total_price : null,
    withConsultation: payload.with_consultation === true,
  });
  if (!result.ok) {
    return NextResponse.json(
      result.error === "config" ? { ok: false, error: "config" } : { ok: false },
      { status: STATUS[result.error] },
    );
  }
  return NextResponse.json(result.email ? { ok: true } : { ok: true, email: false });
}
