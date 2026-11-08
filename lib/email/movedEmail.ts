/**
 * The email a client gets when the studio moves their appointment to another
 * day or time (admin calendar). Built on the server from what the database
 * returned for the move (see app/api/reservation-move), sent through Resend.
 *
 * Written on the same sheet as the confirmation (paper.ts): the new term in
 * blue ink, the old one struck through in red.
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";
import {
  ACCENT, FONT, INK, LABEL, MUTED, PHONE_DISPLAY, PHONE_LINK, SITE_URL,
  emailButton, emailDocument, esc, firstNameOf, formatEmailDate, formatEmailDay, mapsLink,
} from "./layout";
import {
  SHEET_LABEL, SHEET_VALUE,
  paperHead, paperSheet, sheetList, sheetRef, sheetRow, sheetRows, sheetTitle, strike, written,
} from "./paper";

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
  /** The client's own "Otkaži termin" link (lib/cancelLink.ts); null leaves the button out. */
  cancelUrl: string | null;
}

/** The new term on paper, the old one crossed out under it. */
function sheetHtml(d: MovedEmailData): { html: string; lastStep: number } {
  const rows: [string, string][] = [
    ["Datum", formatEmailDay(d.date)],
    ["Vreme", `${d.startTime} – ${d.endTime}`],
    ["Trajanje", `${d.durationMinutes} min`],
  ];
  const wOld = 1 + rows.length;
  const list = d.services.length > 0
    ? sheetList("Usluge:", d.services.map((name) => ({ name })), wOld + 1)
    : { html: "", next: wOld + 1 };
  const wRef = list.next;

  const html = [
    sheetTitle("Novi termin"),
    sheetRows(rows, 1),
    written(wOld, "margin-top:10px;", sheetRow(
      `<span style="${SHEET_LABEL}">Umesto</span>`,
      strike(`<span style="${SHEET_VALUE}">${esc(`${formatEmailDay(d.oldDate)} u ${d.oldStartTime}`)}</span>`),
    )),
    list.html,
    sheetRef(wRef, d.bookingRef),
  ].join("\n");

  return { lastStep: wRef, html: paperSheet(html) };
}

export function movedEmailSubject(d: MovedEmailData): string {
  return `Termin je pomeren - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function movedEmailHtml(d: MovedEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const address = fullAddress(d.studio);
  const sheet = sheetHtml(d);
  const phone = `<a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a>`;

  return emailDocument({
    title: movedEmailSubject(d),
    preheader: `Novi termin: ${formatEmailDate(d.date)} u ${d.startTime}. Čekamo Vas ${d.studio.cityLocative}, ${address}.`,
    studio: d.studio,
    head: paperHead(sheet.lastStep),
    body: `
  <tr><td style="padding:20px 28px 0;">
    <h1 style="${FONT}margin:0;font-size:24px;line-height:30px;color:${INK};font-weight:700;">Termin je pomeren</h1>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${firstName ? `${esc(firstName)}, V` : "V"}aš termin je pomeren na novo vreme. Čekamo Vas ${esc(d.studio.cityLocative)}.</p>
  </td></tr>

  <tr><td style="padding:30px 28px 0;">
    ${sheet.html}
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <p style="${LABEL}margin:0;">Gde</p>
    <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(address)}</p>
    <p style="${FONT}margin:6px 0 0;font-size:14px;"><a href="${mapsLink(d.studio)}" style="color:${ACCENT};font-weight:600;">Otvori na mapi</a></p>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Ne odgovara Vam novo vreme?</p>
    <p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Pozovite nas na ${phone} ili odgovorite na ovaj email - naći ćemo termin koji Vam odgovara.${d.cancelUrl ? " Ako ne stižete, termin otkazujete jednim klikom." : ""}</p>
    ${d.cancelUrl ? emailButton(d.cancelUrl, "Otkaži termin") : ""}
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
    ...(d.cancelUrl ? [`Otkaži termin: ${d.cancelUrl}`] : []),
    "",
    SITE_URL,
  ].join("\n");
}
