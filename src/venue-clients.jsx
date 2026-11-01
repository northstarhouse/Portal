import { ContractManager } from './venue-contracts.jsx';
import { openSitePacket } from './site-packet.js';
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

// Payments received outside this system (for clients booked before it existed), kept beside the form response.
// list: [{ id, cents, date: 'YYYY-MM-DD', note }]
export async function saveVenueManualPayments({ baseUrl, apiKey, request = fetch }, responseId, list) {
  if (!responseId || !Array.isArray(list)) throw new Error('Choose a client.');
  const headers = { apikey:apiKey, Authorization:'Bearer '+apiKey, 'Content-Type':'application/json' };
  const resource = baseUrl + '/rest/v1/nsh_form_responses?id=eq.' + encodeURIComponent(responseId);
  async function readResponse(res) {
    if (!res.ok) throw new Error('Payments could not be saved. Please try again.');
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Client record is unavailable or you do not have permission to update it.');
    return rows[0];
  }
  const current = await readResponse(await request(resource+'&select=id,form_id,answers', {headers}));
  if (!['a3a383f7-e1db-4344-9dec-ea879ad3406d','668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'].includes(current.form_id)) throw new Error('This record is not a venue client.');
  const clean = list.map(p => ({ id:String(p.id), cents:Math.round(Number(p.cents)), date:String(p.date || '').slice(0,10), note:String(p.note || '').trim().slice(0,200) })).filter(p => p.cents > 0);
  const answers = { ...current.answers, __venue_checklist:{ ...current.answers?.__venue_checklist, manual_payments:clean } };
  const saved = await readResponse(await request(resource+'&form_id=eq.'+encodeURIComponent(current.form_id), {method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({answers})}));
  if ((saved.answers?.__venue_checklist?.manual_payments || []).length !== clean.length) throw new Error('Payments were not saved. Please try again.');
  return saved;
}

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
  const baseSchedule = (payments?.schedule || []).map((payment, index) => ({ ...payment, cents: payment.amount?.amount || 0, currency: payment.amount?.currency || currency, label: payment.__nativeLabel || (index === 0 ? 'Booking payment' : 'Scheduled payment ' + (index + 1)), due: payment.due_date?.slice(0, 10) || null })).sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999'));
  // Payments logged by hand are applied to the unpaid scheduled payments in date order.
  const manualPayments = Array.isArray(a.__venue_checklist?.manual_payments) ? a.__venue_checklist.manual_payments.filter(p => p && p.cents > 0) : [];
  const manualTotal = manualPayments.reduce((sum, p) => sum + p.cents, 0);
  let manualLeft = manualTotal;
  const schedule = baseSchedule.map(s => { if (s.paid || !(s.cents > 0) || manualLeft < s.cents) return s; manualLeft -= s.cents; return { ...s, paid: true, manual: true }; });
  const duePayments = schedule.filter(s => !s.paid);
  const legacy = !nativeAgreement && !!sub.created_at && String(sub.created_at).slice(0, 10) < LEGACY_BEFORE;
  const unsigned = legacy ? [] : (signatures?.signatures?.filter(s => s.required && !s.signed) || []);
  const surveys = responses.filter(r => r.responses?.questionnaire && /(?:wedding|event) info questionnaire/i.test(r.title || ''));
  const surveyComplete = !!live?.questionnaire_form_response_id || surveys.some(r => { const qs = r.responses.questionnaire.questions || []; return qs.some(q => q.answered) && qs.filter(q => q.required).every(q => q.answered); });
  const surveySent = !!live?.questionnaire_sent_at || surveys.length > 0;
  // Everything the couple answered on the day-of questionnaire, for the Site Manager packet.
  const questionnaire = live?.questionnaire_answers && typeof live.questionnaire_answers === 'object' ? live.questionnaire_answers : null;
  const hbQa = responses.filter(r => r.responses?.questionnaire).flatMap(r => (r.responses.questionnaire.questions || []).map(q => ({ label: text(q.question), answer: q.answer })));
  const requirementsDue = eventDate ? shiftDate(eventDate, -30) : null;
  const formContacts = [['7fnabd0i','c9u1sxb4','163otrai','ps4addr1'], ['7leui2ic','pt4mail1','pt4phon1','pt4addr1']].filter(k => a[k[0]]).map((k, i) => ({ id:'form-' + i, full_name:a[k[0]], email:a[k[1]] || '', phone_number:a[k[2]] || '', address:a[k[3]] || '', kind:'client' }));
  const contacts = (hb?.contacts || []).filter(c => c.kind === 'client').concat(hb?.contacts?.some(c => c.kind === 'client') ? [] : formContacts);
  const name = (p.name || live?.name || a['7fnabd0i'] || a.evp_name || 'Client').replace(/\s*\([SJ]\)\s*$/i, '').replace(/\s+Wedding\s*$/i, '').trim();
  const email = a.c9u1sxb4 || a.evp_email || contacts[0]?.email;
  const tasks = [];
  function task(key, title, due, detail, kind) {
    const overdue = !!due && due < today;
    const soon = !!due && due <= shiftDate(today, 30);
    // Needs attention only when something is behind or actually needs action now: late items, a missing signature, a new
    // pre-booking submission, or the questionnaire once the event is within 60 days. A payment that is simply coming up is not.
    const daysOut = eventDate ? dayCount(today, eventDate) : null;
    const needsAction = overdue || kind === 'signature' || kind === 'booking' || (kind === 'survey' && daysOut !== null && daysOut <= 60);
    tasks.push({ key: sub.id + '-' + key, title, due, detail, kind, overdue, urgent: needsAction, rank: overdue ? 0 : kind === 'signature' || kind === 'booking' ? 1 : soon ? 2 : 3 });
  }
  for (const payment of duePayments) task('payment-' + schedule.indexOf(payment), 'Collect ' + amount(payment.cents, payment.currency), payment.due, payment.label, 'payment');
  if (nativeAgreement && ['declined','expired'].includes(nativeAgreement.status)) task('contract-revision','Prepare revised agreement',null,'Previous request '+nativeAgreement.status,'booking');
  else for (const [index, s] of unsigned.entries()) task('signature-' + index, s.signee_type === 'vendor' ? 'Venue countersignature' : 'Client signature', null, s.signee_name || 'Required signer', 'signature');
  if (!hb && !nativeAgreement && !legacy) task('booking', 'New pre-booking submission', null, (eventDate ? 'Event ' + longDay(eventDate) + ' · ' : '') + 'Review it and prepare the agreement', 'booking');
  if (!surveyComplete) task('survey', surveySent ? 'Complete event questionnaire' : 'Event questionnaire', requirementsDue, surveySent ? 'Sent; awaiting required answers' : 'Not yet on file', 'survey');
  if (!insuranceVerified) task('insurance', 'Confirm insurance on file', requirementsDue, 'Coverage not verified in the portal', 'insurance');
  if (!eventDate) task('date', 'Confirm event date', null, 'No date recorded', 'booking');
  tasks.sort((x, y) => x.rank - y.rank || (x.due || eventDate || '9999').localeCompare(y.due || eventDate || '9999'));
  const siteManager = a.__venue_checklist?.site_manager?.name || '';
  return { id:sub.id, sub, name, email, contacts, siteManager, questionnaire, hbQa, hb, eventDate, eventEnd, nativeAgreement, legacy, type: sub.form_id === 'a3a383f7-e1db-4344-9dec-ea879ad3406d' || /wedding/i.test(p.name || live?.event_type || sub.form_name || '') ? 'Wedding' : live?.event_type || 'Private event', days:eventDate ? dayCount(today, eventDate) : null, payments, schedule, duePayments, signatures, unsigned, surveyComplete, surveySent, insuranceVerified, insuranceCheck, insuranceUploadedAt:live?.insurance_uploaded_at || null,insuranceDriveUrl:live?.insurance_drive_url || null, brickLines:Array.isArray(live?.brick_lines) ? live.brick_lines : null, brickSubmittedAt:live?.brick_submitted_at || null, requirementsDue, tasks, urgent:tasks.filter(t => t.urgent), currency, total:payments?.total?.amount ?? null, paid:payments ? (payments.amount_paid?.amount ?? 0) + manualTotal : (manualTotal || null), balance:payments?.balance_due?.amount != null ? Math.max(0, payments.balance_due.amount - manualTotal) : null, manualPayments, sourceUrl:hb?.workspace?.id && p.id ? 'https://app.honeybook.com/app/event/' + encodeURIComponent(p.id) + '/workspace/' + encodeURIComponent(hb.workspace.id) + '/activity' : null };
}

