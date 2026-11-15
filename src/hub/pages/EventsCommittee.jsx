// GENERATED from volunteerhub/src/pages/EventsCommittee.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
import { useState, useEffect, useRef } from 'react';
import { MediaPicker } from '../../media-library.jsx';
import { useVol } from '../App.jsx';
import {
  insertReimbursement, fetchEventCardMeta, saveEventCardMeta, pushCommitteeEventToWebsite, SITE_SUPABASE_URL, SITE_SUPABASE_KEY, fetchEventNames, fetchEventFinancials, fetchEventTicketStats, fetchEventCardImage, uploadEventFlyer, fetchAllEventCards, fetchCommitteeEvents, insertCommitteeEvent, insertCommitteeEventIfMissing, updateCommitteeEvent, deleteCommitteeEvent,
  fetchAllActiveVolunteers, syncInHouseEvent, logActivity, fetchEventMarketingNA, setEventMarketingNA, fetchHiddenCommitteeEvents, syncOverviewCardsFromCommittee,
  fetchEventFeedback, insertEventFeedback, updateEventFeedback, deleteEventFeedback,
} from '../lib/db.js';
import AreasTab, { PLANNING_PROMPTS, NSH_SPACES } from './eventsCommitteeAreas.jsx';
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

const PLANNING_SECTIONS = [
  { key: 'preplanning', title: 'Event Basics', desc: 'Event details, website page, tickets' },
  { key: 'checklist', title: 'Checklist', desc: 'Type the duties in fast, then assign and date them' },
  { key: 'volunteers', title: 'Volunteers, Staffing & Vendors', desc: 'What we need, who we found, contacts and volunteer roles', area: 'volunteers' },
  { key: 'marketing', title: 'Marketing & Promotion', desc: 'Flyers, newsletters, website, social media', area: 'marketing' },
  { key: 'budget', title: 'Budget & Transactions', desc: 'Income, expenses, reimbursements' },
  { key: 'dayof', title: 'Day-Of Timeline', desc: 'Run of show for the day' },
  { key: 'after', title: 'After the Event', desc: 'What went well, final numbers, follow-ups, reviews and feedback' },
];

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

  const doneT = ev.checklist.filter(t => t.done).length;
  const total = ev.checklist.length;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <select className="input" style={{ appearance: 'auto', fontSize: 12 }} value={ev.status}
                onChange={e => onUpdate(x => ({ ...x, status: e.target.value }))}>
                <option value="planning">Planning</option>
                <option value="upcoming">Upcoming</option>
                <option value="needs_review">Needs Final Review</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onEdit}>Edit</button>
              {onDelete && <button className="btn-ghost" style={{ fontSize: 12, color: '#a04545' }} onClick={onDelete}>Delete</button>}
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
          {ev.checklist.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No checklist items yet -- add some in Checklist.</div>
          ) : ev.checklist.slice(0, 6).map(t => (
            <div key={t.id} onClick={() => toggleChecklistItem(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.done ? 'var(--text)' : 'transparent', border: t.done ? 'none' : '1.5px solid var(--border)',
              }}>
                {t.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              <span style={{ fontSize: 13, color: t.done ? 'var(--muted)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Event details</div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {ev.eventLead && <div><strong>Event lead:</strong> {ev.eventLead}</div>}
            {ev.location && <div><strong>Location:</strong> {ev.location}</div>}
            {ev.pricing && <div><strong>Pricing:</strong> {ev.pricing}</div>}
            {(ev.expectedAttendance || ev.guestCount.invited) && <div><strong>Expected guests:</strong> {ev.expectedAttendance || ev.guestCount.invited}</div>}
            {ev.volunteersNeeded !== '' && ev.volunteersNeeded != null && <div><strong>Volunteers needed:</strong> {ev.volunteersNeeded}</div>}
            {!ev.eventLead && !ev.location && !ev.pricing && !ev.guestCount.invited && !ev.expectedAttendance && (ev.volunteersNeeded === '' || ev.volunteersNeeded == null) && (
              <div style={{ color: 'var(--muted)' }}>Nothing set yet -- fill these in under Event Basics.</div>
            )}
          </div>
          {upcomingDeadlines.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6, paddingTop: 12, borderTop: '0.5px solid var(--border-light)' }}>Upcoming deadlines</div>
              {upcomingDeadlines.map(t => (
                <div key={t.id} style={{ fontSize: 13, marginBottom: 4 }}>{fmtDateShort(t.due)} &middot; {t.text}</div>
              ))}
            </>
          )}
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
                {s.key === 'marketing' && (
                  <button className="btn-ghost" onClick={e => { e.stopPropagation(); toggleMarketingNA(!marketingNA); }}
                    style={{ padding: '3px 12px', fontSize: 11, flexShrink: 0, color: marketingNA ? 'var(--gold)' : '#a04545' }}>
                    {marketingNA ? 'Turn on' : 'Turn off'}
                  </button>
                )}
                <span style={{ color: 'var(--muted)', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&rsaquo;</span>
              </div>
              {isOpen && (
                <div style={{ padding: '4px 16px 18px' }}>
                  {s.key === 'preplanning' && <PreplanningTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} onRsvpChange={setRsvpOnly} />}
                  {s.key === 'checklist' && <ChecklistTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} />}
                  {s.key === 'budget' && <FinancialsTab ev={ev} />}
                  {s.key === 'dayof' && <SheetToggle view={<DayOfView ev={ev} />}><DayOfTab ev={ev} onUpdate={onUpdate} /></SheetToggle>}
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
                    <AreasTab event={ev} session={session} volunteer={volunteer} initialArea={s.area} />
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

function ItemRow({ children, onDelete, done, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0 9px 10px',
      borderBottom: '0.5px solid var(--border-light)', borderLeft: `3px solid ${accent || 'transparent'}`,
      opacity: done ? 0.6 : 1,
    }}>
      {children}
      {onDelete && <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>}
    </div>
  );
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
const NEED_KINDS = { vendor: 'Vendor', contact: 'Contact', volunteer: 'Volunteer', activity: 'Activity' };
const volFullName = (v) => `${v['First Name'] || ''} ${v['Last Name'] || ''}`.trim() || 'Unnamed';

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
  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13 };
  const cap = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 };

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
      {items.map(v => {
        const kind = v.kind || '';
        const isOpen = openId === v.id;
        const assigned = (v.assignedIds || []).map(id => (volunteers || []).find(x => x.id === id)).filter(Boolean);
        const target = Number(v.target) || 0;
        const who = v.who || (v.role ? v.name : '');
        const title = v.who || !v.role ? v.name : v.role + ': ' + v.name;
        const found = !!v.confirmed || !!who || assigned.length > 0;
        let sub;
        if (kind === 'volunteer' || kind === 'activity') sub = assigned.length + (target ? ' of ' + target : '') + ' assigned' + (assigned.length ? ': ' + assigned.map(volFullName).join(', ') : '');
        else if (who || v.contact) sub = [v.who ? v.who : (v.role ? v.name : ''), v.contact].filter(Boolean).join('  ·  ');
        else sub = '';
        return (
          <div key={v.id} style={{ borderBottom: '0.5px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
              <button type="button" onClick={() => patch(v.id, { confirmed: !v.confirmed })} title={v.confirmed ? 'Confirmed. Click to undo.' : 'Click to mark as confirmed'}
                style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, padding: 0, cursor: 'pointer', border: v.confirmed ? 'none' : '1.5px solid var(--border)', background: v.confirmed ? 'var(--gold)' : 'transparent', color: '#fff', fontSize: 11, lineHeight: '18px' }}>{v.confirmed ? '✓' : ''}</button>
              <button type="button" onClick={() => setOpenId(isOpen ? null : v.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: found || sub ? 'var(--muted)' : '#b8863b', fontStyle: found || sub ? 'normal' : 'italic' }}>{sub || 'Still needed'}</div>
              </button>
              {kind && <span className="badge" style={{ background: 'var(--light)', color: 'var(--text)', flexShrink: 0 }}>{NEED_KINDS[kind]}</span>}
              <span style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>&rsaquo;</span>
            </div>
            {isOpen && (
              <div key={v.id + '-edit'} style={{ padding: '4px 0 18px 30px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: '1 1 170px' }}>
                    <div style={cap}>What is it?</div>
                    <select className="input" value={kind} onChange={e => patch(v.id, { kind: e.target.value })} style={{ ...inp, appearance: 'auto' }}>
                      <option value="">Choose a type…</option>
                      <option value="vendor">Vendor</option>
                      <option value="contact">Contact</option>
                      <option value="volunteer">Volunteer role</option>
                      <option value="activity">Activity or program</option>
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
                        <select className="input" value="" onChange={e => { if (e.target.value) patch(v.id, { assignedIds: [...(v.assignedIds || []), e.target.value] }); }} style={{ ...inp, appearance: 'auto' }}>
                          <option value="">Choose a volunteer…</option>
                          {(volunteers || []).filter(x => !(v.assignedIds || []).includes(x.id)).map(x => <option key={x.id} value={x.id}>{volFullName(x)}</option>)}
                        </select>
                      </div>
                    </div>
                    {assigned.map(x => (
                      <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
                        <span>{volFullName(x)}</span>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => patch(v.id, { assignedIds: (v.assignedIds || []).filter(id => id !== x.id) })}>Remove</button>
                      </div>
                    ))}
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
      })}
    </div>
  );
}

function DayOfView({ ev }) {
  const sorted = [...ev.timeline].sort((a, b) => a.time.localeCompare(b.time));
  if (!sorted.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No timeline items yet. Click Edit to add some.</div>;
  return (
    <div>
      <div style={SECTION_HEAD}>Run of Show</div>
      {sorted.map(t => (
        <div key={t.id} style={{ display: 'flex', gap: 14, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)', fontSize: 13 }}>
          <span style={{ width: 70, flexShrink: 0, color: 'var(--muted)' }}>{fmtTime12(t.time)}</span>
          <span style={{ flex: 1 }}>{t.activity}</span>
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
            <input type="checkbox" checked={!!t.done} onChange={() => toggle(t.id)} style={{ accentColor: 'var(--gold)', width: 15, height: 15, marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--muted)' : 'var(--text)' }}>
                {p && <span title={p.label} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, marginRight: 7 }} />}{t.text}
              </div>
              {meta && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{meta}</div>}
              {t.notes && t.notes.trim() && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 3 }}>{t.notes}</div>}
              {subs.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {subs.map(s => <div key={s.id} style={{ fontSize: 12, color: s.done ? 'var(--muted)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.done ? '✓' : '○'} {s.text}</div>)}
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
          <input type="checkbox" checked={v.confirmed} onChange={() => toggleVendor(v.id)} title="Confirmed" style={{ accentColor: 'var(--gold)', width: 15, height: 15 }} />
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
function WebsiteEventPanel({ ev, onUpdate, onRsvpChange }) {
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
  const [editing, setEditing] = useState(false);
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
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} disabled={pushing} onClick={() => { setF(initial()); setRsvp(rsvpSaved); setMsg(null); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      )}
      {picker && <MediaPicker supabaseUrl={SITE_SUPABASE_URL} supabaseKey={SITE_SUPABASE_KEY} onPick={img => { setF(o => ({ ...o, imageUrl: img.url, imageAlt: o.imageAlt || img.alt || '' })); setPicker(false); }} onClose={() => setPicker(false)} />}
    </div>
  );
}

// The event's task checklist: add items with a priority, due date and assignee; click one to edit it, add subtasks,
// or attach estimated/actual $ and notes.
function ChecklistTab({ ev, onUpdate, volunteers }) {
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
        const who = ((volunteer && volunteer['First Name']) || '') + ' ' + ((volunteer && volunteer['Last Name']) || '');
        const base = { event_name: ev.name, area: 'Events', type: 'Purchase', status: 'Submitted', date: new Date().toISOString().slice(0, 10), purchased_by: who.trim() || null, volunteer_name: who.trim() || null, volunteer_id: (volunteer && volunteer.id) || null, volunteer_auth_user_id: (session && session.user && session.user.id) || null };
        const r1 = await insertReimbursement({ ...base, description: 'ABC alcohol license fee (money order)', amount: 50 });
        const r2 = await insertReimbursement({ ...base, description: 'Sheriff signature for alcohol license', amount: 30 });
        if (r1.error || r2.error) throw new Error(r1.error || r2.error);
      }
      const duty = (text, estimated) => ({ id: cryptoId(), text, done: false, due: '', timing: 'before', assignee: '', assigneeId: null, priority: '', estimated, actual: 0, notes: '', subtasks: [], auto: 'alcohol-license' });
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
  function startPrompt(text) { setQuick(text + ': '); setTimeout(() => { if (quickRef.current) { quickRef.current.focus(); const n = quickRef.current.value.length; quickRef.current.setSelectionRange(n, n); } }, 0); }

  // Note taker: type a thought and press Enter, then the next. Pasting several lines adds one note per line.
  // Later each note is attached to where it belongs (a duty, the day-of timeline, a vendor, the after notes).
  const [attachedMsg, setAttachedMsg] = useState('');
  function addQuick(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    onUpdate(e => ({ ...e, notes: [...(e.notes || []), ...lines.map(l => ({ id: cryptoId(), text: l }))] }));
    setQuick('');
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
      onUpdate(e => ({ ...e, notes: drop(e), checklist: [...e.checklist, { id: cryptoId(), text: note.text, done: false, due: '', assignee: '', assigneeId: null, priority: '', estimated: 0, actual: 0, notes: '', subtasks: [] }] }));
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
    onUpdate(e => ({ ...e, notes: [], checklist: [...e.checklist, ...list.map(n => ({ id: cryptoId(), text: n.text, done: false, due: '', assignee: '', assigneeId: null, priority: '', estimated: 0, actual: 0, notes: '', subtasks: [] }))] }));
    setAttachedMsg('All notes added to the checklist below.');
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
          ...t, text: expandForm.text.trim(), due: expandForm.due, assignee: expandForm.assignee.trim(),
          assigneeId: expandForm.assigneeId, priority: expandForm.priority,
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
                  {g.items.map(it => { const label = typeof it === 'string' ? it : it.label; return <button key={label} type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => (typeof it === 'string' ? startPrompt(it) : (it.action === 'alcohol' ? addAlcoholLicense() : null))}>{label}</button>; })}
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
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '0.5px solid var(--border-light)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflowWrap: 'anywhere' }}>{n.text}</span>
                <select className="input" value="" onChange={e => attachNote(n, e.target.value)} style={{ width: 190, flexShrink: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto' }}>
                  <option value="">Attach to…</option>
                  <option value="task">Checklist duty</option>
                  <option value="dayof">Day-Of Timeline</option>
                  <option value="vendor">Volunteers & vendors list</option>
                  <option value="after">After Notes (follow-up)</option>
                </select>
                <button onClick={() => deleteNote(n.id)} title="Delete this note" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>
        )}
        {attachedMsg && <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 10 }}>{attachedMsg}</div>}
        {ev.checklist.map(t => {
          const hasMoney = t.estimated > 0 || t.actual > 0;
          const hasNotes = !!(t.notes && t.notes.trim());
          const subtasks = t.subtasks || [];
          const subDone = subtasks.filter(s => s.done).length;
          const isOpen = expandedId === t.id;
          return (
            <div key={t.id}>
              <ItemRow done={t.done} onDelete={() => deleteItem(t.id)} accent={t.priority ? TASK_PRIORITY[t.priority].color : null}>
                <PriorityDot priority={t.priority} onClick={() => cycleItemPriority(t.id)} />
                <input type="checkbox" checked={t.done} onChange={() => toggleItem(t.id)} style={{ accentColor: 'var(--gold)', width: 15, height: 15 }} />
                <button onClick={() => startExpand(t)} title="Edit item"
                  style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: 'var(--text)' }}>{t.text}</span>
                  {(hasMoney || hasNotes || subtasks.length > 0) && (
                    <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 8 }}>
                      {subtasks.length > 0 ? `${subDone}/${subtasks.length} subtasks` : ''}
                      {subtasks.length > 0 && (hasMoney || hasNotes) ? ' · ' : ''}
                      {hasMoney ? `Est. ${money(t.estimated)} · Act. ${money(t.actual)}` : ''}{hasMoney && hasNotes ? ' · ' : ''}{hasNotes ? 'notes' : ''}
                    </span>
                  )}
                </button>
                <input className="input" list={'vols-' + ev.id} placeholder="Who" defaultValue={t.assignee || ''} key={t.id + (t.assignee || '')} style={{ width: 130, flexShrink: 0, fontSize: 12, padding: '5px 8px' }}
                  onBlur={e => {
                    const name = e.target.value.trim();
                    if (name === (t.assignee || '')) return;
                    const match = (volunteers || []).find(v => (v['First Name'] + ' ' + v['Last Name']).trim().toLowerCase() === name.toLowerCase());
                    patchItem(t.id, { assignee: match ? (match['First Name'] + ' ' + match['Last Name']).trim() : name, assigneeId: match ? match.id : null });
                  }} />
                <select className="input" value={t.timing || (t.due ? 'before' : '')} style={{ width: 132, flexShrink: 0, fontSize: 12, padding: '5px 8px', appearance: 'auto' }}
                  onChange={e => { const v = e.target.value; patchItem(t.id, { timing: v, due: v === 'dayof' ? (ev.date || '') : (v === 'before' && t.timing === 'dayof' ? '' : (v === 'before' ? (t.due || '') : '')) }); }}>
                  <option value="">When?</option>
                  <option value="before">Before event</option>
                  <option value="dayof">Day of event</option>
                </select>
                {(t.timing || (t.due ? 'before' : '')) === 'before' && <input className="input" type="date" value={t.due || ''} onChange={e => patchItem(t.id, { due: e.target.value })} style={{ width: 128, flexShrink: 0, fontSize: 12, padding: '5px 8px' }} />}
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
                    <div>
                      <div className="label">Assignee</div>
                      <AssigneeMentionInput key={t.id} assignee={expandForm.assignee} assigneeId={expandForm.assigneeId} volunteers={volunteers}
                        onChange={(assignee, assigneeId) => setExpandForm(f => ({ ...f, assignee, assigneeId }))} />
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
                      <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(t.id, s.id)} style={{ accentColor: 'var(--gold)', width: 14, height: 14 }} />
                      <span style={{ flex: 1, fontSize: 12, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--muted)' : 'var(--text)' }}>{s.text}</span>
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
        <datalist id={'vols-' + ev.id}>{(volunteers || []).map(v => <option key={v.id} value={(v['First Name'] + ' ' + v['Last Name']).trim()} />)}</datalist>
      </div>

    </div>
  );
}

function PreplanningTab({ ev, onUpdate, onRsvpChange }) {
  return <WebsiteEventPanel key={ev.id} ev={ev} onUpdate={onUpdate} onRsvpChange={onRsvpChange} />;
}

function DayOfTab({ ev, onUpdate }) {
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
          <ItemRow key={t.id} onDelete={() => deleteItem(t.id)}>
            <span style={{ fontSize: 12, color: 'var(--muted)', width: 54, flexShrink: 0 }}>{t.time}</span>
            <button onClick={() => startEdit(t)} title="Edit"
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}>
              {t.activity}
            </button>
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

  useEffect(() => {
    setLoading(true);
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
