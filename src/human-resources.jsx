// Admin > House Operations > Human Resources (Haley and Wyn only).
// Send a staff onboarding packet to a person (they fill it in on the Volunteer Hub), then review and print what they submitted.
import { PACKET_SECTIONS } from './onboarding-spec.js';
import { PDFDocument } from 'pdf-lib';
import { buildPacketPdf } from './packet-pdf.js';

const GOLD = '#886c44';
const HR_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co';
const HR_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HR_H = { apikey: HR_KEY, Authorization: 'Bearer ' + HR_KEY, 'Content-Type': 'application/json' };
const HUB_URL = 'https://volunteerhub.northstarhouse.org';
const LETTERHEAD = HUB_URL + '/onboarding/letterhead.jpg';
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

function answerText(f, data, hr) {
  if (f.type === 'pending') return hr && hr.supervisor_sig ? hr.supervisor_sig + '  \u00b7  ' + fmt(hr.supervisor_date) : 'Awaiting supervisor signature';
  if (f.type === 'form') return data['doc_' + f.k] ? 'Filled out (see Filled forms)' : data['skip_' + f.k] ? 'Says already turned in. Please confirm.' : '\u2014';
  const v = data[f.k];
  if (f.type === 'check') return v ? 'Yes' : 'No';
  if (f.k === 'dd_account' && v) return v;
  return String(v || '').trim() || '—';
}

function printPacket(p) {
  const d = p.data || {};
  const sections = PACKET_SECTIONS.map(s => '<h3>' + esc(s.title) + '</h3><table>' + s.fields.map(f =>
    (f.type === 'check' ? '<tr><td colspan="2">' + (d[f.k] ? '&#9745;' : '&#9744;') + ' ' + esc(f.label) + '</td></tr>' : '<tr><td class="k">' + esc(f.label) + '</td><td' + (f.type === 'sig' || (f.type === 'pending' && (p.hr_received || {}).supervisor_sig) ? ' class="sig"' : '') + '>' + (f.type === 'check' ? (d[f.k] ? 'Yes &#9745;' : 'No &#9744;') : esc(answerText(f, d, p.hr_received || {}))) + '</td></tr>')).join('') + '</table>').join('');
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups to print the packet.'); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"><title>Onboarding Packet - ' + esc(p.person_name) + '</title><style>' +
    "body{font-family:Georgia,serif;color:#2c2418;margin:40px;max-width:760px}.brand{font-size:12px;letter-spacing:.14em;color:#886c44;font-weight:700}" +
    "h1{font-size:28px;margin:6px 0 4px;border-bottom:2px solid #886c44;padding-bottom:10px}h3{font-size:16px;color:#886c44;margin:22px 0 6px}" +
    "table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee6d8;vertical-align:top}td.k{width:48%;color:#6b5f4c}td.sig{font-family:'Great Vibes','Brush Script MT',cursive;font-size:30px;line-height:1.1}" +
    ".meta{font-family:system-ui,sans-serif;font-size:13px;color:#6b5f4c}@media print{body{margin:18px}}</style></head><body>" +
    '<img src="' + LETTERHEAD + '" style="width:100%;display:block;margin-bottom:14px"><h1>Staff Onboarding Packet</h1><div class="meta"><b>' + esc(p.person_name) + '</b>' + (p.position ? '<br>Position: ' + esc(p.position) : '') + (p.person_email ? '<br>' + esc(p.person_email) : '') +
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
  if (f.type === 'form') return <div style={{ margin: '14px 0 6px' }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2418', marginBottom: 2 }}>{f.label}</div>
    <div style={{ fontSize: 12, color: '#8a7e6b', marginBottom: 6 }}>This is the form they fill out on the page. They can also tick "I already turned this in". Nothing here is saved.</div>
    <iframe src={f.link} title={f.label} style={{ width: '100%', height: 420, border: '1px solid #cfc6b4', background: '#fff' }} />
  </div>;
  if (f.type === 'check') return <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#2c2418', margin: '10px 0', cursor: 'pointer' }}><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17 }} /><span>{f.label}</span></label>;
  if (f.type === 'initials') return <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0', flexWrap: 'wrap' }}>
    <div style={{ flex: '1 1 240px', fontSize: 13, color: '#2c2418' }}>{f.label}{f.link ? <span> {'\u00b7'} <a href={f.link} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{f.linkText || 'Read document'}</a></span> : null}</div>
    <button type="button" onClick={() => onChange(value ? '' : 'AB')} style={{ minWidth: 110, height: 40, borderRadius: 6, cursor: 'pointer', border: value ? '1.5px solid ' + GOLD : '1.5px dashed #b9ae98', background: value ? '#f7f2e8' : '#fff', color: value ? '#2c2418' : '#8a7e6b', fontFamily: value ? "'Great Vibes', 'Brush Script MT', cursive" : 'inherit', fontSize: value ? 24 : 12, fontWeight: value ? 400 : 600 }}>{value || 'Click to initial'}</button>
  </div>;
  return <div style={{ margin: '10px 0' }}>
    <div style={{ fontSize: 12, color: '#8a7e6b', marginBottom: 4 }}>{f.label}{f.req ? ' *' : ''}</div>
    {f.type === 'select'
      ? <select value={value || ''} onChange={e => onChange(e.target.value)} style={box}><option value="">Choose</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      : <input type={f.type === 'date' ? 'date' : 'text'} value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...box, ...(f.type === 'sig' ? { fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontSize: 30, padding: '2px 8px' } : {}) }} />}
  </div>;
}

