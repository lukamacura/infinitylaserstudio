/**
 * The confirmation email a client gets after booking. Built here, on the
 * server, and sent through Resend (see app/api/booking-confirm). The frame and
 * styles are shared with the other client emails (lib/email/layout.ts).
 *
 * The booking itself is the same sheet as the last step of the booking modal
 * (components/booking/BookingSuccess.tsx): squared paper, blue ink, the total
 * circled in red. Everything that makes it look like that is inline, so Gmail
 * and Outlook show the finished sheet. The handwriting font and the writing,
 * line after line, are extras in <head> for the mail apps that take them
 * (Apple Mail on iPhone and Mac) - see sheetHead().
 */
import { BUNDLE_TIERS } from "@/lib/bundles";
import { fullAddress, type StudioLocation } from "@/lib/locations";
import { PREPARATION_STEPS } from "@/lib/preparation";
import {
  ACCENT, FONT, INK, LABEL, MUTED, PHONE_DISPLAY, PHONE_LINK, SITE_URL,
  emailButton, emailDocument, esc, firstNameOf, formatEmailDate, formatEmailDay, mapsLink,
} from "./layout";
import {
  HAND, PEN, PEN_SOFT, RED, SHEET_LABEL,
  paperHead, paperSheet, sheetList, sheetNote, sheetRow, sheetRows, sheetTitle, written,
} from "./paper";

export { formatEmailDate };

export type BookingDiscount = "none" | "student" | "link" | "gift" | "promo" | "bundle" | "bundle_redeem";

export interface BookingEmailData {
  customerName: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  studio: StudioLocation;
  services: { name: string; price: number }[];
  /** New client - the sheet lists the consultation first, like the site. */
  withConsultation: boolean;
  listPrice: number;
  finalPrice: number;
  discount: BookingDiscount;
  /** Treatments in the package - only for "bundle" and "bundle_redeem". */
  bundleSessions: number | null;
  /** Last 8 of the id - for the admin group's message (n8n), not shown to the client. */
  bookingRef: string;
  /** The client's own "Otkaži termin" link (lib/cancelLink.ts); null leaves the button out. */
  cancelUrl: string | null;
}

function thousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function rsd(n: number): string {
  return `${thousands(n)} RSD`;
}

/** The one line under the price that explains what the client pays and when. */
function priceNote(d: BookingEmailData): string | null {
  switch (d.discount) {
    case "student":
      return `Studentski popust −20% važi samo uz indeks. Bez indeksa se naplaćuje puna cena od ${rsd(d.listPrice)}.`;
    case "bundle":
      return `Paket od ${d.bundleSessions} tretmana plaćate u celosti na prvom tretmanu. Tada dobijate kod kojim zakazujete preostale termine.`;
    case "bundle_redeem":
      return "Ovaj tretman je već plaćen u okviru Vašeg paketa.";
    case "promo":
      return "Promo popust −10% je uračunat u cenu.";
    case "link":
      return "Popust −20% je uračunat u cenu.";
    case "gift":
      return "Nausnice su gratis - uračunato u cenu.";
    default:
      return null;
  }
}

// ── The sheet ─────────────────────────────────────────────────────────────────

/** The red note under the struck price - same words as the site. */
function discountNote(d: BookingEmailData): string | null {
  switch (d.discount) {
    case "bundle": {
      const pct = d.bundleSessions ? BUNDLE_TIERS[d.bundleSessions] : undefined;
      return `↳ paket ${d.bundleSessions}×${pct ? ` · −${pct}%` : ""}`;
    }
    case "bundle_redeem": return "↳ plaćeno u paketu";
    case "student":       return "↳ student −20% · uz indeks";
    case "link":          return "↳ popust −20%";
    case "gift":          return "↳ nausnice gratis";
    case "promo":         return "↳ promo −10%";
    default:              return null;
  }
}

