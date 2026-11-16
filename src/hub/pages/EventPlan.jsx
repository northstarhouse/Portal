// GENERATED from volunteerhub/src/pages/EventPlan.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
// Events Committee > 2027 Event Plan: the committee's confirmed list of events for the year (from the "2027 Events List"
// vote). Each event has a highlighted "Committee decisions" note, kept current after each meeting, and is finalized into a
// real Events Committee event once its date, start and end times and pricing are filled in.
import { useState, useEffect } from 'react';
import { fetchEventPlan, fetchPlanVotes, planKey, updateEventPlanRow, insertEventPlanRow,insertCommitteeEvent, syncOverviewCardsFromCommittee, syncInHouseEvent, updateCommitteeEvent, logActivity, fetchAllActiveVolunteers, matchVolunteerAreas, sendChecklistEmail } from '../lib/db.js';

const PLAN_YEAR = 2027;
const REQUIRED = [
  ['date', 'Date'], ['start_time', 'Start time'], ['end_time', 'End time'], ['pricing', 'Pricing'],
];
const fmtDay = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtShort = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtStamp = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
// Vote result pill: colored by what won.
const VOTE_TONE = { Yes: { bg: '#e8f5e9', color: '#2e7d32' }, No: { bg: '#ffebee', color: '#c62828' } };
function voteResult(t) {
  if (!t || !t.total) return null;
  const choices = Object.keys(t).filter(k => k !== 'total');
  const top = choices.sort((a, b) => t[b] - t[a])[0];
  const tie = choices.filter(c => t[c] === t[top]).length > 1;
  const label = tie ? 'Tie' : top === 'Yes' || top === 'No' || top === 'Abstain' ? top : 'Notes';
  return { label, count: t[top], total: t.total, tone: tie ? { bg: '#fff3e0', color: '#e65100' } : VOTE_TONE[top] || { bg: '#fff3e0', color: '#e65100' }, title: choices.map(c => c + ': ' + t[c]).join(', ') };
}
// The committee's final call on each event.
const DECISIONS = ['Moving Forward', 'Not Moving Forward', 'Merging with Another Event', 'Needs Further Discussion'];
const DECISION_TONE = { 'Moving Forward': { bg: '#e8f5e9', color: '#2e7d32' }, 'Not Moving Forward': { bg: '#ffebee', color: '#c62828' }, 'Merging with Another Event': { bg: '#ede7f6', color: '#5e35b1' }, 'Needs Further Discussion': { bg: '#fff8e1', color: '#8a6200' } };
// List order: Moving Forward, then Merging, then no decision yet, then Needs Further Discussion, Not Moving Forward last
// (each group keeps the committee's order).
const DECISION_RANK = { 'Moving Forward': 0, 'Merging with Another Event': 1, 'Needs Further Discussion': 3, 'Not Moving Forward': 4 };
const rankOf = (d) => (d in DECISION_RANK ? DECISION_RANK[d] : 2);
const sortPlan = (rows) => rows.slice().sort((a, b) => rankOf(a.final_decision) - rankOf(b.final_decision) || a.sort_order - b.sort_order);
const volName = (v) => v ? `${v['First Name'] || ''} ${v['Last Name'] || ''}`.trim() : '';