function PreviewModal({ name, position, wage, first, onClose, onSend, busy }) {
  const [tab, setTab] = React.useState('packet');
  const [vals, setVals] = React.useState({});
  const tabBtn = (id, t) => <button onClick={() => setTab(id)} style={{ background: tab === id ? GOLD : '#f0ece6', color: tab === id ? '#fff' : '#5a4d36', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t}</button>;
  const plain = { background: '#f0ece6', color: '#5a4d36', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' };
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,15,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#faf7f1', borderRadius: 14, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e6dfd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Cardo', Georgia, serif", color: '#2c2418' }}>Preview: packet for {name}{position ? ', ' + position : ''}</div>
          <div style={{ fontSize: 12, color: '#8a7e6b' }}>This is the form exactly as they will fill it in. Try it out: nothing you type here is saved or sent.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{tabBtn('packet', 'Packet')}{tabBtn('email', 'Email')}</div>
      </div>
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {tab === 'email' ? <div dangerouslySetInnerHTML={{ __html: emailHtml(first) }} /> : <>
          <img src={LETTERHEAD} alt="North Star Historic Conservancy" style={{ width: '100%', display: 'block', marginBottom: 14 }} />
          {PACKET_SECTIONS.map(s => <div key={s.id} style={card}>
            <div style={label}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginBottom: 8 }}>{s.intro}</div>
            {s.fields.map(f => <PreviewField key={f.k} f={f} value={vals[f.k]} onChange={v => setVals(o => ({ ...o, [f.k]: v }))} />)}
          </div>)}
        </>}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #e6dfd3', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => printPacket({ person_name: name, position, person_email: '', sent_at: new Date().toISOString(), data: {}, blank: true })} style={plain}>Print blank copy</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={plain}>Close</button>
          <button disabled={busy} onClick={onSend} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Sending\u2026' : 'Send to ' + first}</button>
        </div>
      </div>
    </div>
  </div>;
}

function b64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// What HR opens, prints and downloads cannot be edited: the filled-in answers are flattened into the page.
// A couple of the state forms cannot be flattened, so for those every field is locked as read-only instead.
async function lockedPdfBytes(b64) {
  const bytes = b64ToBytes(b64);
  try {
    const pdf = await PDFDocument.load(bytes);
    pdf.getForm().flatten();
    return await pdf.save();
  } catch (e) {
    const pdf = await PDFDocument.load(bytes);
    pdf.getForm().getFields().forEach(fld => { try { fld.enableReadOnly(); } catch (_e) { /* not lockable */ } });
    return await pdf.save();
  }
}

