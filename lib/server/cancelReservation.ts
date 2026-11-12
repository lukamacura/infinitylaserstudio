/**
 * Staff cancel an appointment (Infy's confirmed proposal) and, when asked,
 * the client gets "Termin je otkazan" - the same paper sheet as when they
 * cancel with the email link, without any late-cancellation fee. Server-only.
 *
 * The cancellation is `admin_cancel_reservation` (sql/infy.sql), called with
 * the admin's own session: status, and a dated line in the booking's notes.
 */
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import { cancelSheet, type CancelInfo } from "@/lib/cancelLink";
import { cancelledEmailHtml, cancelledEmailSubject, cancelledEmailText } from "@/lib/email/cancelledEmail";
import { sendClientEmail } from "@/lib/email/send";
import type { AdminDb } from "@/lib/server/adminDb";
import type { EmailResult } from "@/lib/server/moveReservation";

type CancelResult =
  | (CancelInfo & { status: "ok" | "already"; upcoming: boolean })
  | { status: "forbidden" | "invalid_input" | "not_found" | "inactive" };

export type CancelOutcome =
  | { ok: true; already: boolean; email: EmailResult }
  | { ok: false; error: "expired" | "forbidden" | "invalid_input" | "not_found" | "inactive" | "db" };

export async function cancelReservation(
  db: AdminDb,
  input: { id: string; reason: string | null; notify: boolean },
): Promise<CancelOutcome> {
  const { data, error } = await db.rpc("admin_cancel_reservation", { p_id: input.id, p_reason: input.reason });
  if (error || !data) {
    const expired = error?.code === "PGRST301" || /jwt/i.test(error?.message ?? "");
    if (!expired) console.error("[reservation-cancel-admin] cancel failed:", error);
    return { ok: false, error: expired ? "expired" : "db" };
  }
  const result = data as unknown as CancelResult;
  if (result.status !== "ok" && result.status !== "already") return { ok: false, error: result.status };

  // Cancelled before (the client, or staff): no second email.
  if (result.status === "already") return { ok: true, already: true, email: "skipped" };

  let email: EmailResult = "skipped";
  if (input.notify && result.upcoming && result.customer_email) {
    const info: CancelInfo = {
      ...result,
      services: Array.isArray(result.services) ? result.services.filter((s) => typeof s === "string") : [],
    };
    const sheet = await cancelSheet(info);
    const data = {
      ...sheet,
      customerName: info.customer_name,
      studio:       getLocation(isLocationId(info.location) ? info.location : DEFAULT_LOCATION),
      late:         false,
    };
    const sent = await sendClientEmail({
      to:             info.customer_email,
      subject:        cancelledEmailSubject(data),
      html:           cancelledEmailHtml(data),
      text:           cancelledEmailText(data),
      // Same key as the client's own cancel link: one "otkazan" email per booking.
      idempotencyKey: `reservation-cancel-${info.id}`,
      tag:            "[reservation-cancel-admin]",
    });
    email = sent ? "sent" : "failed";
    if (!sent) console.error(`[reservation-cancel-admin] client NOT emailed about cancelled booking ${info.id}`);
  }
  return { ok: true, already: false, email };
}