const css = `
.vc-dashboard{color:#302e29;font-size:13px;min-width:0}.vc-dashboard button,.vc-dialog button{font:inherit;cursor:pointer}.vc-dashboard button:focus-visible,.vc-dashboard input:focus-visible,.vc-dialog button:focus-visible,.vc-dialog a:focus-visible{outline:2px solid #886c44;outline-offset:3px}.vc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 24px}.vc-stat{background:#fff;border:1px solid #e8e0d5;border-radius:12px;padding:18px}.vc-stat small,.vc-muted{color:#666;font-size:12px;line-height:1.5}.vc-stat strong{display:block;font-family:Cardo,Georgia,serif;font-size:30px;line-height:1.2;margin:8px 0 3px}.vc-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.vc-section-title{font-family:Cardo,Georgia,serif;font-size:20px;font-weight:700;margin:0}.vc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0}.vc-toolbar input{border:1px solid #ded7cb;background:white;border-radius:7px;padding:9px 11px;min-width:150px;flex:1;max-width:230px;font:inherit}.vc-filter-select{border:1px solid #ded7cb;background:white;border-radius:7px;padding:9px 11px;font:inherit;font-size:12px;color:#333;cursor:pointer}.vc-filter{border:1px solid #e3dcd0;background:transparent;color:#6f685c;border-radius:20px;padding:7px 11px;font-size:11px!important}.vc-filter[aria-pressed=true]{background:#886c44;border-color:#886c44;color:white}.vc-card{border:1px solid #e6dfd3;border-radius:12px;background:white;margin-bottom:14px;overflow:hidden}.vc-card-head{padding:18px 20px 16px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #ccc}.vc-date{background:#f8f4ed;border:1px solid #ebe2d4;width:49px;flex-shrink:0;border-radius:9px;text-align:center;padding:7px 0}.vc-date small{display:block;color:#886c44;font-size:10px;text-transform:uppercase;font-weight:700}.vc-date strong{display:block;font-family:Cardo,Georgia,serif;font-size:22px;line-height:1.2}.vc-name{font-family:Cardo,Georgia,serif;font-size:19px;font-weight:700;margin:0 0 4px;overflow-wrap:anywhere}.vc-head-main{flex:1;min-width:0}.vc-open{background:none;border:0;color:#2a5a8a;padding:5px;font-weight:600!important;font-size:12px!important;font-style:italic;white-space:nowrap}.vc-card-body{display:grid;grid-template-columns:1.05fr 1.3fr 1fr;gap:22px;padding:17px 20px 20px}.vc-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#555;margin-bottom:9px}.vc-pill{display:inline-block;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;background:#eee;color:#333;border:1px solid #ccc;line-height:1.45}.vc-pill.good{background:#edf4ed;color:#426b4a;border-color:#426b4a}.vc-pill.alert{background:#faf0e6;color:#9a5d22;border-color:#9a5d22}.vc-pill.danger{background:#f9eae7;color:#a64f3c;border-color:#a64f3c}.vc-progress{height:5px;background:#f0ece5;border-radius:4px;overflow:hidden;margin:9px 0}.vc-progress span{display:block;height:100%;background:#6b8c6c;border-radius:4px}.vc-payment-amount{font-size:16px;font-weight:600}.vc-line{display:flex;align-items:center;gap:7px;font-size:12px;color:#625e56;margin:7px 0}.vc-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#aaa}.vc-check{color:#2e7d4f;font-weight:700;font-size:12px;flex-shrink:0}.vc-dot.good{background:#6b8c6c}.vc-card-foot{background:#fcfaf6;border-top:1px solid #f0ebe3;padding:10px 20px;display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#817867}.vc-sidebar{display:flex;flex-direction:column;gap:18px}.vc-side-card{background:#fff;border:1px solid #e6dfd3;border-radius:12px;padding:18px}.vc-side-card.priority{border:2px solid #c0392b}.vc-side-title{font-family:Cardo,Georgia,serif;font-weight:700;font-size:18px;margin:0 0 4px}.vc-side-card.priority .vc-side-title{color:#c0392b}.vc-side-card.priority .vc-task{border-bottom-color:rgba(192,57,43,0.4)}.vc-task{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1.5px solid #ddd0c0;padding:14px 0!important;color:inherit}.vc-task:last-child{border-bottom:0}.vc-task-head{font-size:12px;font-weight:600;line-height:1.5}.vc-task-name{font-size:12.5px;font-weight:600;color:#4a453e;margin:4px 0;line-height:1.4}.vc-task-date{font-size:10px;color:#886c44}.vc-task-date.late{color:#ad503b}.vc-text-button{background:transparent;border:0;color:#886c44;font-weight:600!important;padding:10px 0!important;font-size:12px!important}.vc-empty{border:1px dashed #dcd3c4;border-radius:10px;padding:30px;text-align:center;color:#817b70;line-height:1.7;background:#fff}.vc-footer-note{font-size:11px;color:#8a8378;line-height:1.6;margin-top:18px}.vc-dialog{border:1px solid #e1d7c8;border-radius:16px;padding:0;width:min(850px,calc(100vw - 28px));max-height:90vh;color:#302e29;box-shadow:0 24px 80px #29211630}.vc-dialog::backdrop{background:#24211e77}.vc-modal-head{display:flex;align-items:start;gap:15px;padding:24px;border-bottom:1px solid #eee7dd;position:sticky;top:0;background:white;z-index:1}.vc-modal-body{padding:24px}.vc-modal-body h3{font-family:Cardo,Georgia,serif;font-size:18px;margin:24px 0 12px}.vc-modal-body h3:first-child{margin-top:0}.vc-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.vc-contact{border:1px solid #eee7dd;border-radius:8px;padding:13px;overflow-wrap:anywhere}.vc-dialog a{color:#886c44}.vc-table{width:100%;border-collapse:collapse;font-size:12px}.vc-table td,.vc-table th{text-align:left;border-bottom:1px solid #eee7dd;padding:10px 6px}.vc-table th{font-size:10px;color:#877b68;text-transform:uppercase;letter-spacing:.5px}.vc-history{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7;background:#faf8f3;padding:16px;border-radius:8px;max-height:450px;overflow:auto}.vc-modal-body summary{cursor:pointer;color:#886c44;font-size:13px;font-weight:600;padding:14px 0}.vc-counter{background:#c0392b;color:#fff;border-radius:20px;padding:3px 7px;font:700 11px system-ui;margin-left:6px}.vc-modal-section{border:1px solid #e6dfd3;border-radius:10px;padding:16px;margin-top:20px}.vc-modal-body>.vc-modal-section:first-child{margin-top:0}.vc-modal-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;font-family:Cardo,Georgia,serif;font-size:16px;font-weight:700}.vc-timeline-item{display:flex;gap:12px;position:relative;padding-bottom:16px}.vc-timeline-item:last-child{padding-bottom:0}.vc-timeline-dot{width:12px;height:12px;border-radius:50%;background:#aaa;flex-shrink:0;margin-top:2px;position:relative;z-index:1}.vc-timeline-dot.good{background:#6b8c6c}.vc-timeline-dot.danger{background:#a64f3c}.vc-timeline-line{position:absolute;left:5px;top:14px;bottom:0;width:2px;background:#e6dfd3}.vc-timeline-item:last-child .vc-timeline-line{display:none}.vc-timeline-content{flex:1;min-width:0;padding-bottom:2px}.vc-note-box{background:#faf8f3;border:1px solid #eee7dd;border-radius:7px;padding:10px;font-size:12px;color:#4a453e;white-space:pre-wrap;margin-top:8px}.vc-hstepper{display:flex;align-items:flex-start;padding:16px 24px 18px;gap:0;overflow-x:auto;background:#f8f4ec;border-top:1px solid #eee7dd;border-bottom:1px solid #e6ded0;box-shadow:inset 0 1px 3px rgba(136,108,68,.08)}.vc-hstep{display:flex;flex-direction:column;align-items:center;flex:1;min-width:84px;position:relative}.vc-hstep-dot{width:22px;height:22px;border-radius:50%;background:#f0ece5;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#999;z-index:1;flex-shrink:0}.vc-hstep-dot.good{background:#6b8c6c;border-color:#6b8c6c;color:#fff}.vc-hstep-dot.danger{background:#a64f3c;border-color:#a64f3c;color:#fff}.vc-hstep-line{position:absolute;top:10px;left:-50%;width:100%;height:2px;background:#e6dfd3;z-index:0}.vc-hstep-line.good{background:#6b8c6c}.vc-hstep:first-child .vc-hstep-line{display:none}.vc-hstep-label{font-size:10.5px;font-weight:600;margin-top:6px;text-align:center;line-height:1.3}.vc-hstep-amt{font-size:10px;color:#777;margin-top:2px}
.vc-sidebar{position:sticky;top:110px}@media(max-width:1100px){.vc-layout{grid-template-columns:minmax(0,1fr)}.vc-sidebar{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:650px){.vc-stats{grid-template-columns:1fr 1fr;gap:8px}.vc-stat{padding:13px}.vc-stat strong{font-size:25px}.vc-card-head{padding:15px 13px;gap:10px;flex-wrap:wrap}.vc-card-body{grid-template-columns:1fr 1fr;gap:18px;padding:16px 13px}.vc-card-body>div:last-child{grid-column:1/-1}.vc-card-foot{padding:10px 13px;flex-wrap:wrap}.vc-sidebar{grid-template-columns:1fr}.vc-name{font-size:17px}.vc-contact-grid{grid-template-columns:1fr}.vc-modal-head,.vc-modal-body{padding:18px}.vc-toolbar input{max-width:none;width:100%;flex-basis:100%}}
`;

