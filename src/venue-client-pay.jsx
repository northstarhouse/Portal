// Public clients-only page (#pay): venue code -> event dashboard (payments, insurance, questionnaire, brick, message).
import { formatVenueCode } from './venue-code.js';
const style = `.cp-page{--gold:#886c44;--ink:#2c2418;--muted:#6f685c;--line:#e8e0d2;--paper:#fffdfa;min-height:100vh;background:#fbf8f2;color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:28px 16px 48px}.cp-shell{max-width:560px;margin:0 auto}.cp-shell.wide{max-width:1080px}
.cp-brandrow{display:flex;align-items:center;gap:14px;letter-spacing:.28em;font-size:11px;color:var(--gold);font-weight:700}.cp-brandrow:after{content:"";height:1px;background:var(--gold);opacity:.45;flex:1;min-width:48px}
.cp-page h1{font-family:Cardo,Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;margin:8px 0 18px}
.cp-head{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;min-height:196px;margin-bottom:18px}
.cp-head-img{position:absolute;top:-28px;right:-16px;bottom:38px;width:50%;background:#d9cdb8 url(assets/header-house.jpg) center 78%/cover;filter:saturate(.8) brightness(1.04);opacity:.95;-webkit-mask-image:linear-gradient(to right,transparent 0,#000 58%),linear-gradient(to bottom,#000 60%,transparent 100%);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent 0,#000 58%),linear-gradient(to bottom,#000 60%,transparent 100%);mask-composite:intersect;pointer-events:none}
.cp-head-main{position:relative;z-index:1;max-width:62%;padding-top:6px}.cp-page .cp-head h1{font-size:clamp(28px,4vw,40px);margin:10px 0 12px}
.cp-sub{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px;flex-wrap:wrap}.cp-sub i{width:1px;height:14px;background:#b9ab92;display:inline-block}
.cp-head-side{position:relative;z-index:1;align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end}.cp-countdown{background:var(--gold);color:#fff;padding:12px 28px 10px;text-align:center;display:inline-block;min-width:150px}.cp-countdown strong{display:block;font-family:Cardo,Georgia,serif;font-size:38px;font-weight:400;line-height:1.05}.cp-countdown hr{border:0;border-top:1px solid rgba(255,255,255,.55);margin:5px 16px 7px}.cp-countdown span{font-size:11px;letter-spacing:.2em;text-transform:uppercase}
.cp-linkbtn{display:block;margin:0;background:none;border:0;color:var(--gold);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:0}
.cp-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;position:relative;z-index:1}
.cp-tile{display:flex;align-items:center;gap:14px;text-align:left;background:var(--paper);border:1px solid var(--line);border-left:3px solid #c9a46a;padding:14px 14px 14px 16px;font:inherit;cursor:pointer;color:inherit;box-shadow:0 1px 2px rgba(60,45,20,.05)}.cp-tile.ok{border-left-color:#5f8a66}.cp-tile:hover{background:#fff}
.cp-ico{flex:none;width:46px;height:46px;border-radius:50%;background:#f1e9da;color:#8a6c40;display:flex;align-items:center;justify-content:center}.cp-tile.ok .cp-ico{background:#e4eee4;color:#4f7a56}
.cp-txt{flex:1;min-width:0}.cp-tile small{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}.cp-tile b{display:block;font-family:Cardo,Georgia,serif;font-size:22px;font-weight:700;line-height:1.2;margin:3px 0 1px}.cp-tile em{font-style:normal;font-size:12px;color:var(--muted)}.cp-chev{flex:none;color:#7b7366}
.cp-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}.cp-col{min-width:0}
.cp-card{background:var(--paper);border:1px solid var(--line);padding:22px 24px;margin-bottom:18px;box-shadow:0 1px 2px rgba(60,45,20,.05)}
.cp-card .cp-h,.cp-card h2{font-family:Cardo,Georgia,serif;font-size:14px;font-weight:400;letter-spacing:.17em;text-transform:uppercase;margin:0}.cp-card>h2{margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.cp-acc-head{width:100%;display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left}.cp-acc-head .cp-grow{flex:1}.cp-acc-chev{transition:transform .15s;color:#7b7366}.cp-acc-head[aria-expanded=true] .cp-acc-chev{transform:rotate(90deg)}.cp-acc-body{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.cp-acc-body[hidden]{display:none}
.cp-pill{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;background:#faf0e6;color:#9a5d22}.cp-pill.ok{background:#e4eee4;color:#3f6b47}
.cp-field{display:block;font-size:13px;font-weight:600;margin-bottom:14px}.cp-field input,.cp-field textarea,.cp-field select{display:block;width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #dcd3c4;background:#fff;border-radius:0;padding:12px;font:inherit;font-size:16px;font-weight:400}.cp-req{color:#b23b2e}
.cp-btn{background:var(--gold);color:#fff;border:0;border-radius:0;padding:13px 22px;font:inherit;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}.cp-btn:after{content:" \\2192"}.cp-btn:disabled{opacity:.55;cursor:default}
.cp-muted{color:var(--muted);font-size:13px;line-height:1.55}.cp-error{background:#f9eae7;color:#a64f3c;border:1px solid #a64f3c;padding:10px 12px;font-size:13px;margin-bottom:14px}.cp-ok{background:#edf4ed;color:#426b4a;border:1px solid #426b4a;padding:10px 12px;font-size:13px;margin-bottom:14px}
.cp-big{font-family:Cardo,Georgia,serif;font-size:30px;font-weight:700;line-height:1.1}.cp-bar{height:8px;background:#f1e9dc;overflow:hidden;margin:14px 0}.cp-bar span{display:block;height:100%;background:#6b8c6c}
.cp-next{display:flex;gap:10px;align-items:center;background:#f4eee3;padding:12px 14px;font-size:14px;margin-bottom:14px}.cp-next svg{flex:none;color:var(--gold)}
.cp-check{display:flex;gap:8px;align-items:center;font-weight:400;margin:4px 0}.cp-check input{width:auto;margin:0}
.cp-qcols{column-count:2;column-gap:44px;margin-bottom:22px}.cp-qsec-wrap{break-inside:avoid-column}.cp-qsec-wrap .cp-sec:first-child{margin-top:8px}@media(max-width:820px){.cp-qcols{column-count:1}}
.cp-sec{font-family:Cardo,Georgia,serif;font-weight:400;font-size:19px;color:var(--gold);text-align:center;margin:30px 0 18px;padding:12px 8px;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold)}.cp-lab{display:block;font-weight:400;font-size:15px;line-height:1.45}.cp-note{display:block;font-style:italic;font-weight:400;color:var(--muted);font-size:13px;margin-top:2px}.cp-fieldimg{display:block;width:100%;height:auto;margin:0 0 16px;border:1px solid var(--line)}.cp-field input::placeholder,.cp-field textarea::placeholder{color:#9a9488;font-size:15px;font-weight:400}
@media(max-width:820px){.cp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.cp-tile{gap:10px;padding:12px}.cp-ico{width:38px;height:38px}.cp-chev{display:none}.cp-cols{grid-template-columns:1fr}.cp-head{flex-direction:column;min-height:0;padding-top:96px}.cp-head-img{top:-28px;left:-16px;right:-16px;bottom:auto;height:150px;width:auto;opacity:.6;-webkit-mask-image:linear-gradient(to bottom,#000 40%,transparent 100%);mask-image:linear-gradient(to bottom,#000 40%,transparent 100%)}.cp-head-main{max-width:100%}.cp-head-side{width:100%;flex-direction:row;align-items:center;justify-content:space-between}.cp-linkbtn{margin:0}}`;
const money = c => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const ICONS = {
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="1" /><path d="M9 4h6v3H9z" /><path d="M9 14l2 2 4-4" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="1" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
const Icon = ({ name, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
const Pill = ({ ok, yes, no }) => <span className={'cp-pill' + (ok ? ' ok' : '')}>{ok && <Icon name="check" size={13} />}{ok ? yes : no}</span>;

// Collapsible card. Content stays mounted (so typed answers survive closing); tiles can open it by id.
function Acc({ id, title, pill, defaultOpen, children }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  React.useEffect(() => {
    const h = e => { if (e.detail === id) setOpen(true); };
    window.addEventListener('cp-open', h); return () => window.removeEventListener('cp-open', h);
  }, [id]);
  return <div className="cp-card" id={id}>
    <button type="button" className="cp-acc-head" aria-expanded={open} onClick={() => setOpen(o => !o)}><span className="cp-h">{title}</span><span className="cp-grow">{pill}</span><span className="cp-acc-chev"><Icon name="chevron" size={18} /></span></button>
    <div className="cp-acc-body" hidden={!open}>{children}</div>
  </div>;
}

function loadPayPal(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) + '&currency=USD&intent=capture&disable-funding=credit';
    s.onload = () => resolve(window.paypal); s.onerror = () => reject(new Error('PayPal could not be loaded.'));
    document.head.appendChild(s);
  });
}

