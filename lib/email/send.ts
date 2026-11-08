/**
 * Sends one client email through Resend, with a hidden copy to the studio
 * (BOOKING_NOTIFY_EMAIL). Used for the emails that follow a change to a
 * booking - moved by the studio, cancelled by the client. Server-only.
 *
 * Server-only env vars (shared with app/api/booking-confirm):
 *   RESEND_API_KEY, RESEND_FROM, BOOKING_REPLY_TO (optional), BOOKING_NOTIFY_EMAIL (optional)
 */
const REPLY_TO_DEFAULT = "ana.infinitystudio@gmail.com";
const ATTEMPTS = 2;

export async function sendClientEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One key for every attempt - and for a repeated request: never sends twice. */
  idempotencyKey: string;
  /** For the logs: "[reservation-move]" … */
  tag: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.error(`${opts.tag} RESEND_API_KEY / RESEND_FROM not set - email NOT sent`);
    return false;
  }
  const notify = process.env.BOOKING_NOTIFY_EMAIL;
  const body = JSON.stringify({
    from,
    to: [opts.to],
    ...(notify ? { bcc: [notify] } : {}),
    reply_to: process.env.BOOKING_REPLY_TO ?? REPLY_TO_DEFAULT,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": opts.idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
      console.error(`${opts.tag} Resend responded with ${res.status} (attempt ${attempt}/${ATTEMPTS}):`,
        await res.text().catch(() => ""));
      if (res.status < 500 && res.status !== 429) return false; // our request is wrong - retrying won't help
    } catch (err) {
      console.error(`${opts.tag} Resend request failed (attempt ${attempt}/${ATTEMPTS}):`, err);
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}
