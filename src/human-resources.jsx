// Admin > House Operations > Human Resources (Haley and Wyn only).
// Send a staff onboarding packet to a person (they fill it in on the Volunteer Hub), then review and print what they submitted.
import { PACKET_SECTIONS } from './onboarding-spec.js';

const GOLD = '#886c44';
const HR_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co';
const HR_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HR_H = { apikey: HR_KEY, Authorization: 'Bearer ' + HR_KEY, 'Content-Type': 'application/json' };
const HUB_URL = 'https://volunteerhub.northstarhouse.org';
const hrReq = async (path, opts) => {
  const r = await fetch(HR_URL + '/rest/v1/' + path, { ...(opts || {}), headers: { ...HR_H, ...((opts && opts.headers) || {}) } });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
  if (!r.ok) throw new Error((d && d.message) || 'Request failed');
  return d;
};
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
const card = { background: '#fff', border: '0.5px solid #e6dfd3', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(60,45,20,0.04)', marginBottom: 16 };
const label = { fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 };

function answerText(f, data) {
  const v = data[f.k];
  if (f.type === 'check') return v ? 'Yes' : 'No';
  if (f.k === 'dd_account' && v) return v;
  return String(v || '').trim() || '—';
}

function printPacket(p) {
  const d = p.data || {};
  const sections = PACKET_SECTIONS.map(s => '<h3>' + esc(s.title) + '</h3><table>' + s.fields.map(f =>
    '<tr><td class="k">' + esc(f.label) + '</td><td>' + esc(answerText(f, d)) + '</td></tr>').join('') + '</table>').join('');
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups to print the packet.'); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Onboarding Packet - ' + esc(p.person_name) + '</title><style>' +
    "body{font-family:Georgia,serif;color:#2c2418;margin:40px;max-width:760px}.brand{font-size:12px;letter-spacing:.14em;color:#886c44;font-weight:700}" +
    "h1{font-size:28px;margin:6px 0 4px;border-bottom:2px solid #886c44;padding-bottom:10px}h3{font-size:16px;color:#886c44;margin:22px 0 6px}" +
    "table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee6d8;vertical-align:top}td.k{width:48%;color:#6b5f4c}" +
    ".meta{font-family:system-ui,sans-serif;font-size:13px;color:#6b5f4c}@media print{body{margin:18px}}</style></head><body>" +
    '<div class="brand">NORTH STAR HOUSE</div><h1>Staff Onboarding Packet</h1><div class="meta"><b>' + esc(p.person_name) + '</b> &middot; ' + esc(p.person_email) +
    (p.blank ? '<br>Blank copy' : '<br>Sent ' + esc(fmt(p.sent_at))) + (p.submitted_at ? ' &middot; Submitted ' + esc(fmt(p.submitted_at)) : '') + '</div>' + sections + '</body></html>');
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

function emailHtml(first) {
  return '<div style="font-family:Georgia,serif;background:#f6f1e7;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6dfd3;border-top:4px solid #886c44;border-radius:10px;padding:28px">' +
    '<div style="font-size:12px;letter-spacing:.12em;color:#886c44;font-weight:700">NORTH STAR HOUSE</div><h2 style="margin:8px 0 14px;font-size:22px;color:#2c2418">Complete Your Onboarding Packet</h2>' +
    '<p style="font-family:system-ui,sans-serif;color:#3a3226;line-height:1.6;margin:0 0 14px">Hi ' + first + ', welcome to North Star House. Your onboarding packet is ready to fill in online. Sign in to the Volunteer Hub and you will find it on your dashboard. It takes about ten minutes.</p>' +
    '<p style="margin:20px 0 0"><a href="' + HUB_URL + '" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;padding:11px 22px;border-radius:8px">Open the Volunteer Hub</a></p></div></div>';
}

function PreviewField({ f, value, onChange }) {
  const box = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e0d8cc', borderRadius: 8, fontSize: 14, background: '#fff' };
  if (f.type === 'check') return <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#2c2418', margin: '10px 0', cursor: 'pointer' }}><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17 }} /><span>{f.label}</span></label>;
  if (f.type === 'initials') return <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0', flexWrap: 'wrap' }}>
    <div style={{ flex: '1 1 240px', fontSize: 13, color: '#2c2418' }}>{f.label}{f.link ? <span> {'·'} <a href={f.link} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Read document</a></span> : null}</div>
    <input value={value || ''} maxLength={4} placeholder="Initials" onChange={e => onChange(e.target.value.toUpperCase())} style={{ ...box, width: 80, textAlign: 'center', fontWeight: 600 }} />
  </div>;
  return <div style={{ margin: '10px 0' }}>
    <div style={{ fontSize: 12, color: '#8a7e6b', marginBottom: 4 }}>{f.label}{f.req ? ' *' : ''}</div>
    {f.type === 'select'
      ? <select value={value || ''} onChange={e => onChange(e.target.value)} style={box}><option value="">Choose</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      : <input type={f.type === 'date' ? 'date' : 'text'} value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...box, ...(f.type === 'sig' ? { fontFamily: "'Cardo', Georgia, serif", fontStyle: 'italic', fontSize: 17 } : {}) }} />}
  </div>;
}

