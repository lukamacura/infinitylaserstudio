/**
 * The client's own cancellation: the signed "Otkaži termin" link in the
 * emails, and the database call behind /otkazivanje. Server-only.
 *
 * The link is the reservation id plus a signature of it (HMAC-SHA256, keyed
 * with SUPABASE_SERVICE_ROLE_KEY - the one secret every server route already
 * has). So only the email the studio sent can cancel that appointment, and a
 * guessed or changed id is refused. Changing that key turns old links into
 * "link nije ispravan" - the page then shows the phone number.
 *
 * Opening the link only shows the appointment. It is cancelled when the
 * client presses the button (POST /api/reservation-cancel) - mail scanners
 * open every link in an email on their own and must not cancel anything.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SITE_URL } from "@/lib/email/layout";

export const CANCEL_PATH = "/otkazivanje";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function sign(id: string, key: string): string {
  // 128 bits of the HMAC is plenty for a link nobody can try a billion times.
  return createHmac("sha256", key).update(`ils-cancel:${id.toLowerCase()}`).digest("base64url").slice(0, 22);
}

/** The full "Otkaži termin" link for a reservation, or null when the server has no key. */
export function cancelUrl(id: string): string | null {
  const key = secret();
  if (!key || !UUID_RE.test(id)) return null;
  return `${SITE_URL}${CANCEL_PATH}?r=${id.toLowerCase()}&k=${sign(id, key)}`;
}

/** True only for a link this server signed. */
export function isValidCancelLink(id: unknown, token: unknown): id is string {
  const key = secret();
  if (!key || typeof id !== "string" || typeof token !== "string") return false;
  if (!UUID_RE.test(id) || !TOKEN_RE.test(token)) return false;
  return timingSafeEqual(Buffer.from(sign(id, key)), Buffer.from(token));
}

/** What `client_cancel_reservation` answers (sql/client_cancel.sql). */
export type CancelInfo = {
  id: string;
  customer_name: string;
  customer_email: string;
  location: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  start_time: string;
  end_time: string;
  total_duration: number;
  services: string[];
};

export type CancelResult =
  /** Can be cancelled - `late`: less than 24 h to go, 50% at the next visit. */
  | (CancelInfo & { status: "open"; late: boolean })
  /** Just cancelled by this call. */
  | (CancelInfo & { status: "cancelled"; late: boolean })
  /** Was cancelled before (this link, or the studio). */
  | (CancelInfo & { status: "already"; late: boolean })
  /** Already started or over. */
  | (CancelInfo & { status: "past" })
  /** Blacklisted - nothing for the client to cancel. */
  | (CancelInfo & { status: "inactive" })
  | { status: "not_found" };

/**
 * Looks the appointment up (`confirm` false) or cancels it (`confirm` true).
 * The 24 h and every write happen in the database, in one transaction.
 * null = the database could not be reached; the caller says "try again".
 */
export async function clientCancel(id: string, confirm: boolean): Promise<CancelResult | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = secret();
  if (!url || !key) {
    console.error("[cancel] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("client_cancel_reservation", { p_id: id, p_confirm: confirm });
  if (error || !data || typeof data !== "object") {
    console.error("[cancel] client_cancel_reservation failed:", error);
    return null;
  }
  const result = data as unknown as CancelResult;
  if (result.status !== "not_found") {
    result.services = Array.isArray(result.services) ? result.services.filter((s) => typeof s === "string") : [];
  }
  return result;
}
