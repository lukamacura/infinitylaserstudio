/**
 * Infy never books, moves or cancels on its own. It proposes: the server
 * checks the proposal, works out the duration and the price, and signs exactly
 * what will be done. The paper sheet shows it, and only the staff's tap on
 * "Potvrdi" sends the signed proposal back to app/api/infy/confirm, which does
 * that and nothing else - whatever the AI says afterwards cannot change it.
 *
 * Signed with an HMAC of the service-role key (or INFY_SECRET when set), like
 * the cancel links. A proposal is good for 30 minutes. Server-only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export type BookPayload = {
  k: "book";
  /** The reservation's id, chosen now: confirming twice can't book twice. */
  id: string;
  loc: string;
  date: string;
  start: string;
  svc: string[];
  name: string;
  email: string;
  phone: string | null;
  cons: boolean;
  promo: string | null;
  notes: string | null;
  /** As priced on the sheet - for the confirmation email. */
  lines: { name: string; price: number }[];
  list: number;
  exp: number;
};
export type MovePayload = { k: "move"; id: string; date: string; start: string; exp: number };
export type CancelPayload = { k: "cancel"; id: string; reason: string | null; exp: number };
export type ProposalPayload = BookPayload | MovePayload | CancelPayload;

function key(): string | null {
  const k = process.env.INFY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return k ? `ils-infy:${k}` : null;
}

function mac(body: string, k: string): string {
  return createHmac("sha256", k).update(body).digest("base64url");
}

/** null when the server has no key to sign with. */
export function signProposal(payload: ProposalPayload): string | null {
  const k = key();
  if (!k) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, k)}`;
}

/** The proposal as signed, "expired", or null for anything this server did not sign. */
export function readProposal(token: unknown): ProposalPayload | "expired" | null {
  const k = key();
  if (!k || typeof token !== "string" || token.length > 8000) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(body, k));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: ProposalPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ProposalPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp < Date.now() ? "expired" : payload;
}
