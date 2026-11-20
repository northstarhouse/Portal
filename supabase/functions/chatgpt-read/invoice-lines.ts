// What a client ordered, as the lines of their invoice, named the way the venue team writes them: Saturday Wedding,
// Security Deposit (refundable), Rehearsal, Extra Hours, Complimentary brick included. Pure functions (no network), so
// they can be tested on their own. Used by index.ts when it builds a client's Invoice.pdf.
// Copy of client-drive-sync/invoice-lines.ts (the invoice line rules). Keep the two in step.
export type InvoiceLine = { item: string; desc: string; qty: number; unit: number; amount: number; child?: boolean; deposit?: boolean };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

export function weekdayOf(iso: string): string {
  const m = String(iso || "").match(ISO);
  return m ? DAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).getUTCDay()] : "";
}
export function longDay(iso: string): string {
  const m = String(iso || "").match(ISO);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
}
// The client's venue code is the event date, like NOV-14-2026.
export function venueCode(iso: string): string {
  const m = String(iso || "").match(ISO);
  return m ? MONTHS[+m[2] - 1] + "-" + m[3] + "-" + m[1] : "";
}

const plain = (h: unknown) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// The dressing rooms and planning-session perks that HoneyBook put in the wedding description are not shown on the invoice.
const withoutPerks = (d: string) => d
  .replace(/\s*Two Private Dressing Rooms for use during your event\.?/gi, '')
  .replace(/\s*Includes (?:\d+|one|two|three|four) planning sessions? with (?:the )?Venue Coordinator\.?/gi, '')
  .replace(/\s+/g, ' ').trim();
const isDeposit = (t: unknown) => /security deposit/i.test(String(t || ""));
// A bare "Wedding" or "Private Event" line gets the day it is on.
const GENERIC_RENTAL = /^(wedding|private event|memorial|non-?profit event|public event|corporate event|event)$/i;
// Refundable is said once, in the item name, so it is taken out of the description.
const cleanDepositDesc = (d: string) => {
  const x = d.replace(/refundable\s+security\s+deposit/gi, "").replace(/^[\s,.;:\-–—]+/, "").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "";
};
// Add-ons from the client page (extra hours, a rehearsal) come after the original agreement.
const isLaterAddOn = (label: unknown) => /^extra rental hours/i.test(String(label || "")) || /rehearsal/i.test(String(label || ""));
export const isLaterAddOnRow = (r: { label?: unknown }) => isLaterAddOn(r.label);

export type OrderInput = {
  order: any | null;                                 // a saved order (Wyn's estimate / final invoice), when there is one
  honeybook: any | null;                             // the HoneyBook invoice's payments object
  nativeRows: { kind?: string; label?: string; amount_cents?: number }[] | null; // the Portal's own payment schedule
  eventDate: string;
  eventType: string;
  brickLines: string[];
  timeOnSite: { start?: string; end?: string } | null;
};

export function orderLinesFor(i: OrderInput): InvoiceLine[] {
  // 1. a saved order is exactly what was ordered
  if (i.order && Array.isArray(i.order.items) && i.order.items.length) {
    return i.order.items.map((x: any) => {
      const qty = Number(x.qty) || 0, unit = Number(x.unit) || 0;
      return { item: String(x.item || "Item"), desc: String(x.desc || ""), qty, unit, amount: Math.round(qty * unit), deposit: !!x.deposit };
    }).filter((l: InvoiceLine) => l.qty > 0 || l.unit !== 0);
  }
  const out: InvoiceLine[] = [];
  const day = weekdayOf(i.eventDate);
  const P = i.honeybook;
  if (P) {
    // 2. a HoneyBook invoice: its lines, renamed the venue team's way
    const add = (li: any) => {
      const qty = li.quantity == null ? 1 : li.quantity, unit = li.price?.amount || 0;
      if (!(unit > 0) && !(qty > 0)) return;
      const title = String(li.title || "Item").trim();
      let item = title, desc = withoutPerks(plain(li.description)), deposit = false;
      if (isDeposit(title)) { item = "Security Deposit (refundable)"; desc = cleanDepositDesc(desc); deposit = true; }
      else if (/^additional hour/i.test(title)) item = "Extra Hours";
      else if (/^rehearsal/i.test(title)) item = "Rehearsal";
      else if (GENERIC_RENTAL.test(title) && day) { item = day + " " + title; if (!desc) desc = longDay(i.eventDate); }
      out.push({ item, desc, qty, unit, amount: Math.round(unit * qty), deposit });
    };
    for (const li of P.line_items || []) { add(li); for (const k of li.children || []) add(k); }
    // HoneyBook keeps the quantity of extra hours at 1 even when the invoice total covers more, so the hours are
    // worked out from what the invoice total is above the other lines.
    const want = P.total?.amount;
    if (typeof want === "number") {
      const diff = want - out.reduce((t, l) => t + l.amount, 0) - (P.discount?.amount > 0 ? -P.discount.amount : 0) - (P.tax?.amount > 0 ? P.tax.amount : 0);
      const hours = out.find((l) => l.item === "Extra Hours");
      if (diff > 0 && hours && hours.unit > 0 && diff % hours.unit === 0) { hours.qty += diff / hours.unit; hours.amount = Math.round(hours.qty * hours.unit); }
    }
    if (P.discount?.amount > 0) out.push({ item: "Discount", desc: "", qty: 1, unit: -P.discount.amount, amount: -P.discount.amount });
    if (P.tax?.amount > 0) out.push({ item: "Tax", desc: "", qty: 1, unit: P.tax.amount, amount: P.tax.amount });
  } else if (i.nativeRows) {
    // 3. a booking made in the Portal: the rental is everything on the schedule that is not the deposit
    const rows = i.nativeRows.filter((r) => !isLaterAddOn(r.label));
    const isDep = (r: any) => /security/i.test(String(r.kind || "") + " " + String(r.label || ""));
    const rental = rows.filter((r) => !isDep(r)).reduce((t, r) => t + (r.amount_cents || 0), 0);
    const dep = rows.filter(isDep).reduce((t, r) => t + (r.amount_cents || 0), 0);
    const tos = i.timeOnSite && i.timeOnSite.start ? ", on site " + i.timeOnSite.start + (i.timeOnSite.end ? " to " + i.timeOnSite.end : "") : "";
    if (rental) out.push({ item: [day, i.eventType].filter(Boolean).join(" ") || "Rental", desc: longDay(i.eventDate) + tos, qty: 1, unit: rental, amount: rental });
    if (dep) out.push({ item: "Security Deposit (refundable)", desc: "", qty: 1, unit: dep, amount: dep, deposit: true });
  }
  // weddings include a brick
  if (i.eventType === "Wedding" && !out.some((l) => /brick/i.test(l.item))) {
    out.push({ item: "Complimentary brick included", desc: i.brickLines.map((l) => String(l || "").trim()).filter(Boolean).join(" / "), qty: 1, unit: 0, amount: 0 });
  }
  return out;
}