// ── Email update to the committee ────────────────────────────────────────────────────────────────────────────────────────
// A branded, read-only copy of the plan: each event with its details, the vote result and the committee's decisions, grouped by
// the final decision. Same look as the checklist email (taupe headers, one body font); titles are never all caps.
const dollars = (t) => String(t || '').replace(/(^|[^$\d.,])(\d[\d,]*(?:\.\d+)?)/g, (m, a, n) => a + '$' + n);
const bulletLines = (t) => String(t || '').split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim()).filter(Boolean);
const decisionGroup = (r) => (r.final_decision && DECISIONS.includes(r.final_decision) ? r.final_decision : 'No Decision Yet');
const GROUP_ORDER = ['Moving Forward', 'Merging with Another Event', 'No Decision Yet', 'Needs Further Discussion', 'Not Moving Forward'];
function buildPlanEmail({ rows, votes, note }) {
  const GOLD = '#a28b75'; const TITLE = '#8c6d36';
  const daysOf = (r) => (Array.isArray(r.days) ? r.days : []);
  const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ICON = 'https://northstarhouse.github.io/Portal/assets/icons/cat-event.png';
  const sorted = sortPlan(rows || []);
  const detailLine = (r) => [
    r.multi_day ? `${daysOf(r).length || 'Multi'}-day: ` + (daysOf(r).filter((d) => d.date).map((d) => fmtShort(d.date)).join(', ') || 'dates to set') : '',
    !r.multi_day && r.date ? fmtDay(r.date) : '',
    !r.multi_day && r.start_time ? `${fmtTime(r.start_time)}${r.end_time ? ' – ' + fmtTime(r.end_time) : ''}` : '',
    r.pricing ? `Pricing: ${dollars(r.pricing)}` : '', r.budget ? `Budget: ${dollars(r.budget)}` : '',
  ].filter(Boolean);
  const eventRow = (r) => {
    const dt = DECISION_TONE[r.final_decision];
    const edge = dt ? dt.color : '#e0a800';
    const sub = detailLine(r);
    return '<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:13px 18px;border-bottom:1px solid #ede8df;">'
      + '<div style="font-size:15px;font-weight:bold;color:#2a2a2a;line-height:1.35;">' + esc(r.name)
      + (r.finalized_event_id ? ' <span style="font-size:11px;font-weight:bold;color:#2e7d32;">&#10003; Finalized' + (r.finalized_at ? ' ' + esc(fmtStamp(r.finalized_at)) : '') + '</span>' : '') + '</div>'
      + (sub.length
        ? '<ul style="margin:5px 0 0;padding-left:20px;font-size:12.5px;color:#666666;line-height:1.55;">' + sub.map((x) => '<li style="margin:0 0 2px;">' + esc(x) + '</li>').join('') + '</ul>'
        : '<ul style="margin:5px 0 0;padding-left:20px;font-size:12.5px;color:#999999;line-height:1.55;"><li style="font-style:italic;">No details yet</li></ul>')
      + '<div style="margin-top:9px;border-left:3px solid ' + edge + ';background:#faf7f2;padding:8px 12px;">'
      + '<div style="font-size:11px;font-weight:bold;color:#8c6d36;margin-bottom:3px;">Committee Decisions' + (r.decisions_updated_at ? ' · as of ' + esc(fmtStamp(r.decisions_updated_at)) : '') + '</div>'
      + (bulletLines(r.decisions).length
        ? '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.55;color:#3a332a;">' + bulletLines(r.decisions).map((x) => '<li style="margin:0 0 3px;">' + esc(x) + '</li>').join('') + '</ul>'
        : '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.55;color:#999999;"><li style="font-style:italic;">No decisions recorded yet.</li></ul>') + '</div>'
      + '</td></tr>';
  };
  const groups = GROUP_ORDER.map((g) => ({ g, items: sorted.filter((r) => decisionGroup(r) === g) })).filter((x) => x.items.length);
  const groupsHtml = groups.map(({ g, items }) =>
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border:1px solid #ece3d7;border-collapse:separate;">'
    + '<tr><td bgcolor="#f7f4f1" style="background:#f7f4f1;padding:12px 16px;border:1px solid #ae9a86;"><img src="' + ICON + '" width="20" height="20" alt="" style="vertical-align:middle;margin-right:8px;border:0;">'
    + '<span style="font-family:Cardo,Georgia,serif;font-size:14px;font-weight:bold;color:' + TITLE + ';vertical-align:middle;">' + esc(g) + '</span>'
    + '<span style="font-size:12px;color:#888888;margin-left:10px;vertical-align:middle;">' + items.length + (items.length === 1 ? ' event' : ' events') + '</span></td></tr>'
    + items.map(eventRow).join('') + '</table>').join('');
  const movingN = sorted.filter((r) => r.final_decision === 'Moving Forward').length;
  const finalN = sorted.filter((r) => r.finalized_event_id).length;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const html = '<style>@media only screen and (max-width:540px){.pe-pad{padding-left:18px!important;padding-right:18px!important}}</style>'
    + '<div style="background:#e6ded0;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:680px;margin:0 auto;background:#fdfbf7;">'
    + '<div style="height:14px;background:' + GOLD + ';"></div>'
    + '<div class="pe-pad" style="padding:34px 36px 8px;text-align:center;"><div style="font-size:12px;letter-spacing:3px;color:' + GOLD + ';font-weight:bold;margin-bottom:12px;">Events Committee Update</div>'
    + '<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#2a2420;">' + PLAN_YEAR + ' Event Plan</h1>'
    + '<div style="font-size:13px;color:#777777;">As of ' + esc(today) + '</div>'
    + '<div style="border-top:1px solid #e5ddcf;width:60%;margin:20px auto 0;"></div></div>'
    + (note && note.trim() ? '<div class="pe-pad" style="padding:18px 36px 0;font-size:15px;line-height:1.6;color:#444444;">' + esc(note.trim()).replace(/\n/g, '<br>') + '</div>' : '')
    + '<div class="pe-pad" style="padding:6px 36px 6px;"><div style="font-size:13px;color:#888888;padding-top:14px;">' + sorted.length + ' events on the plan  ·  ' + movingN + ' moving forward  ·  ' + finalN + ' finalized</div>' + groupsHtml + '</div>'
    + '<div class="pe-pad" style="padding:24px 36px 34px;text-align:center;"><a href="https://volunteerhub.northstarhouse.org/#/events-committee-planning" style="display:inline-block;background:' + GOLD + ';color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:15px 30px;">Open in the Volunteer Hub</a></div>'
    + '<div style="background:#f7f4f1;padding:14px 36px;text-align:center;font-size:11px;color:#999999;">North Star House</div></div></div>';
  return html.replace(/style="/g, 'style="font-family:Helvetica,Arial,sans-serif;');
}
function buildPlanText({ rows, note }) {
  const lines = [`${PLAN_YEAR} Event Plan`, ''];
  if (note && note.trim()) lines.push(note.trim(), '');
  sortPlan(rows || []).forEach((r) => {
    lines.push(`${r.name} (${decisionGroup(r)})`);
    [r.date ? fmtDay(r.date) : '', r.pricing ? `Pricing: ${dollars(r.pricing)}` : '', r.budget ? `Budget: ${dollars(r.budget)}` : ''].filter(Boolean).forEach((x) => lines.push('  - ' + x));
    bulletLines(r.decisions).forEach((x) => lines.push('  - ' + x));
    lines.push('');
  });
  lines.push('Open in the Volunteer Hub: https://volunteerhub.northstarhouse.org/#/events-committee-planning');
  return lines.join('\n');
}

export default function EventPlan({ session, volunteer, onFinalized }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null); // id of the row being edited
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [collapsed, setCollapsed] = useState(true); // a dropdown: closed until clicked

  const [votes, setVotes] = useState({});
  // Email update to the committee: a note from you, a preview, a test to yourself, then the real send.
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState(PLAN_YEAR + ' Event Plan Update');
  const [emailNote, setEmailNote] = useState('');
  const [emailPreview, setEmailPreview] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [roster, setRoster] = useState([]);
  useEffect(() => { if (emailOpen && !roster.length) fetchAllActiveVolunteers().then(v => setRoster(Array.isArray(v) ? v : [])).catch(() => {}); }, [emailOpen]);
  const committee = roster.filter(v => matchVolunteerAreas(v.Team).includes('Events'));
  const committeeWithEmail = committee.filter(v => v.Email && String(v.Email).includes('@'));
  async function sendPlanEmail(list, who) {
    if (!list.length) { setEmailMsg({ ok: false, text: 'No email address to send to.' }); return; }
    if (who === 'committee' && !window.confirm('Send the ' + PLAN_YEAR + ' Event Plan to ' + list.length + ' committee member' + (list.length > 1 ? 's' : '') + '?')) return;
    setEmailBusy(true); setEmailMsg(null);
    const ok = await sendChecklistEmail({ to: list, subject: emailSubject.trim() || (PLAN_YEAR + ' Event Plan Update'), html: buildPlanEmail({ rows, votes, note: emailNote }), text: buildPlanText({ rows, note: emailNote }) }).catch(() => false);
    setEmailBusy(false);
    setEmailMsg({ ok, text: ok ? (who === 'committee' ? 'Sent to ' + list.length + ' committee member' + (list.length > 1 ? 's' : '') + '.' : 'Test sent to ' + list[0] + '.') : 'Could not send. Please try again.' });
  }
  useEffect(() => { fetchEventPlan(PLAN_YEAR).then(setRows).catch(() => setRows([])); fetchPlanVotes(PLAN_YEAR).then(setVotes).catch(() => {}); }, []);

  // Add an event to the plan (e.g. the combined event when two are merged). It starts as Moving Forward and opens for editing.
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  async function addEvent() {
    const name = newName.trim();
    if (!name) return;
    if ((rows || []).some((x) => x.name.trim().toLowerCase() === name.toLowerCase())) { setErr(`"${name}" is already on the list.`); return; }
    setAdding(true); setErr('');
    const sort = Math.max(-1, ...(rows || []).map((x) => x.sort_order || 0)) + 1;
    const row = await insertEventPlanRow({ year: PLAN_YEAR, name, sort_order: sort, final_decision: 'Moving Forward' });
    setAdding(false);
    if (!row) { setErr('Could not add the event. Please try again.'); return; }
    setRows((prev) => (prev || []).concat([row]));
    setNewName('');
    logActivity({ vol: volunteer, authUserId: session?.user?.id, action: 'event_plan_added', description: `${PLAN_YEAR} Event Plan: added ${name}` }).catch(() => {});
    edit(row);
  }

  async function setDecision(r, value) {
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, final_decision: value || null } : x));
    const res = await updateEventPlanRow(r.id, { final_decision: value || null, updated_at: new Date().toISOString() });
    if (!res) { setErr('Could not save the decision. Please try again.'); setRows(prev => prev.map(x => x.id === r.id ? r : x)); }
  }

  // What has to be filled in before finalizing. A multi-day event (days can be months apart) needs a date, start and
  // end time for every one of its days.
  const daysOf = (r) => (Array.isArray(r.days) ? r.days : []);
  const reqs = (r) => {
    const has = (v) => !!String(v || '').trim();
    const base = [['pricing', 'Pricing', has(r.pricing)]];
    if (r.multi_day) {
      const days = daysOf(r);
      if (days.length < 2) return [['days', 'Number of days', false]].concat(base);
      return days.map((d, i) => ['day' + i, 'Day ' + (i + 1) + (d.date ? ' · ' + fmtShort(d.date) : ''), has(d.date) && has(d.start_time) && has(d.end_time)]).concat(base);
    }
    return [['date', 'Date', has(r.date)], ['start_time', 'Start time', has(r.start_time)], ['end_time', 'End time', has(r.end_time)]].concat(base);
  };
  const missing = (r) => reqs(r).filter((q) => !q[2]).map((q) => q[1]);

  function edit(r) {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id); setErr('');
    const days = daysOf(r).length ? daysOf(r).map((d) => ({ date: d.date || '', start_time: d.start_time || '', end_time: d.end_time || '' }))
      : [{ date: r.date || '', start_time: r.start_time || '', end_time: r.end_time || '' }, { date: '', start_time: '', end_time: '' }];
    setDraft({ multi_day: !!r.multi_day, days, date: r.date || '', start_time: r.start_time || '', end_time: r.end_time || '', pricing: r.pricing || '', decisions: r.decisions || '' });
  }
  function setDayCount(n) {
    const count = Math.max(2, Math.min(30, parseInt(n, 10) || 2));
    setDraft((d) => { const days = d.days.slice(0, count); while (days.length < count) days.push({ date: '', start_time: '', end_time: '' }); return { ...d, days }; });
  }
  function setDay(i, key, value) {
    setDraft((d) => ({ ...d, days: d.days.map((x, j) => j === i ? { ...x, [key]: value } : x) }));
  }

  async function save(r) {
    setBusy(r.id); setErr('');
    // a multi-day event keeps every day; its first (earliest) day also fills the plain date/time fields
    const days = draft.multi_day ? draft.days.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) : null;
    const first = days ? days[0] : draft;
    const body = { multi_day: !!draft.multi_day, days, end_date: null, date: first.date || null, start_time: first.start_time || null, end_time: first.end_time || null, pricing: draft.pricing.trim() || null, updated_at: new Date().toISOString() };
    if ((draft.decisions || '').trim() !== (r.decisions || '').trim()) {
      body.decisions = draft.decisions.trim() || null;
      body.decisions_updated_at = new Date().toISOString();
      body.decisions_updated_by = volName(volunteer) || null;
    }
    const res = await updateEventPlanRow(r.id, body);
    setBusy('');
    if (!res) { setErr('Could not save. Please try again.'); return; }
    setRows(prev => prev.map(x => x.id === r.id ? res : x));
    setOpen(null);
  }

  async function finalize(r) {
    if (missing(r).length) return;
    const days = r.multi_day ? daysOf(r) : [{ date: r.date, start_time: r.start_time, end_time: r.end_time }];
    if (!window.confirm(`Finalize "${r.name}" as a ${PLAN_YEAR} event?` + (days.length > 1 ? ` Each of its ${days.length} days is added as its own event.` : ' It will be added to the Events Committee events.'))) return;
    setBusy(r.id); setErr('');
    const base = /\b20\d\d\b/.test(r.name) ? r.name : `${r.name} ${PLAN_YEAR}`;
    const notes = [r.budget ? `Budget: ${r.budget}` : '', r.decisions ? `Committee decisions: ${r.decisions}` : ''].filter(Boolean);
    const created = [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      // one event per day; for multi-day events each name carries its date (days can be months apart)
      const name = days.length > 1 ? `${r.name} – ${fmtShort(d.date)}` : base;
      const ins = await insertCommitteeEvent({
        name, date: d.date, start_time: d.start_time, end_time: d.end_time, pricing: r.pricing, status: 'planning',
        description: [days.length > 1 ? `Day ${i + 1} of ${days.length} of ${base}: ${days.map((x) => fmtShort(x.date)).join(', ')}` : '', ...notes].filter(Boolean).join('\n\n'),
        checklist: [], vendors: [], timeline: [], after_notes: {}, created_by: session?.user?.id || null,
      });
      if (ins.error || !ins.row) {
        setBusy('');
        setErr((created.length ? `${created.length} of ${days.length} days were added, then: ` : '') + (/duplicate|unique/i.test(ins.error || '') ? `an event named "${name}" already exists.` : `could not finalize: ${ins.error || 'unknown error'}`));
        if (created.length && onFinalized) onFinalized(created[0]);
        return;
      }
      created.push(ins.row);
    }
    const upd = await updateEventPlanRow(r.id, { finalized_event_id: created[0].id, finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    setBusy('');
    if (upd) setRows(prev => prev.map(x => x.id === r.id ? upd : x));
    syncOverviewCardsFromCommittee(created).catch(() => {});
    created.forEach((row) => syncInHouseEvent({ name: row.name, date: row.date }).then(ih => { if (ih?.id) updateCommitteeEvent(row.id, { in_house_event_id: ih.id }); }).catch(() => {}));
    logActivity({ vol: volunteer, authUserId: session?.user?.id, action: 'committee_event_added', description: `${PLAN_YEAR} Event Plan: finalized ${created.map((x) => x.name).join(', ')}` }).catch(() => {});
    if (onFinalized) onFinalized(created[0]);
  }

  const done = (rows || []).filter(r => r.finalized_event_id).length;
  const lab = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 };
  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingRight: 16 }}>
      <button type="button" onClick={() => setCollapsed(!collapsed)} style={{ flex: '1 1 260px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: 'var(--gold)' }}>{PLAN_YEAR} Event Plan</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rows ? `${done} of ${rows.length} finalized` : ''} {collapsed ? '▸' : '▾'}</span>
      </button>
      <button type="button" className="btn-gold" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => { setEmailOpen(o => !o); setEmailMsg(null); }}>✉ Email update to committee</button>
      </div>
      {emailOpen && (
        <div style={{ margin: '0 16px 16px', border: '0.5px solid var(--border-light)', borderRadius: 10, padding: '14px 16px', background: '#faf8f4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Email the {PLAN_YEAR} Event Plan to the committee</div>
            <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setEmailOpen(false)}>Close</button>
          </div>
          <div className="label">Subject</div>
          <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="label">Your note (shown at the top of the email)</div>
          <textarea className="input" rows={4} value={emailNote} onChange={e => setEmailNote(e.target.value)} placeholder="For example: here is where the plan stands after our notes. Please read through each event and add anything I missed before the next meeting." style={{ resize: 'vertical', marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Goes to {committeeWithEmail.length} committee member{committeeWithEmail.length === 1 ? '' : 's'} (the Events team): {committeeWithEmail.map(volName).join(', ') || 'none found'}.
            {committee.length > committeeWithEmail.length && ' No email on file for: ' + committee.filter(v => !committeeWithEmail.includes(v)).map(volName).join(', ') + '.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEmailPreview(p => !p)}>{emailPreview ? 'Hide preview' : 'Preview'}</button>
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} disabled={emailBusy || !(volunteer && volunteer.Email)} onClick={() => sendPlanEmail([volunteer.Email], 'me')} title={volunteer && volunteer.Email ? 'Sends only to ' + volunteer.Email : 'No email on your volunteer record'}>Send a test to me</button>
            <button type="button" className="btn-gold" style={{ fontSize: 12 }} disabled={emailBusy || !committeeWithEmail.length || !rows} onClick={() => sendPlanEmail(committeeWithEmail.map(v => v.Email), 'committee')}>{emailBusy ? 'Sending…' : 'Email update to committee'}</button>
            {emailMsg && <span style={{ fontSize: 12, color: emailMsg.ok ? '#2e7d32' : '#b3261e' }}>{emailMsg.text}</span>}
          </div>
          {emailPreview && <iframe title="Email preview" srcDoc={buildPlanEmail({ rows, votes, note: emailNote })} style={{ width: '100%', height: 620, border: '0.5px solid var(--border)', borderRadius: 8, marginTop: 12, background: '#fff' }} />}
        </div>
      )}
      {!collapsed && (
        <div style={{ borderTop: '0.5px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 16px 4px' }}>The committee's confirmed events for {PLAN_YEAR}. Once an event has a date, start and end times and pricing, finalize it to add it to the events below.</div>
          {err && <div style={{ color: '#b3261e', fontSize: 12, padding: '4px 16px' }}>{err}</div>}
          {rows === null ? <div style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>Loading…</div> : sortPlan(rows).map((r, i) => {
            const need = missing(r);
            const finalized = !!r.finalized_event_id;
            const vr = voteResult(votes[planKey(r.name)]);
            const dt = DECISION_TONE[r.final_decision];
            const dropped = r.final_decision === 'Not Moving Forward'; // no finalize checklist for these
            // the decisions box takes the dropdown's color (yellow until a decision is picked)
            const box = dt ? { bg: dt.bg, edge: dt.color, head: dt.color } : { bg: '#fff8e1', edge: '#e0a800', head: '#8a6200' };
            return (
              <div key={r.id} style={{ padding: '12px 16px', borderTop: i ? '0.5px solid var(--border-light)' : 'none', opacity: finalized ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{r.name}{vr && <span title={'Committee vote · ' + vr.title} style={{ fontSize: 11, fontWeight: 700, background: vr.tone.bg, color: vr.tone.color, borderRadius: 10, padding: '2px 9px' }}>{vr.label} {vr.count}/{vr.total}</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {[r.multi_day ? `${daysOf(r).length || 'Multi'}-day: ` + (daysOf(r).filter((d) => d.date).map((d) => fmtShort(d.date)).join(', ') || 'dates to set') : '', !r.multi_day && r.date ? fmtDay(r.date) : '', !r.multi_day && r.start_time ? `${fmtTime(r.start_time)}${r.end_time ? '–' + fmtTime(r.end_time) : ''}` : '', r.pricing ? `Pricing: ${r.pricing}` : '', r.budget ? `Budget: ${r.budget}` : ''].filter(Boolean).join(' · ') || 'No details yet'}
                    </div>
                  </div>
                  <select value={r.final_decision || ''} onChange={e => setDecision(r, e.target.value)} aria-label={'Final decision for ' + r.name}
                    style={{ fontSize: 12, fontWeight: 600, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', border: dt ? '1px solid transparent' : '0.5px solid var(--border)', background: dt ? dt.bg : '#fff', color: dt ? dt.color : 'var(--text)' }}>
                    <option value="">Final decision…</option>
                    {DECISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {finalized
                    ? <span style={{ fontSize: 11, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, padding: '3px 10px' }}>✓ Finalized {fmtStamp(r.finalized_at)}</span>
                    : need.length || dropped
                      ? null
                      : <button type="button" className="btn-gold" disabled={busy === r.id} onClick={() => finalize(r)} style={{ fontSize: 12, padding: '6px 14px' }}>{busy === r.id ? 'Finalizing…' : 'Finalize event'}</button>}
                  {!finalized && <button type="button" className="btn-ghost" onClick={() => edit(r)} style={{ fontSize: 12, padding: '5px 12px' }}>{open === r.id ? 'Close' : 'Edit'}</button>}
                </div>

                {/* What's needed to finalize: each item checks off once it's filled in */}
                {!finalized && !dropped && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {reqs(r).map(([k, label, ok]) => {
                      return <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 9px', background: ok ? '#e8f5e9' : '#ffebee', color: ok ? '#2e7d32' : '#c62828', border: '1px solid ' + (ok ? '#bfe0bf' : '#f2b8b5') }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, borderRadius: 3, background: ok ? '#2e7d32' : '#fff', border: ok ? 'none' : '1.5px solid #e57373', color: '#fff', fontSize: 10, lineHeight: 1 }}>{ok ? '✓' : ''}</span>
                        {label}
                      </span>;
                    })}
                  </div>
                )}

                {/* Committee decisions: the highlighted note */}
                {open !== r.id && (
                  <div style={{ marginTop: 8, background: box.bg, borderLeft: '3px solid ' + box.edge, borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: box.head, marginBottom: 3 }}>
                      Committee decisions{r.decisions_updated_at ? ` · as of ${fmtStamp(r.decisions_updated_at)}${r.decisions_updated_by ? ' (' + r.decisions_updated_by + ')' : ''}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: r.decisions ? '#3a332a' : box.head, whiteSpace: 'pre-wrap', fontStyle: r.decisions ? 'normal' : 'italic' }}>{r.decisions || 'No decisions recorded yet.'}</div>
                  </div>
                )}

                {open === r.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ ...lab, color: '#8a6200' }}>Committee decisions
                      <textarea className="input" rows={4} value={draft.decisions} onChange={e => setDraft({ ...draft, decisions: e.target.value })} placeholder="What the committee decided (format, lead, budget direction, open questions…)" style={{ background: '#fffbea', border: '1px solid #e8d48a', resize: 'vertical', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!draft.multi_day} onChange={e => setDraft({ ...draft, multi_day: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#886c44' }} />
                      Multi-day event
                    </label>
                    {draft.multi_day && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ ...lab, flexDirection: 'row', alignItems: 'center', gap: 8 }}>How many days?
                          <input className="input" type="number" min={2} max={30} value={draft.days.length} onChange={e => setDayCount(e.target.value)} style={{ width: 70 }} />
                        </label>
                        {draft.days.map((d, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px repeat(auto-fit, minmax(130px, 1fr))', gap: 8, alignItems: 'end' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', paddingBottom: 8 }}>Day {i + 1}</div>
                            <label style={lab}>Date<input className="input" type="date" value={d.date} onChange={e => setDay(i, 'date', e.target.value)} /></label>
                            <label style={lab}>Start time<input className="input" type="time" step="900" value={d.start_time} onChange={e => setDay(i, 'start_time', e.target.value)} /></label>
                            <label style={lab}>End time<input className="input" type="time" step="900" value={d.end_time} onChange={e => setDay(i, 'end_time', e.target.value)} /></label>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {!draft.multi_day && <label style={lab}>Date<input className="input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>}
                      {!draft.multi_day && <label style={lab}>Start time<input className="input" type="time" step="900" value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} /></label>}
                      {!draft.multi_day && <label style={lab}>End time<input className="input" type="time" step="900" value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} /></label>}
                      <label style={lab}>Pricing<input className="input" value={draft.pricing} onChange={e => setDraft({ ...draft, pricing: e.target.value })} placeholder="e.g. $25 / $15 members" /></label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-gold" disabled={busy === r.id} onClick={() => save(r)} style={{ fontSize: 12, padding: '7px 16px' }}>{busy === r.id ? 'Saving…' : 'Save'}</button>
                      <button type="button" className="btn-ghost" onClick={() => setOpen(null)} style={{ fontSize: 12, padding: '7px 14px' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rows !== null && (
            <form onSubmit={(e) => { e.preventDefault(); addEvent(); }} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '0.5px solid var(--border-light)', flexWrap: 'wrap' }}>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New event name (e.g. a merged event)" style={{ flex: '1 1 220px', fontSize: 13 }} />
              <button type="submit" className="btn-gold" disabled={adding || !newName.trim()} style={{ fontSize: 12, padding: '7px 16px' }}>{adding ? 'Adding…' : '+ Add event'}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
