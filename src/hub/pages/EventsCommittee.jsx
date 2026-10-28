// GENERATED from volunteerhub/src/pages/EventsCommittee.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
import { useState, useEffect, useRef } from 'react';
import { useVol } from '../App.jsx';
import {
  fetchEventNames, fetchEventFinancials, fetchEventTicketStats, fetchEventCardImage, uploadEventFlyer, fetchAllEventCards, fetchCommitteeEvents, insertCommitteeEvent, insertCommitteeEventIfMissing, updateCommitteeEvent, deleteCommitteeEvent,
  fetchAllActiveVolunteers, syncInHouseEvent, logActivity, fetchEventMarketingNA, setEventMarketingNA, fetchHiddenCommitteeEvents, syncOverviewCardsFromCommittee,
  fetchEventFeedback, insertEventFeedback, updateEventFeedback, deleteEventFeedback,
} from '../lib/db.js';
import AreasTab from './eventsCommitteeAreas.jsx';
import EventOverviews from './EventOverviews.jsx';

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
    purpose: '', expectedAttendance: '', pricing: '', eventLead: '', volunteersNeeded: '',
    checklist: [], vendors: [], guestCount: { invited: 0, confirmed: 0 }, timeline: [],
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
    eventLead: row.event_lead || '',
    volunteersNeeded: row.volunteers_needed ?? '',
    guestCount: { invited: row.guest_invited || 0, confirmed: row.guest_confirmed || 0 },
    checklist: row.checklist || [],
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
    event_lead: ev.eventLead || null,
    volunteers_needed: ev.volunteersNeeded === '' || ev.volunteersNeeded == null ? null : Number(ev.volunteersNeeded),
    guest_invited: ev.guestCount.invited || 0,
    guest_confirmed: ev.guestCount.confirmed || 0,
    checklist: ev.checklist,
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
  preplanning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
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
  { key: 'preplanning', title: 'Event Basics & Checklist', desc: 'Purpose, attendance, event lead, detailed checklist' },
  { key: 'marketing', title: 'Marketing & Promotion', desc: 'Flyers, newsletters, website, social media', area: 'marketing' },
  { key: 'volunteers', title: 'Volunteers & Staffing', desc: 'Assignments, shifts, contact information', area: 'volunteers' },
  { key: 'areas-other', title: 'Other Planning Areas', desc: 'Logistics, hospitality, finance, sponsorship, interiors' },
  { key: 'vendors', title: 'Vendors & Supplies', desc: 'Catering, rentals, orders, deliveries' },
  { key: 'budget', title: 'Budget & Transactions', desc: 'Income, expenses, reimbursements' },
  { key: 'dayof', title: 'Day-Of Timeline', desc: 'Run of show for the day' },
  { key: 'reviews', title: 'Reviews & Feedback', desc: 'Guest and volunteer feedback' },
  { key: 'after', title: 'After Notes', desc: "What went well, final numbers, follow-ups" },
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

