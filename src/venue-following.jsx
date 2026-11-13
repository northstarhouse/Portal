// Venue Rentals > Tools > "Following": follow a couple (by email) to watch them move through the whole process, from their
// tour to their wedding: Toured -> Pre-booking form -> Agreement signed -> First payment -> Wedding/event day.
// Data: venue_follows (each follow is stamped with whoever is signed in) and the venue_follow_progress() database
// function, which ties the couple's tour, inquiry, pre-booking form, agreement and payments together by email.
// See supabase/migrations_manual/venue_follows.sql.
import { ClientNotes } from './client-notes.jsx';
const VF_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', VF_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const vfApi = (path, init = {}) => fetch(VF_URL + '/rest/v1/' + path, { ...init, headers: { apikey: VF_KEY, Authorization: 'Bearer ' + VF_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } })
  .then(async r => { const t = await r.text(); const d = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((d && (d.message || d.hint)) || 'Request failed'); return d; });

const GOLD = '#886c44';
const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const shortDate = (v) => {
  if (!v || typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return '';
  const d = v.length <= 10 ? new Date(v + 'T12:00:00') : new Date(v);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const firstName = (s) => String(s || '').trim().split(/\s+/)[0].toLowerCase();

// The stages, in order. Each returns { done, when } for one followed couple.
function stagesOf(p) {
  const today = todayKey();
  const ev = p.event_date && /^\d{4}-\d{2}-\d{2}$/.test(p.event_date) ? p.event_date : null;
  const isWedding = (p.prebooking && p.prebooking.kind === 'Wedding') || /wedding/i.test((p.inquiry && p.inquiry.event_type) || '') || /wedding/i.test((p.tour && p.tour.category) || '');
  const tourDone = !!(p.tour && p.tour.date && p.tour.date <= today && !/cancel/i.test(p.tour.status || ''));
  return [
    { key: 'tour', label: 'Toured', done: tourDone, when: p.tour ? (tourDone ? shortDate(p.tour.date) : 'Tour ' + shortDate(p.tour.date)) : '', by: p.tour && p.tour.guide ? 'Guide: ' + p.tour.guide : '' },
    { key: 'pre', label: 'Pre-booking form', done: !!p.prebooking, when: p.prebooking ? shortDate(p.prebooking.at) : '', by: p.prebooking_by || '' },
    { key: 'signed', label: 'Agreement signed', done: !!p.signed, when: p.signed === 'booked' ? 'Booked' : shortDate(p.signed), by: p.signed && p.signed_by ? (p.signed_by === 'HoneyBook' ? 'Via HoneyBook' : 'Countersigned by ' + p.signed_by) : '' },
    { key: 'paid', label: 'First payment', done: !!p.paid, when: p.paid === 'paid' ? 'Paid' : shortDate(p.paid), by: p.paid ? (p.paid_by && p.paid_by !== 'Paid online' && p.paid_by !== 'Logged by staff' ? 'Logged by ' + p.paid_by : (p.paid_by || '')) : '' },
    { key: 'day', label: isWedding ? 'Wedding day' : 'Event day', done: !!(ev && ev < today && p.signed), when: ev ? shortDate(ev) : '', by: p.site_manager ? 'Site manager: ' + p.site_manager : '' },
  ];
}
function currentStage(p) {
  const s = stagesOf(p);
  const last = s.map(x => x.done).lastIndexOf(true);
  if (last === s.length - 1) return { label: s[last].label === 'Wedding day' ? 'Married' : 'Event held', tone: 'done' };
  if (last === -1) return { label: p.tour ? 'Tour booked' : 'Following', tone: 'early' };
  return { label: s[last].label, tone: 'mid' };
}

const btn = { background: GOLD, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, padding: '6px 13px', cursor: 'pointer' };
const ghost = { background: 'none', border: '0.5px solid #e0d8cc', color: '#777', borderRadius: 7, fontSize: 12, padding: '5px 11px', cursor: 'pointer' };
const input = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: 13, border: '0.5px solid #d8cfc2', borderRadius: 6, fontFamily: 'inherit', background: '#fff' };

function Pipeline({ p }) {
  const s = stagesOf(p);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 10 }}>
      {s.map((x, i) => (
        <div key={x.key} style={{ borderRadius: 7, padding: '7px 8px', background: x.done ? '#e8f5e9' : '#f7f4ef', border: '1px solid ' + (x.done ? '#bfe0bf' : '#ece5da'), minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: x.done ? '#2e7d32' : '#a59a8a', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: x.done ? '#2e7d32' : '#fff', border: x.done ? 'none' : '1.5px solid #cfc6b8', color: '#fff', fontSize: 9, flexShrink: 0 }}>{x.done ? '✓' : i + 1}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</span>
          </div>
          <div style={{ fontSize: 11, color: x.done ? '#3b6b3d' : '#aaa', marginTop: 3, minHeight: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.when || (x.done ? '' : '—')}</div>
          {x.by && <div title={x.by} style={{ fontSize: 10.5, color: x.done ? '#5b7f5d' : '#b0a796', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.by}</div>}
        </div>
      ))}
    </div>
  );
}

