/**
 * The confirmation email a client gets after booking. Built here, on the
 * server, and sent through Resend (see app/api/booking-confirm).
 *
 * Email programs ignore most modern CSS, so the layout is plain tables with
 * inline styles, on a light background - that is what renders the same in
 * Gmail, Apple Mail and Outlook.
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";
import { PREPARATION_STEPS } from "@/lib/preparation";

const DAYS = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

const PHONE_DISPLAY = "065 373 8991";
const PHONE_LINK = "+381653738991";
const SITE_URL = "https://www.infinitylaserstudio.com";

export type BookingDiscount = "none" | "student" | "link" | "promo" | "bundle" | "bundle_redeem";

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

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function rsd(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} RSD`;
}

/** "Petak, 2. oktobar 2026." - from the date parts, so no timezone can shift the day. */
export function formatEmailDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]}, ${d}. ${MONTHS[m - 1]} ${y}.`;
}

function mapsLink(studio: StudioLocation): string {
  const q = `Infinity Laser Studio, ${fullAddress(studio)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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
    default:
      return null;
  }
}

export function bookingEmailSubject(d: BookingEmailData): string {
  return `Termin je zakazan - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const INK = "#1E1017";
const MUTED = "#7A6B70";
const ACCENT = "#9E6F70";
const LINE = "#EFE6E6";
const LABEL = `${FONT}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};`;

function row(label: string, value: string): string {
  return `<tr>
    <td style="${FONT}padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${MUTED};" valign="top">${label}</td>
    <td style="${FONT}padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-weight:600;" align="right" valign="top">${value}</td>
  </tr>`;
}

export function bookingEmailHtml(d: BookingEmailData): string {
  const firstName = d.customerName.trim().split(/\s+/)[0] ?? "";
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

  return `<!doctype html>
<html lang="sr-Latn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(bookingEmailSubject(d))}</title>
</head>
<body style="margin:0;padding:0;background:#F6F1F1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Čekamo Vas ${esc(d.studio.cityLocative)}, ${esc(address)}. ${esc(formatEmailDate(d.date))} u ${esc(d.startTime)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1F1;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;">

  <tr><td style="padding:28px 28px 0;">
    <p style="${FONT}margin:0;font-size:12px;letter-spacing:3px;color:${ACCENT};font-weight:700;">INFINITY LASER STUDIO</p>
  </td></tr>

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

  <tr><td style="padding:28px;">
    <p style="${FONT}margin:0;padding-top:18px;border-top:1px solid ${LINE};font-size:12px;line-height:18px;color:${MUTED};">Infinity Laser Studio · ${esc(address)}<br><a href="${SITE_URL}" style="color:${MUTED};">infinitylaserstudio.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
