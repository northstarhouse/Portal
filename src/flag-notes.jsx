// Shared by the Inquiries page and the client dashboard.
const SUPABASE_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SUPABASE_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
// Red flags the couple raised during venue tours, written by the coordinator. Stored in portal_notes (about_person
// "inquiry:<email>", item_ref "redflag") so they follow the couple across inquiries; the author is stamped by the database.
// inline: no space below (sits on a line next to "+ Note" in Activity by Person). preloaded: this couple's flags,
// already fetched by the caller (the activity log loads every red flag once instead of one request per line).
export function InquiryFlagNotes({ who, inline, preloaded }) {
  var [notes, setNotes] = React.useState(null);
  var [text, setText] = React.useState('');
  var [editing, setEditing] = React.useState(null); // { id, text }
  var [busy, setBusy] = React.useState(false);
  var [open, setOpen] = React.useState(false);
  var key = 'inquiry:' + String(who || '').trim().toLowerCase();
  var H = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
  var HJ = Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, H);
  React.useEffect(function() {
    setNotes(null); setText(''); setEditing(null);
    if (!who) { setNotes([]); return; }
    if (Array.isArray(preloaded)) { setNotes(preloaded); return; }
    fetch(SUPABASE_URL + '/rest/v1/portal_notes?select=*&about_person=eq.' + encodeURIComponent(key) + '&item_ref=eq.redflag&order=created_at.asc', { headers: H })
      .then(function(r) { return r.ok ? r.json() : []; }).then(function(d) { setNotes(Array.isArray(d) ? d : []); }).catch(function() { setNotes([]); });
  }, [key]);
  function add() {
    var t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    fetch(SUPABASE_URL + '/rest/v1/portal_notes', { method: 'POST', headers: HJ, body: JSON.stringify({ about_person: key, item_ref: 'redflag', body: t }) })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function(rows) { setNotes(function(p) { return (p || []).concat([rows[0]]); }); setText(''); })
      .catch(function() { window.alert('The note could not be saved. Please try again.'); })
      .then(function() { setBusy(false); });
  }
  function saveEdit() {
    if (!editing || !editing.text.trim() || busy) return;
    setBusy(true);
    fetch(SUPABASE_URL + '/rest/v1/portal_notes?id=eq.' + editing.id, { method: 'PATCH', headers: HJ, body: JSON.stringify({ body: editing.text.trim() }) })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function(rows) { if (!rows || !rows.length) return Promise.reject(); setNotes(function(p) { return (p || []).map(function(n) { return n.id === editing.id ? rows[0] : n; }); }); setEditing(null); })
      .catch(function() { window.alert('The note could not be saved. Please try again.'); })
      .then(function() { setBusy(false); });
  }
  function remove(n) {
    if (!window.confirm('Delete this red flag note?')) return;
    fetch(SUPABASE_URL + '/rest/v1/portal_notes?id=eq.' + n.id, { method: 'DELETE', headers: H })
      .then(function(r) { if (!r.ok) throw new Error(); setNotes(function(p) { return (p || []).filter(function(x) { return x.id !== n.id; }); }); })
      .catch(function() { window.alert('The note could not be deleted.'); });
  }
  if (notes === null) return null;
  var fmt = function(iso) { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  var btnS = { background: 'none', border: 'none', padding: 0, color: '#b3261e', fontSize: 11, fontWeight: 600, cursor: 'pointer' };
  var flag = <svg width="16" height="16" viewBox="0 0 24 24" fill="#d9534f" stroke="#d9534f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4"/><path d="M4 4h13l-2.5 4.5L17 13H4z"/></svg>;
  var pill = { display: "inline-block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle", background: "#fdecea", color: "#b3261e", border: "1px solid #f1c9c5", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
  return (
    <div style={{ marginBottom: inline ? 0 : 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <button type="button" onClick={function() { setOpen(!open); }} title="Red flags from tours" aria-expanded={open} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: open ? "#fdecea" : "#fff", border: "1px solid #f1c9c5", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
          {flag}{notes.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#b3261e" }}>{notes.length}</span>}
        </button>
        {notes.map(function(n) { return <button key={n.id} type="button" title={n.body} onClick={function() { setOpen(true); }} style={pill}>{n.body}</button>; })}
      </div>
      {open && <div style={{ marginTop: 8, background: "#fdf3f2", border: "1px solid #f1c9c5", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "#a77" }}>What the couple flagged as a red flag while touring the venue.</div>
      {notes.map(function(n) {
        return <div key={n.id} style={{ borderLeft: '3px solid #d9534f', background: '#fff', borderRadius: 6, padding: '7px 10px', marginTop: 8 }}>
          {editing && editing.id === n.id ? (
            <div>
              <textarea autoFocus rows={3} value={editing.text} onChange={function(e) { var v = e.target.value; setEditing({ id: n.id, text: v }); }} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e0d8cc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" disabled={busy} onClick={saveEdit} style={{ background: '#b3261e', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={function() { setEditing(null); }} style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: '#2a2420', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{(n.author_name || 'Unknown') + ' · ' + fmt(n.created_at)}{n.updated_at ? ' · edited' : ''} <button type="button" style={Object.assign({}, btnS, { marginLeft: 8 })} onClick={function() { setEditing({ id: n.id, text: n.body }); }}>Edit</button> <button type="button" style={Object.assign({}, btnS, { marginLeft: 6 })} onClick={function() { remove(n); }}>Delete</button></div>
            </div>
          )}
        </div>;
      })}
      <div style={{ marginTop: 10 }}>
        <textarea rows={2} value={text} onChange={function(e) { setText(e.target.value); }} placeholder="Add a red flag the couple raised on their tour…" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #e8c5c1', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: '#fff' }} />
        <button type="button" disabled={busy || !text.trim()} onClick={add} style={{ marginTop: 6, background: text.trim() ? '#b3261e' : '#e6c9c6', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default' }}>{busy ? 'Saving…' : 'Add red flag'}</button>
      </div>
      </div>}
    </div>
  );
}

