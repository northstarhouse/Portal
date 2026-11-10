// Site Manager packet: the sheet that is printed for the site manager on the day of an event.
//   Page 1  Event Information for Site Managers (filled in from the pre-booking form and the Wedding Day Questionnaire)
//   Page 2  Security Deposit Accounting Form (event, refund check details, cost and deposit filled in)
//   Pages 3-4  Walk-Through & Checklist
// It opens in a new tab, laid out on letter paper, and offers Print (or Save as PDF from the print dialog).

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (cents) => (cents || cents === 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : '');
const longDate = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
};

// Wedding Day Questionnaire field ids (nsh_forms e9be06b9-6788-41bc-a78a-28e02b8b749a)
const Q = {
  houseAccess: 'rs4start1', outdoorSetup: 'efbv357w', guests: 'pqv3xvhy', chairs: '9d4w1mtr', round: 'u1dxrj93', rect8: '0b8exqpj', rect6: 'fqexadj0',
  dining: '05wji2y0', ceremony: 'w25d5otp', areas: '7xqk8pj0', coordinator: 'lgznkge3', itinerary: 'q39vtj2z',
  caterer: 'ct8rut5k', dj: 'x69x2wmp', photographer: '1nlza3rt', rentals: '7xbg0y8j', otherVendors: 'ebr3yi5m',
  refundTo: '2tywmjis', mailTo: 'qwb19pxp',
};
// Older (HoneyBook) questionnaires have no field ids, so their answers are found by the wording of the question.
const HB = {
  houseAccess: /start time|access|begin/i, outdoorSetup: /outside only|outdoor set/i, guests: /guest count|number of guests|how many guests/i, chairs: /chairs/i,
  round: /round/i, rect8: /8['’]?\s*rect|8 ?foot rect/i, rect6: /6['’]?\s*rect|6 ?foot rect/i, dining: /dining (area|location|space)|where.*(din|eat)/i, ceremony: /ceremony (area|location|site|space)|where.*ceremony/i,
  coordinator: /day.?of coordinator/i, itinerary: /itinerary|timeline/i, refundTo: /refund check to|deposit refund/i, mailTo: /mail the security|mail.*refund/i,
};

function answers(client) {
  const native = client.questionnaire || {};
  const hb = client.hbQa || [];
  return (key) => {
    const v = native[Q[key]];
    if (v != null && String(Array.isArray(v) ? v.join(', ') : v).trim()) return Array.isArray(v) ? v.join(', ') : String(v).trim();
    const re = HB[key];
    const hit = re && hb.find((x) => re.test(x.label) && String(x.answer || '').trim());
    return hit ? String(hit.answer).trim() : '';
  };
}

