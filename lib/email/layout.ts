/**
 * What every email to a client shares: the frame, the styles and the small
 * formatting helpers. The emails themselves live next to this file
 * (bookingEmail.ts - booked, movedEmail.ts - moved by the studio).
 *
 * Email programs ignore most modern CSS, so the layout is plain tables with
 * inline styles, on a light background - that is what renders the same in
 * Gmail, Apple Mail and Outlook.
 */
import { fullAddress, type StudioLocation } from "@/lib/locations";

const DAYS = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
const MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

export const PHONE_DISPLAY = "065 373 8991";
export const PHONE_LINK = "+381653738991";
export const SITE_URL = "https://www.infinitylaserstudio.com";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** "Petak, 2. oktobar 2026." - from the date parts, so no timezone can shift the day. */
export function formatEmailDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]}, ${d}. ${MONTHS[m - 1]} ${y}.`;
}

export function mapsLink(studio: StudioLocation): string {
  const q = `Infinity Laser Studio, ${fullAddress(studio)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** "Ana, h" + "vala…" - the greeting with the first name when there is one. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// ── Styles ────────────────────────────────────────────────────────────────────
export const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
export const INK = "#1E1017";
export const MUTED = "#7A6B70";
export const ACCENT = "#9E6F70";
export const LINE = "#EFE6E6";
export const LABEL = `${FONT}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};`;

/** A label / value line of a summary table. */
export function row(label: string, value: string): string {
  return `<tr>
    <td style="${FONT}padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${MUTED};" valign="top">${label}</td>
    <td style="${FONT}padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-weight:600;" align="right" valign="top">${value}</td>
  </tr>`;
}

/**
 * The whole email around its content: the brand line on top, the studio's
 * address at the bottom. `body` is the rows in between (`<tr>…</tr>`);
 * `preheader` is the hidden line inboxes show next to the subject.
 */
export function emailDocument(opts: {
  title: string;
  preheader: string;
  studio: StudioLocation;
  body: string;
}): string {
  const address = fullAddress(opts.studio);
  return `<!doctype html>
<html lang="sr-Latn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F6F1F1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1F1;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;">

  <tr><td style="padding:28px 28px 0;">
    <p style="${FONT}margin:0;font-size:12px;letter-spacing:3px;color:${ACCENT};font-weight:700;">INFINITY LASER STUDIO</p>
  </td></tr>
${opts.body}
  <tr><td style="padding:28px;">
    <p style="${FONT}margin:0;padding-top:18px;border-top:1px solid ${LINE};font-size:12px;line-height:18px;color:${MUTED};">Infinity Laser Studio · ${esc(address)}<br><a href="${SITE_URL}" style="color:${MUTED};">infinitylaserstudio.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
