// GENERATED from volunteerhub/src/pages/eventsCommitteeAreas.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
// Area-based event planning (Overall/Programs/Volunteers/Logistics/
// Hospitality/Finance/Sponsorship/Interiors/Marketing) for Volunteer Hub's
// Events Committee page. Ported from the richer per-area structure in the
// standalone nsh-events-committee site, but schema-driven (one generic
// renderer + field list per area) instead of nine hand-written components,
// and saved to a single `events_committee_areas` table row per (event, area)
// instead of the old app's localStorage + event_forms dual-write.
import { useEffect, useRef, useState } from 'react';
import { fetchAreaData, saveArea, logActivity, fetchAllActiveVolunteers } from '../lib/db.js';

export const AREA_DEFAULTS = [
  { key: 'programs', label: 'Activities & Programs', role: 'Programs', defaultOwner: 'Gerrie Kopec' },
  { key: 'volunteers', label: 'Volunteer Coordination', role: 'Volunteers', defaultOwner: 'Haley Wright' },
  { key: 'logistics', label: 'Event Logistics', role: 'Logistics & Operations', defaultOwner: 'Vince LoFranco' },
  { key: 'hospitality', label: 'Hospitality', role: 'Hospitality', defaultOwner: 'Barb Kusha' },
  { key: 'finance', label: 'Finance & Budget', role: 'Finance and Budget', defaultOwner: 'Ken Underwood' },
  { key: 'sponsorship', label: 'Sponsorships & Partnerships', role: 'Sponsorship & Partnership', defaultOwner: 'Derek Cheeseman' },
  { key: 'interiors', label: 'Interiors', role: 'Interiors', defaultOwner: 'Rebekah Freeman' },
  { key: 'marketing', label: 'Marketing', role: 'Marketing', defaultOwner: 'Haley Wright' },
];

// Questions worth asking while building the checklist (the old planning-area boxes, as prompts).
export const PLANNING_PROMPTS = [
  { group: 'Logistics', items: ['Setup plan', 'Equipment needed', 'Backup plan (weather, power, no-shows)'] },
  { group: 'Hospitality', items: ['Serving style (self-serve, served, passed)', { label: 'Selling alcohol (needs a license)', action: 'alcohol' }, 'Food shopping list', 'Beverage shopping list', 'Alcohol shopping list', 'Rental equipment', 'Cleanup plan'] },
  { group: 'Sponsorship', items: ['Potential sponsors', 'How we will recognize sponsors', 'Outreach to sponsors', 'Intentional invites'] },
  { group: 'Interiors', items: ['Historic approach (what stays in place)', 'Items to move or remove, and why', 'Decor to add', 'Decor cost'] },
  { group: 'Money', items: ['Projected expenses', 'Projected income', 'Reimbursements needed?'] },
];

// The spaces at North Star House (from the site manager walk-through) for "Spaces used".
export const NSH_SPACES = ['Living Room', 'Dining Room', 'Library', 'Julia Morgan Room', 'Mudroom & Study', 'Kitchen', 'Restrooms & Foyer', 'Terrace & West Lawn', 'Courtyard & East Lawn', 'Garden', 'Parking Lot'];