// "4:30 PM", "4pm", "16:00", "noon" -> minutes after midnight
function clock(text) {
  const t = String(text || '').toLowerCase();
  // a range ("5:15-6:00 p.m.", "6-8 pm", "6 to 8pm"): the START time, taking am/pm from the end if the start has none
  const r = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m?\.?)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?/);
  if (r) {
    let h = Number(r[1]); const min = Number(r[2] || 0); const ap = r[3] || r[6];
    const endH = Number(r[4]) % 12 + (r[6] === 'p' ? 12 : 0);
    if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
    if (!r[3] && h > endH && h >= 12) h -= 12; // "11-1 pm" starts at 11 am
    return h * 60 + min;
  }
  if (/\bnoon\b/.test(t)) return 12 * 60;
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?/) || t.match(/\b([01]?\d|2[0-3]):(\d{2})\b/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (m[3]) { if (m[3] === 'p' && h < 12) h += 12; if (m[3] === 'a' && h === 12) h = 0; }
  return h * 60 + min;
}
const showClock = (mins) => { const m = ((mins % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };

// Picks times out of the couple's free-text itinerary, line by line.
function scheduleFromItinerary(text) {
  const out = {};
  const rules = [
    ['arrive', /guest(s)?\s*(arriv|seat)|arrival|doors open/i],
    ['ceremony', /ceremony/i],
    ['cocktail', /cocktail/i],
    ['dining', /dinner|dining|meal|toast/i],
    ['leave', /guest(s)?\s*(leave|depart)|send.?off|exit|last dance|reception (ends?|over)|end of (the )?(reception|event|night|party)|clean.?up|tear.?down/i],
    ['out', /out time|load.?out|out by|off (the )?(property|site)|vacate|venue (closes|empty)/i],
  ];
  for (const line of String(text || '').split(/\n|;/)) {
    const mins = clock(line);
    if (mins == null) continue;
    for (const [key, re] of rules) if (!out[key] && re.test(line)) out[key] = showClock(mins);
  }
  return out;
}

const WALK = [
  [['Outdoor Restrooms', ['Breaker on', 'Doors unlocked', 'Lights on', 'Paper products stocked', 'Cans lined']],
   ['Kitchen', ['Lights on', 'Contact info posted on fridge', 'Supply bin stocked', 'Can liners available', 'Pantry locked', 'Counters clear', 'Fridge turned on', 'Restroom stocked']],
   ['Trash Corral', ['Plug in walkway lights', 'Place trash & recycle bins out']],
   ['Dining Room', ['Lights on', 'Chairs off tables', 'Table sleeves on', 'Porch door locked']],
   ['Mudroom & Study', ['Lights on', 'Wastebasket lined', 'Mirrors from foyer in place', 'Clothing rack pulled out']]],
  [['Terrace & West Lawn', ['Outside lights on', 'Lawn cleared and tidy']],
   ['Living Room', ['Lights on']],
   ['Library', ['Lights on', 'Chairs off table', 'Doors unlocked']],
   ['Julia Morgan Room', ['Lights on', 'Doors unlocked', 'Chairs off tables', 'Coat rack from foyer', 'Waste basket lined', 'Put away decor items (See SM Guidebook)']],
   ['Restrooms & Foyer', ['Lights on', 'Cans lined', 'Paper products stocked']],
   ['Courtyard & East Lawn', ['Twinkle lights on', 'Courtyard lights on', 'Lawn lights on']],
   ['Parking Lot', ['Flood lights on']],
   ['Garden', ['Unlock', 'Clear & clean']]],
];

export function buildSitePacketHtml(client) {
  const a = answers(client);
  const eventName = client.name || '';
  const date = longDate(client.eventDate);
  const sched = scheduleFromItinerary(a('itinerary'));
  const access = a('houseAccess');
  const times = {
    setup: a('outdoorSetup'), house: access, ceremony: sched.ceremony || '', cocktail: sched.cocktail || '',
    dining: sched.dining || '', leave: sched.leave || '',
    // only an out time the client actually gave in their itinerary; otherwise blank for the site manager to fill in
    out: sched.out || '',
  };
  // Weddings always list a cocktail hour; other events only when their itinerary has one.
  const isWedding = client.type === 'Wedding';
  const schedule = [['Outdoor Setup', times.setup], ['House Access', times.house], ['Guests Arrive', sched.arrive || ''], ['Ceremony', times.ceremony],
    ...(isWedding || times.cocktail ? [['Cocktail Hour', times.cocktail]] : []), ['Dining', times.dining], ['Guests Leave', times.leave], ['Out Time', times.out]];

  const deposit = (() => {
    const rows = client.schedule || [];
    const hit = rows.find((p) => /security deposit/i.test(p.label || '')) || (rows.length > 1 && rows[rows.length - 1].cents === 80000 ? rows[rows.length - 1] : null);
    if (hit) return hit.cents;
    // HoneyBook invoices often carry the deposit as a "Security Deposit" line item (sometimes inside a package) instead of its own payment.
    let found = null;
    const walk = (items) => (items || []).forEach((li) => {
      const cents = (li.price?.amount || 0) * (li.quantity == null ? 1 : li.quantity);
      if (found == null && /security deposit/i.test(li.title || li.name || '') && cents > 0) found = cents;
      walk(li.children);
    });
    walk(client.payments?.line_items);
    return found;
  })();
  const notes = [
    ['Ceremony', a('ceremony')], ['Dining', a('dining')], ['Other areas', a('areas')], ['Caterer', a('caterer')], ['DJ', a('dj')], ['Photographer', a('photographer')],
    ['Rentals', a('rentals')], ['Other vendors', a('otherVendors')],
  ].filter((r) => r[1]);
  const itinerary = a('itinerary');
  const rule = (n) => Array.from({ length: n }, () => '<div class="ruled"></div>').join('');

  const page1 = `
<section class="page">
  <h1>Event Information for Site Managers</h1>
  <div class="row"><span class="lab">Event Name:</span><span class="val">${esc(eventName)}</span></div>
  <div class="row"><span class="lab">Date:</span><span class="val">${esc(date)}</span></div>
  <div class="row"><span class="lab">Site Manager:</span><span class="val">${esc(client.siteManager || '')}</span></div>
  <div class="row"><span class="lab">Day of Coordinator:</span><span class="val">${esc(a('coordinator'))}</span></div>
  <table class="counts"><tr>
    <td><span class="lab">Guests:</span> ${esc(a('guests'))}</td>
    <td><span class="lab">Round Tables:</span> ${esc(a('round'))}</td>
    <td><span class="lab">Rectangle Tables:</span> 6'- ${esc(a('rect6'))} &nbsp; 8'- ${esc(a('rect8'))}</td>
    <td><span class="lab">Chairs:</span> ${esc(a('chairs'))}</td>
  </tr></table>
  <h2>Schedule of Event Activities:</h2>
  <table class="sched"><tr>${schedule.map((s) => `<th>${esc(s[0])}</th>`).join('')}</tr><tr>${schedule.map((s) => `<td>${esc(s[1])}</td>`).join('')}</tr></table>
  <h2>Site Manager Notes:</h2>
  ${notes.length ? `<div class="notes">${notes.map((n) => `<div><b>${esc(n[0])}:</b> ${esc(n[1])}</div>`).join('')}</div>` : ''}
  ${itinerary ? `<div class="notes"><b>${isWedding ? "Couple's" : "Client's"} itinerary:</b><div class="itin">${esc(itinerary)}</div></div>` : ''}
  ${rule(notes.length || itinerary ? 4 : 7)}
</section>`;

  const page2 = `
<section class="page">
  <div class="smallcap">Top Half to Be Completed by Site Manager</div>
  <div class="checks"><div class="cb">&#9633; All rentals put away</div><div class="cb">&#9633; Trash &amp; recycling handled properly</div><div class="cb">&#9633; No pets on site</div><div class="cb">&#9633; No evidence of smoking or fire</div></div>
  <div class="attn">Areas of Immediate Attention/Need:</div>
  <div class="hint">(i.e extra hours added, maintenance needs, event mishaps)</div>
  <div class="gap"></div>
  <div class="inline3"><span>Time In -</span><span>Time Out -</span><span>Total Hours =</span></div>
  <div class="inline3 guestout"><span>Guests' Actual Out Time -</span><small>(when the last guest left; used for billing if different from Time Out)</small></div>
  <div class="inline2"><span>Site Manager - <b>${esc(client.siteManager || '')}</b></span><span>Signature -</span></div>
  <div class="smallcap mid">Bottom Half of Page to Be Completed by Management</div>
  <h1 class="sd">Security Deposit Accounting Form:</h1>
  <div class="row serif"><span class="lab">Event Name &amp; Date:</span><span class="val">${esc(eventName)}${date ? ' &mdash; ' + esc(date) : ''}</span></div>
  <div class="row serif"><span class="lab">Refund Check Payable To:</span><span class="val">${esc(a('refundTo'))}</span></div>
  <div class="row serif tall"><span class="lab">Mail Check To:</span><span class="val">${esc(a('mailTo'))}</span></div>
  <div class="row serif split"><span><span class="lab">Event Cost:</span> ${esc(money(client.total))}</span><span><span class="lab">Security Deposit:</span> ${esc(money(deposit))}</span></div>
  <div class="row serif refund"><span class="lab big">Refund Amount:</span></div>
  <div class="row serif why"><span class="lab">If the entire deposit is not being returned, please specify why:</span></div>
  ${rule(3)}
</section>`;

  const walkPage = (sections, idx) => `
<section class="page walk">
  ${idx === 0 ? '<h1>Walk-Through &amp; Checklist</h1>' : ''}
  <div class="ba"><span>Before</span><span>After</span></div>
  ${sections.map(([title, items]) => `<div class="wrow"><div class="wl"><b>${esc(title)}</b><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div><div class="boxes" style="height:${Math.max(64, items.length * 22 + 28)}px"><div></div><div></div></div></div>`).join('')}
</section>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Site Manager Packet - ${esc(eventName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cardo:wght@400;700&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9e4da; font-family: Montserrat, Arial, sans-serif; color: #4a4a4a; }
  .bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 16px; display: flex; gap: 12px; align-items: center; z-index: 5; }
  .bar button { background: #886c44; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-weight: 700; cursor: pointer; font-size: 14px; }
  .bar span { color: #777; font-size: 13px; }
  .page { width: 8.5in; min-height: 11in; margin: 16px auto; background: #fff; padding: 0.5in 0.55in; box-shadow: 0 2px 10px rgba(0,0,0,.15); page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }
  h1 { font-family: Cardo, Georgia, serif; color: #7a5c14; font-size: 31px; text-align: center; margin: 0 0 16px; }
  h2 { font-family: Cardo, Georgia, serif; color: #7a5c14; font-size: 24px; margin: 22px 0 10px; }
  .row { border-top: 1.5px solid #888; padding: 11px 2px; font-size: 15px; display: flex; gap: 10px; min-height: 44px; align-items: baseline; }
  .row:last-of-type { border-bottom: none; }
  .lab { font-weight: 700; color: #555; }
  .val { color: #222; font-weight: 600; flex: 1; white-space: pre-wrap; }
  .counts { width: 100%; border-collapse: collapse; margin-top: 18px; border: 2px solid #bbb; }
  .counts td { border: 1.5px solid #bbb; padding: 10px 8px; font-size: 13px; vertical-align: top; }
  .sched { width: 100%; border-collapse: collapse; border: 2px solid #bbb; table-layout: fixed; }
  .sched th { border: 1.5px solid #bbb; padding: 8px 4px; font-size: 12px; color: #666; text-align: center; font-weight: 700; }
  .sched td { border: 1.5px solid #bbb; height: 70px; text-align: center; font-size: 12px; color: #222; font-weight: 600; padding: 4px; }
  .notes { font-size: 12px; color: #333; margin: 4px 0 6px; line-height: 1.5; }
  .itin { white-space: pre-wrap; font-weight: 600; font-size: 11px; }
  .ruled { border-top: 1.5px solid #999; height: 44px; }
  .version { position: absolute; right: 0.55in; bottom: 0.4in; font-weight: 700; font-size: 11px; color: #222; }
  .smallcap { text-align: center; font-weight: 700; font-size: 12px; padding: 8px 0; border-bottom: 1.5px solid #888; }
  .smallcap.mid { border-top: 1.5px solid #888; margin-top: 8px; }
  .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; padding: 14px 40px; border-bottom: 1.5px solid #888; font-family: Cardo, Georgia, serif; font-size: 17px; }
  .attn { color: #b32024; font-family: Cardo, Georgia, serif; font-weight: 700; font-size: 22px; margin-top: 14px; }
  .hint { font-family: Cardo, Georgia, serif; font-size: 12px; color: #555; margin-top: 4px; }
  .gap { height: 60px; border-bottom: 1.5px solid #888; }
  .inline3 { display: flex; justify-content: space-between; padding: 12px 8px 4px; font-family: Cardo, Georgia, serif; font-weight: 700; font-size: 18px; }
  .inline3:not(.guestout) > span { flex: 0 0 33.33%; }
  .guestout { justify-content: flex-start; gap: 14px; align-items: flex-end; border: 2px solid #555; border-radius: 4px; margin: 14px 0 12px; padding: 18px 12px 12px; }
  .guestout span { min-width: 3.2in; border-bottom: 1.5px solid #888; }
  .guestout small { font-weight: 400; font-size: 11px; color: #555; }
  .inline2 > span { flex: 0 0 50%; }
  .inline2 { display: flex; justify-content: flex-start; padding: 8px 8px 14px; font-family: Cardo, Georgia, serif; font-weight: 700; font-size: 18px; border-bottom: 1.5px solid #888; }
  h1.sd { font-size: 30px; margin: 10px 0 6px; border-top: 1.5px solid #888; border-bottom: 1.5px solid #888; padding: 10px 0; }
  .serif { font-family: Cardo, Georgia, serif; font-size: 17px; }
  .serif.tall { min-height: 86px; }
  .serif.split { justify-content: flex-start; gap: 0; }
  .serif.split > span { flex: 0 0 50%; }
  .serif.refund { min-height: 64px; }
  .lab.big { font-size: 22px; }
  .serif.why { border-bottom: none; }
  .walk h1 { font-size: 30px; margin-bottom: 4px; }
  .ba { display: grid; grid-template-columns: 1fr 1fr; width: 47%; margin-left: 52%; text-align: center; font-weight: 700; font-size: 14px; padding: 4px 0; }
  .wrow { display: flex; gap: 3%; margin: 0 0 12px; align-items: stretch; }
  .wl { width: 49%; font-size: 14px; }
  .wl ul { margin: 2px 0 0; padding-left: 28px; list-style: circle; font-weight: 400; color: #555; }
  .wl li { line-height: 1.55; }
  .boxes { width: 48%; display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid #222; }
  .boxes div:first-child { border-right: 1.5px solid #222; }
  @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0.1in 0.1in; } }
</style></head><body>
<div class="bar"><button onclick="window.print()">Print packet</button><span>${esc(eventName)}${date ? ' &middot; ' + esc(date) : ''}. 4 pages. In the print window you can also choose Save as PDF.</span></div>
${page1}${page2}${walkPage(WALK[0], 0)}${walkPage(WALK[1], 1)}
<script>
// Each section must print on exactly one sheet. A section that runs long (a long itinerary, many notes) would spill onto an
// extra, nearly blank sheet and throw the rest of the packet off, so it is scaled down just enough to fit when printed.
(function () {
  var FIT = 9.75 * 96; // printable height of a letter page with the margins above, in CSS pixels, less a little room
  function fit() {
    var css = '';
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (p, i) {
      p.id = 'pg' + i;
      var first = p.firstElementChild, last = p.lastElementChild;
      if (!first || !last) return;
      var h = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top + 24;
      if (h > FIT) css += '#pg' + i + '{zoom:' + (FIT / h).toFixed(3) + '}';
    });
    var s = document.getElementById('fit-pages') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'fit-pages' }));
    s.textContent = '@media print{' + css + '}';
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('beforeprint', fit);
})();
</script>
</body></html>`;
}

export function openSitePacket(client) {
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for this site to open the packet.'); return; }
  w.document.open();
  w.document.write(buildSitePacketHtml(client));
  w.document.close();
}

// A made-up wedding with every question answered, so the packet can be looked at and test-printed without a real client.
export function openSamplePacket() {
  const next = new Date(); next.setDate(next.getDate() + 60);
  openSitePacket({
    name: 'Sample Couple Wedding',
    eventDate: next.toLocaleDateString('en-CA'),
    siteManager: 'Derek',
    total: 580000,
    schedule: [{ label: 'Booking payment', cents: 80000 }, { label: 'Refundable Security Deposit', cents: 80000 }],
    questionnaire: {
      rs4start1: '10:00 AM', efbv357w: '8:00 AM', pqv3xvhy: '150', '9d4w1mtr': '150', u1dxrj93: '12', '0b8exqpj': '2', fqexadj0: '1',
      '05wji2y0': 'Terrace', w25d5otp: 'Courtyard', '7xqk8pj0': ['Heritage Garden', 'Library'],
      lgznkge3: 'Jordan Lee, 530-555-0111, Lee Events Co.',
      q39vtj2z: '8:00 AM outdoor setup\n10:00 AM house access, getting ready\n3:00 PM guests arrive\n3:30 PM ceremony in the courtyard\n4:15 PM cocktail hour on the terrace\n5:30 PM dinner\n9:30 PM send-off\n10:00 PM vendors load out',
      ct8rut5k: 'Sierra Catering, 530-555-0122', x69x2wmp: 'DJ Blake, 530-555-0133', '1nlza3rt': 'Foothill Photography, 530-555-0144', '7xbg0y8j': 'Party Rentals Co, 530-555-0155',
      '2tywmjis': 'Jamie Rivera', qwb19pxp: '123 Main Street, Grass Valley, CA 95945',
    },
  });
}
