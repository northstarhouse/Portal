// Admin > Constant Contact: connect the account once, pick the list each sign-up form feeds, see what was added.
// New Newsletter Sign Up and Volunteer Sign Up submissions are added to Constant Contact automatically (database trigger -> constant-contact function).
const CC_FN = 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/mail-list-sync';
const CC_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const GOLD = '#886c44';
const ccCall = (body) => fetch(CC_FN, { method: 'POST', headers: { apikey: CC_KEY, Authorization: 'Bearer ' + CC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')'); return j; });

export function ConstantContactView() {
  const [st, setSt] = React.useState(null);
  const [lists, setLists] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [nl, setNl] = React.useState([]); // chosen list ids for Newsletter Sign Up
  const [vl, setVl] = React.useState([]); // chosen list ids for Volunteer Sign Up

  const load = React.useCallback(async () => {
    try {
      const s = await ccCall({ action: 'status' });
      setSt(s); setNl((s.newsletter_lists || []).map(l => l.id)); setVl((s.volunteer_lists || []).map(l => l.id));
      if (s.connected) { try { setLists((await ccCall({ action: 'lists' })).lists); } catch (e) { setErr(e.message); } }
    } catch (e) { setErr(e.message); setSt({ connected: false, log: [] }); }
  }, []);
  React.useEffect(() => {
    try { const p = new URLSearchParams(window.location.search); if (p.get('cc') === 'connected') setMsg('Connected to Constant Contact. Now choose the list for each form.'); if (p.get('cc_error')) setErr(p.get('cc_error')); } catch (_e) { /* no query */ }
  }, []);
  React.useEffect(() => { load(); const t = () => load(); window.addEventListener('focus', t); return () => window.removeEventListener('focus', t); }, [load]);

  async function connect() {
    setErr(''); setBusy('connect');
    try { const { url } = await ccCall({ action: 'auth-url' }); window.open(url, '_blank'); }
    catch (e) { setErr(e.message); }
    setBusy('');
  }
  async function save() {
    setErr(''); setMsg(''); setBusy('save');
    const pick = ids => ids.map(id => ({ id, name: ((lists || []).find(l => l.id === id) || {}).name || '' }));
    try { await ccCall({ action: 'save-lists', newsletter_lists: pick(nl), volunteer_lists: pick(vl) }); setMsg('Saved. New sign-ups will go to these lists.'); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  }
  async function backfill(form) {
    if (!window.confirm('Add everyone who has already signed up through the ' + (form === 'volunteer' ? 'Volunteer Sign Up' : 'Newsletter Sign Up') + ' form to Constant Contact now? People already in your list are only updated, never duplicated.')) return;
    setErr(''); setMsg(''); setBusy('bf-' + form);
    try { const r = await ccCall({ action: 'backfill', form }); setMsg('Done: ' + r.added + ' added, ' + r.skipped + ' skipped, ' + r.failed + ' failed.'); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  }

  const card = { background: '#fff', border: '0.5px solid #e6dfd3', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(60,45,20,0.04)' };
  const lbl = { fontSize: 11, fontWeight: 600, color: '#6b5d4a', display: 'block', marginBottom: 6 };
  const sel = { width: '100%', border: '1px solid #e3dccd', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, background: '#fffefc', fontFamily: 'inherit' };
  const btn = (primary, off) => ({ background: primary ? 'linear-gradient(180deg,#9a7b4e,#7d6039)' : '#fff', color: primary ? '#fff' : '#7a5f38', border: primary ? 'none' : '1px solid #c9b48c', borderRadius: 9, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: off ? 'default' : 'pointer', opacity: off ? 0.5 : 1, fontFamily: 'inherit' });
  const when = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + x.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const stColor = { added: '#2e7d32', skipped: '#9a5d22', failed: '#b3261e' };

  return <div style={{ maxWidth: 820, paddingBottom: 40 }}>
    <div style={{ borderBottom: '1.5px solid ' + GOLD, paddingBottom: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2 }}>Email sign-ups</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginTop: 2 }}>Constant Contact</div>
      <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 4 }}>New Newsletter Sign Up and Volunteer Sign Up submissions are added to Constant Contact automatically.</div>
    </div>
    {err && <div role="alert" style={{ color: '#b3261e', background: '#fce4e4', borderRadius: 9, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{err}</div>}
    {msg && <div style={{ color: '#2e7d32', background: '#eef7ee', borderRadius: 9, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{msg}</div>}
    {st === null ? <div style={{ color: '#8a7e6b' }}>Loading…</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: st.connected ? '#2e7d32' : '#c9b48c', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif" }}>{st.connected ? 'Connected' : 'Not connected yet'}</div>
            <div style={{ fontSize: 12, color: '#a09580', marginTop: 2 }}>{st.connected ? (st.connected_at ? 'Since ' + when(st.connected_at) : '') : (st.secret_set === false ? 'The Constant Contact client secret still needs to be stored. See the note below.' : 'Click Connect, then Allow in the Constant Contact window.')}</div>
          </div>
          <button type="button" style={btn(!st.connected, busy === 'connect' || st.secret_set === false)} disabled={busy === 'connect' || st.secret_set === false} onClick={connect}>{st.connected ? 'Reconnect' : 'Connect Constant Contact'}</button>
        </div>
      </div>

      {st.connected && <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginBottom: 14 }}>Which list does each form feed?</div>
        {!lists ? <div style={{ color: '#8a7e6b', fontSize: 13 }}>Loading your lists…</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {[['newsletter', 'Newsletter Sign Up goes to', nl, setNl, st.newsletter_lists], ['volunteer', 'Volunteer Sign Up goes to', vl, setVl, st.volunteer_lists]].map(([key, title, chosen, setChosen, saved]) => <div key={key}>
            <label style={lbl}>{title} <span style={{ fontWeight: 400, color: '#a09580' }}>(tick one or more)</span></label>
            <div style={{ border: '1px solid #e3dccd', borderRadius: 9, background: '#fffefc', maxHeight: 220, overflowY: 'auto', padding: '4px 10px' }}>
              {lists.map(l => <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer', borderBottom: '0.5px solid #f3eee4' }}>
                <input type="checkbox" checked={chosen.includes(l.id)} onChange={() => setChosen(chosen.includes(l.id) ? chosen.filter(x => x !== l.id) : chosen.concat([l.id]))} style={{ accentColor: GOLD, width: 15, height: 15 }} />
                <span style={{ flex: 1 }}>{l.name}</span>
                {l.count != null && <span style={{ color: '#b5a99a', fontSize: 11 }}>{l.count}</span>}
              </label>)}
            </div>
            <div style={{ fontSize: 11.5, color: GOLD, marginTop: 6, fontWeight: 600 }}>{chosen.length ? chosen.length + ' list' + (chosen.length === 1 ? '' : 's') + ' ticked' : 'None ticked'}</div>
            <button type="button" style={{ ...btn(false, !(saved || []).length || busy !== ''), marginTop: 8, padding: '6px 12px', fontSize: 12 }} disabled={!(saved || []).length || busy !== ''} onClick={() => backfill(key)}>{busy === 'bf-' + key ? 'Adding…' : 'Add past sign-ups now'}</button>
          </div>)}
        </div>}
        <div style={{ marginTop: 16 }}><button type="button" style={btn(true, busy === 'save' || !lists)} disabled={busy === 'save' || !lists} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save lists'}</button></div>
        <div style={{ fontSize: 11.5, color: '#a09580', marginTop: 10 }}>"Add past sign-ups now" becomes available after you save a list. It sends everyone who already signed up through that form.</div>
      </div>}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#faf8f4', borderBottom: '0.5px solid #eee6d8', fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.5 }}>Recent activity</div>
        {(st.log || []).length === 0 ? <div style={{ padding: '16px 18px', color: '#a09580', fontSize: 13 }}>Nothing yet. New sign-ups show up here.</div> : st.log.map(l => <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: '0.5px solid #f3eee4', fontSize: 13, alignItems: 'baseline' }}>
          <span style={{ width: 62, fontWeight: 700, color: stColor[l.status] || '#6b5d4a', textTransform: 'capitalize', flexShrink: 0 }}>{l.status}</span>
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 600 }}>{l.email || '(no email)'}</span> <span style={{ color: '#a09580' }}>{l.source} · {l.detail}</span></span>
          <span style={{ color: '#b5a99a', fontSize: 11.5, flexShrink: 0 }}>{when(l.created_at)}</span>
        </div>)}
      </div>
    </div>}
  </div>;
}