/** "4.500 RSD" with the currency smaller, like the site's Amount. */
function amount(n: number, size: number): string {
  return `${thousands(n)}<span style="font-size:${Math.round(size * 0.6)}px;font-weight:600;">&nbsp;RSD</span>`;
}

/** What the sheet needs - a booking, or a saved reservation (lib/reservationSheet.ts). */
export type BookingSheetData = Pick<BookingEmailData,
  "date" | "startTime" | "endTime" | "durationMinutes" | "services" | "withConsultation" |
  "listPrice" | "finalPrice" | "discount" | "bundleSessions">;

/**
 * The booking written out by hand, in the same order and words as the site.
 * Returns the last step so the styles cover every line.
 *
 * `cancelled`: the same sheet after the client cancelled - day and time
 * struck through in red, a red note under the sum. `noPrice` leaves the sum
 * out (the price could not be worked out).
 */
export function bookingSheet(
  d: BookingSheetData,
  opts: { cancelled?: { late: boolean }; noPrice?: boolean } = {},
): { html: string; lastStep: number } {
  const rows: [string, string][] = [
    ["Datum", formatEmailDay(d.date)],
    ["Vreme", `${d.startTime} – ${d.endTime}`],
    ["Trajanje", `${d.durationMinutes} min`],
  ];
  const items = [
    ...(d.withConsultation ? [{ name: "Konsultacija (10 min)", faint: true }] : []),
    ...d.services.map((s) => ({ name: s.name, faint: false })),
  ];
  const struck = d.finalPrice !== d.listPrice;
  const note = struck ? discountNote(d) : null;

  // Writing order, as on the site: title, rows, "Usluge:", items, line,
  // (regular price, struck, note), total, circle, (cancelled note).
  const list = sheetList("Usluge:", items, 1 + rows.length);
  const wLine = list.next;
  const wList = wLine + 1;
  const wTotal = struck ? wList + 3 : wLine + 1;
  const wEnd = opts.noPrice ? list.next : wTotal + 2;
  const cancelled = opts.cancelled;

  const html = [
    sheetTitle("Tvoj termin"),
    sheetRows(rows, 1, cancelled ? 2 : 0),
    list.html,

    ...(opts.noPrice ? [] : [
      // The line under the sum.
      written(wLine, `margin-top:14px;height:2px;line-height:2px;font-size:0;background-color:${PEN};border-radius:2px;`, "&nbsp;"),

      // Regular price, struck through in red, with the reason.
      struck ? `<div style="margin-top:8px;">${sheetRow(
        written(wList, SHEET_LABEL, "Redovna cena"),
        written(wList + 1, `display:inline-block;${HAND}font-size:20px;line-height:26px;font-weight:700;color:${RED};text-decoration:line-through;white-space:nowrap;`,
          `<span style="color:${PEN_SOFT};">${amount(d.listPrice, 20)}</span>`),
      )}</div>` : "",
      note ? sheetNote(wList + 2, note) : "",

      // The total, circled in red.
      `<div style="margin-top:16px;">${sheetRow(
        written(wTotal, `${HAND}font-size:24px;line-height:30px;font-weight:700;color:${PEN};`, "Ukupno&nbsp;="),
        `<div class="ils-ring ils-d${wTotal + 1}" style="display:inline-block;padding:5px 12px;border:2px solid ${RED};border-radius:50%;">${
          written(wTotal, `display:inline-block;${HAND}font-size:28px;line-height:32px;font-weight:700;color:${PEN};white-space:nowrap;`, amount(d.finalPrice, 28))
        }</div>`,
      )}</div>`,
    ]),

    cancelled
      ? sheetNote(wEnd, cancelled.late ? "↳ otkazano manje od 24 h pre termina" : "↳ otkazano na vreme · bez troškova", 18)
      : "",
  ].join("\n");

  return { lastStep: wEnd, html: paperSheet(html) };
}

