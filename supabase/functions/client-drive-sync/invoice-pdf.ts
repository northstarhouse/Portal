// A branded North Star House invoice as a PDF: logo band, bill-to, event details, what was ordered at what price,
// totals, and the payment schedule with what is paid and what is still due. Same serif look as the signed contract.
import { PDFDocument, rgb, type PDFFont } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const FONT_BASE = "https://raw.githubusercontent.com/notofonts/noto-fonts/c971829a87e7920f960e7277c3dafd9bedd3c601/hinted/ttf/NotoSerif/NotoSerif-";
const HOUSE_URL = "https://northstarhouse.github.io/Portal/assets/invoice-house.png";
const LOGO_URL = "https://northstarhouse.github.io/Portal/assets/logo.png";
let fontsPromise: Promise<ArrayBuffer[]> | null = null;
function loadFonts(): Promise<ArrayBuffer[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all(["Regular", "Bold", "Italic"].map(async (n) => {
      const r = await fetch(`${FONT_BASE}${n}.ttf`);
      if (!r.ok) throw new Error("PDF font unavailable");
      return r.arrayBuffer();
    })).catch((e) => { fontsPromise = null; throw e; });
  }
  return fontsPromise;
}

type RGB = [number, number, number];
const INK: RGB = [0.165, 0.141, 0.125];   // #2a2420 (text)
const BAND: RGB = [0.463, 0.412, 0.361];   // #76695c brown-gray (header band and total bar)
const GOLD: RGB = [0.533, 0.424, 0.267];  // #886c44
const MUTED: RGB = [0.42, 0.373, 0.31];   // #6b5f4f
const RULE: RGB = [0.902, 0.875, 0.827];  // #e6dfd3
const CREAM: RGB = [0.98, 0.965, 0.937];  // #faf6ef
const GREEN: RGB = [0.26, 0.42, 0.29];    // #426b4a

export type InvoiceLine = { item: string; desc: string; qty: number; unit: number; amount: number; child?: boolean; deposit?: boolean };
export type InvoicePayment = { label: string; due: string | null; cents: number; paid: boolean; paidAt?: string | null; deposit?: boolean };
export type InvoiceData = {
  number: string; issued: string; eventName: string; eventDate: string | null; eventType: string;
  clients: { name: string; email?: string; phone?: string }[];
  lines: InvoiceLine[]; total: number; paid: number; balance: number; payments: InvoicePayment[];
};

const PAGE_W = 612, PAGE_H = 792, LEFT = 54, RIGHT = PAGE_W - 54, WIDTH = RIGHT - LEFT, BOTTOM = 70;
const usd = (cents: number) => (cents < 0 ? "-" : "") + "$" + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function longDate(iso: string | null) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "To be confirmed";
}

