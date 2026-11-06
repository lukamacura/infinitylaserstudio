/**
 * The confirmation email a client gets after booking. Built here, on the
 * server, and sent through Resend (see app/api/booking-confirm). The frame and
 * styles are shared with the other client emails (lib/email/layout.ts).
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";
import { PREPARATION_STEPS } from "@/lib/preparation";
import {
  ACCENT, FONT, INK, LABEL, LINE, MUTED, PHONE_DISPLAY, PHONE_LINK, SITE_URL,
  emailDocument, esc, firstNameOf, formatEmailDate, mapsLink, row,
} from "./layout";

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
  listPrice: number;
  finalPrice: number;
  discount: BookingDiscount;
  /** Treatments in the package - only for "bundle" and "bundle_redeem". */
  bundleSessions: number | null;
  bookingRef: string;
}

function rsd(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} RSD`;
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

export function bookingEmailSubject(d: BookingEmailData): string {
  return `Termin je zakazan - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function bookingEmailHtml(d: BookingEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const address = fullAddress(d.studio);
  const hasDiscount = d.finalPrice !== d.listPrice;
  const note = priceNote(d);

  const services = d.services
    .map((s) => `<tr>
      <td style="${FONT}padding:4px 0;font-size:14px;color:${INK};">${esc(s.name)}</td>
      <td style="${FONT}padding:4px 0;font-size:14px;color:${MUTED};" align="right">${rsd(s.price)}</td>
    </tr>`)
    .join("");

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
    body: `
  <tr><td style="padding:20px 28px 0;">
    <h1 style="${FONT}margin:0;font-size:24px;line-height:30px;color:${INK};font-weight:700;">Termin je zakazan</h1>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${firstName ? `${esc(firstName)}, h` : "H"}vala na poverenju. Čekamo Vas ${esc(d.studio.cityLocative)}.</p>
  </td></tr>

  <tr><td style="padding:20px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F6;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="${LABEL}margin:0;">Kada</p>
        <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(formatEmailDate(d.date))}</p>
        <p style="${FONT}margin:2px 0 0;font-size:15px;color:${INK};">${esc(d.startTime)} – ${esc(d.endTime)} <span style="color:${MUTED};">(${d.durationMinutes} min)</span></p>
        <p style="${LABEL}margin:16px 0 0;">Gde</p>
        <p style="${FONT}margin:4px 0 0;font-size:17px;line-height:24px;color:${INK};font-weight:700;">${esc(address)}</p>
        <p style="${FONT}margin:6px 0 0;font-size:14px;"><a href="${mapsLink(d.studio)}" style="color:${ACCENT};font-weight:600;">Otvori na mapi</a></p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Tretman</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${services}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:1px solid ${LINE};">
      ${hasDiscount ? row("Redovna cena", `<span style="text-decoration:line-through;font-weight:400;color:${MUTED};">${rsd(d.listPrice)}</span>`) : ""}
      ${row(d.discount === "bundle" ? `Cena paketa (${d.bundleSessions} tretmana)` : "Za plaćanje", rsd(d.finalPrice))}
      ${row("Broj rezervacije", `#${esc(d.bookingRef)}`)}
    </table>
    ${note ? `<p style="${FONT}margin:14px 0 0;padding:12px 14px;background:#FFF7E8;border-radius:10px;font-size:13px;line-height:20px;color:#6B4E16;">${esc(note)}</p>` : ""}
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Priprema za tretman</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    <p style="${LABEL}margin:0 0 6px;">Otkazivanje</p>
    <p style="${FONT}margin:0;font-size:14px;line-height:21px;color:${INK};">Termin možete besplatno otkazati ili pomeriti najkasnije 24 sata pre tretmana - pozovite nas na <a href="tel:${PHONE_LINK}" style="color:${ACCENT};font-weight:600;white-space:nowrap;">${PHONE_DISPLAY}</a> ili odgovorite na ovaj email.</p>
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
    "Tretman:",
    ...d.services.map((s) => `- ${s.name} (${rsd(s.price)})`),
    "",
    ...(d.finalPrice !== d.listPrice ? [`Redovna cena: ${rsd(d.listPrice)}`] : []),
    `Za plaćanje: ${rsd(d.finalPrice)}`,
    ...(note ? [note] : []),
    `Broj rezervacije: #${d.bookingRef}`,
    "",
    "Priprema za tretman:",
    ...PREPARATION_STEPS.map((s) => `${s.num}. ${s.text}`),
    "",
    `Otkazivanje: besplatno najkasnije 24 sata pre tretmana. Telefon: ${PHONE_DISPLAY}`,
    "",
    SITE_URL,
  ].join("\n");
}