function PreviewModal({ name, first, onClose, onSend, busy }) {
  const [tab, setTab] = React.useState('packet');
  const [vals, setVals] = React.useState({});
  const tabBtn = (id, t) => <button onClick={() => setTab(id)} style={{ background: tab === id ? GOLD : '#f0ece6', color: tab === id ? '#fff' : '#5a4d36', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t}</button>;
  const plain = { background: '#f0ece6', color: '#5a4d36', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' };
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,15,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#faf7f1', borderRadius: 14, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e6dfd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Cardo', Georgia, serif", color: '#2c2418' }}>Preview: packet for {name}</div>
          <div style={{ fontSize: 12, color: '#8a7e6b' }}>This is the form exactly as they will fill it in. Try it out: nothing you type here is saved or sent.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{tabBtn('packet', 'Packet')}{tabBtn('email', 'Email')}</div>
      </div>
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {tab === 'email' ? <div dangerouslySetInnerHTML={{ __html: emailHtml(first) }} /> :
          PACKET_SECTIONS.map(s => <div key={s.id} style={card}>
            <div style={label}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginBottom: 8 }}>{s.intro}</div>
            {s.fields.map(f => <PreviewField key={f.k} f={f} value={vals[f.k]} onChange={v => setVals(o => ({ ...o, [f.k]: v }))} />)}
          </div>)}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #e6dfd3', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => printPacket({ person_name: name, person_email: '', sent_at: new Date().toISOString(), data: {}, blank: true })} style={plain}>Print blank copy</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={plain}>Close</button>
          <button disabled={busy} onClick={onSend} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Sending\u2026' : 'Send to ' + first}</button>
        </div>
      </div>
    </div>
  </div>;
}

function PacketDetail({ p, onBack, onChanged }) {
  const d = p.data || {};
  const [busy, setBusy] = React.useState(false);
  const del = async () => {
    if (!window.confirm('Delete this packet? The filled-in answers will be removed.')) return;
    setBusy(true);
    try { await hrReq('onboarding_packets?id=eq.' + p.id, { method: 'DELETE' }); onChanged(); onBack(); } catch (e) { alert(e.message); setBusy(false); }
  };
  return <div>
    <button onClick={onBack} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 14 }}>{'←'} Back</button>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Cardo', Georgia, serif", color: '#2c2418' }}>{p.person_name}</div>
          <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 2 }}>{p.person_email} {'·'} Sent {fmt(p.sent_at)}{p.submitted_at ? ' · Submitted ' + fmt(p.submitted_at) : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {p.status === 'submitted' && <button onClick={() => printPacket(p)} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print</button>}
          <button disabled={busy} onClick={del} style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
    {p.status !== 'submitted' && <div style={{ ...card, color: '#8a7e6b', fontSize: 14 }}>{p.person_name} has not submitted this packet yet.</div>}
    {p.status === 'submitted' && PACKET_SECTIONS.map(s => <div key={s.id} style={card}>
      <div style={label}>{s.title}</div>
      {s.fields.map(f => <div key={f.k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '0.5px solid #f0ece6', fontSize: 13 }}>
        <div style={{ flex: '0 0 46%', color: '#8a7e6b' }}>{f.label}</div>
        <div style={{ color: '#2c2418', wordBreak: 'break-word' }}>{answerText(f, d)}</div>
      </div>)}
    </div>)}
  </div>;
}