// Assign a site manager to a wedding. Saved on the client's own record, beside the other checklist items.
async function saveSiteManager(responseId, name) {
  if (!responseId) throw new Error('Choose a client.');
  const headers = { apikey: PB_KEY, Authorization: 'Bearer ' + PB_KEY, 'Content-Type': 'application/json' };
  const resource = PB_URL + '/rest/v1/nsh_form_responses?id=eq.' + encodeURIComponent(responseId);
  const cur = await fetch(resource + '&select=id,form_id,answers', { headers });
  const rows = cur.ok ? await cur.json() : null;
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Client record is unavailable or you do not have permission to update it.');
  const who = String(name || '').trim().slice(0, 80);
  const checklist = { ...(rows[0].answers?.__venue_checklist || {}) };
  if (who) checklist.site_manager = { name: who, assigned_at: new Date().toISOString() }; else delete checklist.site_manager;
  const answers = { ...rows[0].answers, __venue_checklist: checklist };
  const res = await fetch(resource + '&form_id=eq.' + encodeURIComponent(rows[0].form_id), { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ answers }) });
  const saved = res.ok ? await res.json() : null;
  if (!Array.isArray(saved) || saved.length !== 1) throw new Error('The site manager could not be saved. Please try again.');
  return saved[0];
}

// A list of every upcoming wedding with a site manager dropdown on each, and an export.
function SiteManagersPage({ clients, today, onBack, onAssign }) {
  const [managers, setManagers] = React.useState(null);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const H = { apikey: PB_KEY, Authorization: 'Bearer ' + PB_KEY, 'Content-Type': 'application/json' };
  const loadManagers = () => fetch(PB_URL + '/rest/v1/venue_site_managers?select=name&order=name', { headers: H }).then(r => r.ok ? r.json() : []).then(rows => setManagers((rows || []).map(x => x.name))).catch(() => setManagers([]));
  React.useEffect(() => { loadManagers(); }, []);
  const weddings = clients.filter(c => c.type === 'Wedding' && c.eventDate && c.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const options = name => { const list = managers || []; return name && !list.includes(name) ? [name, ...list] : list; };
  async function assign(c, name) {
    setBusy(c.id); setErr('');
    try { await onAssign(c.id, name); } catch (e) { setErr(e.message || 'Could not save.'); } finally { setBusy(''); }
  }
  async function addManager(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setErr('');
    const r = await fetch(PB_URL + '/rest/v1/venue_site_managers', { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ name }) });
    if (!r.ok) { setErr('Could not add that name.'); return; }
    setNewName(''); loadManagers();
  }
  async function removeManager(name) {
    if (!window.confirm('Remove ' + name + ' from the list? Weddings already assigned to them keep their name.')) return;
    await fetch(PB_URL + '/rest/v1/venue_site_managers?name=eq.' + encodeURIComponent(name), { method: 'DELETE', headers: H });
    loadManagers();
  }
  function exportList() {
    const cell = v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const rows = [['Event date', 'Client', 'Event', 'Site manager', 'Phone', 'Email']].concat(weddings.map(c => [
      longDay(c.eventDate), c.name, c.type, c.siteManager || 'Unassigned',
      (c.contacts && c.contacts[0] && c.contacts[0].phone) || '', c.email || '',
    ]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(cell).join(',')).join(String.fromCharCode(10))], { type: 'text/csv' }));
    a.download = 'site-managers-' + today + '.csv';
    a.click();
  }
  const field = { padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
  return <div>
    <button className="vc-text-button" onClick={onBack} style={{marginBottom:12}}>← Back to clients</button>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:6}}>
      <h2 style={{margin:0,fontFamily:'Cardo,Georgia,serif',fontSize:24}}>Assign Site Managers</h2>
      <button onClick={exportList} disabled={!weddings.length} style={{background:'#886c44',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600}}>Export list</button>
    </div>
    <p className="vc-muted" style={{marginTop:0}}>Every upcoming wedding. Choose a site manager for each one and it is saved to the client's profile.</p>
    {err && <p role="status" className="vc-pill alert">{err}</p>}
    <div style={{background:'#fff',border:'1px solid #eee7dd',borderRadius:12,overflowX:'auto'}}>
      {managers === null ? <p className="vc-muted" style={{padding:16}}>Loading…</p> : weddings.length === 0 ? <p className="vc-muted" style={{padding:16}}>No upcoming weddings.</p> :
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{textAlign:'left',color:'#888',fontSize:11,textTransform:'uppercase',letterSpacing:.4}}>{['Date','Couple','Site manager','Packet'].map(h => <th key={h} style={{padding:'10px 14px',borderBottom:'1px solid #eee7dd'}}>{h}</th>)}</tr></thead>
          <tbody>{weddings.map(c => <tr key={c.id} style={{borderBottom:'1px solid #f3eee5'}}>
            <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>{longDay(c.eventDate)}</td>
            <td style={{padding:'10px 14px',fontWeight:600}}>{c.name}</td>
            <td style={{padding:'10px 14px'}}><select value={c.siteManager || ''} disabled={busy === c.id} onChange={e => assign(c, e.target.value)} aria-label={'Site manager for ' + c.name} style={{...field,minWidth:170,color:c.siteManager?'#2a2420':'#999'}}>
              <option value="">Unassigned</option>
              {options(c.siteManager).map(n => <option key={n} value={n}>{n}</option>)}
            </select></td>
            <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}><a onClick={() => openSitePacket(c)} style={{color:'#886c44',fontWeight:700,textDecoration:'underline',cursor:'pointer'}}>Print</a>{!c.surveyComplete && <span className="vc-muted" style={{marginLeft:8,fontSize:11}}>questionnaire not in yet</span>}</td>
          </tr>)}</tbody>
        </table>}
    </div>
    <div style={{marginTop:16}}>
      <div className="vc-label" style={{marginBottom:6}}>Site managers in the list</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
        {(managers || []).map(n => <span key={n} style={{display:'inline-flex',alignItems:'center',gap:6,background:'#f3ead9',color:'#6b5d4a',borderRadius:14,padding:'4px 10px',fontSize:12,fontWeight:600}}>{n}<a onClick={() => removeManager(n)} title={'Remove ' + n} style={{cursor:'pointer',color:'#b3402a'}}>✕</a></span>)}
        <form onSubmit={addManager} style={{display:'inline-flex',gap:6}}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add a name" style={{...field,width:150}} />
          <button type="submit" style={{background:'none',border:'0.5px solid #e0d8cc',borderRadius:8,padding:'6px 12px',fontWeight:600,color:'#886c44'}}>Add</button>
        </form>
      </div>
    </div>
  </div>;
}

