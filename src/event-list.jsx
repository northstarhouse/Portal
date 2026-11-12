// Admin > "2027 Event List": the Events Committee's event plan for the year as its own Portal page. Same data as the
// Volunteer Hub's Events Committee > 2027 Event Plan (events_plan), so edits show in both places. Shows each event's
// committee vote, final decision, the finalize checklist and the highlighted Committee decisions note; events can be
// added and edited here. Finalizing (turning a row into a real Events Committee event) stays in the Volunteer Hub.
const EL_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', EL_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const EL_H = { apikey: EL_KEY, Authorization: 'Bearer ' + EL_KEY, 'Content-Type': 'application/json' };
const elApi = (path, init = {}) => fetch(EL_URL + '/rest/v1/' + path, { ...init, headers: { ...EL_H, Prefer: 'return=representation', ...(init.headers || {}) } })
  .then(async r => { const t = await r.text(); const d = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((d && (d.message || d.hint)) || 'Request failed'); return d; });

const PLAN_YEAR = 2027;
const GOLD = '#886c44';
const HUB_URL = 'https://northstarhouse.github.io/volunteerhub/';
const fmtDay = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtShort = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtStamp = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return (h % 12 || 12) + ':' + String(m || 0).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
};
// Same matching and colors as the Hub.
const planKey = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+-\s+.*$/, '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const VOTE_TONE = { Yes: { bg: '#e8f5e9', color: '#2e7d32' }, No: { bg: '#ffebee', color: '#c62828' } };
function voteResult(t) {
  if (!t || !t.total) return null;
  const choices = Object.keys(t).filter(k => k !== 'total');
  const top = choices.sort((a, b) => t[b] - t[a])[0];
  const tie = choices.filter(c => t[c] === t[top]).length > 1;
  const label = tie ? 'Tie' : top === 'Yes' || top === 'No' || top === 'Abstain' ? top : 'Notes';
  return { label, count: t[top], total: t.total, tone: tie ? { bg: '#fff3e0', color: '#e65100' } : VOTE_TONE[top] || { bg: '#fff3e0', color: '#e65100' }, title: choices.map(c => c + ': ' + t[c]).join(', ') };
}
const DECISIONS = ['Moving Forward', 'Not Moving Forward', 'Merging with Another Event', 'Needs Further Discussion'];
const DECISION_TONE = { 'Moving Forward': { bg: '#e8f5e9', color: '#2e7d32' }, 'Not Moving Forward': { bg: '#ffebee', color: '#c62828' }, 'Merging with Another Event': { bg: '#ede7f6', color: '#5e35b1' }, 'Needs Further Discussion': { bg: '#fff8e1', color: '#8a6200' } };
const DECISION_RANK = { 'Moving Forward': 0, 'Merging with Another Event': 1, 'Needs Further Discussion': 3, 'Not Moving Forward': 4 };
const rankOf = (d) => (d in DECISION_RANK ? DECISION_RANK[d] : 2);
const sortPlan = (rows) => rows.slice().sort((a, b) => rankOf(a.final_decision) - rankOf(b.final_decision) || a.sort_order - b.sort_order);
const daysOf = (r) => (Array.isArray(r.days) ? r.days : []);
const has = (v) => !!String(v || '').trim();
function reqs(r) {
  const base = [['pricing', 'Pricing', has(r.pricing)], ['budget', 'Budget', has(r.budget)]];
  if (r.multi_day) {
    const days = daysOf(r);
    if (days.length < 2) return [['days', 'Number of days', false]].concat(base);
    return days.map((d, i) => ['day' + i, 'Day ' + (i + 1) + (d.date ? ' · ' + fmtShort(d.date) : ''), has(d.date) && has(d.start_time) && has(d.end_time)]).concat(base);
  }
  return [['date', 'Date', has(r.date)], ['start_time', 'Start time', has(r.start_time)], ['end_time', 'End time', has(r.end_time)]].concat(base);
}

async function fetchVotes() {
  try {
    const items = await elApi('events_vote_items?title=eq.' + encodeURIComponent(PLAN_YEAR + ' Events List') + '&select=id');
    const itemId = Array.isArray(items) && items[0] ? items[0].id : null;
    if (!itemId) return {};
    const [parts, votes] = await Promise.all([
      elApi('events_vote_parts?item_id=eq.' + itemId + '&select=id,title'),
      elApi('events_votes?item_id=eq.' + itemId + '&select=part_id,choice'),
    ]);
    const out = {};
    (parts || []).forEach(p => {
      const tally = { total: 0 };
      (votes || []).filter(v => v.part_id === p.id).forEach(v => { tally[v.choice] = (tally[v.choice] || 0) + 1; tally.total++; });
      out[planKey(p.title)] = tally;
    });
    return out;
  } catch (e) { return {}; }
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: 13, border: '0.5px solid #d8cfc2', borderRadius: 6, fontFamily: 'inherit', background: '#fff' };
const lab = { fontSize: 11, fontWeight: 600, color: '#888', display: 'flex', flexDirection: 'column', gap: 4 };
const btnGold = { background: GOLD, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: 'pointer' };
const btnGhost = { background: 'none', color: '#777', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, padding: '6px 13px', cursor: 'pointer' };

