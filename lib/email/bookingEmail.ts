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
  emailDocument, esc, firstNameOf, formatEmailDate, formatEmailDay, mapsLink,
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
  /** New client - the sheet lists the consultation first, like the site. */
  withConsultation: boolean;
  listPrice: number;
  finalPrice: number;
  discount: BookingDiscount;
  /** Treatments in the package - only for "bundle" and "bundle_redeem". */
  bundleSessions: number | null;
  bookingRef: string;
}

function thousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function rsd(n: number): string {
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
// Same paper and pens as `.notes-paper` in app/globals.css.
const PAPER = "#FBF9F2";
const GRID = "rgba(62,104,170,0.17)";
const PEN = "#24326E";       // ballpoint blue
const PEN_SOFT = "#646E96";  // the same ink at 70% - labels
const PEN_FAINT = "#858CA9"; // at 55% - the consultation
const RED = "#C8405B";       // the red pen that marks the answer
const TAPE = "#C1A3A1";      // the brand rose at 62% over the paper
/** Caveat where the mail app loads web fonts; elsewhere the nearest hand the device has, then the body font. */
const HAND = "font-family:'Caveat','Bradley Hand','Segoe Print','Coming Soon',casual,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

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

/**
 * A piece of the sheet that gets written in its turn (`step`, the place in the
 * writing order) - in the mail apps that animate. Everywhere else it is simply
 * there.
 */
function written(step: number, style: string, html: string, extraClass = ""): string {
  return `<div class="ils-w ils-d${step}${extraClass ? ` ${extraClass}` : ""}" style="${style}">${html}</div>`;
}

/** A label on the left, its value on the right. */
function sheetRow(left: string, right: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="white-space:nowrap;" valign="middle">${left}</td>
      <td style="padding-left:12px;" align="right" valign="middle">${right}</td>
    </tr></table>`;
}

/**
 * The booking written out by hand, in the same order and words as the site.
 * Returns the last step so the styles cover every line.
 */
function sheetHtml(d: BookingEmailData): { html: string; lastStep: number } {
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
  // (regular price, struck, note), total, circle, ref.
  const wItems = 1 + rows.length + 1;
  const wLine = wItems + items.length;
  const wList = wLine + 1;
  const wTotal = struck ? wList + 3 : wLine + 1;
  const wRef = wTotal + 3;

  const label = `${HAND}font-size:18px;line-height:26px;color:${PEN_SOFT};`;
  const value = `${HAND}font-size:20px;line-height:26px;font-weight:700;color:${PEN};`;

  const html = [
    written(0, `display:inline-block;margin:0 0 16px;${HAND}font-size:28px;line-height:34px;font-weight:700;color:${PEN};border-bottom:2px solid ${RED};`, "Tvoj termin"),

    ...rows.map(([l, v], i) =>
      written(1 + i, i ? "margin-top:4px;" : "", sheetRow(`<span style="${label}">${l}</span>`, `<span style="${value}">${esc(v)}</span>`))),

    written(wItems - 1, `margin-top:14px;${label}`, "Usluge:"),
    ...items.map((s, i) =>
      written(wItems + i, `${HAND}font-size:20px;line-height:26px;font-weight:600;color:${s.faint ? PEN_FAINT : PEN};`, `•&nbsp;${esc(s.name)}`)),

    // The line under the sum.
    written(wLine, `margin-top:14px;height:2px;line-height:2px;font-size:0;background-color:${PEN};border-radius:2px;`, "&nbsp;"),

    // Regular price, struck through in red, with the reason.
    struck ? `<div style="margin-top:8px;">${sheetRow(
      written(wList, label, "Redovna cena"),
      written(wList + 1, `display:inline-block;${HAND}font-size:20px;line-height:26px;font-weight:700;color:${RED};text-decoration:line-through;white-space:nowrap;`,
        `<span style="color:${PEN_SOFT};">${amount(d.listPrice, 20)}</span>`),
    )}</div>` : "",
    note ? written(wList + 2, `${HAND}font-size:20px;line-height:26px;font-weight:700;color:${RED};`, esc(note), "ils-tilt") : "",

    // The total, circled in red.
    `<div style="margin-top:16px;">${sheetRow(
      written(wTotal, `${HAND}font-size:24px;line-height:30px;font-weight:700;color:${PEN};`, "Ukupno&nbsp;="),
      `<div class="ils-ring ils-d${wTotal + 1}" style="display:inline-block;padding:5px 12px;border:2px solid ${RED};border-radius:50%;">${
        written(wTotal, `display:inline-block;${HAND}font-size:28px;line-height:32px;font-weight:700;color:${PEN};white-space:nowrap;`, amount(d.finalPrice, 28))
      }</div>`,
    )}</div>`,

    written(wRef, `margin-top:20px;${HAND}font-size:18px;line-height:26px;color:${PEN};`,
      `Ref. broj: <span style="font-weight:700;letter-spacing:1px;">#${esc(d.bookingRef)}</span>`),
  ].join("\n");

  return {
    lastStep: wRef,
    html: `<div class="ils-sheet">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};border:1px solid #ECE5D3;border-radius:4px;box-shadow:0 2px 3px rgba(30,16,23,0.10),0 16px 32px -14px rgba(30,16,23,0.30);">
      <tr><td style="padding:0 18px 22px;color:${PEN};background-image:linear-gradient(${GRID} 1px,transparent 1px),linear-gradient(90deg,${GRID} 1px,transparent 1px);background-size:24px 24px;border-radius:4px;">
        <table role="presentation" class="ils-tape" align="center" cellpadding="0" cellspacing="0"><tr>
          <td style="width:112px;height:22px;background-color:${TAPE};font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
        <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
${html}
      </td></tr>
    </table>
    </div>`,
  };
}

