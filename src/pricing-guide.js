// The printable Pricing Guide (Venue Rentals > Tools > Policies & Resources > "Print pricing guide").
// Two pages that print like the venue's handout: the North Star House guide, then the Non-Profit guide.
// To change a price or a time, edit the numbers below; the printout reads only from this list.
export const PRICING_GUIDES = [
  {
    title: 'North Star House Pricing Guide 2027',
    note: 'Guide is for informational purposes only - please refer walk-ins to website for booking',
    // each group is a block between the gray lines; each section has a bold heading, small text, and lines
    groups: [
      [
        { head: 'Weddings:', inline: '$5000' },
        { head: 'Rehearsals (<u>Subject to Availability</u>) - 5 hours on site', small: '(5pm-10pm)', lines: ['Thurs/Friday: $1000'] },
      ],
      [
        { head: 'Private Events - 6 hours on site (8 month booking window)', small: '(10am-10pm)', lines: ['Saturday: $1200', 'Sunday: $1000', 'Weekdays: $800', 'Extra Hour: $150'] },
        { head: 'Memorials - 5 hours on site (4 month booking window)', small: '(9am-10pm)', lines: ['Saturday: $800', 'Sunday: $600', 'Weekdays: $500', 'Extra Hour: $150'] },
      ],
      [
        { head: 'Outdoor Public Event (Capacity: Permit) - 6 hours on site', small: '(10am-11pm)', lines: ['Cost: $1800', 'Extra Hour: $200'] },
      ],
    ],
  },
  {
    title: 'Non-Profit Pricing Guide 2026',
    note: 'Guide is for informational purposes only - please refer walk-ins to website for booking',
    groups: [
      [{ head: 'NP Large Private Event (up to 200 people) - 4 hours on site', small: '(10am-10pm)', lines: ['All Week: $800', 'Extra Hour: $150'] }],
      [{ head: 'NP Small Private Event (50 people) - 4 hours on site', small: '(9am-10pm)', lines: ['All Week: $600', 'Extra Hour: $100'] }],
      [{ head: 'NP Public Event (Capacity: Permit) - 6 hours on site', small: '(10am-11pm)', lines: ['Cost: $2000', 'Extra Hour: $200'] }],
    ],
  },
];

const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function pricingGuideHtml() {
  const page = (g) => '<section class="page"><h1>' + esc(g.title) + '</h1><div class="note">' + esc(g.note) + '</div>' +
    g.groups.map((grp, gi) => (gi ? '<hr>' : '') + grp.map((s) =>
      '<div class="sec"><h2>' + esc(s.head).replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/, '<u>$1</u>') +
      (s.inline ? ' <span class="val">' + esc(s.inline) + '</span>' : '') + (s.small ? ' <small>' + esc(s.small) + '</small>' : '') + '</h2>' +
      (s.lines || []).map((l) => '<div class="ln">' + esc(l) + '</div>').join('') + '</div>').join('')).join('') + '</section>';
  return '<!doctype html><html><head><meta charset="utf-8"><title>North Star House Pricing Guide</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">' +
    '<style>@page{size:letter;margin:0.5in}*{box-sizing:border-box}html,body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    "body{color:#444;font-family:Montserrat,'Segoe UI',Arial,sans-serif}" +
    '.page{padding:0.55in 0.62in;page-break-after:always}.page:last-child{page-break-after:auto}' +
    "h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;color:#7d5f06;font-size:40px;line-height:1.1;text-align:center;margin:0 0 14px}" +
    '.note{border-top:1.2px solid #8c8c8c;border-bottom:1.2px solid #8c8c8c;text-align:center;font-weight:700;font-size:12.5px;padding:10px 0;margin:0 0 26px}' +
    '.sec{margin:0 0 22px;page-break-inside:avoid}h2{font-size:16.5px;font-weight:700;line-height:1.4;margin:0 0 2px;color:#444}h2 small{font-size:11px;font-weight:400}h2 .val{font-weight:400}' +
    '.ln{font-size:16.5px;font-weight:300;line-height:1.6;color:#444}hr{border:0;border-top:1.2px solid #8c8c8c;margin:22px 0 26px}' +
    '</style></head><body>' + PRICING_GUIDES.map(page).join('') + '</body></html>';
}

// Opens the guide in a new tab and brings up the print dialog once the fonts have loaded.
export function printPricingGuide() {
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for this site to print the pricing guide.'); return; }
  w.document.open(); w.document.write(pricingGuideHtml()); w.document.close();
  let done = false;
  const go = () => { if (done) return; done = true; try { w.focus(); w.print(); } catch (e) { /* the tab stays open for printing by hand */ } };
  try { (w.document.fonts && w.document.fonts.ready ? w.document.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 250)); } catch (e) { /* ignore */ }
  setTimeout(go, 2500);
}
