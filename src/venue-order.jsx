// What a venue client has ordered (Wyn's estimate -> final invoice): day and package, security deposit, rehearsal,
// extra hours, brick, anything else. Saved on the client's record (answers.__venue_checklist.order) as
//   { status: 'estimate' | 'final', items: [{ id, item, desc, qty, unit (cents), deposit, paid }], updated_at, updated_by, finalized_at }
// Until someone saves it, a suggested order is worked out from the booking (HoneyBook invoice lines, or the Portal
// payment schedule), so the bookings export always lists what was ordered, not just the payment schedule.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
const usd = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
// SAT, SUN, MON... for the rental line ("SAT Wedding"), as the venue team writes it.
const dow3 = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : ''; };
const dayName = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
const uid = () => Math.random().toString(36).slice(2, 10);
const EXTRA_HOUR = 15000;

// Items staff can add, from the pricing guide (unit prices in cents; edit the price on the line if a booking differs).
export const ORDER_PRESETS = [
  { item: 'SAT Wedding', unit: 500000 },
  { item: 'SUN Wedding', unit: 500000 },
  { item: 'Weekday Wedding', unit: 500000 },
  { item: 'Security Deposit (refundable)', unit: 80000, deposit: true },
  { item: 'Rehearsal', unit: 100000, desc: 'Thu/Fri, 5 hours on site (5 PM to 10 PM)' },
  { item: 'Extra Hours', unit: EXTRA_HOUR, desc: 'All time on site between 10 AM and 11 PM' },
  { item: 'SAT Private Event (6 hours)', unit: 120000 },
  { item: 'SUN Private Event (6 hours)', unit: 100000 },
  { item: 'Weekday Private Event (6 hours)', unit: 80000 },
  { item: 'SAT Memorial', unit: 80000 },
  { item: 'SUN Memorial', unit: 60000 },
  { item: 'Weekday Memorial', unit: 50000 },
  { item: 'Outdoor public event (6 hours)', unit: 180000 },
  { item: 'Public event extra hour', unit: 20000 },
  { item: 'Brick (included with weddings)', unit: 0 },
  { item: 'Discount', unit: 0 },
  { item: 'Custom item', unit: 0 },
];

const isDepositLabel = l => /security deposit/i.test(l || '');
const extraHoursOf = l => { const m = String(l || '').match(/^Extra rental hours: (\d+) hours?(?: \(on site (.+)\))?/i); return m ? { hours: +m[1], when: m[2] || '' } : null; };

