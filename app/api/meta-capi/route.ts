import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const PIXEL_ID = "924353527086297";
const API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase());
}

function hashPhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, "");
  return sha256(digits);
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: NextRequest) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 500 });
  }

  const body = await req.json() as {
    event_name: string;
    event_id: string;
    event_source_url: string;
    email?: string;
    phone?: string;
    value?: number;
    currency?: string;
  };

  const { event_name, event_id, event_source_url, email, phone, value, currency } = body;

  if (!event_name || !event_id) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  // Read client info from incoming request headers
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");
  const cookieHeader = req.headers.get("cookie");
  const fbc = getCookie(cookieHeader, "_fbc");
  const fbp = getCookie(cookieHeader, "_fbp");

  // Build user_data — only include fields we actually have
  const userData: Record<string, string | string[]> = {};
  if (email) userData.em = [hashEmail(email)];
  if (phone) userData.ph = [hashPhone(phone)];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const eventPayload = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: event_source_url ?? "https://infinitylaserstudio.rs",
    event_id,
    user_data: userData,
    ...(value != null && currency
      ? { custom_data: { value: value.toFixed(2), currency } }
      : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [eventPayload] }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      console.error("[meta-capi] Meta API error:", json);
      return NextResponse.json({ ok: false, error: json }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: json });
  } catch (err) {
    console.error("[meta-capi] fetch failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
