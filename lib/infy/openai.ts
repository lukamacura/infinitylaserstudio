/**
 * The one call Infy makes to OpenAI: Chat Completions, with tools. Plain
 * fetch, no SDK. Server-only - the key never reaches the browser.
 *
 * Server-only env vars:
 *   OPENAI_API_KEY                    - platform.openai.com → API keys
 *   OPENAI_MODEL (optional)           - default gpt-5.4-mini
 *   OPENAI_REASONING_EFFORT (optional) - sent only when set (none / low / medium …)
 */
import type { ChatMessage, ToolCall } from "./types";

export const DEFAULT_MODEL = "gpt-5.4-mini";

export type SystemMessage = { role: "system"; content: string };
export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type CompletionResult =
  | { ok: true; content: string | null; toolCalls: ToolCall[] }
  | { ok: false; error: "config" | "http" | "timeout" | "network" };

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function chatCompletion(opts: {
  messages: (SystemMessage | ChatMessage)[];
  tools?: ToolSpec[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<CompletionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "config" };
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim();

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        messages: opts.messages,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto", parallel_tool_calls: true } : {}),
        max_completion_tokens: opts.maxTokens ?? 1200,
        ...(effort ? { reasoning_effort: effort } : {}),
        // Not kept by OpenAI for later use in their own apps (the API default, said out loud).
        store: false,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    console.error("[infy] OpenAI request failed:", err);
    return { ok: false, error: timeout ? "timeout" : "network" };
  }

  if (!res.ok) {
    console.error("[infy] OpenAI responded with", res.status, (await res.text().catch(() => "")).slice(0, 500));
    return { ok: false, error: "http" };
  }
  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    usage?: {
      prompt_tokens?: number; completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  } | null;
  // One line per call in the server log (Vercel → Logs, search "[infy] tokens"):
  // what each answer really cost. cached = input billed at a tenth.
  const u = body?.usage;
  if (u) {
    console.info(
      `[infy] tokens in=${u.prompt_tokens ?? 0} cached=${u.prompt_tokens_details?.cached_tokens ?? 0}` +
      ` out=${u.completion_tokens ?? 0} reasoning=${u.completion_tokens_details?.reasoning_tokens ?? 0}`,
    );
  }
  const message = body?.choices?.[0]?.message;
  if (!message) return { ok: false, error: "http" };
  return {
    ok: true,
    content: typeof message.content === "string" ? message.content : null,
    toolCalls: (message.tool_calls ?? []).filter((c) => c?.type === "function" && c.function?.name),
  };
}
