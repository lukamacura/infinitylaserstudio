import { NextRequest, NextResponse } from "next/server";
import { isLocationId } from "@/lib/locations";
import { adminDb } from "@/lib/server/adminDb";
import { cleanHistory, runAgent } from "@/lib/infy/agent";
import { aiConfigured } from "@/lib/infy/openai";
import { belgradeMinutes, belgradeToday } from "@/lib/infy/time";
import type { ChatResponse } from "@/lib/infy/types";

/**
 * One message to Infy. Body: { message, history, location, page }.
 * history is what this route answered last time (the panel keeps it).
 * Infy reads and proposes through its tools as the signed-in admin; the
 * answer carries its reply and any cards (proposal sheets, call-list notes).
 */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await adminDb(req);
  if ("error" in auth) {
    const res: ChatResponse = { ok: false, error: auth.error };
    return NextResponse.json(res, { status: auth.error === "forbidden" ? 401 : 500 });
  }
  if (!aiConfigured()) {
    const res: ChatResponse = { ok: false, error: "config" };
    return NextResponse.json(res, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const rawMessage = body?.message;
  const message = typeof rawMessage === "string" ? rawMessage.trim().slice(0, 2000) : "";
  if (!message) {
    const res: ChatResponse = { ok: false, error: "invalid_input" };
    return NextResponse.json(res, { status: 400 });
  }
  const rawPage = body?.page;
  const page = typeof rawPage === "string" ? rawPage.slice(0, 60) : "/admin";

  const now = new Date();
  const location = body?.location;
  const result = await runAgent(
    {
      db: auth.db,
      today: belgradeToday(now),
      nowMinute: belgradeMinutes(now),
      location: isLocationId(location) ? location : "novi_sad",
      cards: [],
      cache: new Map(),
    },
    cleanHistory(body?.history),
    message,
    page,
  );

  if (!result.ok) {
    const res: ChatResponse = { ok: false, error: result.error };
    return NextResponse.json(res, { status: 502 });
  }
  const res: ChatResponse = { ok: true, reply: result.reply, cards: result.cards, history: result.history };
  return NextResponse.json(res);
}
