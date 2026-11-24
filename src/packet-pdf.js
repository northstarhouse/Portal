// Builds the "entire packet" PDF for Human Resources: a summary of every answer and both signatures,
// followed by each official form the employee filled in (already made read-only by the caller).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PACKET_SECTIONS } from './onboarding-spec.js';

const GOLD = rgb(0.533, 0.424, 0.267);
const INK = rgb(0.17, 0.14, 0.09);
const MUTED = rgb(0.42, 0.37, 0.3);
const RULE = rgb(0.9, 0.87, 0.82);
const W = 612, H = 792, M = 54, RIGHT = W - M;

// The standard PDF fonts cannot draw every character, so anything unusual becomes a plain look-alike.
const safe = t => String(t == null ? '' : t)
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/·/g, '-')
  .replace(/[^\x20-\x7E -ÿ]/g, '?');

function wrap(text, font, size, maxW) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    par.split(/\s+/).filter(Boolean).forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else { if (line) out.push(line); line = word; }
    });
    out.push(line);
  });
  return out.length ? out : [''];
}

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

function answerFor(f, data, hr) {
  if (f.type === 'form') return data['doc_' + f.k] ? 'Filled out (attached after this summary)' : data['skip_' + f.k] ? 'Says already turned in' : '-';
  if (f.type === 'pending') return hr && hr.supervisor_sig ? hr.supervisor_sig + '   ' + fmtDate(hr.supervisor_date) : 'Not yet signed';
  const v = data[f.k];
  if (f.type === 'check') return v ? 'Yes' : 'No';
  return String(v || '').trim() || '-';
}

// p: the packet row. letterBytes: the letterhead JPEG (optional). formDocs: [{ label, bytes }] read-only filled forms.
export async function buildPacketPdf({ p, letterBytes, formDocs }) {
  const data = p.data || {}, hr = p.hr_received || {};
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  let page = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = h => { if (y - h < M + 20) newPage(); };

  if (letterBytes) {
    try {
      const img = await pdf.embedJpg(letterBytes);
      const w = W - 2 * M, h = (img.height / img.width) * w;
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      y -= h + 14;
    } catch (e) { /* letterhead is optional */ }
  }
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1.6, color: GOLD });
  y -= 24;
  const title = 'STAFF ONBOARDING PACKET';
  page.drawText(title, { x: (W - serifBold.widthOfTextAtSize(title, 18)) / 2, y, size: 18, font: serifBold, color: INK });
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 0.8, color: GOLD });
  y -= 22;
  page.drawText('EMPLOYEE', { x: M, y, size: 8, font: bold, color: GOLD });
  page.drawText(safe(p.person_name), { x: M + 58, y: y - 1, size: 12, font: bold, color: INK });
  const issued = 'ISSUED  ' + fmtDate(p.sent_at);
  page.drawText(issued, { x: RIGHT - reg.widthOfTextAtSize(issued, 9), y, size: 9, font: reg, color: MUTED });
  y -= 16;
  if (p.position) {
    page.drawText('POSITION', { x: M, y, size: 8, font: bold, color: GOLD });
    page.drawText(safe(p.position), { x: M + 58, y: y - 1, size: 11, font: reg, color: INK });
    y -= 16;
  }
  if (p.submitted_at) {
    page.drawText('SUBMITTED  ' + fmtDate(p.submitted_at), { x: M, y, size: 9, font: reg, color: MUTED });
    y -= 14;
  }
  y -= 6;

  PACKET_SECTIONS.forEach((s, n) => {
    need(60);
    y -= 12;
    page.drawText(safe((n + 1) + '.  ' + s.title.toUpperCase()), { x: M, y, size: 11, font: serifBold, color: INK });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: GOLD });
    y -= 14;
    s.fields.forEach(f => {
      const labelLines = wrap(safe(f.label), reg, 9, 250);
      const isSig = f.type === 'sig' || (f.type === 'pending' && hr.supervisor_sig);
      const valFont = isSig ? script : reg, valSize = isSig ? 15 : 10;
      const isCheck = f.type === 'check';
      const valLines = isCheck ? [''] : wrap(safe(answerFor(f, data, hr)), valFont, valSize, 232);
      const rowH = Math.max(labelLines.length * 11, valLines.length * (valSize + 2)) + 8;
      need(rowH);
      labelLines.forEach((ln, i) => page.drawText(ln, { x: M, y: y - 9 - i * 11, size: 9, font: reg, color: MUTED }));
      if (isCheck) {
        const bx = RIGHT - 11, by = y - 12;
        page.drawRectangle({ x: bx, y: by, width: 11, height: 11, borderColor: GOLD, borderWidth: 1.2 });
        if (data[f.k]) {
          page.drawLine({ start: { x: bx + 2, y: by + 5.5 }, end: { x: bx + 4.6, y: by + 2.5 }, thickness: 1.4, color: INK });
          page.drawLine({ start: { x: bx + 4.6, y: by + 2.5 }, end: { x: bx + 9, y: by + 9 }, thickness: 1.4, color: INK });
        }
      }
      valLines.forEach((ln, i) => {
        const wd = valFont.widthOfTextAtSize(ln, valSize);
        page.drawText(ln, { x: RIGHT - wd, y: y - 9 - i * (valSize + 2), size: valSize, font: valFont, color: INK });
      });
      y -= rowH;
      page.drawLine({ start: { x: M, y: y + 3 }, end: { x: RIGHT, y: y + 3 }, thickness: 0.4, color: RULE });
    });
  });

  // the official forms, as read-only copies
  for (const doc of formDocs || []) {
    try {
      const src = await PDFDocument.load(doc.bytes);
      const pages = await pdf.copyPages(src, src.getPageIndices());
      pages.forEach(pg => pdf.addPage(pg));
    } catch (e) { /* skip a form that cannot be merged */ }
  }
  return pdf.save();
}
