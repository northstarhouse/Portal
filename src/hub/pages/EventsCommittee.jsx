// GENERATED from volunteerhub/src/pages/EventsCommittee.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
import { useState, useEffect, useRef } from 'react';
import { MediaPicker } from '../../media-library.jsx';
import { useVol } from '../App.jsx';
import {
  insertReimbursement, fetchAreaData, saveArea, sendChecklistEmail, matchVolunteerAreas, syncVendorExpenses, fetchEventCardMeta, saveEventCardMeta, pushCommitteeEventToWebsite, SITE_SUPABASE_URL, SITE_SUPABASE_KEY, fetchEventNames, fetchEventFinancials, fetchEventTicketStats, fetchEventCardImage, uploadEventFlyer, fetchAllEventCards, fetchCommitteeEvents, insertCommitteeEvent, insertCommitteeEventIfMissing, updateCommitteeEvent, deleteCommitteeEvent,
  fetchAllActiveVolunteers, syncInHouseEvent, logActivity, fetchEventMarketingNA, setEventMarketingNA, fetchHiddenCommitteeEvents, syncOverviewCardsFromCommittee,
  fetchEventFeedback, insertEventFeedback, updateEventFeedback, deleteEventFeedback,
} from '../lib/db.js';
import AreasTab, { PLANNING_PROMPTS, NSH_SPACES, MARKETING_CHANNELS } from './eventsCommitteeAreas.jsx';
import EventOverviews from './EventOverviews.jsx';
import RsvpPanel from './RsvpPanel.jsx';
import EventPlan from './EventPlan.jsx';

