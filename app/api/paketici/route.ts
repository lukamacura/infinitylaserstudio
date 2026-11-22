import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CARD_PAYMENTS_ON, describeGift, quoteGift,
  type Delivery, type GiftMode, type GiftVersion, type Occasion, type Payment,
} from "@/lib/paketici";
import { loadGiftCatalog, loadGiftStock } from "@/lib/server/paketici";
import { hasPaketiciAccess } from "@/lib/server/paketiciAccess";
import { sendClientEmail } from "@/lib/email/send";
import { giftEmailHtml, giftEmailSubject, giftEmailText, type GiftOrderEmail } from "@/lib/email/paketiciEmail";

/**
 * Gift-box orders from /paketici.
 *   GET  → how many boxes are left.
 *   POST → saves one order. The price is recomputed here from today's Novi Sad
 *          prices; if it differs from what the buyer saw, nothing is saved and
 *          the new total is returned. The 50-box limit is enforced in the
 *          database (sql/paketici.sql, create_gift_order).
 *
 * Server-only env vars: SUPABASE_SERVICE_ROLE_KEY (to save), RESEND_API_KEY +
 * RESEND_FROM (email), BOOKING_NOTIFY_EMAIL (the studio's copy),
 * N8N_PAKETICI_WEBHOOK_URL (optional - posts the order to the admin group).
 */

export async function GET() {
  const stock = await loadGiftStock();
  return NextResponse.json(stock ?? { total: null, remaining: null }, {
    headers: { "Cache-Control": "no-store" },
  });
}

const VERSIONS: GiftVersion[] = ["zenska", "muska"];
const MODES: GiftMode[] = ["iznos", "regije", "paket"];
const DELIVERIES: Delivery[] = ["novi_sad", "posta", "studio"];
const OCCASIONS: Occasion[] = ["nova_godina", "rodjendan", "bez"];
const PAYMENTS: Payment[] = ["pouzece", "kartica"];

function oneOf<T extends string>(v: unknown, list: T[]): T | null {
  return typeof v === "string" && (list as string[]).includes(v) ? (v as T) : null;
}

/** Trimmed text, "" when missing; null when too long. */
function text(v: unknown, max: number): string | null {
  if (v == null) return "";
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\r\n/g, "\n");
  return t.length > max ? null : t;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9 ()/.-]{6,30}$/;

function bad(field: string) {
  return NextResponse.json({ ok: false, error: "invalid", field }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // While /paketici is behind its password, so are its orders.
  if (!(await hasPaketiciAccess())) return NextResponse.json({ ok: false, error: "locked" }, { status: 403 });

  let b: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    b = body as Record<string, unknown>;
  } catch {
    return bad("body");
  }

  // Bots fill every field; people never see this one.
  if (typeof b.website === "string" && b.website.trim() !== "") return bad("body");

  const version = oneOf(b.version, VERSIONS);
  const mode = oneOf(b.mode, MODES);
  const delivery = oneOf(b.delivery, DELIVERIES);
  const occasion = oneOf(b.occasion, OCCASIONS);
  const payment = oneOf(b.payment, PAYMENTS);
  if (!version) return bad("version");
  if (!mode) return bad("mode");
  if (!delivery) return bad("delivery");
  if (!occasion) return bad("occasion");
  if (!payment || (payment === "kartica" && !CARD_PAYMENTS_ON)) return bad("payment");

  const name = text(b.name, 120);
  const phone = text(b.phone, 30);
  const email = text(b.email, 200);
  const address = text(b.address, 200);
  const city = text(b.city, 100);
  const postal = text(b.postal_code, 12);
  const note = text(b.delivery_note, 300);
  const dedication = text(b.dedication, 300);

  if (!name || name.length < 2) return bad("name");
  if (!phone || !PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 6) return bad("phone");
  if (email === null || (email && !EMAIL_RE.test(email))) return bad("email");
  if (address === null || city === null || postal === null || note === null || dedication === null) return bad("body");
  if (delivery !== "studio" && address.length < 3) return bad("address");
  if (delivery === "posta" && (city.length < 2 || postal.length < 4)) return bad(city.length < 2 ? "city" : "postal_code");

  // ── Price, from the database ───────────────────────────────────────────────
  const catalog = await loadGiftCatalog();
  if (!catalog) return NextResponse.json({ ok: false, error: "prices" }, { status: 502 });

  const regionIds = Array.isArray(b.region_ids)
    ? b.region_ids.filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];
  const quote = quoteGift(
    { version, mode, amount: Number(b.amount), regionIds, sessions: Number(b.sessions) },
    catalog[version],
  );
  if (!quote.ok) return bad(quote.reason);
  if (Number(b.expected_total) !== quote.total) {
    return NextResponse.json({ ok: false, error: "price", total: quote.total }, { status: 409 });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[paketici] SUPABASE_SERVICE_ROLE_KEY not set - order NOT saved");
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const summary = describeGift(mode, quote);
  const pickup = delivery === "studio";
  const { data, error } = await db.rpc("create_gift_order", {
    p: {
      version, mode, summary,
      sessions: quote.sessions,
      regions: quote.regions,
      bonus: quote.bonus?.label ?? null,
      bonus_value: quote.bonus?.value ?? null,
      total: quote.total,
      occasion, dedication, delivery, payment,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      address: pickup ? "" : address,
      city: delivery === "posta" ? city : delivery === "novi_sad" ? "Novi Sad" : "",
      postal_code: delivery === "posta" ? postal : "",
      delivery_note: pickup ? "" : note,
    },
  });
  if (error) {
    if (/sold_out/.test(error.message)) {
      return NextResponse.json({ ok: false, error: "sold_out" }, { status: 409 });
    }
    console.error("[paketici] order NOT saved:", error.message);
    return NextResponse.json({ ok: false, error: "save" }, { status: 500 });
  }
  const saved = Array.isArray(data) ? data[0] : null;
  const orderNo = Number(saved?.order_no);
  const remaining = Number(saved?.remaining);

  // ── Tell the studio (and the buyer) ────────────────────────────────────────
  // The order is already saved: a failed email must not look like a failed order.
  const mail: GiftOrderEmail = {
    orderNo, version, summary,
    bonus: quote.bonus?.label ?? null,
    total: quote.total,
    occasion, dedication, delivery, payment,
    name, phone,
    email: email || null,
    address: pickup ? null : address,
    city: delivery === "posta" ? city : null,
    postalCode: delivery === "posta" ? postal : null,
    deliveryNote: pickup ? null : note || null,
  };
  const studioInbox = process.env.BOOKING_NOTIFY_EMAIL;
  const toBuyer = !!email;
  const to = email || studioInbox;
  const tasks: Promise<unknown>[] = [];
  if (to) {
    tasks.push(sendClientEmail({
      to,
      subject: giftEmailSubject(mail, toBuyer),
      html: giftEmailHtml(mail, toBuyer),
      text: giftEmailText(mail, toBuyer),
      idempotencyKey: `paketic-${orderNo}`,
      tag: "[paketici]",
    }));
  } else {
    console.error(`[paketici] no buyer email and BOOKING_NOTIFY_EMAIL not set - order ${orderNo} emailed to nobody`);
  }
  const hook = process.env.N8N_PAKETICI_WEBHOOK_URL;
  if (hook) {
    tasks.push(
      fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Booking-Secret": process.env.N8N_WEBHOOK_SECRET ?? "" },
        body: JSON.stringify({ order_no: orderNo, ...mail, total_label: `${quote.total} RSD` }),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => console.error("[paketici] n8n not notified:", err)),
    );
  }
  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true, order_no: orderNo, remaining, total: quote.total });
}
