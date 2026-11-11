// Venue Rentals > Tools > Policies & Resources: the venue team's cheat sheet. Pricing by rental year, templates,
// policies & FAQs, Site Manager and Venue Coordinator references, and venue information, all searchable in one place.
// Data: venue_resources (one row per entry) and venue_resource_history (written by a database trigger on every change,
// with the signed-in person). See supabase/migrations_manual/venue_resources.sql.
const RV_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', RV_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const GOLD = '#886c44';
const H = { apikey: RV_KEY, Authorization: 'Bearer ' + RV_KEY, 'Content-Type': 'application/json' };
const api = (path, init = {}) => fetch(RV_URL + '/rest/v1/' + path, { ...init, headers: { ...H, Prefer: 'return=representation', ...(init.headers || {}) } })
  .then(async r => { const t = await r.text(); const d = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((d && (d.message || d.hint)) || 'Request failed'); return d; });

const KINDS = {
  pricing: { label: 'Pricing', color: '#2e7d32', tab: 'pricing' },
  template: { label: 'Template', color: '#1565c0', tab: 'templates' },
  faq: { label: 'Policy / FAQ', color: '#8a6200', tab: 'faq' },
  sm_ref: { label: 'Site Manager', color: '#5e35b1', tab: 'sm' },
  vc_ref: { label: 'Venue Coordinator', color: '#00838f', tab: 'vc' },
  info: { label: 'Venue Info', color: '#6d4c41', tab: 'info' },
};
const TABS = [['home', 'Dashboard'], ['pricing', 'Pricing'], ['templates', 'Templates'], ['faq', 'Policies & FAQs'], ['sm', 'Site Manager'], ['vc', 'Venue Coordinator'], ['info', 'Venue Info'], ['changes', 'Changes']];
const TAB_KIND = { pricing: 'pricing', templates: 'template', faq: 'faq', sm: 'sm_ref', vc: 'vc_ref', info: 'info' };
const CATEGORIES = {
  pricing: ['Wedding', 'Private Event', 'Corporate Event', 'Nonprofit', 'Memorial', 'Other'],
  template: ['Rental Agreements', 'Booking Documents', 'Event Management', 'Client Communication'],
  faq: ['Bookings and reservations', 'Soft holds', 'Retainers and payments', 'Cancellations and rescheduling', 'Rental access and hours', 'Vendors and catering', 'Alcohol', 'Dogs and pets', 'Decorations', 'Music and noise', 'Parking', 'Building and grounds access', 'Setup and breakdown', 'Cleaning and damage', 'Site Manager requirements', 'Exceptions and special requests'],
  sm_ref: ['Site Manager responsibilities', 'Pre-event procedures', 'Arrival and property opening', 'Client and vendor access', 'Event monitoring', 'Closing procedures', 'Property security', 'Incident reporting', 'Emergency contacts', 'Escalation procedures'],
  vc_ref: ['New inquiry workflow', 'Tours and follow-ups', 'Soft hold management', 'Pre-booking form procedures', 'Contract preparation', 'Invoice and payment procedures', 'Calendar management', 'Client communications', 'Event preparation timelines', 'Site Manager handoffs', 'Post-event closeout'],
  info: ['Location', 'Rental spaces', 'Capacities', 'Tables and chairs', 'Equipment', 'Parking', 'Restrooms', 'Accessibility', 'Vendor flexibility', 'Catering arrangements', 'Historic building restrictions', 'Property access times', 'Setup and breakdown'],
};
// Pricing fields, in display order.
const PRICE_FIELDS = [['base_price', 'Base rental price'], ['retainer', 'Retainer'], ['included_hours', 'Included hours'], ['extra_hour', 'Additional hourly rate'], ['fees', 'Additional fees'], ['payment_schedule', 'Payment schedule'], ['booking_window', 'Booking window'], ['amenities', 'Included amenities'], ['conditions', 'Special conditions'], ['effective_date', 'Effective date'], ['notes', 'Notes']];
// A pricing or policy change can affect these templates; they are flagged for review (never edited automatically).
const REVIEW_DOC_TYPES = ['Rental Agreements', 'Booking Documents', 'Client Communication'];

