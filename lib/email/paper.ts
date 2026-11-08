/**
 * The sheet of squared paper every client email is written on - booked,
 * moved, cancelled. Same paper and pens as the booking modal's last step
 * (components/booking/BookingSuccess.tsx, `.notes-paper` in app/globals.css).
 *
 * Everything that makes it look like paper is inline, so Gmail and Outlook
 * show the finished sheet. The handwriting font and the writing, line after
 * line, are extras in <head> for the mail apps that take them (Apple Mail on
 * iPhone and Mac) - see paperHead().
 */
import { esc } from "./layout";

// Same paper and pens as `.notes-paper` in app/globals.css.
const PAPER = "#FBF9F2";
const GRID = "rgba(62,104,170,0.17)";
export const PEN = "#24326E";       // ballpoint blue
export const PEN_SOFT = "#646E96";  // the same ink at 70% - labels
export const PEN_FAINT = "#858CA9"; // at 55% - the consultation, a cancelled treatment
export const RED = "#C8405B";       // the red pen that marks the answer
const TAPE = "#C1A3A1";             // the brand rose at 62% over the paper

/** Caveat where the mail app loads web fonts; elsewhere the nearest hand the device has, then the body font. */
export const HAND = "font-family:'Caveat','Bradley Hand','Segoe Print','Coming Soon',casual,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

/** A label on the sheet ("Datum") and the value beside it. */
export const SHEET_LABEL = `${HAND}font-size:18px;line-height:26px;color:${PEN_SOFT};`;
export const SHEET_VALUE = `${HAND}font-size:20px;line-height:26px;font-weight:700;color:${PEN};`;

/**
 * A piece of the sheet that gets written in its turn (`step`, the place in the
 * writing order) - in the mail apps that animate. Everywhere else it is simply
 * there.
 */
export function written(step: number, style: string, html: string, extraClass = ""): string {
  return `<div class="ils-w ils-d${step}${extraClass ? ` ${extraClass}` : ""}" style="${style}">${html}</div>`;
}

/** A label on the left, its value on the right. */
export function sheetRow(left: string, right: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="white-space:nowrap;" valign="middle">${left}</td>
      <td style="padding-left:12px;" align="right" valign="middle">${right}</td>
    </tr></table>`;
}

/** The sheet's title, underlined in red. Always the first thing written. */
export function sheetTitle(text: string): string {
  return written(0, `display:inline-block;margin:0 0 16px;${HAND}font-size:28px;line-height:34px;font-weight:700;color:${PEN};border-bottom:2px solid ${RED};`, esc(text));
}

/** "Datum ........ Petak, 2. oktobar" lines, written from `fromStep` on. */
export function sheetRows(rows: [string, string][], fromStep: number, struck = false): string {
  return rows.map(([l, v], i) =>
    written(fromStep + i, i ? "margin-top:4px;" : "", sheetRow(
      `<span style="${SHEET_LABEL}">${esc(l)}</span>`,
      struck ? strike(`<span style="${SHEET_VALUE}">${esc(v)}</span>`) : `<span style="${SHEET_VALUE}">${esc(v)}</span>`,
    ))).join("\n");
}

/** "Usluge:" and a bullet per treatment, from `fromStep` on. Returns the next free step. */
export function sheetList(label: string, items: { name: string; faint?: boolean }[], fromStep: number): { html: string; next: number } {
  return {
    next: fromStep + 1 + items.length,
    html: [
      written(fromStep, `margin-top:14px;${SHEET_LABEL}`, esc(label)),
      ...items.map((s, i) =>
        written(fromStep + 1 + i, `${HAND}font-size:20px;line-height:26px;font-weight:600;color:${s.faint ? PEN_FAINT : PEN};`, `•&nbsp;${esc(s.name)}`)),
    ].join("\n"),
  };
}

/** A note in red pen, slightly askew - the "↳ popust −20%" of the sheet. */
export function sheetNote(step: number, text: string, top = 0): string {
  return written(step, `${top ? `margin-top:${top}px;` : ""}${HAND}font-size:20px;line-height:26px;font-weight:700;color:${RED};`, esc(text), "ils-tilt");
}

/** "Ref. broj: #AB12CD34" at the bottom. */
export function sheetRef(step: number, ref: string): string {
  return written(step, `margin-top:20px;${HAND}font-size:18px;line-height:26px;color:${PEN};`,
    `Ref. broj: <span style="font-weight:700;letter-spacing:1px;">#${esc(ref)}</span>`);
}

/**
 * Struck through in red, the text itself left in its own ink: the line takes
 * the colour of the element that sets it, so the outer span is red and the
 * inner one keeps the text's colour. Works in Gmail and Outlook too.
 */
export function strike(html: string): string {
  return `<span style="color:${RED};text-decoration:line-through;"><span style="color:${PEN_SOFT};">${html}</span></span>`;
}

/** The lines laid on the squared paper, with the tape on top. */
export function paperSheet(lines: string): string {
  return `<div class="ils-sheet">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};border:1px solid #ECE5D3;border-radius:4px;box-shadow:0 2px 3px rgba(30,16,23,0.10),0 16px 32px -14px rgba(30,16,23,0.30);">
      <tr><td style="padding:0 18px 22px;color:${PEN};background-image:linear-gradient(${GRID} 1px,transparent 1px),linear-gradient(90deg,${GRID} 1px,transparent 1px);background-size:24px 24px;border-radius:4px;">
        <table role="presentation" class="ils-tape" align="center" cellpadding="0" cellspacing="0"><tr>
          <td style="width:112px;height:22px;background-color:${TAPE};font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
        <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
${lines}
      </td></tr>
    </table>
    </div>`;
}

/**
 * The extras for the mail apps that take them (Apple Mail; Gmail and Outlook
 * drop all of it): the Caveat hand, the paper laid down slightly askew and the
 * lines written one after another - 0.25 s + 0.3 s a line, like the site.
 * Only the animation hides anything, so where it doesn't run, nothing is ever
 * hidden. Reduced motion gets the finished sheet.
 */
export function paperHead(lastStep: number): string {
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