// The pre-booking form the couple filled in, shown question by question (read-only) in their file.
const PB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', PB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
function PreBookingFormView({ client, open, setOpen }) {
  const [fields, setFields] = React.useState(null);
  React.useEffect(() => {
    if (!open || fields || !client.sub?.form_id) return;
    fetch(PB_URL + '/rest/v1/nsh_forms?select=title,fields&id=eq.' + encodeURIComponent(client.sub.form_id), { headers: { apikey: PB_KEY, Authorization: 'Bearer ' + PB_KEY } })
      .then(r => r.ok ? r.json() : []).then(rows => setFields(Array.isArray(rows?.[0]?.fields) ? rows[0].fields : [])).catch(() => setFields([]));
  }, [open]);
  const a = client.sub?.answers || {};
  const show = v => Array.isArray(v) ? v.filter(x => x !== '' && x != null).map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ') : (v && typeof v === 'object') ? Object.entries(v).filter(([, x]) => x !== '' && x != null).map(([k, x]) => k + ': ' + x).join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v ?? '').trim();
  const sections = [];
  (fields || []).forEach(f => {
    const value = show(a[f.id]);
    if (!value || f.type === 'heading' || f.type === 'divider') return;
    const name = f.section || 'Details';
    let sec = sections.find(x => x.name === name);
    if (!sec) { sec = { name, rows: [] }; sections.push(sec); }
    sec.rows.push({ label: f.label || f.id, value });
  });
  if (!client.sub?.answers) return null;
  return <div className="vc-modal-section" id="vc-prebooking">
    <div className="vc-modal-section-title"><span>Pre-booking form</span><button type="button" className="vc-open" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'View the form they filled in'}</button></div>
    {open && (fields === null ? <p className="vc-muted">Loading…</p> : !sections.length ? <p className="vc-muted">No answers on file.</p> : sections.map(sec => <div key={sec.name} style={{marginTop:12}}>
      <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#886c44',marginBottom:6}}>{sec.name}</div>
      {sec.rows.map((r, i) => <div key={i} style={{display:'flex',gap:12,padding:'6px 0',borderTop:'1px solid #f0ebe2'}}><div style={{flex:'0 0 38%',color:'#888'}}>{r.label}</div><div style={{flex:1,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{r.value}</div></div>)}
    </div>))}
  </div>;
}

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

// Clients booked before this system: payments received elsewhere are logged here by hand.
function ManualPayments({ client, onSave }) {
  const [amt,setAmt] = React.useState(''), [date,setDate] = React.useState(venueDateKey()), [note,setNote] = React.useState('');
  const [busy,setBusy] = React.useState(false), [err,setErr] = React.useState('');
  const list = client.manualPayments || [];
  async function save(next) { setBusy(true); setErr(''); try { await onSave(client.id, next); } catch(e) { setErr(e.message || 'Could not save.'); } finally { setBusy(false); } }
  async function add(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(String(amt).replace(/[^0-9.]/g,'')) * 100);
    if (!(cents > 0)) { setErr('Enter the amount received.'); return; }
    await save([...list, { id:String(Date.now()), cents, date, note }]);
    setAmt(''); setNote('');
  }
  const inp = {border:'1px solid #ded7cb',borderRadius:7,padding:'8px 10px',font:'inherit',background:'#fff'};
  return <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #eee7dd'}}>
    <div className="vc-label" style={{marginBottom:6}}>Payments received (logged by hand)</div>
    {list.length===0 ? <p className="vc-muted" style={{margin:'0 0 8px'}}>None logged yet. Add a payment when one comes in; it is applied to the next unpaid payment.</p> : list.map(p => <div key={p.id} className="vc-line" style={{justifyContent:'space-between'}}>
      <span>{amount(p.cents,'USD')} · {dateLabel(p.date)}{p.note?' · '+p.note:''}</span>
      <button type="button" disabled={busy} onClick={()=>{ if (window.confirm('Remove this logged payment?')) save(list.filter(x=>x.id!==p.id)); }} style={{border:'none',background:'none',color:'#a64f3c',fontSize:12}}>Remove</button>
    </div>)}
    <form onSubmit={add} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
      <input aria-label="Amount received" inputMode="decimal" placeholder="Amount ($)" value={amt} onChange={e=>setAmt(e.target.value)} style={{...inp,width:120}}/>
      <input aria-label="Date received" type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp}/>
      <input aria-label="Note" placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)} style={{...inp,flex:1,minWidth:140}}/>
      <button type="submit" disabled={busy} style={{border:'none',borderRadius:7,padding:'9px 14px',background:'#886c44',color:'#fff',fontSize:12,fontWeight:600}}>{busy?'Saving…':'Log payment'}</button>
    </form>
    {err&&<p role="alert" style={{fontSize:12,color:'#a64f3c',marginBottom:0}}>{err}</p>}
  </div>;
}