export function HumanResourcesView({ navigate }) {
  const [packets, setPackets] = React.useState(null);
  const [vols, setVols] = React.useState([]);
  const [pick, setPick] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(null);
  const [preview, setPreview] = React.useState(false);


  const load = React.useCallback(async () => {
    try {
      const [p, v] = await Promise.all([
        hrReq('onboarding_packets?select=*&order=sent_at.desc'),
        hrReq('2026%20Volunteers?select=id,First%20Name,Last%20Name,Email,Team,Status&Status=eq.Active&order=First%20Name&limit=500'),
      ]);
      setPackets(p || []); setVols((v || []).filter(x => x.Email && String(x.Email).trim()));
    } catch (e) { setMsg(e.message); setPackets([]); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const send = async () => {
    const v = vols.find(x => String(x.id) === pick);
    if (!v) return;
    const name = (String(v['First Name'] || '').trim() + ' ' + String(v['Last Name'] || '').trim()).trim();
    const email = String(v.Email).trim().toLowerCase();
    setBusy(true); setMsg('');
    try {
      await hrReq('onboarding_packets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ person_name: name, person_email: email, }) });
      const first = esc(String(v['First Name'] || '').trim() || 'there');
      const html = emailHtml(first);
      const r = await fetch(HR_URL + '/functions/v1/send-email', { method: 'POST', headers: HR_H, body: JSON.stringify({ to: email, subject: 'Complete your North Star House onboarding packet', body: 'Hi ' + first + ', your onboarding packet is ready. Sign in to the Volunteer Hub to fill it in: ' + HUB_URL, html }) });
      setMsg(r.ok ? 'Packet sent to ' + name + '.' : 'Packet created for ' + name + ', but the email did not send. Ask them to open the Volunteer Hub.');
      setPick(''); setPreview(false); load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  if (open) return <div style={{ maxWidth: 820, paddingBottom: 40 }}><PacketDetail p={open} onBack={() => setOpen(null)} onChanged={load} /></div>;

  const pv = vols.find(x => String(x.id) === pick);
  const sel = { fontSize: 13, padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, background: '#fff', minWidth: 240 };
  return <div style={{ maxWidth: 820, paddingBottom: 40 }}>
    <div style={{ borderBottom: '1.5px solid ' + GOLD, paddingBottom: 14, marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2 }}>House operations</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginTop: 2 }}>Human Resources</div>
    </div>
    {preview && pv && <PreviewModal name={(String(pv['First Name'] || '').trim() + ' ' + String(pv['Last Name'] || '').trim()).trim()} first={esc(String(pv['First Name'] || '').trim() || 'there')} onClose={() => setPreview(false)} onSend={send} busy={busy} />}
    <div style={card}>
      <div style={label}>Send an onboarding packet</div>
      <div style={{ fontSize: 13, color: '#8a7e6b', marginBottom: 12, lineHeight: 1.5 }}>They get an email and a card on their Volunteer Hub dashboard. You are emailed when they submit it.</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={pick} onChange={e => setPick(e.target.value)} style={sel}>
          <option value="">Choose a person</option>
          {vols.map(v => <option key={v.id} value={String(v.id)}>{(v['First Name'] || '') + ' ' + (v['Last Name'] || '')}</option>)}
        </select>
        <button disabled={!pick} onClick={() => setPreview(true)} style={{ background: '#fff', color: pick ? GOLD : '#b8ad99', border: '1px solid ' + (pick ? GOLD : '#d8cfbf'), borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: pick ? 'pointer' : 'default' }}>Preview and Send</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: '#5a4d36', marginTop: 10 }}>{msg}</div>}
    </div>
    <div style={card}>
      <div style={label}>Packets</div>
      {packets === null ? <div style={{ fontSize: 13, color: '#8a7e6b' }}>Loading{'…'}</div> :
        packets.length === 0 ? <div style={{ fontSize: 13, color: '#8a7e6b' }}>No packets sent yet.</div> :
        packets.map(p => <div key={p.id} onClick={() => setOpen(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '0.5px solid #f0ece6', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2418' }}>{p.person_name}</div>
            <div style={{ fontSize: 12, color: '#8a7e6b' }}>Sent {fmt(p.sent_at)}{p.submitted_at ? ' · Submitted ' + fmt(p.submitted_at) : ''}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.status === 'submitted' ? '#e3f6ec' : '#fdf3e0', color: p.status === 'submitted' ? '#15803d' : '#92600c' }}>{p.status === 'submitted' ? 'Submitted' : 'Waiting'}</span>
        </div>)}
    </div>
  </div>;
}
