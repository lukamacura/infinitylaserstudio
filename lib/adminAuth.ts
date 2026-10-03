"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Admin login: one password, verified by /api/admin-login on the server, which
 * hands back a Supabase session for the admin account. The database only lets
 * a user listed in `admin_users` read or change reservations (see
 * sql/secure_booking_phase1.sql) - nothing secret lives in the browser bundle.
 *
 * The finance panel has its own password (FINANCE_PASSWORD): an admin session
 * alone does not open it, it must be unlocked once per browser session.
 */
export type AdminPanel = "admin" | "finances";

const FINANCE_UNLOCK_KEY = "ils-finances-unlocked";

function financeUnlocked(): boolean {
  try { return sessionStorage.getItem(FINANCE_UNLOCK_KEY) === "1"; } catch { return false; }
}

function setFinanceUnlocked(on: boolean) {
  try {
    if (on) sessionStorage.setItem(FINANCE_UNLOCK_KEY, "1");
    else sessionStorage.removeItem(FINANCE_UNLOCK_KEY);
  } catch { /* storage blocked - the panel just asks again */ }
}

export function useAdminAuth(panel: AdminPanel = "admin") {
  /** null = still checking the saved session. */
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function check(hasSession: boolean) {
      if (!hasSession) {
        if (active) setAuthenticated(false);
        return;
      }
      if (panel === "finances" && !financeUnlocked()) {
        if (active) setAuthenticated(false);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      if (active) setAuthenticated(data === true);
    }

    supabase.auth.getSession().then(({ data }) => check(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setFinanceUnlocked(false); setAuthenticated(false); }
      else if (event === "SIGNED_IN") void check(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [panel]);

  /** Returns an error message, or null on success. */
  async function signIn(password: string): Promise<string | null> {
    // The password is checked on the server (ADMIN_PASSWORD, or
    // FINANCE_PASSWORD for the finance panel), which answers with a session
    // for the admin account.
    let res: Response;
    try {
      res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, panel }),
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
    if (panel === "finances") setFinanceUnlocked(true);
    setAuthenticated(true);
    return null;
  }

  async function signOut() {
    setFinanceUnlocked(false);
    await supabase.auth.signOut();
    setAuthenticated(false);
  }

  return { authenticated, signIn, signOut };
}
