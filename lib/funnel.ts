import type { LocationId } from "./locations";

/**
 * Booking-form funnel - every stage a visitor can reach, in order. Shared by
 * the form (which records them) and /fnl (which shows where people leave).
 * Keep in step with the stage list in sql/booking_funnel.sql.
 */
export const FUNNEL_STAGES = [
  { key: "open",     label: "Otvorio formu",       hint: "Bilo kakav dolazak u BookingModal" },
  { key: "studio",   label: "Izabrao studio",      hint: "Novi Sad ili Sombor" },
  { key: "gender",   label: "Izabrao pol",         hint: "Žene / muškarci (preskače se kad link već kaže pol)" },
  { key: "services", label: "Izabrao tretmane",    hint: "Označio regije i kliknuo dalje" },
  { key: "plan",     label: "Izabrao plan",        hint: "Jedan tretman ili paket" },
  { key: "day",      label: "Izabrao dan",         hint: "Kliknuo na slobodan dan" },
  { key: "time",     label: "Izabrao vreme",       hint: "Kliknuo na termin - otvorila se forma za podatke" },
  { key: "submit",   label: "Poslao podatke",      hint: "Ispravno popunio ime, email i telefon i kliknuo potvrdi" },
  { key: "booked",   label: "Zakazao termin",      hint: "Rezervacija je sačuvana" },
] as const;

/**
 * "land" is recorded on every home-page visit, before any click, so /fnl can
 * compare entry points from the same start. Not a form step - not in FUNNEL_STAGES.
 */
export type FunnelStage = (typeof FUNNEL_STAGES)[number]["key"] | "land";

/** How a visit entered the home page: a link that opens the form by itself, or the plain page. */
export type FunnelEntry = "link" | "root";

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

/**
 * What opened the form - a button (hero, plutajuce, navbar, footer, zajednica,
 * cenovnik) or a link that opens it by itself (link). Shown on /fnl.
 */
export type FunnelSource = "hero" | "plutajuce" | "navbar" | "footer" | "zajednica" | "cenovnik" | "link";

const UTM_KEY = "ils_funnel_utm";

/**
 * Remembers where this visit came from, on landing - the form may be opened
 * pages later, after the ad's URL is gone. utm_source wins; a bare Facebook
 * click id still says "meta". The first landing of the tab is kept.
 */
export function rememberVisitUtm() {
  try {
    if (sessionStorage.getItem(UTM_KEY) !== null) return;
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source")?.trim().toLowerCase().slice(0, 60)
      || (params.has("fbclid") ? "meta" : "");
    sessionStorage.setItem(UTM_KEY, utm);
  } catch { /* storage blocked - simply not recorded */ }
}

function visitUtm(): string | null {
  try {
    return sessionStorage.getItem(UTM_KEY) || null;
  } catch {
    return null;
  }
}

/** Records the visit landing on the home page (once per tab - the database keeps the first). */
export function trackLanding(entry: FunnelEntry) {
  rememberVisitUtm(); // may run before the floating button's own call
  trackFunnel("land", null, entry);
}

/** Stages already sent from this tab - going back and forth sends nothing new. */
const sent = new Set<FunnelStage>();

/** Fire-and-forget. Tracking must never be able to break the booking flow. */
export function trackFunnel(stage: FunnelStage, location: LocationId | null = null, source?: FunnelSource | FunnelEntry) {
  try {
    if (sent.has(stage)) return;
    sent.add(stage);
    const id = sessionId();
    if (!id) return;
    // A plain request to the RPC, not the Supabase client: the home page records
    // "land" on every visit, and the client would add ~50 KB to its first load.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    void fetch(`${url}/rest/v1/rpc/public_track_funnel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        p_session: id, p_stage: stage, p_location: location,
        // Where the visit and the click came from ride along with the landing and the opening only.
        ...(stage === "open" || stage === "land" ? { p_source: source ?? null, p_utm: visitUtm() } : {}),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