export function bookingEmailSubject(d: BookingEmailData): string {
  return `Termin je zakazan - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function bookingEmailHtml(d: BookingEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const address = fullAddress(d.studio);
  const note = priceNote(d);
  const sheet = bookingSheet(d);

  const steps = PREPARATION_STEPS
    .map((s) => `<tr>
      <td style="${FONT}padding:6px 12px 6px 0;font-size:13px;color:${ACCENT};font-weight:700;" valign="top">${s.num}</td>
      <td style="${FONT}padding:6px 0;font-size:14px;line-height:21px;color:${INK};" valign="top">${esc(s.text)}</td>
    </tr>`)
    .join("");

  return emailDocument({
    title: bookingEmailSubject(d),
    preheader: `Čekamo Vas ${d.studio.cityLocative}, ${address}. ${formatEmailDate(d.date)} u ${d.startTime}.`,
    studio: d.studio,
    head: paperHead(sheet.lastStep),
    body: `
  <tr><td style="padding:20px 28px 0;">
    <h1 style="${FONT}margin:0;font-size:24px;line-height:30px;color:${INK};font-weight:700;">Termin je zakazan</h1>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${firstName ? `${esc(firstName)}, h` : "H"}vala na poverenju. Čekamo Vas ${esc(d.studio.cityLocative)}.</p>
  </td></tr>

  <tr><td style="padding:30px 28px 0;">
    ${sheet.html}
    ${note ? `<p style="${FONT}margin:22px 0 0;padding:12px 14px;background:#FFF7E8;border-radius:10px;font-size:13px;line-height:20px;color:#6B4E16;">${esc(note)}</p>` : ""}
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <p style="${LABEL}margin:0;">Gde</p>
    <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(address)}</p>
    <p style="${FONT}margin:6px 0 0;font-size:14px;"><a href="${mapsLink(d.studio)}" style="color:${ACCENT};font-weight:600;">Otvori na mapi</a></p>
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Priprema za tretman</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Otkazivanje</p>
    ${d.cancelUrl
      ? `<p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Ne stižete? Termin otkazujete jednim klikom, besplatno najkasnije 24 sata pre tretmana. Za pomeranje nas pozovite na <a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a> ili odgovorite na ovaj email.</p>
    ${emailButton(d.cancelUrl, "Otkaži termin")}`
      : `<p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Termin možete besplatno otkazati ili pomeriti najkasnije 24 sata pre tretmana - pozovite nas na <a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a> ili odgovorite na ovaj email.</p>`}
  </td></tr>
`,
  });
}

/** Same content without formatting - for email programs that show text only. */
export function bookingEmailText(d: BookingEmailData): string {
  const note = priceNote(d);
  return [
    "TERMIN JE ZAKAZAN",
    "",
    `Kada: ${formatEmailDate(d.date)}, ${d.startTime} – ${d.endTime} (${d.durationMinutes} min)`,
    `Gde: Infinity Laser Studio, ${fullAddress(d.studio)}`,
    `Mapa: ${mapsLink(d.studio)}`,
    "",
    "Usluge:",
    ...(d.withConsultation ? ["- Konsultacija (10 min)"] : []),
    ...d.services.map((s) => `- ${s.name}`),
    "",
    ...(d.finalPrice !== d.listPrice ? [`Redovna cena: ${rsd(d.listPrice)}`] : []),
    `Ukupno: ${rsd(d.finalPrice)}`,
    ...(note ? [note] : []),
    "",
    "Priprema za tretman:",
    ...PREPARATION_STEPS.map((s) => `${s.num}. ${s.text}`),
    "",
    `Otkazivanje: besplatno najkasnije 24 sata pre tretmana. Telefon: ${PHONE_DISPLAY}`,
    ...(d.cancelUrl ? [`Otkaži termin: ${d.cancelUrl}`] : []),
    "",
    SITE_URL,
  ].join("\n");
}
