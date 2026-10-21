import { ContractManager } from './venue-contracts.jsx';
// Client dashboard: reads the imported source snapshot without changing signed
// agreements, invoice schedules, or sending any client communications.
export function venueDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function shiftDate(date, days) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function dayCount(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
function dateLabel(date) { return date ? new Date(date.includes('T') ? date : date.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date to confirm'; }
function text(html) { return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function amount(cents, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100); }

// Store staff verification beside the form response, separately from the
// immutable HoneyBook snapshot and the actual certificate-upload timestamp.
export async function saveVenueInsuranceVerification({ baseUrl, apiKey, request = fetch }, responseId, verified, note = '') {
  if (!responseId || typeof verified !== 'boolean') throw new Error('Choose a client and verification status.');
  const headers = { apikey:apiKey, Authorization:'Bearer '+apiKey, 'Content-Type':'application/json' };
  const resource = baseUrl + '/rest/v1/nsh_form_responses?id=eq.' + encodeURIComponent(responseId);
  async function readResponse(res) {
    if (!res.ok) throw new Error('Insurance verification could not be saved. Please try again.');
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Client record is unavailable or you do not have permission to update it.');
    return rows[0];
  }
  const current = await readResponse(await request(resource+'&select=id,form_id,answers', {headers}));
  if (!['a3a383f7-e1db-4344-9dec-ea879ad3406d','668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'].includes(current.form_id)) throw new Error('This record is not a venue client.');
  const now = new Date().toISOString();
  const insurance = { verified, verified_at:verified ? now : null, updated_at:now, note:String(note).trim().slice(0,2000) };
  const answers = { ...current.answers, __venue_checklist:{ ...current.answers?.__venue_checklist, insurance } };
  const saved = await readResponse(await request(resource+'&form_id=eq.'+encodeURIComponent(current.form_id), {method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({answers})}));
  if (saved.answers?.__venue_checklist?.insurance?.verified !== verified) throw new Error('Verification was not saved. Please try again.');
  return saved;
}

export function buildVenueClient(sub, live = null, today = venueDateKey(), nativeVersions = []) {
  const a = sub.answers || {}, hb = a.__honeybook, p = hb?.project || {};
  const insuranceCheck = a.__venue_checklist?.insurance;
  const insuranceVerified = typeof insuranceCheck?.verified === 'boolean' ? insuranceCheck.verified : !!live?.insurance_uploaded_at;
  const eventDate = live?.event_date || p.project_date || a.sn9urgfr || a.evp_date || null;
  const eventEnd = p.project_end_date || eventDate;
  const responses = hb?.file_responses || [];
  const fileOrder = id => (hb?.files || []).find(f => f.id === id)?.updated_at || '';
  const latest = predicate => responses.filter(predicate).sort((x, y) => fileOrder(y.id).localeCompare(fileOrder(x.id)))[0];
  const invoice = latest(r => r.responses?.payments);
  // Prefer signatures on the selected invoice, rather than an older signed file.
  const contract = invoice?.responses?.signatures ? invoice : latest(r => r.responses?.signatures);
  // Weddings booked natively (no HoneyBook import) get their schedule from
  // venue_payment_schedule instead, generated automatically at booking time.
  const nativeScheduleRows = (live?.venue_payment_schedule || []).slice().sort((x, y) => x.sequence - y.sequence);
  const payments = invoice?.responses?.payments || (nativeScheduleRows.length ? {
    total: { amount: nativeScheduleRows.reduce((s, r) => s + (r.amount_cents || 0), 0), currency: 'USD' },
    amount_paid: { amount: nativeScheduleRows.reduce((s, r) => s + (r.amount_paid_cents || 0), 0) },
    balance_due: { amount: nativeScheduleRows.reduce((s, r) => s + ((r.amount_cents || 0) - (r.amount_paid_cents || 0)), 0) },
    schedule: nativeScheduleRows.map(r => ({ amount: { amount: r.amount_cents, currency: 'USD' }, due_date: r.due_date, paid: r.status === 'paid', __nativeLabel: r.label })),
  } : null);
  const nativeAgreement = nativeVersions.filter(v=>v.response_id===sub.id&&!['draft','void'].includes(v.status)).sort((a,b)=>b.version-a.version)[0] || null;
  const signatures = nativeAgreement ? {all_required_signed:nativeAgreement.status==='completed',signatures:(nativeAgreement.recipients||[]).map(s=>({signee_name:s.name,signee_type:s.role==='venue'?'vendor':'client',required:true,signed:s.status==='signed',signed_at:s.signed_at}))} : contract?.responses?.signatures || null;
  const currency = payments?.total?.currency || 'USD';
  const schedule = (payments?.schedule || []).map((payment, index) => ({ ...payment, cents: payment.amount?.amount || 0, currency: payment.amount?.currency || currency, label: payment.__nativeLabel || (index === 0 ? 'Booking payment' : 'Scheduled payment ' + (index + 1)), due: payment.due_date?.slice(0, 10) || null })).sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999'));
  const duePayments = schedule.filter(s => !s.paid);
  const unsigned = signatures?.signatures?.filter(s => s.required && !s.signed) || [];
  const surveys = responses.filter(r => r.responses?.questionnaire && /(?:wedding|event) info questionnaire/i.test(r.title || ''));
  const surveyComplete = !!live?.questionnaire_form_response_id || surveys.some(r => { const qs = r.responses.questionnaire.questions || []; return qs.some(q => q.answered) && qs.filter(q => q.required).every(q => q.answered); });
  const surveySent = !!live?.questionnaire_sent_at || surveys.length > 0;
  const requirementsDue = eventDate ? shiftDate(eventDate, -30) : null;
  const contacts = (hb?.contacts || []).filter(c => c.kind === 'client');
  const name = (p.name || live?.name || a['7fnabd0i'] || a.evp_name || 'Client').replace(/\s*\([SJ]\)\s*$/i, '').replace(/\s+Wedding\s*$/i, '').trim();
  const email = a.c9u1sxb4 || a.evp_email || contacts[0]?.email;
  const tasks = [];
  function task(key, title, due, detail, kind) {
    const overdue = !!due && due < today;
    const soon = !!due && due <= shiftDate(today, 30);
    tasks.push({ key: sub.id + '-' + key, title, due, detail, kind, overdue, urgent: overdue || soon || kind === 'signature' || kind === 'booking', rank: overdue ? 0 : kind === 'signature' || kind === 'booking' ? 1 : soon ? 2 : 3 });
  }
  for (const payment of duePayments) task('payment-' + schedule.indexOf(payment), 'Collect ' + amount(payment.cents, payment.currency), payment.due, payment.label, 'payment');
  if (nativeAgreement && ['declined','expired'].includes(nativeAgreement.status)) task('contract-revision','Prepare revised agreement',null,'Previous request '+nativeAgreement.status,'booking');
  else for (const [index, s] of unsigned.entries()) task('signature-' + index, s.signee_type === 'vendor' ? 'Venue countersignature' : 'Client signature', null, s.signee_name || 'Required signer', 'signature');
  if (!hb) task('booking', 'Review pre-booking details', null, 'Prepare the agreement and payment schedule', 'booking');
  if (!surveyComplete) task('survey', surveySent ? 'Complete event questionnaire' : 'Event questionnaire', requirementsDue, surveySent ? 'Sent; awaiting required answers' : 'Not yet on file', 'survey');
  if (!insuranceVerified) task('insurance', 'Confirm insurance on file', requirementsDue, 'Coverage not verified in the portal', 'insurance');
  if (!eventDate) task('date', 'Confirm event date', null, 'No date recorded', 'booking');
  tasks.sort((x, y) => x.rank - y.rank || (x.due || eventDate || '9999').localeCompare(y.due || eventDate || '9999'));
  return { id:sub.id, sub, name, email, contacts, hb, eventDate, eventEnd, nativeAgreement, type: sub.form_id === 'a3a383f7-e1db-4344-9dec-ea879ad3406d' || /wedding/i.test(p.name || live?.event_type || sub.form_name || '') ? 'Wedding' : live?.event_type || 'Private event', days:eventDate ? dayCount(today, eventDate) : null, payments, schedule, duePayments, signatures, unsigned, surveyComplete, surveySent, insuranceVerified, insuranceCheck, insuranceUploadedAt:live?.insurance_uploaded_at || null, requirementsDue, tasks, urgent:tasks.filter(t => t.urgent), currency, total:payments?.total?.amount ?? null, paid:payments?.amount_paid?.amount ?? null, balance:payments?.balance_due?.amount ?? null, sourceUrl:hb?.workspace?.id && p.id ? 'https://app.honeybook.com/app/event/' + encodeURIComponent(p.id) + '/workspace/' + encodeURIComponent(hb.workspace.id) + '/activity' : null };
}

const css = `
.vc-dashboard{color:#302e29;font-size:13px;min-width:0}.vc-dashboard button,.vc-dialog button{font:inherit;cursor:pointer}.vc-dashboard button:focus-visible,.vc-dashboard input:focus-visible,.vc-dialog button:focus-visible,.vc-dialog a:focus-visible{outline:2px solid #886c44;outline-offset:3px}.vc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 24px}.vc-stat{background:#fff;border:1px solid #e8e0d5;border-radius:12px;padding:18px}.vc-stat small,.vc-muted{color:#777269;font-size:12px;line-height:1.5}.vc-stat strong{display:block;font-family:Cardo,Georgia,serif;font-size:30px;line-height:1.2;margin:8px 0 3px}.vc-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.vc-section-title{font-family:Cardo,Georgia,serif;font-size:20px;font-weight:700;margin:0}.vc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0}.vc-toolbar input{border:1px solid #ded7cb;background:white;border-radius:7px;padding:9px 11px;min-width:150px;flex:1;max-width:230px;font:inherit}.vc-filter{border:1px solid #e3dcd0;background:transparent;color:#6f685c;border-radius:20px;padding:7px 11px;font-size:11px!important}.vc-filter[aria-pressed=true]{background:#886c44;border-color:#886c44;color:white}.vc-card{border:1px solid #e6dfd3;border-radius:12px;background:white;margin-bottom:14px;overflow:hidden}.vc-card-head{padding:18px 20px 16px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #f0ebe3}.vc-date{background:#f8f4ed;border:1px solid #ebe2d4;width:49px;flex-shrink:0;border-radius:9px;text-align:center;padding:7px 0}.vc-date small{display:block;color:#886c44;font-size:10px;text-transform:uppercase;font-weight:700}.vc-date strong{display:block;font-family:Cardo,Georgia,serif;font-size:22px;line-height:1.2}.vc-name{font-family:Cardo,Georgia,serif;font-size:19px;font-weight:700;margin:0 0 4px;overflow-wrap:anywhere}.vc-head-main{flex:1;min-width:0}.vc-open{background:none;border:0;color:#886c44;padding:5px;font-weight:600!important;font-size:12px!important;white-space:nowrap}.vc-card-body{display:grid;grid-template-columns:1.05fr 1.3fr 1fr;gap:22px;padding:17px 20px 20px}.vc-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#8a8173;margin-bottom:9px}.vc-pill{display:inline-block;padding:4px 8px;border-radius:5px;font-size:11px;font-weight:600;background:#f5f1e9;color:#76664d;line-height:1.45}.vc-pill.good{background:#edf4ed;color:#426b4a}.vc-pill.alert{background:#faf0e6;color:#9a5d22}.vc-pill.danger{background:#f9eae7;color:#a64f3c}.vc-progress{height:5px;background:#f0ece5;border-radius:4px;overflow:hidden;margin:9px 0}.vc-progress span{display:block;height:100%;background:#928165;border-radius:4px}.vc-payment-amount{font-size:16px;font-weight:600}.vc-line{display:flex;align-items:center;gap:7px;font-size:12px;color:#625e56;margin:7px 0}.vc-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#c5b79f}.vc-dot.good{background:#6b8c6c}.vc-card-foot{background:#fcfaf6;border-top:1px solid #f0ebe3;padding:10px 20px;display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#817867}.vc-sidebar{display:flex;flex-direction:column;gap:18px}.vc-side-card{background:#fff;border:1px solid #e6dfd3;border-radius:12px;padding:18px}.vc-side-card.priority{border-top:3px solid #9a7c53}.vc-side-title{font-family:Cardo,Georgia,serif;font-weight:700;font-size:18px;margin:0 0 4px}.vc-task{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #eee9e0;padding:14px 0!important;color:inherit}.vc-task:last-child{border-bottom:0}.vc-task-head{font-size:12px;font-weight:600;line-height:1.5}.vc-task-name{font-size:11px;color:#827b70;margin:4px 0;line-height:1.4}.vc-task-date{font-size:10px;color:#886c44}.vc-task-date.late{color:#ad503b}.vc-text-button{background:transparent;border:0;color:#886c44;font-weight:600!important;padding:10px 0!important;font-size:12px!important}.vc-empty{border:1px dashed #dcd3c4;border-radius:10px;padding:30px;text-align:center;color:#817b70;line-height:1.7;background:#fff}.vc-footer-note{font-size:11px;color:#8a8378;line-height:1.6;margin-top:18px}.vc-dialog{border:1px solid #e1d7c8;border-radius:16px;padding:0;width:min(850px,calc(100vw - 28px));max-height:90vh;color:#302e29;box-shadow:0 24px 80px #29211630}.vc-dialog::backdrop{background:#24211e77}.vc-modal-head{display:flex;align-items:start;gap:15px;padding:24px;border-bottom:1px solid #eee7dd;position:sticky;top:0;background:white;z-index:1}.vc-modal-body{padding:24px}.vc-modal-body h3{font-family:Cardo,Georgia,serif;font-size:18px;margin:24px 0 12px}.vc-modal-body h3:first-child{margin-top:0}.vc-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.vc-contact{border:1px solid #eee7dd;border-radius:8px;padding:13px;overflow-wrap:anywhere}.vc-dialog a{color:#886c44}.vc-table{width:100%;border-collapse:collapse;font-size:12px}.vc-table td,.vc-table th{text-align:left;border-bottom:1px solid #eee7dd;padding:10px 6px}.vc-table th{font-size:10px;color:#877b68;text-transform:uppercase;letter-spacing:.5px}.vc-history{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7;background:#faf8f3;padding:16px;border-radius:8px;max-height:450px;overflow:auto}.vc-modal-body summary{cursor:pointer;color:#886c44;font-size:13px;font-weight:600;padding:14px 0}.vc-counter{background:#f1eade;color:#886c44;border-radius:20px;padding:3px 7px;font:600 11px system-ui;margin-left:6px}
@media(min-width:1101px){.vc-sidebar{position:sticky;top:110px}}@media(max-width:1100px){.vc-layout{grid-template-columns:minmax(0,1fr)}.vc-sidebar{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:650px){.vc-stats{grid-template-columns:1fr 1fr;gap:8px}.vc-stat{padding:13px}.vc-stat strong{font-size:25px}.vc-card-head{padding:15px 13px;gap:10px;flex-wrap:wrap}.vc-card-body{grid-template-columns:1fr 1fr;gap:18px;padding:16px 13px}.vc-card-body>div:last-child{grid-column:1/-1}.vc-card-foot{padding:10px 13px;flex-wrap:wrap}.vc-sidebar{grid-template-columns:1fr}.vc-name{font-size:17px}.vc-contact-grid{grid-template-columns:1fr}.vc-modal-head,.vc-modal-body{padding:18px}.vc-toolbar input{max-width:none;width:100%;flex-basis:100%}}
`;

function InsuranceVerification({ client, onVerify }) {
  const [note,setNote] = React.useState(client.insuranceCheck?.note || '');
  const [saving,setSaving] = React.useState(false), [error,setError] = React.useState(''), [saved,setSaved] = React.useState(false);
  async function save(verified) {
    if (saving) return;
    setSaving(true);setError('');setSaved(false);
    try { await onVerify(client.id,verified,note);setSaved(true); }
    catch(e) { setError(e.message || 'Could not save insurance verification.'); }
    finally { setSaving(false); }
  }
  return <section aria-labelledby="vc-insurance-title" style={{border:'1px solid #e6dfd3',borderRadius:10,padding:16,marginTop:24}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><h3 id="vc-insurance-title" style={{margin:0}}>Insurance</h3><span className={'vc-pill '+(client.insuranceVerified?'good':'alert')}>{client.insuranceVerified?'Verified on file':'Needs verification'}</span></div>
    <p className="vc-muted">{client.insuranceVerified ? (client.insuranceCheck?.verified_at ? 'Verified '+dateLabel(client.insuranceCheck.verified_at)+'.' : 'Certificate received '+dateLabel(client.insuranceUploadedAt)+'.') : 'After reviewing the certificate, mark it verified here—even if it was received by email or in HoneyBook.'}</p>
    {client.sourceUrl && <p><a href={client.sourceUrl} target="_blank" rel="noopener noreferrer">Review documents in HoneyBook ↗</a></p>}
    <label style={{display:'block',fontSize:12,color:'#6f685c'}}>Verification note <span className="vc-muted">(optional)</span><textarea aria-label="Insurance verification note" value={note} onChange={e=>{setNote(e.target.value);setSaved(false);}} disabled={saving || client.insuranceVerified} maxLength={2000} rows={2} placeholder="For example: certificate received by email; reviewed coverage and event date." style={{display:'block',width:'100%',marginTop:7,border:'1px solid #ded7cb',borderRadius:7,padding:10,font:'inherit',resize:'vertical',background:client.insuranceVerified?'#faf8f3':'white'}}/></label>
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:12}}><button type="button" disabled={saving || !onVerify} onClick={()=>save(!client.insuranceVerified)} style={{border:client.insuranceVerified?'1px solid #ded7cb':'1px solid #886c44',borderRadius:7,padding:'9px 13px',background:client.insuranceVerified?'white':'#886c44',color:client.insuranceVerified?'#6f685c':'white',opacity:saving?.6:1}}>{saving?'Saving…':client.insuranceVerified?'Undo verification':'Mark insurance verified'}</button>{saved&&<span role="status" className="vc-muted">{client.insuranceVerified?'Verification saved.':'Verification removed.'}</span>}</div>
    {error&&<p role="alert" style={{fontSize:12,color:'#a64f3c',marginBottom:0}}>{error}</p>}
  </section>;
}

function ClientDetail({ client, onClose, onVerify, agreementApi, onContractsChange }) {
  const ref = React.useRef(null);
  React.useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="vc-dialog" aria-labelledby="vc-client-title" onCancel={onClose} onClick={e => { if(e.target === ref.current) onClose(); }}>
    <div className="vc-modal-head"><div style={{flex:1}}><div className="vc-label">{client.type} · {dateLabel(client.eventDate)}</div><h2 id="vc-client-title" className="vc-name" style={{fontSize:25}}>{client.name}</h2><div className="vc-muted">Client details</div></div><button className="vc-open" onClick={onClose} aria-label="Close client details">Close ×</button></div>
    <div className="vc-modal-body">
      <h3>Contacts</h3><div className="vc-contact-grid">{(client.contacts.length ? client.contacts : [{full_name:client.name,email:client.email}]).map((c,i) => <div key={c.id || i} className="vc-contact"><strong>{c.full_name}</strong><div className="vc-muted">{c.email && <a href={'mailto:'+c.email}>{c.email}</a>}</div><div className="vc-muted">{c.phone_number || 'Phone not recorded'}</div></div>)}</div>
      <InsuranceVerification client={client} onVerify={onVerify}/>
      {agreementApi&&<ContractManager client={client} api={agreementApi} onChange={onContractsChange}/>}
      <h3>Payment schedule</h3>{client.payments ? <><p className="vc-muted">{amount(client.paid,client.currency)} paid · {amount(client.balance,client.currency)} remaining · {amount(client.total,client.currency)} invoice total</p><div style={{overflowX:'auto'}}><table className="vc-table"><thead><tr><th>Payment</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead><tbody>{client.schedule.map((s,i) => <tr key={i}><td>{s.label}</td><td>{dateLabel(s.due)}</td><td>{amount(s.cents,s.currency)}</td><td><span className={'vc-pill '+(s.paid?'good':s.due && s.due < venueDateKey()?'danger':'')}>{s.paid?'Paid':s.due && s.due < venueDateKey()?'Past due':'Scheduled'}</span></td></tr>)}</tbody></table></div><p className="vc-muted">Original invoice schedule, including any security deposit. Payment names follow the source schedule order.</p></> : <p className="vc-muted">A payment schedule has not been recorded.</p>}
      <h3>Still to do</h3>{client.tasks.length ? client.tasks.map(task => <div key={task.key} className="vc-task"><div className="vc-task-head">{task.title}</div><div className="vc-task-name">{task.detail}</div><div className={'vc-task-date '+(task.overdue?'late':'')}>{task.due ? (task.overdue?'Past due · ':'Due ') + dateLabel(task.due) : 'Awaiting completion'}</div></div>) : <p className="vc-muted">No outstanding items recorded.</p>}
      {client.signatures && <><h3>Contract signatures</h3>{client.signatures.signatures.map((s,i) => <div className="vc-line" key={i}><span className={'vc-dot '+(s.signed?'good':'')}/><span>{s.signee_name} · {s.signed?'Signed '+dateLabel(s.signed_at):'Awaiting signature'}</span></div>)}</>}
      <details><summary>Original forms, documents &amp; email history</summary><p className="vc-muted">The source record is preserved here for reference.</p><div className="vc-history">{client.sub.internal_notes || 'No history recorded.'}</div></details>
      {client.sourceUrl && <p><a href={client.sourceUrl} target="_blank" rel="noopener noreferrer">Open original HoneyBook project ↗</a></p>}
    </div>
  </dialog>;
}

export function VenueClientDashboard({ submissions, loadEvents, saveInsurance, agreementApi }) {
  const [events,setEvents] = React.useState([]), [error,setError] = React.useState('');
  const [savedResponses,setSavedResponses] = React.useState({});
  const [nativeVersions,setNativeVersions] = React.useState([]);
  React.useEffect(()=>{let cancelled=false;function refresh(){if(agreementApi)agreementApi('summary').then(rows=>{if(!cancelled)setNativeVersions(rows);}).catch(()=>{if(!cancelled)setError('Live agreement status is unavailable. Showing the saved client records.');});}refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);};},[agreementApi]);
  const [query,setQuery] = React.useState(''), [filter,setFilter] = React.useState('all'), [all,setAll] = React.useState(false), [allTasks,setAllTasks] = React.useState(false), [selected,setSelected] = React.useState(null);
  React.useEffect(() => { let cancelled=false; loadEvents().then(rows => {if(!cancelled)setEvents(rows);}).catch(() => {if(!cancelled)setError('Live requirement updates are unavailable. Showing the saved client records.');}); return()=>{cancelled=true;}; }, [loadEvents]);
  const today = venueDateKey();
  const clients = (submissions || []).map(sub => buildVenueClient(savedResponses[sub.id] ? {...sub,...savedResponses[sub.id]} : sub,events.find(e=>e.prebooking_form_response_id===sub.id),today,nativeVersions)).filter(c => !c.eventEnd || c.eventEnd >= today).sort((a,b)=>(a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
  const urgent = clients.flatMap(client=>client.urgent.map(task=>({...task,client}))).sort((a,b)=>a.rank-b.rank || (a.due || a.client.eventDate || '9999').localeCompare(b.due || b.client.eventDate || '9999'));
  const upcoming = clients.flatMap(client=>client.tasks.filter(t=>t.due && t.due>=today).map(task=>({...task,client}))).sort((a,b)=>a.due.localeCompare(b.due));
  const dueSoon = clients.flatMap(c=>c.duePayments).filter(p=>p.due && p.due<=shiftDate(today,30));
  const matches = clients.filter(c=>(filter!=='attention'||c.urgent.length>0)&&(filter!=='soon'||(c.days!==null && c.days<=60))&&(!query || (c.name+' '+c.email+' '+c.eventDate).toLowerCase().includes(query.toLowerCase())));
  const shown = all ? matches : matches.slice(0,4);
  const open = c => setSelected(c.id);
  const selectedClient = clients.find(c=>c.id===selected);
  async function verifyInsurance(id,verified,note) {
    if (!saveInsurance) throw new Error('Insurance verification is unavailable. Please reload and try again.');
    const record = await saveInsurance(id,verified,note);
    setSavedResponses(prev=>({...prev,[id]:record}));
  }
  const setScope = scope => {setFilter(scope);setAll(false);};
  return <div className="vc-dashboard" style={{gridColumn:'1 / -1'}}>
    <style>{css}</style>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><p className="vc-muted" style={{margin:0}}>Upcoming celebrations, payment progress, and what still needs attention.</p><span className="vc-muted">{new Date(today+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span></div>
    {error && <p role="status" className="vc-pill alert">{error}</p>}
    <div className="vc-stats">{[
      ['Upcoming events',clients.length,'Weddings & private events'],
      ['In the next 60 days',clients.filter(c=>c.days!==null&&c.days<=60).length,'Getting ready to celebrate'],
      ['Payments to follow up',dueSoon.length,'Past due or due in 30 days'],
      ['Clients needing attention',clients.filter(c=>c.urgent.length).length,'Signatures, payments & final details'],
    ].map(([label,value,note])=><div key={label} className="vc-stat"><small>{label}</small><strong>{submissions===null?'—':value}</strong><small>{note}</small></div>)}</div>
    <div className="vc-layout"><section aria-label="Upcoming client events">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}><h2 className="vc-section-title">Upcoming weddings &amp; events</h2><span className="vc-muted">{submissions===null?'Loading…':clients.length+' events'}</span></div>
      <div className="vc-toolbar"><button className="vc-filter" aria-pressed={filter==='all'} onClick={()=>setScope('all')}>All upcoming</button><button className="vc-filter" aria-pressed={filter==='attention'} onClick={()=>setScope('attention')}>Needs attention</button><button className="vc-filter" aria-pressed={filter==='soon'} onClick={()=>setScope('soon')}>Next 60 days</button><input aria-label="Search clients" placeholder="Search names or dates…" value={query} onChange={e=>{setQuery(e.target.value);setAll(false);}}/></div>
      {submissions===null ? <div role="status" className="vc-empty">Loading client events…</div> : shown.length===0 ? <div className="vc-empty">{clients.length?'No events match this view.':'No upcoming client events yet.'}{clients.length>0&&<div><button className="vc-text-button" onClick={()=>{setQuery('');setScope('all');}}>Show all upcoming events</button></div>}</div> : shown.map(c=>{
        const pastDue=c.duePayments.find(p=>p.due && p.due<today), next=c.duePayments[0];
        return <article key={c.id} className="vc-card" data-venue-state={c.tasks.some(t=>t.overdue) ? "overdue" : c.tasks.some(t=>t.urgent) ? "attention" : "ready"}><div className="vc-card-head"><div className="vc-date"><small>{c.eventDate ? new Date(c.eventDate+'T12:00:00').toLocaleDateString('en-US',{month:'short'}) : 'Date'}</small><strong>{c.eventDate?Number(c.eventDate.slice(8,10)):'?'}</strong></div><div className="vc-head-main"><h3 className="vc-name">{c.name}</h3><div className="vc-muted">{dateLabel(c.eventDate)}{c.eventEnd && c.eventEnd!==c.eventDate?' – '+dateLabel(c.eventEnd):''} · {c.type}{c.days!==null?' · '+(c.days>0?c.days+' days away':c.days===0?'Today':'In progress'):''}</div></div><button className="vc-open" onClick={()=>open(c)} aria-label={'View details for '+c.name}>View details</button></div>
          <div className="vc-card-body"><div><div className="vc-label">Agreement</div><span className={'vc-pill '+(c.signatures ? c.unsigned.length?(c.unsigned.some(s=>s.signee_type==='vendor')?'danger':'alert'):'good':'')}>{c.nativeAgreement && ['declined','expired'].includes(c.nativeAgreement.status) ? (c.nativeAgreement.status==='declined'?'Revision declined':'Signing request expired') : c.signatures ? c.unsigned.length?'Signature pending':'Fully signed':'Not on file'}</span>{c.unsigned.map((s,i)=><div key={i} className="vc-muted" style={{marginTop:5}}>{s.signee_type==='vendor'?'Venue':'Client'} · {s.signee_name}</div>)}</div>
          <div><div className="vc-label">Payments</div>{c.payments ? <><div className="vc-payment-amount">{amount(c.paid,c.currency)} <span className="vc-muted">of {amount(c.total,c.currency)}</span></div><div className="vc-progress" role="progressbar" aria-label="Invoice paid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.total ? Math.round(c.paid/c.total*100):0}><span style={{width:Math.max(0,Math.min(100,c.total?c.paid/c.total*100:0))+'%'}}/></div><div className="vc-muted">{c.balance===0?'Paid in full':amount(c.balance,c.currency)+' remaining'}</div>{pastDue&&<span className="vc-pill danger" style={{marginTop:7}}>Payment past due</span>}</> : <div className="vc-muted">Schedule not yet recorded</div>}</div>
          <div><div className="vc-label">Final details</div><div className="vc-line"><span className={'vc-dot '+(c.surveyComplete?'good':'')}/>{c.surveyComplete?'Questionnaire complete':c.surveySent?'Questionnaire in progress':'Questionnaire to collect'}</div><div className="vc-line"><span className={'vc-dot '+(c.insuranceVerified?'good':'')}/>{c.insuranceVerified?'Insurance on file':'Insurance to verify'}</div></div></div>
          <div className="vc-card-foot"><span>{next ? (pastDue?'Past due: ':'Next payment: ')+amount(next.cents,next.currency)+(next.due?' · '+dateLabel(next.due):'') : c.payments?'No remaining scheduled payments':'Review booking paperwork'}</span><span>{c.requirementsDue?'Final details due '+dateLabel(c.requirementsDue):'Event date to confirm'}</span></div>
        </article>;
      })}
      {matches.length>4&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span className="vc-muted">Showing {shown.length} of {matches.length}</span><button className="vc-text-button" onClick={()=>setAll(!all)}>{all?'Show fewer events':'View all '+matches.length+' events ↓'}</button></div>}
    </section><aside className="vc-sidebar" aria-label="Client priorities and upcoming deadlines">
      <section className="vc-side-card priority"><h2 className="vc-side-title">Needs your attention <span className="vc-counter">{submissions===null?'—':urgent.length}</span></h2><div className="vc-muted">Past due first, then signatures and approaching deadlines.</div>{submissions===null?<p className="vc-muted">Loading priorities…</p>:urgent.length===0?<p className="vc-muted">No urgent items recorded.</p>:(allTasks?urgent:urgent.slice(0,6)).map(t=><button className="vc-task" key={t.key} onClick={()=>open(t.client)}><div className="vc-task-head">{t.title}</div><div className="vc-task-name">{t.client.name}</div><div className={'vc-task-date '+(t.overdue?'late':'')}>{t.due?(t.overdue?'Past due · ':'Due ')+dateLabel(t.due):t.detail}</div></button>)}{urgent.length>6&&<button className="vc-text-button" onClick={()=>setAllTasks(!allTasks)}>{allTasks?'Show fewer priorities':'See all '+urgent.length+' priorities ↓'}</button>}</section>
      <section className="vc-side-card"><h2 className="vc-side-title">Coming up next</h2><div className="vc-muted">Your next collection and planning deadlines.</div>{upcoming.slice(0,4).map(t=><button className="vc-task" key={t.key} onClick={()=>open(t.client)}><div className="vc-task-date">{dateLabel(t.due)}</div><div className="vc-task-head" style={{marginTop:4}}>{t.title}</div><div className="vc-task-name">{t.client.name}</div></button>)}{!upcoming.length&&<p className="vc-muted">No upcoming deadlines recorded.</p>}</section>
    </aside></div>
    {selectedClient&&<ClientDetail key={selectedClient.id} client={selectedClient} onClose={()=>setSelected(null)} onVerify={verifyInsurance} agreementApi={agreementApi} onContractsChange={rows=>setNativeVersions(prev=>[...prev.filter(v=>v.response_id!==selectedClient.id),...rows])}/>}
  </div>;
}