function OverviewTab({ ev, onUpdate, onEdit, volunteers, session, volunteer }) {
  const [marketingNA, setMarketingNA] = useState(false);
  useEffect(() => { fetchEventMarketingNA(ev.name).then(setMarketingNA).catch(() => {}); }, [ev.name]);
  function toggleMarketingNA(v) {
    setMarketingNA(v);
    setEventMarketingNA(ev.name, v).catch(() => { setMarketingNA(!v); alert('Could not save. Please try again.'); });
  }
  const [ticketStats, setTicketStats] = useState(null);
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
  const ticketSales = ticketStats ? ticketStats.revenue : 0;
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
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatBox label="Ticket Sales" value={money(ticketSales)} sub={ticketStats ? `${ticketStats.ticketsSold} sold` : null} />
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No checklist items yet -- add some in Pre-Planning.</div>
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
            {(ev.guestCount.invited || ev.expectedAttendance) && <div><strong>Expected guests:</strong> {ev.guestCount.invited || ev.expectedAttendance}</div>}
            {ev.volunteersNeeded !== '' && ev.volunteersNeeded != null && <div><strong>Volunteers needed:</strong> {ev.volunteersNeeded}</div>}
            {!ev.eventLead && !ev.location && !ev.guestCount.invited && !ev.expectedAttendance && (ev.volunteersNeeded === '' || ev.volunteersNeeded == null) && (
              <div style={{ color: 'var(--muted)' }}>Nothing set yet -- fill these in under Pre-Planning.</div>
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
                  {s.key === 'preplanning' && <PreplanningTab ev={ev} onUpdate={onUpdate} volunteers={volunteers} />}
                  {s.key === 'vendors' && <VendorsPanel ev={ev} onUpdate={onUpdate} />}
                  {s.key === 'budget' && <FinancialsTab ev={ev} />}
                  {s.key === 'dayof' && <DayOfTab ev={ev} onUpdate={onUpdate} />}
                  {s.key === 'reviews' && <ReviewsTab ev={ev} />}
                  {s.key === 'after' && <AfterTab ev={ev} onUpdate={onUpdate} />}
                  {s.key === 'marketing' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={marketingNA} onChange={e => toggleMarketingNA(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} />
                      Marketing is not applicable for this event
                    </label>
                  )}
                  {s.key === 'marketing' && marketingNA ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Marked not applicable. Untick the box above to plan marketing for this event.</div>
                  ) : (s.key === 'marketing' || s.key === 'volunteers') && (
                    <AreasTab event={ev} session={session} volunteer={volunteer} initialArea={s.area} />
                  )}
                  {s.key === 'areas-other' && <AreasTab event={ev} session={session} volunteer={volunteer} />}
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

// Extracted so Overview's "Vendors & Supplies" planning-section dropdown
// can embed the exact same vendor list/add-form Pre-Planning uses, instead
// of duplicating it.
function VendorsPanel({ ev, onUpdate }) {
  const [vendorForm, setVendorForm] = useState({ name: '', role: '', contact: '' });

  function toggleVendor(id) {
    onUpdate(e => ({ ...e, vendors: e.vendors.map(v => v.id === id ? { ...v, confirmed: !v.confirmed } : v) }));
  }
  function deleteVendor(id) {
    onUpdate(e => ({ ...e, vendors: e.vendors.filter(v => v.id !== id) }));
  }
  function addVendor() {
    if (!vendorForm.name.trim()) return;
    onUpdate(e => ({ ...e, vendors: [...e.vendors, { id: cryptoId(), name: vendorForm.name.trim(), role: vendorForm.role.trim(), contact: vendorForm.contact.trim(), confirmed: false }] }));
    setVendorForm({ name: '', role: '', contact: '' });
  }

  return (
    <div>
      {ev.vendors.map(v => (
        <ItemRow key={v.id} onDelete={() => deleteVendor(v.id)}>
          <input type="checkbox" checked={v.confirmed} onChange={() => toggleVendor(v.id)} title="Confirmed" style={{ accentColor: 'var(--gold)', width: 15, height: 15 }} />
          <span style={{ flex: 1, fontSize: 13 }}>{v.name} <span style={{ color: 'var(--muted)' }}>— {v.role}</span></span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v.contact}</span>
        </ItemRow>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 140 }} placeholder="Vendor name" value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} />
        <input className="input" style={{ width: 110 }} placeholder="Role" value={vendorForm.role} onChange={e => setVendorForm(f => ({ ...f, role: e.target.value }))} />
        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Contact info" value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} />
        <button className="btn-gold" style={{ padding: '9px 14px' }} onClick={addVendor}>Add</button>
      </div>
    </div>
  );
}

function PreplanningTab({ ev, onUpdate, volunteers }) {
  const [guests, setGuests] = useState(ev.guestCount);
  const [basics, setBasics] = useState({
    name: ev.name, date: ev.date, startTime: ev.startTime, endTime: ev.endTime,
    purpose: ev.purpose, eventLead: ev.eventLead, expectedAttendance: ev.expectedAttendance, description: ev.description,
  });
  const [basicsEditing, setBasicsEditing] = useState(false);
  const [guestsEditing, setGuestsEditing] = useState(false);

  function saveBasics() {
    if (!basics.name.trim() || !basics.date || !basics.eventLead.trim()) return;
    onUpdate(e => ({
      ...e, name: basics.name.trim(), date: basics.date, startTime: basics.startTime, endTime: basics.endTime,
      purpose: basics.purpose, eventLead: basics.eventLead.trim(), expectedAttendance: basics.expectedAttendance.trim(),
      description: basics.description.trim(),
    }));
    setBasicsEditing(false);
  }
  function cancelBasics() {
    setBasics({
      name: ev.name, date: ev.date, startTime: ev.startTime, endTime: ev.endTime,
      purpose: ev.purpose, eventLead: ev.eventLead, expectedAttendance: ev.expectedAttendance, description: ev.description,
    });
    setBasicsEditing(false);
  }

  function saveGuests() {
    onUpdate(e => ({ ...e, guestCount: { invited: Number(guests.invited) || 0, confirmed: Number(guests.confirmed) || 0 } }));
    setGuestsEditing(false);
  }
  function cancelGuests() {
    setGuests(ev.guestCount);
    setGuestsEditing(false);
  }

  const sectionTitle = SECTION_HEAD;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={sectionTitle}>Event Basics</div>
          {!basicsEditing && <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setBasicsEditing(true)}>Edit</button>}
        </div>
        {basicsEditing ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <div className="label">Event Name *</div>
              <input className="input" value={basics.name} onChange={e => setBasics(b => ({ ...b, name: e.target.value }))} placeholder="e.g. Holiday Open House" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 480 }}>
              <div style={{ flex: 1 }}>
                <div className="label">Event Type</div>
                <select className="input" style={{ appearance: 'auto' }} value={basics.purpose} onChange={e => setBasics(b => ({ ...b, purpose: e.target.value }))}>
                  <option value="">Select a type…</option>
                  {EVENT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Event Date *</div>
                <input className="input" type="date" value={basics.date} onChange={e => setBasics(b => ({ ...b, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 480 }}>
              <div style={{ flex: 1 }}>
                <div className="label">Start Time</div>
                <TimeSelect value={basics.startTime} onChange={v => setBasics(b => ({ ...b, startTime: v }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">End Time</div>
                <TimeSelect value={basics.endTime} onChange={v => setBasics(b => ({ ...b, endTime: v }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 480 }}>
              <div style={{ flex: 1 }}>
                <div className="label">Event Lead *</div>
                <input className="input" value={basics.eventLead} onChange={e => setBasics(b => ({ ...b, eventLead: e.target.value }))} placeholder="Responsible person" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Expected Attendance</div>
                <input className="input" value={basics.expectedAttendance} onChange={e => setBasics(b => ({ ...b, expectedAttendance: e.target.value }))} placeholder="e.g. 75" />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div className="label">Event Purpose (optional)</div>
              <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={basics.description} onChange={e => setBasics(b => ({ ...b, description: e.target.value }))} placeholder="Briefly describe the event's goal." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px' }} disabled={!basics.name.trim() || !basics.date || !basics.eventLead.trim()} onClick={saveBasics}>Save</button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} onClick={cancelBasics}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong>Event name:</strong> {ev.name}</div>
            {ev.purpose && <div><strong>Event type:</strong> {ev.purpose}</div>}
            <div><strong>Event date:</strong> {ev.date ? fmtDate(ev.date) : 'Not set'}</div>
            {(ev.startTime || ev.endTime) && <div><strong>Time:</strong> {ev.startTime ? fmtTime12(ev.startTime) : '?'} – {ev.endTime ? fmtTime12(ev.endTime) : '?'}</div>}
            {ev.eventLead && <div><strong>Event lead:</strong> {ev.eventLead}</div>}
            {ev.expectedAttendance && <div><strong>Expected attendance:</strong> {ev.expectedAttendance}</div>}
            {ev.description && <div><strong>Purpose:</strong> {ev.description}</div>}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={sectionTitle}>Vendors & contacts</div>
        <VendorsPanel ev={ev} onUpdate={onUpdate} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={sectionTitle}>Guest count</div>
          {!guestsEditing && <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setGuestsEditing(true)}>Edit</button>}
        </div>
        {guestsEditing ? (
          <>
            <div style={{ display: 'flex', gap: 10, maxWidth: 320, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="label">Invited</div>
                <input className="input" type="number" value={guests.invited} onChange={e => setGuests(g => ({ ...g, invited: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Confirmed</div>
                <input className="input" type="number" value={guests.confirmed} onChange={e => setGuests(g => ({ ...g, confirmed: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-gold" style={{ fontSize: 12, padding: '7px 14px' }} onClick={saveGuests}>Save</button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} onClick={cancelGuests}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13 }}>
            {(ev.guestCount.invited || ev.guestCount.confirmed) ? (
              <><strong>Invited:</strong> {ev.guestCount.invited || 0} &nbsp;·&nbsp; <strong>Confirmed:</strong> {ev.guestCount.confirmed || 0}</>
            ) : (
              <span style={{ color: 'var(--muted)' }}>Nothing set yet -- click Edit to fill these in.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
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

  useEffect(() => {
    setLoading(true);
    fetchEventFinancials(ev.name).then(res => { setData(res); setLoading(false); }).catch(() => setLoading(false));
  }, [ev.name]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Loading…</div>;

  const earnings = data?.earnings || [];
  const expenses = data?.expenses || [];
  const totalEarnings = earnings.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
        Pulled live from this event's entries in Portal's budget tracking (Op Budget / Op Earnings) — read-only here.
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
        {earnings.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No earnings logged for this event yet.</div>
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

function EventDetail({ ev, onUpdate, onBack, onEdit, volunteers, session, volunteer }) {
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
        <OverviewTab ev={ev} onUpdate={onUpdate} onEdit={onEdit} volunteers={volunteers} session={session} volunteer={volunteer} />
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
    if (!confirm(`Delete "${ev.name}"? This can't be undone.`)) return;
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    deleteCommitteeEvent(ev.id);
    const fullName = `${volunteer?.['First Name'] || ''} ${volunteer?.['Last Name'] || ''}`.trim();
    logActivity({
      vol: volunteer,
      authUserId: session.user.id,
      action: 'committee_event_deleted',
      description: `${fullName || 'A volunteer'} deleted the event "${ev.name}"`,
    });
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
          <EventDetail ev={selected} onUpdate={updateSelected} onBack={() => setSelectedId(null)} onEdit={openEditModal} volunteers={volunteers} session={session} volunteer={volunteer} />
        ) : (
          <EventCardsGrid onOpen={openEventByName} />
        )}
      </div>

      {showModal && <EventModal editing={editingEvent} onSave={saveModal} onCancel={() => { setShowModal(false); setEditingEvent(null); }} />}
    </div>
  );
}