// Opens one of the official PDFs the person filled in on the Hub (I-9, W-4, DE 4, Wage Notice, designation forms).
function useFormViewer(p) {
  const [view, setView] = React.useState(null);
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  React.useEffect(() => () => { if (view) URL.revokeObjectURL(view.url); }, [view]);
  const load = async f => {
    const rows = await hrReq('onboarding_docs?select=pdf_base64&packet_id=eq.' + p.id + '&doc_key=eq.' + encodeURIComponent(f.k) + '&limit=1');
    if (!rows || !rows[0]) throw new Error('That form was not found.');
    const bytes = await lockedPdfBytes(rows[0].pdf_base64);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  };
  const open = async f => { setBusy(f.k); setErr(''); try { const url = await load(f); setView({ url, title: f.label }); } catch (e) { setErr(e.message); } setBusy(''); };
  const download = async f => {
    setBusy(f.k); setErr('');
    try { const url = await load(f); const a = document.createElement('a'); a.href = url; a.download = (p.person_name + ' - ' + f.label).replace(/[^A-Za-z0-9 \-]/g, '').trim() + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const btn = { background: '#f0ece6', color: '#5a4d36', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
  const modal = view ? <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,15,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setView(null)}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e6dfd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2418' }}>{view.title}</div>
        <button onClick={() => setView(null)} style={btn}>Close</button>
      </div>
      <iframe src={view.url} title={view.title} style={{ flex: 1, border: 'none', width: '100%' }} />
    </div>
  </div> : null;
  return { open, download, busy, err, btn, modal };
}

function FilledForms({ p, fv }) {
  const forms = [];
  PACKET_SECTIONS.forEach(s => s.fields.forEach(f => { if (f.type === 'form' && (p.data || {})['doc_' + f.k]) forms.push(f); }));
  if (!forms.length) return null;
  return <div style={card}>
    <div style={label}>Filled forms</div>
    <div style={{ fontSize: 12, color: '#8a7e6b', marginBottom: 8 }}>The official PDFs as {p.person_name} filled them in. They open and download as read-only copies that cannot be edited. Only you and Wyn can open these.</div>
    {forms.map(f => <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0ece6', fontSize: 13 }}>
      <div style={{ color: '#2c2418' }}>{f.label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={!!fv.busy} onClick={() => fv.open(f)} style={fv.btn}>{fv.busy === f.k ? 'Opening\u2026' : 'View'}</button>
        <button disabled={!!fv.busy} onClick={() => fv.download(f)} style={fv.btn}>Download</button>
      </div>
    </div>)}
    {fv.err && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 8 }}>{fv.err}</div>}
  </div>;
}

function PacketDetail({ p, onBack, onChanged }) {
  const d = p.data || {};
  const [busy, setBusy] = React.useState(false);
  const [hr, setHr] = React.useState(p.hr_received || {});
  const fv = useFormViewer(p);
  const [pkgBusy, setPkgBusy] = React.useState(false);
  // One PDF: the summary of every answer and signature, then each filled-in official form as a read-only copy.
  const downloadPacket = async () => {
    setPkgBusy(true);
    try {
      const formDocs = [];
      for (const sec of PACKET_SECTIONS) for (const fld of sec.fields) {
        if (fld.type !== 'form' || !d['doc_' + fld.k]) continue;
        const rows = await hrReq('onboarding_docs?select=pdf_base64&packet_id=eq.' + p.id + '&doc_key=eq.' + encodeURIComponent(fld.k) + '&limit=1');
        if (rows && rows[0]) formDocs.push({ label: fld.label, bytes: await lockedPdfBytes(rows[0].pdf_base64) });
      }
      let letterBytes = null;
      try { const r = await fetch(LETTERHEAD); if (r.ok) letterBytes = new Uint8Array(await r.arrayBuffer()); } catch (e) { /* the letterhead is optional */ }
      const bytes = await buildPacketPdf({ p: { ...p, hr_received: hr }, letterBytes, formDocs });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = (p.person_name + ' - Onboarding Packet').replace(/[^A-Za-z0-9 -]/g, '').trim() + '.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { alert('Could not build the packet: ' + e.message); }
    setPkgBusy(false);
  };
  const [supSig, setSupSig] = React.useState('');
  const [supDate, setSupDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [supErr, setSupErr] = React.useState('');
  const signOff = async () => {
    if (!supSig.trim()) { setSupErr('Type your full name to sign.'); return; }
    setBusy(true); setSupErr('');
    try {
      const next = { ...hr, supervisor_sig: supSig.trim(), supervisor_date: supDate };
      await hrReq('onboarding_packets?id=eq.' + p.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ hr_received: next }) });
      setHr(next); onChanged();
    } catch (e) { setSupErr(e.message); }
    setBusy(false);
  };
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
          {p.position && <div style={{ fontSize: 14, color: '#5a4d36', marginTop: 2 }}>Position: {p.position}{p.wage ? ' \u00b7 ' + p.wage + (p.wage_basis ? ' per ' + p.wage_basis.toLowerCase() : '') : ''}</div>}
          <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 2 }}>{p.person_email} {'·'} Sent {fmt(p.sent_at)}{p.submitted_at ? ' · Submitted ' + fmt(p.submitted_at) : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {p.status === 'submitted' && <button disabled={pkgBusy} onClick={downloadPacket} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{pkgBusy ? 'Building…' : 'Download entire packet'}</button>}
          {p.status === 'submitted' && <button onClick={() => printPacket({ ...p, hr_received: hr })} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print</button>}
          <button disabled={busy} onClick={del} style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
    {p.status !== 'submitted' && <div style={{ ...card, color: '#8a7e6b', fontSize: 14 }}>{p.person_name} has not submitted this packet yet.</div>}
    {p.status === 'submitted' && !hr.supervisor_sig && <div style={{ ...card, borderLeft: '4px solid ' + GOLD }}>
      <div style={label}>Supervisor signature</div>
      <div style={{ fontSize: 13, color: '#5a4d36', marginBottom: 10 }}>{p.person_name} submitted this packet. Review it below, then sign to finish.</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Supervisor signature (type your full name)</div>
          <input value={supSig} onChange={e => setSupSig(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1.5px solid #8a7e6b', background: 'transparent', fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontSize: 30, outline: 'none', padding: '2px 4px' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Date</div>
          <input type="date" value={supDate} onChange={e => setSupDate(e.target.value)} style={{ border: 'none', borderBottom: '1.5px solid #8a7e6b', background: 'transparent', fontSize: 15, padding: '6px 2px' }} />
        </div>
        <button disabled={busy} onClick={signOff} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Signing\u2026' : 'Sign and complete'}</button>
      </div>
      {supErr && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 8 }}>{supErr}</div>}
    </div>}
    {p.status === 'submitted' && hr.supervisor_sig && <div style={{ ...card, color: '#15803d', fontSize: 13 }}>Signed by {hr.supervisor_sig} on {fmt(hr.supervisor_date)}. This packet is complete.</div>}
    {p.status === 'submitted' && <FilledForms p={p} fv={fv} />}
    {fv.modal}
    {p.status === 'submitted' && PACKET_SECTIONS.map(s => <div key={s.id} style={card}>
      <div style={label}>{s.title}</div>
      {s.fields.map(f => f.type === 'check' ? <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #f0ece6', fontSize: 13, color: '#2c2418' }}>
        <span style={{ flex: '0 0 auto', display: 'inline-block', width: 17, height: 17, boxSizing: 'border-box', border: '1.5px solid ' + GOLD, borderRadius: 3, textAlign: 'center', lineHeight: '14px', fontSize: 14, fontWeight: 700, color: GOLD, background: d[f.k] ? '#f7f2e8' : '#fff' }}>{d[f.k] ? '✓' : ''}</span>
        <span>{f.label}</span>
      </div> : <div key={f.k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '0.5px solid #f0ece6', fontSize: 13 }}>
        <div style={{ flex: '0 0 46%', color: '#8a7e6b' }}>{f.label}</div>
        <div style={{ flex: 1, textAlign: 'right', color: '#2c2418', wordBreak: 'break-word', ...(f.type === 'sig' || (f.type === 'pending' && hr.supervisor_sig) ? { fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontSize: 28, lineHeight: 1.2 } : {}) }}>{f.type === 'form' && d['doc_' + f.k] ? <button disabled={!!fv.busy} onClick={() => fv.open(f)} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{fv.busy === f.k ? 'Opening\u2026' : 'View'}</button> : f.type === 'check' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span>{d[f.k] ? 'Yes' : 'No'}</span><span style={{ display: 'inline-block', width: 17, height: 17, boxSizing: 'border-box', border: '1.5px solid ' + GOLD, borderRadius: 3, textAlign: 'center', lineHeight: '14px', fontSize: 14, fontWeight: 700, color: GOLD, background: d[f.k] ? '#f7f2e8' : '#fff', verticalAlign: 'middle' }}>{d[f.k] ? '✓' : ''}</span></span> : answerText(f, d, hr)}</div>
      </div>)}
    </div>)}
  </div>;
}

