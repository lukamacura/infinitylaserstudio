/**
 * Moves an appointment to another day / time and, when asked, tells the client
 * by email. Shared by app/api/reservation-move (calendar drag, "Pomeri termin")
 * and Infy's confirmed proposals. Server-only.
 *
 * The move itself is `admin_move_reservation` in the database, called with the
 * admin's own session - so only a signed-in admin can move anything, and the
 * same day lock and overlap check apply as for a booking from the site. The
 * email is built from what the database returned, never from the request.
 *
 * A move that worked is never reported as failed because the email did not go
 * out: the answer says `email: "failed"` and the admin calls the client.
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import { movedEmailHtml, movedEmailSubject, movedEmailText, type MovedEmailData } from "@/lib/email/movedEmail";
import { sendClientEmail } from "@/lib/email/send";
import { cancelUrl } from "@/lib/cancelLink";
import type { AdminDb } from "@/lib/server/adminDb";

/** What the admin is told about the email. */
export type EmailResult = "sent" | "failed" | "skipped";

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
      /** The laser it is on now (sql/lasers_phase1.sql): a free one that works then, its own first. */
      laser?: number;
      old_laser?: number;
      upcoming: boolean;
      services: string[];
    }
  | { status: "slot_taken"; clash_name: string; clash_start: string; clash_end: string }
  | { status: "forbidden" | "invalid_input" | "not_found" | "inactive" | "unchanged" };

export type MoveOutcome =
  | { ok: true; moved: { date: string; start_time: string; end_time: string; laser?: number }; email: EmailResult }
  | { ok: false; error: "slot_taken"; clash: { name: string; start: string; end: string } }
  /** expired: the session's token was refused before the database was asked. */
  | { ok: false; error: "expired" | "forbidden" | "invalid_input" | "not_found" | "inactive" | "unchanged" | "db" };

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

/** `date` "YYYY-MM-DD", `startTime` "HH:MM" on the 10-minute grid - checked by the caller. */
export async function moveReservation(
  db: AdminDb,
  input: { id: string; date: string; startTime: string; notify: boolean },
): Promise<MoveOutcome> {
  const { data, error } = await db.rpc("admin_move_reservation", {
    p_id: input.id, p_date: input.date, p_start_time: `${input.startTime}:00`,
  });
  if (error || !data) {
    // An expired or foreign session ends up here too (PostgREST rejects the token).
    const expired = error?.code === "PGRST301" || /jwt/i.test(error?.message ?? "");
    if (!expired) console.error("[reservation-move] move failed:", error);
    return { ok: false, error: expired ? "expired" : "db" };
  }

  const result = data as unknown as MoveResult;
  if (result.status === "slot_taken") {
    return { ok: false, error: "slot_taken", clash: { name: result.clash_name, start: result.clash_start, end: result.clash_end } };
  }
  if (result.status !== "ok") return { ok: false, error: result.status };

  const moved = { date: result.date, start_time: result.start_time, end_time: result.end_time, laser: result.laser };

  // No email for a past term (a record being corrected) or a client without an address.
  let email: EmailResult = "skipped";
  if (input.notify && result.upcoming && result.customer_email) {
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

  return { ok: true, moved, email };
}
