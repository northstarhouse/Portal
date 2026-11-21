// Admin > "Brick Orders Wording": every brick and exactly what goes on it, in one list for the engraver.
// Two places a brick comes from: bricks bought online or entered as donations (type "Brick Purchase", wording in
// brick_inscription), and the legacy brick included with a wedding (the three lines the couple submit on their event page,
// venue_inquiries.brick_lines). Read-only; wording is edited where it was entered.
const BO_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', BO_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const BO_H = { apikey: BO_KEY, Authorization: 'Bearer ' + BO_KEY };
const boGet = path => fetch(BO_URL + '/rest/v1/' + path, { headers: BO_H }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error((d && d.message) || 'Request failed'); return d; });
const GOLD = '#886c44';

const day = d => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sizeOf = notes => { const m = String(notes || '').match(/Size:\s*(\d+\s*x\s*\d+)/i); return m ? m[1].replace(/\s+/g, '') : ''; };
const splitLines = t => String(t || '').split(/\r?\n|\s*\/\s*/).map(x => x.trim()).filter(Boolean);
const sizeOfTier = tickets => { const t = Array.isArray(tickets) && tickets[0] ? String(tickets[0].tier || '') : ''; const m = t.match(/(\d+)"?\s*x\s*(\d+)/i); return m ? m[1] + 'x' + m[2] : ''; };
const wordingOf = d => {
  const ins = String(d.brick_inscription || '').trim();
  if (ins) return splitLines(ins);
  const m = String(d.donation_notes || '').match(/engrave on your brick\?:\s*([\s\S]*)$/i);
  return m ? splitLines(m[1]) : [];
};

export function BrickOrdersView() {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [q, setQ] = React.useState('');
  const [src, setSrc] = React.useState('all');
  const [copied, setCopied] = React.useState('');

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [orders, dons, weds] = await Promise.all([
          boGet('ticket_orders?select=id,created_at,buyer_name,paypal_payer_name,amount,note,tickets,status&note=ilike.Engraving*&status=eq.completed&order=created_at.desc&limit=2000'),
          boGet('donations?select=id,date,amount,type,brick_inscription,donation_notes,donor_id,acknowledged,source_ticket_order_id&type=ilike.*brick*&source_ticket_order_id=is.null&order=date.desc&limit=2000'),
          boGet('venue_inquiries?select=id,name,event_type,event_date,brick_lines,brick_submitted_at&brick_submitted_at=not.is.null&order=brick_submitted_at.desc&limit=2000'),
        ]);
        const ids = [...new Set(dons.map(d => d.donor_id).filter(Boolean))];
        const names = {};
        for (let i = 0; i < ids.length; i += 100) {
          const part = await boGet('donors?select=id,formal_name&id=in.(' + ids.slice(i, i + 100).join(',') + ')');
          part.forEach(p => { names[p.id] = p.formal_name; });
        }
        const out = [
          ...orders.map(o => ({ key: 'o' + o.id, when: o.created_at, name: o.buyer_name || o.paypal_payer_name || 'Unknown', source: 'Website order', detail: sizeOfTier(o.tickets) ? sizeOfTier(o.tickets) + ' brick' : 'Brick', lines: splitLines(String(o.note || '').replace(/^\s*Engraving:\s*/i, '')), amount: o.amount, done: null })),
          ...dons.map(d => ({ key: 'd' + d.id, when: d.date, name: names[d.donor_id] || 'Unknown donor', source: 'Entered by hand', detail: sizeOf(d.donation_notes) ? sizeOf(d.donation_notes) + ' brick' : 'Brick', lines: wordingOf(d), amount: d.amount, done: d.acknowledged === true || String(d.acknowledged).toUpperCase() === 'TRUE' })),
          ...weds.map(w => ({ key: 'w' + w.id, when: w.brick_submitted_at, name: w.name, source: 'Venue rental', detail: 'Legacy brick' + (w.event_date ? ' · ' + String(w.event_type || 'event').toLowerCase() + ' ' + day(w.event_date) : ''), lines: (Array.isArray(w.brick_lines) ? w.brick_lines : []).map(x => String(x || '').trim()).filter(Boolean), amount: null, done: null })),
        ].sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));
        if (!off) setRows(out);
      } catch (e) { if (!off) { setErr('Could not load brick orders: ' + e.message); setRows([]); } }
    })();
    return () => { off = true; };
  }, []);

  const shown = (rows || []).filter(r => (src === 'all' || r.source === src) && (!q.trim() || (r.name + ' ' + r.lines.join(' ') + ' ' + r.detail).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = (r) => { try { navigator.clipboard.writeText(r.lines.join('\n')); setCopied(r.key); setTimeout(() => setCopied(''), 1500); } catch (_e) { /* clipboard unavailable */ } };
  function download() {
    const X = window.XLSX; if (!X) { alert('The spreadsheet tool has not loaded. Please refresh and try again.'); return; }
    const aoa = [['Date', 'Name', 'Source', 'Size / note', 'Line 1', 'Line 2', 'Line 3', 'Amount']].concat(shown.map(r => [day(r.when), r.name, r.source, r.detail, r.lines[0] || '', r.lines[1] || '', r.lines[2] || '', r.amount == null ? '' : Number(r.amount)]));
    const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [12, 26, 13, 28, 24, 24, 24, 10].map(w => ({ wch: w }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Brick wording'); X.writeFile(wb, 'NSH-brick-wording-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a7e6b', borderBottom: '1px solid #e6dfd3', whiteSpace: 'nowrap' };
  const td = { padding: '10px', borderBottom: '1px solid #f0ebe2', verticalAlign: 'top', fontSize: 13 };
  const pill = on => ({ border: '1px solid ' + (on ? GOLD : '#d8cdb8'), background: on ? GOLD : '#fff', color: on ? '#fff' : '#6b5d4a', borderRadius: 16, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' });
  const counts = { all: (rows || []).length, 'Website order': (rows || []).filter(r => r.source === 'Website order').length, 'Venue rental': (rows || []).filter(r => r.source === 'Venue rental').length, 'Entered by hand': (rows || []).filter(r => r.source === 'Entered by hand').length };

  return <div style={{ padding: '4px 0 40px', maxWidth: 1100 }}>
    <p style={{ margin: '0 0 14px', color: '#6b5d4a', fontSize: 13.5 }}>Every brick and its wording, newest first: website brick orders, bricks entered by hand as donations, and the legacy brick each venue rental client submits on their event page. Use Download for the engraver.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or wording" style={{ border: '1px solid #d8cdb8', borderRadius: 8, padding: '8px 12px', fontSize: 13, minWidth: 220, fontFamily: 'inherit' }} />
      {[['all', 'All'], ['Website order', 'Website orders'], ['Venue rental', 'Venue rentals'], ['Entered by hand', 'Entered by hand']].filter(([k]) => k === 'all' || counts[k] > 0).map(([k, label]) => <button key={k} type="button" style={pill(src === k)} onClick={() => setSrc(k)}>{label} ({counts[k]})</button>)}
      <span style={{ flex: 1 }} />
      <button type="button" onClick={download} disabled={!shown.length} style={{ border: '1px solid ' + GOLD, background: '#fff', color: GOLD, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Download (.xlsx)</button>
    </div>
    {err && <div role="alert" style={{ color: '#b3261e', marginBottom: 10 }}>{err}</div>}
    {rows === null ? <div role="status" style={{ color: '#8a7e6b' }}>Loading brick orders…</div> : shown.length === 0 ? <div style={{ color: '#8a7e6b' }}>No bricks match.</div> : <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e6dfd3', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Date</th><th style={th}>Name</th><th style={th}>Brick</th><th style={th}>Wording</th><th style={{ ...th, textAlign: 'right' }}>Paid</th><th style={th} /></tr></thead>
        <tbody>{shown.map(r => <tr key={r.key}>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>{day(r.when)}</td>
          <td style={{ ...td, fontWeight: 600 }}>{r.name}<div style={{ fontWeight: 400, fontSize: 11, color: '#8a7e6b' }}>{r.source}</div></td>
          <td style={{ ...td, color: '#6b5d4a' }}>{r.detail}</td>
          <td style={{ ...td, fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.5 }}>{r.lines.length ? r.lines.map((l, i) => <div key={i}>{l}</div>) : <span style={{ color: '#b0a590', fontFamily: 'inherit' }}>No wording on file</span>}</td>
          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.amount == null ? 'Included' : money(r.amount)}</td>
          <td style={td}>{r.lines.length > 0 && <button type="button" onClick={() => copy(r)} style={{ border: '1px solid #d8cdb8', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{copied === r.key ? 'Copied ✓' : 'Copy'}</button>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