export async function invoicePdf(inv: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [rb, bb, ib] = await loadFonts();
  const reg = await pdf.embedFont(rb, { subset: true });
  const bold = await pdf.embedFont(bb, { subset: true });
  const ital = await pdf.embedFont(ib, { subset: true });
  pdf.setTitle(`Invoice ${inv.number} - ${inv.eventName}`);
  pdf.setSubject("North Star House venue rental invoice");
  let logo: any = null;
  try { const r = await fetch(LOGO_URL); if (r.ok) logo = await pdf.embedPng(new Uint8Array(await r.arrayBuffer())); } catch (_e) { /* falls back to a text wordmark */ }

  let house: any = null;
  try { const r = await fetch(HOUSE_URL); if (r.ok) house = await pdf.embedPng(new Uint8Array(await r.arrayBuffer())); } catch (_e) { /* the icon is optional */ }

  let page: any, y = 0;
  const w = (f: PDFFont, t: string, s: number) => f.widthOfTextAtSize(t, s);
  const text = (t: string, x: number, yy: number, size: number, f: PDFFont = reg, c: RGB = INK) => page.drawText(t, { x, y: yy, size, font: f, color: rgb(...c) });
  const right = (t: string, xr: number, yy: number, size: number, f: PDFFont = reg, c: RGB = INK) => text(t, xr - w(f, t, size), yy, size, f, c);
  const spaced = (t: string, x: number, yy: number, size: number, sp: number, f: PDFFont, c: RGB) => { let cx = x; for (const ch of t) { text(ch, cx, yy, size, f, c); cx += w(f, ch, size) + sp; } };
  const rule = (yy: number, c: RGB = RULE, th = 0.7) => page.drawLine({ start: { x: LEFT, y: yy }, end: { x: RIGHT, y: yy }, thickness: th, color: rgb(...c) });
  const wrapText = (t: string, f: PDFFont, size: number, width: number): string[] => {
    const out: string[] = []; let line = "";
    for (const word of String(t || "").replace(/\s+/g, " ").trim().split(" ")) {
      if (!word) continue;
      const tryLine = line ? line + " " + word : word;
      if (w(f, tryLine, size) > width && line) { out.push(line); line = word; } else line = tryLine;
    }
    if (line) out.push(line);
    return out;
  };

  const newPage = (first: boolean) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    if (first) {
      // dark brown-gray header band: the white North Star House logo on the left, INVOICE with the venue code and date on the right
      const BH = 124;
      page.drawRectangle({ x: 0, y: PAGE_H - BH, width: PAGE_W, height: BH, color: rgb(...BAND) });
      page.drawRectangle({ x: 0, y: PAGE_H - BH - 3, width: PAGE_W, height: 3, color: rgb(...GOLD) });
      if (logo) { const lw = 205, lh = lw * logo.height / logo.width; page.drawImage(logo, { x: LEFT, y: PAGE_H - BH / 2 - lh / 2, width: lw, height: lh }); }
      else spaced("NORTH STAR HOUSE", LEFT, PAGE_H - 66, 16, 2.5, bold, [1, 1, 1]);
      right("INVOICE", RIGHT, PAGE_H - 56, 30, reg, [1, 1, 1]);
      right("VENUE CODE  " + inv.number, RIGHT, PAGE_H - 80, 9.5, bold, [0.9, 0.86, 0.78]);
      right("DATE ISSUED  " + longDate(inv.issued), RIGHT, PAGE_H - 95, 9.5, reg, [0.9, 0.86, 0.78]);
      y = PAGE_H - 162;
    } else {
      text("North Star House · Invoice · " + inv.number, LEFT, PAGE_H - 44, 9, ital, MUTED);
      y = PAGE_H - 70;
    }
  };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(false); };

  newPage(true);

  // ---- from / bill to / dates ----
  const colB = 318;
  spaced("FROM", LEFT, y, 8, 1.8, bold, GOLD); spaced("BILLED TO", colB, y, 8, 1.8, bold, GOLD);
  y -= 15;
  const fromLines = ["North Star Historic Conservancy", "PO Box 1538", "Grass Valley, CA 95945"];
  const toLines: string[] = [];
  for (const c of inv.clients) { toLines.push(c.name); if (c.email) toLines.push(c.email); if (c.phone) toLines.push(c.phone); }
  if (!toLines.length) toLines.push(inv.eventName);
  const rowsN = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < rowsN; i++) {
    if (fromLines[i]) text(fromLines[i], LEFT, y, 10, i === 0 ? bold : reg, i === 0 ? INK : MUTED);
    if (toLines[i]) text(toLines[i], colB, y, 10, /@|^\+?[\d(]/.test(toLines[i]) ? reg : bold, /@|^\+?[\d(]/.test(toLines[i]) ? MUTED : INK);
    y -= 14;
  }
  y -= 8;

  // event band
  page.drawRectangle({ x: LEFT, y: y - 46, width: WIDTH, height: 46, color: rgb(...CREAM), borderColor: rgb(...RULE), borderWidth: 0.7 });
  const cell = (label: string, value: string, x: number) => { spaced(label, x, y - 15, 7.5, 1.5, bold, GOLD); text(value, x, y - 33, 10.5, bold, INK); };
  cell("EVENT", inv.eventName.length > 34 ? inv.eventName.slice(0, 33) + "…" : inv.eventName, LEFT + 14);
  cell("EVENT DATE", longDate(inv.eventDate), 292);
  cell("EVENT TYPE", inv.eventType, 438);
  y -= 74;

  // ---- what was ordered ----
  spaced("WHAT WAS ORDERED", LEFT, y, 8, 1.8, bold, GOLD); y -= 8; rule(y); y -= 16;
  const X_QTY = 392, X_PRICE = 468, X_AMT = RIGHT;
  const head = () => { spaced("ITEM", LEFT, y, 7.5, 1.4, bold, MUTED); right("QTY", X_QTY, y, 7.5, bold, MUTED); right("PRICE", X_PRICE, y, 7.5, bold, MUTED); right("AMOUNT", X_AMT, y, 7.5, bold, MUTED); y -= 6; rule(y); y -= 15; };
  head();
  if (!inv.lines.length) { text("No itemized invoice is on file for this booking yet.", LEFT, y, 10, ital, MUTED); y -= 20; }
  for (const l of inv.lines) {
    const indent = l.child ? 14 : 0;
    const titleLines = wrapText(l.item + (l.deposit && !/refundable/i.test(l.item + " " + l.desc) ? " (refundable)" : ""), l.child ? reg : bold, 10.5, X_QTY - 36 - LEFT - indent);
    const descLines = l.desc ? wrapText(l.desc, ital, 9, X_QTY - 36 - LEFT - indent) : [];
    const need = (titleLines.length * 14) + (descLines.length * 12) + 10;
    if (y - need < BOTTOM + 150) { newPage(false); head(); }
    const top = y;
    titleLines.forEach((t, i) => { text(t, LEFT + indent, y, 10.5, l.child ? reg : bold); if (i < titleLines.length - 1) y -= 14; });
    right(String(l.qty), X_QTY, top, 10); right(usd(l.unit), X_PRICE, top, 10); right(usd(l.amount), X_AMT, top, 10.5, bold);
    y -= 13;
    for (const d of descLines) { text(d, LEFT + indent, y, 9, ital, MUTED); y -= 12; }
    y -= 4; rule(y, RULE, 0.5); y -= 13;
  }

  // ---- totals ----
  ensure(120);
  const tl = 372;
  const trow = (label: string, value: string, f: PDFFont = reg, c: RGB = INK, size = 10.5) => { text(label, tl, y, size, f, c); right(value, X_AMT, y, size, f, c); y -= 17; };
  y -= 2;
  // the invoice as agreed: no paid / balance, those live in the Portal
  y -= 6;
  page.drawRectangle({ x: tl - 10, y: y - 8, width: RIGHT - tl + 10, height: 28, color: rgb(...BAND) });
  text("INVOICE TOTAL", tl, y + 2, 10.5, bold, [1, 1, 1]);
  right(usd(inv.total), X_AMT - 12, y + 2, 13, bold, [1, 1, 1]);
  y -= 40;

  // ---- payment schedule ----
  if (inv.payments.length) {
    ensure(60 + inv.payments.length * 18);
    spaced("PAYMENT SCHEDULE", LEFT, y, 8, 1.8, bold, GOLD); y -= 8; rule(y); y -= 16;
    for (const p of inv.payments) {
      ensure(22);
      text(p.label + (p.deposit && !/refundable/i.test(p.label) ? " (refundable)" : ""), LEFT, y, 10, reg);
      text(p.due ? "Due " + longDate(p.due) : "Due date to be confirmed", 300, y, 9.5, reg, MUTED);
      right(usd(p.cents), X_AMT, y, 10, bold);
      y -= 18;
    }
  }

  // ---- note ----
  ensure(46); y -= 8;
  for (const t of wrapText("The security deposit is returned after the event, provided the venue is left in the condition it was found. Thank you for choosing North Star House.", ital, 9, WIDTH)) { text(t, LEFT, y, 9, ital, MUTED); y -= 12; }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: LEFT, y: 54 }, end: { x: RIGHT, y: 54 }, thickness: 0.7, color: rgb(...RULE) });
    const t = `North Star Historic Conservancy · PO Box 1538, Grass Valley, CA 95945 · thenorthstarhouse.org`;
    p.drawText(t, { x: (PAGE_W - w(reg, t, 7.5)) / 2, y: 40, size: 7.5, font: reg, color: rgb(...MUTED) });
    if (pages.length > 1) p.drawText(`${i + 1} / ${pages.length}`, { x: LEFT, y: 28, size: 7.5, font: reg, color: rgb(...MUTED) });
    if (house) { const hw = 66, hh = hw * house.height / house.width; p.drawImage(house, { x: RIGHT - hw, y: 8, width: hw, height: hh }); }
  });
  return await pdf.save();
}
