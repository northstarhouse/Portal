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

// Clients booked before this date are grandfathered: no agreement to prepare or sign here, they just show as signed.
export const LEGACY_BEFORE = '2026-10-30';
const longDay = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
export function buildVenueClient(sub, live = null, today = venueDateKey(), nativeVersions = []) {
  const a = sub.answers || {}, hb = a.__honeybook, p = hb?.project || {};
  const insuranceCheck = a.__venue_checklist?.insurance;
  const insuranceVerified = !!live?.insurance_uploaded_at || (typeof insuranceCheck?.verified === 'boolean' && insuranceCheck.verified);
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
  const legacy = !nativeAgreement && !signatures && !!sub.created_at && String(sub.created_at).slice(0, 10) < LEGACY_BEFORE;
  const surveys = responses.filter(r => r.responses?.questionnaire && /(?:wedding|event) info questionnaire/i.test(r.title || ''));
  const surveyComplete = !!live?.questionnaire_form_response_id || surveys.some(r => { const qs = r.responses.questionnaire.questions || []; return qs.some(q => q.answered) && qs.filter(q => q.required).every(q => q.answered); });
  const surveySent = !!live?.questionnaire_sent_at || surveys.length > 0;
  const requirementsDue = eventDate ? shiftDate(eventDate, -30) : null;
  const formContacts = [['7fnabd0i','c9u1sxb4','163otrai','ps4addr1'], ['7leui2ic','pt4mail1','pt4phon1','pt4addr1']].filter(k => a[k[0]]).map((k, i) => ({ id:'form-' + i, full_name:a[k[0]], email:a[k[1]] || '', phone_number:a[k[2]] || '', address:a[k[3]] || '', kind:'client' }));
  const contacts = (hb?.contacts || []).filter(c => c.kind === 'client').concat(hb?.contacts?.some(c => c.kind === 'client') ? [] : formContacts);
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
  if (!hb && !nativeAgreement && !legacy) task('booking', 'New pre-booking submission', null, (eventDate ? 'Event ' + longDay(eventDate) + ' · ' : '') + 'Review it and prepare the agreement', 'booking');
  if (!surveyComplete) task('survey', surveySent ? 'Complete event questionnaire' : 'Event questionnaire', requirementsDue, surveySent ? 'Sent; awaiting required answers' : 'Not yet on file', 'survey');
  if (!insuranceVerified) task('insurance', 'Confirm insurance on file', requirementsDue, 'Coverage not verified in the portal', 'insurance');
  if (!eventDate) task('date', 'Confirm event date', null, 'No date recorded', 'booking');
  tasks.sort((x, y) => x.rank - y.rank || (x.due || eventDate || '9999').localeCompare(y.due || eventDate || '9999'));
  return { id:sub.id, sub, name, email, contacts, hb, eventDate, eventEnd, nativeAgreement, legacy, type: sub.form_id === 'a3a383f7-e1db-4344-9dec-ea879ad3406d' || /wedding/i.test(p.name || live?.event_type || sub.form_name || '') ? 'Wedding' : live?.event_type || 'Private event', days:eventDate ? dayCount(today, eventDate) : null, payments, schedule, duePayments, signatures, unsigned, surveyComplete, surveySent, insuranceVerified, insuranceCheck, insuranceUploadedAt:live?.insurance_uploaded_at || null,insuranceDriveUrl:live?.insurance_drive_url || null, brickLines:Array.isArray(live?.brick_lines) ? live.brick_lines : null, brickSubmittedAt:live?.brick_submitted_at || null, requirementsDue, tasks, urgent:tasks.filter(t => t.urgent), currency, total:payments?.total?.amount ?? null, paid:payments?.amount_paid?.amount ?? null, balance:payments?.balance_due?.amount ?? null, sourceUrl:hb?.workspace?.id && p.id ? 'https://app.honeybook.com/app/event/' + encodeURIComponent(p.id) + '/workspace/' + encodeURIComponent(hb.workspace.id) + '/activity' : null };
}

