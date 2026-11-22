/**
 * The email for a gift-box order (/paketici). It goes to the buyer with a
 * hidden copy to the studio, or - when the buyer left no address - to the
 * studio alone. Either way it carries the whole order, so the studio can pack
 * and deliver from it.
 */
import { getLocation } from "@/lib/locations";
import {
  DELIVERY_LABEL, OCCASION_LABEL, PAYMENT_LABEL, VERSION_LABEL, formatRsd,
  type Delivery, type Occasion, type Payment, type GiftVersion,
} from "@/lib/paketici";
import { FONT, INK, MUTED, LINE, LABEL, PHONE_DISPLAY, emailDocument, esc, firstNameOf, row } from "./layout";

export interface GiftOrderEmail {
  orderNo: number;
  version: GiftVersion;
  summary: string;
  bonus: string | null;
  total: number;
  occasion: Occasion;
  dedication: string;
  delivery: Delivery;
  payment: Payment;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  deliveryNote: string | null;
}

const studio = () => getLocation("novi_sad");

function whereLine(d: GiftOrderEmail): string {
  if (d.delivery === "studio") return `Lično preuzimanje - ${studio().address}, ${studio().name}`;
  const place = d.delivery === "novi_sad" ? "Novi Sad" : [d.postalCode, d.city].filter(Boolean).join(" ");
  return [d.address, place].filter(Boolean).join(", ");
}

function rows(d: GiftOrderEmail): [string, string][] {
  const out: [string, string][] = [
    ["Paketić", VERSION_LABEL[d.version]],
    ["Voucher", d.summary],
  ];
  if (d.bonus) out.push(["Gratis", `${d.bonus} (1 tretman)`]);
  out.push(
    ["Ukupno", formatRsd(d.total)],
    ["Plaćanje", PAYMENT_LABEL[d.payment]],
    ["Preuzimanje", DELIVERY_LABEL[d.delivery]],
    ["Adresa", whereLine(d)],
    ["Ime", d.name],
    ["Telefon", d.phone],
  );
  if (d.email) out.push(["Email", d.email]);
  out.push(["Stiker", OCCASION_LABEL[d.occasion]]);
  if (d.deliveryNote) out.push(["Napomena", d.deliveryNote]);
  return out;
}

export function giftEmailSubject(d: GiftOrderEmail, toBuyer: boolean): string {
  return toBuyer
    ? `Tvoj Infinity paketić br. ${d.orderNo} je ${d.delivery === "studio" ? "rezervisan" : "poručen"}`
    : `Nova porudžbina: paketić br. ${d.orderNo} - ${d.name}`;
}

export function giftEmailHtml(d: GiftOrderEmail, toBuyer: boolean): string {
  const first = firstNameOf(d.name);
  const pickup = d.delivery === "studio";
  const lead = toBuyer
    ? `${first ? `${esc(first)}, h` : "H"}vala! Tvoj paketić je ${pickup ? "rezervisan" : "poručen"}. Javićemo ti se telefonom da potvrdimo ${pickup ? "kada možeš da ga preuzmeš" : "dostavu"}.`
    : `Nova porudžbina sa stranice /paketici. Pozvati kupca radi potvrde.`;

  const table = rows(d).map(([k, v]) => row(esc(k), esc(v))).join("");
  const dedication = d.dedication
    ? `<p style="${LABEL}margin:22px 0 6px;">Posveta na kartončiću</p>
       <p style="${FONT}margin:0;padding:14px 16px;background:#FBF6EC;border:1px solid #EADBC0;border-radius:10px;font-size:15px;line-height:23px;color:${INK};white-space:pre-line;">${esc(d.dedication)}</p>`
    : `<p style="${FONT}margin:22px 0 0;font-size:13px;line-height:20px;color:${MUTED};">Bez posvete - ${pickup ? "kupac je piše sam pri preuzimanju" : "kartončić ostaje prazan"}.</p>`;

  const body = `
  <tr><td style="padding:18px 28px 0;">
    <p style="${FONT}margin:0;font-size:22px;line-height:29px;color:${INK};font-weight:700;">Paketić br. ${d.orderNo}</p>
    <p style="${FONT}margin:10px 0 0;font-size:15px;line-height:23px;color:${MUTED};">${lead}</p>
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">${table}</table>
    ${dedication}
    ${toBuyer ? `<p style="${FONT}margin:22px 0 0;font-size:13px;line-height:20px;color:${MUTED};">Pitanja? Pozovi nas: ${PHONE_DISPLAY}.</p>` : ""}
  </td></tr>`;

  return emailDocument({
    title: giftEmailSubject(d, toBuyer),
    preheader: `${d.summary} · ${formatRsd(d.total)}`,
    studio: studio(),
    body,
  });
}

export function giftEmailText(d: GiftOrderEmail, toBuyer: boolean): string {
  const lines = [
    `Paketić br. ${d.orderNo}`,
    toBuyer ? "Hvala! Javićemo ti se telefonom da potvrdimo porudžbinu." : "Nova porudžbina sa stranice /paketici.",
    "",
    ...rows(d).map(([k, v]) => `${k}: ${v}`),
    "",
    d.dedication ? `Posveta:\n${d.dedication}` : "Bez posvete.",
  ];
  if (toBuyer) lines.push("", `Pitanja? ${PHONE_DISPLAY}`);
  return lines.join("\n");
}