export function VenueFollowingView({ navigate }) {
  const [me, setMe] = React.useState(null);
  const [rows, setRows] = React.useState(null);
  const [tours, setTours] = React.useState([]);
  const [scope, setScope] = React.useState('mine');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [query, setQuery] = React.useState('');

  function load() {
    vfApi('rpc/venue_follow_progress', { method: 'POST', body: '{}' }).then(d => setRows(Array.isArray(d) ? d : [])).catch(e => { setErr('Could not load: ' + e.message); setRows([]); });
  }
  React.useEffect(() => {
    vfApi('rpc/app_session_name', { method: 'POST', body: '{}' }).then(n => setMe(typeof n === 'string' ? n : '')).catch(() => setMe(''));
    vfApi('estate_tours?select=id,date,guide_name,visitor_name,visitor_email,status,category&visitor_email=not.is.null&order=date.desc&limit=3000').then(d => setTours(Array.isArray(d) ? d : [])).catch(() => {});
    load();
  }, []);

  const mine = (rows || []).filter(r => me && r.follower === me);
  const guides = [...new Set((rows || []).map(r => r.follower).filter(Boolean))].sort();
  const shown = scope === 'mine' ? mine : scope === 'all' ? (rows || []) : (rows || []).filter(r => r.follower === scope);
  const followedByMe = new Set(mine.map(r => r.email));

  async function follow(name, email) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('That email address does not look right.'); return; }
    setBusy(email); setErr('');
    try {
      await vfApi('venue_follows', { method: 'POST', body: JSON.stringify({ email, name: (name || '').trim() || null, follower: me || '' }) });
      load();
    } catch (e) { setErr(/duplicate|unique/i.test(e.message) ? 'You already follow ' + (name || email) + '.' : 'Could not follow: ' + e.message); }
    setBusy('');
  }
  async function unfollow(r) {
    if (!window.confirm('Stop following ' + (r.name || r.email) + '?')) return;
    try { await vfApi('venue_follows?id=eq.' + r.id, { method: 'DELETE' }); setRows(prev => prev.filter(x => x.id !== r.id)); }
    catch (e) { setErr('Could not unfollow: ' + e.message); }
  }

  // Couples the signed-in person toured (or is about to): one click to follow.
  const myFirst = firstName(me);
  const today = todayKey();
  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 120); return d.toISOString().slice(0, 10); })();
  const seen = new Set();
  const suggestions = tours.filter(t => myFirst && firstName(t.guide_name) === myFirst && t.date >= cutoff && !/cancel/i.test(t.status || '') && !/docent/i.test(t.category || ''))
    .filter(t => { const e = String(t.visitor_email || '').trim().toLowerCase(); if (!e || followedByMe.has(e) || seen.has(e)) return false; seen.add(e); return true; })
    .slice(0, 40);
  // Basic search over the couples in the current view (name or email).
  const q = query.trim().toLowerCase();
  const visible = q ? shown.filter(r => String(r.name || '').toLowerCase().includes(q) || String(r.email || '').toLowerCase().includes(q)) : shown;

  const tone = { early: { bg: '#f3efe8', c: '#8a7a64' }, mid: { bg: '#fff8e1', c: '#8a6200' }, done: { bg: '#e8f5e9', c: '#2e7d32' } };
  const section = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: GOLD, margin: '22px 0 10px' };

  return (
    <div style={{ maxWidth: 980 }}>
      {navigate && <button onClick={() => navigate('venue')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 12 }}>← Venue Rentals</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#888', maxWidth: 600 }}>Follow a couple to watch them go from their tour all the way to their wedding day. Progress updates on its own as they fill in the pre-booking form, sign, pay, and celebrate.</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search couples by name or email" aria-label="Search couples" style={{ ...input, width: 240 }} />
        <select value={scope} onChange={e => setScope(e.target.value)} aria-label="Whose follows to show"
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 10px', borderRadius: 8, border: '1px solid ' + GOLD, background: '#faf5ee', color: GOLD, cursor: 'pointer' }}>
          <option value="mine">Mine{rows ? ' (' + mine.length + ')' : ''}</option>
          {guides.filter(g => g !== me).map(g => <option key={g} value={g}>{g} ({(rows || []).filter(r => r.follower === g).length})</option>)}
          <option value="all">All tour guides{rows ? ' (' + rows.length + ')' : ''}</option>
        </select>
        </div>
      </div>
      {err && <div style={{ color: '#b3261e', fontSize: 12, marginTop: 10 }}>{err}</div>}

      <div style={section}>{scope === 'mine' ? 'Couples you\'re following' : scope === 'all' ? 'All tour guides\' follows' : 'Couples ' + scope + ' is following'}</div>
      {rows === null && <div style={{ fontSize: 13, color: '#aaa' }}>Loading…</div>}
      {rows && !shown.length && <div style={{ fontSize: 13, color: '#aaa', background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: 18 }}>{scope === 'mine' ? 'You are not following anyone yet. Pick a couple you toured below.' : scope === 'all' ? 'No one is being followed yet.' : scope + ' is not following anyone yet.'}</div>}
      {rows && shown.length > 0 && q && !visible.length && <div style={{ fontSize: 13, color: '#aaa', background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: 18 }}>No couples match “{query.trim()}”.</div>}
      {visible.map(r => {
        const st = currentStage(r), t = tone[st.tone];
        return (
          <div key={r.id} style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '13px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {r.name || r.email}
                  <span style={{ fontSize: 11, fontWeight: 700, background: t.bg, color: t.c, borderRadius: 10, padding: '2px 9px' }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{r.email}{r.event_date ? ' · ' + (shortDate(r.event_date)) : ''}{scope === 'all' ? ' · followed by ' + r.follower : ''}</div>
              </div>
              {r.follower === me && <button onClick={() => unfollow(r)} style={{ ...ghost, color: '#c0392b', borderColor: '#f0cfcf' }}>Unfollow</button>}
            </div>
            <Pipeline p={r} />
            <div style={{ marginTop: 6 }}><ClientNotes emails={[r.email]} compact /></div>
          </div>
        );
      })}

      <div style={section}>Couples you toured</div>
      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, overflow: 'hidden' }}>
        {me === null ? <div style={{ padding: 14, fontSize: 13, color: '#aaa' }}>Loading…</div>
          : !suggestions.length ? <div style={{ padding: 14, fontSize: 13, color: '#aaa' }}>No recent or upcoming tours with you that you are not already following.</div>
          : suggestions.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: i ? '0.5px solid #f1ece3' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{t.visitor_name || t.visitor_email}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{t.date > today ? 'Tour on ' : 'Toured '}{shortDate(t.date)}{t.category ? ' · ' + t.category : ''} · {t.visitor_email}</div>
              </div>
              <button disabled={busy === String(t.visitor_email).toLowerCase()} onClick={() => follow(t.visitor_name, t.visitor_email)} style={btn}>Follow</button>
            </div>
          ))}
      </div>

    </div>
  );
}
