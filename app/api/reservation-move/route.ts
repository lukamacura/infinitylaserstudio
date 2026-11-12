import { NextRequest, NextResponse } from "next/server";
import { bearerToken, dbForToken } from "@/lib/server/adminDb";
import { moveReservation } from "@/lib/server/moveReservation";

/**
 * Moves an appointment to another day / time (admin calendar: drag, or
 * "Pomeri termin") and, when asked, tells the client by email.
 *
 * The work is lib/server/moveReservation.ts (shared with Infy): the database
 * function `admin_move_reservation`, called with the admin's own session
 * (Authorization: Bearer <access token>), then the "Termin je pomeren" email.
 *
 * Server-only env vars (shared with app/api/booking-confirm):
 *   RESEND_API_KEY, RESEND_FROM, BOOKING_REPLY_TO (optional), BOOKING_NOTIFY_EMAIL (optional)
 */
/** The move plus two tries at Resend must fit, even on a slow day. */
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]0$/;

/** A real calendar day - "2026-02-30" is not one. */
function isRealDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 401 });
  const db = dbForToken(token);
  if (!db) return NextResponse.json({ ok: false, error: "config" }, { status: 500 });

  let payload: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    payload = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const { id, date, start_time, notify } = payload;
  if (
    typeof id !== "string" || !UUID_RE.test(id) ||
    typeof date !== "string" || !isRealDate(date) ||
    typeof start_time !== "string" || !TIME_RE.test(start_time) ||
    typeof notify !== "boolean"
  ) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const result = await moveReservation(db, { id, date, startTime: start_time, notify });
  if (result.ok) return NextResponse.json({ ok: true, moved: result.moved, email: result.email });

  switch (result.error) {
    case "slot_taken":
      return NextResponse.json({ ok: false, error: "slot_taken", clash: result.clash }, { status: 409 });
    case "unchanged":
      return NextResponse.json({ ok: false, error: "unchanged" }, { status: 409 });
    case "expired":
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 401 });
    case "forbidden":
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    case "not_found":
    case "inactive":
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    case "db":
      return NextResponse.json({ ok: false, error: "db" }, { status: 502 });
    default:
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
}