const cryptoId = () => Math.random().toString(36).slice(2, 10);
const nextDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date set';
const fmtDateShort = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
const fmtTime12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const MINUTES = ['00', '15', '30', '45'];
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Native <input type="time"> doesn't reliably restrict the minute picker to
// a fixed step across browsers, so use plain selects instead — guarantees
// only :00/:15/:30/:45 no matter what.
function TimeSelect({ value, onChange }) {
  const [h24, m] = value ? value.split(':').map(Number) : [null, null];
  const hour12 = h24 === null ? '' : (h24 % 12 || 12);
  const ampm = h24 === null ? 'AM' : (h24 >= 12 ? 'PM' : 'AM');
  const minute = m === null ? '00' : String(m - (m % 15)).padStart(2, '0');

  function update(nextHour12, nextMinute, nextAmpm) {
    if (nextHour12 === '') { onChange(''); return; }
    let h = parseInt(nextHour12, 10) % 12;
    if (nextAmpm === 'PM') h += 12;
    onChange(`${String(h).padStart(2, '0')}:${nextMinute}`);
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select className="input" style={{ appearance: 'auto' }} value={hour12} onChange={e => update(e.target.value, minute, ampm)}>
        <option value="">--</option>
        {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select className="input" style={{ appearance: 'auto' }} value={minute} onChange={e => update(hour12 || 12, e.target.value, ampm)}>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select className="input" style={{ appearance: 'auto' }} value={ampm} onChange={e => update(hour12 || 12, minute, e.target.value)}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

const EVENT_PURPOSES = ['Educational', 'Entertainment', 'Community Engagement', 'Fundraising Support'];

function emptyEvent(name) {
  return {
    id: cryptoId(), name, date: '', startTime: '', endTime: '', location: '', description: '', status: 'planning',
    purpose: '', expectedAttendance: '', pricing: '', ticketTiers: [], siteEventId: null, website: {}, eventLead: '', volunteersNeeded: '',
    checklist: [], notes: [], vendors: [], guestCount: { invited: 0, confirmed: 0 }, timeline: [],
    afterNotes: { wentWell: '', wentWrong: '', finalAttendance: '', finalBudget: '', followUps: '' },
  };
}

// Map between the app's camelCase shape and the events_committee table's columns.
function fromDb(row) {
  return {
    id: row.id,
    in_house_event_id: row.in_house_event_id || null,
    name: row.name,
    date: row.date || '',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    location: row.location || '',
    description: row.description || '',
    status: row.status || 'planning',
    purpose: row.purpose || '',
    expectedAttendance: row.expected_attendance || '',
    pricing: row.pricing || '',
    ticketTiers: Array.isArray(row.ticket_tiers) ? row.ticket_tiers : [],
    siteEventId: row.site_event_id || null,
    website: row.website && typeof row.website === 'object' ? row.website : {},
    eventLead: row.event_lead || '',
    volunteersNeeded: row.volunteers_needed ?? '',
    guestCount: { invited: row.guest_invited || 0, confirmed: row.guest_confirmed || 0 },
    checklist: row.checklist || [],
    notes: Array.isArray(row.notes) ? row.notes : [],
    vendors: row.vendors || [],
    timeline: row.timeline || [],
    afterNotes: (row.after_notes && Object.keys(row.after_notes).length)
      ? row.after_notes
      : { wentWell: '', wentWrong: '', finalAttendance: '', finalBudget: '', followUps: '' },
  };
}
function toDb(ev) {
  return {
    name: ev.name,
    date: ev.date || null,
    start_time: ev.startTime || null,
    end_time: ev.endTime || null,
    location: ev.location || null,
    description: ev.description || null,
    status: ev.status,
    purpose: ev.purpose || null,
    expected_attendance: ev.expectedAttendance || null,
    pricing: ev.pricing || null,
    ticket_tiers: ev.ticketTiers || [],
    site_event_id: ev.siteEventId || null,
    website: ev.website || {},
    event_lead: ev.eventLead || null,
    volunteers_needed: ev.volunteersNeeded === '' || ev.volunteersNeeded == null ? null : Number(ev.volunteersNeeded),
    guest_invited: ev.guestCount.invited || 0,
    guest_confirmed: ev.guestCount.confirmed || 0,
    checklist: ev.checklist,
    notes: ev.notes || [],
    vendors: ev.vendors,
    timeline: ev.timeline,
    after_notes: ev.afterNotes,
  };
}

// One-time migration: events created before the unified checklist existed
// have their items split across the old `tasks` and `budget` jsonb columns.
// The first time such a row loads, merge both into `checklist` and persist
// the merge (clearing tasks/budget) so it never runs again for that event —
// nothing is lost, it just moves into the new shape.
function migrateLegacyChecklist(rows) {
  return Promise.all(rows.map(async row => {
    const hasChecklist = Array.isArray(row.checklist) && row.checklist.length > 0;
    const legacyTasks = Array.isArray(row.tasks) ? row.tasks : [];
    const legacyBudget = Array.isArray(row.budget) ? row.budget : [];
    if (hasChecklist || (!legacyTasks.length && !legacyBudget.length)) return row;
    const merged = [
      ...legacyTasks.map(t => ({
        id: t.id || cryptoId(), done: !!t.done, text: t.text || '', due: t.due || '',
        assignee: t.assignee || '', assigneeId: t.assigneeId || null, priority: t.priority || '',
        estimated: 0, actual: 0, notes: '', subtasks: [],
      })),
      ...legacyBudget.map(b => ({
        id: b.id || cryptoId(), done: false, text: b.item || '', due: '', assignee: '', assigneeId: null,
        priority: '', estimated: Number(b.estimated) || 0, actual: Number(b.actual) || 0, notes: '', subtasks: [],
      })),
    ];
    await updateCommitteeEvent(row.id, { checklist: merged, tasks: [], budget: [] });
    return { ...row, checklist: merged, tasks: [], budget: [] };
  }));
}

const money = (n) => `$${Number(n || 0).toLocaleString()}`;

// Shared section-header treatment across every tab in the event workspace —
// uppercase + letter-spaced + a thin rule, so headers read as clear
// dividers between sections of one continuous page instead of blending
// into the body copy around them.
const SECTION_HEAD = {
  fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border-light)',
};

const STATUS_STYLE = {
  planning:      { bg: '#fde8e0', fg: '#8a4a2e', label: 'Planning' },
  upcoming:      { bg: '#f0ebe2', fg: 'var(--gold)', label: 'Upcoming' },
  needs_review:  { bg: '#fde8e0', fg: '#c2410c', label: 'Needs Final Review' },
  completed:     { bg: '#e3f6ec', fg: '#4a5d3a', label: 'Completed' },
  cancelled:     { bg: '#f5e2e2', fg: '#a04545', label: 'Cancelled' },
};
// ── Home: event cards (flyer + revenue/expenses), grouped Upcoming/Past ─────
// Same data/markup as Dashboard's "Upcoming Events" teaser card and Portal's
// Event Overviews page -- the committee's full list should look like those,
// not a from-scratch calendar grid.

function EventFlyerCard({ c, onOpen }) {
  const dateStr = c.date ? new Date(`${c.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date set';
  const cancelled = c.status === 'cancelled';
  const style = cancelled ? STATUS_STYLE.cancelled : null;
  return (
    <div onClick={() => onOpen(c.name)}
      style={{ background: '#fff', border: '0.5px solid ' + (cancelled ? style.fg : 'var(--border-light)'), borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', opacity: cancelled ? 0.75 : 1 }}>
      {cancelled && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: style.bg, color: style.fg, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4, zIndex: 1 }}>{style.label}</div>
      )}
      <div style={{
        width: '100%', aspectRatio: '3/4', backgroundColor: 'var(--light)',
        backgroundImage: c.image_url ? `url(${c.image_url})` : 'linear-gradient(135deg,var(--light),#e4d9c6)',
        backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        filter: cancelled ? 'grayscale(0.6)' : 'none',
      }} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{dateStr}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11 }}>
          {!cancelled && (c.rsvp_only ? <span style={{ background: '#f0ebe2', color: 'var(--gold)', fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4 }}>RSVP</span> : <span style={{ color: '#4a5d3a', fontWeight: 600 }}>{money(c.earnings)}</span>)}
          <span style={{ color: '#c07040', fontWeight: 600 }}>-{money(c.costs)}</span>
        </div>
      </div>
    </div>
  );
}

function EventCardsGrid({ onOpen }) {
  const [cards, setCards] = useState(null);

  const load = () => fetchAllEventCards().then(setCards).catch(() => setCards({ upcoming: [], past: [] }));
  useEffect(() => { load(); }, []);

  if (cards === null) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>;
  if (cards.upcoming.length === 0 && cards.past.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '30px 0' }}>No events on the books yet.</div>;
  }

  return (
    <div>
      {cards.upcoming.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Upcoming Events</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {cards.upcoming.map(c => <EventFlyerCard key={c.name} c={c} onOpen={onOpen} />)}
          </div>
        </div>
      )}
      {cards.past.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Past Events</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {cards.past.map(c => <EventFlyerCard key={c.name} c={c} onOpen={onOpen} />)}
          </div>
        </div>
      )}
      <HiddenEvents onChanged={load} />
    </div>
  );
}

// "Reports" dropdown: P&L, Feedback and Plans open in a popout over this page.
const REPORT_TABS = [
  { key: 'pnl', label: 'Profit & Loss' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'plans', label: 'Plans' },
];
function ReportsMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [report, setReport] = useState(null);
  return (
    <>
      <div style={{ position: 'relative' }}>
        <button className="btn-ghost" onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>Reports ▾</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
            <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 31, background: '#fff', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: 170, overflow: 'hidden' }}>
              {REPORT_TABS.map(t => (
                <button key={t.key} role="menuitem" onClick={() => { setMenuOpen(false); setReport(t); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-light)', padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {report && (
        <div onClick={e => { if (e.target === e.currentTarget) setReport(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(35,38,43,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', width: '100%', maxWidth: 1100, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#fff', borderBottom: '0.5px solid var(--border-light)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: 'var(--gold)' }}>{report.label}</div>
              <button onClick={() => setReport(null)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
            </div>
            <EventOverviews initialTab={report.key} embedded />
          </div>
        </div>
      )}
    </>
  );
}

// Events someone hid from the cards, with a way to bring them back.
function HiddenEvents({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const refresh = () => fetchHiddenCommitteeEvents().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); }, []);
  if (!rows.length) return null;
  async function unhide(r) {
    await updateCommitteeEvent(r.id, { hidden: false });
    await refresh();
    onChanged();
  }
  return (
    <div style={{ marginTop: 24, borderTop: '0.5px solid var(--border-light)', paddingTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
        {open ? 'Hide' : 'Show'} hidden events ({rows.length})
      </button>
      {open && rows.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13 }}>
          <span style={{ flex: 1 }}>{r.name}{r.date ? <span style={{ color: 'var(--muted)' }}> · {r.date}</span> : null}</span>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => unhide(r)}>Show on cards again</button>
        </div>
      ))}
    </div>
  );
}

// ── Detail tabs ─────────────────────────────────────────────────────────────

const PLANNING_SECTION_ICONS = {
  preplanning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  checklist: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  marketing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  volunteers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  vendors: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>,
  'areas-other': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  budget: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
  dayof: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  reviews: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  after: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

PLANNING_SECTION_ICONS.attendance = PLANNING_SECTION_ICONS.volunteers;

const PLANNING_SECTIONS = [
  { key: 'checklist', title: 'Checklist', desc: 'Type the duties in fast, then assign and date them' },
  { key: 'attendance', title: 'Volunteers in Attendance', desc: 'Everyone assigned on the checklist, plus anyone you add' },
  { key: 'marketing', title: 'Marketing & Promotion', desc: 'Flyers, newsletters, website, social media', area: 'marketing' },
  { key: 'budget', title: 'Budget & Transactions', desc: 'Income, expenses, reimbursements' },
  { key: 'after', title: 'After the Event', desc: 'What went well, final numbers, follow-ups, reviews and feedback' },
];

// The checklist is the one place everything lives, tagged by category so each area can be checked off as figured out.
const CHECKLIST_CATEGORIES = ['General', 'Logistics', 'Hospitality', 'Sponsorship', 'Interiors', 'Marketing', 'Money', 'Volunteers & vendors'];
const DAYOF_CAT = 'Day-of timeline';
// The little icon at the start of each checklist group.
const catIcon = (inner) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{inner}</svg>;
const CATEGORY_ICONS = {
  General: catIcon(<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>),
  Logistics: catIcon(<><path d="M16.5 9.4L7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>),
  Hospitality: catIcon(<><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>),
  Sponsorship: catIcon(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>),
  Interiors: catIcon(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  Marketing: catIcon(<><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></>),
  Budget: catIcon(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  Money: catIcon(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  'Volunteers & vendors': catIcon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  'Day-of timeline': catIcon(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
};
const checkCat = (c) => (CHECKLIST_CATEGORIES.includes(c) ? c : 'General');
// Things we still need (a bartender, a sponsor...) are handled once someone is named, it is confirmed, or enough volunteers are assigned.
const needHandled = (v) => !!v.confirmed || !!v.who || !!v.role
  || (['volunteer', 'activity'].includes(v.kind) && needPeopleCount(v) >= Math.max(1, Number(v.target) || 1));
// What the line is about. Older entries stored the person in name and the job (Santa Claus) in role.
const needTitle = (v) => (v.role && !v.who ? v.role : v.name);
const needCategory = (v) => (v.kind === 'sponsor' ? 'Sponsorship' : 'Volunteers & vendors');
const NEED_TAG = { vendor: 'Vendor', contact: 'Contact', volunteer: 'Volunteer', activity: 'Activity', sponsor: 'Sponsor' };

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function OverviewTab({ ev, onUpdate, onEdit, onDelete, volunteers, session, volunteer }) {
  const [marketingNA, setMarketingNA] = useState(false);
  useEffect(() => { fetchEventMarketingNA(ev.name).then(setMarketingNA).catch(() => {}); }, [ev.name]);
  function toggleMarketingNA(v) {
    setMarketingNA(v);
    setEventMarketingNA(ev.name, v).catch(() => { setMarketingNA(!v); alert('Could not save. Please try again.'); });
  }
  const [ticketStats, setTicketStats] = useState(null);
  // RSVP events have no ticket sales, so that box reads N/A.
  const [rsvpOnly, setRsvpOnly] = useState(false);
  const [basicsOpen, setBasicsOpen] = useState(false);
  const [emailTick, setEmailTick] = useState(0);
  useEffect(() => { let live = true; setRsvpOnly(false); fetchEventCardMeta(ev.name).then(m => { if (live) setRsvpOnly(!!(m && m.rsvp_only)); }).catch(() => {}); return () => { live = false; }; }, [ev.name]);
  const [financials, setFinancials] = useState(null);
  const [flyerUrl, setFlyerUrl] = useState(null);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const flyerInputRef = useRef(null);

  useEffect(() => {
    fetchEventTicketStats(ev.name).then(setTicketStats).catch(() => setTicketStats({ ticketsSold: 0, revenue: 0 }));
    fetchEventFinancials(ev.name).then(setFinancials).catch(() => setFinancials({ expenses: [], earnings: [] }));
    fetchEventCardImage(ev.name).then(setFlyerUrl).catch(() => setFlyerUrl(null));
  }, [ev.name]);

  // Vendor costs log themselves as expenses (and a share of ticket sales follows the sales so far).
  const costSig = JSON.stringify(ev.vendors.map(v => [v.id, v.name, v.who || '', v.costType || '', v.cost || 0, v.splitPct || 0]));
  useEffect(() => {
    let live = true;
    fetchEventTicketStats(ev.name).catch(() => ({ revenue: 0 })).then(t => syncVendorExpenses(ev.name, ev.vendors, rsvpOnly ? 0 : t.revenue, session && session.user && session.user.id))
      .then(changed => { if (live && changed) fetchEventFinancials(ev.name).then(setFinancials).catch(() => {}); }).catch(() => {});
    return () => { live = false; };
  }, [ev.name, costSig, rsvpOnly]);
  const openNeeds = ev.vendors.filter(v => !needHandled(v));
  const doneT = ev.checklist.filter(t => t.done).length + (ev.vendors.length - openNeeds.length);
  const total = ev.checklist.length + ev.vendors.length;
  const cardRows = [...ev.checklist.filter(t => !t.done).map(t => ({ need: false, t })), ...openNeeds.map(v => ({ need: true, v })), ...ev.checklist.filter(t => t.done).map(t => ({ need: false, t }))].slice(0, 6);
  const pct = total ? Math.round((doneT / total) * 100) : 0;

  // Ticket Sales and Other Earnings are two separate, non-overlapping
  // income sources -- live website ticket sales (ticket_orders) vs. other
  // earnings logged by hand in Portal's Op Earnings (sponsorships, door
  // cash, etc.) -- shown as their own boxes rather than combined, since
  // that's how the committee actually tracks where the money came from.
  const ticketSales = !rsvpOnly && ticketStats ? ticketStats.revenue : 0;
  const otherEarnings = financials ? financials.earnings.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) : 0;
  const expenses = financials ? financials.expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) : 0;
  const netProfit = ticketSales + otherEarnings - expenses;

  const upcomingDeadlines = ev.checklist
    .filter(t => !t.done && t.due)
    .slice().sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 3);

  function toggleChecklistItem(id) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }

  function handleFlyerUpload(file) {
    if (!file || uploadingFlyer) return;
    setUploadingFlyer(true);
    uploadEventFlyer(ev.name, file).then(url => {
      setFlyerUrl(url);
      setUploadingFlyer(false);
    }).catch(err => { setUploadingFlyer(false); alert('Upload failed: ' + (err.message || 'unknown error')); });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", marginBottom: 4 }}>{ev.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{fmtDate(ev.date)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select className="input" style={{ appearance: 'auto', fontSize: 12 }} value={ev.status}
                onChange={e => onUpdate(x => ({ ...x, status: e.target.value }))}>
                <option value="planning">Planning</option>
                <option value="upcoming">Upcoming</option>
                <option value="needs_review">Needs Final Review</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setBasicsOpen(v => !v)}>{basicsOpen ? 'Close' : 'Edit'}</button>
              {onDelete && <button className="btn-ghost" style={{ fontSize: 12, color: '#a04545' }} onClick={onDelete}>Delete</button>}
            </div>
            <button className="btn-gold" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => { setExpandedSection('checklist'); setEmailTick(n => n + 1); }}>✉ Email update to committee</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatBox label="Ticket Sales" value={rsvpOnly ? 'N/A' : money(ticketSales)} sub={rsvpOnly ? 'RSVP event, no tickets' : (ticketStats ? `${ticketStats.ticketsSold} sold` : null)} color={rsvpOnly ? 'var(--muted)' : undefined} />
            <StatBox label="Other Earnings" value={money(otherEarnings)} />
            <StatBox label="Expenses" value={money(expenses)} />
            <StatBox label="Net" value={money(netProfit)} color={netProfit >= 0 ? '#4a5d3a' : '#8a4a2e'} />
          </div>
        </div>

        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {flyerUrl ? (
            <img src={flyerUrl} alt="Event flyer" style={{ width: '100%', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>
              No flyer yet
            </div>
          )}
          <input ref={flyerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) handleFlyerUpload(f); }} />
          <button className="btn-ghost" style={{ width: '100%' }} disabled={uploadingFlyer}
            onClick={() => flyerInputRef.current && flyerInputRef.current.click()}>
            {uploadingFlyer ? 'Uploading…' : (flyerUrl ? 'Replace Flyer' : '+ Upload Flyer')}
          </button>
        </div>
      </div>

      {basicsOpen && (
        <div className="card" style={{ padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Event Basics</div>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setBasicsOpen(false)}>Close</button>
          </div>
          <PreplanningTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} onRsvpChange={setRsvpOnly} autoEdit onClose={() => setBasicsOpen(false)} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Planning progress</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{doneT} of {total} tasks complete</div>
      </div>
      <div style={{ height: 6, background: 'var(--light)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 4 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Planning checklist</div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          {ev.checklist.length + ev.vendors.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No checklist items yet -- add some in Checklist.</div>
          ) : cardRows.map(row => row.need ? (
            <div key={row.v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed var(--border)' }} />
              <span style={{ fontSize: 13 }}>Find: {needTitle(row.v)}{row.v.kind ? <span style={{ fontSize: 11, color: 'var(--muted)' }}> · {NEED_TAG[row.v.kind]}</span> : null}{(() => { const n = whoOn(row.v, volunteers).map(x => x.name).join(', ') || row.v.who || ''; return n ? <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>  —  {n}</span> : null; })()}</span>
            </div>
          ) : ((t) => (
            <div key={t.id} onClick={() => toggleChecklistItem(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.done ? 'var(--text)' : 'transparent', border: t.done ? 'none' : '1.5px solid var(--border)',
              }}>
                {t.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              <span style={{ fontSize: 13, color: t.done ? 'var(--muted)' : 'var(--text)', textDecoration: 'none' }}>{t.text}{t.assignee ? <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>  —  {t.assignee}</span> : null}</span>
            </div>
          ))(row.t))}
          {upcomingDeadlines.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6, paddingTop: 12, borderTop: '0.5px solid var(--border-light)' }}>Upcoming deadlines</div>
              {upcomingDeadlines.map(t => (
                <div key={t.id} style={{ fontSize: 13, marginBottom: 4 }}>{fmtDateShort(t.due)} &middot; {t.text}</div>
              ))}
            </>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Event details</div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          {(() => {
            // Everything here comes from Event Basics.
            const w = ev.website || {};
            const when = w.date_tbd ? 'To be announced' : [ev.date ? fmtDate(ev.date) : '', ev.startTime ? fmtTime12(ev.startTime) + (ev.endTime ? ' – ' + fmtTime12(ev.endTime) : '') : ''].filter(Boolean).join('  ·  ');
            const where = [w.location_name || ev.location, (w.spaces || []).length ? (w.spaces || []).join(', ') : ''].filter(Boolean).join(' — ');
            const tiers = (ev.ticketTiers || []).filter(t => t && String(t.name || '').trim());
            const tickets = rsvpOnly ? 'RSVP only (no ticket sales)' : (w.sells_tickets && tiers.length ? tiers.map(t => t.name + ' ' + (Number(t.price) > 0 ? '$' + t.price : 'free')).join('  |  ') : '');
            const volNeed = ev.vendors.filter(v => ['volunteer', 'activity'].includes(v.kind)).reduce((n, v) => n + (Number(v.target) || 0), 0) || (ev.volunteersNeeded === '' || ev.volunteersNeeded == null ? 0 : Number(ev.volunteersNeeded));
            const rows = [
              ['Date and time', when, true],
              ['Event type', ev.purpose],
              ['Location', where],
              ['Event lead', ev.eventLead],
              ['Expected guests', ev.expectedAttendance || (ev.guestCount.invited ? String(ev.guestCount.invited) : '')],
              ['Tickets', tickets],
              ['Pricing', ev.pricing],
              ['Volunteers needed', volNeed ? String(volNeed) : ''],
              ['Website', ev.siteEventId ? 'Live on the website' : 'Not on the website yet'],
            ];
            return (
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rows.filter(r => r[1] || r[2]).map(r => (
                  <div key={r[0]}><strong>{r[0]}:</strong> {r[1] ? r[1] : <span style={{ color: '#b8863b', fontStyle: 'italic' }}>not filled in yet</span>}</div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid var(--border-light)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Planning sections</div>
          <span className="badge" style={{ background: 'var(--light)', color: 'var(--text)' }}>{PLANNING_SECTIONS.length} sections</span>
        </div>
        {PLANNING_SECTIONS.map((s, i) => {
          const isOpen = expandedSection === s.key;
          return (
            <div key={s.key} style={{ borderBottom: i < PLANNING_SECTIONS.length - 1 || isOpen ? '0.5px solid var(--border-light)' : 'none' }}>
              <div onClick={() => setExpandedSection(isOpen ? null : s.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <span style={{ color: 'var(--gold)', flexShrink: 0 }}>{PLANNING_SECTION_ICONS[s.key]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}{s.key === 'marketing' && marketingNA && <span className="badge" style={{ marginLeft: 8, background: 'var(--light)', color: 'var(--muted)' }}>N/A</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.desc}</div>
                </div>
                <span style={{ color: 'var(--muted)', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&rsaquo;</span>
              </div>
              {isOpen && (
                <div style={{ padding: '4px 16px 18px' }}>
                  {s.key === 'preplanning' && <PreplanningTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} onRsvpChange={setRsvpOnly} />}
                  {s.key === 'attendance' && <AttendanceTab ev={ev} volunteers={volunteers} />}
                  {s.key === 'checklist' && <ChecklistTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} showMarketing={!marketingNA} emailTick={emailTick} />}
                  {s.key === 'budget' && <FinancialsTab ev={ev} />}
                  {s.key === 'dayof' && <SheetToggle view={<DayOfView ev={ev} onUpdate={onUpdate} volunteers={volunteers} />}><DayOfTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} /></SheetToggle>}
                  {s.key === 'after' && (
                    <div>
                      <AfterTab ev={ev} onUpdate={onUpdate} />
                      <div style={{ ...SECTION_HEAD, marginTop: 28 }}>Reviews & feedback</div>
                      <ReviewsTab ev={ev} />
                    </div>
                  )}
                  {s.key === 'marketing' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={marketingNA} onChange={e => toggleMarketingNA(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} />
                      Marketing is not applicable for this event
                    </label>
                  )}
                  {s.key === 'marketing' && marketingNA ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Marked not applicable. Untick the box above to plan marketing for this event.</div>
                  ) : (s.key === 'marketing') && (
                    <AreasTab event={ev} session={session} volunteer={volunteer} initialArea={s.area} alwaysEdit />
                  )}
                  {s.key === 'volunteers' && <NeedsList ev={ev} onUpdate={onUpdate} volunteers={volunteers} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Round tick circle used on the checklist lines.
function CheckCircle({ checked, onChange, size }) {
  const d = size || 18;
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
      style={{ width: d, height: d, borderRadius: '50%', flexShrink: 0, padding: 0, cursor: 'pointer', border: checked ? 'none' : '1.5px solid var(--border)', background: checked ? 'var(--gold)' : 'transparent', color: '#fff', fontSize: Math.round(d * 0.62), lineHeight: d + 'px', textAlign: 'center' }}>{checked ? '✓' : ''}</button>
  );
}

function ItemRow({ children, onDelete, done, accent, onAccent, accentTitle }) {
  return (
    <div className="row-x-host" tabIndex={-1} style={{
      outline: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0 9px 10px', position: 'relative',
      borderBottom: '0.5px solid var(--border-light)', borderLeft: `4px solid ${accent || 'transparent'}`,
    }}>
      {onAccent && <button type="button" onClick={onAccent} title={accentTitle} aria-label={accentTitle} style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} />}
      {children}
      {onDelete && <button className="row-x" onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>}
    </div>
  );
}

// When a duty is due, counted back from the event: a month, two weeks or a week out. As soon as possible has no date.
function dueForTiming(timing, eventDate) {
  if (timing === 'dayof') return eventDate || '';
  const back = { month: 'month', twoweeks: 14, week: 7 }[timing];
  if (!back || !eventDate) return '';
  const d = new Date(eventDate + 'T12:00:00');
  if (isNaN(d)) return '';
  if (back === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - back);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const TASK_PRIORITY = {
  high:   { label: 'High priority',   color: '#c0392b' },
  medium: { label: 'Medium priority', color: '#d9822b' },
};
function nextPriority(p) { return !p ? 'medium' : p === 'medium' ? 'high' : ''; }

function PriorityDot({ priority, onClick }) {
  const p = TASK_PRIORITY[priority];
  return (
    <button type="button" onClick={onClick} title={p ? `${p.label} — click to change` : 'No priority — click to set'}
      style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0, padding: 0, cursor: 'pointer',
        border: p ? 'none' : '1.5px solid var(--border)', background: p ? p.color : 'transparent',
      }} />
  );
}

function AssigneeMentionInput({ assignee, assigneeId, onChange, volunteers }) {
  const [query, setQuery] = useState(assignee || '');
  const [open, setOpen] = useState(false);

  useEffect(() => { setQuery(assignee || ''); }, [assignee]);

  const showList = query.startsWith('@');
  const search = query.slice(1).trim().toLowerCase();
  const filtered = showList
    ? (volunteers || []).filter(v => `${v['First Name']} ${v['Last Name']}`.toLowerCase().includes(search)).slice(0, 8)
    : [];

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    onChange(val, null);
    setOpen(val.startsWith('@'));
  }

  function select(v) {
    const name = `${v['First Name']} ${v['Last Name']}`.trim();
    setQuery(name);
    onChange(name, v.id);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', width: 130 }}>
      <input className="input" placeholder="@ Assignee" value={query}
        onChange={handleChange}
        onFocus={() => { if (query.startsWith('@')) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 30, marginTop: 2, minWidth: 180,
          maxHeight: 180, overflowY: 'auto', background: '#fff', border: '0.5px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        }}>
          {filtered.map(v => (
            <div key={v.id} onMouseDown={() => select(v)}
              style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              {v['First Name']} {v['Last Name']}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A section as a ready sheet: the read-only view with an Edit button. Edit swaps in the editor, Done goes back.
function SheetToggle({ view, children }) {
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className={editing ? 'btn-gold' : 'btn-ghost'} style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit'}</button>
      </div>
      {editing ? children : view}
    </div>
  );
}

function VendorsView({ ev }) {
  if (!ev.vendors.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No vendors or contacts yet. Click Edit to add some.</div>;
  return (
    <div>
      {ev.vendors.map(v => (
        <div key={v.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
          <span style={{ width: 15, flexShrink: 0, color: v.confirmed ? 'var(--gold)' : 'var(--muted)' }} title={v.confirmed ? 'Confirmed' : 'Not confirmed yet'}>{v.confirmed ? '✓' : '○'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}{v.role && <span style={{ fontWeight: 400, color: 'var(--muted)' }}> — {v.role}</span>}</div>
            {v.contact && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.contact}</div>}
            <div style={{ fontSize: 12, marginTop: 2, color: v.formStatus === 'Received' ? '#2e7d32' : v.formStatus === 'Sent' ? '#886c44' : '#b8863b' }}>Vendor form: {v.formStatus || 'not tracked yet'}</div>
            {v.notes && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{v.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Volunteers, Staffing & Vendors as one list: write down what we need ("Magician", "4 setup volunteers"), then later fill in
// who we found and how to reach them, and say whether it is a vendor, a contact or a volunteer role.
// A vendor's cost is a flat fee, or their share of ticket sales (50/50, 60/40...).
const SPLIT_PRESETS = [['50', '50 / 50  (vendor 50%, North Star 50%)'], ['60', '60 / 40  (vendor 60%, North Star 40%)'], ['70', '70 / 30  (vendor 70%, North Star 30%)'], ['40', '40 / 60  (vendor 40%, North Star 60%)'], ['30', '30 / 70  (vendor 30%, North Star 70%)']];
const costLabel = (v) => (v.costType === 'flat' && Number(v.cost) > 0 ? '$' + Number(v.cost).toLocaleString() + ' flat' : v.costType === 'split' && Number(v.splitPct) > 0 ? Number(v.splitPct) + '% of ticket sales' : '');
const NEED_KINDS = { vendor: 'Vendor', contact: 'Contact', volunteer: 'Volunteer', activity: 'Activity', sponsor: 'Sponsor' };
const volFullName = (v) => `${v['First Name'] || ''} ${v['Last Name'] || ''}`.trim() || 'Unnamed';

// Assign volunteers to a need: type to search the roster, or type any name that isn't on it.
// Roster picks go in assignedIds (phone shown from the roster; an edited number is kept in phones[id]).
// Typed-in names go in people [{ id, name, phone }]. Everyone assigned gets a phone box, blank when unknown.
const needPeopleCount = (v) => (v.assignedIds || []).length + (v.people || []).length;
function AssignVolunteers({ v, volunteers, onPatch, compact, target, hideList }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const roster = volunteers || [];
  const name = (x) => ((x['First Name'] || '') + ' ' + (x['Last Name'] || '')).trim() || 'Unnamed';
  const assigned = (v.assignedIds || []).map(id => roster.find(x => x.id === id)).filter(Boolean);
  const people = v.people || [];
  const term = q.trim().toLowerCase();
  const matches = term ? roster.filter(x => !(v.assignedIds || []).includes(x.id) && name(x).toLowerCase().includes(term)).slice(0, 8) : [];
  const exact = matches.find(x => name(x).toLowerCase() === term);
  const pick = (x) => { onPatch({ assignedIds: [...(v.assignedIds || []), x.id] }); setQ(''); setOpen(false); };
  const addTyped = () => { const t = q.trim(); if (!t) return; onPatch({ people: [...people, { id: cryptoId(), name: t, phone: '' }] }); setQ(''); setOpen(false); };
  const fs = compact ? 12 : 13;
  const filled = (v.assignedIds || []).length + (v.people || []).length;
  const full = Number(target) > 0 && filled >= Number(target);
  const phoneBox = (value, save) => (
    <input className="input" placeholder="Phone" defaultValue={value || ''} key={value || ''} onBlur={e => { const t = e.target.value.trim(); if (t !== (value || '')) save(t); }}
      style={{ width: compact ? 110 : 140, fontSize: fs, padding: compact ? '3px 6px' : '5px 8px' }} />
  );
  const removeBtn = (onClick) => <button type="button" className="row-x" onClick={onClick} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 4px', fontSize: 14 }}>×</button>;
  return (
    <div style={{ width: compact ? 'auto' : '100%' }}>
      {Number(target) > 0 && <div style={{ fontSize: 12, color: full ? '#2e7d32' : '#b8863b', fontWeight: 600, marginBottom: 6 }}>{full ? 'All ' + target + ' spots filled ✓' : (Number(target) - filled) + ' of ' + target + ' spots still open'}</div>}
      {!full && <div style={{ position: 'relative', width: compact ? 190 : '100%' }}>
        <input className="input" value={q} placeholder={Number(target) > 0 ? 'Type a name for an open spot…' : 'Type a name to assign…'} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (exact) pick(exact); else if (matches.length === 1) pick(matches[0]); else addTyped(); } if (e.key === 'Escape') setOpen(false); }}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: fs, padding: compact ? '5px 8px' : undefined }} />
        {open && term && (
          <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, marginTop: 2, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto' }}>
            {matches.map(x => (
              <button type="button" key={x.id} onMouseDown={e => { e.preventDefault(); pick(x); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-light)', padding: '7px 10px', cursor: 'pointer', fontSize: fs, fontFamily: 'inherit' }}>
                {name(x)}{x['Phone Number'] ? <span style={{ color: 'var(--muted)' }}> · {x['Phone Number']}</span> : null}
              </button>
            ))}
            {!exact && (
              <button type="button" onMouseDown={e => { e.preventDefault(); addTyped(); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '7px 10px', cursor: 'pointer', fontSize: fs, fontFamily: 'inherit', color: '#886c44' }}>
                + Add “{q.trim()}” (not on the volunteer list)
              </button>
            )}
          </div>
        )}
      </div>}
      {!hideList && (assigned.length > 0 || people.length > 0) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {assigned.map(x => (
            <div key={x.id} className="row-x-host" tabIndex={-1} style={{ outline: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: fs }}>
              <span style={{ minWidth: compact ? 0 : 160 }}>{name(x)}</span>
              {/* a volunteer picked from the list keeps the phone number on their record, so it is shown, not editable */}
              <span style={{ width: compact ? 110 : 140, fontSize: fs, color: 'var(--muted)' }}>{(v.phones || {})[x.id] || x['Phone Number'] || 'No phone on file'}</span>
              {removeBtn(() => onPatch({ assignedIds: (v.assignedIds || []).filter(id => id !== x.id) }))}
            </div>
          ))}
          {people.map(pp => (
            <div key={pp.id} className="row-x-host" tabIndex={-1} style={{ outline: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: fs }}>
              <input className="input" defaultValue={pp.name} key={pp.id + pp.name} onBlur={e => { const t = e.target.value.trim(); if (t && t !== pp.name) onPatch({ people: people.map(y => y.id === pp.id ? { ...y, name: t } : y) }); }}
                style={{ width: compact ? 120 : 160, fontSize: fs, padding: compact ? '3px 6px' : '5px 8px' }} />
              {phoneBox(pp.phone, t => onPatch({ people: people.map(y => y.id === pp.id ? { ...y, phone: t } : y) }))}
              {removeBtn(() => onPatch({ people: people.filter(y => y.id !== pp.id) }))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// One line of the Volunteers, Staffing & Vendors list, with its check circle and its editor. Used by the list itself and by the Checklist.
function NeedRow({ v, volunteers, patch, remove, isOpen, onToggle }) {
  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13 };
  const cap = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 };
        const kind = v.kind || '';
        const handled = needHandled(v);
        const assigned = (v.assignedIds || []).map(id => (volunteers || []).find(x => x.id === id)).filter(Boolean);
        const target = Number(v.target) || 0;
        const who = v.who || (v.role ? v.name : '');
        const title = v.who || !v.role ? v.name : v.role + ': ' + v.name;
        const found = !!v.confirmed || !!who || needPeopleCount(v) > 0;
        const costText = costLabel(v);
        let sub;
        const names = [...assigned.map(volFullName), ...(v.people || []).map(pp => pp.name)];
        if (kind === 'volunteer' || kind === 'activity') sub = names.length + (target ? ' of ' + target : '') + ' assigned' + (names.length ? ': ' + names.join(', ') : '');
        else if (who || v.contact) sub = [v.who ? v.who : (v.role ? v.name : ''), v.contact].filter(Boolean).join('  ·  ');
        else sub = '';
        return (
          <div key={v.id} style={{ borderBottom: '0.5px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0 11px 14px' }}>
              <CheckCircle checked={handled} onChange={() => patch(v.id, handled ? { confirmed: false, who: '' } : { confirmed: true })} />
              <button type="button" onClick={onToggle} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: found || sub ? 'var(--muted)' : '#b8863b', fontStyle: found || sub ? 'normal' : 'italic' }}>{(sub || 'Still needed') + (costText ? '  ·  ' + costText : '')}</div>
              </button>
              {kind && <span className="badge" style={{ background: 'var(--light)', color: 'var(--text)', flexShrink: 0 }}>{NEED_KINDS[kind]}</span>}
              <span style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>&rsaquo;</span>
            </div>
            {isOpen && (
              <div key={v.id + '-edit'} style={{ padding: '4px 0 18px 42px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: '1 1 170px' }}>
                    <div style={cap}>What is it?</div>
                    <select className="input" value={kind} onChange={e => patch(v.id, { kind: e.target.value })} style={{ ...inp, appearance: 'auto' }}>
                      <option value="">Choose a type…</option>
                      <option value="vendor">Vendor</option>
                      <option value="contact">Contact</option>
                      <option value="volunteer">Volunteer role</option>
                      <option value="activity">Activity or program</option>
                      <option value="sponsor">Sponsor</option>
                    </select>
                  </div>
                  <div style={{ flex: '2 1 240px' }}>
                    <div style={cap}>What we need</div>
                    <input className="input" defaultValue={v.name} style={inp} onBlur={e => { const t = e.target.value.trim(); if (t && t !== v.name) patch(v.id, { name: t }); }} />
                  </div>
                </div>
                {(kind === 'volunteer' || kind === 'activity') ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div style={{ width: 120 }}>
                        <div style={cap}>{kind === 'activity' ? 'Volunteers needed' : 'How many'}</div>
                        <input className="input" type="number" min="0" defaultValue={v.target || ''} style={inp} onBlur={e => patch(v.id, { target: Number(e.target.value) || 0 })} />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={cap}>Assign a volunteer</div>
                        <AssignVolunteers v={v} volunteers={volunteers} onPatch={p => patch(v.id, p)} target={Number(v.target) || 0} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={cap}>Who we found</div>
                      <input className="input" defaultValue={v.who || (v.role ? v.name : '')} placeholder="Name or business" style={inp} onBlur={e => { const t = e.target.value.trim(); if (t !== (v.who || '')) patch(v.id, { who: t }); }} />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={cap}>Phone or email</div>
                      <input className="input" defaultValue={v.contact || ''} style={inp} onBlur={e => { const t = e.target.value.trim(); if (t !== (v.contact || '')) patch(v.id, { contact: t }); }} />
                    </div>
                  </div>
                )}
                {kind !== 'volunteer' && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={cap}>Cost</div>
                      <select className="input" value={v.costType || ''} onChange={e => patch(v.id, { costType: e.target.value })} style={{ ...inp, appearance: 'auto' }}>
                        <option value="">No cost</option>
                        <option value="flat">Flat fee</option>
                        <option value="split">Share of ticket sales</option>
                      </select>
                    </div>
                    {v.costType === 'flat' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <div style={cap}>Amount ($)</div>
                        <input className="input" type="number" min="0" step="any" defaultValue={v.cost || ''} style={inp} onBlur={e => patch(v.id, { cost: Number(e.target.value) || 0 })} />
                      </div>
                    )}
                    {v.costType === 'split' && (
                      <div style={{ flex: '2 1 280px' }}>
                        <div style={cap}>How the ticket sales split</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="input" value={v.splitCustom ? 'custom' : String(v.splitPct || '')} onChange={e => { const val = e.target.value; if (val === 'custom') patch(v.id, { splitCustom: true }); else patch(v.id, { splitCustom: false, splitPct: Number(val) || 0 }); }} style={{ ...inp, appearance: 'auto', flex: 1 }}>
                            <option value="">Choose a split…</option>
                            {SPLIT_PRESETS.map(sp => <option key={sp[0]} value={sp[0]}>{sp[1]}</option>)}
                            <option value="custom">Custom…</option>
                          </select>
                          {v.splitCustom && <input className="input" type="number" min="0" max="100" step="any" placeholder="Vendor %" defaultValue={v.splitPct || ''} style={{ ...inp, width: 100 }} onBlur={e => patch(v.id, { splitPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {kind !== 'volunteer' && v.costType && <div style={{ fontSize: 11, color: 'var(--muted)', margin: '-6px 0 12px' }}>This is added to the event's expenses automatically{v.costType === 'split' ? ' and follows the ticket sales' : ''}.</div>}
                <div style={{ marginBottom: 12 }}>
                  <div style={cap}>Notes (staff only)</div>
                  <textarea className="input" rows={2} defaultValue={v.notes || ''} style={{ ...inp, resize: 'vertical' }} onBlur={e => { const t = e.target.value.trim(); if (t !== (v.notes || '')) patch(v.id, { notes: t }); }} />
                </div>
                {kind === 'vendor' && (
                  <div style={{ marginBottom: 12, maxWidth: 220 }}>
                    <div style={cap}>Vendor form</div>
                    <select className="input" value={v.formStatus || ''} onChange={e => patch(v.id, { formStatus: e.target.value })} style={{ ...inp, appearance: 'auto' }}>
                      <option value="">Not tracked</option>
                      <option value="Not sent">Not sent</option>
                      <option value="Sent">Sent</option>
                      <option value="Received">Received</option>
                    </select>
                  </div>
                )}
                <button className="btn-ghost" style={{ fontSize: 12, color: '#a04545' }} onClick={() => remove(v)}>Remove from the list</button>
              </div>
            )}
          </div>
        );
}

function NeedsList({ ev, onUpdate, volunteers }) {
  const [quick, setQuick] = useState('');
  const [openId, setOpenId] = useState(null);
  const items = ev.vendors;
  const patch = (id, p) => onUpdate(e => ({ ...e, vendors: e.vendors.map(v => v.id === id ? { ...v, ...p } : v) }));

  function add(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    onUpdate(e => ({ ...e, vendors: [...e.vendors, ...lines.map(l => ({ id: cryptoId(), name: l, kind: '', who: '', contact: '', notes: '', confirmed: false }))] }));
    setQuick('');
  }
  function remove(v) {
    if (!window.confirm(`Remove "${v.name}" from the list?`)) return;
    onUpdate(e => ({ ...e, vendors: e.vendors.filter(x => x.id !== v.id) }));
    if (openId === v.id) setOpenId(null);
  }

  return (
    <div>
      <input className="input" value={quick} placeholder="What do we need? Type it and press Enter… (a magician, a caterer, setup volunteers)"
        onChange={e => setQuick(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(quick); } }}
        onPaste={e => { const t = e.clipboardData.getData('text'); if (/\r?\n/.test(t.trim())) { e.preventDefault(); add(t); } }} />
      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 14px' }}>
        Later, click one to add who you found and their contact, and choose whether it is a vendor, a contact or a volunteer role.
      </div>

      {items.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing on the list yet.</div>}
      {items.map(v => (
        <NeedRow key={v.id} v={v} volunteers={volunteers} patch={patch} remove={remove} isOpen={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)} />
      ))}
    </div>
  );
}

const hasBudget = (b) => b !== '' && b != null && !isNaN(Number(b));
const budgetText = (b) => (hasBudget(b) ? money(Number(b)) : 'Undecided');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function dutyPeople(t) {
  return {
    assignedIds: t.assignedIds || (t.assigneeId ? [t.assigneeId] : []),
    people: t.people || (t.assignee && !t.assigneeId ? [{ id: 'legacy-' + t.id, name: t.assignee, phone: '' }] : []),
    phones: t.phones || {},
  };
}
function DutyWho({ t, volunteers, onPatch }) {
  const roster = volunteers || [];
  const cur = dutyPeople(t);
  const total = cur.assignedIds.length + cur.people.length;
  const primaryId = cur.assignedIds.length ? cur.assignedIds[0] : null;
  const primaryPerson = primaryId == null && cur.people.length ? cur.people[0] : null;
  const value = primaryId != null ? String(primaryId) : primaryPerson ? 'p:' + primaryPerson.id : '';
  const sorted = [...roster].sort((a, b) => volFullName(a).localeCompare(volFullName(b)));
  const known = primaryId == null || roster.some(x => String(x.id) === String(primaryId));
  function change(e) {
    const v = e.target.value;
    if (!v) { if (primaryId != null) onPatch({ assignedIds: cur.assignedIds.slice(1) }); else if (primaryPerson) onPatch({ people: cur.people.slice(1) }); return; }
    if (v.startsWith('p:')) return;
    const vol = roster.find(x => String(x.id) === v);
    if (!vol) return;
    const rest = cur.assignedIds.slice(primaryId != null ? 1 : 0).filter(i => String(i) !== v);
    onPatch({ assignedIds: [vol.id, ...rest], people: primaryPerson ? cur.people.slice(1) : cur.people });
  }
  return (
    <div title="Choose the main person. Click the line to add more." style={{ width: 190, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
      <select className="input" value={value} onChange={change} style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto', color: value ? 'var(--text)' : 'var(--muted)' }}>
        <option value="">No one yet</option>
        {primaryPerson && <option value={'p:' + primaryPerson.id}>{primaryPerson.name}</option>}
        {!known && <option value={String(primaryId)}>Volunteer no longer on the list</option>}
        {sorted.map(x => <option key={x.id} value={String(x.id)}>{volFullName(x)}</option>)}
      </select>
      <span style={{ width: 28, flexShrink: 0, fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>{total > 1 ? '+' + (total - 1) : ''}</span>
    </div>
  );
}
// Everyone assigned anywhere on the event (duties, Day-Of items, volunteer roles), plus people added by hand (extra).
function assignedPeople(ev, volunteers, extra) {
  const roster = volunteers || [];
  const out = new Map();
  const add = (key, name, phone, label, ref) => {
    if (!name) return;
    const e = out.get(key) || { key, name, phone: '', on: [] };
    if (!e.phone && phone) e.phone = phone;
    if (label && !e.on.includes(label)) e.on.push(label);
    if (ref && !e.extraRef) e.extraRef = ref;
    out.set(key, e);
  };
  const scan = (t, label, byHand) => {
    (t.assignedIds || []).forEach(id => { const x = roster.find(r => String(r.id) === String(id)); if (x) add('v' + x.id, volFullName(x), (t.phones || {})[x.id] || x['Phone Number'], label, byHand ? { kind: 'id', id: x.id } : null); });
    (t.people || []).forEach(pp => { const n = String(pp.name || '').trim(); if (n) add('n' + n.toLowerCase(), n, pp.phone, label, byHand ? { kind: 'person', id: pp.id } : null); });
  };
  // Only things that happen at the event count as being in attendance: Day-Of items, volunteer roles, and duties set to the day of the event.
  // Someone who only has work to do ahead of time (decorating the week before, a license, a phone call) is not listed.
  ev.checklist.filter(t => t.timing === 'dayof').forEach(t => scan(dutyPeople(t), t.text));
  ev.timeline.filter(t => !t.noAssign).forEach(t => scan(t, fmtTime12(t.time) + ' ' + t.activity));
  ev.vendors.filter(v => ['volunteer', 'activity'].includes(v.kind)).forEach(v => scan(v, needTitle(v)));
  if (extra) scan({ assignedIds: extra.assignedIds || [], people: extra.people || [], phones: extra.phones || {} }, '', true);
  // Committee members who are on the list sort to the top; nobody is added just for being on the committee.
  out.forEach(e => { const v = e.key.startsWith('v') ? roster.find(r => 'v' + r.id === e.key) : null; if (v && matchVolunteerAreas(v.Team).includes('Events')) e.committee = true; });
  return [...out.values()].sort((a, b) => (b.committee ? 1 : 0) - (a.committee ? 1 : 0) || a.name.localeCompare(b.name));
}

function AttendanceTab({ ev, volunteers }) {
  const { session } = useVol();
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    let live = true;
    fetchAreaData(ev.id).then(rows => { if (live) setExtra((((rows || []).find(r => r.area_key === 'volunteers') || {}).pre_data || {}).attendance || { assignedIds: [], people: [], phones: {} }); }).catch(() => { if (live) setExtra({ assignedIds: [], people: [], phones: {} }); });
    return () => { live = false; };
  }, [ev.id]);
  async function patchExtra(pt) {
    const next = { assignedIds: [], people: [], phones: {}, ...(extra || {}), ...pt };
    setExtra(next);
    try {
      const rows = await fetchAreaData(ev.id);
      const r = (rows || []).find(x => x.area_key === 'volunteers') || {};
      await saveArea(ev.id, 'volunteers', { ownerName: r.owner_name || 'Events Committee', preData: { ...(r.pre_data || {}), attendance: next }, postData: r.post_data || {}, authUserId: session && session.user && session.user.id });
    } catch (e) { /* the list on screen stays; the next change tries again */ }
  }
  if (!extra) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;
  const everyone = assignedPeople(ev, volunteers, extra);
  const cap = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 };
  function removeByHand(ref) {
    if (ref.kind === 'id') patchExtra({ assignedIds: (extra.assignedIds || []).filter(i => String(i) !== String(ref.id)) });
    else patchExtra({ people: (extra.people || []).filter(y => y.id !== ref.id) });
  }
  return (
    <div>
      <div style={cap}>Confirmed volunteers who will be in attendance ({everyone.length})</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Anyone you assign on the checklist is added automatically, with what they are on. Add anyone else below.</div>
      {everyone.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 14px' }}>No one yet.</div>}
      {everyone.map(x => (
        <div key={x.key} className="row-x-host" tabIndex={-1} style={{ outline: 'none', display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, width: 170, flexShrink: 0 }}>{x.name}</span>
          {x.extraRef && x.extraRef.kind === 'person'
            ? <input className="input" placeholder="Phone" defaultValue={x.phone || ''} key={x.key + (x.phone || '')} style={{ width: 130, flexShrink: 0, fontSize: 12, padding: '4px 8px' }}
                onBlur={e => { const v = e.target.value.trim(); if (v !== (x.phone || '')) patchExtra({ people: (extra.people || []).map(y => (y.id === x.extraRef.id ? { ...y, phone: v } : y)) }); }} />
            : <span style={{ fontSize: 12, color: 'var(--muted)', width: 130, flexShrink: 0 }}>{x.phone || ''}</span>}
          <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--muted)' }}>{x.on.length ? x.on.join('  ·  ') : 'Added by hand'}</span>
          {x.extraRef && x.on.length === 0 && <button type="button" className="row-x" onClick={() => removeByHand(x.extraRef)} title="Remove from the list" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>}
        </div>
      ))}
      <div style={{ ...cap, marginTop: 20 }}>Add a volunteer</div>
      <AssignVolunteers v={extra} volunteers={volunteers} onPatch={patchExtra} hideList />
    </div>
  );
}

function whoOn(t, volunteers) {
  const roster = volunteers || [];
  return [
    ...(t.assignedIds || []).map(id => roster.find(x => x.id === id)).filter(Boolean).map(x => ({ name: volFullName(x), phone: (t.phones || {})[x.id] ?? x['Phone Number'] })),
    ...(t.people || []).map(pp => ({ name: pp.name, phone: pp.phone })),
  ];
}
// Number needed and the assign box for one Day-Of item, open right on the line.
function TimelineAssign({ t, volunteers, onUpdate }) {
  const patch = (pt) => onUpdate(e => ({ ...e, timeline: e.timeline.map(x => (x.id === t.id ? { ...x, ...pt } : x)) }));
  return (
    <>
      <label title="How many people are needed" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
        # needed
        <input className="input" type="number" min="0" defaultValue={t.target || ''} key={t.id + 'tg' + (t.target || '')} placeholder="0" style={{ width: 58, fontSize: 12, padding: '4px 6px' }}
          onBlur={e => { const n = Number(e.target.value) || 0; if (n !== (Number(t.target) || 0)) patch({ target: n }); }} />
      </label>
      <AssignVolunteers v={t} volunteers={volunteers} compact target={Number(t.target) || 0} onPatch={patch} />
    </>
  );
}
function TimelineRow({ t, volunteers, onUpdate, isOpen, onToggle }) {
  const patch = (pt) => onUpdate(e => ({ ...e, timeline: e.timeline.map(x => (x.id === t.id ? { ...x, ...pt } : x)) }));
  const target = Number(t.target) || 0;
  const cap = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 };
  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13 };
  return (
    <div style={{ borderBottom: '0.5px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0 11px 14px' }}>
        <CheckCircle checked={!!t.done} onChange={() => patch({ done: !t.done })} />
        <button type="button" onClick={onToggle} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtTime12(t.time)}  ·  {t.activity}</div>
        </button>
        <div style={{ width: 300, flexShrink: 0 }}>{t.noAssign ? <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No one needed</span> : <AssignVolunteers v={t} volunteers={volunteers} compact target={target} onPatch={patch} />}</div>
        <span style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>&rsaquo;</span>
      </div>
      {isOpen && (
        <div style={{ padding: '4px 0 18px 42px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '0 0 auto' }}>
              <div style={cap}>Time</div>
              <TimeSelect value={t.time} onChange={v => patch({ time: v || '00:00' })} />
            </div>
            <div style={{ flex: '2 1 240px' }}>
              <div style={cap}>What happens</div>
              <input className="input" defaultValue={t.activity} style={inp} onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.activity) patch({ activity: v }); }} />
            </div>
            <div style={{ width: 120 }}>
              <div style={cap}>How many needed</div>
              <input className="input" type="number" min="0" defaultValue={t.target || ''} style={inp} onBlur={e => { const n = Number(e.target.value) || 0; if (n !== (Number(t.target) || 0)) patch({ target: n }); }} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '0 0 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!t.noAssign} onChange={e => patch({ noAssign: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} />
            No one needs to be assigned (just a moment in the day, like guests arriving)
          </label>
          <button className="btn-ghost" style={{ fontSize: 12, color: '#a04545' }} onClick={() => { if (window.confirm('Remove "' + t.activity + '" from the timeline?')) onUpdate(e => ({ ...e, timeline: e.timeline.filter(x => x.id !== t.id) })); }}>Remove from the timeline</button>
        </div>
      )}
    </div>
  );
}
const whoText = (list) => list.map(w => w.name + (w.phone ? ' (' + w.phone + ')' : '')).join(', ');

function DayOfView({ ev, onUpdate, volunteers }) {
  const sorted = [...ev.timeline].sort((a, b) => a.time.localeCompare(b.time));
  if (!sorted.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No timeline items yet. Click Edit to add some.</div>;
  const doneCount = sorted.filter(t => t.done).length;
  function toggle(id) { onUpdate(e => ({ ...e, timeline: e.timeline.map(t => t.id === id ? { ...t, done: !t.done } : t) })); }
  return (
    <div>
      <div style={SECTION_HEAD}>Run of Show</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{doneCount} of {sorted.length} done</div>
      {sorted.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)', fontSize: 13 }}>
          <CheckCircle checked={!!(!!t.done)} onChange={() => toggle(t.id)} />
          <span style={{ width: 70, flexShrink: 0, color: 'var(--muted)' }}>{fmtTime12(t.time)}</span>
          <span style={{ flex: 1, textDecoration: 'none', color: t.done ? 'var(--muted)' : 'var(--text)' }}>{t.activity}{(whoOn(t, volunteers).length > 0 || Number(t.target) > 0) && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{Number(t.target) > 0 ? whoOn(t, volunteers).length + ' of ' + t.target + ' assigned' + (whoOn(t, volunteers).length ? ': ' : '') : ''}{whoText(whoOn(t, volunteers))}</div>}</span>
        </div>
      ))}
    </div>
  );
}

function ChecklistView({ ev, onUpdate }) {
  const items = ev.checklist;
  if (!items.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No checklist items yet. Click Edit to add some.</div>;
  const doneCount = items.filter(t => t.done).length;
  function toggle(id) { onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id ? { ...t, done: !t.done } : t) })); }
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{doneCount} of {items.length} done</div>
      {items.map(t => {
        const subs = t.subtasks || [];
        const p = TASK_PRIORITY[t.priority];
        const hasMoney = t.estimated > 0 || t.actual > 0;
        const meta = [t.assignee ? (t.assigneeId ? '@' : '') + t.assignee : '', t.due ? 'Due ' + fmtDateShort(t.due) : '', subs.length ? subs.filter(s => s.done).length + '/' + subs.length + ' subtasks' : '', hasMoney ? 'Est. ' + money(t.estimated) + ' · Act. ' + money(t.actual) : ''].filter(Boolean).join(' · ');
        return (
          <div key={t.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
            <CheckCircle checked={!!(!!t.done)} onChange={() => toggle(t.id)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, textDecoration: 'none', color: t.done ? 'var(--muted)' : 'var(--text)' }}>
                {p && <span title={p.label} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, marginRight: 7 }} />}{t.text}
              </div>
              {meta && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{meta}</div>}
              {t.notes && t.notes.trim() && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 3 }}>{t.notes}</div>}
              {subs.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {subs.map(s => <div key={s.id} style={{ fontSize: 12, color: s.done ? 'var(--muted)' : 'var(--text)', textDecoration: 'none' }}>{s.done ? '✓' : '○'} {s.text}</div>)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Extracted so Overview's "Vendors & Supplies" planning-section dropdown
// can embed the exact same vendor list/add-form Pre-Planning uses, instead
// of duplicating it.
function VendorsPanel({ ev, onUpdate }) {
  const [vendorForm, setVendorForm] = useState({ name: '', role: '', contact: '', notes: '' });

  function toggleVendor(id) {
    onUpdate(e => ({ ...e, vendors: e.vendors.map(v => v.id === id ? { ...v, confirmed: !v.confirmed } : v) }));
  }
  function setFormStatus(id, val) {
    onUpdate(e => ({ ...e, vendors: e.vendors.map(v => v.id === id ? { ...v, formStatus: val } : v) }));
  }
  function deleteVendor(id) {
    onUpdate(e => ({ ...e, vendors: e.vendors.filter(v => v.id !== id) }));
  }
  function addVendor() {
    if (!vendorForm.name.trim()) return;
    onUpdate(e => ({ ...e, vendors: [...e.vendors, { id: cryptoId(), name: vendorForm.name.trim(), role: vendorForm.role.trim(), contact: vendorForm.contact.trim(), notes: vendorForm.notes.trim(), confirmed: false }] }));
    setVendorForm({ name: '', role: '', contact: '', notes: '' });
  }

  return (
    <div>
      {ev.vendors.map(v => (
        <ItemRow key={v.id} onDelete={() => deleteVendor(v.id)}>
          <CheckCircle checked={!!(v.confirmed)} onChange={() => toggleVendor(v.id)} />
          <span style={{ flex: 1, fontSize: 13 }}>{v.name} <span style={{ color: 'var(--muted)' }}>— {v.role}</span>
            {v.notes && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{v.notes}</div>}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v.contact}</span>
          <select className="input" value={v.formStatus || ''} onChange={e => setFormStatus(v.id, e.target.value)} title="Vendor form" style={{ width: 138, flexShrink: 0, fontSize: 12, padding: '4px 8px', appearance: 'auto' }}>
            <option value="">Vendor form…</option>
            <option value="Not sent">Form: not sent</option>
            <option value="Sent">Form: sent</option>
            <option value="Received">Form: received</option>
          </select>
        </ItemRow>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 140 }} placeholder="Vendor name" value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} />
        <input className="input" style={{ width: 110 }} placeholder="Role" value={vendorForm.role} onChange={e => setVendorForm(f => ({ ...f, role: e.target.value }))} />
        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Contact info" value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} />
        <textarea className="input" style={{ flexBasis: '100%', minHeight: 56, resize: 'vertical' }} placeholder="Internal notes (staff only, optional)" value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} />
        <button className="btn-gold" style={{ padding: '9px 14px' }} onClick={addVendor}>Add</button>
      </div>
    </div>
  );
}

// Event Basics as a ready sheet: every question with its answer, and anything not filled in shown plainly so it can be spotted.
function EventBasicsView({ f, ev, rsvp }) {
  const group = { fontSize: 12, fontWeight: 700, color: '#886c44', textTransform: 'uppercase', letterSpacing: 1, margin: '28px 0 0', paddingBottom: 8, borderBottom: '1.5px solid #e8dfd0' };
  const cap = { width: 150, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: 3 };
  const empty = (req) => <span style={{ color: '#b8863b', fontStyle: 'italic' }}>{req ? 'Not filled in yet (required)' : 'Not filled in yet'}</span>;
  const row = (label, value, req) => (
    <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderBottom: '0.5px solid var(--border-light)' }}>
      <div style={cap}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text)', lineHeight: 1.55, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value ? value : empty(req)}</div>
    </div>
  );
  const when = f.dateTbd ? 'To be announced' : [f.date ? fmtDate(f.date) : '', f.startTime ? fmtTime12(f.startTime) + (f.endTime ? ' – ' + fmtTime12(f.endTime) : '') : ''].filter(Boolean).join('  ·  ');
  const tiers = f.sells ? f.tiers.filter(t => String(t.name || '').trim()) : [];
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {f.imageUrl && <img src={f.imageUrl} alt={f.imageAlt || ''} style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cardo','Georgia',serif", fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{f.title || empty(true)}</div>
          <div style={{ marginTop: 10 }}>
            <span className="badge" style={ev.siteEventId ? { background: '#e8f5e9', color: '#2e7d32' } : { background: 'var(--light)', color: 'var(--muted)' }}>{ev.siteEventId ? 'On the website' : 'Not on the website yet'}</span>
          </div>
        </div>
      </div>

      <div style={group}>The event</div>
      {row('Short description', f.short, true)}
      {row('Full description', f.desc, true)}
      {row('Photo', f.imageUrl ? 'Chosen' : null)}

      <div style={group}>When and where</div>
      {row('Date and time', when, true)}
      {row('Location', f.locName, true)}
      {row('Address', f.locAddr, true)}
      {row('Spaces used', (f.spaces || []).join(', '))}

      <div style={group}>Website</div>
      {row('Web address', f.slug)}
      {row('Tickets', rsvp ? 'RSVP only (no ticket sales)' : f.sells ? (tiers.length ? tiers.map(t => t.name + ' — ' + (Number(t.price) > 0 ? '$' + t.price : 'Free') + (t.limit ? ' (max ' + t.limit + ' per order)' : '')).join('\n') : null) : 'Not sold online', f.sells)}

      <div style={group}>Planning notes (not on the website)</div>
      {row('Event type', f.purpose)}
      {row('Event lead', f.eventLead)}
      {row('Expected attendance', f.expectedAttendance)}
      {row('Pricing note', f.pricing)}
    </div>
  );
}

// "Website event page": everything the website event needs, filled in here, then Push to website sends it to
// Admin > New Event and goes live (later pushes update the same event).
function WebsiteEventPanel({ ev, onUpdate, onRsvpChange, autoEdit, onClose }) {
  const w = ev.website || {};
  const slugify = v => String(v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const initial = () => ({
    title: ev.name || '', slug: w.slug || '', slugTouched: !!w.slug, short: w.short_description || '', desc: ev.description || '',
    imageUrl: w.image_url || '', imageAlt: w.image_alt || '', dateTbd: w.date_tbd === true, date: ev.date || '',
    startTime: ev.startTime || '18:00', endTime: ev.endTime || '',
    spaces: Array.isArray(w.spaces) ? w.spaces : [],
    locName: w.location_name || 'North Star House', locAddr: w.location_address || '12075 Auburn Rd, Grass Valley, CA 95949, USA',
    purpose: ev.purpose || '', eventLead: ev.eventLead || '', expectedAttendance: ev.expectedAttendance || '', pricing: ev.pricing || '',
    sells: w.sells_tickets === true, tiers: (ev.ticketTiers && ev.ticketTiers.length) ? ev.ticketTiers : [{ name: 'General Admission', price: '', limit: '' }],
  });
  const [f, setF] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(!!autoEdit);
  // RSVP-only events (no ticket sales) are a third choice next to the ticket options; the flag lives on the event's overview card.
  const [rsvpSaved, setRsvpSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  useEffect(() => { let live = true; fetchEventCardMeta(ev.name).then(m => { if (live) { setRsvpSaved(!!(m && m.rsvp_only)); setRsvp(!!(m && m.rsvp_only)); } }).catch(() => {}); return () => { live = false; }; }, [ev.name]);
  function saveRsvp(name) {
    if (rsvp === rsvpSaved) return;
    setRsvpSaved(rsvp);
    if (onRsvpChange) onRsvpChange(rsvp);
    saveEventCardMeta(name, { rsvp_only: rsvp }).catch(() => { setRsvpSaved(!rsvp); alert('Could not save the RSVP setting. Please try again.'); });
  }
  const [pushing, setPushing] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const setTier = (i, k, v) => setF(o => ({ ...o, tiers: o.tiers.map((t, j) => j === i ? { ...t, [k]: v } : t) }));

  // The sheet shows what is saved; follow changes made elsewhere while not editing.
  const savedKey = JSON.stringify([ev.name, ev.date, ev.startTime, ev.endTime, ev.description, ev.purpose, ev.eventLead, ev.expectedAttendance, ev.pricing, ev.ticketTiers, ev.website]);
  useEffect(() => { if (!editing) setF(initial()); }, [savedKey, editing]);

  // Turn the form into the committee event's fields.
  const toEvent = (form, base) => ({
    ...base, name: form.title.trim(), description: form.desc.trim(),
    purpose: form.purpose, eventLead: form.eventLead.trim(), expectedAttendance: form.expectedAttendance.trim(), pricing: form.pricing.trim(),
    date: form.dateTbd ? base.date : form.date, startTime: form.startTime, endTime: form.endTime,
    ticketTiers: form.sells ? form.tiers.filter(t => String(t.name || '').trim()) : (base.ticketTiers || []),
    website: {
      slug: form.slug, short_description: form.short.trim(), image_url: form.imageUrl, image_alt: form.imageAlt.trim(),
      date_tbd: form.dateTbd, location_name: form.locName.trim(), location_address: form.locAddr.trim(), sells_tickets: form.sells, spaces: form.spaces || [],
    },
  });
  const missing = form => {
    const m = [];
    if (!form.title.trim()) m.push('title');
    if (!form.short.trim()) m.push('short description');
    if (!form.desc.trim()) m.push('full description');
    if (!form.dateTbd && !form.date) m.push('date');
    if (!form.dateTbd && !form.startTime) m.push('start time');
    if (!form.locName.trim()) m.push('location');
    if (!form.locAddr.trim()) m.push('address');
    if (form.sells && !form.tiers.some(t => String(t.name || '').trim() && String(t.price ?? '').trim() !== '')) m.push('a ticket name and price');
    return m;
  };

  function save() {
    if (!f.title.trim()) { setMsg({ ok: false, text: 'Give the event a title first.' }); return; }
    onUpdate(e => toEvent(f, e));
    saveRsvp(f.title.trim());
    setEditing(false);
    setMsg({ ok: true, text: 'Saved.' });
    if (onClose) onClose();
  }
  async function push(form) {
    if (pushing) return;
    const m = missing(form);
    if (m.length) { setMsg({ ok: false, text: 'Fill in first: ' + m.join(', ') + '.' }); return; }
    if (!ev.siteEventId && !window.confirm('Push this event to the website? It goes live right away.')) return;
    setPushing(true); setMsg(null);
    saveRsvp(form.title.trim());
    try {
      const merged = toEvent(form, ev);
      const r = await pushCommitteeEventToWebsite(merged);
      onUpdate(e => ({ ...toEvent(form, e), siteEventId: r.siteEventId }));
      setEditing(false);
      setMsg({ ok: true, text: r.status === 'archived' ? 'Updated. This event has ended, so it is not shown on the website.' : 'Done. The event is live on the website (it also shows in Admin > New Event).' });
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Could not push. Please try again.' });
    }
    setPushing(false);
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
  const lab = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#888', marginBottom: 14 };
  const note = { fontSize: 11, color: '#aaa' };
  const head = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, margin: '22px 0 12px', paddingTop: 16, borderTop: '0.5px solid #f0ebe0' };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: 28 }}>
        {!editing && <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => setEditing(true)}>Edit</button>}
      </div>
      {editing && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
        {ev.siteEventId
          ? 'This is the event and its website page. Fill it in here; this event is on the website, so Save and update website sends your changes live.'
          : 'This is the event and its website page. Fill it in here; Push to website makes the event live on the website right away.'}
      </div>}

      {!editing ? (
        <div>
          <EventBasicsView f={f} ev={ev} rsvp={rsvpSaved} />
          <RsvpPanel key={String(rsvpSaved)} eventName={ev.name} hideToggle />
          {msg && <div style={{ fontSize: 12, margin: '12px 0 0', color: msg.ok ? '#2e7d32' : '#b3402a' }}>{msg.text}</div>}
          <div style={{ marginTop: 16 }}>
            {missing(f).length > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Still needed before pushing: {missing(f).join(', ')}. Click Edit.</div>}
            <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px' }} disabled={pushing || missing(f).length > 0} onClick={() => push(f)}>{pushing ? 'Pushing…' : (ev.siteEventId ? 'Update website event' : 'Push to website')}</button>
          </div>
        </div>
      ) : (
        <div>
          <fieldset className="sheet-fieldset">
          <div style={{ ...head, marginTop: 8, borderTop: 'none', paddingTop: 0 }}>The event</div>
          <label style={lab}>Title *<input style={inp} value={f.title} onChange={e => { const v = e.target.value; setF(o => ({ ...o, title: v, slug: o.slugTouched ? o.slug : slugify(v) })); }} placeholder="e.g. Holiday Open House" /></label>
          <label style={lab}>Web address (the last part of the event's link)
            <input style={inp} value={f.slug} onChange={e => setF(o => ({ ...o, slugTouched: true, slug: slugify(e.target.value) }))} placeholder="holiday-open-house" />
            <span className="edit-only" style={note}>Letters, numbers and dashes only. It fills in from the title unless you type your own.{ev.siteEventId ? ' Changing it after the event is published breaks links people already have.' : ''}</span>
          </label>
          <label style={lab}>Short description (shown in lists and when shared) *<input style={inp} maxLength={300} value={f.short} onChange={e => set('short', e.target.value)} placeholder="One or two sentences" /></label>
          <label style={lab}>Full description *<textarea rows={6} style={{ ...inp, resize: 'vertical' }} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder={'Write it like an email. A blank line starts a new paragraph.\nStart a line with "- " to make a bullet list.'} /></label>
          <div style={lab}>Photo
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {f.imageUrl ? <img src={f.imageUrl} alt="" style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border-light)' }} /> : <div style={{ width: 110, height: 74, borderRadius: 8, background: 'var(--light)', border: '0.5px solid var(--border-light)' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-ghost edit-only" style={{ fontSize: 12 }} onClick={() => setPicker(true)}>{f.imageUrl ? 'Change photo' : 'Choose a photo'}</button>
                  {f.imageUrl && <button type="button" className="btn-ghost edit-only" style={{ fontSize: 12 }} onClick={() => setF(o => ({ ...o, imageUrl: '', imageAlt: '' }))}>Remove</button>}
                  {!f.imageUrl && <span className="edit-only" style={note}>No photo? The website shows "More information to come".</span>}
                </div>
                <input style={inp} value={f.imageAlt} onChange={e => set('imageAlt', e.target.value)} placeholder="Describe the photo (for screen readers)" />
              </div>
            </div>
          </div>

          <div style={head}>When and where</div>
          <label style={{ ...lab, flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={f.dateTbd} onChange={e => set('dateTbd', e.target.checked)} /> Date to be announced</label>
          {!f.dateTbd && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ ...lab, flex: '1 1 150px' }}>Date *<input type="date" style={inp} value={f.date} onChange={e => set('date', e.target.value)} /></label>
              <label style={{ ...lab, flex: '1 1 120px' }}>Starts (Pacific time) *<input type="time" style={inp} value={f.startTime} onChange={e => set('startTime', e.target.value)} /></label>
              <label style={{ ...lab, flex: '1 1 120px' }}>Ends (optional)<input type="time" style={inp} value={f.endTime} onChange={e => set('endTime', e.target.value)} /></label>
            </div>
          )}
          <label style={lab}>Location *<input style={inp} value={f.locName} onChange={e => set('locName', e.target.value)} /></label>
          <label style={lab}>Address *<input style={inp} value={f.locAddr} onChange={e => set('locAddr', e.target.value)} /></label>
          <div style={lab}>Spaces used
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', margin: '4px 0 6px' }}>
              {NSH_SPACES.concat((f.spaces || []).filter(x => !NSH_SPACES.includes(x))).map(sp => (
                <label key={sp} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, color: '#2a2a2a', textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={(f.spaces || []).includes(sp)} onChange={() => setF(o => ({ ...o, spaces: (o.spaces || []).includes(sp) ? o.spaces.filter(x => x !== sp) : [...(o.spaces || []), sp] }))} style={{ accentColor: '#886c44' }} /> {sp}
                </label>
              ))}
            </div>
            <input style={inp} placeholder="Another space… (press Enter to add)" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const t = e.target.value.trim(); if (t) { setF(o => ({ ...o, spaces: (o.spaces || []).includes(t) ? o.spaces : [...(o.spaces || []), t] })); e.target.value = ''; } } }} />
          </div>

          <div style={head}>Tickets</div>
          <label style={lab}>Does this event sell tickets?
            <select style={{ ...inp, appearance: 'auto' }} value={rsvp ? 'rsvp' : (f.sells ? 'yes' : 'no')} onChange={e => { const v = e.target.value; setRsvp(v === 'rsvp'); set('sells', v === 'yes'); }}>
              <option value="no">No, just list the event</option>
              <option value="yes">Yes, sell tickets online</option>
              <option value="rsvp">RSVP only (no ticket sales)</option>
            </select>
          </label>
          {f.sells && (
            <div style={{ marginBottom: 12 }}>
              {f.tiers.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label style={{ ...lab, flex: '2 1 160px', marginBottom: 0 }}>Ticket name<input style={inp} value={t.name || ''} onChange={e => setTier(i, 'name', e.target.value)} /></label>
                  <label style={{ ...lab, flex: '1 1 90px', marginBottom: 0 }}>Price ($)<input style={inp} inputMode="decimal" value={t.price ?? ''} onChange={e => setTier(i, 'price', e.target.value)} placeholder="0 = free" /></label>
                  <label style={{ ...lab, flex: '1 1 90px', marginBottom: 0 }}>Max per order<input style={inp} inputMode="numeric" value={t.limit ?? ''} onChange={e => setTier(i, 'limit', e.target.value)} placeholder="50" /></label>
                  {f.tiers.length > 1 && <button type="button" className="edit-only" onClick={() => set('tiers', f.tiers.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#b3402a', fontSize: 18, cursor: 'pointer', paddingBottom: 6 }} aria-label="Remove this ticket type">×</button>}
                </div>
              ))}
              <button type="button" className="btn-ghost edit-only" style={{ fontSize: 12 }} onClick={() => set('tiers', [...f.tiers, { name: '', price: '', limit: '' }])}>+ Add another ticket type</button>
            </div>
          )}

          <div style={head}>Planning notes (not on the website)</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ ...lab, flex: '1 1 200px' }}>Event type
              <select style={{ ...inp, appearance: 'auto' }} value={f.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="">Select a type…</option>
                {EVENT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ ...lab, flex: '1 1 200px' }}>Event lead<input style={inp} value={f.eventLead} onChange={e => set('eventLead', e.target.value)} placeholder="Responsible person" /></label>
            <label style={{ ...lab, flex: '1 1 140px' }}>Expected attendance<input style={inp} value={f.expectedAttendance} onChange={e => set('expectedAttendance', e.target.value)} placeholder="e.g. 75" /></label>
          </div>
          <label style={lab}>Pricing note<input style={inp} value={f.pricing} onChange={e => set('pricing', e.target.value)} placeholder="e.g. Free, or $25 adults / kids free" /></label>

          </fieldset>

          {msg && <div style={{ fontSize: 12, margin: '8px 0', color: msg.ok ? '#2e7d32' : '#b3402a' }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px' }} disabled={pushing} onClick={() => push(f)}>{pushing ? 'Pushing…' : (ev.siteEventId ? 'Save and update website' : 'Save and push to website')}</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} disabled={pushing} onClick={save}>Save only</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} disabled={pushing} onClick={() => { setF(initial()); setRsvp(rsvpSaved); setMsg(null); setEditing(false); if (onClose) onClose(); }}>Cancel</button>
          </div>
        </div>
      )}
      {picker && <MediaPicker supabaseUrl={SITE_SUPABASE_URL} supabaseKey={SITE_SUPABASE_KEY} onPick={img => { setF(o => ({ ...o, imageUrl: img.url, imageAlt: o.imageAlt || img.alt || '' })); setPicker(false); }} onClose={() => setPicker(false)} />}
    </div>
  );
}

// The event's task checklist: add items with a priority, due date and assignee; click one to edit it, add subtasks,
// or attach estimated/actual $ and notes.
function ChecklistTab({ ev, onUpdate, volunteers, showMarketing, emailTick }) {
  // The Marketing channel boxes live with the Marketing section; they are shown (and can be ticked) here too.
  const [mkData, setMkData] = useState(null);
  useEffect(() => {
    let live = true;
    fetchAreaData(ev.id).then(rows => { if (live) setMkData((((rows || []).find(r => r.area_key === 'marketing') || {}).pre_data || {}).channels || {}); }).catch(() => { if (live) setMkData({}); });
    return () => { live = false; };
  }, [ev.id]);
  // The Budget line: live numbers from the budget tracking, and a tick for "budget is done" (saved with the finance planning area).
  const [flyerUrl, setFlyerUrl] = useState(null);
  useEffect(() => { let live = true; fetchEventCardImage(ev.name).then(u => { if (live) setFlyerUrl(u || null); }).catch(() => {}); return () => { live = false; }; }, [ev.name]);
  const [attendExtra, setAttendExtra] = useState(null);
  useEffect(() => { let live = true; fetchAreaData(ev.id).then(rows => { if (live) setAttendExtra((((rows || []).find(r => r.area_key === 'volunteers') || {}).pre_data || {}).attendance || null); }).catch(() => {}); return () => { live = false; }; }, [ev.id]);
  const [fin, setFin] = useState(null);
  const [budgetDone, setBudgetDone] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchEventFinancials(ev.name).catch(() => null),
      fetchEventTicketStats(ev.name).catch(() => ({ ticketsSold: 0, revenue: 0 })),
      fetchEventCardMeta(ev.name).catch(() => null),
      fetchAreaData(ev.id).catch(() => []),
    ]).then(([f, t, meta, rows]) => {
      if (!live) return;
      const rsvpOnly = !!(meta && meta.rsvp_only);
      const earnings = (f && f.earnings) || []; const expenses = (f && f.expenses) || [];
      const ticketRevenue = rsvpOnly ? 0 : t.revenue;
      const totalEarnings = ticketRevenue + earnings.reduce((n, r) => n + (parseFloat(r.amount) || 0), 0);
      const totalExpenses = expenses.reduce((n, r) => n + (parseFloat(r.amount) || 0), 0);
      setFin({ earnings, expenses, rsvpOnly, ticketRevenue, ticketsSold: t.ticketsSold, totalEarnings, totalExpenses });
      setBudgetDone(!!((((rows || []).find(r => r.area_key === 'finance') || {}).pre_data || {}).budgetDone));
      { const b = (((rows || []).find(r => r.area_key === 'finance') || {}).pre_data || {}).budgetAmount; setBudgetAmount(b == null ? '' : String(b)); }
    });
    return () => { live = false; };
  }, [ev.id, ev.name]);
  async function toggleBudget() {
    const next = !budgetDone;
    setBudgetDone(next);
    try {
      const rows = await fetchAreaData(ev.id);
      const r = (rows || []).find(x => x.area_key === 'finance') || {};
      await saveArea(ev.id, 'finance', { ownerName: r.owner_name || 'Ken Underwood', preData: { ...(r.pre_data || {}), budgetDone: next }, postData: r.post_data || {}, authUserId: session && session.user && session.user.id });
    } catch (e) { setBudgetDone(!next); }
  }
  async function toggleChannel(c) {
    const cur = (mkData || {})[c] || { done: false, date: '' };
    const mine = { ...cur, done: !cur.done };
    setMkData(m => ({ ...(m || {}), [c]: mine }));
    try {
      const rows = await fetchAreaData(ev.id);
      const r = (rows || []).find(x => x.area_key === 'marketing') || {};
      const pre = { ...(r.pre_data || {}), channels: { ...((r.pre_data || {}).channels || {}), [c]: mine } };
      await saveArea(ev.id, 'marketing', { ownerName: r.owner_name || 'Haley Wright', preData: pre, postData: r.post_data || {}, authUserId: session && session.user && session.user.id });
    } catch (e) { setMkData(m => ({ ...(m || {}), [c]: cur })); }
  }
  const [itemForm, setItemForm] = useState({ text: '', due: '', assignee: '', assigneeId: null, priority: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [expandForm, setExpandForm] = useState({ text: '', due: '', assignee: '', assigneeId: null, priority: '', estimated: '', actual: '', notes: '' });
  const [subtaskInput, setSubtaskInput] = useState('');
  const sectionTitle = SECTION_HEAD;
  const [quick, setQuick] = useState('');
  const quickRef = useRef(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const { volunteer, session } = useVol();

  // "Selling alcohol" does the paperwork setup in one click: the license costs are recorded as expenses and the steps
  // become checklist duties. ABC license $50 + sheriff signature $30 = $80.
  async function addAlcoholLicense() {
    if (ev.checklist.some(t => t.auto === 'alcohol-license')) { setAttachedMsg('The alcohol license duties are already on the checklist.'); return; }
    if (!window.confirm('Selling alcohol needs an ABC license.\n\nThis adds to Expenses:\n   ABC license fee (money order)   $50\n   Sheriff signature fee   $30\n   Total   $80\n\nand three duties to the checklist: fill out the application, take it to the sheriff, and send it in with a money order.\n\nAdd them?')) return;
    setAttachedMsg('Adding…');
    try {
      const fin = await fetchEventFinancials(ev.name).catch(() => null);
      const already = !!(fin && fin.expenses.some(r => /alcohol license|abc license/i.test(r.description || '')));
      if (!already) {
        const base = { event_name: ev.name, area: 'Events', type: 'Purchase', status: 'Submitted', date: new Date().toISOString().slice(0, 10), volunteer_id: (volunteer && volunteer.id) || null, volunteer_auth_user_id: (session && session.user && session.user.id) || null };
        const r1 = await insertReimbursement({ ...base, description: 'ABC alcohol license fee (money order)', amount: 50 });
        const r2 = await insertReimbursement({ ...base, description: 'Sheriff signature for alcohol license', amount: 30 });
        if (r1.error || r2.error) throw new Error(r1.error || r2.error);
      }
      const duty = (text, estimated) => ({ id: cryptoId(), text, category: 'Hospitality', done: false, due: '', timing: 'before', assignee: '', assigneeId: null, priority: '', estimated, actual: 0, notes: '', subtasks: [], auto: 'alcohol-license' });
      onUpdate(e => ({ ...e, checklist: [...e.checklist,
        duty('Fill out the ABC alcohol license application', 0),
        duty('Take the application to the sheriff for signature ($30 fee)', 30),
        duty('Get a $50 money order for the ABC fee and mail the application off at the post office', 50),
      ] }));
      setAttachedMsg(already ? 'Added the three duties. The expenses were already recorded.' : 'Added $80 to Expenses ($50 ABC license + $30 sheriff) and three duties to the checklist below.');
    } catch (err) {
      setAttachedMsg('Could not add the alcohol license expenses: ' + (err.message || 'please try again') + '. Nothing was added to the checklist.');
    }
  }
  const [quickCat, setQuickCat] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  function startPrompt(text, group) { setQuickCat(checkCat(group)); setQuick(text + ': '); setTimeout(() => { if (quickRef.current) { quickRef.current.focus(); const n = quickRef.current.value.length; quickRef.current.setSelectionRange(n, n); } }, 0); }

  // Note taker: type a thought and press Enter, then the next. Pasting several lines adds one note per line.
  // Later each note is attached to where it belongs (a duty, the day-of timeline, a vendor, the after notes).
  const [attachedMsg, setAttachedMsg] = useState('');
  function addQuick(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    onUpdate(e => ({ ...e, notes: [...(e.notes || []), ...lines.map(l => ({ id: cryptoId(), text: l, category: quickCat || '' }))] }));
    setQuick('');
    setQuickCat('');
  }
  // "doors open at 4:30" -> 16:30. Without am/pm, 1 to 7 is read as the afternoon.
  function parseClock(text) {
    const m = String(text).match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i) || String(text).match(/\b(\d{1,2}):(\d{2})\b/);
    if (!m) return null;
    let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0; const ap = (m[3] || '').toLowerCase();
    if (h > 23 || min > 59) return null;
    if (ap.startsWith('p') && h < 12) h += 12;
    else if (ap.startsWith('a') && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }
  function attachNote(note, target) {
    if (!target) return;
    const drop = e => (e.notes || []).filter(n => n.id !== note.id);
    if (target === 'task') {
      onUpdate(e => ({ ...e, notes: drop(e), checklist: [...e.checklist, { id: cryptoId(), text: note.text, category: note.category || '', done: false, due: '', assignee: mkWho(note.category).assignee || '', assigneeId: mkWho(note.category).assigneeId || null, priority: '', estimated: 0, actual: 0, notes: '', subtasks: [] }] }));
      setAttachedMsg('Added to the checklist below. Set who and when on its line.');
    } else if (target === 'dayof') {
      let time = parseClock(note.text);
      if (!time) { time = parseClock(window.prompt('What time is this? (for example 4:30 PM)') || ''); if (!time) return; }
      onUpdate(e => ({ ...e, notes: drop(e), timeline: [...e.timeline, { id: cryptoId(), time, activity: note.text }] }));
      setAttachedMsg('Added to the Day-Of Timeline.');
    } else if (target === 'vendor') {
      onUpdate(e => ({ ...e, notes: drop(e), vendors: [...e.vendors, { id: cryptoId(), name: note.text, role: '', contact: '', notes: '', confirmed: false }] }));
      setAttachedMsg('Added to the Volunteers, Staffing & Vendors list.');
    } else if (target === 'after') {
      onUpdate(e => ({ ...e, notes: drop(e), afterNotes: { ...e.afterNotes, followUps: e.afterNotes.followUps ? e.afterNotes.followUps + '\n' + note.text : note.text } }));
      setAttachedMsg('Added to After Notes as a follow-up.');
    }
  }
  function deleteNote(id) { onUpdate(e => ({ ...e, notes: (e.notes || []).filter(n => n.id !== id) })); }
  function allToDuties() {
    const list = ev.notes || [];
    if (!list.length) return;
    onUpdate(e => ({ ...e, notes: [], checklist: [...e.checklist, ...list.map(n => ({ id: cryptoId(), text: n.text, category: n.category || '', done: false, due: '', assignee: mkWho(n.category).assignee || '', assigneeId: mkWho(n.category).assigneeId || null, priority: '', estimated: 0, actual: 0, notes: '', subtasks: [] }))] }));
    setAttachedMsg('All notes added to the checklist below.');
  }
  // Marketing is Haley Wright's: marketing lines get her as the person unless someone else is named.
  const haley = (volunteers || []).find(v => ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim().toLowerCase() === 'haley wright');
  const mkWho = (cat) => (cat === 'Marketing' ? { assignee: 'Haley Wright', assigneeId: haley ? haley.id : null, assignedIds: haley ? [haley.id] : [], people: haley ? [] : [{ id: 'haley', name: 'Haley Wright', phone: '' }] } : {});
  useEffect(() => {
    if (!volunteers || !volunteers.length) return;
    if (!ev.checklist.some(t => t.category === 'Marketing' && !t.assignee)) return;
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => (t.category === 'Marketing' && !t.assignee ? { ...t, ...mkWho('Marketing') } : t)) }));
  }, [ev.id, ev.checklist.length, !!haley]);
  function patchNeed(id, patch) {
    onUpdate(e => ({ ...e, vendors: e.vendors.map(v => v.id === id ? { ...v, ...patch } : v) }));
  }
  const [needOpenId, setNeedOpenId] = useState(null);
  const [tlOpenId, setTlOpenId] = useState(null);
  function removeNeed(v) {
    if (!window.confirm('Remove "' + needTitle(v) + '" from the list?')) return;
    onUpdate(e => ({ ...e, vendors: e.vendors.filter(x => x.id !== v.id) }));
    if (needOpenId === v.id) setNeedOpenId(null);
  }
  const allItems = [
    ...ev.checklist.map(t => ({ need: false, t, cat: checkCat(t.category) })),
    ...ev.vendors.map(v => ({ need: true, v, cat: needCategory(v) })),
    ...ev.timeline.map(t => ({ tl: true, t, cat: DAYOF_CAT })),
    ...(showMarketing && mkData ? MARKETING_CHANNELS.filter(c => (mkData[c] || {}).done).map(c => ({ mk: true, c, cat: 'Marketing' })) : []),
  ];
  const isDone = (i) => (i.budget ? budgetDone : i.mk ? !!(mkData[i.c] || {}).done : i.need ? needHandled(i.v) : !!i.t.done);
  const catGroups = [...CHECKLIST_CATEGORIES.filter(c => c !== 'Marketing' && c !== 'Volunteers & vendors'), 'Marketing', 'Volunteers & vendors', DAYOF_CAT].map(c => ({ cat: c, items: allItems.filter(i => i.cat === c).sort(c === DAYOF_CAT ? (x, y) => String(x.t.time).localeCompare(String(y.t.time)) : c === 'General' || c === 'Hospitality' ? (x, y) => (isDone(x) ? 1 : 0) - (isDone(y) ? 1 : 0) : (x, y) => (isDone(y) ? 1 : 0) - (isDone(x) ? 1 : 0)) })).filter(g => g.items.length || (g.cat === 'Money' && !!fin));
  const shownGroups = catGroups.filter(g => catFilter === 'All' || catFilter === g.cat);

  // ---- Email the checklist to the committee: a finished, read-only copy of what is on screen.
  const [emailOpen, setEmailOpen] = useState(false);
  const emailRef = useRef(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailPreview, setEmailPreview] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);
  useEffect(() => {
    if (!emailTick) return;
    setEmailOpen(true); setEmailSubject(sub => sub || 'Checklist: ' + ev.name); setEmailMsg(null);
    const t = setTimeout(() => { if (emailRef.current) emailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
    return () => clearTimeout(t);
  }, [emailTick]);
  const committee = (volunteers || []).filter(v => matchVolunteerAreas(v.Team).includes('Events'));
  const committeeWithEmail = committee.filter(v => v.Email && String(v.Email).includes('@'));

  function buildEmailHtml() {
    const GOLD = '#886c44';
    const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const circle = (done) => (done
      ? '<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:50%;background:' + GOLD + ';color:#ffffff;font-size:11px;text-align:center;">&#10003;</span>'
      : '<span style="display:inline-block;width:15px;height:15px;border-radius:50%;border:1.5px solid #d8cfc0;"></span>');
    const star = '<span style="display:inline-block;width:18px;text-align:center;font-size:19px;line-height:18px;color:' + GOLD + ';">&#9733;</span>';
    const row = (done, titleHtml, subHtml, accent, badge, marker) =>
      '<tr><td bgcolor="#ffffff" style="padding:0;background:#ffffff;border-bottom:1px solid #ede8df;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:4px solid ' + (accent || '#ffffff') + ';"><tr>'
      + '<td width="44" valign="top" style="padding:13px 0 13px 12px;">' + (marker || circle(done)) + '</td>'
      + '<td valign="top" style="padding:11px 8px 11px 0;"><div style="font-size:15px;font-weight:bold;color:#2a2a2a;line-height:1.35;">' + titleHtml + '</div>'
      + (subHtml ? '<div style="font-size:12.5px;color:#888888;margin-top:2px;line-height:1.45;">' + subHtml + '</div>' : '') + '</td>'
      + (badge ? '<td valign="top" align="right" style="padding:12px 12px 0 0;white-space:nowrap;"><span style="display:inline-block;background:#f0ebe2;color:#2a2a2a;font-size:11px;padding:2px 9px;border-radius:12px;">' + esc(badge) + '</span></td>' : '')
      + '</tr></table></td></tr>';
    const whenText = (t) => {
      const tm = t.timing || (t.due ? 'before' : '');
      const base = { asap: 'As soon as possible', month: '1 month out', twoweeks: '2 weeks out', week: '1 week out', meeting: 'Meeting before event', dayof: 'Day of event' }[tm];
      const d = t.due && tm !== 'asap' && tm !== 'meeting' && tm !== 'dayof' ? fmtDateShort(t.due) : '';
      if (base) return base + (d ? ' (' + d + ')' : '');
      return d;
    };
    const itemRow = (it) => {
      if (it.mk) return row(true, esc(it.c), '', null);
      if (it.tl) {
        const t = it.t; const who = whoOn(t, volunteers); const tg = Number(t.target) || 0;
        const sub = t.noAssign ? '' : (tg ? who.length + ' of ' + tg + ' assigned' : who.length ? who.length + ' assigned' : 'No one assigned yet') + (who.length ? ': ' + esc(who.map(w => w.name).join(', ')) : '');
        return row(!!t.done, esc(fmtTime12(t.time)) + ' &middot; ' + esc(t.activity), sub, null, '', star);
      }
      if (it.need) {
        const v = it.v; const kind = v.kind || ''; const who = whoOn(v, volunteers); const tg = Number(v.target) || 0;
        const title = v.who || !v.role ? v.name : v.role + ': ' + v.name;
        let sub;
        if (kind === 'volunteer' || kind === 'activity') sub = who.length + (tg ? ' of ' + tg : '') + ' assigned' + (who.length ? ': ' + esc(who.map(w => w.name).join(', ')) : '');
        else sub = [v.who ? v.who : (v.role ? v.name : '')].filter(Boolean).map(esc).join(' &nbsp;&middot;&nbsp; ');
        const found = !!(who.length || v.who || v.role || v.confirmed);
        const cost = costLabel(v);
        return row(needHandled(v), esc(title), (sub || (found ? '' : 'Still needed')) + (cost ? (sub ? ' &nbsp;&middot;&nbsp; ' : '') + esc(cost) : ''), null, kind ? NEED_KINDS[kind] : '');
      }
      const t = it.t;
      const sub = [t.assignee ? esc(t.assignee) : 'No one assigned yet', t.done ? 'Done' : esc(whenText(t))].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');
      return row(!!t.done, esc(t.text), sub, t.priority ? TASK_PRIORITY[t.priority].color : null);
    };
    const total = catGroups.reduce((n, g) => n + g.items.length, 0);
    const doneTotal = catGroups.reduce((n, g) => n + g.items.filter(isDone).length, 0);
    const ICON_BASE = 'https://northstarhouse.github.io/Portal/assets/icons/cat-';
    const ICON_KEY = { General: 'general', Logistics: 'logistics', Hospitality: 'hospitality', Sponsorship: 'sponsorship', Interiors: 'interiors', Marketing: 'marketing', Money: 'money', 'Volunteers & vendors': 'volunteers', Budget: 'money', [DAYOF_CAT]: 'dayof' };
    // The budget's own lines: what comes in (website tickets and logged earnings) and what has been spent.
    // Earnings, expenses and net as of today, each on its own line.
    const budgetStats = () => {
      if (!fin) return '';
      const net = fin.totalEarnings - fin.totalExpenses;
      const stat = (label, amount, color) => '<tr><td style="padding:10px 0;border-bottom:1px solid #ede8df;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#2a2a2a;">' + label + '</td><td align="right" style="padding:10px 0;border-bottom:1px solid #ede8df;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:' + color + ';white-space:nowrap;">' + esc(label === 'Budget' ? budgetText(budgetAmount) : money(amount)) + '</td></tr>';
      return '<tr><td bgcolor="#ffffff" style="padding:6px 16px 4px 16px;background:#ffffff;"><div style="font-size:11px;color:#888888;padding:4px 0 2px;">As of ' + esc(fmtDate(todayStr())) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        + stat('Budget', null, '#2a2a2a') + stat('Earnings', fin.totalEarnings, '#4a5d3a') + stat('Expenses', fin.totalExpenses, '#8a4a2e') + stat('Net', net, net >= 0 ? '#4a5d3a' : '#8a4a2e') + '</table></td></tr>';
    };
    const budgetDetail = () => {
      if (!fin) return '';
      const line = (label, amount, color, strong) => '<tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid #f3ecdf;font-size:13px;color:#2a2a2a;' + (strong ? 'font-weight:bold;' : '') + '">' + esc(label) + '</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f3ecdf;font-size:13px;font-weight:bold;color:' + color + ';white-space:nowrap;">' + esc(money(amount)) + '</td></tr>';
      const head = (t) => '<tr><td colspan="2" style="padding:12px 0 2px;font-size:11px;font-weight:bold;letter-spacing:1px;color:' + GOLD + ';text-transform:uppercase;">' + t + '</td></tr>';
      const ern = [line('Website ticket sales' + (!fin.rsvpOnly && fin.ticketsSold > 0 ? ' (' + fin.ticketsSold + ' sold)' : ''), fin.rsvpOnly ? 0 : fin.ticketRevenue, '#4a5d3a')]
        .concat(fin.earnings.map(r => line(r.earning_source || 'Earning', parseFloat(r.amount) || 0, '#4a5d3a')));
      const exp = fin.expenses.length ? fin.expenses.map(r => line(r.description || r.type || 'Expense', parseFloat(r.amount) || 0, '#8a4a2e')) : ['<tr><td colspan="2" style="padding:6px 0;font-size:13px;color:#888888;">No expenses logged yet.</td></tr>'];
      return '<tr><td bgcolor="#ffffff" style="padding:0 16px 12px 46px;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        + head('Earnings') + ern.join('') + line('Total earnings', fin.totalEarnings, '#4a5d3a', true)
        + head('Expenses') + exp.join('') + line('Total expenses', fin.totalExpenses, '#8a4a2e', true)
        + line('Net', fin.totalEarnings - fin.totalExpenses, fin.totalEarnings - fin.totalExpenses >= 0 ? '#4a5d3a' : '#8a4a2e', true)
        + '</table></td></tr>';
    };
    const groupsHtml = catGroups.map(g => {
      const d = g.items.filter(isDone).length;
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border:1px solid #cdb78e;border-collapse:separate;"><tr><td style="padding:14px 16px 8px;border-bottom:1px solid #cdb78e;">' + (ICON_KEY[g.cat] ? '<img src="' + ICON_BASE + ICON_KEY[g.cat] + '.png" width="20" height="20" alt="" style="vertical-align:middle;margin-right:8px;border:0;">' : '') + '<span style="font-size:12px;font-weight:bold;letter-spacing:1px;color:' + GOLD + ';text-transform:uppercase;">' + esc(g.cat) + '</span>'
        + (g.cat !== 'Marketing' && g.items.length > 0 ? '<span style="font-size:12px;color:#888888;margin-left:10px;">' + (d === g.items.length ? 'all figured out &#10003;' : d + ' of ' + g.items.length + ' done') + '</span>' : '') + '</td></tr>'
        + g.items.map(itemRow).join('') + (g.cat === 'Money' ? budgetStats() + budgetDetail() : '') + '</table>';
    }).join('');
    const w0 = ev.website || {};
    const box = (title, inner) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border:1px solid #efe6d5;border-collapse:separate;background:#ffffff;"><tr><td style="padding:16px 18px;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;color:' + GOLD + ';text-transform:uppercase;margin-bottom:10px;line-height:1.4;">' + title + '</div>' + inner + '</td></tr></table>';
    // Event details: what Event Basics holds
    const dateTxt = w0.date_tbd ? 'To be announced' : (ev.date ? fmtDate(ev.date) : '');
    const timeTxt = w0.date_tbd ? '' : (ev.startTime ? fmtTime12(ev.startTime) + (ev.endTime ? ' – ' + fmtTime12(ev.endTime) : '') : '');
    const whereTxt = [w0.location_name || ev.location, (w0.spaces || []).length ? (w0.spaces || []).join(', ') : ''].filter(Boolean).join(' — ');
    const tierList = (ev.ticketTiers || []).filter(t => t && String(t.name || '').trim());
    const ticketTxt = w0.sells_tickets && tierList.length ? tierList.map(t => t.name + ' ' + (Number(t.price) > 0 ? '$' + t.price : 'free')).join('  |  ') : '';
    const detailRows = [
      ['Date', dateTxt], ['Time', timeTxt], ['Event type', ev.purpose], ['Event lead', ev.eventLead],
      ['Expected guests', ev.expectedAttendance || (ev.guestCount && ev.guestCount.invited ? String(ev.guestCount.invited) : '')],
      ['Tickets', ticketTxt], ['Pricing', ev.pricing],
    ].filter(r => r[1]);
    const detailsBox = box('Event details', detailRows.length
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + detailRows.map(r => '<tr><td width="110" style="vertical-align:baseline;padding:8px 10px 8px 0;border-bottom:1px solid #f3ecdf;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:#888888;">' + esc(r[0]) + '</td><td style="vertical-align:baseline;padding:8px 0;border-bottom:1px solid #f3ecdf;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:#2a2a2a;">' + esc(r[1]) + '</td></tr>').join('') + '</table>'
      : '<div style="font-size:13px;color:#888888;">Event details have not been filled in yet.</div>');
    // Volunteers confirmed: everyone assigned anywhere on the checklist, with what they are on
    const peopleNames = assignedPeople(ev, volunteers, attendExtra).map(x => x.name);
    const volsBox = box('Confirmed Day-Of Attendance', peopleNames.length
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + peopleNames.map(n => '<tr><td valign="top" style="padding:8px 0;border-bottom:1px solid #f3ecdf;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:#2a2a2a;">' + esc(n) + '</td></tr>').join('') + '</table>'
      : '<div style="font-size:13px;color:#888888;">No volunteers assigned yet.</div>');
    const w = ev.website || {};
    const when = w.date_tbd ? 'Date to be announced' : [ev.date ? fmtDate(ev.date) : '', ev.startTime ? fmtTime12(ev.startTime) + (ev.endTime ? ' – ' + fmtTime12(ev.endTime) : '') : ''].filter(Boolean).join('  ·  ');
    const note = emailNote.trim();
    return '<style>@media only screen and (max-width:540px){.ec-col{display:block!important;width:100%!important;padding:0 0 12px 0!important;box-sizing:border-box!important}}</style><div style="background:#e6ded0;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:680px;margin:0 auto;background:#fdfbf7;">'
      + '<div style="height:14px;background:' + GOLD + ';"></div>'
      + '<div style="padding:34px 36px 8px;text-align:center;"><div style="font-size:12px;letter-spacing:3px;color:' + GOLD + ';font-weight:bold;margin-bottom:12px;">EVENTS COMMITTEE &middot; CHECKLIST</div>'
      + '<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#2a2420;">' + esc(ev.name) + '</h1>'
      + '<div style="border-top:1px solid #e5ddcf;width:60%;margin:20px auto 0;"></div></div>'
      + (note ? '<div style="padding:18px 36px 0;font-size:15px;line-height:1.6;color:#444444;">' + esc(note).replace(/\n/g, '<br>') + '</div>' : '')
      + '<div style="padding:18px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="ec-col" valign="top" width="58%" style="padding:0 7px 14px 0;">' + detailsBox + '</td><td class="ec-col" valign="top" width="42%" style="padding:0 0 14px 7px;">' + volsBox + '</td></tr></table></div>'
      + '<div style="padding:6px 36px 6px;"><div style="font-size:13px;color:#888888;padding-top:14px;">' + doneTotal + ' of ' + total + ' done</div>' + groupsHtml + '</div>'
      + (flyerUrl ? '<div style="padding:18px 36px 0;text-align:center;"><div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:' + GOLD + ';text-transform:uppercase;margin-bottom:10px;">Event flyer</div><img src="' + esc(flyerUrl) + '" alt="' + esc(ev.name) + ' flyer" width="420" style="display:block;margin:0 auto;width:100%;max-width:420px;height:auto;border:0;"></div>' : '')
      + '<div style="padding:22px 36px 34px;text-align:center;"><a href="https://volunteerhub.northstarhouse.org/#/events-committee-planning" style="display:inline-block;background:' + GOLD + ';color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:15px 30px;">Open in the Volunteer Hub</a></div>'
      + '<div style="background:#f7f3ec;padding:14px 36px;text-align:center;font-size:11px;color:#999999;">North Star House</div>'
      + '</div></div>';
  }
  function buildEmailText() {
    const lines = ['Events Committee checklist: ' + ev.name, ''];
    catGroups.forEach(g => {
      lines.push(g.cat.toUpperCase());
      g.items.forEach(it => {
        const label = it.mk ? it.c : it.tl ? fmtTime12(it.t.time) + ' ' + it.t.activity : it.need ? (it.v.who || !it.v.role ? it.v.name : it.v.role + ': ' + it.v.name) : it.t.text;
        lines.push((isDone(it) ? '[x] ' : '[ ] ') + label);
      });
      lines.push('');
    });
    lines.push('Open in the Volunteer Hub: https://volunteerhub.northstarhouse.org/#/events-committee-planning');
    return lines.join('\n');
  }
  async function sendEmail(list, who) {
    if (!list.length) { setEmailMsg({ ok: false, text: 'No email address to send to.' }); return; }
    if (who === 'committee' && !window.confirm('Send this checklist to ' + list.length + ' committee member' + (list.length > 1 ? 's' : '') + '?')) return;
    setEmailBusy(true); setEmailMsg(null);
    const ok = await sendChecklistEmail({ to: list, subject: emailSubject.trim() || ('Checklist: ' + ev.name), html: buildEmailHtml(), text: buildEmailText() }).catch(() => false);
    setEmailBusy(false);
    setEmailMsg({ ok, text: ok ? (who === 'committee' ? 'Sent to ' + list.length + ' committee member' + (list.length > 1 ? 's' : '') + '.' : 'Test sent to ' + list[0] + '.') : 'Could not send. Please try again.' });
  }
  // Saves the people on a duty, and keeps assignee/assigneeId (the names, and the first volunteer) in step for the other screens.
  function patchDutyPeople(t, pt) {
    const next = { ...dutyPeople(t), ...pt };
    const roster = volunteers || [];
    const names = [...next.assignedIds.map(id => roster.find(x => x.id === id)).filter(Boolean).map(volFullName), ...next.people.map(pp => pp.name)];
    patchItem(t.id, { assignedIds: next.assignedIds, people: next.people, phones: next.phones, assignee: names.join(', '), assigneeId: next.assignedIds.length ? next.assignedIds[0] : null });
  }
  function patchItem(id, patch) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }

  function toggleItem(id) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }
  function deleteItem(id) {
    onUpdate(e => ({ ...e, checklist: e.checklist.filter(t => t.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  }
  function cycleItemPriority(id) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id ? { ...t, priority: nextPriority(t.priority) } : t) }));
  }
  function addItem() {
    if (!itemForm.text.trim()) return;
    onUpdate(e => ({ ...e, checklist: [...e.checklist, {
      id: cryptoId(), text: itemForm.text.trim(), done: false, due: itemForm.due,
      assignee: itemForm.assignee.trim(), assigneeId: itemForm.assigneeId, priority: itemForm.priority || '',
      estimated: 0, actual: 0, notes: '', subtasks: [],
    }] }));
    setItemForm({ text: '', due: '', assignee: '', assigneeId: null, priority: '' });
  }

  function startExpand(t) {
    setExpandedId(expandedId === t.id ? null : t.id);
    setExpandForm({
      text: t.text, due: t.due || '', assignee: t.assignee || '', assigneeId: t.assigneeId || null, priority: t.priority || '',
      estimated: t.estimated ? String(t.estimated) : '', actual: t.actual ? String(t.actual) : '', notes: t.notes || '',
    });
    setSubtaskInput('');
  }
  function saveExpand(id) {
    if (!expandForm.text.trim()) return;
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === id
      ? {
          ...t, text: expandForm.text.trim(), due: expandForm.due, priority: expandForm.priority,
          estimated: Number(expandForm.estimated) || 0, actual: Number(expandForm.actual) || 0, notes: expandForm.notes.trim(),
        }
      : t) }));
    setExpandedId(null);
  }

  function addSubtask(itemId) {
    if (!subtaskInput.trim()) return;
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === itemId
      ? { ...t, subtasks: [...(t.subtasks || []), { id: cryptoId(), text: subtaskInput.trim(), done: false }] }
      : t) }));
    setSubtaskInput('');
  }
  function toggleSubtask(itemId, subId) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === itemId
      ? { ...t, subtasks: (t.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s) }
      : t) }));
  }
  function deleteSubtask(itemId, subId) {
    onUpdate(e => ({ ...e, checklist: e.checklist.map(t => t.id === itemId
      ? { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subId) }
      : t) }));
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={sectionTitle}>Checklist</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_PRIORITY.high.color, display: 'inline-block' }} />High</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_PRIORITY.medium.color, display: 'inline-block' }} />Medium</span>
          </div>
        </div>
        <input ref={quickRef} className="input" style={{ marginBottom: 12 }} autoFocus value={quick} placeholder="Type a note and press Enter…"
          onChange={e => setQuick(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuick(quick); } }}
          onPaste={e => { const t = e.clipboardData.getData('text'); if (/\r?\n/.test(t.trim())) { e.preventDefault(); addQuick(t); } }} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
          Just get everything down, one per line. Afterwards, attach each note to where it belongs.
          {' '}<button type="button" onClick={() => setShowPrompts(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 11 }}>{showPrompts ? 'Hide prompts' : 'Need ideas? Show prompts'}</button>
        </div>
        {showPrompts && (
          <div style={{ border: '0.5px solid var(--border-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Tap one to start a note with it, then type your answer and press Enter. "Selling alcohol" sets up the license costs and duties for you.</div>
            {PLANNING_PROMPTS.map(g => (
              <div key={g.group} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#886c44', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>{g.group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.items.map(it => { const label = typeof it === 'string' ? it : it.label; return <button key={label} type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => (typeof it === 'string' ? startPrompt(it, g.group) : (it.action === 'alcohol' ? addAlcoholLicense() : null))}>{label}</button>; })}
                </div>
              </div>
            ))}
          </div>
        )}
        {(ev.notes || []).length > 0 && (
          <div style={{ border: '0.5px solid var(--border-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, background: '#faf8f4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Notes to sort ({ev.notes.length})</div>
              <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={allToDuties}>Make all checklist duties</button>
            </div>
            {ev.notes.map(n => (
              <div key={n.id} className="row-x-host" tabIndex={-1} style={{ outline: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '0.5px solid var(--border-light)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflowWrap: 'anywhere' }}>{n.text}{n.category ? <span style={{ fontSize: 11, color: 'var(--muted)' }}> · {n.category}</span> : null}</span>
                <select className="input" value="" onChange={e => attachNote(n, e.target.value)} style={{ width: 190, flexShrink: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto' }}>
                  <option value="">Attach to…</option>
                  <option value="task">Checklist duty</option>
                  <option value="dayof">Day-Of Timeline</option>
                  <option value="vendor">Volunteers & vendors list</option>
                  <option value="after">After Notes (follow-up)</option>
                </select>
                <button className="row-x" onClick={() => deleteNote(n.id)} title="Delete this note" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>
        )}
        {attachedMsg && <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 10 }}>{attachedMsg}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 10px' }}>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { if (!emailSubject) setEmailSubject('Checklist: ' + ev.name); setEmailOpen(o => !o); setEmailMsg(null); }}>{emailOpen ? 'Close email' : '✉ Email update to committee'}</button>
        </div>
        {emailOpen && (
          <div ref={emailRef} style={{ border: '0.5px solid var(--border-light)', borderRadius: 10, padding: '14px 16px', marginBottom: 18, background: '#faf8f4' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Email this checklist</div>
            <div className="label">Subject</div>
            <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={{ marginBottom: 10 }} />
            <div className="label">A note at the top (optional)</div>
            <textarea className="input" rows={3} value={emailNote} onChange={e => setEmailNote(e.target.value)} placeholder="For example: please check your lines before Thursday's meeting." style={{ resize: 'vertical', marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Goes to {committeeWithEmail.length} committee member{committeeWithEmail.length === 1 ? '' : 's'} (the Events team): {committeeWithEmail.map(volFullName).join(', ') || 'none found'}.
              {committee.length > committeeWithEmail.length && ' No email on file for: ' + committee.filter(v => !committeeWithEmail.includes(v)).map(volFullName).join(', ') + '.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEmailPreview(p => !p)}>{emailPreview ? 'Hide preview' : 'Preview'}</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} disabled={emailBusy || !(volunteer && volunteer.Email)} onClick={() => sendEmail([volunteer.Email], 'me')} title={volunteer && volunteer.Email ? 'Sends only to ' + volunteer.Email : 'No email on your volunteer record'}>Send a test to me</button>
              <button type="button" className="btn-gold" style={{ fontSize: 12 }} disabled={emailBusy || !committeeWithEmail.length} onClick={() => sendEmail(committeeWithEmail.map(v => v.Email), 'committee')}>{emailBusy ? 'Sending…' : 'Email update to committee'}</button>
              {emailMsg && <span style={{ fontSize: 12, color: emailMsg.ok ? '#2e7d32' : '#b3261e' }}>{emailMsg.text}</span>}
            </div>
            {emailPreview && <iframe title="Email preview" srcDoc={buildEmailHtml()} style={{ width: '100%', height: 560, border: '0.5px solid var(--border)', borderRadius: 8, marginTop: 12, background: '#fff' }} />}
          </div>
        )}
        {catGroups.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0 14px' }}>
            <button type="button" className={catFilter === 'All' ? 'btn-gold' : 'btn-ghost'} style={{ fontSize: 11, padding: '4px 11px' }} onClick={() => setCatFilter('All')}>All ({allItems.filter(isDone).length}/{allItems.length})</button>
            {catGroups.map(g => (
              <button key={g.cat} type="button" className={catFilter === g.cat ? 'btn-gold' : 'btn-ghost'} style={{ fontSize: 11, padding: '4px 11px' }} onClick={() => setCatFilter(g.cat)}>{g.cat} ({g.items.filter(isDone).length}/{g.items.length})</button>
            ))}
          </div>
        )}
        {shownGroups.map(g => (
        <div key={g.cat} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11, fontWeight: 700, color: '#886c44', textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 0 2px', borderBottom: '1.5px solid #e8dfd0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{CATEGORY_ICONS[g.cat]}{g.cat}</span>
            {g.cat !== 'Marketing' && g.items.length > 0 && <span style={{ fontWeight: 500, color: g.items.every(isDone) ? '#2e7d32' : 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>{g.items.every(isDone) ? 'all figured out ✓' : g.items.filter(isDone).length + ' of ' + g.items.length + ' done'}</span>}
          </div>
        {g.items.map(it => {
          if (it.mk) {
            const done = !!(mkData[it.c] || {}).done;
            return (
              <ItemRow key={'mk-' + it.c} done={done}>
                <CheckCircle checked={!!(done)} onChange={() => toggleChannel(it.c)} />
                <span style={{ flex: 1, fontSize: 13, textDecoration: 'none', color: 'var(--text)' }}>{it.c}</span>
              </ItemRow>
            );
          }
          if (it.tl) {
            return <TimelineRow key={'tl-' + it.t.id} t={it.t} volunteers={volunteers} onUpdate={onUpdate} isOpen={tlOpenId === it.t.id} onToggle={() => setTlOpenId(tlOpenId === it.t.id ? null : it.t.id)} />;
          }
          if (it.need) {
            return <NeedRow key={'need-' + it.v.id} v={it.v} volunteers={volunteers} patch={patchNeed} remove={removeNeed} isOpen={needOpenId === it.v.id} onToggle={() => setNeedOpenId(needOpenId === it.v.id ? null : it.v.id)} />;
          }
          const t = it.t;
          const hasMoney = t.estimated > 0 || t.actual > 0;
          const hasNotes = !!(t.notes && t.notes.trim());
          const subtasks = t.subtasks || [];
          const subDone = subtasks.filter(s => s.done).length;
          const isOpen = expandedId === t.id;
          return (
            <div key={t.id}>
              <ItemRow done={t.done} onDelete={() => deleteItem(t.id)} accent={t.priority ? TASK_PRIORITY[t.priority].color : null} onAccent={() => cycleItemPriority(t.id)} accentTitle={(t.priority ? TASK_PRIORITY[t.priority].label : 'No priority') + ' — click this left edge to change (none, medium, high)'}>
                <CheckCircle checked={!!(t.done)} onChange={() => toggleItem(t.id)} />
                <button onClick={() => startExpand(t)} title="Edit item"
                  style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 13, textDecoration: 'none', color: 'var(--text)' }}>{t.text}</span>
                  {(hasMoney || hasNotes || subtasks.length > 0) && (
                    <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 8 }}>
                      {subtasks.length > 0 ? `${subDone}/${subtasks.length} subtasks` : ''}
                      {subtasks.length > 0 && (hasMoney || hasNotes) ? ' · ' : ''}
                      {hasMoney ? `Est. ${money(t.estimated)} · Act. ${money(t.actual)}` : ''}{hasMoney && hasNotes ? ' · ' : ''}{hasNotes ? 'notes' : ''}
                    </span>
                  )}
                </button>
                <select className="input" value={t.category || ''} onChange={e => patchItem(t.id, { category: e.target.value, ...(e.target.value === 'Marketing' && !t.assignee ? mkWho('Marketing') : {}) })} title="Category" style={{ width: 118, flexShrink: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto' }}>
                  <option value="">General</option>
                  {CHECKLIST_CATEGORIES.filter(c => c !== 'General').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <DutyWho t={t} volunteers={volunteers} onPatch={pt => patchDutyPeople(t, pt)} />
                {t.done && <span style={{ width: 152, flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#2e7d32', paddingLeft: 8 }}>Done</span>}
                {!t.done && !((t.timing === 'before' || (!t.timing && t.due)) && t.due) && <select className="input" value={t.timing || (t.due ? 'before' : '')} style={{ width: 152, flexShrink: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto' }}
                  onChange={e => { const v = e.target.value; patchItem(t.id, { timing: v, due: v === 'before' ? (t.timing === 'dayof' ? '' : (t.due || '')) : dueForTiming(v, ev.date) }); }}>
                  <option value="">When?</option>
                  <option value="asap">As soon as possible</option>
                  <option value="month">1 month out</option>
                  <option value="twoweeks">2 weeks out</option>
                  <option value="week">1 week out</option>
                  <option value="meeting">Meeting before event</option>
                  <option value="dayof">Day of event</option>
                  <option value="before">Pick a date</option>
                </select>}
                {!t.done && (t.timing || (t.due ? 'before' : '')) === 'before' && <input className="input" type="date" value={t.due || ''} title="Clear the date to pick a different timing" onChange={e => patchItem(t.id, { due: e.target.value })} style={{ width: 152, flexShrink: 0, fontSize: 12, padding: '5px 8px' }} />}
              </ItemRow>
              {isOpen && (
                <div style={{ padding: '10px 0 14px 33px' }}>
                  <div className="label">Item</div>
                  <input className="input" style={{ marginBottom: 8 }} value={expandForm.text} onChange={e => setExpandForm(f => ({ ...f, text: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div className="label">Priority</div>
                      <select className="input" style={{ width: 118, appearance: 'auto' }} value={expandForm.priority} onChange={e => setExpandForm(f => ({ ...f, priority: e.target.value }))}>
                        <option value="">No priority</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <div className="label">Due</div>
                      <input className="input" type="date" style={{ width: 130 }} value={expandForm.due} onChange={e => setExpandForm(f => ({ ...f, due: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ width: 130 }}>
                      <div className="label">How many volunteers</div>
                      <input className="input" type="number" min="0" defaultValue={t.target || ''} key={t.id + 'tg' + (t.target || '')} placeholder="1" onBlur={e => { const n = Number(e.target.value) || 0; if (n !== (Number(t.target) || 0)) patchItem(t.id, { target: n }); }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="label">Who is on this</div>
                      <AssignVolunteers v={dutyPeople(t)} volunteers={volunteers} target={Number(t.target) || 0} onPatch={pt => patchDutyPeople(t, pt)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="label">Estimated $</div>
                      <input className="input" type="number" value={expandForm.estimated} onChange={e => setExpandForm(f => ({ ...f, estimated: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="label">Actual $</div>
                      <input className="input" type="number" value={expandForm.actual} onChange={e => setExpandForm(f => ({ ...f, actual: e.target.value }))} />
                    </div>
                  </div>
                  <div className="label">Notes</div>
                  <textarea className="input" rows={3} style={{ resize: 'vertical', marginBottom: 12 }} value={expandForm.notes} onChange={e => setExpandForm(f => ({ ...f, notes: e.target.value }))} placeholder="Details for this item…" />

                  <div className="label" style={{ marginBottom: 6 }}>Subtasks</div>
                  {subtasks.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                      <CheckCircle checked={!!(s.done)} onChange={() => toggleSubtask(t.id, s.id)} size={14} />
                      <span style={{ flex: 1, fontSize: 12, textDecoration: 'none', color: s.done ? 'var(--muted)' : 'var(--text)' }}>{s.text}</span>
                      <button onClick={() => deleteSubtask(t.id, s.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '0 2px' }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 12 }}>
                    <input className="input" style={{ flex: 1, fontSize: 12 }} placeholder="Add a subtask…" value={subtaskInput}
                      onChange={e => setSubtaskInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(t.id); } }} />
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => addSubtask(t.id)}>Add</button>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-gold" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => saveExpand(t.id)}>Save</button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setExpandedId(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {g.cat === 'Money' && fin && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0 2px 14px' }}>As of {fmtDate(todayStr())}</div>
            {[['Budget', null, '#2a2a2a'], ['Earnings', fin.totalEarnings, '#4a5d3a'], ['Expenses', fin.totalExpenses, '#8a4a2e'], ['Net', fin.totalEarnings - fin.totalExpenses, fin.totalEarnings - fin.totalExpenses >= 0 ? '#4a5d3a' : '#8a4a2e']].map(r => (
              <div key={r[0]} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 10px 14px', borderBottom: '0.5px solid var(--border-light)' }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r[0]}</span>
                <span style={{ fontSize: 14, fontWeight: r[0] === 'Budget' && !hasBudget(budgetAmount) ? 500 : 700, fontStyle: r[0] === 'Budget' && !hasBudget(budgetAmount) ? 'italic' : 'normal', color: r[0] === 'Budget' && !hasBudget(budgetAmount) ? '#b8863b' : r[2], paddingRight: 4 }}>{r[0] === 'Budget' ? budgetText(budgetAmount) : money(r[1])}</span>
              </div>
            ))}
          </div>
        )}
        </div>
        ))}
        <datalist id={'vols-' + ev.id}>{(volunteers || []).map(v => <option key={v.id} value={(v['First Name'] + ' ' + v['Last Name']).trim()} />)}</datalist>
      </div>

    </div>
  );
}

function PreplanningTab({ ev, onUpdate, onRsvpChange, autoEdit, onClose }) {
  return <WebsiteEventPanel key={ev.id} ev={ev} onUpdate={onUpdate} onRsvpChange={onRsvpChange} autoEdit={autoEdit} onClose={onClose} />;
}

function DayOfTab({ ev, onUpdate, volunteers }) {
  const [form, setForm] = useState({ time: '', activity: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ time: '', activity: '' });

  function deleteItem(id) {
    onUpdate(e => ({ ...e, timeline: e.timeline.filter(t => t.id !== id) }));
  }
  function addItem() {
    if (!form.activity.trim()) return;
    onUpdate(e => ({ ...e, timeline: [...e.timeline, { id: cryptoId(), time: form.time || '00:00', activity: form.activity.trim() }] }));
    setForm({ time: '', activity: '' });
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditForm({ time: t.time, activity: t.activity });
  }
  function saveEdit() {
    if (!editForm.activity.trim()) return;
    const id = editingId;
    onUpdate(e => ({ ...e, timeline: e.timeline.map(t => t.id === id ? { ...t, time: editForm.time || '00:00', activity: editForm.activity.trim() } : t) }));
    setEditingId(null);
  }

  const sorted = [...ev.timeline].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <div style={SECTION_HEAD}>Run of Show</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No timeline items yet.</div>
      ) : sorted.map(t => (
        editingId === t.id ? (
          <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
            <TimeSelect value={editForm.time} onChange={v => setEditForm(f => ({ ...f, time: v }))} />
            <input className="input" style={{ flex: 1 }} value={editForm.activity} onChange={e => setEditForm(f => ({ ...f, activity: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} autoFocus />
            <button className="btn-gold" style={{ padding: '7px 12px', fontSize: 12 }} onClick={saveEdit}>Save</button>
            <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        ) : (
          <ItemRow key={t.id} onDelete={() => deleteItem(t.id)} done={t.done}>
            <CheckCircle checked={!!(!!t.done)} onChange={() => onUpdate(e => ({ ...e, timeline: e.timeline.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))} />
            <span style={{ fontSize: 12, color: 'var(--muted)', width: 54, flexShrink: 0 }}>{t.time}</span>
            <button onClick={() => startEdit(t)} title="Edit"
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', textDecoration: 'none' }}>
              {t.activity}
            </button>
            <TimelineAssign t={t} volunteers={volunteers} onUpdate={onUpdate} />
          </ItemRow>
        )
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <TimeSelect value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} />
        <input className="input" style={{ flex: 1 }} placeholder="Activity…" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} />
        <button className="btn-gold" style={{ padding: '9px 14px' }} onClick={addItem}>Add</button>
      </div>
    </div>
  );
}

function AfterTab({ ev, onUpdate }) {
  const [notes, setNotes] = useState(ev.afterNotes);
  const [editing, setEditing] = useState(false);

  function save() {
    onUpdate(e => ({ ...e, afterNotes: notes }));
    setEditing(false);
  }
  function cancel() {
    setNotes(ev.afterNotes);
    setEditing(false);
  }

  if (!editing) {
    const n = ev.afterNotes;
    const hasAny = n.wentWell || n.wentWrong || n.finalAttendance || n.finalBudget || n.followUps;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>After Notes</div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Edit</button>
        </div>
        {hasAny ? (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {n.wentWell && <div><strong>What went well:</strong> {n.wentWell}</div>}
            {n.wentWrong && <div><strong>What didn't go well:</strong> {n.wentWrong}</div>}
            {n.finalAttendance && <div><strong>Final attendance:</strong> {n.finalAttendance}</div>}
            {n.finalBudget && <div><strong>Final budget:</strong> {n.finalBudget}</div>}
            {n.followUps && <div><strong>Follow-up items:</strong> {n.followUps}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing recorded yet -- click Edit to add after-notes.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div className="label">What went well</div>
          <textarea className="input" rows={4} style={{ resize: 'vertical' }} value={notes.wentWell} onChange={e => setNotes(n => ({ ...n, wentWell: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="label">What didn't go well</div>
          <textarea className="input" rows={4} style={{ resize: 'vertical' }} value={notes.wentWrong} onChange={e => setNotes(n => ({ ...n, wentWrong: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div className="label">Final attendance</div>
          <input className="input" value={notes.finalAttendance} onChange={e => setNotes(n => ({ ...n, finalAttendance: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="label">Final budget</div>
          <input className="input" value={notes.finalBudget} onChange={e => setNotes(n => ({ ...n, finalBudget: e.target.value }))} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div className="label">Follow-up items for next time</div>
        <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={notes.followUps} onChange={e => setNotes(n => ({ ...n, followUps: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-gold" onClick={save}>Save</button>
        <button className="btn-ghost" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

function FinancialsTab({ ev }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState({ ticketsSold: 0, revenue: 0 });
  const [rsvpOnly, setRsvpOnly] = useState(false);
  const { session } = useVol();
  const [budgetAmount, setBudgetAmount] = useState('');
  async function saveBudgetAmount(val) {
    setBudgetAmount(val);
    try {
      const rows = await fetchAreaData(ev.id);
      const r = (rows || []).find(x => x.area_key === 'finance') || {};
      await saveArea(ev.id, 'finance', { ownerName: r.owner_name || 'Ken Underwood', preData: { ...(r.pre_data || {}), budgetAmount: val }, postData: r.post_data || {}, authUserId: session && session.user && session.user.id });
    } catch (e) { /* kept on screen; the next change tries again */ }
  }

  useEffect(() => {
    setLoading(true);
    fetchAreaData(ev.id).then(rows => { const b = (((rows || []).find(r => r.area_key === 'finance') || {}).pre_data || {}).budgetAmount; setBudgetAmount(b == null ? '' : String(b)); }).catch(() => {});
    Promise.all([
      fetchEventFinancials(ev.name).catch(() => null),
      fetchEventTicketStats(ev.name).catch(() => ({ ticketsSold: 0, revenue: 0 })),
      fetchEventCardMeta(ev.name).catch(() => null),
    ]).then(([res, t, meta]) => { setData(res); setTickets(t); setRsvpOnly(!!(meta && meta.rsvp_only)); setLoading(false); });
  }, [ev.name]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Loading…</div>;

  const earnings = data?.earnings || [];
  const expenses = data?.expenses || [];
  // Website ticket sales are their own income source (separate from earnings logged by hand), so they are added in here.
  const ticketRevenue = rsvpOnly ? 0 : tickets.revenue;
  const totalEarnings = ticketRevenue + earnings.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
        Pulled live: website ticket sales for this event, plus the entries logged in the Portal's budget tracking (Op Budget / Op Earnings). Read-only here; the names must match exactly.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Budget:</span>
        <span style={{ fontSize: 15, color: 'var(--muted)' }}>$</span>
        <input className="input" type="number" min="0" step="any" defaultValue={budgetAmount} key={'bud' + budgetAmount} placeholder="Undecided" style={{ width: 150, fontSize: 14 }}
          onBlur={e => { const v = e.target.value.trim(); if (v !== budgetAmount) saveBudgetAmount(v); }} />
        {!hasBudget(budgetAmount) && <span style={{ fontSize: 12, color: '#b8863b', fontStyle: 'italic' }}>Undecided until you fill it in</span>}
        {hasBudget(budgetAmount) && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{money(Number(budgetAmount) - totalExpenses)} left after expenses</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 36px', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: '#4a5d3a' }}>{money(totalEarnings)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Earnings</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: '#8a4a2e' }}>{money(totalExpenses)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Expenses</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: totalEarnings - totalExpenses >= 0 ? '#4a5d3a' : '#8a4a2e' }}>{money(totalEarnings - totalExpenses)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Net</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={SECTION_HEAD}>Earnings</div>
        <ItemRow>
          <span style={{ flex: 1, fontSize: 13 }}>Website ticket sales{!rsvpOnly && tickets.ticketsSold > 0 ? ' (' + tickets.ticketsSold + ' sold)' : ''}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: rsvpOnly ? 'var(--muted)' : '#4a5d3a' }}>{rsvpOnly ? 'N/A (RSVP event)' : money(tickets.revenue)}</span>
        </ItemRow>
        {earnings.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>No other earnings logged for this event yet.</div>
        ) : earnings.map(r => (
          <ItemRow key={r.id}>
            <span style={{ flex: 1, fontSize: 13 }}>{r.earning_source || 'Earning'}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.date ? fmtDateShort(r.date) : ''}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4a5d3a' }}>{money(r.amount)}</span>
          </ItemRow>
        ))}
      </div>

      <div>
        <div style={SECTION_HEAD}>Expenses</div>
        {expenses.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No expenses logged for this event yet.</div>
        ) : expenses.map(r => (
          <ItemRow key={r.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{r.description || r.type || 'Expense'}</div>
              {r.purchased_by && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Purchased by {r.purchased_by}</div>}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.date ? fmtDateShort(r.date) : ''}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8a4a2e' }}>{money(r.amount)}</span>
          </ItemRow>
        ))}
      </div>

    </div>
  );
}

function emptyFeedback(eventName, todayStr) {
  return { event_name: eventName, source: '', name: '', role: '', feedback: '', date: todayStr };
}

function ReviewsTab({ ev }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [reviews, setReviews] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyFeedback(ev.name, todayStr));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [expanded, setExpanded] = useState({});

  function load() {
    fetchEventFeedback(ev.name).then(setReviews).catch(() => setReviews([]));
  }
  useEffect(() => { load(); }, [ev.name]);

  async function addReview(e) {
    e.preventDefault();
    if (!form.feedback.trim()) return;
    setSaving(true);
    const res = await insertEventFeedback({ ...form, event_name: ev.name, source: form.source || null, name: form.name || null, role: form.role || null, date: form.date || null });
    setSaving(false);
    if (res.error) { alert(`Failed to save: ${res.error}`); return; }
    if (res.row) setReviews(prev => [res.row, ...(prev || [])]);
    setForm(emptyFeedback(ev.name, todayStr));
    setShowAdd(false);
  }

  function startEdit(f) {
    setEditingId(f.id);
    setEditForm({ source: f.source || '', name: f.name || '', role: f.role || '', feedback: f.feedback || '', date: f.date || todayStr });
  }
  async function saveEdit() {
    if (!editForm) return;
    setSavingEdit(true);
    const patch = { source: editForm.source || null, name: editForm.name || null, role: editForm.role || null, feedback: editForm.feedback, date: editForm.date || null };
    const res = await updateEventFeedback(editingId, patch);
    setSavingEdit(false);
    if (res.error) { alert(`Failed to save: ${res.error}`); return; }
    setReviews(prev => prev.map(f => f.id === editingId ? { ...f, ...patch } : f));
    setEditingId(null);
    setEditForm(null);
  }
  async function removeReview(id) {
    if (!confirm('Delete this review?')) return;
    setReviews(prev => prev.filter(f => f.id !== id));
    await deleteEventFeedback(id);
  }

  if (reviews === null) return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Shared with Portal's Events page — reviews added here show up there too, and vice versa.
        </div>
        <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }} onClick={() => { setShowAdd(s => !s); setForm(emptyFeedback(ev.name, todayStr)); }}>
          {showAdd ? 'Cancel' : '+ Add Review'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addReview} style={{ padding: 14, marginBottom: 16, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div className="label">Source</div>
              <input className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Google review, comment card…" />
            </div>
            <div>
              <div className="label">Name</div>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Who left this feedback (optional)" />
            </div>
            <div>
              <div className="label">Role</div>
              <input className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Guest, Vendor, Volunteer…" />
            </div>
            <div>
              <div className="label">Date</div>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="label">Feedback</div>
            <textarea className="input" rows={3} style={{ resize: 'vertical' }} required value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} placeholder="What did they say…" />
          </div>
          <button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Add Review'}</button>
        </form>
      )}

      {reviews.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No reviews recorded for this event yet.</div>
      ) : (
        <div>
          {reviews.map(f => {
            if (editingId === f.id && editForm) {
              return (
                <div key={f.id} style={{ padding: '14px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input className="input" value={editForm.source} onChange={e => setEditForm(ff => ({ ...ff, source: e.target.value }))} placeholder="Source" />
                    <input className="input" value={editForm.name} onChange={e => setEditForm(ff => ({ ...ff, name: e.target.value }))} placeholder="Name" />
                    <input className="input" value={editForm.role} onChange={e => setEditForm(ff => ({ ...ff, role: e.target.value }))} placeholder="Role" />
                    <input className="input" type="date" value={editForm.date} onChange={e => setEditForm(ff => ({ ...ff, date: e.target.value }))} />
                  </div>
                  <textarea className="input" rows={3} style={{ resize: 'vertical', marginBottom: 8 }} value={editForm.feedback} onChange={e => setEditForm(ff => ({ ...ff, feedback: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-gold" style={{ fontSize: 12, padding: '6px 14px' }} disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving…' : 'Save'}</button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} disabled={savingEdit} onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</button>
                  </div>
                </div>
              );
            }
            const isOpen = !!expanded[f.id];
            return (
              <div key={f.id} style={{ borderBottom: '0.5px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
                  <button onClick={() => setExpanded(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name || 'Anonymous'}{f.role ? ` — ${f.role}` : ''}</div>
                      {f.source && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{f.source}</div>}
                    </div>
                    {f.date && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{fmtDateShort(f.date)}</span>}
                    <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  <button onClick={() => startEdit(f)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>✎</button>
                  <button onClick={() => removeReview(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, flexShrink: 0 }}>×</button>
                </div>
                {isOpen && <div style={{ padding: '0 0 14px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.feedback}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Detail page ───────────────────────────────────────────────────────────

function EventDetail({ ev, onUpdate, onBack, onEdit, onDelete, volunteers, session, volunteer }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => { fetchHiddenCommitteeEvents().then(rows => setHidden(rows.some(r => r.id === ev.id))).catch(() => {}); }, [ev.id]);
  async function toggleHidden(v) {
    setHidden(v);
    const res = await updateCommitteeEvent(ev.id, { hidden: v });
    if (res.error) { setHidden(!v); alert('Could not save. Please try again.'); }
  }
  return (
    <div style={{ padding: '14px 14px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>← All Events</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={hidden} onChange={e => toggleHidden(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
          Hide this event from the event cards
        </label>
      </div>

      <div className="card" style={{ padding: '20px 22px 24px' }}>
        <OverviewTab ev={ev} onUpdate={onUpdate} onEdit={onEdit} onDelete={onDelete} volunteers={volunteers} session={session} volunteer={volunteer} />
      </div>
    </div>
  );
}

// ── Create/edit modal ────────────────────────────────────────────────────────

function EventModal({ editing, onSave, onCancel }) {
  const isNew = !editing.id;
  const [form, setForm] = useState({
    name: editing.name || '',
    date: editing.date || nextDate(0),
    startTime: editing.startTime || '',
    endTime: editing.endTime || '',
    location: editing.location || '',
    description: editing.description || '',
    status: editing.status || 'upcoming',
  });

  function save() {
    if (!form.name.trim()) { alert('Give the event a name first.'); return; }
    onSave({ ...form, name: form.name.trim(), location: form.location.trim(), description: form.description.trim() });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(35,38,43,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", marginBottom: 16 }}>{isNew ? 'New Event' : 'Edit Event'}</div>

        <div style={{ marginBottom: 12 }}>
          <div className="label">Event Name</div>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Autumn Fundraiser Gala" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div className="label">Date</div>
          <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="label">From</div>
            <TimeSelect value={form.startTime} onChange={v => setForm(f => ({ ...f, startTime: v }))} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="label">To</div>
            <TimeSelect value={form.endTime} onChange={v => setForm(f => ({ ...f, endTime: v }))} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div className="label">Location</div>
          <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Where is this happening?" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div className="label">Description</div>
          <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="A short summary…" />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div className="label">Status</div>
          <select className="input" style={{ appearance: 'auto' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="planning">Planning</option>
            <option value="upcoming">Upcoming</option>
            <option value="needs_review">Needs Final Review</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 14, borderTop: '0.5px solid var(--border-light)' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-gold" onClick={save}>{isNew ? 'Create Event' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function EventsCommittee() {
  const { session, volunteer, currentCommitteeEvent, setCurrentCommitteeEvent } = useVol();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [volunteers, setVolunteers] = useState([]);

  useEffect(() => { fetchAllActiveVolunteers().then(rows => setVolunteers(Array.isArray(rows) ? rows : [])).catch(() => setVolunteers([])); }, []);

  // Load saved events, then pull in any event names already used in
  // Op Budget / Op Earnings (same source the Reimbursements form's Event
  // dropdown suggests from) that aren't tracked here yet, and persist them
  // so the committee sees everything already on the books. Those come in
  // undated — add a date via Edit once known.
  function load() {
    setLoading(true);
    fetchCommitteeEvents().then(async rawRows => {
      const rows = await migrateLegacyChecklist(rawRows);
      const mapped = rows.map(fromDb);
      const names = await fetchEventNames().catch(() => []);
      const existing = new Set(mapped.map(e => e.name.trim().toLowerCase()));
      const missing = names.filter(n => !existing.has(n.trim().toLowerCase()));
      if (missing.length) {
        const results = await Promise.all(missing.map(n =>
          insertCommitteeEventIfMissing({ ...toDb(emptyEvent(n)), created_by: session.user.id })
        ));
        // A no-op result means another concurrent load already inserted this
        // name first — nothing to add locally, it'll show up on next load.
        results.forEach(res => { if (res.row) mapped.push(fromDb(res.row)); });
      }

      // Deep-link from the dashboard (its Upcoming Events card/openCommitteeEvent)
      // -- open straight into this one event instead of landing on the list.
      // If it isn't tracked here yet (e.g. it only exists via ticket_orders,
      // not Op Budget/Earnings, so the sync above never picked it up),
      // create it on the fly so the link always resolves to something.
      if (currentCommitteeEvent) {
        const key = currentCommitteeEvent.trim().toLowerCase();
        let match = mapped.find(e => e.name.trim().toLowerCase() === key);
        if (!match) {
          const res = await insertCommitteeEventIfMissing({ ...toDb(emptyEvent(currentCommitteeEvent)), created_by: session.user.id });
          if (res.row) { match = fromDb(res.row); mapped.push(match); }
        }
        if (match) setSelectedId(match.id);
        setCurrentCommitteeEvent(null);
      }

      setEvents(mapped);
      setLoading(false);
      // Event Overviews lists what the committee lists.
      syncOverviewCardsFromCommittee([...rows, ...mapped.filter(m => !rows.some(r => r.id === m.id)).map(m => ({ name: m.name, date: m.date }))]).catch(() => {});
    }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Clicking a flyer card in EventCardsGrid -- find the matching committee
  // event by name and select it, creating one on the fly if this event
  // (e.g. a brand-new ticket_orders-only show) isn't tracked here yet.
  function openEventByName(name) {
    const key = name.trim().toLowerCase();
    const match = events.find(e => e.name.trim().toLowerCase() === key);
    if (match) { setSelectedId(match.id); return; }
    insertCommitteeEventIfMissing({ ...toDb(emptyEvent(name)), created_by: session.user.id }).then(res => {
      if (res.row) {
        const created = fromDb(res.row);
        setEvents(prev => [...prev, created]);
        setSelectedId(created.id);
      }
    });
  }

  const selected = events.find(e => e.id === selectedId) || null;

  function updateSelected(updater) {
    setEvents(prev => prev.map(e => {
      if (e.id !== selectedId) return e;
      const next = updater(e);
      updateCommitteeEvent(e.id, toDb(next));
      if (next.status !== e.status) {
        const fullName = `${volunteer?.['First Name'] || ''} ${volunteer?.['Last Name'] || ''}`.trim();
        logActivity({
          vol: volunteer,
          authUserId: session.user.id,
          action: 'committee_event_status_changed',
          description: `${fullName || 'A volunteer'} marked "${e.name}" as ${(STATUS_STYLE[next.status] || {}).label || next.status}`,
        });
      }
      return next;
    }));
  }

  function deleteEvent(ev) {
    if (!confirm(`Delete "${ev.name}"? This can't be undone.`)) return false;
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    deleteCommitteeEvent(ev.id, ev.name).then(r => { if (!r.success) { alert('Could not delete this event. Please try again.'); load(); } });
    const fullName = `${volunteer?.['First Name'] || ''} ${volunteer?.['Last Name'] || ''}`.trim();
    logActivity({
      vol: volunteer,
      authUserId: session.user.id,
      action: 'committee_event_deleted',
      description: `${fullName || 'A volunteer'} deleted the event "${ev.name}"`,
    });
    return true;
  }

  function openNewModal() {
    setEditingEvent({ status: 'upcoming' });
    setShowModal(true);
  }
  function openEditModal() {
    setEditingEvent({ ...selected });
    setShowModal(true);
  }
  async function saveModal(data) {
    if (editingEvent.id) {
      const merged = { ...selected, ...data };
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? merged : e));
      updateCommitteeEvent(editingEvent.id, toDb(merged));

      // Keep the Leadership Dashboard's In-House Events entry in sync on rename/reschedule.
      const nameOrDateChanged = merged.name !== selected.name || merged.date !== selected.date;
      if (nameOrDateChanged) {
        const fullName = `${volunteer?.['First Name'] || ''} ${volunteer?.['Last Name'] || ''}`.trim();
        const change = merged.name !== selected.name && merged.date !== selected.date
          ? `renamed "${selected.name}" to "${merged.name}" and rescheduled it`
          : merged.name !== selected.name
            ? `renamed "${selected.name}" to "${merged.name}"`
            : `rescheduled "${merged.name}"`;
        logActivity({
          vol: volunteer,
          authUserId: session.user.id,
          action: 'committee_event_updated',
          description: `${fullName || 'A volunteer'} ${change}`,
        });
      }
      if (nameOrDateChanged && merged.date) {
        if (merged.in_house_event_id) {
          syncInHouseEvent({ name: merged.name, date: merged.date, ihEventId: merged.in_house_event_id });
        } else {
          syncInHouseEvent({ name: merged.name, date: merged.date }).then(ihEvent => {
            if (ihEvent?.id) {
              updateCommitteeEvent(editingEvent.id, { in_house_event_id: ihEvent.id });
              setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, in_house_event_id: ihEvent.id } : e));
            }
          });
        }
      }
    } else {
      const newEvent = { ...emptyEvent(data.name), ...data };
      const res = await insertCommitteeEvent({ ...toDb(newEvent), created_by: session.user.id });
      if (res.error) {
        alert(res.error.includes('duplicate') || res.error.includes('unique')
          ? `An event named "${data.name}" already exists.`
          : `Failed to save: ${res.error}`);
        return;
      }
      if (res.row) {
        syncOverviewCardsFromCommittee([res.row]).catch(() => {});
        setEvents(prev => [...prev, fromDb(res.row)]);
        logActivity({
          vol: volunteer,
          authUserId: session.user.id,
          action: 'committee_event_added',
          description: `New event added to the Events Committee planning notes: ${res.row.name}`,
        });
        if (res.row.date) {
          syncInHouseEvent({ name: res.row.name, date: res.row.date }).then(ihEvent => {
            if (ihEvent?.id) {
              updateCommitteeEvent(res.row.id, { in_house_event_id: ihEvent.id });
              setEvents(prev => prev.map(e => e.id === res.row.id ? { ...e, in_house_event_id: ihEvent.id } : e));
            }
          });
        }
      }
    }
    setShowModal(false);
    setEditingEvent(null);
  }

  return (
    <div className="ec-page">
      <div style={{ padding: '22px 18px 14px', borderBottom: '0.5px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#fff' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500, marginBottom: 2 }}>Events Team</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif", color: 'var(--gold)' }}>Events Committee Planning Notes</div>
        </div>
        {!selected && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ReportsMenu />
            <button className="btn-gold" onClick={openNewModal}>+ New Event</button>
          </div>
        )}
      </div>

      <div style={{ padding: selected ? 0 : '14px 14px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : selected ? (
          <EventDetail ev={selected} onUpdate={updateSelected} onBack={() => setSelectedId(null)} onEdit={openEditModal} onDelete={() => { if (deleteEvent(selected)) setSelectedId(null); }} volunteers={volunteers} session={session} volunteer={volunteer} />
        ) : (
          <>
            <EventPlan session={session} volunteer={volunteer} onFinalized={() => load()} />
            <EventCardsGrid onOpen={openEventByName} />
          </>
        )}
      </div>

      {showModal && <EventModal editing={editingEvent} onSave={saveModal} onCancel={() => { setShowModal(false); setEditingEvent(null); }} />}
    </div>
  );
}