function Questionnaire({ api, code, name, onSaved }) {
  const [form, setForm] = React.useState(null), [answers, setAnswers] = React.useState({}), [err, setErr] = React.useState(''), [busy, setBusy] = React.useState(false), [done, setDone] = React.useState(false);
  React.useEffect(() => { api('questionnaire_get', { code, name }).then(d => { setForm(d); setAnswers(d.answers || {}); }).catch(e => setErr(e.message)); }, []);
  const set = (id, v) => setAnswers(a => ({ ...a, [id]: v }));
  async function save(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(''); setDone(false);
    try { await api('questionnaire_save', { code, name, answers }); setDone(true); onSaved(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  if (!form) return err ? <div className="cp-error" role="alert">{err}</div> : <p className="cp-muted">Loading…</p>;
  // Consecutive fields with the same section share one titled block (same layout as the HoneyBook questionnaire).
  const groups = [];
  form.fields.forEach(f => { const last = groups[groups.length - 1]; if (last && last.section === f.section) last.fields.push(f); else groups.push({ section: f.section, fields: [f] }); });
  return <form onSubmit={save}>
    <p className="cp-muted">We're so excited to host your wedding at the North Star House! To help us prepare, we're collecting important event details. Our team will review everything and connect with you if we need to coordinate on any specific details.</p>
    {form.submitted && <p className="cp-muted"><em>Your answers are saved. You can change them any time before your event.</em></p>}
    {err && <div className="cp-error" role="alert">{err}</div>}
    {done && <div className="cp-ok" role="status">Saved. Thank you!</div>}
    <div className="cp-qcols">
    {groups.map((g, gi) => <div className="cp-qsec-wrap" key={gi}>
    {g.section && <h3 className="cp-sec">{g.section}</h3>}
    {g.fields.map(f => <div className="cp-field" key={f.id}>
      {f.image && <img className="cp-fieldimg" src={f.image} alt={f.imageAlt || ''} loading="lazy" />}
      <span className="cp-lab">{f.label}{f.required && <span className="cp-req"> *</span>}</span>
      {f.note && <span className="cp-note">{f.note}</span>}
      {f.type === 'long_text' ? <textarea rows={3} placeholder={f.placeholder || ''} value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)} />
        : f.type === 'yes_no' ? <select value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)}><option value="">—</option><option>Yes</option><option>No</option></select>
        : f.type === 'multiple_choice' && f.display === 'dropdown' ? <select value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)}><option value="">—</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === 'multiple_choice' ? f.options.map(o => <label className="cp-check" key={o}><input type="radio" name={f.id} checked={answers[f.id] === o} onChange={() => set(f.id, o)} />{o}</label>)
        : f.type === 'checkboxes' ? f.options.map(o => <label className="cp-check" key={o}><input type="checkbox" checked={(answers[f.id] || []).includes(o)} onChange={e => set(f.id, e.target.checked ? [...(answers[f.id] || []), o] : (answers[f.id] || []).filter(x => x !== o))} />{o}</label>)
        : <input placeholder={f.placeholder || ''} value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)} />}
    </div>)}
    </div>)}
    </div>
    <button className="cp-btn" disabled={busy}>{busy ? 'Saving…' : form.submitted ? 'Update my answers' : 'Save & continue'}</button>
  </form>;
}

