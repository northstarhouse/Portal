// Internal (staff-only) notes about a couple, kept by email in venue_client_notes. The same notes show on the couple's
// client profile and on their Following card, so a note added in either place appears in both. Each note is stamped
// by the database with who wrote it (and who last edited it). See supabase/migrations_manual/venue_client_notes.sql.
const CN_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', CN_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const cnApi = (path, init = {}) => fetch(CN_URL + '/rest/v1/' + path, { ...init, headers: { apikey: CN_KEY, Authorization: 'Bearer ' + CN_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } })
  .then(async r => { const t = await r.text(); const d = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((d && (d.message || d.hint)) || 'Request failed'); return d; });
const CN_GOLD = '#886c44';
const cnWhen = (iso) => { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
const cleanEmail = (e) => String(e || '').trim().toLowerCase().replace(/[,()"<>]/g, '');

export function ClientNotes({ emails, compact }) {
  const list = [...new Set((emails || []).map(cleanEmail).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  const key = list.join(',');
  const [notes, setNotes] = React.useState(null);
  const [editing, setEditing] = React.useState(null); // note id or 'new'
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  function load() {
    if (!list.length) { setNotes([]); return; }
    cnApi('venue_client_notes?select=*&email=in.(' + list.map(e => '"' + e + '"').join(',') + ')&order=created_at.asc')
      .then(d => setNotes(Array.isArray(d) ? d : [])).catch(() => setNotes([]));
  }
  React.useEffect(load, [key]);

  async function save() {
    const text = draft.trim();
    if (!text) { setErr('Write a note first.'); return; }
    setBusy(true); setErr('');
    try {
      if (editing === 'new') await cnApi('venue_client_notes', { method: 'POST', body: JSON.stringify({ email: list[0], body: text }) });
      else await cnApi('venue_client_notes?id=eq.' + editing, { method: 'PATCH', body: JSON.stringify({ body: text }) });
      setEditing(null); setDraft(''); load();
    } catch (e) { setErr('Could not save the note: ' + e.message); }
    setBusy(false);
  }
  async function del(n) {
    if (!window.confirm('Delete this note?')) return;
    try { await cnApi('venue_client_notes?id=eq.' + n.id, { method: 'DELETE' }); load(); }
    catch (e) { setErr('Could not delete the note: ' + e.message); }
  }

  if (!list.length) return compact ? null : <div style={{ fontSize: 12, color: '#999' }}>No email on file, so notes can't be saved for this client.</div>;
  const link = { background: 'none', border: 'none', padding: 0, color: CN_GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
  const editor = (
    <div style={{ marginTop: 6 }}>
      <textarea autoFocus rows={3} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Internal note (staff only). Shows on the client profile and on Following." style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '0.5px solid #d8cfc2', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
        <button type="button" disabled={busy} onClick={save} style={{ background: CN_GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save note'}</button>
        <button type="button" onClick={() => { setEditing(null); setErr(''); }} style={{ background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
  return (
    <div>
      {notes === null && <div style={{ fontSize: 12, color: '#bbb' }}>Loading notes…</div>}
      {notes && !notes.length && editing !== 'new' && !compact && <div style={{ fontSize: 12, color: '#999' }}>No internal notes yet.</div>}
      {(notes || []).map(n => editing === n.id ? <div key={n.id}>{editor}</div> : (
        <div key={n.id} style={{ marginTop: 6, background: '#faf6ef', borderLeft: '3px solid ' + CN_GOLD, borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ fontSize: 13, color: CN_GOLD, fontWeight: 700, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 3 }}>
            <span style={{ fontSize: 12, color: '#999' }}>{[n.created_by ? '— ' + n.created_by : '', n.created_at ? cnWhen(n.created_at) : ''].filter(Boolean).join(' · ')}{n.updated_at ? ' · edited' + (n.updated_by ? ' by ' + n.updated_by : '') : ''}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <button type="button" style={link} onClick={() => { setEditing(n.id); setDraft(n.body); setErr(''); }}>Edit</button>
              <button type="button" style={{ ...link, color: '#a04545' }} onClick={() => del(n)}>Delete</button>
            </span>
          </div>
        </div>
      ))}
      {editing === 'new' ? editor : <button type="button" onClick={() => { setEditing('new'); setDraft(''); setErr(''); }} style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, color: '#b5a185', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add internal note</button>}
      {err && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{err}</div>}
    </div>
  );
}
