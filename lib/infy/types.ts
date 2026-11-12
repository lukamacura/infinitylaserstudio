/**
 * What Infy's server routes answer - shared by the routes (app/api/infy/*)
 * and the panel (components/infy). Types only.
 */
import type { SuccessDiscount } from "@/components/booking/BookingSheet";

export type InfyLocation = "novi_sad" | "sombor";

// ── The brief (sql/infy.sql → infy_facts) ─────────────────────────────────────

/** A first visit in the next days that nobody has confirmed by phone yet. */
export type FactCall = {
  id: string; name: string; phone: string | null; date: string; start: string;
  location: InfyLocation; call_status: "none" | "no_answer"; call_attempted_at: string | null;
};
/** Someone on the call list whose follow-up day has come. */
export type FactUpit = {
  id: string; name: string; phone: string | null; source: string; note: string;
  created_at: string; last_call_at: string | null; attempts: number;
  remind_on: string | null; due_on: string; karton_id: string | null; karton_number: number | null;
};
export type FactBooked = {
  id: string; name: string; date: string; start: string; location: InfyLocation;
  status: string; created_at: string; online: boolean;
};
export type FactUpitBooked = { id: string; name: string; booked_date: string | null; booked_time: string | null };
export type FactCancel = {
  id: string; name: string; date: string; start: string; location: InfyLocation;
  late: boolean; client_cancelled_at: string;
};
/** A client whose last treatment is long enough ago, with nothing booked since. */
export type FactReturn = {
  karton_id: string; number: number; name: string; phone: string | null;
  last_date: string; visits: number; location: InfyLocation;
};
export type FactToday = { location: InfyLocation; n: number; first_start: string; last_end: string };
export type FactWeek = {
  location: InfyLocation; visits: number; cancelled: number; blacklisted: number;
  created: number; online: number; next_week: number;
};

export type InfyFacts = {
  today_date: string;
  return_weeks: number;
  today: FactToday[];
  calls: FactCall[];
  upiti_due: FactUpit[];
  upiti_open: number;
  upiti_next_due: string | null;
  booked: FactBooked[];
  booked_total: number;
  booked_online: number;
  upiti_booked: FactUpitBooked[];
  client_cancels: FactCancel[];
  return_due: FactReturn[];
  return_total: number;
  week: FactWeek[];
  week_new_clients: number;
  week_upiti_added: number;
};

/** A free stretch of working hours with nothing booked. */
export type Gap = { start: string; end: string; minutes: number };

/** One day of one studio, from now on (today) or whole (later days). */
export type DayLoad = {
  date: string;
  /** No working hours that day. */
  closed: boolean;
  /** Working minutes left / booked within them. */
  open: number;
  booked: number;
  /** Active bookings that day. */
  count: number;
  gaps: Gap[];
  /** Working hours set, nobody on the staff schedule. */
  noStaff: boolean;
};

export type StudioLoad = { location: InfyLocation; days: DayLoad[]; open: number; booked: number };

export type Brief = {
  today: string;
  facts: InfyFacts;
  studios: StudioLoad[];
  /** Infy's two or three sentences on the day. */
  headline: string;
  /** false: the headline is the plain fallback (no OpenAI answer). */
  ai: boolean;
  generatedAt: string;
};

// ── The conversation ──────────────────────────────────────────────────────────

/** OpenAI chat format - kept by the panel between turns, as the server returns it. */
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** What the paper sheet of a proposal shows. */
export type ProposalDisplay = {
  kind: "book" | "move" | "cancel";
  /** The client's name - the sheet's title. */
  title: string;
  studio: string;
  /** "Utorak, 17. novembar" */
  date: string;
  /** "17:10 – 17:50" */
  timeRange: string;
  duration: number;
  withConsultation: boolean;
  services: string[];
  listTotal: number;
  /** null: the price could not be worked out. */
  finalPrice: number | null;
  discount: SuccessDiscount;
  movedFrom: { date: string; timeRange: string } | null;
  /** Where the email would go; null = the client has none. */
  email: string | null;
  /** The email toggle starts on (a term still ahead, an address on file). */
  emailDefault: boolean;
  phone: string | null;
  /** Things staff should see before confirming ("van radnog vremena"…). */
  warnings: string[];
};

export type InfyCard =
  | {
      type: "proposal";
      /** Signed by the server - the confirm button sends it back as it is. */
      token: string;
      /** Same subject, newer proposal: the older card is replaced. */
      subject: string;
      display: ProposalDisplay;
      expiresAt: number;
    }
  | {
      type: "upit";
      id: string;
      name: string;
      source: string;
      dueOn: string;
      /** true: just written in (the card offers "Poništi"); false: changed. */
      created: boolean;
      note: string;
    };

export type ChatResponse =
  | { ok: true; reply: string; cards: InfyCard[]; history: ChatMessage[] }
  | { ok: false; error: "forbidden" | "config" | "ai" | "invalid_input" };

export type ConfirmResponse =
  | { ok: true; kind: "book" | "move" | "cancel"; email: "sent" | "failed" | "skipped"; already?: boolean }
  | {
      ok: false;
      error:
        | "forbidden" | "expired" | "invalid" | "slot_taken" | "too_late" | "not_found"
        | "inactive" | "unchanged" | "invalid_promo" | "db" | "config";
      clash?: { name: string; start: string; end: string };
    };
