/**
 * Infy's conversation: the instructions, and the loop that lets the model call
 * tools until it has an answer. Server-only.
 */
import { getLocation } from "@/lib/locations";
import { chatCompletion, type SystemMessage } from "./openai";
import { PROPOSAL_TOOLS, TOOL_SPECS, calendarLines, runTool, type Fail, type ToolContext } from "./tools";
import { fromMinutes, longDay, relativeDay } from "./time";
import type { ChatMessage, InfyCard, ToolCall } from "./types";

/** Model rounds per message - a booking takes about four (find, price list, free times, proposal). */
const MAX_ROUNDS = 7;

// What is sent of earlier turns. Every model round re-sends all of it, so this
// is what decides the cost of a long conversation:
/** The latest turns keep their tool calls and answers (ids, free times) for follow-ups like "može 17:40". */
const FULL_TURNS = 2;
/** Older turns keep only the words: the staff's message, Infy's reply, notes about the cards. */
const MAX_TURNS = 12;
/** About 7-8k tokens; past it, the oldest turns go first. */
const MAX_HISTORY_CHARS = 24_000;

/**
 * The instructions, the same all day: today's date and the calendar, no clock.
 * Together with the tool list they open every request unchanged, so OpenAI
 * bills them as cached input (a tenth of the price) after the first message.
 */
function systemPrompt(ctx: ToolContext): string {
  return `Ti si Infy, asistent osoblja u Infinity Laser Studiju (lasersko uklanjanje dlačica; studiji Novi Sad - dva lasera - i Sombor - jedan laser).
Pišeš osoblju (doktorki, recepciji) u admin panelu: kratko, toplo, jasno, srpski latinicom, "ti" forma.
Ti si devojka (tako izgleda tvoja ilustracija): o sebi govoriš u ženskom rodu - "zapisala sam", "pogledala sam".

Danas je ${longDay(ctx.today)} (${ctx.today}). Tačno vreme, studio otvoren u adminu i stranica stoje u napomeni odmah pre poslednje poruke osoblja.
Kalendar (koristi ga za "sutra", "u četvrtak", "sledeće nedelje"):
${calendarLines(ctx.today)}

LASERI
- Novi Sad ima dva lasera: Stari i Novi. Svaki ima svoje radno vreme i svoje termine - dva klijenta mogu u isto vreme, svako na svom laseru. Sombor ima jedan laser.
- Vreme je slobodno kad bar jedan laser tada radi i nema termin. slobodni_termini i predlozi to već računaju po laserima - ti ne računaš sama.
- Laser navodiš (laser u slobodni_termini, predlog_zakazivanja, predlog_pomeranja) samo kad osoblje traži određeni ("na Novom", "na starom laseru"). Inače ga izostavi - server bira laser koji tada radi, Stari pre Novog.
- "Prebaci X na Novi" (isto vreme) → predlog_pomeranja sa istim datumom i vremenom i laser.
- Na kom je laseru termin piše u polju laser (raspored_dana, pronadji_osobu, karton); radno vreme svakog lasera u "laseri" (raspored_dana) i u radno_vreme (slobodni_termini). Laser pominji kad pitaju ili kad je bitan.

PRAVILA
- Nikad ne izmišljaj: imena, termine, cene, brojeve i id-jeve uzimaš samo iz alata. Ako nešto ne znaš, pozovi alat ili pitaj.
- Zakazivanje, pomeranje i otkazivanje: SAMO kroz predlog_zakazivanja / predlog_pomeranja / predlog_otkazivanja. To pravi papir sa predlogom; ništa nije urađeno dok osoblje ne pritisne "Potvrdi" na papiru. Nikad ne piši da je zakazano/pomereno/otkazano.
- Papir postoji SAMO kad je predlog_* u ovom odgovoru vratio ok: true - tek tada napiši "Proveri papir i potvrdi." Ako je vratio greska (papir_napravljen: false), papira NEMA: reci kratko zašto i ponudi vremena iz najbliza_slobodna.
- Pre predloga zakazivanja: nađi osobu (pronadji_osobu) i uzmi id-jeve usluga (usluge), PA TEK ONDA slobodni_termini sa usluge_ids i novi_klijent - bez usluga trajanje nije tačno. Ako ima više osoba sa istim imenom ili više termina, pitaj koju/koji - ne pogađaj.
- Vreme za predlog uzimaš samo iz slobodni_termini (termini, prvi_slobodan) ili iz najbliza_slobodna. Nikad ga ne računaš sam: kraj zauzetog termina nije slobodno vreme, sledeći termin često počinje odmah tada.
- "Najbliži / prvi slobodan termin" = prvi_slobodan; za njega odmah napravi predlog. Ako osoblje nije reklo vreme, ponudi 2-4 slobodna i pitaj. Ako je reklo vreme koje je zauzeto, reci i ponudi najbliža slobodna.
- Studio: ako nije rečen, važi otvoreni studio; za klijenta sa kartonom pogledaj gde je dolazio.
- Kad osoblje javi nešto o osobi koja se javila (Instagram, Facebook, Viber, telefon) - npr. "Ana Martić je rekla na IG javiću vam se" - upiši je sa zapisi_upit (izvor iz poruke, kratka beleška). Ako nije rečen dan, podsetnik je za 3 dana. Ako je osoba već na spisku, ažuriraj je umesto novog upisa.
- "Javila sam se Ani", "poslala sam poruku" → azuriraj_upit sa javio_se=true. "Zakazala se" → status booked. "Ne želi" → declined.
- Potvrdni poziv novom klijentu pred prvi termin ("Nevena je potvrdila") → oznaci_poziv.
- Za "šta danas", "koga da zovem", "kako stojimo" → pregled.
- Studentski popust (student20) i ils- kodovi idu samo ako ih osoblje navede. Pakete zakazuje osoblje kroz "+ Novi termin".
- Zdravstvene beleške iz kartona pominji samo kad su bitne za pitanje.
- Odgovor: najviše nekoliko kratkih rečenica ili kratka lista sa "•". Bez tabela i markdown naslova. Datume piši kao "uto 17.11." ili "sutra", vreme kao HH:MM.`;
}

