/**
 * The email a client gets when the studio moves their appointment to another
 * day or time (admin calendar). Built on the server from what the database
 * returned for the move (see app/api/reservation-move), sent through Resend.
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";
import {
  ACCENT, FONT, INK, LABEL, LINE, MUTED, PHONE_DISPLAY, PHONE_LINK, SITE_URL,
  emailDocument, esc, firstNameOf, formatEmailDate, mapsLink, row,
} from "./layout";

export interface MovedEmailData {
  customerName: string;
  studio: StudioLocation;
  /** The new term: "YYYY-MM-DD" and "HH:MM". */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** The term it replaces. */
  oldDate: string;
  oldStartTime: string;
  /** Treatment names, as booked. */
  services: string[];
  bookingRef: string;
}

export function movedEmailSubject(d: MovedEmailData): string {
  return `Termin je pomeren - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function movedEmailHtml(d: MovedEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const address = fullAddress(d.studio);

  const services = d.services
    .map((name) => `<tr>
      <td style="${FONT}padding:4px 0;font-size:14px;color:${INK};">${esc(name)}</td>
    </tr>`)
    .join("");

  return emailDocument({
    title: movedEmailSubject(d),
    preheader: `Novi termin: ${formatEmailDate(d.date)} u ${d.startTime}. Čekamo Vas ${d.studio.cityLocative}, ${address}.`,
    studio: d.studio,
    body: `
  <tr><td style="padding:20px 28px 0;">
    <h1 style="${FONT}margin:0;font-size:24px;line-height:30px;color:${INK};font-weight:700;">Termin je pomeren</h1>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${firstName ? `${esc(firstName)}, V` : "V"}aš termin je pomeren na novo vreme. Čekamo Vas ${esc(d.studio.cityLocative)}.</p>
  </td></tr>

  <tr><td style="padding:20px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F6;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="${LABEL}margin:0;">Novi termin</p>
        <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(formatEmailDate(d.date))}</p>
        <p style="${FONT}margin:2px 0 0;font-size:15px;color:${INK};">${esc(d.startTime)} – ${esc(d.endTime)} <span style="color:${MUTED};">(${d.durationMinutes} min)</span></p>
        <p style="${LABEL}margin:16px 0 0;">Umesto</p>
        <p style="${FONT}margin:4px 0 0;font-size:14px;line-height:21px;color:${MUTED};text-decoration:line-through;">${esc(formatEmailDate(d.oldDate))} u ${esc(d.oldStartTime)}</p>
        <p style="${LABEL}margin:16px 0 0;">Gde</p>
        <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(address)}</p>
        <p style="${FONT}margin:6px 0 0;font-size:14px;"><a href="${mapsLink(d.studio)}" style="color:${ACCENT};font-weight:600;">Otvori na mapi</a></p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    ${services ? `<p style="${LABEL}margin:0 0 6px;">Tretman</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${services}</table>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:1px solid ${LINE};">
      ${row("Broj rezervacije", `#${esc(d.bookingRef)}`)}
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Ne odgovara Vam novo vreme?</p>
    <p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Pozovite nas na <a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a> ili odgovorite na ovaj email - naći ćemo termin koji Vam odgovara.</p>
  </td></tr>
`,
  });
}

/** Same content without formatting - for email programs that show text only. */
export function movedEmailText(d: MovedEmailData): string {
  return [
    "TERMIN JE POMEREN",
    "",
    `Novi termin: ${formatEmailDate(d.date)}, ${d.startTime} – ${d.endTime} (${d.durationMinutes} min)`,
    `Umesto: ${formatEmailDate(d.oldDate)} u ${d.oldStartTime}`,
    `Gde: Infinity Laser Studio, ${fullAddress(d.studio)}`,
    `Mapa: ${mapsLink(d.studio)}`,
    ...(d.services.length > 0 ? ["", "Tretman:", ...d.services.map((name) => `- ${name}`)] : []),
    "",
    `Broj rezervacije: #${d.bookingRef}`,
    "",
    `Ne odgovara Vam novo vreme? Pozovite nas na ${PHONE_DISPLAY} ili odgovorite na ovaj email.`,
    "",
    SITE_URL,
  ].join("\n");
}
