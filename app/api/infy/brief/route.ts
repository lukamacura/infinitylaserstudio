import { NextRequest, NextResponse } from "next/server";
import { getLocation } from "@/lib/locations";
import { adminDb } from "@/lib/server/adminDb";
import { loadFacts, loadStudioLoads, pct } from "@/lib/infy/brief";
import { chatCompletion } from "@/lib/infy/openai";
import { belgradeToday, longDay, shortDay } from "@/lib/infy/time";
import type { Brief, InfyFacts, StudioLoad } from "@/lib/infy/types";

/**
 * Infy's brief for the admin: the facts (database), the calendar's shape, and
 * two or three sentences about the day written by the AI from those facts
 * only. Without an answer from OpenAI the sentences are a plain summary -
 * the brief itself never depends on the AI. Admin session required.
 */
export const maxDuration = 30;

function studio(loc: string): string {
  return loc === "novi_sad" || loc === "sombor" ? getLocation(loc).name : loc;
}

/** The plain summary, also what the AI gets told not to go beyond. */
function plainHeadline(f: InfyFacts, loads: StudioLoad[]): string {
  const parts: string[] = [];
  const today = f.today.filter((t) => t.n > 0);
  parts.push(today.length
    ? `Danas ${today.map((t) => `${studio(t.location)} ${t.n} ${t.n === 1 ? "termin" : "termina"}, prvi u ${t.first_start}`).join(" · ")}.`
    : "Danas nema zakazanih termina.");
  const toCall = f.calls.length + f.upiti_due.length;
  if (toCall) parts.push(`Za javljanje: ${toCall}.`);
  if (f.booked_total) parts.push(`Od juče zakazano ${f.booked_total} (${f.booked_online} sa sajta).`);
  const gaps = loads.flatMap((s) => s.days.filter((d) => d.gaps.length).map(() => 1)).length;
  if (gaps) parts.push(`Rupa u kalendaru narednih dana: ${gaps}.`);
  return parts.join(" ");
}

/** What the AI sees - numbers and names only, nothing from the cards. */
function factsForAi(f: InfyFacts, loads: StudioLoad[]) {
  return {
    danas: longDay(f.today_date),
    termini_danas: f.today.map((t) => ({ studio: studio(t.location), broj: t.n, prvi: t.first_start, poslednji_kraj: t.last_end })),
    potvrdni_pozivi_novim_klijentima: f.calls.map((c) => `${c.name} (${shortDay(c.date)} ${c.start}, ${studio(c.location)})`),
    follow_up_upiti: f.upiti_due.map((u) => `${u.name} (${u.source})`),
    zakazano_od_juce: { ukupno: f.booked_total, sa_sajta: f.booked_online },
    upiti_koji_su_se_zakazali: f.upiti_booked.map((u) => u.name),
    otkazali_preko_linka: f.client_cancels.map((c) => `${c.name} ${shortDay(c.date)} ${c.start}`),
    klijenti_za_vracanje: f.return_total,
    popunjenost_7_dana: loads.map((s) => ({
      studio: studio(s.location),
      ukupno: pct(s.booked, s.open),
      rupe: s.days.flatMap((d) => d.gaps.map((g) => `${shortDay(d.date)} ${g.start}–${g.end}`)).slice(0, 6),
      dani_bez_osoblja: s.days.filter((d) => d.noStaff).map((d) => shortDay(d.date)),
    })),
  };
}

async function aiHeadline(f: InfyFacts, loads: StudioLoad[]): Promise<string | null> {
  const res = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "Ti si Infy, asistent osoblja Infinity Laser Studija. Iz datih činjenica napiši jutarnji pregled za osoblje: " +
          "2-3 kratke rečenice, srpski latinicom, toplo i konkretno, \"ti\" forma; o sebi u ženskom rodu. " +
          "Prvo najvažnije što treba uraditi (koga pozvati / kome pisati), pa kakav je dan, pa jedna rupa ili upozorenje ako postoji. " +
          "Koristi samo date brojeve i imena - ništa ne izmišljaj, ne ponavljaj sve. Bez pozdrava na kraju, bez emodžija osim najviše jednog.",
      },
      { role: "user", content: JSON.stringify(factsForAi(f, loads)) },
    ],
    maxTokens: 300,
    timeoutMs: 9_000,
  });
  if (!res.ok || !res.content?.trim()) return null;
  return res.content.trim().slice(0, 600);
}

export async function POST(req: NextRequest) {
  const auth = await adminDb(req);
  if ("error" in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === "forbidden" ? 401 : 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { ai?: unknown };

  let facts: InfyFacts;
  let loads: StudioLoad[];
  try {
    [facts, loads] = await Promise.all([loadFacts(auth.db), loadStudioLoads(auth.db)]);
  } catch (err) {
    console.error("[infy-brief] load failed:", err);
    return NextResponse.json({ ok: false, error: "db" }, { status: 502 });
  }

  const ai = body.ai === false ? null : await aiHeadline(facts, loads);
  const brief: Brief = {
    today: belgradeToday(),
    facts,
    studios: loads,
    headline: ai ?? plainHeadline(facts, loads),
    ai: ai !== null,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json({ ok: true, brief });
}
