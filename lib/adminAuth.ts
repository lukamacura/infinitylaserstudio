"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Admin login: one password, verified by /api/admin-login on the server, which
 * hands back a Supabase session for the admin account. The database only lets
 * a user listed in `admin_users` read or change reservations (see
 * sql/secure_booking_phase1.sql) - nothing secret lives in the browser bundle.
 */
export function useAdminAuth() {
  /** null = still checking the saved session. */
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function check(hasSession: boolean) {
      if (!hasSession) {
        if (active) setAuthenticated(false);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      if (active) setAuthenticated(data === true);
    }

    supabase.auth.getSession().then(({ data }) => check(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setAuthenticated(false);
      else if (event === "SIGNED_IN") void check(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Returns an error message, or null on success. */
  async function signIn(password: string): Promise<string | null> {
    // The password is checked on the server (ADMIN_PASSWORD env var), which
    // answers with a session for the admin account.
    let res: Response;
    try {
      res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      return "Nema veze sa serverom. Proverite internet i pokušajte ponovo.";
    }
    const body = (await res.json().catch(() => null)) as
      | { ok: true; access_token: string; refresh_token: string }
      | { ok: false; error: string }
      | null;
    if (!body || !body.ok) {
      if (body?.error === "wrong_password") return "Neispravna lozinka.";
      return "Prijava trenutno nije moguća. Pokušajte ponovo.";
    }
    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (error) return "Prijava trenutno nije moguća. Pokušajte ponovo.";
    const { data } = await supabase.rpc("is_admin");
    if (data !== true) {
      await supabase.auth.signOut();
      return "Ovaj nalog nema admin pristup.";
    }
    setAuthenticated(true);
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthenticated(false);
  }

  return { authenticated, signIn, signOut };
}
