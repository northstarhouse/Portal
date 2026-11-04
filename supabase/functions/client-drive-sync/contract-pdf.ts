// The signed contract as a PDF laid out like the contract in the Portal: a serif document with a centred title,
// small gold section headings, bold clause titles, and signature blocks, followed by the signature record.
import { PDFDocument, rgb, type PDFFont } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const FONT_BASE = "https://raw.githubusercontent.com/notofonts/noto-fonts/c971829a87e7920f960e7277c3dafd9bedd3c601/hinted/ttf/NotoSerif/NotoSerif-";
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
const INK: RGB = [0.165, 0.141, 0.125];      // #2a2420
const GOLD: RGB = [0.533, 0.424, 0.267];     // #886c44
const MUTED: RGB = [0.42, 0.373, 0.31];      // #6b5f4f
const RULE: RGB = [0.902, 0.875, 0.827];     // #e6dfd3
type Seg = { t: string; f: PDFFont; c?: RGB };

const PAGE_W = 612, PAGE_H = 792, LEFT = 78, WIDTH = PAGE_W - 2 * LEFT, TOP = 712, BOTTOM = 78;

function when(iso: string) {
  try { return new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/Los_Angeles" } as Intl.DateTimeFormatOptions) + " PT"; } catch (_e) { return String(iso || ""); }
}

export async function contractPdf(version: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [rb, bb, ib] = await loadFonts();
  const reg = await pdf.embedFont(rb, { subset: true });
  const bold = await pdf.embedFont(bb, { subset: true });
  const ital = await pdf.embedFont(ib, { subset: true });
  pdf.setTitle(String(version.title || "Venue Rental Agreement"));
  pdf.setSubject("North Star House agreement version " + version.version);

  let page: any, y = TOP;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 34, y: 34, width: PAGE_W - 68, height: PAGE_H - 68, borderColor: rgb(...RULE), borderWidth: 0.8 });
    page.drawRectangle({ x: 39, y: 39, width: PAGE_W - 78, height: PAGE_H - 78, borderColor: rgb(0.98, 0.968, 0.945), borderWidth: 3 });
    y = TOP;
  };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };
  const w = (f: PDFFont, t: string, size: number) => f.widthOfTextAtSize(t, size);

  // greedy word wrap over text segments that may use different fonts
  function wrap(segs: Seg[], size: number, width: number): Seg[][] {
    const toks: Seg[] = [];
    for (const s of segs) for (const part of s.t.split(/(\s+)/)) if (part !== "") toks.push({ t: part, f: s.f, c: s.c });
    const lines: Seg[][] = [[]]; let used = 0;
    for (const tk of toks) {
      const isSpace = /^\s+$/.test(tk.t);
      const tw = w(tk.f, isSpace ? " " : tk.t, size);
      if (isSpace) { if (used > 0) { lines[lines.length - 1].push({ ...tk, t: " " }); used += tw; } continue; }
      if (used + tw > width && used > 0) { lines.push([]); used = 0; }
      if (tw > width) { // a very long unbroken string (a link or hash) is broken where it overflows
        let chunk = "";
        for (const ch of tk.t) { if (w(tk.f, chunk + ch, size) > width) { lines[lines.length - 1].push({ ...tk, t: chunk }); lines.push([]); chunk = ""; used = 0; } chunk += ch; }
        lines[lines.length - 1].push({ ...tk, t: chunk }); used = w(tk.f, chunk, size); continue;
      }
      lines[lines.length - 1].push(tk); used += tw;
    }
    return lines.map((l) => { while (l.length && l[l.length - 1].t === " ") l.pop(); return l; });
  }
  function drawSegs(line: Seg[], size: number, x: number, yy: number, align: "left" | "center") {
    const total = line.reduce((n, s) => n + w(s.f, s.t, size), 0);
    let cx = align === "center" ? (PAGE_W - total) / 2 : x;
    for (const s of line) { page.drawText(s.t, { x: cx, y: yy, size, font: s.f, color: rgb(...(s.c || INK)) }); cx += w(s.f, s.t, size); }
  }
  function para(segs: Seg[], size = 10.5, o: { align?: "left" | "center"; after?: number; indent?: number; lh?: number } = {}) {
    const x = LEFT + (o.indent || 0);
    for (const line of wrap(segs, size, WIDTH - (o.indent || 0))) {
      ensure(size * 1.6);
      drawSegs(line, size, x, y, o.align || "left");
      y -= size * (o.lh || 1.55);
    }
    y -= o.after ?? 6;
  }
  function spaced(text: string, size: number, x: number, yy: number, spacing: number, f: PDFFont, c: RGB) {
    let cx = x;
    for (const ch of text) { page.drawText(ch, { x: cx, y: yy, size, font: f, color: rgb(...c) }); cx += w(f, ch, size) + spacing; }
  }

  newPage();
  spaced("NORTH STAR HOUSE", 8, (PAGE_W - (w(bold, "NORTH STAR HOUSE", 8) + 15 * 2.4)) / 2, y, 2.4, bold, GOLD);
  y -= 30;

  // ---- the agreement text, laid out the way the Portal shows it ----
  const lines = String(version.body || "").replace(/\r/g, "").split("\n");
  let inList = false;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^- /.test(line)) {
      ensure(16);
      page.drawText("•", { x: LEFT + 6, y, size: 10.5, font: reg, color: rgb(...GOLD) });
      for (const l of wrap([{ t: line.slice(2), f: reg }], 10.5, WIDTH - 26)) { ensure(16); drawSegs(l, 10.5, LEFT + 22, y, "left"); y -= 10.5 * 1.5; }
      y -= 3; inList = true; return;
    }
    if (inList) { y -= 5; inList = false; }
    if (!line.trim()) return;
    if (i === 0) { para([{ t: line, f: reg }], 22, { align: "center", after: 4, lh: 1.25 }); return; }
    if (i === 1) { para([{ t: line, f: reg, c: MUTED }], 10.5, { align: "center", after: 14 }); return; }
    if (/^(Event Details:|Signatures|Payment schedule:)$/.test(line.trim())) {
      y -= 10; ensure(46);
      spaced(line.replace(/:$/, "").toUpperCase(), 9, LEFT, y, 1.8, bold, GOLD);
      y -= 6; page.drawLine({ start: { x: LEFT, y }, end: { x: LEFT + WIDTH, y }, thickness: 0.7, color: rgb(...RULE) });
      y -= 16; return;
    }
    const clause = line.match(/^(\d{1,2}\.\s+[^.]{2,80}\.)(\s.*)?$/);
    if (clause) { para([{ t: clause[1], f: bold }, { t: clause[2] || "", f: reg }], 10.5, { after: 8 }); return; }
    const kv = line.match(/^(Event Date|Max Estimated Guest Count|Contract Date|Client|For North Star Historic Conservancy|Venue rental invoice total[^:]*):\s*(.*)$/);
    if (kv) { para([{ t: kv[1] + ": ", f: bold }, { t: kv[2], f: reg }], 10.5, { after: 3 }); return; }
    para([{ t: line, f: reg }], 10.5, { after: 8 });
  });
  if (inList) y -= 5;

  // ---- signature blocks ----
  const signers: any[] = version.recipients || [];
  if (signers.length) {
    ensure(110); y -= 6;
    for (const s of signers) {
      ensure(86);
      const signed = s.status === "signed";
      if (signed) page.drawText(String(s.signed_name || s.name), { x: LEFT + 4, y: y - 4, size: 20, font: ital, color: rgb(0.11, 0.1, 0.25) });
      else page.drawText("Waiting to sign", { x: LEFT + 4, y: y - 2, size: 11, font: ital, color: rgb(...MUTED) });
      y -= 12;
      page.drawLine({ start: { x: LEFT, y }, end: { x: LEFT + 300, y }, thickness: 0.8, color: rgb(...INK) });
      y -= 13;
      para([{ t: `${s.name || ""} · ${s.role === "venue" ? "Venue countersigner" : "Client"}${s.email ? " · " + s.email : ""}`, f: reg, c: MUTED }], 9, { after: 1 });
      para([{ t: signed ? `Signed ${when(s.signed_at)} · Locked, read-only` : "Not yet signed", f: ital, c: MUTED }], 8.5, { after: 16 });
    }
  }

  // ---- signature record (kept for the file) ----
  newPage();
  para([{ t: "Electronic signature record", f: reg }], 17, { after: 10, lh: 1.3 });
  const small = (t: string, f = reg, c: RGB = INK, size = 9) => para([{ t, f, c }], size, { after: 3, lh: 1.45 });
  small(`Agreement version ${version.version} · Document ID ${version.id}`);
  small(`Document SHA-256: ${version.document_hash || "DRAFT - not issued"}`);
  for (const s of signers) {
    y -= 8;
    small(`${s.name || ""} (${s.role})`, bold, INK, 10);
    small(String(s.email || ""), reg, MUTED);
    small(s.status === "signed" ? `Signed as ${s.signed_name} at ${when(s.signed_at)}` : `Status: ${s.status}`);
    if (s.consent) small(String(s.consent), reg, MUTED, 8.5);
    if (s.evidence) small("Verification evidence: " + JSON.stringify(s.evidence), reg, MUTED, 7.5);
  }
  y -= 10;
  small("Audit history", bold, INK, 11);
  for (const e of version.events || []) small(`${e.created_at} | ${e.action} | ${e.actor}${e.detail && Object.keys(e.detail).length ? " | " + JSON.stringify(e.detail) : ""}`, reg, MUTED, 7.5);

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const t = `North Star House · Venue Rental Agreement · Version ${version.version} · ${i + 1} / ${pages.length}`;
    p.drawText(t, { x: (PAGE_W - w(reg, t, 7.5)) / 2, y: 50, size: 7.5, font: reg, color: rgb(...MUTED) });
  });
  return await pdf.save();
}