function ClientDetail({ client, onClose, onVerify, onSavePayments, agreementApi, onContractsChange, messages, onHandleMessage }) {
  const ref = React.useRef(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [tl, setTl] = React.useState({ tour: null, sentAt: null, loaded: false });
  // The tour and the "client guide + pre-booking form" email, found by the couple's email addresses.
  React.useEffect(() => {
    let off = false;
    const emails = [...new Set([client.email, ...(client.contacts || []).map(c => c.email)].filter(Boolean).map(e => String(e).trim().toLowerCase().replace(/[,()"]/g, '')))];
    if (!emails.length) { setTl({ tour: null, sentAt: null, loaded: true }); return; }
    const H = { apikey: PB_KEY, Authorization: 'Bearer ' + PB_KEY };
    const get = url => fetch(PB_URL + url, { headers: H }).then(r => r.ok ? r.json() : []).catch(() => []);
    Promise.all([
      get('/rest/v1/estate_tours?select=date,status,prebooking_form_sent_at&status=eq.booked&order=date.desc&limit=5&or=' + encodeURIComponent('(' + emails.map(e => 'visitor_email.ilike.' + e).join(',') + ')')),
      get('/rest/v1/prebooking_form_sends?select=sent_at&order=sent_at.desc&limit=1&or=' + encodeURIComponent('(' + emails.map(e => 'email.ilike.' + e).join(',') + ')')),
      get('/rest/v1/prebooking_manual_sends?select=sent_at&order=sent_at.desc&limit=1&or=' + encodeURIComponent('(' + emails.map(e => 'email.ilike.' + e).join(',') + ')')),
    ]).then(([tours, sends, manual]) => {
      if (off) return;
      setTl({ tour: tours[0] || null, sentAt: sends[0]?.sent_at || manual[0]?.sent_at || (tours.find(t => t.prebooking_form_sent_at) || {}).prebooking_form_sent_at || null, loaded: true });
    });
    return () => { off = true; };
  }, [client.id]);
  const today = venueDateKey();
  const steps = [];
  const step = (label, done, when, extra, late) => steps.push({ label, done: !!done, when, extra, late: !!late });
  const tourPast = !!tl.tour && tl.tour.date <= today;
  step('Toured venue', tourPast, tl.tour ? (tourPast ? dateLabel(tl.tour.date) : 'Tour booked ' + dateLabel(tl.tour.date)) : (tl.loaded ? 'No tour on file' : ''));
  step('Received Client Guide and Pre-Booking Form', !!tl.sentAt || !!client.sub?.created_at, tl.sentAt ? 'Sent ' + dateLabel(tl.sentAt) : (tl.loaded ? 'Send date not on file' : ''));
  const hasForm = !!client.sub?.answers && Object.keys(client.sub.answers).some(k => !k.startsWith('__'));
  step('Filled out Pre-Booking Form', !!client.sub?.created_at, client.sub?.created_at ? dateLabel(client.sub.created_at) : '', hasForm ? <a onClick={() => { setFormOpen(true); setTimeout(() => { const el = ref.current && ref.current.querySelector('#vc-prebooking'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); }} style={{color:'#886c44',fontWeight:700,textDecoration:'underline',cursor:'pointer'}}>View form</a> : null);
  const sigs = client.signatures?.signatures || [];
  const clientSigs = sigs.filter(x => x.signee_type !== 'vendor'), venueSigs = sigs.filter(x => x.signee_type === 'vendor');
  const lastSigned = list => list.map(x => x.signed_at).filter(Boolean).sort().pop();
  step('Agreement sent', client.legacy || !!client.nativeAgreement, client.legacy ? 'Signed before the new system' : client.nativeAgreement?.issued_at ? dateLabel(client.nativeAgreement.issued_at) : 'Not sent yet');
  const clientsSigned = client.legacy || (clientSigs.length > 0 && clientSigs.every(x => x.signed));
  step('Clients signed', clientsSigned, client.legacy ? '' : clientsSigned ? dateLabel(lastSigned(clientSigs)) : clientSigs.length ? clientSigs.filter(x => x.signed).length + ' of ' + clientSigs.length + ' signed' : 'Waiting on the agreement');
  const venueSigned = client.legacy || (venueSigs.length > 0 && venueSigs.every(x => x.signed));
  step('Venue countersigned', venueSigned, client.legacy ? '' : venueSigned ? dateLabel(lastSigned(venueSigs)) : 'Waiting on the clients');
  (client.schedule || []).forEach((p, i) => {
    // The first payment is due the moment both clients have signed, not on a calendar date.
    if (i === 0 && !client.legacy) {
      step(p.label + ' · ' + amount(p.cents, p.currency), p.paid, p.paid ? 'Paid' : clientsSigned ? 'Due now' : 'Due when both clients sign', null, !p.paid && clientsSigned);
      return;
    }
    const late = !p.paid && p.due && p.due < today;
    step(p.label + ' · ' + amount(p.cents, p.currency), p.paid, p.paid ? 'Paid' : p.due ? (late ? 'Past due · ' : 'Due ') + dateLabel(p.due) : 'Awaiting payment', null, late);
  });
  step('Insurance verified', client.insuranceVerified, client.insuranceVerified ? 'Verified' : client.insuranceUploadedAt ? 'Uploaded ' + dateLabel(client.insuranceUploadedAt) + ', needs checking' : 'Not uploaded yet');
  step('Event questionnaire', client.surveyComplete, client.surveyComplete ? 'Completed' : client.surveySent ? 'Sent, awaiting answers' : 'Not sent yet', null, !client.surveyComplete && client.requirementsDue && client.requirementsDue < today);
  step('Site Manager Packet', client.surveyComplete, client.surveyComplete ? (client.siteManager ? 'Ready to print · ' + client.siteManager : 'Ready to print, no site manager assigned yet') : 'Waiting on the questionnaire', client.surveyComplete ? <a onClick={() => openSitePacket(client)} style={{color:'#886c44',fontWeight:700,textDecoration:'underline',cursor:'pointer'}}>Print</a> : null);
  step('Wedding brick', !!client.brickSubmittedAt || (client.brickLines || []).length > 0, client.brickSubmittedAt ? dateLabel(client.brickSubmittedAt) : 'Not submitted yet');
  if (client.eventDate) step('Event day', client.days !== null && client.days <= 0, dateLabel(client.eventDate));
  React.useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="vc-dialog" aria-labelledby="vc-client-title" onCancel={onClose} onClick={e => { if(e.target === ref.current) onClose(); }}>
    <div className="vc-modal-head"><div style={{flex:1}}><h2 id="vc-client-title" className="vc-name" style={{fontSize:25,margin:0}}>{client.name} - {client.type}</h2>{client.siteManager&&<div style={{marginTop:4,fontSize:13,color:'#6b5d4a'}}>Site manager: <strong style={{color:'#2a2420'}}>{client.siteManager}</strong></div>}<div style={{marginTop:8}}><button type="button" onClick={()=>openSitePacket(client)} style={{background:'#fff',color:'#886c44',border:'0.5px solid #886c44',borderRadius:8,padding:'6px 12px',fontWeight:600}}>Print Site Manager Packet</button></div><div style={{fontFamily:'Cardo,Georgia,serif',fontSize:22,fontWeight:700,color:'#886c44',marginTop:6}}>{dateLabel(client.eventDate)}</div></div><button className="vc-open" onClick={onClose} aria-label="Close client details">Close ×</button></div>
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
        <span className={"vc-hstep-line "+((client.schedule||[]).length && client.schedule.every(s=>s.paid)?"good":"")}/>
        <span className="vc-hstep-dot" style={{background:'#886c44',borderColor:'#886c44',color:'#fff'}}>$</span>
        <div className="vc-hstep-label">Total</div>
        <div className="vc-hstep-amt" style={{fontWeight:700,color:'#4a453e'}}>{amount(client.total,client.currency)}</div>
      </div>
    </div>}
    <div className="vc-modal-body">
      {client.arrangement==='bylt'&&<div className="vc-modal-section" style={{background:'#faf4e6',border:'1px solid #ecdcb8'}}>
        <div className="vc-modal-section-title">BYLT special arrangement</div>
        <p className="vc-muted" style={{margin:0}}>This group has a different agreement and payment plan. Those aren't set up in the Portal yet, so prepare them separately rather than sending the standard agreement.</p>
      </div>}
      <div className="vc-modal-section">
        <div className="vc-modal-section-title">Contacts</div>
        <div className="vc-contact-grid">{(client.contacts.length ? client.contacts : [{full_name:client.name,email:client.email}]).map((c,i) => <div key={c.id || i} className="vc-contact"><strong>{c.full_name}</strong><div className="vc-muted">{c.email && <a href={'mailto:'+c.email}>{c.email}</a>}</div><div className="vc-muted">{c.phone_number || 'Phone not recorded'}</div>{c.address && <div className="vc-muted">{c.address}</div>}</div>)}</div>
      </div>
      <div className="vc-modal-section">
        <div className="vc-modal-section-title">Timeline of Steps</div>
        {steps.map((st, i) => <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:i?'1px solid #f0ebe2':'none'}}>
          <span aria-hidden="true" style={{flex:'0 0 20px',height:20,borderRadius:'50%',display:'grid',placeItems:'center',fontSize:12,fontWeight:700,background:st.done?'#2e7d32':'#fff',color:'#fff',border:st.done?'none':'1.5px solid '+(st.late?'#c0392b':'#cfc6b6')}}>{st.done?'✓':''}</span>
          <div style={{flex:1,fontWeight:600,color:st.done?'#2a2420':'#555'}}>{st.label}{st.extra ? <span style={{fontWeight:400}}> – {st.extra}</span> : null}</div>
          <div style={{textAlign:'right',fontSize:12,color:st.late?'#c0392b':st.done?'#2e7d32':'#888'}}>{st.when}</div>
        </div>)}
      </div>
      <PreBookingFormView client={client} open={formOpen} setOpen={setFormOpen}/>
      <InsuranceVerification client={client} onVerify={onVerify}/>
      {messages&&messages.length>0&&<div className="vc-modal-section">
        <div className="vc-modal-section-title"><span>Messages from the couple</span><span className={'vc-pill '+(messages.some(m=>m.direction!=='outgoing'&&!m.handled_at)?'alert':'good')}>{messages.some(m=>m.direction!=='outgoing'&&!m.handled_at)?'New':'All handled'}</span></div>
        {messages.map(m=><div key={m.id} className="vc-note-box" style={{marginTop:8}}><div className="vc-muted" style={{marginBottom:4}}>{m.direction==='outgoing'?'Reply from '+(m.from_name||'the team'):(m.from_name||'Client')} · {new Date(m.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}{m.direction!=='outgoing'&&m.handled_at?' · handled'+(m.handled_by?' by '+m.handled_by:''):''}</div><div style={{whiteSpace:'pre-wrap'}}>{m.body}</div>{m.handled_note&&<div className="vc-muted" style={{marginTop:6,whiteSpace:'pre-wrap'}}><strong>Notes:</strong> {m.handled_note}</div>}{m.direction!=='outgoing'&&!m.handled_at&&onHandleMessage&&<button type="button" onClick={()=>{const who=window.prompt('Handled by (Jen, Derek or Haley)?');if(who&&/^(jen|derek|haley)$/i.test(who.trim()))onHandleMessage(m.id,who.trim().charAt(0).toUpperCase()+who.trim().slice(1).toLowerCase());else if(who)alert('Please enter Jen, Derek or Haley.');}} style={{marginTop:8,border:'1px solid #e0d8cc',borderRadius:6,padding:'5px 10px',background:'#fff',color:'#886c44',fontSize:11,fontWeight:600}}>Mark handled</button>}</div>)}
      </div>}
      <div className="vc-modal-section" aria-labelledby="vc-brick-title">
        <div className="vc-modal-section-title"><span id="vc-brick-title">Wedding brick</span><span className={'vc-pill '+(client.brickLines?.some(l => String(l).trim())?'good':'alert')}>{client.brickLines?.some(l => String(l).trim())?'Wording submitted':'Not submitted yet'}</span></div>
        {client.brickLines?.some(l => String(l).trim()) ? <><div style={{fontFamily:'Cardo,Georgia,serif',letterSpacing:2,lineHeight:1.9,background:'#faf8f3',border:'1px solid #eee7dd',borderRadius:7,padding:'10px 14px'}}>{client.brickLines.map((l,i) => <div key={i}>{l || ' '}</div>)}</div>{client.brickSubmittedAt && <p className="vc-muted" style={{marginBottom:0}}>Submitted {dateLabel(client.brickSubmittedAt.slice(0,10))}</p>}</> : <p className="vc-muted" style={{margin:0}}>The client chooses 3 lines of up to 20 characters on their event page.</p>}
      </div>
      {agreementApi&&(client.legacy
        ? <div style={{opacity:.4,pointerEvents:'none',userSelect:'none'}} aria-disabled="true"><div className="vc-modal-section"><div className="vc-modal-section-title"><span>Agreement</span><span className="vc-pill good">Signed</span></div><p className="vc-muted" style={{margin:0}}>Booked before this system. The signed agreement is on file, so nothing is managed here.</p></div></div>
        : <ContractManager client={client} api={agreementApi} onChange={onContractsChange}/>)}
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
                {client.legacy&&!s.paid&&i===client.schedule.findIndex(x=>!x.paid)&&onSavePayments&&<button type="button" onClick={async()=>{if(!window.confirm('Mark '+s.label+' ('+amount(s.cents,s.currency)+') as paid? Nobody is notified.'))return;try{await onSavePayments(client.id,[...(client.manualPayments||[]),{id:String(Date.now()),cents:s.cents,date:venueDateKey(),note:s.label}]);}catch(e){alert(e.message||'Could not save.');}}} style={{marginTop:6,border:'1px solid #886c44',borderRadius:6,padding:'4px 12px',background:'#fff',color:'#886c44',fontSize:11,fontWeight:600}}>Mark paid</button>}
              </div>
            </div>;
          })}</div>
          <p className="vc-muted" style={{marginBottom:0}}>Original invoice schedule, including any security deposit. Payment names follow the source schedule order.</p>
        </> : <p className="vc-muted" style={{margin:0}}>A payment schedule has not been recorded.</p>}
        {client.legacy&&<ManualPayments client={client} onSave={onSavePayments}/>}
      </div>
      {client.signatures && !client.legacy && <div className="vc-modal-section">
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

export function VenueClientDashboard({ submissions, loadEvents, saveInsurance, savePayments, agreementApi, filter, setFilter, query, setQuery, messages, currentMessages, onHandleMessage, onOpenMessages }) {
  const [events,setEvents] = React.useState([]), [error,setError] = React.useState('');
  const [showSite,setShowSite] = React.useState(false);
  const clientMessages = currentMessages || (messages||[]).filter(m=>m.direction!=='outgoing'&&!m.handled_at);
  const [savedResponses,setSavedResponses] = React.useState({});
  const [nativeVersions,setNativeVersions] = React.useState([]);
  React.useEffect(()=>{let cancelled=false;function refresh(){if(agreementApi)agreementApi('summary').then(rows=>{if(!cancelled)setNativeVersions(rows);}).catch(()=>{if(!cancelled)setError('Live agreement status is unavailable. Showing the saved client records.');});}refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);};},[agreementApi]);
  const [allTasks,setAllTasks] = React.useState(false), [selected,setSelected] = React.useState(null);
  React.useEffect(() => { let cancelled=false; loadEvents().then(rows => {if(!cancelled)setEvents(rows);}).catch(() => {if(!cancelled)setError('Live requirement updates are unavailable. Showing the saved client records.');}); return()=>{cancelled=true;}; }, [loadEvents]);
  const today = venueDateKey();
  // Groups sent the pre-booking form by hand with a special arrangement (BYLT), found again by their email address.
  const [arrangements,setArrangements] = React.useState({});
  React.useEffect(()=>{let off=false;fetch(PB_URL+'/rest/v1/prebooking_manual_sends?select=email,arrangement&order=sent_at.desc&limit=500',{headers:{apikey:PB_KEY,Authorization:'Bearer '+PB_KEY}}).then(r=>r.ok?r.json():[]).then(rows=>{if(off)return;const m={};(rows||[]).forEach(x=>{const k=String(x.email||'').toLowerCase();if(k&&(!m[k]||x.arrangement==='bylt'))m[k]=x.arrangement;});setArrangements(m);}).catch(()=>{});return()=>{off=true;};},[]);
  const withArrangement = c => {
    const emails = [c.email, ...(c.contacts||[]).map(x=>x.email)].filter(Boolean).map(e=>String(e).trim().toLowerCase());
    const arrangement = emails.map(e=>arrangements[e]).find(a=>a&&a!=='standard') || null;
    if (arrangement !== 'bylt') return c;
    // A BYLT group has a different agreement and payment plan, so the usual "prepare the agreement" step is worded for that.
    const tasks = c.tasks.map(t => t.kind==='booking' ? {...t, title:'BYLT pre-booking submission', detail:(c.eventDate?'Event '+longDay(c.eventDate)+' · ':'')+'Review it. Their agreement and payments are arranged separately.'} : t);
    return {...c, arrangement, tasks, urgent: tasks.filter(t=>t.urgent)};
  };
  const clients = (submissions || []).map(sub => withArrangement(buildVenueClient(savedResponses[sub.id] ? {...sub,...savedResponses[sub.id]} : sub,events.find(e=>e.prebooking_form_response_id===sub.id),today,nativeVersions))).filter(c => !c.eventEnd || c.eventEnd >= today).sort((a,b)=>(a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
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
  async function recordPayments(id,list) {
    if (!savePayments) throw new Error('Saving payments is unavailable. Please reload and try again.');
    const record = await savePayments(id,list);
    setSavedResponses(prev=>({...prev,[id]:record}));
  }
  async function assignSite(id,name) {
    const record = await saveSiteManager(id,name);
    setSavedResponses(prev=>({...prev,[id]:record}));
  }
  async function verifyInsurance(id,verified,note) {
    if (!saveInsurance) throw new Error('Insurance verification is unavailable. Please reload and try again.');
    const record = await saveInsurance(id,verified,note);
    setSavedResponses(prev=>({...prev,[id]:record}));
  }
  return <div className="vc-dashboard" style={{gridColumn:'1 / -1'}}>
    <style>{css}</style>
    {error && <p role="status" className="vc-pill alert">{error}</p>}
    {showSite ? <SiteManagersPage clients={clients} today={today} onBack={()=>setShowSite(false)} onAssign={assignSite}/> : <>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}><button onClick={()=>setShowSite(true)} style={{background:'#fff',color:'#886c44',border:'0.5px solid #886c44',borderRadius:8,padding:'7px 14px',fontWeight:600}}>Assign Site Managers</button></div>
    <div className="vc-layout"><section aria-label="Upcoming client events">
      {submissions===null ? <div role="status" className="vc-empty">Loading client events…</div> : shown.length===0 ? <div className="vc-empty">{clients.length?'No events match this view.':'No upcoming client events yet.'}{clients.length>0&&<div><button className="vc-text-button" onClick={()=>{setQuery('');setFilter('all');}}>Show all upcoming events</button></div>}</div> : shown.map(c=>{
        const pastDue=c.duePayments.find(p=>p.due && p.due<today), next=c.duePayments[0];
        return <article key={c.id} className="vc-card" data-venue-state={(c.tasks.some(t=>t.overdue) || c.unsigned.length>0 || (c.nativeAgreement && ['declined','expired'].includes(c.nativeAgreement.status)) || (!c.legacy && !c.nativeAgreement) || (!c.legacy && c.schedule.length>0 && !c.schedule[0].paid)) ? "overdue" : (c.days!==null && c.days<=60 && !c.surveyComplete) ? "attention" : "ready"}><div className="vc-card-head"><div className="vc-date"><small>{c.eventDate ? new Date(c.eventDate+'T12:00:00').toLocaleDateString('en-US',{month:'short'}) : 'Date'}</small><strong>{c.eventDate?Number(c.eventDate.slice(8,10)):'?'}</strong></div><div className="vc-head-main"><h3 className="vc-name">{c.name}{c.arrangement==='bylt'&&<span style={{marginLeft:8,padding:'2px 8px',borderRadius:10,background:'#f3ead9',color:'#886c44',fontSize:11,fontWeight:700,verticalAlign:'middle'}}>BYLT</span>}</h3><div className="vc-muted">{dateLabel(c.eventDate)}{c.eventEnd && c.eventEnd!==c.eventDate?' – '+dateLabel(c.eventEnd):''} · {c.type}{c.days!==null?' · '+(c.days>0?c.days+' days away':c.days===0?'Today':'In progress'):''}</div></div><button className="vc-open" onClick={()=>open(c)} aria-label={'View details for '+c.name}>View details</button></div>
          <div className="vc-card-body"><div><div className="vc-label">Agreement</div><span className={'vc-pill '+(c.legacy ? 'good' : c.signatures ? c.unsigned.length?(c.unsigned.some(s=>s.signee_type==='vendor')?'danger':'alert'):'good':'')}>{c.nativeAgreement && ['declined','expired'].includes(c.nativeAgreement.status) ? (c.nativeAgreement.status==='declined'?'Revision declined':'Signing request expired') : c.legacy ? 'Signed' : c.signatures ? c.unsigned.length?'Signature pending':'Fully signed':'Not on file'}</span>{c.unsigned.map((s,i)=><div key={i} className="vc-muted" style={{marginTop:5}}>{s.signee_type==='vendor'?'Venue':'Client'} · {s.signee_name}</div>)}</div>
          <div><div className="vc-label">Payments</div>{c.payments ? <><div className="vc-payment-amount">{amount(c.paid,c.currency)} <span className="vc-muted">of {amount(c.total,c.currency)}</span></div><div className="vc-progress" role="progressbar" aria-label="Invoice paid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.total ? Math.round(c.paid/c.total*100):0}><span style={{width:Math.max(0,Math.min(100,c.total?c.paid/c.total*100:0))+'%'}}/></div><div className="vc-muted">{c.balance===0?'Paid in full':amount(c.balance,c.currency)+' remaining'}</div>{pastDue&&<span className="vc-pill danger" style={{marginTop:7}}>Payment past due</span>}</> : <div className="vc-muted">Schedule not yet recorded</div>}</div>
          <div><div className="vc-label">Final details</div><div className="vc-line"><span className={'vc-dot '+(c.surveyComplete?'good':'')}/>{c.surveyComplete?'Questionnaire complete':c.surveySent?'Questionnaire in progress':'Questionnaire to collect'}</div><div className="vc-line"><span className={'vc-dot '+(c.insuranceVerified?'good':'')}/>{c.insuranceVerified?'Insurance on file':'Insurance to verify'}</div></div></div>
          <div className="vc-card-foot" style={(!next && c.payments && c.surveyComplete && c.insuranceVerified && c.unsigned.length===0) ? {justifyContent:'flex-end'} : undefined}>{(!next && c.payments && c.surveyComplete && c.insuranceVerified && c.unsigned.length===0) ? <span>✓ All Requirements Met</span> : <><span>{next ? (pastDue?'Past due: ':'Next payment: ')+amount(next.cents,next.currency)+(next.due?' · '+dateLabel(next.due):'') : c.payments?'✓ All Payments Collected':'Review booking paperwork'}</span><span>{c.surveyComplete && c.insuranceVerified ? '✓ All Details Collected' : c.requirementsDue?'Final details due '+dateLabel(c.requirementsDue):'Event date to confirm'}</span></>}</div>
        </article>;
      })}
    </section><aside className="vc-sidebar" aria-label="Client priorities">
      <section className="vc-side-card priority"><h2 className="vc-side-title">Needs your attention <span className="vc-counter">{submissions===null?'—':urgent.length}</span></h2>{submissions===null?<p className="vc-muted">Loading priorities…</p>:urgent.length===0?<p className="vc-muted">No urgent items recorded.</p>:(allTasks?urgent:urgent.slice(0,6)).map(t=><button className="vc-task" key={t.key} onClick={()=>t.action?t.action():open(t.client)}><div className="vc-task-head">{t.title}</div><div className="vc-task-name">{t.client.name}</div><div className={'vc-task-date '+(t.overdue?'late':'')}>{t.due?(t.overdue?'Past due · ':'Due ')+dateLabel(t.due):t.detail}</div></button>)}{urgent.length>6&&<button className="vc-text-button" onClick={()=>setAllTasks(!allTasks)}>{allTasks?'Show fewer priorities':'See all '+urgent.length+' priorities ↓'}</button>}</section>
    </aside></div>
    </>}
    {selectedClient&&<ClientDetail key={selectedClient.id} client={selectedClient} messages={(messages||[]).filter(m=>m.event_uid==='client:'+selectedClient.id).slice().reverse()} onHandleMessage={onHandleMessage} onClose={()=>{setSelected(null);if(window.__nshReturnToMessages){window.__nshReturnToMessages=false;if(onOpenMessages)onOpenMessages();}}} onVerify={verifyInsurance} onSavePayments={recordPayments} agreementApi={agreementApi} onContractsChange={rows=>setNativeVersions(prev=>[...prev.filter(v=>v.response_id!==selectedClient.id),...rows])}/>}
  </div>;
}