const css = `
.vc-dashboard{color:#302e29;font-size:13px;min-width:0}.vc-dashboard button,.vc-dialog button{font:inherit;cursor:pointer}.vc-dashboard button:focus-visible,.vc-dashboard input:focus-visible,.vc-dialog button:focus-visible,.vc-dialog a:focus-visible{outline:2px solid #886c44;outline-offset:3px}.vc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 24px}.vc-stat{background:#fff;border:1px solid #e8e0d5;border-radius:12px;padding:18px}.vc-stat small,.vc-muted{color:#666;font-size:12px;line-height:1.5}.vc-stat strong{display:block;font-family:Cardo,Georgia,serif;font-size:30px;line-height:1.2;margin:8px 0 3px}.vc-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.vc-section-title{font-family:Cardo,Georgia,serif;font-size:20px;font-weight:700;margin:0}.vc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0}.vc-toolbar input{border:1px solid #ded7cb;background:white;border-radius:7px;padding:9px 11px;min-width:150px;flex:1;max-width:230px;font:inherit}.vc-filter-select{border:1px solid #ded7cb;background:white;border-radius:7px;padding:9px 11px;font:inherit;font-size:12px;color:#333;cursor:pointer}.vc-filter{border:1px solid #e3dcd0;background:transparent;color:#6f685c;border-radius:20px;padding:7px 11px;font-size:11px!important}.vc-filter[aria-pressed=true]{background:#886c44;border-color:#886c44;color:white}.vc-card{border:1px solid #e6dfd3;border-radius:12px;background:white;margin-bottom:14px;overflow:hidden}.vc-card-head{padding:18px 20px 16px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #ccc}.vc-date{background:#f8f4ed;border:1px solid #ebe2d4;width:49px;flex-shrink:0;border-radius:9px;text-align:center;padding:7px 0}.vc-date small{display:block;color:#886c44;font-size:10px;text-transform:uppercase;font-weight:700}.vc-date strong{display:block;font-family:Cardo,Georgia,serif;font-size:22px;line-height:1.2}.vc-name{font-family:Cardo,Georgia,serif;font-size:19px;font-weight:700;margin:0 0 4px;overflow-wrap:anywhere}.vc-head-main{flex:1;min-width:0}.vc-open{background:none;border:0;color:#2a5a8a;padding:5px;font-weight:600!important;font-size:12px!important;font-style:italic;white-space:nowrap}.vc-card-body{display:grid;grid-template-columns:1.05fr 1.3fr 1fr;gap:22px;padding:17px 20px 20px}.vc-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#555;margin-bottom:9px}.vc-pill{display:inline-block;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;background:#eee;color:#333;border:1px solid #ccc;line-height:1.45}.vc-pill.good{background:#edf4ed;color:#426b4a;border-color:#426b4a}.vc-pill.alert{background:#faf0e6;color:#9a5d22;border-color:#9a5d22}.vc-pill.danger{background:#f9eae7;color:#a64f3c;border-color:#a64f3c}.vc-progress{height:5px;background:#f0ece5;border-radius:4px;overflow:hidden;margin:9px 0}.vc-progress span{display:block;height:100%;background:#6b8c6c;border-radius:4px}.vc-payment-amount{font-size:16px;font-weight:600}.vc-line{display:flex;align-items:center;gap:7px;font-size:12px;color:#625e56;margin:7px 0}.vc-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#aaa}.vc-check{color:#2e7d4f;font-weight:700;font-size:12px;flex-shrink:0}.vc-dot.good{background:#6b8c6c}.vc-card-foot{background:#fcfaf6;border-top:1px solid #f0ebe3;padding:10px 20px;display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#817867}.vc-sidebar{display:flex;flex-direction:column;gap:18px}.vc-side-card{background:#fff;border:1px solid #e6dfd3;border-radius:12px;padding:18px}.vc-side-card.priority{border:2px solid #c0392b}.vc-side-title{font-family:Cardo,Georgia,serif;font-weight:700;font-size:18px;margin:0 0 4px}.vc-side-card.priority .vc-side-title{color:#c0392b}.vc-side-card.priority .vc-task{border-bottom-color:rgba(192,57,43,0.4)}.vc-task{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1.5px solid #ddd0c0;padding:14px 0!important;color:inherit}.vc-task:last-child{border-bottom:0}.vc-task-head{font-size:12px;font-weight:600;line-height:1.5}.vc-task-name{font-size:12.5px;font-weight:600;color:#4a453e;margin:4px 0;line-height:1.4}.vc-task-date{font-size:10px;color:#886c44}.vc-task-date.late{color:#ad503b}.vc-text-button{background:transparent;border:0;color:#886c44;font-weight:600!important;padding:10px 0!important;font-size:12px!important}.vc-empty{border:1px dashed #dcd3c4;border-radius:10px;padding:30px;text-align:center;color:#817b70;line-height:1.7;background:#fff}.vc-footer-note{font-size:11px;color:#8a8378;line-height:1.6;margin-top:18px}.vc-dialog{border:1px solid #e1d7c8;border-radius:16px;padding:0;width:min(850px,calc(100vw - 28px));max-height:90vh;color:#302e29;box-shadow:0 24px 80px #29211630}.vc-dialog::backdrop{background:#24211e77}.vc-modal-head{display:flex;align-items:start;gap:15px;padding:24px;border-bottom:1px solid #eee7dd;position:sticky;top:0;background:white;z-index:1}.vc-modal-body{padding:24px}.vc-modal-body h3{font-family:Cardo,Georgia,serif;font-size:18px;margin:24px 0 12px}.vc-modal-body h3:first-child{margin-top:0}.vc-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.vc-contact{border:1px solid #eee7dd;border-radius:8px;padding:13px;overflow-wrap:anywhere}.vc-dialog a{color:#886c44}.vc-table{width:100%;border-collapse:collapse;font-size:12px}.vc-table td,.vc-table th{text-align:left;border-bottom:1px solid #eee7dd;padding:10px 6px}.vc-table th{font-size:10px;color:#877b68;text-transform:uppercase;letter-spacing:.5px}.vc-history{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7;background:#faf8f3;padding:16px;border-radius:8px;max-height:450px;overflow:auto}.vc-modal-body summary{cursor:pointer;color:#886c44;font-size:13px;font-weight:600;padding:14px 0}.vc-counter{background:#c0392b;color:#fff;border-radius:20px;padding:3px 7px;font:700 11px system-ui;margin-left:6px}.vc-modal-section{border:1px solid #e6dfd3;border-radius:10px;padding:16px;margin-top:20px}.vc-modal-body>.vc-modal-section:first-child{margin-top:0}.vc-modal-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;font-family:Cardo,Georgia,serif;font-size:16px;font-weight:700}.vc-timeline-item{display:flex;gap:12px;position:relative;padding-bottom:16px}.vc-timeline-item:last-child{padding-bottom:0}.vc-timeline-dot{width:12px;height:12px;border-radius:50%;background:#aaa;flex-shrink:0;margin-top:2px;position:relative;z-index:1}.vc-timeline-dot.good{background:#6b8c6c}.vc-timeline-dot.danger{background:#a64f3c}.vc-timeline-line{position:absolute;left:5px;top:14px;bottom:0;width:2px;background:#e6dfd3}.vc-timeline-item:last-child .vc-timeline-line{display:none}.vc-timeline-content{flex:1;min-width:0;padding-bottom:2px}.vc-note-box{background:#faf8f3;border:1px solid #eee7dd;border-radius:7px;padding:10px;font-size:12px;color:#4a453e;white-space:pre-wrap;margin-top:8px}.vc-hstepper{display:flex;align-items:flex-start;padding:16px 24px 18px;gap:0;overflow-x:auto;border-bottom:1px solid #eee7dd}.vc-hstep{display:flex;flex-direction:column;align-items:center;flex:1;min-width:84px;position:relative}.vc-hstep-dot{width:22px;height:22px;border-radius:50%;background:#f0ece5;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#999;z-index:1;flex-shrink:0}.vc-hstep-dot.good{background:#6b8c6c;border-color:#6b8c6c;color:#fff}.vc-hstep-dot.danger{background:#a64f3c;border-color:#a64f3c;color:#fff}.vc-hstep-line{position:absolute;top:10px;left:-50%;width:100%;height:2px;background:#e6dfd3;z-index:0}.vc-hstep-line.good{background:#6b8c6c}.vc-hstep:first-child .vc-hstep-line{display:none}.vc-hstep-label{font-size:10.5px;font-weight:600;margin-top:6px;text-align:center;line-height:1.3}.vc-hstep-amt{font-size:10px;color:#777;margin-top:2px}
.vc-sidebar{position:sticky;top:110px}@media(max-width:1100px){.vc-layout{grid-template-columns:minmax(0,1fr)}.vc-sidebar{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:650px){.vc-stats{grid-template-columns:1fr 1fr;gap:8px}.vc-stat{padding:13px}.vc-stat strong{font-size:25px}.vc-card-head{padding:15px 13px;gap:10px;flex-wrap:wrap}.vc-card-body{grid-template-columns:1fr 1fr;gap:18px;padding:16px 13px}.vc-card-body>div:last-child{grid-column:1/-1}.vc-card-foot{padding:10px 13px;flex-wrap:wrap}.vc-sidebar{grid-template-columns:1fr}.vc-name{font-size:17px}.vc-contact-grid{grid-template-columns:1fr}.vc-modal-head,.vc-modal-body{padding:18px}.vc-toolbar input{max-width:none;width:100%;flex-basis:100%}}
`;

