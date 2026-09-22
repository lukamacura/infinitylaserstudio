import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Admin login: one password, checked here on the server - it never ships in
 * the browser bundle. On success the browser gets a Supabase session for the
 * admin account, and the database only lets that account (listed in
 * `admin_users`) read or change reservations.
 *
 * Server-only env vars (never NEXT_PUBLIC_):
 *   ADMIN_PASSWORD             - the admin panel password
 *   SUPABASE_SERVICE_ROLE_KEY  - Supabase → Settings → API keys → service_role
 *   ADMIN_EMAIL (optional)     - internal account name, no email is ever sent
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@infinitylaserstudio.rs";

function passwordMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Admin auth user id - created (and whitelisted) on the first login. */
async function ensureAdminUser(admin: SupabaseClient<Database>): Promise<string> {
  const created = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true });
  let userId = created.data.user?.id;
  if (!userId) {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      userId = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())?.id;
      if (data.users.length < 100) break;
    }
  }
  if (!userId) throw new Error("admin user could not be created");

  const { error } = await admin
    .from("admin_users")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
  return userId;
}

export async function POST(req: NextRequest) {
  const expected   = process.env.ADMIN_PASSWORD;
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || !url || !anonKey || !serviceKey) {
    console.error("[admin-login] ADMIN_PASSWORD / SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch { /* empty body → wrong password */ }

  if (!passwordMatches(password, expected)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false, error: "wrong_password" }, { status: 401 });
  }

  try {
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient<Database>(url, serviceKey, opts);
    await ensureAdminUser(admin);

    // One-time login token for the admin account (nothing is emailed),
    // exchanged right away for a session the browser can use.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL,
    });
    if (linkErr || !link.properties?.hashed_token) throw linkErr ?? new Error("no token");

    const anon = createClient(url, anonKey, opts);
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (verifyErr || !verified.session) throw verifyErr ?? new Error("no session");

    return NextResponse.json({
      ok: true,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    });
  } catch (err) {
    console.error("[admin-login] failed:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
