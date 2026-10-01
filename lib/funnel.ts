import { supabase } from "./supabase";
import type { LocationId } from "./locations";

/**
 * Booking-form funnel - every stage a visitor can reach, in order. Shared by
 * the form (which records them) and /fnl (which shows where people leave).
 * Keep in step with the stage list in sql/booking_funnel.sql.
 */
export const FUNNEL_STAGES = [
  { key: "open",     label: "Otvorio formu",       hint: "Kliknuo na dugme za zakazivanje" },
  { key: "studio",   label: "Izabrao studio",      hint: "Novi Sad ili Sombor" },
  { key: "gender",   label: "Izabrao pol",         hint: "Žene / muškarci (preskače se kad link već kaže pol)" },
  { key: "services", label: "Izabrao tretmane",    hint: "Označio regije i kliknuo dalje" },
  { key: "plan",     label: "Izabrao plan",        hint: "Jedan tretman ili paket" },
  { key: "day",      label: "Izabrao dan",         hint: "Kliknuo na slobodan dan" },
  { key: "time",     label: "Izabrao vreme",       hint: "Kliknuo na termin - otvorila se forma za podatke" },
  { key: "submit",   label: "Poslao podatke",      hint: "Ispravno popunio ime, email i telefon i kliknuo potvrdi" },
  { key: "booked",   label: "Zakazao termin",      hint: "Rezervacija je sačuvana" },
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number]["key"];

/** One id per browser tab, so reopening the form is still the same visitor. */
function sessionId(): string | null {
  try {
    const KEY = "ils_funnel_session";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked or no randomUUID - simply not counted
  }
}

/** Stages already sent from this tab - going back and forth sends nothing new. */
const sent = new Set<FunnelStage>();

/** Fire-and-forget. Tracking must never be able to break the booking flow. */
export function trackFunnel(stage: FunnelStage, location: LocationId | null = null) {
  try {
    if (sent.has(stage)) return;
    sent.add(stage);
    const id = sessionId();
    if (!id) return;
    void supabase
      .rpc("public_track_funnel", { p_session: id, p_stage: stage, p_location: location })
      .then(() => {}, () => {});
  } catch { /* ignore */ }
}