function InsuranceVerification({ client, onVerify }) {
  const [note,setNote] = React.useState(client.insuranceCheck?.note || '');
  const [editingNote,setEditingNote] = React.useState(false);
  const [saving,setSaving] = React.useState(false), [error,setError] = React.useState(''), [saved,setSaved] = React.useState(false);
  async function save(verified, nextNote) {
    if (saving) return;
    setSaving(true);setError('');setSaved(false);
    try { await onVerify(client.id,verified,nextNote===undefined?note:nextNote);setSaved(true);setEditingNote(false); }
    catch(e) { setError(e.message || 'Could not save insurance verification.'); }
    finally { setSaving(false); }
  }
  return <div className="vc-modal-section" aria-labelledby="vc-insurance-title">
    <div className="vc-modal-section-title"><span id="vc-insurance-title">Insurance</span><span className={'vc-pill '+(client.insuranceVerified?'good':'alert')}>{client.insuranceUploadedAt?'Uploaded on Client Portal':client.insuranceVerified?'Verified on file':'Needs verification'}</span></div>
    <p className="vc-muted" style={{marginTop:0}}>{client.insuranceUploadedAt ? 'Uploaded '+dateLabel(client.insuranceUploadedAt)+' by the client.' : client.insuranceVerified ? (client.insuranceCheck?.verified_at ? 'Verified '+dateLabel(client.insuranceCheck.verified_at)+'.' : 'Certificate received '+dateLabel(client.insuranceUploadedAt)+'.') : 'After reviewing the certificate, mark it verified here—even if it was received by email or in HoneyBook.'}</p>
    {client.insuranceUploadedAt && client.insuranceDriveUrl && <p><a href={client.insuranceDriveUrl} target="_blank" rel="noopener noreferrer">View in client folder on Google Drive ↗</a></p>}
    {!client.insuranceUploadedAt && client.sourceUrl && <p><a href={client.sourceUrl} target="_blank" rel="noopener noreferrer">Review documents in HoneyBook ↗</a></p>}
    {editingNote ? (
      <>
        <textarea aria-label="Insurance verification note" autoFocus value={note} onChange={e=>{setNote(e.target.value);setSaved(false);}} disabled={saving} maxLength={2000} rows={2} placeholder="For example: certificate received by email; reviewed coverage and event date." style={{display:'block',width:'100%',marginTop:4,border:'1px solid #ded7cb',borderRadius:7,padding:10,font:'inherit',resize:'vertical'}}/>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button type="button" disabled={saving} onClick={()=>save(client.insuranceVerified,note)} style={{border:'none',borderRadius:7,padding:'7px 13px',background:'#886c44',color:'#fff',fontSize:12,fontWeight:600,opacity:saving?.6:1}}>{saving?'Saving…':'Save note'}</button>
          <button type="button" disabled={saving} onClick={()=>{setEditingNote(false);setNote(client.insuranceCheck?.note||'');}} style={{border:'1px solid #ded7cb',borderRadius:7,padding:'7px 13px',background:'#fff',color:'#6f685c',fontSize:12}}>Cancel</button>
        </div>
      </>
    ) : (
      <>
        {note && <div className="vc-note-box">{note}</div>}
        <button type="button" onClick={()=>setEditingNote(true)} style={{marginTop:8,border:'1px solid #e0d8cc',borderRadius:6,padding:'5px 10px',background:'#fff',color:'#886c44',fontSize:11,fontWeight:600}}>{note?'Edit note':'+ Add note'}</button>
      </>
    )}
    {!client.insuranceUploadedAt && <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:12}}><button type="button" disabled={saving || !onVerify} onClick={()=>save(!client.insuranceVerified)} style={{border:client.insuranceVerified?'1px solid #ded7cb':'1px solid #886c44',borderRadius:7,padding:'9px 13px',background:client.insuranceVerified?'white':'#886c44',color:client.insuranceVerified?'#6f685c':'white',opacity:saving?.6:1}}>{saving?'Saving…':client.insuranceVerified?'Undo verification':'Mark insurance verified'}</button>{saved&&<span role="status" className="vc-muted">{client.insuranceVerified?'Verification saved.':'Verification removed.'}</span>}</div>}
    {error&&<p role="alert" style={{fontSize:12,color:'#a64f3c',marginBottom:0}}>{error}</p>}
  </div>;
}