// Suggested order from what the booking already says.
export function suggestedOrder(c) {
  const items = [];
  const P = c.payments, lines = P && Array.isArray(P.line_items) ? P.line_items : null;
  if (lines) {
    const add = li => { const qty = li.quantity == null ? 1 : li.quantity, unit = (li.price && li.price.amount) || 0; if (!(unit > 0) && !(qty > 0)) return; items.push({ id: uid(), item: li.title || 'Item', desc: String(li.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300), qty, unit, deposit: isDepositLabel(li.title) }); };
    lines.forEach(li => { add(li); (li.children || []).forEach(add); });
    if (P.discount && P.discount.amount > 0) items.push({ id: uid(), item: 'Discount', desc: '', qty: 1, unit: -P.discount.amount });
    if (P.tax && P.tax.amount > 0) items.push({ id: uid(), item: 'Tax', desc: '', qty: 1, unit: P.tax.amount });
  }
  const sched = c.schedule || [];
  // Portal bookings: the rental is everything on the schedule that isn't the deposit or an add-on.
  if (!lines) {
    const rental = sched.filter(s => !isDepositLabel(s.label) && !s.deposit && !s.extra && !/rehearsal/i.test(s.label || '') && !extraHoursOf(s.label)).reduce((t, s) => t + (s.cents || 0), 0);
    if (rental) items.push({ id: uid(), item: [dow3(c.eventDate), c.type || 'Event'].filter(Boolean).join(' '), desc: dayName(c.eventDate) + (c.timeOnSite?.start ? ', on site ' + c.timeOnSite.start + ' to ' + c.timeOnSite.end : ''), qty: 1, unit: rental });
    const dep = sched.filter(s => s.deposit || isDepositLabel(s.label)).reduce((t, s) => t + (s.cents || 0), 0);
    if (dep) items.push({ id: uid(), item: 'Security Deposit (refundable)', desc: '', qty: 1, unit: dep, deposit: true });
  }
  // Add-ons from the client page, with whether they're already paid.
  sched.forEach(s => {
    const xh = extraHoursOf(s.label);
    if (xh) items.push({ id: uid(), item: 'Extra Hours', desc: (xh.when ? 'On site ' + xh.when + '. ' : '') + 'Added on the client page', qty: xh.hours, unit: Math.round((s.cents || 0) / (xh.hours || 1)), paid: !!s.paid });
    else if (/rehearsal/i.test(s.label || '') && (s.extra || !lines)) items.push({ id: uid(), item: 'Rehearsal', desc: String(s.label || '').replace(/^.*?\((.*)\)\s*$/, '$1'), qty: 1, unit: s.cents || 0, paid: !!s.paid });
    else if (s.extra && lines) items.push({ id: uid(), item: s.label || 'Additional charge', desc: '', qty: 1, unit: s.cents || 0, paid: !!s.paid });
  });
  if (c.type === 'Wedding' && !items.some(i => /brick/i.test(i.item))) items.push({ id: uid(), item: 'Brick (included with weddings)', desc: (c.brickLines || []).filter(l => String(l).trim()).join(' / '), qty: 1, unit: 0 });
  return { status: 'estimate', items, suggested: true };
}

export const orderFor = c => (c.order && Array.isArray(c.order.items) ? c.order : suggestedOrder(c));
export const orderTotals = items => {
  const line = i => Math.round((Number(i.qty) || 0) * (Number(i.unit) || 0));
  const total = items.reduce((t, i) => t + line(i), 0), deposit = items.filter(i => i.deposit).reduce((t, i) => t + line(i), 0);
  return { total, deposit, earned: total - deposit, line };
};

// Bookings export rows: [{ item, desc, qty, unit, amount, deposit }]
export function orderLines(c) {
  const o = orderFor(c), { line } = orderTotals(o.items);
  return o.items.map(i => ({ item: i.item, desc: [i.desc, i.paid ? 'Already paid' : ''].filter(Boolean).join(' · '), qty: Number(i.qty) || 0, unit: Number(i.unit) || 0, amount: line(i), deposit: !!i.deposit, child: false, status: o.status === 'final' ? 'Final invoice' : 'Estimate' }));
}

async function saveOrder(responseId, order) {
  const cur = await fetch(SB_URL + '/rest/v1/nsh_form_responses?select=answers&id=eq.' + responseId, { headers: HDR }).then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load the client.')));
  if (!cur[0]) throw new Error('Client not found.');
  const a = cur[0].answers || {};
  const answers = { ...a, __venue_checklist: { ...a.__venue_checklist, order } };
  const r = await fetch(SB_URL + '/rest/v1/nsh_form_responses?id=eq.' + responseId, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify({ answers }) });
  if (!r.ok) throw new Error('Could not save the order.');
  const rows = await r.json();
  if (!rows[0]) throw new Error('Could not save the order. Try signing out and back in.');
  return rows[0];
}

