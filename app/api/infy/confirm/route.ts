import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/adminDb";
import { confirmBooking } from "@/lib/server/bookingConfirm";
import { moveReservation } from "@/lib/server/moveReservation";
import { cancelReservation } from "@/lib/server/cancelReservation";
import { readProposal } from "@/lib/infy/proposals";
import type { ConfirmResponse } from "@/lib/infy/types";

/**
 * The staff tapped "Potvrdi" on one of Infy's paper sheets. Body:
 * { token: the signed proposal, notify: email the client or not }.
 *
 * Does exactly what was signed - booking, move or cancellation - through the
 * same database functions as the admin panel (day lock, overlap check, admin
 * session), then the client's email. Tapping twice is harmless: a booking
 * keeps its id from the proposal, a move answers "unchanged", a cancellation
 * "already".
 */
export const maxDuration = 30;

function reply(body: ConfirmResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const auth = await adminDb(req);
  if ("error" in auth) return reply({ ok: false, error: auth.error === "forbidden" ? "forbidden" : "config" }, 401);
  const { db } = auth;

  const body = (await req.json().catch(() => null)) as { token?: unknown; notify?: unknown } | null;
  const proposal = readProposal(body?.token);
  if (proposal === "expired") return reply({ ok: false, error: "expired" }, 410);
  if (!proposal) return reply({ ok: false, error: "invalid" }, 400);
  const notify = body?.notify === true;

  if (proposal.k === "book") {
    const { data, error } = await db.rpc("admin_create_booking", {
      p_id:                proposal.id,
      p_location:          proposal.loc,
      p_name:              proposal.name,
      p_email:             proposal.email,
      p_phone:             proposal.phone,
      p_date:              proposal.date,
      p_start_time:        `${proposal.start}:00`,
      p_service_ids:       proposal.svc,
      p_with_consultation: proposal.cons,
      p_promo_code:        proposal.promo,
      p_notes:             proposal.notes,
    });
    if (error || !data) {
      console.error("[infy-confirm] booking failed:", error);
      return reply({ ok: false, error: "db" }, 502);
    }
    const result = data as unknown as { status: string; clash_name?: string; clash_start?: string; clash_end?: string };
    switch (result.status) {
      case "ok":
        break;
      case "slot_taken":
        return reply({
          ok: false, error: "slot_taken",
          clash: { name: result.clash_name ?? "", start: result.clash_start ?? "", end: result.clash_end ?? "" },
        }, 409);
      case "too_late":
        return reply({ ok: false, error: "too_late" }, 409);
      case "invalid_promo":
        return reply({ ok: false, error: "invalid_promo" }, 409);
      case "forbidden":
        return reply({ ok: false, error: "forbidden" }, 403);
      default:
        return reply({ ok: false, error: "invalid" }, 400);
    }
    // The email to the client (when asked) and the admin group's notice -
    // the same as after a booking made in the admin modal.
    const sent = await confirmBooking({
      customerEmail:    proposal.email,
      date:             proposal.date,
      startTime:        proposal.start,
      bookingRef:       proposal.id.slice(-8),
      services:         proposal.lines,
      totalPrice:       proposal.list,
      withConsultation: proposal.cons,
      emailClient:      notify,
    });
    const email = !sent.ok ? "failed" : sent.email ? "sent" : "skipped";
    return reply({ ok: true, kind: "book", email });
  }

  if (proposal.k === "move") {
    const result = await moveReservation(db, { id: proposal.id, date: proposal.date, startTime: proposal.start, notify });
    if (result.ok) return reply({ ok: true, kind: "move", email: result.email });
    if (result.error === "slot_taken") return reply({ ok: false, error: "slot_taken", clash: result.clash }, 409);
    if (result.error === "expired") return reply({ ok: false, error: "forbidden" }, 401);
    if (result.error === "invalid_input") return reply({ ok: false, error: "invalid" }, 400);
    return reply({ ok: false, error: result.error }, result.error === "db" ? 502 : 409);
  }

  const result = await cancelReservation(db, { id: proposal.id, reason: proposal.reason, notify });
  if (result.ok) return reply({ ok: true, kind: "cancel", email: result.email, already: result.already });
  if (result.error === "expired") return reply({ ok: false, error: "forbidden" }, 401);
  if (result.error === "invalid_input") return reply({ ok: false, error: "invalid" }, 400);
  return reply({ ok: false, error: result.error }, result.error === "db" ? 502 : 409);
}
