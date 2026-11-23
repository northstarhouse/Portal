// Prints an on-brand, paper-ready version of a form (letterhead, gold rules, write-in lines, tick boxes).
// printForm({ title, description, fields }) opens a print window with the form and starts the print dialog.
// Works for any form shaped like the Form Builder's: fields[] with { type, label, required, options, section, parts }.
const GOLD = '#886c44';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const line = (h) => '<div class="line" style="height:' + (h || 26) + 'px"></div>';
const box = (o, round) => '<div class="opt"><span class="box' + (round ? ' round' : '') + '"></span>' + esc(o) + '</div>';

function control(q) {
  const opts = q.options || [];
  switch (q.type) {
    case 'long_text': return line(30) + line(30) + line(30) + line(30);
    case 'single_choice': return '<div class="opts">' + opts.map(o => box(o, true)).join('') + '</div>';
    case 'multiple_choice':
    case 'checkboxes': return '<div class="opts">' + opts.map(o => box(o, false)).join('') + '</div>';
    case 'yes_no': return '<div class="opts inline">' + box('Yes', false) + box('No', false) + '</div>';
    case 'rating': return '<div class="opts inline">' + [1, 2, 3, 4, 5].map(n => '<div class="opt"><span class="box rate">' + n + '</span></div>').join('') + '<span class="hint">1 = poor · 5 = excellent</span></div>';
    case 'date': return '<div class="line short"></div><span class="hint">Date: ____ / ____ / ________</span>';
    default: return line(26);
  }
}

function labelHtml(q, small) {
  return '<div class="lbl' + (small ? ' small' : '') + '">' + esc(q.label) + (q.required ? ' <span class="req">*</span>' : '') + '</div>';
}

function fieldHtml(q) {
  if (q.type === 'group') return '<div class="q">' + (q.parts || []).map(p => '<div class="part">' + labelHtml(p, true) + control(p) + '</div>').join('') + '</div>';
  return '<div class="q">' + labelHtml(q, false) + control(q) + '</div>';
}

export function printForm(form) {
  const groups = [];
  (form.fields || []).forEach(f => {
    const last = groups[groups.length - 1];
    if (f.section && last && last.section === f.section) last.fields.push(f);
    else groups.push({ section: f.section || null, fields: [f] });
  });
  const logo = new URL('assets/logo.png', document.baseURI).href;
  const body = groups.map(g => (g.section ? '<h2>' + esc(g.section) + '</h2>' : '') + g.fields.map(fieldHtml).join('')).join('');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(form.title || 'Form') + ' - North Star House</title><style>' +
    '@page{size:letter;margin:0.6in 0.7in}' +
    '*{box-sizing:border-box}body{font-family:Georgia,"Times New Roman",serif;color:#2c2418;margin:0;font-size:12.5pt;line-height:1.35}' +
    '.head{display:flex;align-items:center;gap:16px;border-bottom:2px solid ' + GOLD + ';padding-bottom:12px;margin-bottom:6px}' +
    '.head img{height:58px;width:auto}.org{font-size:15pt;font-weight:700;letter-spacing:.04em;color:' + GOLD + '}.sub{font-size:9.5pt;color:#7a6d57;margin-top:2px}' +
    '.rule{border-top:.5pt solid #d8cdb8;margin:0 0 16px}' +
    'h1{font-size:23pt;margin:14px 0 6px;font-weight:700}.desc{font-size:11pt;color:#5e5443;margin:0 0 16px;white-space:pre-wrap}' +
    'h2{font-size:12pt;color:' + GOLD + ';text-transform:uppercase;letter-spacing:.08em;border-bottom:.75pt solid ' + GOLD + ';padding-bottom:3px;margin:20px 0 12px}' +
    '.q{margin:0 0 14px;break-inside:avoid}.lbl{font-weight:700;font-size:11.5pt;margin-bottom:2px}.lbl.small{font-weight:400;font-size:10.5pt;color:#5e5443}.req{color:#b3261e}' +
    '.part{margin-bottom:8px}.line{border-bottom:.75pt solid #8a7e6b;width:100%}.line.short{width:45%;height:26px}' +
    '.opts{display:flex;flex-direction:column;gap:6px;margin-top:6px}.opts.inline{flex-direction:row;gap:22px;align-items:center}' +
    '.opt{display:flex;align-items:center;gap:8px;font-size:11pt}.box{display:inline-block;width:13px;height:13px;border:1.2px solid #4a3b24;border-radius:2px;flex-shrink:0}.box.round{border-radius:50%}' +
    '.box.rate{width:28px;height:28px;text-align:center;line-height:26px;font-size:10.5pt;font-weight:700}.hint{font-size:9.5pt;color:#7a6d57;margin-left:8px}' +
    '.foot{margin-top:26px;padding-top:8px;border-top:.5pt solid #d8cdb8;font-size:9pt;color:#7a6d57;display:flex;justify-content:space-between}' +
    '</style></head><body>' +
    '<div class="head"><img src="' + esc(logo) + '" alt=""><div><div class="org">NORTH STAR HOUSE</div><div class="sub">12075 Auburn Road, Grass Valley, CA 95949 &nbsp;·&nbsp; northstarhouse.org</div></div></div>' +
    '<h1>' + esc(form.title || 'Form') + '</h1>' + (form.description ? '<div class="desc">' + esc(form.description) + '</div>' : '<div class="rule"></div>') +
    body +
    '<div class="foot"><span>North Star House · Please return the completed form to a staff member.</span><span>Printed ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</span></div>' +
    '<script>window.onload=function(){var i=document.images[0];function go(){setTimeout(function(){window.focus();window.print();},150);}if(i&&!i.complete){i.onload=go;i.onerror=go;}else go();};<\/script>' +
    '</body></html>';
  const w = window.open('', '_blank');
  if (!w) { alert('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
