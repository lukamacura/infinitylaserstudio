/**
 * A database client that acts as the signed-in admin who called the route
 * (Authorization: Bearer <their access token>). Every read and write goes
 * through the same row policies and admin checks as the admin panel itself -
 * nothing here bypasses them. Server-only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export type AdminDb = SupabaseClient<Database>;

/** The caller's token, or null when the request carries none. */
export function bearerToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

/** A client acting as the token's user, or null when the server is not configured. */
export function dbForToken(token: string): AdminDb | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("[admin-db] Supabase env vars not set");
    return null;
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * The admin's client, or why not: "forbidden" for a missing, expired or
 * non-admin session, "config" when the server lacks its env vars.
 */
export async function adminDb(req: NextRequest): Promise<{ db: AdminDb } | { error: "forbidden" | "config" }> {
  const token = bearerToken(req);
  if (!token) return { error: "forbidden" };
  const db = dbForToken(token);
  if (!db) return { error: "config" };
  const { data, error } = await db.rpc("is_admin");
  if (error || data !== true) return { error: "forbidden" };
  return { db };
}
