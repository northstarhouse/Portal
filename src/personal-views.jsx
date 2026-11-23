// Admin > Personalized Views: choose what each person does not see in the Portal.
// Rules live in portal_view_rules (keyed by sign-in email). The Portal reads the signed-in person's rule on load and
// removes those sections from their menu and Overview. It is a view setting, not a lock on the underlying data.
const PV_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co';
const PV_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const PV_H = { apikey: PV_KEY, Authorization: 'Bearer ' + PV_KEY, 'Content-Type': 'application/json' };
const GOLD = '#886c44';
export const PV_SECTIONS = [
  ['donors', 'Donations'], ['sponsors', 'Sponsors'], ['volunteers', 'Volunteers'], ['venue', 'Venue Rentals'],
  ['admin', 'Admin'], ['board', 'Board Communication'], ['meeting-reports', 'Meeting & Board Reports'], ['ideas', 'Ideas & Initiatives'], ['quarterly', 'Quarterly Update'],
];
const pvGet = path => fetch(PV_URL + '/rest/v1/' + path, { headers: PV_H }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error((d && d.message) || 'Request failed'); return d; });

export function PersonalViewsView() {
  const [rules, setRules] = React.useState(null);
  const [vols, setVols] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [add, setAdd] = React.useState('');
  const [saved, setSaved] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const [r, v] = await Promise.all([
        pvGet('portal_view_rules?select=*&order=note'),
        pvGet('2026%20Volunteers?select=id,First%20Name,Last%20Name,Email,Team,Status&Status=eq.Active&order=First%20Name&limit=500'),
      ]);
      setRules(r); setVols(v.filter(x => x.Email && String(x.Email).trim()));
    } catch (e) { setErr(e.message); setRules([]); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const people = React.useMemo(() => {
    const byEmail = {}; (rules || []).forEach(r => { byEmail[r.email] = r; });
    const out = [], seen = {};
    vols.forEach(v => {
      const team = String(v.Team || ''), email = String(v.Email).trim().toLowerCase();
      const board = /board member/i.test(team), lead = /team lead/i.test(team), staff = /staff/i.test(team);
      if (!(board || lead || staff)) return;
      seen[email] = true;
      out.push({ email, name: (String(v['First Name'] || '').trim() + ' ' + String(v['Last Name'] || '').trim()).trim(), role: board ? 'Board member' : lead ? 'Team leader' : 'Staff', hidden: (byEmail[email] || {}).hidden || [], saved: !!byEmail[email] });
    });
    (rules || []).forEach(r => { if (!seen[r.email]) out.push({ email: r.email, name: r.note || r.email, role: '', hidden: r.hidden || [], saved: true }); });
    const rk = r => r === 'Board member' ? 0 : r === 'Team leader' ? 1 : r === 'Staff' ? 2 : 3;
    out.sort((a, b) => rk(a.role) - rk(b.role) || a.name.localeCompare(b.name));
    return out;
  }, [rules, vols]);
  const nameFor = email => { const v = vols.find(x => String(x.Email).trim().toLowerCase() === email); return v ? (v['First Name'] + ' ' + (v['Last Name'] || '')).trim() : ''; };
  async function save(rule, hidden) {
    setErr(''); setSaved('');
    setRules(prev => prev.some(r => r.email === rule.email) ? prev.map(r => r.email === rule.email ? { ...r, hidden } : r) : prev.concat([{ email: rule.email, hidden, note: rule.name || rule.note || '' }]));
    try {
      const res = await fetch(PV_URL + '/rest/v1/portal_view_rules?on_conflict=email', { method: 'POST', headers: { ...PV_H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ email: rule.email, hidden, note: rule.name || rule.note || null, updated_at: new Date().toISOString() }) });
      if (!res.ok) throw new Error('Could not save (' + res.status + ')');
      setSaved('Saved. It takes effect the next time they open or refresh the Portal.');
    } catch (e) { setErr(e.message); load(); }
  }
  async function addPerson() {
    const v = vols.find(x => String(x.id) === add); if (!v) return;
    setErr('');
    try {
      const res = await fetch(PV_URL + '/rest/v1/portal_view_rules?on_conflict=email', { method: 'POST', headers: { ...PV_H, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ email: String(v.Email).trim().toLowerCase(), hidden: [], note: (v['First Name'] + ' ' + (v['Last Name'] || '')).trim() }) });
      if (!res.ok) throw new Error('Could not add (' + res.status + ')');
      setAdd(''); load();
    } catch (e) { setErr(e.message); }
  }
  async function remove(rule) {
    if (!window.confirm('Show ' + (rule.note || 'this person') + ' everything again? Their custom view will be removed.')) return;
    try {
      const res = await fetch(PV_URL + '/rest/v1/portal_view_rules?email=eq.' + encodeURIComponent(rule.email), { method: 'DELETE', headers: { ...PV_H, Prefer: 'return=minimal' } });
      if (!res.ok) throw new Error('Could not remove (' + res.status + ')');
      load();
    } catch (e) { setErr(e.message); }
  }

  const card = { background: '#fff', border: '0.5px solid #e6dfd3', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(60,45,20,0.04)' };
  const have = new Set((rules || []).map(r => r.email));
  const choices = vols.filter(v => !people.some(p => p.email === String(v.Email).trim().toLowerCase()));

  return <div style={{ maxWidth: 860, paddingBottom: 40 }}>
    <div style={{ borderBottom: '1.5px solid ' + GOLD, paddingBottom: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2 }}>Portal access</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginTop: 2 }}>Personalized Views</div>
      <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 4 }}>Every board member, team leader and staff member is listed. Tick what each person should <b>not</b> see; those sections disappear from their menu and Overview page.</div>
    </div>
    {err && <div role="alert" style={{ color: '#b3261e', background: '#fce4e4', borderRadius: 9, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{err}</div>}
    {saved && <div style={{ color: '#2e7d32', background: '#eef7ee', borderRadius: 9, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{saved}</div>}
    {rules === null ? <div style={{ color: '#8a7e6b' }}>Loading…</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {people.length === 0 && <div style={{ ...card, color: '#a09580', fontSize: 13 }}>No board members, leaders or staff found.</div>}
      {people.map(r => <div key={r.email} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif" }}>{r.name || nameFor(r.email) || 'Person'}</div>
            <div style={{ fontSize: 12, color: '#a09580' }}>{[r.role, (r.hidden || []).length ? (r.hidden.length + ' hidden') : 'sees everything'].filter(Boolean).join(' · ')}</div>
          </div>
          {r.saved && (r.hidden || []).length > 0 && <button type="button" onClick={() => remove({ email: r.email, note: r.name })} style={{ background: 'none', border: '1px solid #e0d8cc', color: '#8a7e6b', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Show everything again</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
          {PV_SECTIONS.map(([id, label]) => {
            const on = (r.hidden || []).includes(id);
            return <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid ' + (on ? '#c9b48c' : '#ece4d6'), background: on ? '#faf3e3' : '#fffefc', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: on ? '#6b5d4a' : '#3a3226' }}>
              <input type="checkbox" checked={on} onChange={() => save(r, on ? (r.hidden || []).filter(x => x !== id) : (r.hidden || []).concat([id]))} style={{ accentColor: GOLD, width: 15, height: 15 }} />
              <span style={{ flex: 1 }}>{label}</span>{on && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6 }}>Hidden</span>}
            </label>;
          })}
        </div>
      </div>)}
      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2418' }}>Add someone else</div>
        <select value={add} onChange={e => setAdd(e.target.value)} style={{ flex: 1, minWidth: 200, border: '1px solid #e3dccd', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, background: '#fffefc', fontFamily: 'inherit' }}>
          <option value="">Choose a volunteer…</option>
          {choices.map(v => <option key={v.id} value={v.id}>{v['First Name']} {v['Last Name']}{v.Team ? ' · ' + String(v.Team).slice(0, 40) : ''}</option>)}
        </select>
        <button type="button" onClick={addPerson} disabled={!add} style={{ background: 'linear-gradient(180deg,#9a7b4e,#7d6039)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: add ? 'pointer' : 'default', opacity: add ? 1 : 0.5 }}>Add</button>
      </div>
      <div style={{ fontSize: 12, color: '#a09580', lineHeight: 1.5 }}>This hides pages from their menu and Overview. It is a view setting, not a lock on the underlying data. Only volunteers with an email on their profile can be added.</div>
    </div>}
  </div>;
}