/**
 * The extras for the mail apps that take them (Apple Mail; Gmail and Outlook
 * drop all of it): the Caveat hand, the paper laid down slightly askew and the
 * lines written one after another - 0.25 s + 0.3 s a line, like the site.
 * Only the animation hides anything, so where it doesn't run, nothing is ever
 * hidden. Reduced motion gets the finished sheet.
 */
function sheetHead(lastStep: number): string {
  const delays = Array.from({ length: lastStep + 1 }, (_, i) =>
    `.ils-d${i}{animation-delay:${(0.25 + i * 0.3).toFixed(2)}s}`).join("");
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap">
<style>
.ils-sheet{transform:rotate(-1deg)}
.ils-tape{transform:translateY(-11px) rotate(2.5deg)}
.ils-tilt{transform:rotate(-2deg);transform-origin:left center}
.ils-ring{transform:rotate(-3deg)}
@media (prefers-reduced-motion:no-preference){
.ils-sheet{animation:ils-paper .6s cubic-bezier(.2,.8,.2,1) both}
.ils-w{animation:ils-write .75s cubic-bezier(.45,0,.25,1) both}
.ils-ring{animation:ils-ring .5s ease-out both}
${delays}
}
@keyframes ils-paper{from{opacity:0;transform:translateY(24px) rotate(3deg) scale(.97)}to{opacity:1;transform:rotate(-1deg)}}
@keyframes ils-write{from{clip-path:inset(-.4em 100% -.4em -.4em)}to{clip-path:inset(-.4em)}}
@keyframes ils-ring{from{border-color:transparent}}
</style>`;
}

export function bookingEmailSubject(d: BookingEmailData): string {
  return `Termin je zakazan - ${formatEmailDate(d.date)} u ${d.startTime}`;
}

export function bookingEmailHtml(d: BookingEmailData): string {
  const firstName = firstNameOf(d.customerName);
  const address = fullAddress(d.studio);
  const note = priceNote(d);
  const sheet = sheetHtml(d);

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
    head: sheetHead(sheet.lastStep),
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
    "Usluge:",
    ...(d.withConsultation ? ["- Konsultacija (10 min)"] : []),
    ...d.services.map((s) => `- ${s.name}`),
    "",
    ...(d.finalPrice !== d.listPrice ? [`Redovna cena: ${rsd(d.listPrice)}`] : []),
    `Ukupno: ${rsd(d.finalPrice)}`,
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