function printOrder(c, o) {
  const { total, deposit, line } = orderTotals(o.items);
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paid = c.paid || 0;
  const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
  w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(c.name) + ' - ' + (o.status === 'final' ? 'Invoice' : 'Estimate') + '</title><style>body{font-family:system-ui,sans-serif;color:#2a2a2a;max-width:760px;margin:30px auto;padding:0 20px}h1{font-family:Cardo,Georgia,serif;font-weight:700;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}th,td{padding:8px 6px;border-bottom:1px solid #e6dccb;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#886c44}.r{text-align:right;white-space:nowrap}.muted{color:#888;font-size:12px}.tot td{border:none;padding:4px 6px}</style>' +
    '<div class="muted">North Star House · 12075 Auburn Road, Grass Valley, CA</div><h1>' + (o.status === 'final' ? 'Invoice' : 'Estimate') + '</h1>' +
    '<p><b>' + esc(c.name) + '</b><br>' + esc(dayName(c.eventDate)) + (c.timeOnSite && c.timeOnSite.start ? '<br>Time on site: ' + esc(c.timeOnSite.start + ' to ' + c.timeOnSite.end) : '') + '</p>' +
    '<table><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>' +
    o.items.map(i => '<tr><td>' + esc(i.item) + (i.desc || i.paid ? '<div class="muted">' + esc([i.desc, i.paid ? 'Already paid' : ''].filter(Boolean).join(' · ')) + '</div>' : '') + '</td><td class="r">' + esc(i.qty) + '</td><td class="r">' + usd(i.unit) + '</td><td class="r">' + usd(line(i)) + '</td></tr>').join('') +
    '</table><table class="tot"><tr><td class="r" style="width:80%">Total</td><td class="r"><b>' + usd(total) + '</b></td></tr>' + (deposit ? '<tr><td class="r muted">includes refundable security deposit</td><td class="r muted">' + usd(deposit) + '</td></tr>' : '') +
    '<tr><td class="r">Paid so far</td><td class="r">' + usd(paid) + '</td></tr><tr><td class="r"><b>Balance</b></td><td class="r"><b>' + usd(Math.max(0, total - paid)) + '</b></td></tr></table>' +
    '<script>window.onload=function(){window.print()}<\/script>');
  w.document.close();
}