export function HumanResourcesView({ navigate }) {
  const [packets, setPackets] = React.useState(null);
  const [vols, setVols] = React.useState([]);
  const [pick, setPick] = React.useState('');
  const [fd, setFd] = React.useState({ name: '', position: '', wage: '', basis: 'Hour' });
  const setField = (k, v) => setFd(o => ({ ...o, [k]: v }));
  const volName = v => (String(v['First Name'] || '').trim() + ' ' + String(v['Last Name'] || '').trim()).trim();
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
    const name = fd.name.trim() || volName(v);
    const email = String(v.Email).trim().toLowerCase();
    setBusy(true); setMsg('');
    try {
      await hrReq('onboarding_packets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ person_name: name, person_email: email, position: fd.position.trim() || null, wage: fd.wage.trim() || null, wage_basis: fd.wage.trim() ? fd.basis : null }) });
      const first = esc(name.split(/\s+/)[0] || 'there');
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
    {preview && pv && <PreviewModal name={fd.name.trim() || volName(pv)} position={fd.position.trim()} wage={fd.wage.trim()} first={esc((fd.name.trim() || volName(pv)).split(/\s+/)[0] || 'there')} onClose={() => setPreview(false)} onSend={send} busy={busy} />}
    <div style={card}>
      <div style={label}>Send an onboarding packet</div>
      <div style={{ fontSize: 13, color: '#8a7e6b', marginBottom: 12, lineHeight: 1.5 }}>They get an email and a card on their Volunteer Hub dashboard. You are emailed when they submit it.</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={pick} onChange={e => { setPick(e.target.value); const v = vols.find(x => String(x.id) === e.target.value); setFd({ name: v ? volName(v) : '', position: '', wage: '', basis: 'Hour' }); }} style={sel}>
          <option value="">Choose a person</option>
          {vols.map(v => <option key={v.id} value={String(v.id)}>{(v['First Name'] || '') + ' ' + (v['Last Name'] || '')}</option>)}
        </select>
        <button disabled={!pick} onClick={() => setPreview(true)} style={{ background: '#fff', color: pick ? GOLD : '#b8ad99', border: '1px solid ' + (pick ? GOLD : '#d8cfbf'), borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: pick ? 'pointer' : 'default' }}>Preview and Send</button>
      </div>
      {pick && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
        <div><div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Employee name</div><input value={fd.name} onChange={e => setField('name', e.target.value)} style={sel} /></div>
        <div><div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Position</div><input value={fd.position} onChange={e => setField('position', e.target.value)} placeholder="e.g. Events Coordinator" style={sel} /></div>
        <div><div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Rate of pay (goes on the wage notice)</div><input value={fd.wage} onChange={e => setField('wage', e.target.value)} placeholder="e.g. $22.00" style={sel} /></div>
        <div><div style={{ fontSize: 11, color: '#8a7e6b', marginBottom: 2 }}>Paid by the</div><select value={fd.basis} onChange={e => setField('basis', e.target.value)} style={sel}>{['Hour', 'Day', 'Week', 'Shift', 'Salary', 'Piece rate', 'Commission'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
      </div>}
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
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.status !== 'submitted' ? '#fdf3e0' : (p.hr_received || {}).supervisor_sig ? '#e3f6ec' : '#e6f0fb', color: p.status !== 'submitted' ? '#92600c' : (p.hr_received || {}).supervisor_sig ? '#15803d' : '#1d4ed8' }}>{p.status !== 'submitted' ? 'Waiting' : (p.hr_received || {}).supervisor_sig ? 'Complete' : 'Needs signature'}</span>
        </div>)}
    </div>
  </div>;
}