export function EventListView({ navigate }) {
  const [rows, setRows] = React.useState(null);
  const [votes, setVotes] = React.useState({});
  const [me, setMe] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const [draft, setDraft] = React.useState({});
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [newName, setNewName] = React.useState('');

  React.useEffect(() => {
    elApi('events_plan?year=eq.' + PLAN_YEAR + '&select=*&order=sort_order.asc').then(d => setRows(d || [])).catch(e => { setErr('Could not load the list: ' + e.message); setRows([]); });
    fetchVotes().then(setVotes);
    elApi('rpc/app_session_name', { method: 'POST', body: '{}' }).then(n => setMe(typeof n === 'string' ? n : '')).catch(() => {});
  }, []);

  async function patchRow(r, body) {
    const d = await elApi('events_plan?id=eq.' + r.id, { method: 'PATCH', body: JSON.stringify(body) });
    if (!Array.isArray(d) || !d[0]) throw new Error('The change was not saved.');
    setRows(prev => prev.map(x => x.id === r.id ? d[0] : x));
    return d[0];
  }
  async function setDecision(r, value) {
    setErr('');
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, final_decision: value || null } : x));
    try { await patchRow(r, { final_decision: value || null, updated_at: new Date().toISOString() }); }
    catch (e) { setErr('Could not save the decision: ' + e.message); setRows(prev => prev.map(x => x.id === r.id ? r : x)); }
  }
  function edit(r) {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id); setErr('');
    const days = daysOf(r).length ? daysOf(r).map(d => ({ date: d.date || '', start_time: d.start_time || '', end_time: d.end_time || '' }))
      : [{ date: r.date || '', start_time: r.start_time || '', end_time: r.end_time || '' }, { date: '', start_time: '', end_time: '' }];
    setDraft({ name: r.name || '', multi_day: !!r.multi_day, days, date: r.date || '', start_time: r.start_time || '', end_time: r.end_time || '', pricing: r.pricing || '', budget: r.budget || '', decisions: r.decisions || '' });
  }
  function setDayCount(n) {
    const count = Math.max(2, Math.min(30, parseInt(n, 10) || 2));
    setDraft(d => { const days = d.days.slice(0, count); while (days.length < count) days.push({ date: '', start_time: '', end_time: '' }); return { ...d, days }; });
  }
  const setDay = (i, k, v) => setDraft(d => ({ ...d, days: d.days.map((x, j) => j === i ? { ...x, [k]: v } : x) }));

  async function save(r) {
    if (!draft.name.trim()) { setErr('The event needs a name.'); return; }
    setBusy(r.id); setErr('');
    const days = draft.multi_day ? draft.days.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) : null;
    const first = days ? days[0] : draft;
    const body = { name: draft.name.trim(), multi_day: !!draft.multi_day, days, end_date: null, date: first.date || null, start_time: first.start_time || null, end_time: first.end_time || null, pricing: draft.pricing.trim() || null, budget: draft.budget.trim() || null, updated_at: new Date().toISOString() };
    if ((draft.decisions || '').trim() !== (r.decisions || '').trim()) {
      body.decisions = draft.decisions.trim() || null;
      body.decisions_updated_at = new Date().toISOString();
      body.decisions_updated_by = me || null;
    }
    try { await patchRow(r, body); setOpen(null); } catch (e) { setErr('Could not save: ' + e.message); }
    setBusy('');
  }
  async function addEvent(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if ((rows || []).some(x => x.name.trim().toLowerCase() === name.toLowerCase())) { setErr('"' + name + '" is already on the list.'); return; }
    setBusy('new'); setErr('');
    try {
      const sort = Math.max(-1, ...(rows || []).map(x => x.sort_order || 0)) + 1;
      const d = await elApi('events_plan', { method: 'POST', body: JSON.stringify({ year: PLAN_YEAR, name, sort_order: sort, final_decision: 'Moving Forward' }) });
      const row = Array.isArray(d) && d[0];
      if (!row) throw new Error('The event was not added.');
      setRows(prev => (prev || []).concat([row]));
      setNewName('');
      edit(row);
    } catch (x) { setErr('Could not add the event: ' + x.message); }
    setBusy('');
  }
  async function remove(r) {
    if (!window.confirm('Remove "' + r.name + '" from the ' + PLAN_YEAR + ' list? This can\'t be undone.')) return;
    setErr('');
    try {
      await elApi('events_plan?id=eq.' + r.id, { method: 'DELETE' });
      setRows(prev => prev.filter(x => x.id !== r.id)); setOpen(null);
    } catch (e) { setErr('Could not remove: ' + e.message); }
  }

  const all = rows || [];
  const counts = { all: all.length };
  DECISIONS.forEach(d => { counts[d] = all.filter(r => r.final_decision === d).length; });
  const finalizedCount = all.filter(r => r.finalized_event_id).length;
  const ready = all.filter(r => !r.finalized_event_id && r.final_decision !== 'Not Moving Forward' && reqs(r).every(q => q[2])).length;
  const shown = sortPlan(all).filter(r => filter === 'all' || r.final_decision === filter);

  return (
    <div style={{ maxWidth: 900 }}>
      {navigate && <button onClick={() => navigate('admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 14 }}>← Admin</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#888', maxWidth: 560 }}>The Events Committee's confirmed events for {PLAN_YEAR}. Same list as the Volunteer Hub, so changes show in both. Finalize events in the <a href={HUB_URL} target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>Volunteer Hub</a>.</div>
        {rows && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Events', all.length], ['Ready to finalize', ready], ['Finalized', finalizedCount]].map(([l, n]) => (
            <div key={l} style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 8, padding: '7px 12px', textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, lineHeight: 1.1 }}>{n}</div>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
            </div>
          ))}
        </div>}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['all', 'All']].concat(DECISIONS.map(d => [d, d])).map(([k, l]) => {
          const on = filter === k, t = DECISION_TONE[k];
          return <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: on ? 700 : 500, border: '1px solid ' + (on ? (t ? t.color : GOLD) : '#e0d8cc'), background: on ? (t ? t.bg : '#faf5ee') : '#fff', color: on ? (t ? t.color : GOLD) : '#888' }}>{l} <span style={{ opacity: 0.7 }}>{counts[k] || 0}</span></button>;
        })}
      </div>

      {err && <div style={{ color: '#b3261e', fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, overflow: 'hidden' }}>
        {rows === null && <div style={{ padding: 18, fontSize: 13, color: '#aaa' }}>Loading…</div>}
        {rows !== null && !shown.length && <div style={{ padding: 18, fontSize: 13, color: '#aaa' }}>No events here.</div>}
        {shown.map((r, i) => {
          const finalized = !!r.finalized_event_id;
          const vr = voteResult(votes[planKey(r.name)]);
          const dt = DECISION_TONE[r.final_decision];
          const dropped = r.final_decision === 'Not Moving Forward';
          const box = dt ? { bg: dt.bg, edge: dt.color, head: dt.color } : { bg: '#fff8e1', edge: '#e0a800', head: '#8a6200' };
          const isOpen = open === r.id;
          return (
            <div key={r.id} style={{ padding: '13px 16px', borderTop: i ? '0.5px solid #efe8dd' : 'none', opacity: finalized ? 0.8 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {r.name}
                    {vr && <span title={'Committee vote · ' + vr.title} style={{ fontSize: 11, fontWeight: 700, background: vr.tone.bg, color: vr.tone.color, borderRadius: 10, padding: '2px 9px' }}>{vr.label} {vr.count}/{vr.total}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {[r.multi_day ? (daysOf(r).length || 'Multi') + '-day: ' + (daysOf(r).filter(d => d.date).map(d => fmtShort(d.date)).join(', ') || 'dates to set') : '', !r.multi_day && r.date ? fmtDay(r.date) : '', !r.multi_day && r.start_time ? fmtTime(r.start_time) + (r.end_time ? '–' + fmtTime(r.end_time) : '') : '', r.pricing ? 'Pricing: ' + r.pricing : '', r.budget ? 'Budget: ' + r.budget : ''].filter(Boolean).join(' · ') || 'No details yet'}
                  </div>
                </div>
                <select value={r.final_decision || ''} onChange={e => setDecision(r, e.target.value)} aria-label={'Final decision for ' + r.name}
                  style={{ fontSize: 12, fontWeight: 600, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', border: dt ? '1px solid transparent' : '0.5px solid #d8cfc2', background: dt ? dt.bg : '#fff', color: dt ? dt.color : '#333' }}>
                  <option value="">Final decision…</option>
                  {DECISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {finalized && <span style={{ fontSize: 11, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, padding: '3px 10px' }}>✓ Finalized {fmtStamp(r.finalized_at)}</span>}
                {!finalized && <button onClick={() => edit(r)} style={btnGhost}>{isOpen ? 'Close' : 'Edit'}</button>}
              </div>

              {!finalized && !dropped && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {reqs(r).map(([k, label, ok]) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 9px', background: ok ? '#e8f5e9' : '#ffebee', color: ok ? '#2e7d32' : '#c62828', border: '1px solid ' + (ok ? '#bfe0bf' : '#f2b8b5') }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, borderRadius: 3, background: ok ? '#2e7d32' : '#fff', border: ok ? 'none' : '1.5px solid #e57373', color: '#fff', fontSize: 10, lineHeight: 1 }}>{ok ? '✓' : ''}</span>
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {!isOpen && (
                <div style={{ marginTop: 8, background: box.bg, borderLeft: '3px solid ' + box.edge, borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: box.head, marginBottom: 3 }}>
                    Committee decisions{r.decisions_updated_at ? ' · as of ' + fmtStamp(r.decisions_updated_at) + (r.decisions_updated_by ? ' (' + r.decisions_updated_by + ')' : '') : ''}
                  </div>
                  <div style={{ fontSize: 13, color: r.decisions ? '#3a332a' : box.head, whiteSpace: 'pre-wrap', fontStyle: r.decisions ? 'normal' : 'italic' }}>{r.decisions || 'No decisions recorded yet.'}</div>
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={lab}>Event name<input style={inputStyle} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
                  <label style={{ ...lab, color: '#8a6200' }}>Committee decisions
                    <textarea rows={5} value={draft.decisions} onChange={e => setDraft({ ...draft, decisions: e.target.value })} placeholder="What the committee decided (format, lead, budget direction, open questions…)" style={{ ...inputStyle, background: '#fffbea', border: '1px solid #e8d48a', resize: 'vertical' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!draft.multi_day} onChange={e => setDraft({ ...draft, multi_day: e.target.checked })} style={{ width: 16, height: 16, accentColor: GOLD }} />
                    Multi-day event
                  </label>
                  {draft.multi_day && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ ...lab, flexDirection: 'row', alignItems: 'center', gap: 8 }}>How many days?
                        <input type="number" min={2} max={30} value={draft.days.length} onChange={e => setDayCount(e.target.value)} style={{ ...inputStyle, width: 70 }} />
                      </label>
                      {draft.days.map((d, j) => (
                        <div key={j} style={{ display: 'grid', gridTemplateColumns: '60px repeat(auto-fit, minmax(130px, 1fr))', gap: 8, alignItems: 'end' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, paddingBottom: 8 }}>Day {j + 1}</div>
                          <label style={lab}>Date<input type="date" style={inputStyle} value={d.date} onChange={e => setDay(j, 'date', e.target.value)} /></label>
                          <label style={lab}>Start time<input type="time" step="900" style={inputStyle} value={d.start_time} onChange={e => setDay(j, 'start_time', e.target.value)} /></label>
                          <label style={lab}>End time<input type="time" step="900" style={inputStyle} value={d.end_time} onChange={e => setDay(j, 'end_time', e.target.value)} /></label>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {!draft.multi_day && <label style={lab}>Date<input type="date" style={inputStyle} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>}
                    {!draft.multi_day && <label style={lab}>Start time<input type="time" step="900" style={inputStyle} value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} /></label>}
                    {!draft.multi_day && <label style={lab}>End time<input type="time" step="900" style={inputStyle} value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} /></label>}
                    <label style={lab}>Pricing<input style={inputStyle} value={draft.pricing} onChange={e => setDraft({ ...draft, pricing: e.target.value })} placeholder="e.g. $25 / $15 members" /></label>
                    <label style={lab}>Budget<input style={inputStyle} value={draft.budget} onChange={e => setDraft({ ...draft, budget: e.target.value })} placeholder="e.g. $1,500" /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button disabled={busy === r.id} onClick={() => save(r)} style={btnGold}>{busy === r.id ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setOpen(null)} style={btnGhost}>Cancel</button>
                    <button onClick={() => remove(r)} style={{ ...btnGhost, marginLeft: 'auto', color: '#c0392b', borderColor: '#f0cfcf' }}>Remove from list</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows !== null && (
          <form onSubmit={addEvent} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '0.5px solid #efe8dd', flexWrap: 'wrap', background: '#fcfaf6' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New event name (e.g. a merged event)" style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }} />
            <button type="submit" disabled={busy === 'new' || !newName.trim()} style={{ ...btnGold, opacity: newName.trim() ? 1 : 0.6 }}>{busy === 'new' ? 'Adding…' : '+ Add event'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
