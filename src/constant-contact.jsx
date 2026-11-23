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
  const [openKey, setOpenKey] = React.useState(null); // which picker is unfolded
  const [listsOpen, setListsOpen] = React.useState(false); // the whole "which list does each form feed" section
  const [pasteText, setPasteText] = React.useState('');
  const [pasteLists, setPasteLists] = React.useState([]);
  const [pasteOk, setPasteOk] = React.useState(false); // "they asked to hear from us"
  const [pasteRes, setPasteRes] = React.useState(null);
  const [pasteProg, setPasteProg] = React.useState('');

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
    try { await ccCall({ action: 'save-lists', newsletter_lists: pick(nl), volunteer_lists: pick(vl) }); setMsg('Saved. New sign-ups will go to these lists.'); setOpenKey(null); setListsOpen(false); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  }
  // Pasted text -> [{ email, first, last }]: one person per line or separated by commas/semicolons; a name next to the email is used as the contact's name.
  function parsePeople(text) {
    const seen = {}, out = [];
    String(text || '').split(/\r?\n|;/).forEach(line => {
      const found = line.match(/[^\s,<>"']+@[^\s,<>"']+\.[^\s,<>"']+/g) || [];
      if (found.length === 1) {
        const rest = line.replace(found[0], ' ').replace(/[<>"',]/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = rest ? rest.split(' ') : [];
        add(found[0], parts[0] || '', parts.slice(1).join(' '));
      } else found.forEach(e => add(e, '', ''));
    });
    function add(email, first, last) { const k = email.toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push({ email: k, first, last }); }
    return out;
  }
  const people = React.useMemo(() => parsePeople(pasteText), [pasteText]);
  async function sendPasted() {
    if (!people.length || !pasteLists.length || !pasteOk) return;
    setErr(''); setMsg(''); setPasteRes(null); setBusy('paste');
    const nameOf = id => ((lists || []).find(l => l.id === id) || {}).name || '';
    const chosen = pasteLists.map(id => ({ id, name: nameOf(id) }));
    const all = [];
    try {
      for (let i = 0; i < people.length; i += 25) {
        setPasteProg('Sending ' + Math.min(i + 25, people.length) + ' of ' + people.length + '…');
        const r = await ccCall({ action: 'import', people: people.slice(i, i + 25), lists: chosen });
        all.push(...r.results);
      }
      setPasteRes(all); setMsg('Done. See the results below.'); await load();
    } catch (e) { setErr(e.message + (all.length ? ' (' + all.length + ' were sent before it stopped.)' : '')); setPasteRes(all.length ? all : null); }
    setPasteProg(''); setBusy('');
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
        <button type="button" onClick={() => setListsOpen(!listsOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif" }}>Which list does each form feed?</span>
          <span style={{ background: ((st.newsletter_lists || []).length > 0 ? 1 : 0) + ((st.volunteer_lists || []).length > 0 ? 1 : 0) === 2 ? '#eef7ee' : '#f6f1e7', color: ((st.newsletter_lists || []).length > 0 ? 1 : 0) + ((st.volunteer_lists || []).length > 0 ? 1 : 0) === 2 ? '#2e7d32' : '#7a5f38', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>{((st.newsletter_lists || []).length > 0 ? 1 : 0) + ((st.volunteer_lists || []).length > 0 ? 1 : 0) === 2 ? '✓ Set' : ((st.newsletter_lists || []).length > 0 ? 1 : 0) + ((st.volunteer_lists || []).length > 0 ? 1 : 0) + ' of 2 set'}</span>
          <span style={{ color: '#a09580', fontSize: 11 }}>{listsOpen ? '▲' : '▼'}</span>
        </button>
        {listsOpen && <div style={{ marginTop: 14 }}>
        {!lists ? <div style={{ color: '#8a7e6b', fontSize: 13 }}>Loading your lists…</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {[['newsletter', 'Newsletter Sign Up goes to', nl, setNl, st.newsletter_lists], ['volunteer', 'Volunteer Sign Up goes to', vl, setVl, st.volunteer_lists]].map(([key, title, chosen, setChosen, saved]) => {
            const isSet = (saved || []).length > 0;
            const open = openKey === key;
            const names = chosen.map(id => ((lists || []).find(l => l.id === id) || {}).name).filter(Boolean);
            return <div key={key}>
              <label style={lbl}>{title}</label>
              <button type="button" onClick={() => setOpenKey(open ? null : key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: '1px solid ' + (open ? GOLD : '#e3dccd'), borderRadius: open ? '9px 9px 0 0' : 9, background: '#fffefc', padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', color: '#3a3226' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: names.length ? '#3a3226' : '#a09580' }}>{names.length ? names.join(' + ') : 'Choose lists…'}</span>
                {isSet && <span style={{ background: '#eef7ee', color: '#2e7d32', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>✓ Set</span>}
                <span style={{ color: '#a09580', fontSize: 11, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
              </button>
              {open && <div style={{ border: '1px solid ' + GOLD, borderTop: 'none', borderRadius: '0 0 9px 9px', background: '#fffefc', padding: '4px 10px 10px' }}>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {lists.map(l => <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer', borderBottom: '0.5px solid #f3eee4' }}>
                    <input type="checkbox" checked={chosen.includes(l.id)} onChange={() => setChosen(chosen.includes(l.id) ? chosen.filter(x => x !== l.id) : chosen.concat([l.id]))} style={{ accentColor: GOLD, width: 15, height: 15 }} />
                    <span style={{ flex: 1 }}>{l.name}</span>
                    {l.count != null && <span style={{ color: '#b5a99a', fontSize: 11 }}>{l.count}</span>}
                  </label>)}
                </div>
                <button type="button" onClick={() => setOpenKey(null)} style={{ ...btn(false, false), marginTop: 10, padding: '6px 14px', fontSize: 12 }}>Done</button>
              </div>}
              <button type="button" style={{ ...btn(false, !isSet || busy !== ''), marginTop: 8, padding: '6px 12px', fontSize: 12 }} disabled={!isSet || busy !== ''} onClick={() => backfill(key)}>{busy === 'bf-' + key ? 'Adding…' : 'Add past sign-ups now'}</button>
            </div>;
          })}
        </div>}
        <div style={{ marginTop: 16 }}><button type="button" style={btn(true, busy === 'save' || !lists)} disabled={busy === 'save' || !lists} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save lists'}</button></div>
        <div style={{ fontSize: 11.5, color: '#a09580', marginTop: 10 }}>"Add past sign-ups now" becomes available after you save a list. It sends everyone who already signed up through that form.</div>
        </div>}
      </div>}

      {st.connected && lists && <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginBottom: 4 }}>Add a list of emails</div>
        <div style={{ fontSize: 12, color: '#a09580', marginBottom: 12 }}>Paste emails, one per line (or separated by commas). A name next to an email, like "Jane Smith jane@example.com", is added to the contact too.</div>
        <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); setPasteRes(null); }} rows={7} placeholder={'jane@example.com\nJohn Doe, john@example.com'} style={{ ...sel, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
        <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, margin: '6px 0 12px' }}>{people.length ? people.length + ' email' + (people.length === 1 ? '' : 's') + ' found' + (String(pasteText).match(/@/g) && String(pasteText).match(/@/g).length > people.length ? ' (duplicates removed)' : '') : 'No emails yet'}</div>
        <label style={lbl}>Add them to</label>
        <button type="button" onClick={() => setOpenKey(openKey === 'paste' ? null : 'paste')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: '1px solid ' + (openKey === 'paste' ? GOLD : '#e3dccd'), borderRadius: openKey === 'paste' ? '9px 9px 0 0' : 9, background: '#fffefc', padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', color: '#3a3226' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: pasteLists.length ? '#3a3226' : '#a09580' }}>{pasteLists.length ? pasteLists.map(id => (lists.find(l => l.id === id) || {}).name).filter(Boolean).join(' + ') : 'Choose lists…'}</span>
          <span style={{ color: '#a09580', fontSize: 11 }}>{openKey === 'paste' ? '▲' : '▼'}</span>
        </button>
        {openKey === 'paste' && <div style={{ border: '1px solid ' + GOLD, borderTop: 'none', borderRadius: '0 0 9px 9px', background: '#fffefc', padding: '4px 10px 10px' }}>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {lists.map(l => <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer', borderBottom: '0.5px solid #f3eee4' }}>
              <input type="checkbox" checked={pasteLists.includes(l.id)} onChange={() => setPasteLists(pasteLists.includes(l.id) ? pasteLists.filter(x => x !== l.id) : pasteLists.concat([l.id]))} style={{ accentColor: GOLD, width: 15, height: 15 }} />
              <span style={{ flex: 1 }}>{l.name}</span>{l.count != null && <span style={{ color: '#b5a99a', fontSize: 11 }}>{l.count}</span>}
            </label>)}
          </div>
          <button type="button" onClick={() => setOpenKey(null)} style={{ ...btn(false, false), marginTop: 10, padding: '6px 14px', fontSize: 12 }}>Done</button>
        </div>}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, fontSize: 12.5, color: '#5a4d38', cursor: 'pointer' }}>
          <input type="checkbox" checked={pasteOk} onChange={e => setPasteOk(e.target.checked)} style={{ accentColor: GOLD, width: 15, height: 15, marginTop: 2 }} />
          <span>These people asked to receive emails from North Star House. They'll be added as <b>Subscribed</b>. Anyone who unsubscribed before is left alone.</span>
        </label>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" style={btn(true, !people.length || !pasteLists.length || !pasteOk || busy !== '')} disabled={!people.length || !pasteLists.length || !pasteOk || busy !== ''} onClick={sendPasted}>{busy === 'paste' ? 'Sending…' : 'Add ' + (people.length || '') + ' to Constant Contact'}</button>
          {pasteProg && <span style={{ fontSize: 12.5, color: '#8a7e6b' }}>{pasteProg}</span>}
        </div>
        {pasteRes && <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2418', marginBottom: 6 }}>{pasteRes.filter(r => r.status === 'added').length} added or updated · {pasteRes.filter(r => r.status === 'skipped').length} skipped · {pasteRes.filter(r => r.status === 'failed').length} failed</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '0.5px solid #eee6d8', borderRadius: 9 }}>
            {pasteRes.filter(r => r.status !== 'added').map((r, i) => <div key={i} style={{ padding: '7px 12px', fontSize: 12.5, borderBottom: '0.5px solid #f3eee4', display: 'flex', gap: 10 }}><span style={{ fontWeight: 700, width: 56, color: stColor[r.status] }}>{r.status}</span><span style={{ fontWeight: 600 }}>{r.email || '(blank)'}</span><span style={{ color: '#a09580' }}>{r.detail}</span></div>)}
            {pasteRes.filter(r => r.status !== 'added').length === 0 && <div style={{ padding: '8px 12px', fontSize: 12.5, color: '#2e7d32' }}>Everyone was added.</div>}
          </div>
        </div>}
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
