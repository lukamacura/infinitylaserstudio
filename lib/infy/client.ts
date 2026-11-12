/**
 * The panel's side of Infy: calls to app/api/infy/* with the admin's session,
 * and the few things kept in the browser. Client-only.
 */
import { supabase } from "@/lib/supabase";
import { DEFAULT_LOCATION, isLocationId, type LocationId } from "@/lib/locations";

/** POST with the signed-in admin's token. null = no session or no connection. */
export async function infyPost<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<{ status: number; data: T | null } | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
  } catch {
    return null;
  }
}

/** The studio open in the admin (lib/adminLocation.ts keeps it in localStorage). */
export function currentLocation(): LocationId {
  try {
    const saved = window.localStorage.getItem("ils_admin_location");
    return isLocationId(saved) ? saved : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function readStore<T>(storage: "local" | "session", key: string): T | null {
  try {
    const raw = (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStore(storage: "local" | "session", key: string, value: unknown): void {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked - the panel simply forgets */ }
}

/** A short follow-up message for someone who wrote on Instagram / Facebook. */
export function followUpText(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return `Zdravo${first ? ` ${first}` : ""}, da li ste uspeli da se zakažete na našem sajtu? Ako želite, rado ćemo vam pronaći termin. 😊`;
}
