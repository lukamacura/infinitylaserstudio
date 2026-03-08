import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json({ ok: false });
  }

  try {
    const payload: unknown = await req.json();

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Booking-Secret": process.env.N8N_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[booking-confirm] n8n responded with status", res.status);
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[booking-confirm] failed to forward to n8n:", err);
    return NextResponse.json({ ok: false });
  }
}