function ClientDetail({ client, onClose, onVerify, agreementApi, onContractsChange }) {
  const ref = React.useRef(null);
  React.useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="vc-dialog" aria-labelledby="vc-client-title" onCancel={onClose} onClick={e => { if(e.target === ref.current) onClose(); }}>
    <div className="vc-modal-head"><div style={{flex:1}}><h2 id="vc-client-title" className="vc-name" style={{fontSize:25,margin:0}}>{client.name} - {client.type}</h2><div style={{fontFamily:'Cardo,Georgia,serif',fontSize:22,fontWeight:700,color:'#886c44',marginTop:6}}>{dateLabel(client.eventDate)}</div></div><button className="vc-open" onClick={onClose} aria-label="Close client details">Close ×</button></div>
    {client.payments && <div className="vc-hstepper" aria-label="Payment timeline">
      {client.schedule.map((s,i) => {
        const pastDue = s.due && s.due < venueDateKey() && !s.paid;
        const state = s.paid ? 'good' : pastDue ? 'danger' : '';
        return <div className="vc-hstep" key={i}>
          <span className={'vc-hstep-line '+state}/>
          <span className={'vc-hstep-dot '+state}>{s.paid ? '✓' : (i+1)}</span>
          <div className="vc-hstep-label">{s.label}</div>
          <div className="vc-hstep-amt">{amount(s.cents,s.currency)}</div>
        </div>;
      })}
      <div className="vc-hstep">
        <span className="vc-hstep-line good"/>
        <span className="vc-hstep-dot" style={{background:'#886c44',borderColor:'#886c44',color:'#fff'}}>$</span>
        <div className="vc-hstep-label">Total</div>
        <div className="vc-hstep-amt" style={{fontWeight:700,color:'#4a453e'}}>{amount(client.total,client.currency)}</div>
      </div>
    </div>}
    <div className="vc-modal-body">
      <div className="vc-modal-section">
        <div className="vc-modal-section-title">Contacts</div>
        <div className="vc-contact-grid">{(client.contacts.length ? client.contacts : [{full_name:client.name,email:client.email}]).map((c,i) => <div key={c.id || i} className="vc-contact"><strong>{c.full_name}</strong><div className="vc-muted">{c.email && <a href={'mailto:'+c.email}>{c.email}</a>}</div><div className="vc-muted">{c.phone_number || 'Phone not recorded'}</div>{c.address && <div className="vc-muted">{c.address}</div>}</div>)}</div>
      </div>
      <InsuranceVerification client={client} onVerify={onVerify}/>
      <div className="vc-modal-section" aria-labelledby="vc-brick-title">
        <div className="vc-modal-section-title"><span id="vc-brick-title">Wedding brick</span><span className={'vc-pill '+(client.brickLines?.some(l => String(l).trim())?'good':'alert')}>{client.brickLines?.some(l => String(l).trim())?'Wording submitted':'Not submitted yet'}</span></div>
        {client.brickLines?.some(l => String(l).trim()) ? <><div style={{fontFamily:'Cardo,Georgia,serif',letterSpacing:2,lineHeight:1.9,background:'#faf8f3',border:'1px solid #eee7dd',borderRadius:7,padding:'10px 14px'}}>{client.brickLines.map((l,i) => <div key={i}>{l || ' '}</div>)}</div>{client.brickSubmittedAt && <p className="vc-muted" style={{marginBottom:0}}>Submitted {dateLabel(client.brickSubmittedAt.slice(0,10))}</p>}</> : <p className="vc-muted" style={{margin:0}}>The client chooses 3 lines of up to 20 characters on their event page.</p>}
      </div>
      {agreementApi&&<ContractManager client={client} api={agreementApi} onChange={onContractsChange}/>}
      <div className="vc-modal-section">
        <div className="vc-modal-section-title">Payment timeline</div>
        {client.payments ? <>
          <p className="vc-muted" style={{marginTop:0}}>{amount(client.paid,client.currency)} paid · {amount(client.balance,client.currency)} remaining · {amount(client.total,client.currency)} invoice total</p>
          <div>{client.schedule.map((s,i) => {
            const pastDue = s.due && s.due < venueDateKey() && !s.paid;
            const state = s.paid ? 'good' : pastDue ? 'danger' : '';
            return <div className="vc-timeline-item" key={i}>
              <div style={{position:'relative'}}><span className={'vc-timeline-dot '+state}/><span className="vc-timeline-line"/></div>
              <div className="vc-timeline-content">
                <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
                  <strong style={{fontSize:13}}>{s.label}</strong>
                  <span className={'vc-pill '+state}>{s.paid?'Paid':pastDue?'Past due':'Scheduled'}</span>
                </div>
                <div className="vc-muted">{dateLabel(s.due)} · {amount(s.cents,s.currency)}</div>
              </div>
            </div>;
          })}</div>
          <p className="vc-muted" style={{marginBottom:0}}>Original invoice schedule, including any security deposit. Payment names follow the source schedule order.</p>
        </> : <p className="vc-muted" style={{margin:0}}>A payment schedule has not been recorded.</p>}
      </div>
      <div className="vc-modal-section">
        <div className="vc-modal-section-title">Still to do</div>
        {client.tasks.length ? client.tasks.map(task => <div key={task.key} className="vc-task"><div className="vc-task-head">{task.title}</div><div className="vc-task-name">{task.detail}</div><div className={'vc-task-date '+(task.overdue?'late':'')}>{task.due ? (task.overdue?'Past due · ':'Due ') + dateLabel(task.due) : 'Awaiting completion'}</div></div>) : <p className="vc-muted" style={{margin:0}}>No outstanding items recorded.</p>}
      </div>
      {client.signatures && <div className="vc-modal-section">
        <div className="vc-modal-section-title">Contract signatures</div>
        {client.signatures.signatures.map((s,i) => <div className="vc-line" key={i}><span className={'vc-dot '+(s.signed?'good':'')}/><span>{s.signee_name} · {s.signed?'Signed '+dateLabel(s.signed_at):'Awaiting signature'}</span></div>)}
      </div>}
      <div className="vc-modal-section">
        <details><summary>Original forms, documents &amp; email history</summary><p className="vc-muted">The source record is preserved here for reference.</p><div className="vc-history">{client.sub.internal_notes || 'No history recorded.'}</div></details>
        {client.sourceUrl && <p style={{marginBottom:0}}><a href={client.sourceUrl} target="_blank" rel="noopener noreferrer">Open original HoneyBook project ↗</a></p>}
      </div>
    </div>
  </dialog>;
}