function Brick({ api, code, name, initial, done, onSaved }) {
  const [lines, setLines] = React.useState(() => [0, 1, 2].map(i => (initial && initial[i]) || '')), [err, setErr] = React.useState(''), [busy, setBusy] = React.useState(false), [saved, setSaved] = React.useState(false);
  const set = (i, v) => { setSaved(false); setLines(ls => ls.map((l, j) => (j === i ? v.slice(0, 20) : l))); };
  async function save(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr('');
    try { const r = await api('brick_save', { code, name, lines }); setSaved(true); onSaved(r.brick_lines); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    <p className="cp-muted">Every wedding includes an engraved brick on the grounds. Choose your wording below: 3 lines, up to 20 characters each, including spaces and punctuation.</p>
    {err && <div className="cp-error" role="alert">{err}</div>}
    {saved && <div className="cp-ok" role="status">Saved. Thank you! You can update your wording any time. If the brick has already been ordered, please contact the venue.</div>}
    <div style={{ background: '#e9e1d3', border: '2px solid #b9ab92', padding: '18px 12px', margin: '0 0 16px', textAlign: 'center', fontFamily: 'Cardo,Georgia,serif', letterSpacing: 2, minHeight: 96 }} aria-label="Brick preview">
      {lines.map((l, i) => <div key={i} style={{ minHeight: 26, fontSize: 18, color: '#4a4033' }}>{l || ' '}</div>)}
    </div>
    {lines.map((l, i) => <label className="cp-field" key={i}>Line {i + 1} <span className="cp-muted">({l.length}/20)</span><input value={l} maxLength={20} autoComplete="off" onChange={e => set(i, e.target.value)} /></label>)}
    <button className="cp-btn" disabled={busy || !lines.some(l => l.trim())}>{busy ? 'Saving…' : done ? 'Update my wording' : 'Save my wording'}</button>
  </form>;
}

function MessageTeam({ api, code, name }) {
  const [who, setWho] = React.useState(''), [email, setEmail] = React.useState(''), [text, setText] = React.useState('');
  const [err, setErr] = React.useState(''), [busy, setBusy] = React.useState(false), [ok, setOk] = React.useState(false);
  async function send(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(''); setOk(false);
    try { await api('send_message', { code, name, contact_name: who, contact_email: email, message: text }); setOk(true); setText(''); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return <form onSubmit={send}>
    <p className="cp-muted">Questions, changes, or something we should know? Send a note straight to our venue team.</p>
    {err && <div className="cp-error" role="alert">{err}</div>}
    {ok && <div className="cp-ok" role="status">Message sent. Our team will get back to you soon.</div>}
    <label className="cp-field">Your name<input value={who} onChange={e => setWho(e.target.value)} autoComplete="name" /></label>
    <label className="cp-field">Your email <span className="cp-muted">(optional, if different from the one on your booking)</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
    <label className="cp-field">Message <span className="cp-muted">({text.length}/2000)</span><textarea rows={5} maxLength={2000} value={text} onChange={e => { setOk(false); setText(e.target.value); }} /></label>
    <button className="cp-btn" disabled={busy || !who.trim() || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
  </form>;
}

export function ClientPayPage({ api }) {
  const [code, setCode] = React.useState(''), [name, setName] = React.useState(''), [needsName, setNeedsName] = React.useState(false);
  const [data, setData] = React.useState(null), [error, setError] = React.useState(''), [busy, setBusy] = React.useState(false);
  const [amount, setAmount] = React.useState(''), [receipt, setReceipt] = React.useState(null), [insNote, setInsNote] = React.useState('');
  const [payError, setPayError] = React.useState('');
  const ppRef = React.useRef(null), live = React.useRef({});
  live.current = { code, name, amount };

  async function lookup(e) {
    e && e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const d = await api('lookup', { code, name });
      setData(d); setNeedsName(false);
      setAmount(d.next_due ? (d.next_due.amount_cents / 100).toFixed(2) : '');
    } catch (err) { setNeedsName(!!err.needs_name); setError(err.message); } finally { setBusy(false); }
  }

  React.useEffect(() => {
    if (!data || !data.paypal_client_id || !ppRef.current) return;
    let cancelled = false; ppRef.current.innerHTML = '';
    loadPayPal(data.paypal_client_id).then(pp => {
      if (cancelled || !ppRef.current) return;
      pp.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay' },
        createOrder: async () => {
          setPayError('');
          const cents = Math.round(parseFloat(live.current.amount) * 100);
          if (!(cents >= 100)) { const m = 'Enter an amount of at least $1.00.'; setPayError(m); throw new Error(m); }
          return (await api('create_order', { code: live.current.code, name: live.current.name, amount_cents: cents })).id;
        },
        onApprove: async d => {
          try {
            const r = await api('capture_order', { code: live.current.code, name: live.current.name, order_id: d.orderID });
            setReceipt(r); setData(prev => ({ ...prev, ...r }));
          } catch (err) { setPayError(err.message); }
        },
        onError: err => setPayError(err && err.message ? err.message : 'The payment could not be completed.'),
      }).render(ppRef.current);
    }).catch(err => setPayError(err.message));
    return () => { cancelled = true; };
  }, [data && data.paypal_client_id, !!data]);

  async function uploadInsurance(file) {
    if (!file) return; setInsNote(''); setError('');
    if (file.size > 8 * 1024 * 1024) { setError('The file must be under 8 MB.'); return; }
    setBusy(true);
    try {
      const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(new Error('Could not read the file.')); fr.readAsDataURL(file); });
      await api('upload_insurance', { code, name, mime_type: file.type, base64 });
      setData(d => ({ ...d, insurance_uploaded: true })); setInsNote('Thank you. Your insurance was received.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const pct = data && data.total_cents ? Math.min(100, data.paid_cents / data.total_cents * 100) : 0;
  const fmt = (d, o) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', o);
  const daysTo = data ? Math.ceil((new Date(data.event_date + 'T12:00:00') - new Date()) / 86400000) : 0;
  const go = id => {
    window.dispatchEvent(new CustomEvent('cp-open', { detail: id }));
    setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  };
  const tile = (id, icon, label, value, sub, ok) => <button type="button" className={'cp-tile' + (ok ? ' ok' : '')} onClick={() => go(id)}>
    <span className="cp-ico"><Icon name={icon} /></span><span className="cp-txt"><small>{label}</small><b>{value}</b><em>{sub}</em></span><span className="cp-chev"><Icon name="chevron" size={18} /></span></button>;
  const reset = () => { setData(null); setReceipt(null); setPayError(''); setError(''); };
  return <main className="cp-page"><style>{style}</style><div className={'cp-shell' + (data ? ' wide' : '')}>
    {!data ? <>
      <div className="cp-brandrow">NORTH STAR HOUSE</div>
      <h1>Your event</h1>
      {error && <div className="cp-error" role="alert">{error}</div>}
      <form className="cp-card" onSubmit={lookup}>
        <h2>Enter your venue code</h2>
        <p className="cp-muted">Your venue code is your event date, written like <strong>DEC-28-2026</strong>. Anyone paying on your behalf can use the same code, and the payment will be added to your booking.</p>
        <label className="cp-field">Venue code<input value={code} onChange={e => setCode(formatVenueCode(e.target.value, e.target.value.length >= code.length))} placeholder="DEC-28-2026" autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
        {needsName && <label className="cp-field">Last name on the booking<input value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>}
        <button className="cp-btn" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>
    </> : <>
      <header className="cp-head">
        <div className="cp-head-img" aria-hidden="true" />
        <div className="cp-head-main">
          <div className="cp-brandrow">NORTH STAR HOUSE</div>
          <h1>{data.name}</h1>
          <div className="cp-sub"><Icon name="calendar" size={16} /><span>{fmt(data.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span><i /><span>{data.event_type || 'Event'}</span></div>
        </div>
        <div className="cp-head-side">
          <div className="cp-countdown">{daysTo > 0 ? <><strong>{daysTo}</strong><hr /><span>{daysTo === 1 ? 'day to go' : 'days to go'}</span></> : daysTo === 0 ? <strong style={{ fontSize: 24 }}>Today!</strong> : <strong style={{ fontSize: 20 }}>Congratulations</strong>}</div>
          <button type="button" className="cp-linkbtn" onClick={reset}>Use a different code →</button>
        </div>
      </header>
      {error && <div className="cp-error" role="alert">{error}</div>}
      <div className="cp-tiles">
        {tile('cp-payments', 'coins', 'Balance', data.has_schedule ? money(data.balance_cents) : '—', data.has_schedule ? 'of ' + money(data.total_cents) : 'No schedule yet', data.has_schedule && data.balance_cents === 0)}
        {tile('cp-insurance', 'shield', 'Insurance', data.insurance_uploaded ? 'Received' : 'Needed', 'Certificate of insurance', data.insurance_uploaded)}
        {tile('cp-questionnaire', 'clipboard', 'Questionnaire', data.questionnaire_done ? 'Completed' : 'To do', 'Wedding day details', data.questionnaire_done)}
        {tile('cp-brick', 'doc', 'Legacy brick', data.brick_done ? 'Submitted' : 'To do', '3 lines, 20 characters', data.brick_done)}
      </div>
      <div className="cp-cols">
        <div className="cp-col">
          <div className="cp-card" id="cp-payments">
            <h2>Payments</h2>
            {data.has_schedule && <><div className="cp-big">{money(data.balance_cents)} <span className="cp-muted" style={{ fontFamily: 'system-ui,sans-serif', fontWeight: 400 }}>remaining of {money(data.total_cents)}</span></div>
              <div className="cp-bar"><span style={{ width: pct + '%' }} /></div>
              {data.next_due && <div className="cp-next"><Icon name="calendar" size={18} /><span>Next: {data.next_due.label} — {money(data.next_due.amount_cents)}{data.next_due.due_date ? ' due ' + fmt(data.next_due.due_date, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span></div>}</>}
            {receipt && <div className="cp-ok" role="status">Payment of {money(receipt.paid_cents)} received and added to your booking. PayPal receipt: {receipt.receipt_id}</div>}
            {payError && <div className="cp-error" role="alert">{payError}</div>}
            {data.paypal_client_id ? <>
              <label className="cp-field">Amount (USD)<input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} /></label>
              <div ref={ppRef} />
            </> : <p className="cp-muted" style={{ margin: 0 }}>Online payments are not available yet. Please contact us to arrange payment.</p>}
          </div>
          <Acc id="cp-insurance" title="Certificate of insurance" pill={<Pill ok={data.insurance_uploaded} yes="Received" no="Needed" />} defaultOpen={!data.insurance_uploaded}>
            <p className="cp-muted" style={{ marginTop: 0 }}>Event insurance is required and due one month before your wedding.</p>
            {data.insurance_uploaded && <div className="cp-ok" role="status">{insNote || 'We have your insurance on file. You can upload a replacement below.'}</div>}
            <label className="cp-field">Upload a PDF, JPG or PNG (up to 8 MB)<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { uploadInsurance(e.target.files[0]); e.target.value = ''; }} /></label>
          </Acc>
          <Acc id="cp-message" title="Message our team">
            <MessageTeam api={api} code={code} name={name} />
          </Acc>
        </div>
        <div className="cp-col">
          <Acc id="cp-brick" title="Your legacy brick" pill={<Pill ok={data.brick_done} yes="Submitted" no="Needed" />} defaultOpen={!data.brick_done}>
            <Brick api={api} code={code} name={name} initial={data.brick_lines} done={data.brick_done} onSaved={lines => setData(d => ({ ...d, brick_lines: lines, brick_done: true }))} />
          </Acc>
        </div>
      </div>
      <Acc id="cp-questionnaire" title="Event questionnaire" pill={<Pill ok={data.questionnaire_done} yes="Completed" no="To do" />} defaultOpen={!data.questionnaire_done}>
        <Questionnaire api={api} code={code} name={name} onSaved={() => setData(d => ({ ...d, questionnaire_done: true }))} />
      </Acc>
    </>}
  </div></main>;
}

export function createClientPayApi({ baseUrl, apiKey }) {
  return async (action, body) => {
    const res = await fetch(baseUrl + '/functions/v1/client-pay', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: 'Bearer ' + apiKey }, body: JSON.stringify({ ...body, action }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(out.error || 'Something went wrong. Please try again.'); Object.assign(e, out); throw e; }
    return out;
  };
}