// Plain-text event details (shared by "Copy event details" and the Chamber newsletter draft).
const fmtLongDate = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date to be announced';
const fmtClock = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export function eventDetailsText(ev, rsvpOnly = false) {
  const tiers = (ev.ticketTiers || []).filter(t => t && String(t.name || '').trim());
  const time = [fmtClock(ev.startTime), fmtClock(ev.endTime)].filter(Boolean).join(' – ');
  return [
    ev.name,
    [fmtLongDate(ev.date), time].filter(Boolean).join(' · '),
    ev.location ? 'Where: ' + ev.location : '',
    ev.purpose ? 'Type: ' + ev.purpose : '',
    ev.description ? '\n' + ev.description : '',
    !rsvpOnly && tiers.length ? '\nTickets:\n' + tiers.map(t => '  ' + t.name + (Number(t.price) > 0 ? ': $' + t.price : ': free')).join('\n') : (ev.pricing ? '\nPricing: ' + ev.pricing : ''),
    rsvpOnly ? '\nRSVP only (no ticket sales)' : '',
    ev.expectedAttendance ? 'Expected attendance: ' + ev.expectedAttendance : '',
    ev.eventLead ? 'Event lead: ' + ev.eventLead : '',
  ].filter(Boolean).join('\n');
}
// A ready-to-paste email to the Grass Valley Chamber about the newsletter submission.
export function chamberDraftText(ev) {
  return 'Subject: Newsletter submission: ' + (ev.name || 'North Star House event') + '\n\n'
    + 'Hello,\n\nWe would like to submit the following event for the Grass Valley Chamber Newsletter. The details are below. Please let us know if you need anything else from us, such as images, a shorter description, or a different format.\n\n'
    + '----------\n' + eventDetailsText(ev) + '\n----------\n\n'
    + 'Thank you so much for including us.\n\nNorth Star House\nnorthstarhouse.org';
}
export function copyText(text, done) {
  const fail = () => alert('Could not copy. Select and copy this instead:\n\n' + text);
  try { navigator.clipboard.writeText(text).then(() => done && done(), fail); } catch (_e) { fail(); }
}
// The event being edited in AreasTab, so the Chamber button inside the channel list can reach its details.
let areaEvent = null;
export const CHAMBER_CHANNEL = 'Grass Valley Chamber Newsletter';
export function ChamberDraftButton({ ev }) {
  const [copied, setCopied] = useState(false);
  if (!ev) return null;
  return <button type="button" title="Copy a draft email to the Chamber with this event's details" onClick={e => { e.preventDefault(); e.stopPropagation(); copyText(chamberDraftText(ev), () => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
    style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '2px 10px', border: '1px solid var(--gold)', background: '#fff', color: 'var(--gold)', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied ? 'Copied ✓' : 'Draft email'}</button>;
}

// Shown name for a channel. The stored key stays as is (events already have it checked off under that key).
const CHANNEL_LABELS = { 'Go Nevada County Calendar - Community Blast': 'Community Calendar', 'Facebook Event Page': 'Facebook Event Listing', 'NSH Facebook Page': 'Facebook Page', 'NSH Instagram Page': 'Instagram Page', 'NSH Newsletter': 'Newsletter', 'Send Email Blast': 'Event Email Blast', 'YubaNet (Press Release Only)': 'YubaNet - Send Press Release' };
export const channelLabel = (c) => CHANNEL_LABELS[c] || c;
// Listed in column order (the checklist fills the left column first): the calendars and social pages on the left, email/blog/flyer at the top of the right, the extras and the Chamber at the end.
export const MARKETING_CHANNELS = [
  'Website', 'Go Nevada County Calendar - Community Blast', 'YubaNet Calendar', 'Arts Council Calendar', 'KVMR Calendar', 'Union Event Calendar',
  'Facebook Event Page', 'NSH Facebook Page', 'NSH Instagram Page', 'Next Door',
  'Make Flyer', 'Create Press Release', 'Blog', 'NSH Newsletter', 'Send Email Blast',
  'Nevada County Peeps', 'Grass Valley Peeps', 'Lake Wildwood Page', 'YubaNet (Press Release Only)', 'Grass Valley Chamber Newsletter',
];
const EXPENSE_CATEGORIES = ['Food & Beverage', 'Entertainment / Speakers', 'Supplies / Decor', 'Marketing / Printing', 'Permits / Licenses / Insurance', 'Cleaning / Security', 'Other'];
const INCOME_SOURCES = ['Ticket Sales', 'Alcohol or food sales', 'House Merch', 'Donations', 'Other'];

// ---------- Field schemas: [ { key, label, type, ...opts } ] per area/phase ----------
// Types: text, textarea, select, radio, yesno, checkboxGroup, checkbox,
// table (dynamic add/remove rows), roleCounts, channelChecklist, moneyTable.

const SCHEMAS = {
  overall: {
    pre: [
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
    post: [
      { key: 'finalNotes', label: 'Final Notes', type: 'textarea' },
    ],
  },
  programs: {
    pre: [],
    post: [
      { key: 'activityReview', label: 'Activity Review', type: 'table', columns: [{ key: 'activity', label: 'Activity' }, { key: 'whatWorked', label: 'What Worked' }, { key: 'whatDidnt', label: "What Didn't" }, { key: 'notes', label: 'Notes' }] },
      { key: 'flowTiming', label: 'Flow & Timing', type: 'textarea' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  volunteers: {
    pre: [
      { key: 'roles', label: 'Staffing Needs', type: 'staffing' },
    ],
    post: [],
  },
  logistics: {
    pre: [
      { key: 'proposedAttendance', label: 'Proposed Attendance', type: 'text' },
      { key: 'eventLocations', label: 'Event Locations', type: 'textarea' },
      { key: 'setupPlan', label: 'Setup Plan', type: 'textarea' },
      { key: 'volunteersAssisting', label: 'Volunteers Assisting', type: 'text' },
      { key: 'equipmentNeeded', label: 'Equipment Needed', type: 'textarea' },
      { key: 'safetyConsiderations', label: 'Safety Considerations', type: 'textarea' },
      { key: 'couldImpactSuccess', label: 'Could Impact Success?', type: 'radio', options: ['No', 'Yes'] },
      { key: 'backupPlan', label: 'Backup Plan', type: 'textarea' },
      { key: 'otherNotes', label: 'Other Notes', type: 'textarea' },
    ],
    post: [
      { key: 'setupVsReality', label: 'Setup vs Reality', type: 'radio', options: ['Matched plan exactly', 'Minor adjustments', 'Significant changes'] },
      { key: 'adjustmentsMade', label: 'Adjustments Made', type: 'textarea' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  hospitality: {
    pre: [
      { key: 'servingStyle', label: 'Serving Style', type: 'checkboxGroup', options: ['Self-serve', 'Served', 'Passed items', 'Combination'] },
      { key: 'alcoholInvolved', label: 'Alcohol Involved', type: 'radio', options: ['No', 'Yes'] },
      { key: 'cleanupPlan', label: 'Cleanup Plan', type: 'textarea' },
      { key: 'volunteersAssisting', label: 'Volunteers Assisting', type: 'text' },
      { key: 'foodBevPlan', label: 'Food & Beverage Plan', type: 'table', columns: [{ key: 'item', label: 'Item' }, { key: 'volunteer', label: 'Volunteer' }] },
      { key: 'shoppingList', label: 'Shopping List', type: 'table', columns: [{ key: 'item', label: 'Item' }, { key: 'volunteer', label: 'Volunteer' }] },
      { key: 'rentalEquipment', label: 'Rental Equipment', type: 'table', columns: [{ key: 'item', label: 'Equipment' }, { key: 'volunteer', label: 'Volunteer' }] },
      { key: 'otherNotes', label: 'Other Notes', type: 'textarea' },
    ],
    post: [
      { key: 'fbOutcome', label: 'Food & Beverage Outcome', type: 'radio', options: ['More than enough', 'Adequate', 'Ran out'] },
      { key: 'guestFlow', label: 'Guest Flow', type: 'radio', options: ['Excellent', 'Good', 'Issues noted'] },
      { key: 'guestComments', label: 'Guest Comments', type: 'textarea' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  finance: {
    pre: [
      { key: 'expenses', label: 'Projected Expenses', type: 'moneyTable', rowKey: 'category', rows: EXPENSE_CATEGORIES },
      { key: 'income', label: 'Projected Income', type: 'moneyTable', rowKey: 'source', rows: INCOME_SOURCES },
      { key: 'financialNotes', label: 'Financial Notes', type: 'textarea' },
    ],
    post: [
      { key: 'finalExpenses', label: 'Final Expenses', type: 'text' },
      { key: 'finalIncome', label: 'Final Income', type: 'text' },
      { key: 'finalNet', label: 'Final Net', type: 'text' },
      { key: 'reimbursementsNeeded', label: 'Reimbursements Needed?', type: 'radio', options: ['No', 'Yes'] },
      { key: 'netReportedToBoard', label: 'Net Reported to Board?', type: 'checkbox' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  sponsorship: {
    pre: [
      { key: 'recognitionMethods', label: 'Recognition Methods', type: 'checkboxGroup', options: ['Signage on site', 'Verbal recognition', 'Program/printed materials', 'Digital recognition', 'Invitation-only/VIP access', 'Other'] },
      { key: 'recognitionOther', label: 'Other Recognition', type: 'text' },
      { key: 'recognitionVolunteer', label: 'Recognition Volunteer', type: 'text' },
      { key: 'potentialSponsors', label: 'Potential Sponsors', type: 'textarea' },
      { key: 'outreachActions', label: 'Outreach Actions', type: 'checkboxGroup', options: ['Personal invitation', 'Event-specific pitch', 'Follow-up after event', 'Other'] },
      { key: 'outreachOther', label: 'Other Outreach', type: 'text' },
      { key: 'outreachVolunteer', label: 'Outreach Volunteer', type: 'text' },
      { key: 'intentionalInvites', label: 'Intentional Invites', type: 'textarea' },
      { key: 'otherNotes', label: 'Other Notes', type: 'textarea' },
    ],
    post: [
      { key: 'sponsorsInvolved', label: 'Sponsors Involved', type: 'textarea' },
      { key: 'recognitionDelivered', label: 'Recognition Delivered', type: 'textarea' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  interiors: {
    pre: [
      { key: 'historicApproach', label: 'Historic Approach', type: 'radio', options: ['All historically accurate items remain in place', 'Some items may be moved/stored', 'Significant rearrangement needed'] },
      { key: 'moreInfo', label: 'More Info', type: 'textarea' },
      { key: 'decorAdded', label: 'Decor Added', type: 'textarea' },
      { key: 'decorCost', label: 'Decor Cost', type: 'text' },
      { key: 'removalReasons', label: 'Removal Reasons', type: 'checkboxGroup', options: ['Space needs', 'Safety concerns', 'Damage risk', 'Event logistics', 'Other'] },
      { key: 'removalOther', label: 'Other Removal Reason', type: 'text' },
      { key: 'otherNotes', label: 'Other Notes', type: 'textarea' },
    ],
    post: [
      { key: 'historicIssues', label: 'Historic Issues', type: 'textarea' },
      { key: 'wearDamage', label: 'Wear / Damage', type: 'textarea' },
      { key: 'committeeNotes', label: 'Committee Notes', type: 'textarea' },
    ],
  },
  marketing: {
    pre: [
      { key: 'channels', label: 'Channels', type: 'channelChecklist' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    post: [],
  },
};

function defaultValueFor(field) {
  if (field.type === 'table') return [];
  if (field.type === 'checkboxGroup') return [];
  if (field.type === 'checkbox') return false;
  if (field.type === 'staffing') return [];
  if (field.type === 'channelChecklist') { const m = {}; MARKETING_CHANNELS.forEach(c => { m[c] = { done: false, date: '' }; }); return m; }
  if (field.type === 'moneyTable') return field.rows.map(r => ({ [field.rowKey]: r, estimated: '', actual: '' }));
  return '';
}

// One-time upgrade from the old fixed-role checkbox+count shape
// ({ 'Setup': { needed: true, count: '3' }, ... }) to the new free-form
// role list with real volunteer assignment ([{ id, name, target,
// assignedIds }]). Old events keep their role names/counts as the
// starting target; nobody is pre-assigned since the old data never
// tracked specific people.
function migrateStaffing(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    return Object.keys(v).filter(name => v[name] && v[name].needed).map(name => {
      const target = parseInt(v[name].count, 10);
      return { id: Math.random().toString(36).slice(2, 8), name, target: Number.isFinite(target) ? target : 0, assignedIds: [] };
    });
  }
  return [];
}

// ---------- Generic field renderers ----------

function TableField({ field, v, onChange, readOnly }) {
    const rows = Array.isArray(v) ? v : [];
    const [draft, setDraft] = useState({});
    const [showForm, setShowForm] = useState(false);
    function addRow() {
      if (field.columns.every(c => !draft[c.key])) return;
      onChange([...rows, { id: Math.random().toString(36).slice(2, 8), ...draft }]);
      setDraft({});
      setShowForm(false);
    }
    function removeRow(id) { onChange(rows.filter(r => r.id !== id)); }
    if (readOnly && !rows.length) return <div className="sheet-answer"><span className="sheet-empty">Not filled in yet</span></div>;
    return (
      <div>
        {rows.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', marginBottom: 5 }}>
            {field.columns.map(c => <span key={c.key} style={{ flex: 1, fontSize: 12 }}>{r[c.key]}</span>)}
            <button className="edit-only" onClick={() => removeRow(r.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        {showForm ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {field.columns.map(c => (
              <input key={c.key} className="input" type={c.type || 'text'} style={{ flex: 1 }} placeholder={c.label}
                value={draft[c.key] || ''} onChange={e => setDraft(d => ({ ...d, [c.key]: e.target.value }))} />
            ))}
            <button className="btn-gold" style={{ padding: '8px 12px' }} onClick={addRow}>Add</button>
            <button className="btn-ghost" style={{ padding: '8px 12px' }} onClick={() => { setDraft({}); setShowForm(false); }}>Cancel</button>
          </div>
        ) : (
          <button className="btn-ghost edit-only" style={{ fontSize: 12, marginTop: 4 }} onClick={() => setShowForm(true)}>+ Add {field.label}</button>
        )}
      </div>
    );
}

function Field({ field, value, onChange, volunteers, readOnly }) {
  const v = value !== undefined ? value : defaultValueFor(field);

  // Ready sheet: plain text, and anything not filled in says so.
  if (readOnly && (field.type === 'text' || field.type === 'textarea' || field.type === 'select')) {
    return <div className="sheet-answer">{v ? v : <span className="sheet-empty">Not filled in yet</span>}</div>;
  }

  if (field.type === 'text') return <input className="input" value={v} onChange={e => onChange(e.target.value)} />;
  if (field.type === 'textarea') return <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={v} onChange={e => onChange(e.target.value)} />;
  if (field.type === 'select') return (
    <select className="input" style={{ appearance: 'auto' }} value={v} onChange={e => onChange(e.target.value)}>
      {field.options.map(o => <option key={o} value={o}>{o || 'Select…'}</option>)}
    </select>
  );
  if (field.type === 'radio') return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {field.options.map(o => (
        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" checked={v === o} onChange={() => onChange(o)} style={{ accentColor: 'var(--gold)' }} /> {o}
        </label>
      ))}
    </div>
  );
  if (field.type === 'checkboxGroup') {
    const arr = Array.isArray(v) ? v : [];
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {field.options.map(o => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={arr.includes(o)} onChange={() => onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o])} style={{ accentColor: 'var(--gold)' }} /> {o}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'checkbox') return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!v} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 15, height: 15 }} /> Yes
    </label>
  );
  if (field.type === 'table') return <TableField field={field} v={v} onChange={onChange} readOnly={readOnly} />;
  if (field.type === 'staffing') return <StaffingField roles={migrateStaffing(v)} onChange={onChange} volunteers={volunteers || []} readOnly={readOnly} />;
  if (field.type === 'channelChecklist') {
    const m = v || {};
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoFlow: 'column', gridTemplateRows: 'repeat(' + Math.ceil(MARKETING_CHANNELS.length / 2) + ', auto)', gap: 6 }}>
        {MARKETING_CHANNELS.map(c => {
          const row = m[c] || { done: false, date: '' };
          return (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!row.done} onChange={e => onChange({ ...m, [c]: { ...row, done: e.target.checked } })} style={{ accentColor: 'var(--gold)' }} />
              {channelLabel(c)}{c === CHAMBER_CHANNEL && <ChamberDraftButton ev={areaEvent} />}
            </label>
          );
        })}
      </div>
    );
  }
  if (field.type === 'moneyTable') {
    const rows = Array.isArray(v) && v.length ? v : defaultValueFor(field);
    const total = (col) => rows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
    function update(i, col, val) {
      const next = rows.map((r, idx) => idx === i ? { ...r, [col]: val } : r);
      onChange(next);
    }
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
          <span style={{ flex: 2 }}>{field.rowKey === 'category' ? 'Category' : 'Source'}</span>
          <span style={{ flex: 1 }}>Estimated</span>
          <span style={{ flex: 1 }}>Actual</span>
        </div>
        {rows.map((r, i) => (
          <div key={r[field.rowKey]} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ flex: 2, fontSize: 12 }}>{r[field.rowKey]}</span>
            <input className="input" type="number" style={{ flex: 1 }} value={r.estimated} onChange={e => update(i, 'estimated', e.target.value)} />
            <input className="input" type="number" style={{ flex: 1 }} value={r.actual} onChange={e => update(i, 'actual', e.target.value)} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
          <span style={{ flex: 2 }}>Total</span>
          <span style={{ flex: 1 }}>${total('estimated').toLocaleString()}</span>
          <span style={{ flex: 1 }}>${total('actual').toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
}

// Free-form staffing roles with real volunteer assignment -- a target
// headcount per role, +/- to adjust it, and an expandable panel per role
// to assign/remove specific people from the active volunteer directory.
function volName(vol) { return `${vol['First Name'] || ''} ${vol['Last Name'] || ''}`.trim() || 'Unnamed'; }

function StaffingField({ roles, onChange, volunteers, readOnly }) {
  const [expandedId, setExpandedId] = useState(null);
  const [addingRole, setAddingRole] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftTarget, setDraftTarget] = useState('');
  const [assignPickerId, setAssignPickerId] = useState(null);
  const [assignPick, setAssignPick] = useState('');

  const positions = roles.length;
  const totalNeeded = roles.reduce((s, r) => s + (Number(r.target) || 0), 0);
  const spotsUnfilled = roles.reduce((s, r) => s + Math.max((Number(r.target) || 0) - (r.assignedIds || []).length, 0), 0);

  function updateRole(id, patch) {
    onChange(roles.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRole(id) {
    onChange(roles.filter(r => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  }
  function addRole() {
    if (!draftName.trim()) return;
    const target = parseInt(draftTarget, 10);
    onChange([...roles, { id: Math.random().toString(36).slice(2, 8), name: draftName.trim(), target: Number.isFinite(target) ? target : 0, assignedIds: [] }]);
    setDraftName(''); setDraftTarget(''); setAddingRole(false);
  }
  function adjustTarget(role, delta) {
    updateRole(role.id, { target: Math.max(0, (Number(role.target) || 0) + delta) });
  }
  function assignVolunteer(role, volId) {
    if (!volId || (role.assignedIds || []).includes(volId)) return;
    updateRole(role.id, { assignedIds: [...(role.assignedIds || []), volId] });
    setAssignPick('');
  }
  function unassignVolunteer(role, volId) {
    updateRole(role.id, { assignedIds: (role.assignedIds || []).filter(id => id !== volId) });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Positions</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{positions}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Volunteers needed</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalNeeded}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Spots unfilled</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: spotsUnfilled > 0 ? '#c2410c' : 'var(--text)' }}>{spotsUnfilled}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Staffing Needs</div>
        {!addingRole && <button className="btn-ghost edit-only" style={{ fontSize: 12 }} onClick={() => setAddingRole(true)}>+ Add role</button>}
      </div>

      {addingRole && (
        <div className="card" style={{ display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 10, alignItems: 'center' }}>
          <input className="input" style={{ flex: 2 }} placeholder="Role name (e.g. Setup)" value={draftName} onChange={e => setDraftName(e.target.value)} autoFocus />
          <input className="input" type="number" min="0" style={{ width: 70 }} placeholder="Needed" value={draftTarget} onChange={e => setDraftTarget(e.target.value)} />
          <button className="btn-gold" style={{ padding: '7px 12px', fontSize: 12 }} onClick={addRole}>Add</button>
          <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => { setAddingRole(false); setDraftName(''); setDraftTarget(''); }}>Cancel</button>
        </div>
      )}

      {roles.length === 0 && !addingRole && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No staffing roles yet -- add one above.</div>
      )}

      {roles.map(role => {
        const assignedIds = role.assignedIds || [];
        const assignedVols = assignedIds.map(id => volunteers.find(v => v.id === id)).filter(Boolean);
        const target = Number(role.target) || 0;
        const isOpen = expandedId === role.id;
        const available = volunteers.filter(v => !assignedIds.includes(v.id));
        return (
          <div key={role.id} className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{role.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{assignedVols.length} of {target} assigned</div>
                {readOnly && assignedVols.length > 0 && <div style={{ fontSize: 12, marginTop: 3 }}>{assignedVols.map(volName).join(', ')}</div>}
              </div>
              <button onClick={() => adjustTarget(role, -1)} className="btn-ghost edit-only" style={{ width: 26, height: 26, padding: 0, borderRadius: '50%' }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{target}</span>
              <button onClick={() => adjustTarget(role, 1)} className="btn-ghost edit-only" style={{ width: 26, height: 26, padding: 0, borderRadius: '50%' }}>+</button>
              <button onClick={() => setExpandedId(isOpen ? null : role.id)} className="btn-ghost edit-only" style={{ width: 26, height: 26, padding: 0 }} title={isOpen ? 'Collapse' : 'Expand'}>{isOpen ? '▲' : '▼'}</button>
              <button className="edit-only" onClick={() => removeRole(role.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: '0 2px' }} title="Remove role">×</button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border-light)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Assigned volunteers</div>
                {assignedVols.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Nobody assigned yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {assignedVols.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12 }}>{volName(v)}</span>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => unassignVolunteer(role, v.id)}>Remove assignment</button>
                      </div>
                    ))}
                  </div>
                )}
                {assignPickerId === role.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="input" style={{ appearance: 'auto', flex: 1 }} value={assignPick} onChange={e => setAssignPick(e.target.value)}>
                      <option value="">Select a volunteer…</option>
                      {available.map(v => <option key={v.id} value={v.id}>{volName(v)}</option>)}
                    </select>
                    <button className="btn-gold" style={{ fontSize: 12, padding: '7px 12px' }} disabled={!assignPick} onClick={() => { assignVolunteer(role, assignPick); setAssignPickerId(null); }}>Assign</button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => { setAssignPickerId(null); setAssignPick(''); }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setAssignPickerId(role.id)}>Assign volunteer</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AreaFormSection({ fields, data, onFieldChange, volunteers, readOnly }) {
  return (
    <fieldset disabled={!!readOnly} className={'sheet-fieldset' + (readOnly ? ' sheet-readonly' : '')} style={{ display: 'flex', flexDirection: 'column', gap: readOnly ? 0 : 16 }}>
      {fields.map(f => (
        <div key={f.key} className="sheet-field">
          {f.type !== 'staffing' && <div className="label">{f.label}</div>}
          <Field field={f} value={data[f.key]} onChange={val => onFieldChange(f.key, val)} volunteers={volunteers} readOnly={readOnly} />
          {f.pairedDateKey && (data[f.key] === 'Yes' || data[f.key] === '') && (
            <div style={{ marginTop: 6, maxWidth: 180 }}>
              <div className="label">Date</div>
              <input className="input" type="date" value={data[f.pairedDateKey] || ''} onChange={e => onFieldChange(f.pairedDateKey, e.target.value)} />
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}

// ---------- Top-level Areas tab ----------

// editing / embedded: when a parent owns the Edit button (Volunteers, Staffing & Vendors share one), it passes editing and
// this tab hides its own tabs and buttons.
export default function AreasTab({ event, session, volunteer, initialArea, editing: editingProp, embedded, alwaysEdit }) {
  areaEvent = event;
  const [rows, setRows] = useState(null);
  const [volunteersDir, setVolunteersDir] = useState([]);
  const [activeArea, setActiveArea] = useState(initialArea || 'logistics');
  const [phase, setPhase] = useState('pre');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingState, setEditingState] = useState(false);
  const controlled = editingProp !== undefined;
  const editing = alwaysEdit ? true : (controlled ? editingProp : editingState);
  const setEditing = controlled ? () => {} : setEditingState;
  // While editing (say, one person typing during a meeting) changes save by themselves a moment after they stop typing.
  const dirtyRef = useRef(false);
  const dirtyAreaRef = useRef(null);
  const rowsRef = useRef(null);
  rowsRef.current = rows;
  const persistRef = useRef(null);

  useEffect(() => {
    fetchAreaData(event.id).then(setRows);
    fetchAllActiveVolunteers().then(v => setVolunteersDir(Array.isArray(v) ? v : [])).catch(() => setVolunteersDir([]));
  }, [event.id]);

  function persist(auto) {
    const key = dirtyAreaRef.current || activeArea;
    const def = AREA_DEFAULTS.find(a => a.key === key);
    const current = (rowsRef.current || []).find(r => r.area_key === key) || { pre_data: {}, post_data: {}, owner_name: def.defaultOwner };
    dirtyRef.current = false;
    setSaving(true);
    const fullName = `${volunteer?.['First Name'] || ''} ${volunteer?.['Last Name'] || ''}`.trim();
    return saveArea(event.id, key, { ownerName: current.owner_name, preData: current.pre_data, postData: current.post_data, authUserId: session.user.id }).then(res => {
      setSaving(false);
      if (res.success) {
        setSaved(true);
        if (!auto) {
          setEditing(false);
          logActivity({ vol: volunteer, authUserId: session.user.id, action: 'committee_area_updated', description: `${fullName || 'A volunteer'} updated ${def.label} notes for "${event.name}"` });
        }
      } else {
        dirtyRef.current = true;
      }
    });
  }
  persistRef.current = persist;

  useEffect(() => {
    if (!editing || !dirtyRef.current) return;
    const t = setTimeout(() => persistRef.current(true), 1000);
    return () => clearTimeout(t);
  }, [rows, editing]);
  // Done (or closing the section) saves anything still pending.
  useEffect(() => { if (!editing && dirtyRef.current && persistRef.current) persistRef.current(true); }, [editing]);
  // Leaving the section with unsaved typing still saves it.
  useEffect(() => () => { if (dirtyRef.current && persistRef.current) persistRef.current(true); }, []);

  if (rows === null) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>;

  const areaDef = AREA_DEFAULTS.find(a => a.key === activeArea);
  const row = rows.find(r => r.area_key === activeArea);
  const preData = (row && row.pre_data) || {};
  const postData = (row && row.post_data) || {};
  const schema = SCHEMAS[activeArea];
  const fields = (phase === 'pre' ? schema.pre : schema.post) || [];
  const data = phase === 'pre' ? preData : postData;

  function updateField(key, val) {
    dirtyRef.current = true;
    dirtyAreaRef.current = activeArea;
    setSaved(false);
    setRows(prev => {
      const next = prev.some(r => r.area_key === activeArea) ? prev.map(r => r.area_key === activeArea ? { ...r, [phase === 'pre' ? 'pre_data' : 'post_data']: { ...(phase === 'pre' ? r.pre_data : r.post_data), [key]: val } } : r)
        : [...prev, { area_key: activeArea, owner_name: areaDef.defaultOwner, pre_data: phase === 'pre' ? { [key]: val } : {}, post_data: phase === 'post' ? { [key]: val } : {} }];
      return next;
    });
  }

  function done() {
    if (dirtyRef.current) persist(false); else setEditing(false);
  }

  const tab = (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent', padding: '6px 0', marginBottom: -1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : 'var(--muted)', cursor: 'pointer' });

  return (
    <div>
      {/* Only show the area switcher when no specific area was requested (Marketing and Volunteers jump straight to theirs). */}
      {!initialArea && (
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', marginBottom: 16 }}>
          {AREA_DEFAULTS.filter(a => a.key !== 'volunteers' && a.key !== 'marketing').map(a => <button key={a.key} onClick={() => setActiveArea(a.key)} style={tab(activeArea === a.key)}>{a.label}</button>)}
        </div>
      )}

      {embedded ? (editing && <div style={{ fontSize: 12, color: saved && !saving ? '#2e7d32' : 'var(--muted)', marginBottom: 8 }}>{saving ? 'Saving…' : saved ? 'All changes saved ✓' : 'Changes save automatically'}</div>) : (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 22, borderBottom: '1px solid var(--border-light)' }}>
          <button onClick={() => setPhase('pre')} style={tab(phase === 'pre')}>Pre-Event</button>
          {schema.post && schema.post.length > 0 && <button onClick={() => setPhase('post')} style={tab(phase === 'post')}>Post-Event</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {editing && <span style={{ fontSize: 12, color: saved && !saving ? '#2e7d32' : 'var(--muted)' }}>{saving ? 'Saving…' : saved ? 'All changes saved ✓' : 'Changes save automatically'}</span>}
          {alwaysEdit ? null : (editing ? <button className="btn-gold" disabled={saving} onClick={done}>Done</button> : <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>)}
        </div>
      </div>
      )}

      {fields.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>Nothing to fill in here.</div>}
      <AreaFormSection fields={fields} data={data} onFieldChange={updateField} volunteers={volunteersDir} readOnly={!editing} />

      {editing && !embedded && !alwaysEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
          <button className="btn-gold" disabled={saving} onClick={done}>Done</button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{saving ? 'Saving…' : saved ? 'All changes saved ✓' : ''}</span>
        </div>
      )}
    </div>
  );
}
