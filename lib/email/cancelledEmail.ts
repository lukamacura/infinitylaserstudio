/**
 * The email a client gets after cancelling with the "Otkaži termin" link
 * (app/api/reservation-cancel). Built from what the database returned for the
 * cancellation; the studio gets the hidden copy (BOOKING_NOTIFY_EMAIL).
 *
 * Written on the same sheet as the confirmation (paper.ts), with the day and
 * time struck through in red. A late cancellation (under 24 h) says what the
 * policy says: 50% of this treatment at the next visit, unless it is health.
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";
import {
  ACCENT, FONT, INK, LABEL, MUTED, PHONE_DISPLAY, PHONE_LINK, SITE_URL,
  emailButton, emailDocument, esc, firstNameOf, formatEmailDate, formatEmailDay,
} from "./layout";
import { paperHead, paperSheet, sheetList, sheetNote, sheetRef, sheetRows, sheetTitle } from "./paper";

export interface CancelledEmailData {
  customerName: string;
  studio: StudioLocation;
  /** "YYYY-MM-DD" and "HH:MM" */
  date: string;
  startTime: string;
  endTime: string;
  /** Treatment names, as booked. */
  services: string[];
  bookingRef: string;
  /** Cancelled less than 24 h before the treatment. */
  late: boolean;
}

/** Where "Zakaži novi termin" leads: the site with the booking form open. */
export const REBOOK_URL = `${SITE_URL}/?book=1`;

function sheetHtml(d: CancelledEmailData): { html: string; lastStep: number } {
  const rows: [string, string][] = [
    ["Datum", formatEmailDay(d.date)],
    ["Vreme", `${d.startTime} – ${d.endTime}`],
  ];
  const list = d.services.length > 0
    ? sheetList("Usluge:", d.services.map((name) => ({ name, faint: true })), 1 + rows.length)
    : { html: "", next: 1 + rows.length };
  const wNote = list.next;
  const wRef = wNote + 1;

  const html = [
    sheetTitle("Termin otkazan"),
    sheetRows(rows, 1, true),
    list.html,
    sheetNote(wNote, d.late ? "↳ otkazano manje od 24 h pre termina" : "↳ otkazano na vreme · bez troškova", 12),
    sheetRef(wRef, d.bookingRef),
  ].join("\n");

  return { lastStep: wRef, html: paperSheet(html) };
}

export function cancelledEmailSubject(d: CancelledEmailData): string {
  return `Termin je otkazan - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function cancelledEmailHtml(d: CancelledEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const sheet = sheetHtml(d);
  const phone = `<a href="tel:${PHONE_LINK}" style="color:#6B4E16;font-weight:700;white-space:nowrap;">${PHONE_DISPLAY}</a>`;

  return emailDocument({
    title: cancelledEmailSubject(d),
    preheader: `Otkazan je termin ${formatEmailDate(d.date)} u ${d.startTime}. Novi termin zakazujete za minut.`,
    studio: d.studio,
    head: paperHead(sheet.lastStep),
    body: `
  <tr><td style="padding:20px 28px 0;">
    <h1 style="${FONT}margin:0;font-size:24px;line-height:30px;color:${INK};font-weight:700;">Termin je otkazan</h1>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${firstName ? `${esc(firstName)}, h` : "H"}vala što ste nam javili. Vaš termin ${esc(d.studio.cityLocative)} je otkazan.</p>
  </td></tr>

  <tr><td style="padding:30px 28px 0;">
    ${sheet.html}
    ${d.late ? `<p style="${FONT}margin:22px 0 0;padding:12px 14px;background:#FFF7E8;border-radius:10px;font-size:13px;line-height:20px;color:#6B4E16;">Termin je otkazan manje od 24 sata pre tretmana, pa se pri sledećem dolasku naplaćuje <strong>50% cene ovog tretmana</strong>. Ako je razlog zdravstveni (bolest, povreda) ili hitan slučaj, ne naplaćuje se ništa - samo nam javite na ${phone} ili odgovorite na ovaj email.</p>` : ""}
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Novi termin</p>
    <p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Kad god poželite, novi termin zakazujete za minut. Za pitanja smo tu na <a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a>.</p>
    ${emailButton(REBOOK_URL, "Zakaži novi termin", { filled: true })}
  </td></tr>
`,
  });
}

/** Same content without formatting - for email programs that show text only. */
export function cancelledEmailText(d: CancelledEmailData): string {
  return [
    "TERMIN JE OTKAZAN",
    "",
    `Otkazan termin: ${formatEmailDate(d.date)}, ${d.startTime} – ${d.endTime}`,
    `Studio: ${fullAddress(d.studio)}`,
    ...(d.services.length > 0 ? ["", "Usluge:", ...d.services.map((name) => `- ${name}`)] : []),
    "",
    `Broj rezervacije: #${d.bookingRef}`,
    ...(d.late ? [
      "",
      "Termin je otkazan manje od 24 sata pre tretmana, pa se pri sledećem dolasku naplaćuje 50% cene ovog tretmana.",
      `Ako je razlog zdravstveni (bolest, povreda) ili hitan slučaj, ne naplaćuje se ništa - samo nam javite na ${PHONE_DISPLAY} ili odgovorite na ovaj email.`,
    ] : []),
    "",
    `Novi termin: ${REBOOK_URL}`,
    "",
    SITE_URL,
  ].join("\n");
}
