import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import { movedEmailHtml, movedEmailSubject, movedEmailText, type MovedEmailData } from "@/lib/email/movedEmail";
import { sendClientEmail } from "@/lib/email/send";
import { cancelUrl } from "@/lib/cancelLink";

/**
 * Moves an appointment to another day / time (admin calendar: drag, or
 * "Pomeri termin") and, when asked, tells the client by email.
 *
 * The move itself is `admin_move_reservation` in the database, called with the
 * admin's own session (Authorization: Bearer <access token>) - so only a
 * signed-in admin can move anything, and the same day lock and overlap check
 * apply as for a booking from the site. The email is built from what the
 * database returned, never from the request.
 *
 * A move that worked is never reported as failed because the email did not go
 * out: the answer says `email: "failed"` and the admin calls the client.
 *
 * Server-only env vars (shared with app/api/booking-confirm):
 *   RESEND_API_KEY, RESEND_FROM, BOOKING_REPLY_TO (optional), BOOKING_NOTIFY_EMAIL (optional)
 */
/** The move plus two tries at Resend must fit, even on a slow day. */
export const maxDuration = 30;


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]0$/;

/** What the admin is told about the email. */
type MoveEmailResult = "sent" | "failed" | "skipped";

type MoveResult =
  | {
      status: "ok";
      id: string;
      customer_name: string;
      customer_email: string;
      location: string;
      total_duration: number;
      old_date: string;
      old_start: string;
      date: string;
      start_time: string;
      end_time: string;
      upcoming: boolean;
      services: string[];
    }
  | { status: "slot_taken"; clash_name: string; clash_start: string; clash_end: string }
  | { status: "forbidden" | "invalid_input" | "not_found" | "inactive" | "unchanged" };

/** A real calendar day - "2026-02-30" is not one. */
function isRealDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function sendMovedEmail(to: string, data: MovedEmailData): Promise<boolean> {
  return sendClientEmail({
    to,
    subject: movedEmailSubject(data),
    html: movedEmailHtml(data),
    text: movedEmailText(data),
    // Every move is its own email - a second move of the same booking too.
    idempotencyKey: `reservation-move-${randomUUID()}`,
    tag: "[reservation-move]",
  });
}

export async function POST(req: NextRequest) {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("[reservation-move] Supabase env vars not set");
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 401 });

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

  // Acts as the signed-in admin: the database decides who may move what.
  const db = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.rpc("admin_move_reservation", {
    p_id: id, p_date: date, p_start_time: `${start_time}:00`,
  });
  if (error || !data) {
    // An expired or foreign session ends up here too (PostgREST rejects the token).
    const expired = error?.code === "PGRST301" || /jwt/i.test(error?.message ?? "");
    if (!expired) console.error("[reservation-move] move failed:", error);
    return NextResponse.json({ ok: false, error: expired ? "forbidden" : "db" }, { status: expired ? 401 : 502 });
  }

  const result = data as unknown as MoveResult;
  switch (result.status) {
    case "ok":
      break;
    case "slot_taken":
      return NextResponse.json({
        ok: false, error: "slot_taken",
        clash: { name: result.clash_name, start: result.clash_start, end: result.clash_end },
      }, { status: 409 });
    case "unchanged":
      return NextResponse.json({ ok: false, error: "unchanged" }, { status: 409 });
    case "forbidden":
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    case "not_found":
    case "inactive":
      return NextResponse.json({ ok: false, error: result.status }, { status: 404 });
    default:
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const moved = { date: result.date, start_time: result.start_time, end_time: result.end_time };

  // No email for a past term (a record being corrected) or a client without an address.
  let email: MoveEmailResult = "skipped";
  if (notify && result.upcoming && result.customer_email) {
    const sent = await sendMovedEmail(result.customer_email, {
      customerName:    result.customer_name,
      studio:          getLocation(isLocationId(result.location) ? result.location : DEFAULT_LOCATION),
      date:            result.date,
      startTime:       result.start_time,
      endTime:         result.end_time,
      durationMinutes: result.total_duration,
      oldDate:         result.old_date,
      oldStartTime:    result.old_start,
      services:        Array.isArray(result.services) ? result.services.filter((s) => typeof s === "string") : [],
      cancelUrl:       cancelUrl(result.id),
    });
    email = sent ? "sent" : "failed";
    if (!sent) console.error(`[reservation-move] client NOT emailed about moved booking ${result.id}`);
  }

  return NextResponse.json({ ok: true, moved, email });
}
