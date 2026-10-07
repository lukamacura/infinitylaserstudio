import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseBundlePromo } from "@/lib/bundles";
import { isIlsPromoCode, isLinkPromoCode, isStudentPromoCode, linkSinglePrice } from "@/lib/pricing";
import { DEFAULT_LOCATION, getLocation, isLocationId } from "@/lib/locations";
import {
  bookingEmailHtml, bookingEmailSubject, bookingEmailText, formatEmailDate,
  type BookingDiscount, type BookingEmailData,
} from "@/lib/email/bookingEmail";

/**
 * Sends the booking confirmation email through Resend.
 *
 * Who gets the email, when the term is, in which studio and at what discount
 * all come from the reservation saved in the database - never from the
 * request. The request only says *which* reservation, plus the list of
 * treatments as the client saw them. So nobody can make the studio send a
 * "confirmation" for a booking that does not exist, or to another address.
 *
 * Server-only env vars:
 *   RESEND_API_KEY             - Resend → API Keys
 *   RESEND_FROM                - sender, on a domain verified in Resend,
 *                                e.g. "Infinity Laser Studio <termini@infinitylaserstudio.com>"
 *   BOOKING_REPLY_TO (optional)     - where a client's reply lands
 *   BOOKING_NOTIFY_EMAIL (optional) - gets a hidden copy of every confirmation
 *   SUPABASE_SERVICE_ROLE_KEY  - to read the reservation
 *   N8N_WEBHOOK_URL (optional)    - n8n webhook that posts the booking to the admin group
 *   N8N_WEBHOOK_SECRET (optional) - sent as X-Booking-Secret so n8n can reject strangers
 */
const REPLY_TO_DEFAULT = "ana.infinitystudio@gmail.com";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

type ReservationRow = Pick<
  Database["public"]["Tables"]["reservations"]["Row"],
  "id" | "customer_name" | "customer_email" | "date" | "start_time" | "end_time" |
  "total_duration" | "promo_code" | "location" | "status" | "customer_phone" | "customer_note"
>;

const DISCOUNT_LABEL: Record<BookingDiscount, string | null> = {
  none: null,
  student: "Studentski −20% (uz indeks)",
  link: "Popust −20% (link)",
  promo: "Promo −10%",
  bundle: "Paket - plaća se ceo na prvom tretmanu",
  bundle_redeem: "Tretman iz paketa - već plaćen",
};

/**
 * Tells the admin group about the new booking through n8n. Built from the
 * verified reservation, like the email. Never fails the request - a missed
 * notification must not look like a failed booking to the client.
 */
async function notifyAdmins(row: ReservationRow, d: BookingEmailData): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Booking-Secret": process.env.N8N_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({
        booking_ref:    d.bookingRef,
        location:       d.studio.id,
        location_name:  d.studio.name,
        customer_name:  row.customer_name,
        customer_phone: row.customer_phone ?? "",
        customer_email: row.customer_email,
        customer_note:  row.customer_note ?? "",
        date:           row.date,
        date_label:     formatEmailDate(row.date),
        start_time:     d.startTime,
        end_time:       d.endTime,
        duration:       d.durationMinutes,
        services:       d.services,
        list_price:     d.listPrice,
        final_price:    d.finalPrice,
        discount:       d.discount,
        discount_label: DISCOUNT_LABEL[d.discount] ?? "",
        promo_code:     row.promo_code ?? "",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[booking-confirm] n8n responded with status", res.status);
  } catch (err) {
    console.error("[booking-confirm] failed to notify n8n:", err);
  }
}

function isPrice(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 10_000_000;
}

/** The treatments as shown to the client - names and single-session prices. */
function readServices(raw: unknown): { name: string; price: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .filter((s): s is { name: string; price: number } =>
      !!s && typeof s === "object" &&
      typeof (s as { name?: unknown }).name === "string" &&
      isPrice((s as { price?: unknown }).price))
    .map((s) => ({ name: s.name.slice(0, 120), price: s.price }));
}

function priceFor(promoCode: string | null, listPrice: number): {
  discount: BookingDiscount; finalPrice: number; bundleSessions: number | null;
} {
  const bundle = parseBundlePromo(promoCode);
  if (bundle) {
    return bundle.redeem
      ? { discount: "bundle_redeem", finalPrice: 0, bundleSessions: bundle.sessions }
      : { discount: "bundle", finalPrice: bundle.total, bundleSessions: bundle.sessions };
  }
  if (isStudentPromoCode(promoCode)) {
    return { discount: "student", finalPrice: Math.round(listPrice * 0.8), bundleSessions: null };
  }
  if (isLinkPromoCode(promoCode)) {
    return { discount: "link", finalPrice: linkSinglePrice(listPrice), bundleSessions: null };
  }
  if (isIlsPromoCode(promoCode)) {
    return { discount: "promo", finalPrice: Math.round(listPrice * 0.9), bundleSessions: null };
  }
  return { discount: "none", finalPrice: listPrice, bundleSessions: null };
}

export async function POST(req: NextRequest) {
  const apiKey     = process.env.RESEND_API_KEY;
  const from       = process.env.RESEND_FROM;
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !from || !url || !serviceKey) {
    console.error("[booking-confirm] RESEND_API_KEY / RESEND_FROM / SUPABASE_SERVICE_ROLE_KEY not set - email NOT sent");
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

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

  try {
    // ── The reservation, as saved ────────────────────────────────────────────
    const admin = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rows, error } = await admin
      .from("reservations")
      .select("id, customer_name, customer_email, customer_phone, customer_note, date, start_time, end_time, total_duration, promo_code, location, status")
      .eq("date", date)
      .eq("start_time", `${start_time}:00`);
    if (error || !rows) {
      console.error("[booking-confirm] reservation lookup failed:", error);
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    const email = customer_email.trim().toLowerCase();
    const ref = booking_ref.trim().toLowerCase();
    const row: ReservationRow | undefined = rows.find(
      (r) =>
        r.id.toLowerCase().endsWith(ref) &&
        r.customer_email.trim().toLowerCase() === email &&
        r.status === "confirmed",
    );
    if (!row) {
      console.error("[booking-confirm] no matching reservation - not sending");
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // ── The email ────────────────────────────────────────────────────────────
    const services = readServices(payload.services);
    const listPrice = isPrice(payload.total_price)
      ? payload.total_price
      : services.reduce((sum, s) => sum + s.price, 0);

    const data: BookingEmailData = {
      customerName:    row.customer_name,
      date:            row.date,
      startTime:       row.start_time.slice(0, 5),
      endTime:         row.end_time.slice(0, 5),
      durationMinutes: row.total_duration,
      studio:          getLocation(isLocationId(row.location) ? row.location : DEFAULT_LOCATION),
      services,
      listPrice,
      ...priceFor(row.promo_code, listPrice),
      bookingRef:      row.id.slice(-8).toUpperCase(),
    };

    const notify = process.env.BOOKING_NOTIFY_EMAIL;
    const [res] = await Promise.all([fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // A repeated request for the same reservation never sends a second email.
        "Idempotency-Key": `booking-confirm-${row.id}`,
      },
      body: JSON.stringify({
        from,
        to: [row.customer_email.trim()],
        ...(notify ? { bcc: [notify] } : {}),
        reply_to: process.env.BOOKING_REPLY_TO ?? REPLY_TO_DEFAULT,
        subject: bookingEmailSubject(data),
        html: bookingEmailHtml(data),
        text: bookingEmailText(data),
      }),
    }), notifyAdmins(row, data)]);

    if (!res.ok) {
      console.error("[booking-confirm] Resend responded with", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[booking-confirm] failed to send:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
