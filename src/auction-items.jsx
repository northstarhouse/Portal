// Sponsors > Auction Items: keep track of in-kind items donated for auctions. Who gave it (optionally linked to a
// sponsor), its estimated value, which event's auction, where it stands (Pledged > Received > Sold / Unsold / Returned),
// what it sold for and to whom, and whether the donor has been thanked. Data: auction_items (migrations_manual/auction_items.sql).
const AI_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', AI_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const GOLD = '#886c44';
const api = (path, init = {}) => fetch(AI_URL + '/rest/v1/' + path, { ...init, headers: { apikey: AI_KEY, Authorization: 'Bearer ' + AI_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } })
  .then(async r => { const t = await r.text(); const d = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((d && d.message) || 'Request failed'); return d; });

const STATUSES = ['Pledged', 'Received', 'Sold', 'Unsold', 'Returned'];
const TONE = { Pledged: ['#fff8e1', '#8a6200'], Received: ['#e3f2fd', '#1565c0'], Sold: ['#e8f5e9', '#2e7d32'], Unsold: ['#f3e5f5', '#6a1b9a'], Returned: ['#eceff1', '#546e7a'] };
const usd = (n) => n == null || n === '' ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number(n) % 1 ? 2 : 0 });
const empty = { item: '', description: '', donor: '', sponsor_id: '', donor_contact: '', est_value: '', event: '', status: 'Pledged', received_date: '', sold_amount: '', winner: '', acknowledged: false, notes: '' };