export function OrderEditor({ client, onSaved }) {
  const start = () => JSON.parse(JSON.stringify(orderFor(client)));
  const [o, setO] = React.useState(start);
  const [dirty, setDirty] = React.useState(false), [busy, setBusy] = React.useState(false), [msg, setMsg] = React.useState(null);
  const [preset, setPreset] = React.useState('');
  const { total, deposit, line } = orderTotals(o.items);
  const final = o.status === 'final';
  const edit = (id, k, v) => { setO(p => ({ ...p, items: p.items.map(i => i.id === id ? { ...i, [k]: v } : i) })); setDirty(true); setMsg(null); };
  const add = name => { const p = ORDER_PRESETS.find(x => x.item === name); if (!p) return; setO(cur => ({ ...cur, items: [...cur.items, { id: uid(), item: p.item === 'Custom item' ? '' : p.item, desc: p.desc || '', qty: 1, unit: p.unit, deposit: !!p.deposit }] })); setDirty(true); setPreset(''); };
  async function save(status) {
    setBusy(true); setMsg(null);
    try {
      const by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(r => r.ok ? r.json() : '').catch(() => '');
      const items = o.items.filter(i => String(i.item).trim()).map(i => ({ id: i.id, item: String(i.item).trim(), desc: String(i.desc || '').trim(), qty: Number(i.qty) || 0, unit: Math.round(Number(i.unit) || 0), ...(i.deposit ? { deposit: true } : {}), ...(i.paid ? { paid: true } : {}) }));
      const next = { status: status || o.status || 'estimate', items, updated_at: new Date().toISOString(), updated_by: by || null, ...((status || o.status) === 'final' ? { finalized_at: o.finalized_at || new Date().toISOString() } : {}) };
      const record = await saveOrder(client.id, next);
      setO({ ...next }); setDirty(false); setMsg({ ok: true, text: status === 'final' ? 'Saved as the final invoice.' : 'Saved.' });
      onSaved && onSaved(client.id, record);
    } catch (e) { setMsg({ ok: false, text: e.message || 'Could not save.' }); }
    setBusy(false);
  }
  const inp = { padding: '5px 7px', border: '1px solid #e0d8cc', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const btn = (on) => ({ background: on ? '#886c44' : '#fff', color: on ? '#fff' : '#886c44', border: '1px solid #886c44', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' });
  return <div>
    {o.suggested && !dirty && <p className="vc-muted" style={{ margin: '0 0 8px' }}>Suggested from the booking. Check it, add anything missing, and save.</p>}
    {final && <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>Final invoice{o.finalized_at ? ' since ' + new Date(o.finalized_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>}
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ fontSize: 11, color: '#888', textAlign: 'left' }}><th style={{ padding: '4px 4px 4px 0' }}>Item</th><th style={{ width: 56 }}>Qty</th><th style={{ width: 96 }}>Price</th><th style={{ width: 90, textAlign: 'right' }}>Amount</th><th style={{ width: 24 }} /></tr></thead>
        <tbody>{o.items.map(i => <tr key={i.id} style={{ borderTop: '1px solid #f0ebe2', verticalAlign: 'top' }}>
          <td style={{ padding: '6px 6px 6px 0' }}>
            <input value={i.item} onChange={e => edit(i.id, 'item', e.target.value)} placeholder="Item" style={{ ...inp, fontWeight: 600 }} aria-label="Item" />
            <input value={i.desc || ''} onChange={e => edit(i.id, 'desc', e.target.value)} placeholder="Details (optional)" style={{ ...inp, marginTop: 4, fontSize: 12 }} aria-label="Details" />
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#777' }}>
              <label><input type="checkbox" checked={!!i.deposit} onChange={e => edit(i.id, 'deposit', e.target.checked)} /> Refundable deposit</label>
              <label><input type="checkbox" checked={!!i.paid} onChange={e => edit(i.id, 'paid', e.target.checked)} /> Already paid</label>
            </div>
          </td>
          <td style={{ padding: '6px 4px' }}><input type="number" min="0" step="0.5" value={i.qty} onChange={e => edit(i.id, 'qty', e.target.value)} style={inp} aria-label="Quantity" /></td>
          <td style={{ padding: '6px 4px' }}><input type="number" step="0.01" value={(Number(i.unit) || 0) / 100} onChange={e => edit(i.id, 'unit', Math.round(parseFloat(e.target.value || '0') * 100))} style={inp} aria-label="Price" /></td>
          <td style={{ padding: '10px 0 6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{usd(line(i))}{i.paid && <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>Paid</div>}</td>
          <td style={{ padding: '8px 0 6px 6px' }}><a role="button" title="Remove" onClick={() => { setO(p => ({ ...p, items: p.items.filter(x => x.id !== i.id) })); setDirty(true); }} style={{ cursor: 'pointer', color: '#b3402a' }}>×</a></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' }}>
      <select value={preset} onChange={e => add(e.target.value)} style={{ ...inp, width: 'auto' }} aria-label="Add an item">
        <option value="">+ Add an item…</option>
        {ORDER_PRESETS.map(p => <option key={p.item} value={p.item}>{p.item}{p.unit ? ' (' + usd(p.unit) + ')' : ''}</option>)}
      </select>
    </div>
    <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.7 }}>
      <div>Total <b style={{ fontSize: 15 }}>{usd(total)}</b></div>
      {deposit > 0 && <div className="vc-muted">includes {usd(deposit)} refundable deposit</div>}
      <div>Paid so far {usd(client.paid || 0)} · Balance <b>{usd(Math.max(0, total - (client.paid || 0)))}</b></div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
      <button type="button" disabled={busy} onClick={() => save()} style={btn(true)}>{busy ? 'Saving…' : final ? 'Save invoice' : 'Save estimate'}</button>
      {!final && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Make this the final invoice for ' + client.name + '?')) save('final'); }} style={btn(false)}>Mark as final invoice</button>}
      {final && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Turn this back into an estimate?')) save('estimate'); }} style={btn(false)}>Back to estimate</button>}
      <button type="button" onClick={() => printOrder(client, o)} style={btn(false)}>Print {final ? 'invoice' : 'estimate'}</button>
      {dirty && <span style={{ fontSize: 12, color: '#a15c00' }}>Unsaved changes</span>}
      {msg && <span role="status" style={{ fontSize: 12, color: msg.ok ? '#2e7d32' : '#b3261e' }}>{msg.text}</span>}
    </div>
  </div>;
}
