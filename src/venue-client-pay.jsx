// Public clients-only page (#pay): venue code -> PayPal payment + insurance upload.
import { formatVenueCode } from './venue-code.js';
const style = `.cp-page{min-height:100vh;background:#f8f4ed;color:#302e29;font-family:system-ui,sans-serif;padding:32px 16px}.cp-shell{max-width:560px;margin:0 auto}.cp-brand{letter-spacing:2px;font-weight:700;color:#886c44;font-size:12px}.cp-page h1{font-family:Cardo,Georgia,serif;font-size:28px;margin:6px 0 18px}.cp-card{background:#fff;border:1px solid #e6dfd3;border-radius:0;padding:20px;margin-bottom:16px}.cp-card h2{font-family:Cardo,Georgia,serif;font-size:19px;margin:0 0 10px}.cp-field{display:block;font-size:13px;font-weight:600;margin-bottom:12px}.cp-field input{display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #ded7cb;border-radius:0;padding:11px;font:inherit;font-size:16px}.cp-btn{background:#886c44;color:#fff;border:0;border-radius:0;padding:12px 18px;font:inherit;font-weight:600;cursor:pointer}.cp-btn:disabled{opacity:.55;cursor:default}.cp-muted{color:#6f685c;font-size:13px;line-height:1.55}.cp-error{background:#f9eae7;color:#a64f3c;border:1px solid #a64f3c;border-radius:0;padding:10px 12px;font-size:13px;margin-bottom:14px}.cp-ok{background:#edf4ed;color:#426b4a;border:1px solid #426b4a;border-radius:0;padding:10px 12px;font-size:13px;margin-bottom:14px}.cp-big{font-size:22px;font-weight:600}.cp-bar{height:6px;background:#f0ece5;border-radius:0;overflow:hidden;margin:10px 0}.cp-bar span{display:block;height:100%;background:#6b8c6c}.cp-field textarea,.cp-field select{display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #ded7cb;border-radius:0;padding:11px;font:inherit;font-size:16px}.cp-check{display:flex;gap:8px;align-items:center;font-weight:400;margin:4px 0}.cp-check input{width:auto;margin:0}.cp-link{display:inline-block;text-decoration:none}.cp-shell.wide{max-width:1040px}.cp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}.cp-page .cp-head h1{margin:6px 0 4px}.cp-head-side{display:flex;align-items:center;gap:16px}.cp-countdown{background:#886c44;color:#fff;border-radius:0;padding:10px 20px;text-align:center;line-height:1.15;min-width:96px}.cp-countdown strong{display:block;font-family:Cardo,Georgia,serif;font-size:30px;font-weight:400}.cp-countdown span{font-size:11px;letter-spacing:1px;text-transform:uppercase}.cp-linkbtn{background:none;border:0;color:#886c44;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:0}.cp-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.cp-tile{text-align:left;background:#fff;border:1px solid #e6dfd3;border-left:4px solid #c9a46a;border-radius:0;padding:12px 14px;font:inherit;cursor:pointer;color:inherit}.cp-tile.ok{border-left-color:#6b8c6c}.cp-tile small{display:block;font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:#6f685c;font-weight:700}.cp-tile b{display:block;font-family:Cardo,Georgia,serif;font-size:21px;font-weight:700;margin:4px 0 2px}.cp-tile span{font-size:12px;color:#6f685c}.cp-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}.cp-col{min-width:0}@media(max-width:820px){.cp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.cp-cols{grid-template-columns:1fr}.cp-head-side{width:100%;justify-content:space-between}}`;
const money = c => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const tag = (ok, yes, no) => <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 0, marginLeft: 8, verticalAlign: 'middle', background: ok ? '#edf4ed' : '#faf0e6', color: ok ? '#426b4a' : '#9a5d22' }}>{ok ? yes : no}</span>;

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
  return <form onSubmit={save}>
    <p className="cp-muted">{form.submitted ? 'Your answers are saved. You can change them any time before your event.' : 'Tell us about your day so we can prepare.'}</p>
    {err && <div className="cp-error" role="alert">{err}</div>}
    {done && <div className="cp-ok" role="status">Saved. Thank you!</div>}
    {form.fields.map(f => <div className="cp-field" key={f.id}>{f.label}{f.required && ' *'}
      {f.type === 'long_text' ? <textarea rows={3} value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)} />
        : f.type === 'yes_no' ? <select value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)}><option value="">—</option><option>Yes</option><option>No</option></select>
        : f.type === 'multiple_choice' ? f.options.map(o => <label className="cp-check" key={o}><input type="radio" name={f.id} checked={answers[f.id] === o} onChange={() => set(f.id, o)} />{o}</label>)
        : f.type === 'checkboxes' ? f.options.map(o => <label className="cp-check" key={o}><input type="checkbox" checked={(answers[f.id] || []).includes(o)} onChange={e => set(f.id, e.target.checked ? [...(answers[f.id] || []), o] : (answers[f.id] || []).filter(x => x !== o))} />{o}</label>)
        : <input value={answers[f.id] || ''} onChange={e => set(f.id, e.target.value)} />}
    </div>)}
    <button className="cp-btn" disabled={busy}>{busy ? 'Saving…' : form.submitted ? 'Update my answers' : 'Save my answers'}</button>
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
    {err && <div className="cp-error" role="alert">{err}</div>}
    {saved && <div className="cp-ok" role="status">Saved. Thank you! You can update your wording any time. If the brick has already been ordered, please contact the venue.</div>}
    <div style={{ background: '#e9e1d3', border: '2px solid #b9ab92', borderRadius: 0, padding: '18px 12px', margin: '0 0 14px', textAlign: 'center', fontFamily: 'Cardo,Georgia,serif', letterSpacing: 2, minHeight: 96 }} aria-label="Brick preview">
      {lines.map((l, i) => <div key={i} style={{ minHeight: 26, fontSize: 18, color: '#4a4033' }}>{l || ' '}</div>)}
    </div>
    {lines.map((l, i) => <label className="cp-field" key={i}>Line {i + 1} <span className="cp-muted">({l.length}/20)</span><input value={l} maxLength={20} autoComplete="off" onChange={e => set(i, e.target.value)} /></label>)}
    <button className="cp-btn" disabled={busy || !lines.some(l => l.trim())}>{busy ? 'Saving…' : done ? 'Update my brick wording' : 'Save my brick wording'}</button>
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
  const go = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const tile = (id, label, value, sub, ok) => <button type="button" className={'cp-tile' + (ok ? ' ok' : '')} onClick={() => go(id)}><small>{label}</small><b>{value}</b><span>{sub}</span></button>;
  const reset = () => { setData(null); setReceipt(null); setPayError(''); setError(''); };
  return <main className="cp-page"><style>{style}</style><div className={'cp-shell' + (data ? ' wide' : '')}>
    {!data ? <>
      <div className="cp-brand">NORTH STAR HOUSE</div>
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
        <div>
          <div className="cp-brand">NORTH STAR HOUSE</div>
          <h1>{data.name}</h1>
          <p className="cp-muted" style={{ margin: 0 }}>{data.event_type || 'Event'} · {fmt(data.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="cp-head-side">
          <div className="cp-countdown">{daysTo > 0 ? <><strong>{daysTo}</strong><span>{daysTo === 1 ? 'day to go' : 'days to go'}</span></> : daysTo === 0 ? <strong style={{ fontSize: 20 }}>Today!</strong> : <strong style={{ fontSize: 16 }}>Congratulations</strong>}</div>
          <button type="button" className="cp-linkbtn" onClick={reset}>Use a different code</button>
        </div>
      </header>
      {error && <div className="cp-error" role="alert">{error}</div>}
      <div className="cp-tiles">
        {tile('cp-payments', 'Balance', data.has_schedule ? money(data.balance_cents) : '—', data.has_schedule ? 'of ' + money(data.total_cents) : 'No schedule yet', data.has_schedule && data.balance_cents === 0)}
        {tile('cp-insurance', 'Insurance', data.insurance_uploaded ? 'Received' : 'Needed', 'Certificate of insurance', data.insurance_uploaded)}
        {tile('cp-questionnaire', 'Questionnaire', data.questionnaire_done ? 'Completed' : 'To do', 'Wedding day details', data.questionnaire_done)}
        {tile('cp-brick', 'Legacy brick', data.brick_done ? 'Submitted' : 'To do', '3 lines, 20 characters', data.brick_done)}
      </div>
      <div className="cp-cols">
        <div className="cp-col">
          <div className="cp-card" id="cp-payments">
            <h2>Payments</h2>
            {data.has_schedule && <><div className="cp-big">{money(data.balance_cents)} <span className="cp-muted">remaining of {money(data.total_cents)}</span></div>
              <div className="cp-bar"><span style={{ width: pct + '%' }} /></div>
              {data.next_due && <p className="cp-muted" style={{ margin: '0 0 14px' }}>Next: {data.next_due.label} — {money(data.next_due.amount_cents)}{data.next_due.due_date ? ' due ' + fmt(data.next_due.due_date, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>}</>}
            {receipt && <div className="cp-ok" role="status">Payment of {money(receipt.paid_cents)} received and added to your booking. PayPal receipt: {receipt.receipt_id}</div>}
            {payError && <div className="cp-error" role="alert">{payError}</div>}
            {data.paypal_client_id ? <>
              <label className="cp-field">Amount (USD)<input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} /></label>
              <div ref={ppRef} />
            </> : <p className="cp-muted">Online payments are not available yet. Please contact us to arrange payment.</p>}
          </div>
          <div className="cp-card" id="cp-insurance">
            <h2>Certificate of insurance{tag(data.insurance_uploaded, 'Received', 'Needed')}</h2>
            <p className="cp-muted">Event insurance is required and due one month before your wedding.</p>
            {data.insurance_uploaded && <div className="cp-ok" role="status">{insNote || 'We have your insurance on file. You can upload a replacement below.'}</div>}
            <label className="cp-field">Upload a PDF, JPG or PNG (up to 8 MB)<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { uploadInsurance(e.target.files[0]); e.target.value = ''; }} /></label>
          </div>
          <div className="cp-card" id="cp-brick">
            <h2>Your legacy brick{tag(data.brick_done, 'Submitted', 'Needed')}</h2>
            <p className="cp-muted">Every wedding includes an engraved brick on the grounds. Choose your wording below: 3 lines, up to 20 characters each, including spaces and punctuation.</p>
            <Brick api={api} code={code} name={name} initial={data.brick_lines} done={data.brick_done} onSaved={lines => setData(d => ({ ...d, brick_lines: lines, brick_done: true }))} />
          </div>
        </div>
        <div className="cp-col">
          <div className="cp-card" id="cp-questionnaire">
            <h2>Event questionnaire{tag(data.questionnaire_done, 'Completed', 'To do')}</h2>
            <details open={!data.questionnaire_done}><summary className="cp-muted" style={{ cursor: 'pointer', marginBottom: 10 }}>{data.questionnaire_done ? 'View or update my answers' : 'Fill out now'}</summary>
              <Questionnaire api={api} code={code} name={name} onSaved={() => setData(d => ({ ...d, questionnaire_done: true }))} /></details>
          </div>
          <div className="cp-card" id="cp-message">
            <h2>Message our team</h2>
            <MessageTeam api={api} code={code} name={name} />
          </div>
        </div>
      </div>
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