function ItemModal({ entry, sponsors, events, onClose, onSaved }) {
  const [f, setF] = React.useState(() => ({ ...empty, ...Object.fromEntries(Object.entries(entry || {}).map(([k, v]) => [k, v == null ? (k === 'acknowledged' ? false : '') : v])) }));
  const [busy, setBusy] = React.useState(false), [err, setErr] = React.useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  // picking a sponsor fills in the donor name and contact
  function pickSponsor(id) {
    const s = sponsors.find(x => String(x.id) === String(id));
    setF(p => ({ ...p, sponsor_id: id, donor: s ? s['Business Name'] || p.donor : p.donor, donor_contact: s ? [s['Main Contact'], s['Email Address']].filter(Boolean).join(' · ') || p.donor_contact : p.donor_contact }));
  }
  async function save() {
    if (!f.item.trim()) { setErr('Add the item.'); return; }
    setBusy(true); setErr('');
    const num = (v) => v === '' || v == null ? null : parseFloat(String(v).replace(/[$,]/g, ''));
    const row = { item: f.item.trim(), description: f.description.trim() || null, donor: f.donor.trim() || null, sponsor_id: f.sponsor_id ? Number(f.sponsor_id) : null, donor_contact: f.donor_contact.trim() || null,
      est_value: num(f.est_value), event: f.event.trim() || null, status: f.status, received_date: f.received_date || null, sold_amount: num(f.sold_amount), winner: f.winner.trim() || null, acknowledged: !!f.acknowledged, notes: f.notes.trim() || null };
    try {
      const saved = entry && entry.id ? await api('auction_items?id=eq.' + entry.id, { method: 'PATCH', body: JSON.stringify(row) }) : await api('auction_items', { method: 'POST', body: JSON.stringify(row) });
      onSaved(saved && saved[0]);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e0d8cc', borderRadius: 7, fontSize: 13, fontFamily: 'inherit' };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 620, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#2a2420' }}>{entry && entry.id ? 'Edit auction item' : 'Add auction item'}</div>
        <label style={lab}>Item<input style={inp} value={f.item} onChange={e => set('item', e.target.value)} placeholder="e.g. Weekend stay at Tahoe cabin" /></label>
        <label style={lab}>Description<textarea style={{ ...inp, minHeight: 60 }} value={f.description} onChange={e => set('description', e.target.value)} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <label style={lab}>Sponsor (optional)<select style={inp} value={f.sponsor_id} onChange={e => pickSponsor(e.target.value)}><option value="">Not a sponsor</option>{sponsors.slice().sort((a, b) => String(a['Business Name'] || '').localeCompare(String(b['Business Name'] || ''))).map(s => <option key={s.id} value={s.id}>{s['Business Name']}</option>)}</select></label>
          <label style={lab}>Donor<input style={inp} value={f.donor} onChange={e => set('donor', e.target.value)} /></label>
          <label style={lab}>Donor contact<input style={inp} value={f.donor_contact} onChange={e => set('donor_contact', e.target.value)} placeholder="Name, email or phone" /></label>
          <label style={lab}>Estimated value<input style={inp} value={f.est_value} onChange={e => set('est_value', e.target.value)} placeholder="$0" /></label>
          <label style={lab}>Event / auction<input style={inp} list="ai-events" value={f.event} onChange={e => set('event', e.target.value)} /><datalist id="ai-events">{events.map(ev => <option key={ev} value={ev} />)}</datalist></label>
          <label style={lab}>Status<select style={inp} value={f.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label style={lab}>Date received<input style={inp} type="date" value={f.received_date} onChange={e => set('received_date', e.target.value)} /></label>
          <label style={lab}>Sold for<input style={inp} value={f.sold_amount} onChange={e => set('sold_amount', e.target.value)} placeholder="$0" /></label>
          <label style={lab}>Winning bidder<input style={inp} value={f.winner} onChange={e => set('winner', e.target.value)} /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={!!f.acknowledged} onChange={e => set('acknowledged', e.target.checked)} /> Donor thanked / acknowledged</label>
        <label style={lab}>Notes<textarea style={{ ...inp, minHeight: 50 }} value={f.notes} onChange={e => set('notes', e.target.value)} /></label>
        {err && <div style={{ color: '#b3261e', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} onClick={save} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={onClose} style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          {entry && entry.id && <button type="button" onClick={async () => { if (!window.confirm('Delete "' + entry.item + '"?')) return; try { await api('auction_items?id=eq.' + entry.id, { method: 'DELETE' }); onSaved(null); } catch (e) { setErr(e.message); } }} style={{ marginLeft: 'auto', background: 'none', color: '#a04545', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

// The saved item, read-only, shown when its row is clicked. Edit opens the form.
function ItemDetails({ it, sponsors, onEdit }) {
  const sponsor = it.sponsor_id ? sponsors.find(s => String(s.id) === String(it.sponsor_id)) : null;
  const day = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const rows = [
    ['Donor', it.donor], ['Sponsor', sponsor ? sponsor['Business Name'] : ''], ['Donor contact', it.donor_contact],
    ['Estimated value', it.est_value != null ? usd(it.est_value) : ''], ['Event / auction', it.event], ['Status', it.status],
    ['Date received', day(it.received_date)], ['Sold for', it.sold_amount != null ? usd(it.sold_amount) : ''], ['Winning bidder', it.winner],
    ['Donor thanked', it.acknowledged ? 'Yes' : 'Not yet'],
  ].filter(([, v]) => v !== '' && v != null);
  return (
    <div style={{ padding: '0 16px 14px 30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#999' }}>{it.updated_at ? 'Updated ' + new Date(it.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (it.updated_by ? ' · ' + it.updated_by : '') : ''}</span>
        <button type="button" onClick={onEdit} style={{ background: 'none', border: 'none', padding: 0, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
      </div>
      {it.description && <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginBottom: 10 }}>{it.description}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 18px' }}>
        {rows.map(([k, v]) => <div key={k}><div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div><div style={{ fontSize: 13, color: '#2a2420', marginTop: 1, overflowWrap: 'anywhere' }}>{v}</div></div>)}
      </div>
      {it.notes && <div style={{ marginTop: 10, background: '#fff', borderLeft: '3px solid ' + GOLD, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#4a3f30', whiteSpace: 'pre-wrap' }}>{it.notes}</div>}
    </div>
  );
}

export function AuctionItemsPanel({ sponsors }) {
  const [items, setItems] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [editing, setEditing] = React.useState(null);
  const [openId, setOpenId] = React.useState(null); // item shown as saved (read-only) below its row
  const [event, setEvent] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const load = () => api('auction_items?select=*&order=created_at.desc').then(d => { setItems(d || []); setErr(''); }).catch(e => { setItems([]); setErr(/auction_items/.test(e.message) ? 'The auction items list is not set up yet.' : e.message); });
  React.useEffect(load, []);
  const all = items || [];
  const events = Array.from(new Set(all.map(i => i.event).filter(Boolean))).sort();
  const needle = q.trim().toLowerCase();
  const shown = all.filter(i => (!event || i.event === event) && (!status || i.status === status) && (!needle || JSON.stringify([i.item, i.description, i.donor, i.winner, i.notes]).toLowerCase().includes(needle)));
  const sum = (list, k) => list.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  async function setItemStatus(it, value) {
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: value } : x));
    try { await api('auction_items?id=eq.' + it.id, { method: 'PATCH', body: JSON.stringify({ status: value }) }); } catch (e) { setErr(e.message); load(); }
  }
  const stat = (label, value) => <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '12px 14px' }}><div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div><div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 24, color: '#2a2420', marginTop: 2 }}>{value}</div></div>;
  const sel = { padding: '7px 10px', border: '1px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {stat('Items', items ? shown.length : '…')}
        {stat('Estimated value', items ? usd(sum(shown, 'est_value')) : '…')}
        {stat('Raised', items ? usd(sum(shown.filter(i => i.status === 'Sold'), 'sold_amount')) : '…')}
        {stat('Still to collect', items ? shown.filter(i => i.status === 'Pledged').length : '…')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items, donors, bidders" style={{ ...sel, flex: 1, minWidth: 160 }} />
        <select style={sel} value={event} onChange={e => setEvent(e.target.value)}><option value="">All events</option>{events.map(ev => <option key={ev}>{ev}</option>)}</select>
        <select style={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <button type="button" onClick={() => setEditing({ event: event || '' })} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add item</button>
      </div>
      {err && <div style={{ color: '#b3261e', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {items === null ? <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div> : shown.length === 0 ? <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>{all.length ? 'Nothing matches.' : 'No auction items yet.'}</div> :
        <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderTop: '3px solid ' + GOLD, borderRadius: 10, overflow: 'hidden' }}>
          {shown.map((it, i) => {
            const t = TONE[it.status] || TONE.Pledged;
            const isOpen = openId === it.id;
            return <div key={it.id} style={{ borderTop: i ? '1px solid #f2ece2' : 'none', background: isOpen ? '#faf6ef' : '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0, cursor: 'pointer' }} onClick={() => setOpenId(isOpen ? null : it.id)}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2420' }}><span style={{ fontSize: 10, color: '#2a2420', display: 'inline-block', width: 14 }}>{isOpen ? '▾' : '▸'}</span>{it.item}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{[it.donor ? 'From ' + it.donor : '', it.event, it.est_value != null ? 'Value ' + usd(it.est_value) : '', it.status === 'Sold' && it.sold_amount != null ? 'Sold ' + usd(it.sold_amount) + (it.winner ? ' to ' + it.winner : '') : ''].filter(Boolean).join(' · ')}</div>
              </div>
              {it.acknowledged ? <span style={{ fontSize: 10, fontWeight: 700, color: '#2e7d32' }}>✓ Thanked</span> : <span style={{ fontSize: 10, fontWeight: 700, color: '#b07a7a' }}>Not thanked</span>}
              <select value={it.status} onChange={e => setItemStatus(it, e.target.value)} aria-label={'Status of ' + it.item}
                style={{ fontSize: 12, fontWeight: 700, padding: '5px 8px', borderRadius: 6, border: '1px solid transparent', background: t[0], color: t[1], cursor: 'pointer' }}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {isOpen && <ItemDetails it={it} sponsors={sponsors || []} onEdit={() => setEditing(it)} />}
            </div>;
          })}
        </div>}
      {editing && <ItemModal entry={editing} sponsors={sponsors || []} events={events} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}