/** What changes from message to message - sent next to the new message, never kept in the history. */
function contextNote(ctx: ToolContext, page: string): SystemMessage {
  return {
    role: "system",
    content: `Sada je ${fromMinutes(ctx.nowMinute)} po beogradskom vremenu. Studio otvoren u adminu: ${getLocation(ctx.location).name} (${ctx.location}). Stranica: ${page}.`,
  };
}

/** The conversation cut at each staff message; anything before the first one is a group of its own. */
function splitTurns(history: ChatMessage[]): ChatMessage[][] {
  const turns: ChatMessage[][] = [];
  for (const m of history) {
    if (m.role === "user" || turns.length === 0) turns.push([m]);
    else turns[turns.length - 1].push(m);
  }
  return turns;
}

/** A turn without its tool work - a call and its answer always go together. */
function wordsOnly(turn: ChatMessage[]): ChatMessage[] {
  return turn.filter((m) => m.role === "user" || (m.role === "assistant" && !m.tool_calls?.length && !!m.content));
}

function turnSize(turn: ChatMessage[]): number {
  let n = 0;
  for (const m of turn) {
    n += m.content?.length ?? 0;
    if (m.role === "assistant") for (const c of m.tool_calls ?? []) n += c.function.name.length + c.function.arguments.length;
  }
  return n;
}

/**
 * The earlier turns as they are sent: the last FULL_TURNS whole, older ones
 * as words only, the oldest dropped past MAX_TURNS / MAX_HISTORY_CHARS.
 * Infy asks its tools again for anything it no longer sees (the prompt says
 * ids come only from tools), so nothing is guessed.
 */
export function compactHistory(history: ChatMessage[]): ChatMessage[] {
  const turns = splitTurns(history).slice(-MAX_TURNS);
  const kept = turns.map((t, i) => (i < turns.length - FULL_TURNS ? wordsOnly(t) : t));
  const total = () => kept.reduce((n, t) => n + turnSize(t), 0);
  // Over the limit: the older whole turn loses its tool work first, then the oldest turns go.
  for (let i = 0; i < kept.length - 1 && total() > MAX_HISTORY_CHARS; i++) kept[i] = wordsOnly(kept[i]);
  while (kept.length > 1 && total() > MAX_HISTORY_CHARS) kept.shift();
  // One huge last turn (a long search) keeps only its words too.
  if (kept.length && total() > MAX_HISTORY_CHARS * 2) kept[kept.length - 1] = wordsOnly(kept[kept.length - 1]);
  return kept.flat();
}

/** Only well-formed messages from the panel - anything else is dropped. */
export function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw.slice(-80)) {
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    const content = msg.content;
    if (msg.role === "user" && typeof content === "string") {
      out.push({ role: "user", content: content.slice(0, 4000) });
    } else if (msg.role === "assistant") {
      const rawCalls: unknown[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      const calls: ToolCall[] = [];
      for (const c of rawCalls) {
        const call = c as { id?: unknown; function?: { name?: unknown; arguments?: unknown } } | null;
        const id = call?.id;
        const name = call?.function?.name;
        const args = call?.function?.arguments;
        if (typeof id === "string" && typeof name === "string" && typeof args === "string") {
          calls.push({ id, type: "function", function: { name, arguments: args.slice(0, 8000) } });
        }
      }
      out.push({
        role: "assistant",
        content: typeof content === "string" ? content.slice(0, 8000) : null,
        ...(calls.length ? { tool_calls: calls } : {}),
      });
    } else if (msg.role === "tool" && typeof msg.tool_call_id === "string" && typeof content === "string") {
      out.push({ role: "tool", tool_call_id: String(msg.tool_call_id), content: content.slice(0, 12_500) });
    }
  }
  // Every tool answer must follow its call, and every call must have an answer.
  const answered = new Set(out.filter((m) => m.role === "tool").map((m) => (m as { tool_call_id: string }).tool_call_id));
  const asked = new Set<string>();
  const valid: ChatMessage[] = [];
  for (const m of out) {
    if (m.role === "assistant" && m.tool_calls?.length) {
      if (!m.tool_calls.every((c) => answered.has(c.id))) continue;
      m.tool_calls.forEach((c) => asked.add(c.id));
    }
    if (m.role === "tool" && !asked.has(m.tool_call_id)) continue;
    valid.push(m);
  }
  return valid;
}