export function VenueClientDashboard({ submissions, loadEvents, saveInsurance, agreementApi, filter, setFilter, query, setQuery, loadClientMessages, onOpenMessages }) {
  const [events,setEvents] = React.useState([]), [error,setError] = React.useState('');
  const [clientMessages,setClientMessages] = React.useState([]);
  React.useEffect(() => { let off=false; if(loadClientMessages)loadClientMessages().then(rows=>{if(!off)setClientMessages(Array.isArray(rows)?rows:[]);}).catch(()=>{}); return () => {off=true;}; }, []);
  const [savedResponses,setSavedResponses] = React.useState({});
  const [nativeVersions,setNativeVersions] = React.useState([]);
  React.useEffect(()=>{let cancelled=false;function refresh(){if(agreementApi)agreementApi('summary').then(rows=>{if(!cancelled)setNativeVersions(rows);}).catch(()=>{if(!cancelled)setError('Live agreement status is unavailable. Showing the saved client records.');});}refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);};},[agreementApi]);
  const [allTasks,setAllTasks] = React.useState(false), [selected,setSelected] = React.useState(null);
  React.useEffect(() => { let cancelled=false; loadEvents().then(rows => {if(!cancelled)setEvents(rows);}).catch(() => {if(!cancelled)setError('Live requirement updates are unavailable. Showing the saved client records.');}); return()=>{cancelled=true;}; }, [loadEvents]);
  const today = venueDateKey();
  const clients = (submissions || []).map(sub => buildVenueClient(savedResponses[sub.id] ? {...sub,...savedResponses[sub.id]} : sub,events.find(e=>e.prebooking_form_response_id===sub.id),today,nativeVersions)).filter(c => !c.eventEnd || c.eventEnd >= today).sort((a,b)=>(a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
  const messageTasks = clientMessages.map(m=>({key:'msg-'+m.id,title:'New message from '+(m.from_name||'a client'),detail:String(m.body||'').replace(/\s+/g,' ').slice(0,70)+(String(m.body||'').length>70?'…':''),due:null,overdue:false,urgent:true,rank:0,kind:'message',client:{name:m.event_title||m.from_name||'Client',eventDate:null},action:()=>{const cid=String(m.event_uid||'').replace('client:','');if(submissions&&submissions.some(s=>s.id===cid))setSelected(cid);else if(onOpenMessages)onOpenMessages();}}));
  const urgent = messageTasks.concat(clients.flatMap(client=>client.urgent.map(task=>({...task,client})))).sort((a,b)=>a.rank-b.rank || (a.due || a.client.eventDate || '9999').localeCompare(b.due || b.client.eventDate || '9999'));
  const upcoming = clients.flatMap(client=>client.tasks.filter(t=>t.due && t.due>=today).map(task=>({...task,client}))).sort((a,b)=>a.due.localeCompare(b.due));
  const dueSoon = clients.flatMap(c=>c.duePayments).filter(p=>p.due && p.due<=shiftDate(today,30));
  const matches = clients.filter(c=>(filter!=='attention'||c.urgent.length>0)&&(!query || (c.name+' '+c.email+' '+c.eventDate).toLowerCase().includes(query.toLowerCase())));
  const shown = filter==='viewall' ? matches : matches.slice(0,4);
  const open = c => setSelected(c.id);
  // opened from an Activity Log entry
  React.useEffect(() => { const id = window.__nshOpenClient; if (id && submissions && submissions.some(sub => sub.id === id)) { setSelected(id); window.__nshOpenClient = null; } }, [submissions]);
  const selectedClient = clients.find(c=>c.id===selected);
  async function verifyInsurance(id,verified,note) {
    if (!saveInsurance) throw new Error('Insurance verification is unavailable. Please reload and try again.');
    const record = await saveInsurance(id,verified,note);
    setSavedResponses(prev=>({...prev,[id]:record}));
  }
  return <div className="vc-dashboard" style={{gridColumn:'1 / -1'}}>
    <style>{css}</style>
    {error && <p role="status" className="vc-pill alert">{error}</p>}
    <div className="vc-layout"><section aria-label="Upcoming client events">
      {submissions===null ? <div role="status" className="vc-empty">Loading client events…</div> : shown.length===0 ? <div className="vc-empty">{clients.length?'No events match this view.':'No upcoming client events yet.'}{clients.length>0&&<div><button className="vc-text-button" onClick={()=>{setQuery('');setFilter('all');}}>Show all upcoming events</button></div>}</div> : shown.map(c=>{
        const pastDue=c.duePayments.find(p=>p.due && p.due<today), next=c.duePayments[0];
        return <article key={c.id} className="vc-card" data-venue-state={c.tasks.some(t=>t.overdue) ? "overdue" : c.tasks.some(t=>t.urgent) ? "attention" : "ready"}><div className="vc-card-head"><div className="vc-date"><small>{c.eventDate ? new Date(c.eventDate+'T12:00:00').toLocaleDateString('en-US',{month:'short'}) : 'Date'}</small><strong>{c.eventDate?Number(c.eventDate.slice(8,10)):'?'}</strong></div><div className="vc-head-main"><h3 className="vc-name">{c.name}</h3><div className="vc-muted">{dateLabel(c.eventDate)}{c.eventEnd && c.eventEnd!==c.eventDate?' – '+dateLabel(c.eventEnd):''} · {c.type}{c.days!==null?' · '+(c.days>0?c.days+' days away':c.days===0?'Today':'In progress'):''}</div></div><button className="vc-open" onClick={()=>open(c)} aria-label={'View details for '+c.name}>View details</button></div>
          <div className="vc-card-body"><div><div className="vc-label">Agreement</div><span className={'vc-pill '+(c.signatures ? c.unsigned.length?(c.unsigned.some(s=>s.signee_type==='vendor')?'danger':'alert'):'good':c.legacy?'good':'')}>{c.nativeAgreement && ['declined','expired'].includes(c.nativeAgreement.status) ? (c.nativeAgreement.status==='declined'?'Revision declined':'Signing request expired') : c.signatures ? c.unsigned.length?'Signature pending':'Fully signed':c.legacy?'Signed':'Not on file'}</span>{c.unsigned.map((s,i)=><div key={i} className="vc-muted" style={{marginTop:5}}>{s.signee_type==='vendor'?'Venue':'Client'} · {s.signee_name}</div>)}</div>
          <div><div className="vc-label">Payments</div>{c.payments ? <><div className="vc-payment-amount">{amount(c.paid,c.currency)} <span className="vc-muted">of {amount(c.total,c.currency)}</span></div><div className="vc-progress" role="progressbar" aria-label="Invoice paid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.total ? Math.round(c.paid/c.total*100):0}><span style={{width:Math.max(0,Math.min(100,c.total?c.paid/c.total*100:0))+'%'}}/></div><div className="vc-muted">{c.balance===0?'Paid in full':amount(c.balance,c.currency)+' remaining'}</div>{pastDue&&<span className="vc-pill danger" style={{marginTop:7}}>Payment past due</span>}</> : <div className="vc-muted">Schedule not yet recorded</div>}</div>
          <div><div className="vc-label">Final details</div><div className="vc-line"><span className={'vc-dot '+(c.surveyComplete?'good':'')}/>{c.surveyComplete?'Questionnaire complete':c.surveySent?'Questionnaire in progress':'Questionnaire to collect'}</div><div className="vc-line"><span className={'vc-dot '+(c.insuranceVerified?'good':'')}/>{c.insuranceVerified?'Insurance on file':'Insurance to verify'}</div></div></div>
          <div className="vc-card-foot" style={(!next && c.payments && c.surveyComplete && c.insuranceVerified && c.unsigned.length===0) ? {justifyContent:'flex-end'} : undefined}>{(!next && c.payments && c.surveyComplete && c.insuranceVerified && c.unsigned.length===0) ? <span>✓ All Requirements Met</span> : <><span>{next ? (pastDue?'Past due: ':'Next payment: ')+amount(next.cents,next.currency)+(next.due?' · '+dateLabel(next.due):'') : c.payments?'✓ All Payments Collected':'Review booking paperwork'}</span><span>{c.surveyComplete && c.insuranceVerified ? '✓ All Details Collected' : c.requirementsDue?'Final details due '+dateLabel(c.requirementsDue):'Event date to confirm'}</span></>}</div>
        </article>;
      })}
    </section><aside className="vc-sidebar" aria-label="Client priorities">
      <section className="vc-side-card priority"><h2 className="vc-side-title">Needs your attention <span className="vc-counter">{submissions===null?'—':urgent.length}</span></h2>{submissions===null?<p className="vc-muted">Loading priorities…</p>:urgent.length===0?<p className="vc-muted">No urgent items recorded.</p>:(allTasks?urgent:urgent.slice(0,6)).map(t=><button className="vc-task" key={t.key} onClick={()=>t.action?t.action():open(t.client)}><div className="vc-task-head">{t.title}</div><div className="vc-task-name">{t.client.name}</div><div className={'vc-task-date '+(t.overdue?'late':'')}>{t.due?(t.overdue?'Past due · ':'Due ')+dateLabel(t.due):t.detail}</div></button>)}{urgent.length>6&&<button className="vc-text-button" onClick={()=>setAllTasks(!allTasks)}>{allTasks?'Show fewer priorities':'See all '+urgent.length+' priorities ↓'}</button>}</section>
    </aside></div>
    {selectedClient&&<ClientDetail key={selectedClient.id} client={selectedClient} onClose={()=>setSelected(null)} onVerify={verifyInsurance} agreementApi={agreementApi} onContractsChange={rows=>setNativeVersions(prev=>[...prev.filter(v=>v.response_id!==selectedClient.id),...rows])}/>}
  </div>;
}