const fmtDate = (iso) => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const priceSummary = (d) => d.base_price || (d.rates || []).map(r => r.label + ' ' + r.price).join(' · ');
function driveDownload(url) {
  const m = String(url || '').match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : url;
}
function previewUrl(url) {
  const u = String(url || '');
  if (/docs\.google\.com\/(document|spreadsheets|presentation)\//.test(u)) return u.replace(/\/(edit|view)[^/]*$/, '') + '/preview';
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  return u;
}

const pill = (text, bg, color) => <span style={{ fontSize: 10, fontWeight: 700, background: bg, color, borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>{text}</span>;
const audiencePill = (a) => a === 'client' ? pill('Client-safe', '#e8f5e9', '#2e7d32') : pill('Internal only', '#f0ece6', '#6b5d4a');
const statusPill = (s) => s === 'draft' ? pill('Draft', '#fff8e1', '#8a6200') : s === 'archived' ? pill('Archived', '#eceff1', '#546e7a') : null;
const kindPill = (k) => KINDS[k] ? pill(KINDS[k].label, '#fff', KINDS[k].color) : null;
const btn = { background: '#fff', color: GOLD, border: '1px solid ' + GOLD, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnGold = { ...btn, background: GOLD, color: '#fff' };
const card = { background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '14px 16px' };
const h2 = { fontFamily: "'Cardo', Georgia, serif", fontSize: 19, fontWeight: 700, color: '#2a2420', margin: '0 0 10px' };

function CopyButton({ text, label }) {
  const [done, setDone] = React.useState(false);
  return <button type="button" style={btn} onClick={() => { navigator.clipboard.writeText(text || '').then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>{done ? '✓ Copied' : label}</button>;
}

// One entry (FAQ, reference, info, template): title, badges, the text, and its actions.
function ResourceCard({ r, onEdit, onArchive, onReviewed, onNewVersion, open, onToggle, highlight }) {
  const d = r.data || {};
  const isTemplate = r.kind === 'template';
  return (
    <div id={'res-' + r.id} style={{ ...card, padding: '12px 14px', boxShadow: highlight ? '0 0 0 2px ' + GOLD : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2420' }}>{open ? '▾ ' : '▸ '}{r.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            {audiencePill(r.audience)}{statusPill(r.status)}
            {r.needs_review && pill('Review needed', '#ffebee', '#c62828')}
            {isTemplate && d.version && pill('v' + d.version, '#e3f2fd', '#1565c0')}
            {isTemplate && r.year && pill(String(r.year), '#f3e5f5', '#6a1b9a')}
            {r.quick_ref && pill('Quick reference', '#fff3e0', '#e65100')}
            <span style={{ fontSize: 11, color: '#999' }}>{r.kind === 'faq' ? 'Approved ' : 'Updated '}{fmtDate(r.approved_at || r.updated_at)}{r.updated_by && r.updated_by !== 'Setup' ? ' · ' + r.updated_by : ''}</span>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {r.body && <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{r.body}</div>}
          {r.detail && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', color: GOLD, fontSize: 12, fontWeight: 600 }}>More detail</summary><div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.55 }}>{r.detail}</div></details>}
          {Array.isArray(d.related) && d.related.length > 0 && <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}><b>Related documents:</b> {d.related.join(', ')}</div>}
          {isTemplate && d.format && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Format: {d.format}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {r.body && !isTemplate && <CopyButton text={r.body} label="Copy answer" />}
            {r.body && isTemplate && r.category === 'Client Communication' && <CopyButton text={r.body} label="Copy template" />}
            {isTemplate && d.url && <>
              <a href={d.url} target="_blank" rel="noopener noreferrer" style={btn}>Open ↗</a>
              <a href={previewUrl(d.url)} target="_blank" rel="noopener noreferrer" style={btn}>Preview</a>
              <a href={driveDownload(d.url)} target="_blank" rel="noopener noreferrer" style={btn}>Download</a>
            </>}
            {r.needs_review && onReviewed && <button type="button" style={btn} onClick={onReviewed}>Mark reviewed</button>}
            {isTemplate && r.status !== 'archived' && onNewVersion && <button type="button" style={btn} onClick={onNewVersion}>New version</button>}
            {onEdit && <button type="button" style={btn} onClick={onEdit}>Edit</button>}
            {onArchive && r.status !== 'archived' && <button type="button" style={{ ...btn, color: '#a04545', borderColor: '#e0b4b4' }} onClick={onArchive}>Archive</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// Add / edit any entry. Pricing and templates get their own fields; everything asks for a short change summary,
// which goes into the change history.
function EditModal({ entry, onClose, onSaved }) {
  const isNew = !entry.id;
  const [f, setF] = React.useState(() => ({
    title: entry.title || '', category: entry.category || '', body: entry.body || '', detail: entry.detail || '',
    audience: entry.audience || (entry.kind === 'sm_ref' || entry.kind === 'vc_ref' ? 'internal' : 'client'),
    status: entry.status || 'approved', year: entry.year || '', quick_ref: !!entry.quick_ref,
    data: { ...(entry.data || {}) }, summary: '',
    ratesText: ((entry.data || {}).rates || []).map(r => [r.label, r.price, r.extra].filter(Boolean).join(' | ')).join('\n'),
    relatedText: ((entry.data || {}).related || []).join(', '),
  }));
  const [busy, setBusy] = React.useState(false), [err, setErr] = React.useState('');
  const k = entry.kind;
  const set = (key, v) => setF(p => ({ ...p, [key]: v }));
  const setData = (key, v) => setF(p => ({ ...p, data: { ...p.data, [key]: v } }));
  async function save() {
    if (!f.title.trim()) { setErr('Add a title.'); return; }
    if (k === 'pricing' && !f.year) { setErr('Add the rental year.'); return; }
    setBusy(true); setErr('');
    const data = { ...f.data };
    if (k === 'pricing') data.rates = f.ratesText.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).map(p => ({ label: p[0], price: p[1] || '', ...(p[2] ? { extra: p[2] } : {}) }));
    data.related = f.relatedText.split(',').map(x => x.trim()).filter(Boolean);
    const row = {
      kind: k, title: f.title.trim(), category: f.category.trim() || null, body: f.body.trim() || null, detail: f.detail.trim() || null,
      audience: f.audience, status: f.status, year: f.year ? parseInt(f.year, 10) : null, quick_ref: f.quick_ref, data,
      change_summary: f.summary.trim() || (isNew ? 'Added' : 'Updated'),
      ...(f.status === 'approved' && (isNew || entry.status !== 'approved' || f.body !== (entry.body || '')) ? { approved_at: new Date().toISOString().slice(0, 10) } : {}),
    };
    try {
      // only one approved price schedule per rental type and year: the previous one is archived
      if (k === 'pricing' && f.status === 'approved' && row.category) {
        await api('venue_resources?kind=eq.pricing&status=eq.approved&category=eq.' + encodeURIComponent(row.category) + '&year=eq.' + row.year + (isNew ? '' : '&id=neq.' + entry.id), {
          method: 'PATCH', body: JSON.stringify({ status: 'archived', change_summary: 'Replaced by a newer approved schedule' }) });
      }
      const saved = isNew
        ? await api('venue_resources', { method: 'POST', body: JSON.stringify(row) })
        : await api('venue_resources?id=eq.' + entry.id, { method: 'PATCH', body: JSON.stringify(row) });
      // a pricing or policy change flags the contracts and client documents that may mention it
      const changedContent = isNew || f.body !== (entry.body || '') || JSON.stringify(data) !== JSON.stringify(entry.data || {});
      if ((k === 'pricing' || k === 'faq') && f.status === 'approved' && changedContent) {
        const yearFilter = k === 'pricing' && row.year ? '&or=(year.is.null,year.eq.' + row.year + ')' : '';
        await api('venue_resources?kind=eq.template&status=eq.approved&category=in.(' + REVIEW_DOC_TYPES.map(c => '"' + c + '"').join(',') + ')' + yearFilter, {
          method: 'PATCH', body: JSON.stringify({ needs_review: true, change_summary: 'Flagged for review: "' + row.title + '" changed' }) }).catch(() => {});
      }
      onSaved(saved && saved[0]);
    } catch (e) { setErr(/one_approved_price|duplicate/i.test(e.message) ? 'There is already an approved schedule for this rental type and year.' : e.message); setBusy(false); }
  }
  const inp = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e0d8cc', borderRadius: 7, fontSize: 13, fontFamily: 'inherit' };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={h2}>{isNew ? 'Add ' : 'Edit '}{KINDS[k].label.toLowerCase()}</div>
        <label style={lab}>{k === 'faq' ? 'Question' : k === 'template' ? 'Document name' : k === 'pricing' ? 'Name' : 'Title'}<input style={inp} value={f.title} onChange={e => set('title', e.target.value)} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <label style={lab}>{k === 'pricing' ? 'Rental type' : k === 'template' ? 'Document type' : 'Category'}
            <input style={inp} list={'cats-' + k} value={f.category} onChange={e => set('category', e.target.value)} />
            <datalist id={'cats-' + k}>{(CATEGORIES[k] || []).map(c => <option key={c} value={c} />)}</datalist>
          </label>
          {(k === 'pricing' || k === 'template') && <label style={lab}>{k === 'pricing' ? 'Rental year' : 'Applies to year (optional)'}<input style={inp} type="number" value={f.year} onChange={e => set('year', e.target.value)} /></label>}
          <label style={lab}>Status<select style={inp} value={f.status} onChange={e => set('status', e.target.value)}><option value="approved">{k === 'pricing' ? 'Approved (current)' : 'Approved'}</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          <label style={lab}>Audience<select style={inp} value={f.audience} onChange={e => set('audience', e.target.value)}><option value="client">Client-safe</option><option value="internal">Internal only</option></select></label>
        </div>
        {k === 'pricing' && <>
          <label style={lab}>Rates (one per line: label | price | extra-hour note)<textarea style={{ ...inp, minHeight: 70 }} value={f.ratesText} onChange={e => set('ratesText', e.target.value)} placeholder={'Saturday | $1,200\nSunday | $1,000'} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {PRICE_FIELDS.map(([key, label]) => <label key={key} style={lab}>{label}<input style={inp} type={key === 'effective_date' ? 'date' : 'text'} value={f.data[key] || ''} onChange={e => setData(key, e.target.value)} /></label>)}
          </div>
        </>}
        {k === 'template' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <label style={{ ...lab, gridColumn: '1 / -1' }}>Link (Google Doc, Drive file or PDF)<input style={inp} value={f.data.url || ''} onChange={e => setData('url', e.target.value)} placeholder="https://docs.google.com/…" /></label>
          <label style={lab}>Version<input style={inp} value={f.data.version || ''} onChange={e => setData('version', e.target.value)} /></label>
          <label style={lab}>Format<input style={inp} value={f.data.format || ''} onChange={e => setData('format', e.target.value)} placeholder="Google Doc, PDF, Word…" /></label>
        </div>}
        {k !== 'pricing' && <label style={lab}>{k === 'faq' ? 'Official answer' : k === 'template' ? (f.category === 'Client Communication' ? 'Template text' : 'Description / intended use') : 'Content'}<textarea style={{ ...inp, minHeight: 120 }} value={f.body} onChange={e => set('body', e.target.value)} /></label>}
        {(k === 'faq' || k === 'sm_ref' || k === 'vc_ref' || k === 'info') && <label style={lab}>Detailed explanation (optional)<textarea style={{ ...inp, minHeight: 60 }} value={f.detail} onChange={e => set('detail', e.target.value)} /></label>}
        {k !== 'pricing' && <label style={lab}>Related documents (comma separated)<input style={inp} value={f.relatedText} onChange={e => set('relatedText', e.target.value)} /></label>}
        {k !== 'pricing' && k !== 'template' && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.quick_ref} onChange={e => set('quick_ref', e.target.checked)} /> Show in Quick Reference</label>}
        <label style={lab}>Summary of this change<input style={inp} value={f.summary} onChange={e => set('summary', e.target.value)} placeholder={isNew ? 'e.g. Added 2027 wedding pricing' : 'e.g. Retainer raised to $1,000'} /></label>
        {err && <div style={{ color: '#b3261e', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btnGold} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ r, onEdit, onArchive }) {
  const d = r.data || {};
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2420', flex: 1 }}>{r.title}</div>
        {r.status === 'approved' ? pill('Current approved', '#e8f5e9', '#2e7d32') : statusPill(r.status)}{audiencePill(r.audience)}
      </div>
      {d.base_price && <div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 26, color: GOLD, marginTop: 4 }}>{d.base_price}</div>}
      {(d.rates || []).length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}><tbody>
        {d.rates.map((x, i) => <tr key={i} style={{ borderTop: i ? '1px solid #f2ece2' : 'none' }}><td style={{ padding: '6px 0', color: '#444' }}>{x.label}</td><td style={{ padding: '6px 0', fontWeight: 700, color: GOLD, textAlign: 'right', whiteSpace: 'nowrap' }}>{x.price}</td>{x.extra && <td style={{ padding: '6px 0 6px 10px', color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{x.extra}</td>}</tr>)}
      </tbody></table>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 16px', marginTop: 10 }}>
        {PRICE_FIELDS.filter(([key]) => key !== 'base_price' && d[key]).map(([key, label]) => <div key={key}><div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{key === 'effective_date' ? fmtDate(d[key]) : d[key]}</div></div>)}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={onEdit}>Edit</button>
        {r.status !== 'archived' && <button type="button" style={{ ...btn, color: '#a04545', borderColor: '#e0b4b4' }} onClick={onArchive}>Archive</button>}
        <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>Updated {fmtDate(r.updated_at)}{r.updated_by && r.updated_by !== 'Setup' ? ' · ' + r.updated_by : ''}</span>
      </div>
    </div>
  );
}

// What changed between two versions of an entry, as "field: old → new" lines.
function diffLines(prev, next) {
  if (!prev || !next) return [];
  const out = [];
  ['title', 'category', 'status', 'audience', 'year', 'body', 'detail', 'quick_ref', 'needs_review'].forEach(k => { if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) out.push([k.replace('_', ' '), prev[k], next[k]]); });
  const pd = prev.data || {}, nd = next.data || {};
  Array.from(new Set(Object.keys(pd).concat(Object.keys(nd)))).forEach(k => { if (JSON.stringify(pd[k]) !== JSON.stringify(nd[k])) out.push([k.replace(/_/g, ' '), pd[k], nd[k]]); });
  return out;
}
const show = (v) => v == null || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? v.map(x => typeof x === 'object' ? Object.values(x).join(' ') : x).join('; ') : JSON.stringify(v)) : String(v);

function ChangesList({ history, compact }) {
  const [open, setOpen] = React.useState(null);
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      {history.length === 0 && <div style={{ padding: 16, fontSize: 13, color: '#999' }}>No changes yet.</div>}
      {history.map((h, i) => {
        const lines = diffLines(h.previous, h.next);
        const big = h.kind === 'pricing' || h.kind === 'template' || h.kind === 'faq';
        return (
          <div key={h.id} style={{ padding: '10px 14px', borderTop: i ? '1px solid #f2ece2' : 'none', background: big && h.action !== 'created' ? '#fffdf7' : '#fff' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#888', minWidth: 150 }}>{fmtDateTime(h.at)}</span>
              {kindPill(h.kind)}
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2a2420' }}>{h.title}</span>
              {h.category && <span style={{ fontSize: 12, color: '#888' }}>· {h.category}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
              <b style={{ textTransform: 'capitalize' }}>{h.action}</b>{h.summary ? ': ' + h.summary : ''}{h.updated_by ? ' — ' + h.updated_by : ''}
              {!compact && lines.length > 0 && <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} style={{ background: 'none', border: 'none', color: GOLD, fontWeight: 600, fontSize: 12, cursor: 'pointer', marginLeft: 8 }}>{open === h.id ? 'Hide' : 'Previous vs new'}</button>}
            </div>
            {open === h.id && <div style={{ marginTop: 6, fontSize: 12 }}>
              {lines.map(([k, a, b]) => <div key={k} style={{ padding: '4px 0', borderTop: '1px dashed #eee' }}><b style={{ textTransform: 'capitalize' }}>{k}:</b> <span style={{ color: '#a04545', textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>{show(a)}</span> → <span style={{ color: '#2e7d32', whiteSpace: 'pre-wrap' }}>{show(b)}</span></div>)}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

export function VenuePoliciesView() {
  const [rows, setRows] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [tab, setTab] = React.useState('home');
  const [q, setQ] = React.useState('');
  const [year, setYear] = React.useState(null);
  const [openId, setOpenId] = React.useState(null);
  const [openPrice, setOpenPrice] = React.useState(null); // dashboard pricing row that is open
  const [editing, setEditing] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [hf, setHf] = React.useState({ from: '', to: '', category: '', kind: '', person: '' });

  function load() {
    Promise.all([
      api('venue_resources?select=*&order=kind.asc,category.asc,sort_order.asc,title.asc'),
      api('venue_resource_history?select=*&order=at.desc&limit=500'),
    ]).then(([r, h]) => { setRows(r || []); setHistory(h || []); setErr(''); })
      .catch(e => { setRows([]); setErr(/venue_resources/.test(e.message) ? 'The Policies & Resources tables are not set up yet.' : e.message); });
  }
  React.useEffect(load, []);

  const all = rows || [];
  const live = all.filter(r => showArchived || r.status !== 'archived');
  const years = Array.from(new Set(all.filter(r => r.kind === 'pricing' && r.year).map(r => r.year))).sort();
  const thisYear = new Date().getFullYear();
  const curYear = year || (years.includes(thisYear) ? thisYear : years[years.length - 1]) || thisYear;
  // Quick Reference reads the approved pricing for the current rental year
  const quickYear = years.includes(thisYear) ? thisYear : years.filter(y => y <= thisYear).pop() || years[0];
  const currentPricing = all.filter(r => r.kind === 'pricing' && r.status === 'approved' && r.year === quickYear);

  async function patch(r, body, summary) {
    try { await api('venue_resources?id=eq.' + r.id, { method: 'PATCH', body: JSON.stringify({ ...body, change_summary: summary }) }); load(); }
    catch (e) { setErr(e.message); }
  }
  const archive = (r) => { if (window.confirm('Archive "' + r.title + '"? It stays in the history and can be restored by editing it.')) patch(r, { status: 'archived' }, 'Archived'); };
  const reviewed = (r) => patch(r, { needs_review: false }, 'Reviewed after a pricing/policy change');
  // A new version of a template: a copy with the next version number; the old one is archived (kept for reference).
  async function newVersion(r) {
    const url = window.prompt('Link to the new version (Google Doc, Drive file or PDF):', (r.data || {}).url || '');
    if (url == null) return;
    const v = String((parseInt((r.data || {}).version, 10) || 1) + 1);
    try {
      await api('venue_resources?id=eq.' + r.id, { method: 'PATCH', body: JSON.stringify({ status: 'archived', change_summary: 'Replaced by version ' + v }) });
      await api('venue_resources', { method: 'POST', body: JSON.stringify({ kind: 'template', category: r.category, title: r.title, body: r.body, audience: r.audience, status: 'approved', year: r.year, sort_order: r.sort_order, approved_at: new Date().toISOString().slice(0, 10), data: { ...(r.data || {}), url: url.trim(), version: v }, change_summary: 'New version ' + v }) });
      load();
    } catch (e) { setErr(e.message); }
  }
  function goTo(r) { setTab(KINDS[r.kind].tab); if (r.kind === 'pricing' && r.year) setYear(r.year); setOpenId(r.id); setQ(''); setTimeout(() => { const el = document.getElementById('res-' + r.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); }

  const needle = q.trim().toLowerCase();
  const results = needle ? live.filter(r => JSON.stringify([r.title, r.category, r.body, r.detail, r.data]).toLowerCase().includes(needle)) : [];
  const cardFor = (r) => <ResourceCard key={r.id} r={r} open={openId === r.id} highlight={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)}
    onEdit={() => setEditing(r)} onArchive={() => archive(r)} onReviewed={() => reviewed(r)} onNewVersion={() => newVersion(r)} />;
  const grouped = (kind) => {
    const list = live.filter(r => r.kind === kind);
    const cats = Array.from(new Set((CATEGORIES[kind] || []).filter(c => list.some(r => r.category === c)).concat(list.map(r => r.category || 'Other'))));
    return cats.map(c => <div key={c} style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a7a62', marginBottom: 6 }}>{c}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.filter(r => (r.category || 'Other') === c).map(cardFor)}</div>
    </div>);
  };
  const addBtn = (kind, extra) => <button type="button" style={btnGold} onClick={() => setEditing({ kind, ...(extra || {}) })}>+ Add {KINDS[kind].label.toLowerCase()}</button>;

  const hist = history.filter(h => (!hf.from || h.at >= hf.from) && (!hf.to || h.at.slice(0, 10) <= hf.to) && (!hf.category || h.category === hf.category) && (!hf.kind || h.kind === hf.kind) && (!hf.person || h.updated_by === hf.person));
  const sel = { padding: '6px 8px', border: '1px solid #e0d8cc', borderRadius: 7, fontSize: 12, background: '#fff' };

  return (
    <div style={{ maxWidth: 980 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search policies, pricing, templates, FAQs and procedures…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', border: '1px solid #ded7cb', borderRadius: 10, fontSize: 14, marginBottom: 12, background: '#fff' }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(([k, label]) => <button key={k} type="button" onClick={() => { setTab(k); setQ(''); }} style={{ background: tab === k && !needle ? GOLD : '#fff', color: tab === k && !needle ? '#fff' : GOLD, border: '0.5px solid ' + GOLD, borderRadius: 8, padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{label}</button>)}
        <label style={{ marginLeft: 'auto', fontSize: 12, color: '#777', display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      {err && <div style={{ color: '#b3261e', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {rows === null ? <div style={{ color: '#aaa' }}>Loading…</div> : needle ? (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{results.length} result{results.length === 1 ? '' : 's'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map(r => <button key={r.id} type="button" onClick={() => goTo(r)} style={{ ...card, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {kindPill(r.kind)}<span style={{ fontWeight: 700, fontSize: 13, color: '#2a2420' }}>{r.title}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{r.category}{r.year ? ' · ' + r.year : ''}</span>
              {audiencePill(r.audience)}{statusPill(r.status)}
            </button>)}
          </div>
        </div>
      ) : tab === 'home' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...card, borderTop: '3px solid ' + GOLD, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
              <div style={{ ...h2, margin: 0 }}>Pricing {quickYear ? <span style={{ fontSize: 13, color: '#888', fontFamily: 'inherit', fontWeight: 400 }}>· {quickYear} rates</span> : null}</div>
              <button type="button" style={btn} onClick={() => setTab('pricing')}>All years</button>
            </div>
            {currentPricing.length === 0 && <div style={{ padding: '6px 16px 14px', fontSize: 13, color: '#888' }}>No approved pricing for this year yet.</div>}
            {currentPricing.map(r => {
              const d = r.data || {}, isOpen = openPrice === r.id;
              return <div key={r.id} style={{ borderTop: '1px solid #f2ece2' }}>
                <button type="button" onClick={() => setOpenPrice(isOpen ? null : r.id)} style={{ width: '100%', display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 16px', background: isOpen ? '#faf6ef' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#2a2420', flex: 1 }}>{isOpen ? '▾ ' : '▸ '}{r.category || r.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{priceSummary(d)}</span>
                </button>
                {isOpen && <div style={{ padding: '0 16px 14px', background: '#faf6ef' }}><PricingCard r={r} onEdit={() => setEditing(r)} onArchive={() => archive(r)} /></div>}
              </div>;
            })}
          </div>
          <div style={{ ...card, borderTop: '3px solid ' + GOLD }}>
            <div style={h2}>Quick Reference</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {live.filter(r => r.quick_ref && r.status === 'approved').map(r => <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', borderTop: '1px solid #f2ece2', paddingTop: 6 }}>
                <button type="button" onClick={() => goTo(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2a2420' }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{r.body}</div>
                </button>
                {audiencePill(r.audience)}
              </div>)}
            </div>
            {live.some(r => r.kind === 'template' && r.status === 'approved') && <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8a7a62', marginBottom: 6 }}>Frequently requested documents</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{live.filter(r => r.kind === 'template' && r.status === 'approved').slice(0, 8).map(r => <button key={r.id} type="button" style={btn} onClick={() => goTo(r)}>{r.title}</button>)}</div>
            </div>}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><div style={h2}>Recently Updated</div><button type="button" style={btn} onClick={() => setTab('changes')}>View all changes</button></div>
            <ChangesList history={history.filter(h => h.updated_by !== 'Setup').slice(0, 5)} compact />
          </div>
        </div>
      ) : tab === 'pricing' ? (
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#777' }}>Rental year:</span>
            {Array.from(new Set(years.concat([curYear]))).sort().map(y => <button key={y} type="button" onClick={() => setYear(y)} style={{ ...btn, background: y === curYear ? GOLD : '#fff', color: y === curYear ? '#fff' : GOLD }}>{y}</button>)}
            <button type="button" style={btn} onClick={() => { const y = window.prompt('Add a rental year:', String(Math.max(thisYear, ...years) + 1)); if (y && /^\d{4}$/.test(y)) setYear(parseInt(y, 10)); }}>+ Year</button>
            <span style={{ marginLeft: 'auto' }}>{addBtn('pricing', { year: curYear })}</span>
          </div>
          {curYear === quickYear && <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 10 }}>These are the current rates shown in Quick Reference.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {live.filter(r => r.kind === 'pricing' && r.year === curYear).map(r => <div key={r.id} id={'res-' + r.id}><PricingCard r={r} onEdit={() => setEditing(r)} onArchive={() => archive(r)} /></div>)}
          </div>
          {!live.some(r => r.kind === 'pricing' && r.year === curYear) && <div style={{ ...card, color: '#888', fontSize: 13 }}>No pricing for {curYear} yet. Use “+ Add pricing” to enter it.</div>}
        </div>
      ) : tab === 'changes' ? (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#777' }}>From <input type="date" style={sel} value={hf.from} onChange={e => setHf({ ...hf, from: e.target.value })} /></label>
            <label style={{ fontSize: 12, color: '#777' }}>To <input type="date" style={sel} value={hf.to} onChange={e => setHf({ ...hf, to: e.target.value })} /></label>
            <select style={sel} value={hf.kind} onChange={e => setHf({ ...hf, kind: e.target.value })}><option value="">All resource types</option>{Object.keys(KINDS).map(k => <option key={k} value={k}>{KINDS[k].label}</option>)}</select>
            <select style={sel} value={hf.category} onChange={e => setHf({ ...hf, category: e.target.value })}><option value="">All categories</option>{Array.from(new Set(history.map(h => h.category).filter(Boolean))).sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select style={sel} value={hf.person} onChange={e => setHf({ ...hf, person: e.target.value })}><option value="">Everyone</option>{Array.from(new Set(history.map(h => h.updated_by).filter(Boolean))).sort().map(p => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <ChangesList history={hist} />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{addBtn(TAB_KIND[tab])}</div>
          {tab === 'templates' && <div style={{ fontSize: 12, color: '#777', marginBottom: 12 }}>Contracts are never changed automatically: when pricing or a policy changes, the contracts and client documents that may mention it are marked “Review needed”.</div>}
          {live.some(r => r.kind === TAB_KIND[tab]) ? grouped(TAB_KIND[tab]) : <div style={{ ...card, color: '#888', fontSize: 13 }}>Nothing here yet.</div>}
        </div>
      )}
      {editing && <EditModal entry={editing} onClose={() => setEditing(null)} onSaved={(r) => { setEditing(null); if (r) setOpenId(r.id); load(); }} />}
    </div>
  );
}