export type AgentResult =
  | { ok: true; reply: string; cards: InfyCard[]; history: ChatMessage[] }
  | { ok: false; error: "ai" | "config" };

/** "Proveri papir", "spremila sam papir", "papir je spreman"… - the reply says a sheet is waiting. */
const CLAIMS_PAPER =
  /\b(proveri|pogledaj)\s+papir|\b(sprem|naprav|priprem)il[ao]\s+sam\s+(ti\s+)?papir|\bpapir\s+(je\s+)?(spreman|prikazan|gotov)|\bpotvrdi\s+na\s+papiru/i;

/** What a refused proposal answered, if the tool's JSON says so. */
function refusal(answer: string): Fail | null {
  try {
    const o = JSON.parse(answer) as Partial<Fail> | null;
    return o && typeof o.greska === "string" ? (o as Fail) : null;
  } catch {
    return null;
  }
}

/** The honest answer when Infy keeps saying a sheet is ready that was refused. */
function noPaperReply(f: Fail, today: string): string {
  const free = (f.najbliza_slobodna ?? []).map((s) => `${relativeDay(s.datum, today)} ${s.vreme}`);
  return `Papir nije napravljen: ${f.greska}` +
    (free.length ? `\nNajbliže slobodno: ${free.join(", ")}. Koje da spremim?` : "");
}

export async function runAgent(ctx: ToolContext, history: ChatMessage[], message: string, page: string): Promise<AgentResult> {
  const system: SystemMessage = { role: "system", content: systemPrompt(ctx) };
  const earlier = compactHistory(history);
  const note = contextNote(ctx, page);
  const turn: ChatMessage[] = [{ role: "user", content: message }];
  /** The last proposal of this turn that the server refused. */
  let refused: Fail | null = null;
  /** A server note sent once, when a reply speaks of a sheet that does not exist; where in the turn it goes. */
  let correction: { at: number; msg: SystemMessage } | null = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // The last round may not call tools: it has to answer with what it has.
    const last = round === MAX_ROUNDS - 1;
    const now = correction
      ? [...turn.slice(0, correction.at), correction.msg, ...turn.slice(correction.at)]
      : turn;
    const res = await chatCompletion({
      // Unchanged first (instructions, earlier turns), then what is new - each
      // round only adds at the end, so the start is billed as cached input.
      messages: [system, ...earlier, note, ...now],
      tools: last ? undefined : TOOL_SPECS,
      maxTokens: 1500,
      timeoutMs: 25_000,
    });
    if (!res.ok) return { ok: false, error: res.error === "config" ? "config" : "ai" };

    if (res.toolCalls.length === 0) {
      let reply = (res.content ?? "").trim() || "Tu sam. Šta treba?";
      // A sheet exists only when a proposal of this turn went through. A reply
      // saying otherwise is not shown: the model is told once and answers
      // again (it may still make the proposal); if it insists, the refusal
      // itself is shown instead.
      const paperless = !ctx.cards.some((c) => c.type === "proposal") && CLAIMS_PAPER.test(reply);
      if (paperless && !correction && !last) {
        correction = {
          at: turn.length,
          msg: {
            role: "system",
            content: "Napomena servera: tvoj odgovor kaže da papir postoji, ali u ovom odgovoru nijedan predlog nije uspeo - papira NEMA. " +
              (refused ? `Poslednji predlog je odbijen: ${refused.greska} ` : "Predlog nije ni pozvan. ") +
              "Napravi ispravan predlog alatom (vreme samo iz slobodni_termini ili najbliza_slobodna) ili napiši osoblju šta nije uspelo i ponudi slobodna vremena. Ne piši da je papir spreman ako ga nema.",
          },
        };
        continue;
      }
      if (paperless && refused) reply = noPaperReply(refused, ctx.today);
      turn.push({ role: "assistant", content: reply });
      // The panel keeps the compacted history, so it never grows past the limits either.
      return { ok: true, reply, cards: ctx.cards, history: [...earlier, ...turn] };
    }

    turn.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls });
    const answers = await Promise.all(res.toolCalls.map((c) => runTool(ctx, c.function.name, c.function.arguments)));
    for (const [i, c] of res.toolCalls.entries()) {
      turn.push({ role: "tool", tool_call_id: c.id, content: answers[i] });
      if (PROPOSAL_TOOLS.has(c.function.name)) refused = refusal(answers[i]) ?? refused;
    }
  }
  return { ok: false, error: "ai" };
}
