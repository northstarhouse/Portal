// A submitted form as a clean PDF: a title, then each question with its answer.
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

let fontPromise: Promise<ArrayBuffer> | null = null;
function loadFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      let r = await fetch("https://northstarhouse.github.io/Portal/assets/fonts/NotoSans.ttf");
      if (!r.ok) r = await fetch("https://raw.githubusercontent.com/notofonts/noto-fonts/c971829a87e7920f960e7277c3dafd9bedd3c601/hinted/ttf/NotoSans/NotoSans-Regular.ttf");
      if (!r.ok) throw new Error("PDF font unavailable");
      return r.arrayBuffer();
    })().catch((e) => { fontPromise = null; throw e; });
  }
  return fontPromise;
}

export type FormItem = { kind: "heading"; text: string } | { kind: "qa"; label: string; text: string; note?: string };

export async function formPdf(title: string, subtitle: string, items: FormItem[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFont(), { subset: true });
  pdf.setTitle(title);
  const W = 504;
  let page: any, y = 0;
  const addPage = () => { page = pdf.addPage([612, 792]); y = 738; };
  const measure = (t: string, size: number) => font.widthOfTextAtSize(t, size);
  const line = (t: string, size: number, color: [number, number, number]) => {
    if (y < 60) addPage();
    page.drawText(t, { x: 54, y, size, font, color: rgb(...color) });
    y -= size * 1.55;
  };
  const para = (value: string, size: number, color: [number, number, number]) => {
    for (const raw of String(value).replace(/\r/g, "").split("\n")) {
      let cur = "";
      for (const word of raw.split(/\s+/).filter(Boolean)) {
        // a single very long word (a link) is broken where it overflows
        const pieces: string[] = [];
        if (measure(word, size) > W) { let c = ""; for (const ch of word) { if (measure(c + ch, size) > W) { pieces.push(c); c = ""; } c += ch; } if (c) pieces.push(c); } else pieces.push(word);
        for (const p of pieces) {
          const next = cur ? cur + " " + p : p;
          if (cur && measure(next, size) > W) { line(cur, size, color); cur = p; } else cur = next;
        }
      }
      line(cur, size, color);
    }
  };
  addPage();
  para(title, 17, [0.16, 0.15, 0.13]);
  para(subtitle, 9.5, [0.45, 0.42, 0.36]);
  y -= 8;
  for (const it of items) {
    if (it.kind === "heading") { y -= 8; if (y < 100) addPage(); para(it.text, 13, [0.53, 0.42, 0.27]); y -= 2; continue; }
    if (y < 90) addPage();
    para(it.label, 9.5, [0.53, 0.42, 0.27]);
    para(it.text || "(no answer)", 11, [0.16, 0.15, 0.13]);
    if (it.note) para("Note: " + it.note, 9.5, [0.45, 0.42, 0.36]);
    y -= 7;
  }
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) pages[i].drawText(`North Star House · ${i + 1} / ${pages.length}`, { x: 54, y: 30, size: 8, font, color: rgb(0.45, 0.42, 0.36) });
  return await pdf.save();
}
