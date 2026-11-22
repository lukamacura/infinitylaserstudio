/**
 * The password in front of /paketici while it is being tested. Server-only:
 * the password never reaches the browser. A correct password sets an
 * httpOnly cookie holding a token derived from it (not the password itself),
 * checked by the page and by POST /api/paketici. Remove this file and its
 * three callers (page.tsx, actions.ts, api route) to open the page to everyone.
 *
 * The repo is public, so the password is not written here - only its SHA-256.
 * PAKETICI_PASSWORD (Vercel env) replaces it; changing it logs everyone out.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PAKETICI_COOKIE = "pk_access";
/** 30 days - testers don't have to type it again every visit. */
export const PAKETICI_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** SHA-256 of the password given on 2026-11-22. */
const DEFAULT_PASSWORD_SHA256 = "b822f1cd2dcfc685b47e83e3980289fd5d8e3ff3a82def24d7d1d68bb272eb32";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function passwordHash(): Buffer {
  const env = process.env.PAKETICI_PASSWORD;
  return env ? sha256(env) : Buffer.from(DEFAULT_PASSWORD_SHA256, "hex");
}

export function isPaketiciPassword(given: string): boolean {
  return timingSafeEqual(sha256(given), passwordHash());
}

/** What the cookie holds: derived from the password, so a new password ends old cookies. */
export function paketiciToken(): string {
  return createHash("sha256").update("paketici-access:").update(passwordHash()).digest("hex");
}

export async function hasPaketiciAccess(): Promise<boolean> {
  const got = (await cookies()).get(PAKETICI_COOKIE)?.value;
  if (!got) return false;
  const want = paketiciToken();
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
