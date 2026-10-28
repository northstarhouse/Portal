// GENERATED from volunteerhub/src/lib/db.js by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
// Data helpers — raw fetch against Portal Supabase tables
// (existing tables use anon key + permissive policies, same as Portal)

import { supabase } from '../supabase.js';

const URL  = "https://uvzwhhwzelaelfhfkvdb.supabase.co";
const KEY  = "sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do";
const VOL  = encodeURIComponent('2026 Volunteers');

async function hdr(extra = {}) {
  const { data } = await supabase.auth.getSession();
  return {
    apikey: KEY,
    Authorization: `Bearer ${data.session?.access_token || KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: await hdr() });
  return r.json();
}

async function patch(path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: await hdr(),
    body: JSON.stringify(body),
  });
  return r.json();
}

async function post(path, body, extraHeaders) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: await hdr(extraHeaders),
    body: JSON.stringify(body),
  });
  return r.json();
}

async function del(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: await hdr(),
  });
  return r.ok;
}

// ── Zodiac ───────────────────────────────────────────────────────────────────

// Trailing ︎ forces text (monochrome) presentation instead of colored
// emoji glyphs, so the CSS text color actually applies.
const ZODIAC_SIGNS = [
  { name: 'Capricorn',  symbol: '♑︎', from: [12, 22], to: [1, 19] },
  { name: 'Aquarius',   symbol: '♒︎', from: [1, 20],  to: [2, 18] },
  { name: 'Pisces',     symbol: '♓︎', from: [2, 19],  to: [3, 20] },
  { name: 'Aries',      symbol: '♈︎', from: [3, 21],  to: [4, 19] },
  { name: 'Taurus',     symbol: '♉︎', from: [4, 20],  to: [5, 20] },
  { name: 'Gemini',     symbol: '♊︎', from: [5, 21],  to: [6, 20] },
  { name: 'Cancer',     symbol: '♋︎', from: [6, 21],  to: [7, 22] },
  { name: 'Leo',        symbol: '♌︎', from: [7, 23],  to: [8, 22] },
  { name: 'Virgo',      symbol: '♍︎', from: [8, 23],  to: [9, 22] },
  { name: 'Libra',      symbol: '♎︎', from: [9, 23],  to: [10, 22] },
  { name: 'Scorpio',    symbol: '♏︎', from: [10, 23], to: [11, 21] },
  { name: 'Sagittarius',symbol: '♐︎', from: [11, 22], to: [12, 21] },
];

// month is 1-12
export function getZodiacSign(month, day) {
  if (!month || !day) return null;
  return ZODIAC_SIGNS.find(({ from, to }) => {
    const [fm, fd] = from, [tm, td] = to;
    if (fm === tm) return month === fm && day >= fd && day <= td;
    if (fm > tm) return (month === fm && day >= fd) || (month === tm && day <= td);
    return (month === fm && day >= fd) || (month > fm && month < tm) || (month === tm && day <= td);
  }) || null;
}

// ── Image helpers ────────────────────────────────────────────────────────────

export function photoUrl(value) {
  if (!value) return null;
  // Full URL already (Supabase storage, Google Drive, etc.)
  if (value.startsWith('http')) {
    // Convert old Google Drive share links
    if (value.includes('drive.google.com')) {
      const i = value.indexOf('/d/');
      if (i === -1) return value;
      const id = value.substring(i + 3).split('/')[0].split('?')[0];
      return `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
    }
    return value;
  }
  // Bare filename → Supabase team-photos bucket
  return `${URL}/storage/v1/object/public/team-photos/${value}`;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

// Routed through the same fetch-events Supabase Edge Function Portal uses
// (server-side ICS fetch, no CORS proxy) -- this used to go through
// corsproxy.io directly, a free public proxy with no uptime/rate-limit
// guarantees, which is why the Dashboard's upcoming-events section would
// silently go empty whenever that proxy was down or throttled.
// Named fetch-events, not fetch-calendar -- real-browser testing showed a
// CORS error hitting a URL with "calendar" in the path even though direct
// requests to that same endpoint were always clean, consistent with a
// network-level filter targeting calendar-embed URLs.

export async function fetchCalendarEvents() {
  const text = await fetch(`${URL}/functions/v1/fetch-events`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then(r => r.text());
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  const events = [];
  let current = null;
  unfolded.split('\n').forEach(line => {
    if (line === 'BEGIN:VEVENT') { current = {}; }
    else if (line === 'END:VEVENT') { if (current) events.push(current); current = null; }
    else if (current) {
      const ci = line.indexOf(':');
      if (ci !== -1) { current[line.slice(0, ci).split(';')[0]] = line.slice(ci + 1); }
    }
  });
  return events;
}

export function parseIcalDate(val) {
  if (!val) return null;
  val = val.replace(/[^0-9TZ]/g, '');
  if (val.length === 8) return new Date(`${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T00:00:00`);
  const [y, mo, d, h, mi] = [val.slice(0,4), val.slice(4,6), val.slice(6,8), val.slice(9,11), val.slice(11,13)];
  const s = val.slice(13,15) || '00';
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${val.endsWith('Z') ? 'Z' : ''}`);
}

// ── Volunteers ────────────────────────────────────────────────────────────────

export async function fetchAllActiveVolunteers() {
  return get(`${VOL}?Status=eq.Active&select=*&order=Last%20Name.asc,First%20Name.asc`);
}

// The public site's Docent Tour Form -- same nsh_form_responses table Portal
// reads, so a new submission shows up here the moment it's saved (no sync
// step). Docents don't have Portal access, so this is their only place to
// see incoming tour requests.
const DOCENT_TOUR_FORM_ID = '0635cd26-b0c7-4076-b9b1-bd25d1949467';
// Requests older than this aren't shown at all -- set to the single most
// recent real request as of when this was added, so the card starts out
// showing just that one instead of the older backlog. From here on, every
// new submission is after this cutoff, so the card naturally grows up to
// `limit` as they come in.
const TOUR_REQUESTS_CUTOFF = '2026-09-28T15:18:31.52054+00:00';

const TOUR_REQUEST_FIELDS = 'id,answers,created_at,tour_status,internal_notes,calendar_event_id,tour_date,archived_at';

// Local (Pacific) date as YYYY-MM-DD, for comparing against tour dates.
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Open requests only: a request moves to Past Tours once a docent archives
// it, or once its scheduled tour_date (set when it's added to the calendar)
// has gone by.
export async function fetchRecentTourRequests(limit = 4) {
  // The cutoff's "+00:00" offset has to be URL-encoded -- an unencoded "+"
  // in a query string is read as a literal space, which broke the date
  // parse entirely (a silent-looking empty result, actually a 400).
  const rows = await get(`nsh_form_responses?form_id=eq.${DOCENT_TOUR_FORM_ID}&created_at=gte.${encodeURIComponent(TOUR_REQUESTS_CUTOFF)}&archived_at=is.null&or=(tour_date.is.null,tour_date.gte.${todayYmd()})&select=${TOUR_REQUEST_FIELDS}&order=created_at.desc&limit=${limit}`);
  return Array.isArray(rows) ? rows : [];
}

// Past Tours page: archived requests, requests whose tour date has passed,
// and the older backlog from before TOUR_REQUESTS_CUTOFF.
export async function fetchPastTourRequests() {
  const cutoff = encodeURIComponent(TOUR_REQUESTS_CUTOFF);
  const rows = await get(`nsh_form_responses?form_id=eq.${DOCENT_TOUR_FORM_ID}&or=(archived_at.not.is.null,tour_date.lt.${todayYmd()},created_at.lt.${cutoff})&select=${TOUR_REQUEST_FIELDS}&order=created_at.desc&limit=200`);
  return Array.isArray(rows) ? rows : [];
}

export async function setTourRequestArchived(id, archived, vol, authUserId) {
  const archivedAt = archived ? new Date().toISOString() : null;
  const res = await fetch(`${URL}/rest/v1/nsh_form_responses?id=eq.${id}`, {
    method: 'PATCH',
    headers: await hdr({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ archived_at: archivedAt }),
  });
  if (res.ok) {
    const name = vol ? `${vol['First Name'] || ''} ${vol['Last Name'] || ''}`.trim() : 'A docent';
    logActivity({
      vol, authUserId,
      action: archived ? 'tour_request_archived' : 'tour_request_restored',
      tag: 'Tour',
      description: archived ? `${name} moved a tour request to Past Tours` : `${name} restored a tour request from Past Tours`,
      detail: { response_id: id },
    }).catch(() => {});
  }
  return res.ok ? archivedAt : false;
}

// RSVPs from the public site's "View upcoming tour dates" pop-up (2nd & 4th
// Thursday docent tours). pt_tour_date is YYYY-MM-DD; only today's and future
// tours are returned, so a tour's list disappears once its date has passed.
const PUBLIC_TOUR_RSVP_FORM_ID = '74efea38-e863-4050-921e-234b563be78e';

export async function fetchUpcomingPublicTourRsvps() {
  const rows = await get(`nsh_form_responses?form_id=eq.${PUBLIC_TOUR_RSVP_FORM_ID}&answers->>pt_tour_date=gte.${todayYmd()}&select=id,answers,created_at&order=created_at.asc`);
  return Array.isArray(rows) ? rows : [];
}

// The Past Tours page's half of the above: RSVPs for public tours already held.
export async function fetchPastPublicTourRsvps() {
  const rows = await get(`nsh_form_responses?form_id=eq.${PUBLIC_TOUR_RSVP_FORM_ID}&answers->>pt_tour_date=lt.${todayYmd()}&select=id,answers,created_at&order=created_at.asc`);
  return Array.isArray(rows) ? rows : [];
}

// tour_status is separate from nsh_form_responses.status (which Portal's
// generic Form Responses "Mark handled" checkbox already owns) so the two
// features don't collide. internal_notes, however, IS the same field
// Portal's own Form Responses notes box reads/writes -- a note added here
// shows up there and vice versa, no separate sync needed.
//
// Both writes also log to activity_log (Portal's Activity Log + the ntfy
// phone-notification trigger it already fires on insert), with the
// response id in `detail` so it's traceable back to the exact submission
// in Portal's Form Responses view.
export async function updateTourRequestStatus(id, tourStatus, vol, authUserId) {
  const res = await fetch(`${URL}/rest/v1/nsh_form_responses?id=eq.${id}`, {
    method: 'PATCH',
    headers: await hdr({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ tour_status: tourStatus }),
  });
  if (res.ok) {
    const name = vol ? `${vol['First Name'] || ''} ${vol['Last Name'] || ''}`.trim() : 'A docent';
    logActivity({
      vol, authUserId,
      action: 'tour_status_updated',
      tag: 'Tour',
      description: tourStatus ? `${name} set a tour request to "${tourStatus}"` : `${name} cleared a tour request's status`,
      detail: { response_id: id, tour_status: tourStatus },
    }).catch(() => {});
  }
  return res.ok;
}

// Persists the Google Calendar event id straight onto the submission, once
// created, so "Add to Calendar" can show "Added to Calendar" permanently
// instead of only remembering it for this one page view. The tour date goes
// with it, so the request moves to Past Tours on its own after the tour.
export async function setTourRequestCalendarEventId(id, eventId, tourDate) {
  const res = await fetch(`${URL}/rest/v1/nsh_form_responses?id=eq.${id}`, {
    method: 'PATCH',
    headers: await hdr({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ calendar_event_id: eventId, ...(tourDate ? { tour_date: tourDate } : {}) }),
  });
  return res.ok;
}

export async function updateTourRequestNotes(id, notes, vol, authUserId) {
  const res = await fetch(`${URL}/rest/v1/nsh_form_responses?id=eq.${id}`, {
    method: 'PATCH',
    headers: await hdr({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ internal_notes: notes || null }),
  });
  if (res.ok) {
    const name = vol ? `${vol['First Name'] || ''} ${vol['Last Name'] || ''}`.trim() : 'A docent';
    logActivity({
      vol, authUserId,
      action: 'tour_notes_updated',
      tag: 'Tour',
      description: `${name} updated the notes on a tour request`,
      detail: { response_id: id, internal_notes: notes },
    }).catch(() => {});
  }
  return res.ok;
}

// Puts a real event on the North Star House Google Calendar -- the docent
// picks the actual scheduled date/time by hand, since the tour request
// itself only has preferred dates, not a confirmed slot.
export async function addTourToCalendar({ summary, description, date, startTime, durationMin }) {
  const res = await fetch(`${URL}/functions/v1/add-calendar-event`, {
    method: 'POST',
    headers: await hdr(),
    body: JSON.stringify({ summary, description, date, startTime, durationMin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || data.message || `Calendar request failed (${res.status}).` };
  return data;
}

export async function fetchVolunteerById(id) {
  const rows = await get(`${VOL}?id=eq.${id}&select=*`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function fetchVolunteerByEmail(email) {
  const rows = await get(`${VOL}?Email=ilike.${encodeURIComponent(email)}&select=*`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// ── Donor giving (only readable for a volunteer's own linked donor_id) ────────

export async function fetchMyGiving(donorId) {
  if (!donorId) return null;
  const [donorRows, donationRows] = await Promise.all([
    get(`donors?id=eq.${donorId}&select=*`),
    get(`donations?donor_id=eq.${donorId}&select=*&order=date.desc`),
  ]);
  const donor = Array.isArray(donorRows) ? donorRows[0] ?? null : null;
  if (!donor) return null;
  const donations = Array.isArray(donationRows) ? donationRows : [];
  const lifetimeTotal = Math.max(
    donations.reduce((s, d) => s + (d.amount || 0), 0),
    donor.historical_lifetime_giving || 0
  );
  const currentYear = new Date().getFullYear();
  const currentYearTotal = donations
    .filter(d => d.date && new Date(d.date).getFullYear() === currentYear)
    .reduce((s, d) => s + (d.amount || 0), 0);
  return { donor, donations, lifetimeTotal, currentYearTotal };
}

// ── Tag colors (for a volunteer's own Event Tags) ──────────────────────────────

export async function fetchListTagColors() {
  const rows = await get(`List%20Tag%20Colors?select=*`);
  return Array.isArray(rows) ? rows : [];
}

export async function updateVolunteer(id, patch_data) {
  const { error } = await supabase
    .from('2026 Volunteers')
    .update(patch_data)
    .eq('id', id);
  if (error) return { code: error.code, message: error.message };
  return patch_data;
}

// ── Out-of-Town ───────────────────────────────────────────────────────────────

// ── Announcement board (posted from the Portal, shown on the Dashboard) ────
export async function fetchAnnouncements() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await get(`announcements?or=(expires_at.is.null,expires_at.gte.${today})&order=created_at.desc&select=*`);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOotNotices() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const future = new Date(today.getTime() + 90 * 86400000);
  const t = today.toISOString().slice(0, 10);
  const f = future.toISOString().slice(0, 10);
  return get(`oot_notices?end_date=gte.${t}&start_date=lte.${f}&order=start_date.asc&select=*`);
}

export async function insertOotNotice(payload) {
  return post('oot_notices', payload);
}

// ── Hours (Supabase kiosk_logs) ───────────────────────────────────────────────

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildHoursMap(logs) {
  const byName = {};
  for (const log of logs) {
    const name = (log.name || '').trim();
    if (!name) continue;
    if (!byName[name]) byName[name] = [];
    byName[name].push(log);
  }

  const map = {};
  for (const [name, nameLogs] of Object.entries(byName)) {
    const key = name.toLowerCase();
    const months = {};
    let total = 0;

    for (let i = 0; i < nameLogs.length; i++) {
      if (nameLogs[i].action !== 'check-in') continue;
      const checkOut = nameLogs.find((l, idx) => idx > i && l.action === 'check-out');
      if (!checkOut) continue;
      const hours = (new Date(checkOut.timestamp) - new Date(nameLogs[i].timestamp)) / 3600000;
      if (hours <= 0 || hours > 24) continue;
      const m = MONTHS[new Date(nameLogs[i].timestamp).getMonth()];
      months[m] = (months[m] || 0) + hours;
      total += hours;
    }

    if (!map[key]) {
      map[key] = { total, months };
    } else {
      map[key].total += total;
      MONTHS.forEach(m => { if (months[m]) map[key].months[m] = (map[key].months[m] || 0) + months[m]; });
    }
  }
  return map;
}

export const DUTY_LABELS = {
  construction:      'Construction',
  board:              'Board Member',
  landscape:          'Grounds',
  docents:            'Docent',
  interiors:          'Interiors',
  events:             'Events Team',
  development:        'Development',
  volunteerExchange:  'Volunteer Exchange',
  other:              'Other',
};

function buildLocalIso(dateStr, timeStr) {
  const value = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export async function insertManualHours(name, duty, { date, useSpecificTimes, startTime, endTime, hours, notes }) {
  let checkInIso, checkOutIso;

  if (useSpecificTimes) {
    checkInIso = buildLocalIso(date, startTime);
    checkOutIso = buildLocalIso(date, endTime);
    if (!checkInIso || !checkOutIso || new Date(checkOutIso) <= new Date(checkInIso)) {
      return { error: 'Invalid start/end time.' };
    }
  } else {
    const enteredHours = Number(hours);
    if (!Number.isFinite(enteredHours) || enteredHours <= 0 || enteredHours > 12) {
      return { error: 'Hours must be between 0 and 12.' };
    }
    checkInIso = buildLocalIso(date, '09:00');
    if (!checkInIso) return { error: 'Invalid date.' };
    checkOutIso = new Date(new Date(checkInIso).getTime() + enteredHours * 3600000).toISOString();
  }

  const trimmedNotes = (notes || '').trim() || null;
  const rows = [
    { timestamp: checkInIso,  name, type: 'volunteer', duty, action: 'check-in',  source: 'manual-hours', notes: trimmedNotes },
    { timestamp: checkOutIso, name, type: 'volunteer', duty, action: 'check-out', source: 'manual-hours', notes: trimmedNotes },
  ];

  const res = await fetch(`${URL}/rest/v1/kiosk_logs`, {
    method: 'POST',
    headers: await hdr({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) return { error: 'Failed to save. Please try again.' };
  return { success: true };
}

export async function fetchHours() {
  try {
    const year = new Date().getFullYear();
    const headers = await hdr();
    const pageSize = 1000;
    let offset = 0;
    let logs = [];
    while (true) {
      const res = await fetch(
        `${URL}/rest/v1/kiosk_logs?type=eq.volunteer&timestamp=gte.${year}-01-01T00:00:00.000Z&timestamp=lt.${year + 1}-01-01T00:00:00.000Z&order=name.asc,timestamp.asc&select=timestamp,name,action&limit=${pageSize}&offset=${offset}`,
        { headers }
      );
      if (!res.ok) break;
      const page = await res.json();
      logs = logs.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return buildHoursMap(logs);
  } catch {
    return {};
  }
}

// ── Operational Areas ─────────────────────────────────────────────────────────

export const OPERATIONAL_AREAS = ['Construction', 'Grounds', 'Interiors', 'Docents', 'Fundraising', 'Events', 'Marketing', 'Venue'];

export const AREA_DEFAULTS = {
  'Construction': { lead: 'Rick Panos',      budget: 12000, pic: '' },
  'Grounds':      { lead: 'Paula Campbell',  budget: 14000, pic: '' },
  'Interiors':    { lead: 'Bec Freeman',     budget: 2500,  pic: '' },
  'Docents':      { lead: 'Rich Hill',       budget: 1000,  pic: '' },
  'Fundraising':  { lead: 'Kaelen Jennings', budget: null,  pic: '' },
  'Events':       { lead: 'Barb Kusha',      budget: 7500,  pic: '' },
  'Marketing':    { lead: 'Haley Wright',    budget: 1000,  pic: '' },
  'Venue':        { lead: 'Staff',           budget: null,  pic: '' },
};

const AREA_ALIASES = {
  'Events':  ['events team', 'event support', 'events'],
  'Docents': ['docent', 'docents'],
  'Venue':   ['venue'],
};

export function matchVolunteerAreas(team) {
  if (!team) return [];
  const tags = team.split(/[,|]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  return OPERATIONAL_AREAS.filter(area => {
    const aliases = AREA_ALIASES[area] || [area.toLowerCase()];
    return tags.some(t => aliases.indexOf(t) !== -1);
  });
}

export function currentQuarterStr() {
  const m = new Date().getMonth();
  return m <= 2 ? 'Q1' : m <= 5 ? 'Q2' : m <= 8 ? 'Q3' : 'Q4';
}

export async function fetchOperationalAreaInfo(area) {
  const rows = await get(`Operational%20Areas?area=eq.${encodeURIComponent(area)}&select=*`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function fetchOpBudget(area) {
  const rows = await get(`Op%20Budget?area=eq.${encodeURIComponent(area)}&select=*&order=date.desc,id.desc`);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOpEarnings(area) {
  const rows = await get(`Op%20Earnings?area=eq.${encodeURIComponent(area)}&select=*&order=date.desc,id.desc`);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOpResources(area) {
  const rows = await get(`Op%20Resources?area=eq.${encodeURIComponent(area)}&select=*&order=created_at.asc`);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOpQuarterGoals(area, quarter, year) {
  const rows = await get(`Op%20Quarter%20Goals?area=eq.${encodeURIComponent(area)}&quarter=eq.${encodeURIComponent(quarter)}&year=eq.${year}&select=*`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function fetchOpQuarterlyUpdate(area, quarter, year) {
  const rows = await get(`Op%20Quarterly%20Updates?area=eq.${encodeURIComponent(area)}&quarter=eq.${encodeURIComponent(quarter)}&year=eq.${year}&select=*&order=date_submitted.desc&limit=1`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export function getVolunteerHours(hoursMap, firstName, lastName) {
  const first = (firstName || '').trim().toLowerCase();
  const last  = (lastName  || '').trim().toLowerCase();
  const full  = `${first} ${last}`.trim();
  const merged = { total: 0, months: {} };
  let found = false;
  Object.entries(hoursMap).forEach(([key, data]) => {
    const match = key === full
      || key === first
      || (last && key === last)
      || (first && key.startsWith(first) && (!last || key.endsWith(last)));
    if (match) {
      found = true;
      merged.total += data.total;
      MONTHS.forEach(m => { if (data.months[m]) merged.months[m] = (merged.months[m] || 0) + data.months[m]; });
    }
  });
  return found ? merged : null;
}

// ── Reimbursements (shared "Op Budget" table — same one Portal's Financials
//    view manages) ───────────────────────────────────────────────────────────

export const REIMBURSEMENT_STATUSES = [
  'Draft', 'Submitted', 'Pending Review', 'More Information Needed', 'Approved', 'Paid', 'Denied',
];

// Same source Portal's own "Event Expenses"/"Event Earnings" forms suggest
// from: distinct event names already used in Op Budget/Op Earnings for the
// Events area (not the separate, no-longer-used "In-House Events" table).
// Not a real planned event -- the general giving bucket shows up in Op
// Earnings because it's logged under area=Events, but it has no date/
// checklist/etc. and shouldn't appear on the Events Committee board.
const NON_EVENT_NAMES = new Set(['general donation']);
// Website products that show up in ticket_orders but are not events (e.g. 'Commemorative Brick — 4" x 8" Brick').
const isNonEventName = (k) => NON_EVENT_NAMES.has(k) || /commemorative brick/.test(k);
export async function fetchEventNames() {
  const [budgetRows, earningsRows] = await Promise.all([
    get(`Op%20Budget?area=eq.Events&select=event_name`),
    get(`Op%20Earnings?area=eq.Events&select=event`),
  ]);
  const names = new Set();
  (Array.isArray(budgetRows) ? budgetRows : []).forEach(r => { if (r.event_name) names.add(r.event_name.trim()); });
  (Array.isArray(earningsRows) ? earningsRows : []).forEach(r => { if (r.event) names.add(r.event.trim()); });
  return Array.from(names).filter(n => n && !isNonEventName(n.trim().toLowerCase())).sort();
}

// Budget/earnings entries for one specific event (Op Budget event_name /
// Op Earnings event, both area=Events) — powers the Financials tab on the
// Events Committee page.
export async function fetchEventFinancials(eventName) {
  const enc = encodeURIComponent(eventName);
  const [expenses, earnings] = await Promise.all([
    get(`Op%20Budget?area=eq.Events&event_name=eq.${enc}&select=*&order=date.desc,id.desc`),
    get(`Op%20Earnings?area=eq.Events&event=eq.${enc}&select=*&order=date.desc,id.desc`),
  ]);
  return {
    expenses: Array.isArray(expenses) ? expenses : [],
    earnings: Array.isArray(earnings) ? earnings : [],
  };
}

// Live website ticket sales for one event (Portal's ticket_orders table,
// same project, read-only here) -- matched by event_title the same way
// fetchEventFinancials matches Op Budget/Op Earnings by event name.
// "paid" is only one of several order kinds that actually involve money --
// donations/memberships/brick orders are real captures too, only rsvp/comp
// are free (mirrors the same fix in Portal's Website Payments view).
const TICKET_ORDER_MONEY_KINDS = new Set(['paid', 'donation', 'membership', 'brick']);
export async function fetchEventTicketStats(eventName) {
  const rows = await get(`ticket_orders?event_title=eq.${encodeURIComponent(eventName)}&select=kind,quantity,amount`);
  const paid = (Array.isArray(rows) ? rows : []).filter(o => TICKET_ORDER_MONEY_KINDS.has(o.kind));
  return {
    ticketsSold: paid.reduce((s, o) => s + Number(o.quantity || 0), 0),
    revenue: paid.reduce((s, o) => s + Number(o.amount || 0), 0),
  };
}

// Just the flyer image for one event (event_overview_cards, same table
// fetchUpcomingEventCards reads) -- for Events Committee's Overview tab.
export async function fetchEventCardImage(eventName) {
  const rows = await get(`event_overview_cards?event_name=eq.${encodeURIComponent(eventName)}&select=image_url&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0].image_url || null : null;
}

// Uploads a flyer image to the same Drive folder/edge function Portal's
// Event Overviews page uses, then upserts it onto this event's
// event_overview_cards row (on_conflict=event_name, so first upload creates
// the row and later ones just replace the image).
export async function uploadEventFlyer(eventName, file) {
  const base64 = await fileToBase64(file);
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
  const safeName = eventName.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Event';
  const filename = `${safeName} Flyer ${Date.now()}${ext}`;
  const res = await fetch(`${URL}/functions/v1/upload-archive-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      filename, mimeType: file.type || 'application/octet-stream', base64,
      kind: 'general', subfolder: 'Event Flyers', makePublic: true, driveDescription: `Flyer for ${eventName}`,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Upload failed');
  const rows = await post('event_overview_cards?on_conflict=event_name', {
    event_name: eventName, image_url: data.url, image_drive_file_id: data.fileId, image_drive_folder_url: data.folderUrl,
    updated_at: new Date().toISOString(),
  }, { Prefer: 'resolution=merge-duplicates,return=representation' });
  return (Array.isArray(rows) && rows[0] ? rows[0].image_url : null) || data.url;
}

// Shared by fetchUpcomingEventCards (dashboard teaser) and
// fetchAllEventCards (Events Committee's full grid) -- merges
// event_overview_cards/Op Budget/Op Earnings/ticket_orders by event-name
// into one card per event (image, date, earnings, costs). General Donation
// is excluded -- it's the general giving bucket, not a planned event.
export async function fetchMergedEventCards() {
  const [cardMeta, budget, earnings, tickets, committee] = await Promise.all([
    get('event_overview_cards?select=*'),
    get(`Op%20Budget?area=eq.Events&select=event_name,amount`),
    get(`Op%20Earnings?area=eq.Events&select=event,amount`),
    get('ticket_orders?select=event_title,event_date,kind,amount'),
    get('events_committee?select=*'),
  ]);
  const byKey = {};
  const keyOf = (n) => (n || '').trim().toLowerCase();
  // event_overview_cards.event_date is already ISO (YYYY-MM-DD), but
  // ticket_orders.event_date is a human string ("October 23, 2026") --
  // comparing those as raw strings sorts wrong, so normalize to ISO before
  // it's ever stored on the merged card.
  function toIsoDate(d) {
    if (!d) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const parsed = new Date(d);
    return isNaN(parsed) ? null : parsed.toISOString().slice(0, 10);
  }
  function ensure(name, date) {
    const k = keyOf(name);
    if (!k || isNonEventName(k)) return null;
    const iso = toIsoDate(date);
    if (!byKey[k]) byKey[k] = { name: name.trim(), date: iso, earnings: 0, costs: 0, image_url: null, status: null };
    if (iso && !byKey[k].date) byKey[k].date = iso;
    return byKey[k];
  }
  (Array.isArray(cardMeta) ? cardMeta : []).forEach(r => {
    const b = ensure(r.event_name, r.event_date);
    if (b) { b.image_url = r.image_url || null; b.rsvp_only = !!r.rsvp_only; }
  });
  (Array.isArray(budget) ? budget : []).forEach(r => { const b = ensure(r.event_name); if (b) b.costs += Number(r.amount || 0); });
  (Array.isArray(earnings) ? earnings : []).forEach(r => { const b = ensure(r.event); if (b) b.earnings += Number(r.amount || 0); });
  (Array.isArray(tickets) ? tickets : [])
    .filter(o => TICKET_ORDER_MONEY_KINDS.has(o.kind))
    .forEach(o => { const b = ensure(o.event_title, o.event_date); if (b) b.earnings += Number(o.amount || 0); });
  // events_committee is the source of truth for status (e.g. 'cancelled') and also holds events someone
  // just added on the planning page, which have no flyer/budget/tickets yet -- those show as cards too, so a
  // new event appears right away. (ensure() skips website products like commemorative bricks.)
  (Array.isArray(committee) ? committee : []).forEach(r => {
    const b = ensure(r.name, r.date);
    if (!b) return;
    b.status = r.status || null;
    if (!b.date && r.date) b.date = toIsoDate(r.date);
    if (r.hidden) b.hidden = true; // staff chose to hide this event from the cards
  });
  return Object.values(byKey).filter(c => !c.hidden);
}

// Dashboard teaser -- just the next few upcoming events.
export async function fetchUpcomingEventCards(limit = 4) {
  const all = await fetchMergedEventCards();
  const todayStr = new Date().toISOString().slice(0, 10);
  return all
    .filter(c => c.date && c.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// Events Committee's full grid -- every event, split into upcoming (dated
// today or later, soonest first) and past (everything else, including
// undated events, most recent first).
export async function fetchAllEventCards() {
  const all = await fetchMergedEventCards();
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter(c => c.date && c.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const past = all.filter(c => !c.date || c.date < todayStr).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { upcoming, past };
}

// Reviews/feedback for one specific event (Portal's "Event Feedback" table,
// same one its Events P&L page's "Reviews & Feedback" tab manages) — powers
// the Reviews tab on the Events Committee page.
export async function fetchEventFeedback(eventName) {
  const rows = await get(`Event%20Feedback?event_name=eq.${encodeURIComponent(eventName)}&select=*&order=date.desc,id.desc`);
  return Array.isArray(rows) ? rows : [];
}

export async function insertEventFeedback(payload) {
  const rows = await post('Event%20Feedback', payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

export async function updateEventFeedback(id, payload) {
  const rows = await patch(`Event%20Feedback?id=eq.${id}`, payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

export async function deleteEventFeedback(id) {
  const ok = await del(`Event%20Feedback?id=eq.${id}`);
  return { success: ok };
}

export async function fetchMyReimbursements(authUserId) {
  const rows = await get(`Op%20Budget?volunteer_auth_user_id=eq.${authUserId}&select=*&order=created_at.desc`);
  return Array.isArray(rows) ? rows : [];
}

export async function insertReimbursement(payload) {
  const rows = await post('Op%20Budget', payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

export async function updateReimbursement(id, payload) {
  const rows = await patch(`Op%20Budget?id=eq.${id}`, payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

export async function deleteReimbursement(id) {
  const ok = await del(`Op%20Budget?id=eq.${id}`);
  return { success: ok };
}

export function parseReceipts(receiptUrl) {
  if (!receiptUrl) return [];
  try {
    const p = JSON.parse(receiptUrl);
    if (Array.isArray(p)) return p;
  } catch { /* not JSON, single URL */ }
  return [receiptUrl];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Uploads into the "Reimbursements" folder in the same Portal Backend Shared
// Drive as Checks/Mail/Acknowledgements (via a shared edge function, since
// this table's receipts used to live in Supabase Storage).
export async function uploadReceiptFile(file, volunteerId) {
  const ext = (file.name.split('.').pop() || 'bin');
  const now = new Date();
  const mdY = `${now.getMonth() + 1}.${now.getDate()}.${now.getFullYear()}`;
  const filename = `${mdY} - Receipt - ${volunteerId}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const base64 = await fileToBase64(file);
  const res = await fetch(`${URL}/functions/v1/upload-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ filename, mimeType: file.type || 'application/octet-stream', base64 }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Receipt upload failed');
  return data.url;
}

export async function uploadReceiptFiles(files, volunteerId) {
  const urls = await Promise.all(files.map(f => uploadReceiptFile(f, volunteerId)));
  return urls.length === 1 ? urls[0] : JSON.stringify(urls);
}

// ── Archive photo/document uploads ──────────────────────────────────────────
// Uploads into the North Star Archives Drive, sorted into year/month folders
// by the upload-archive-file edge function. Filenames stay short (date +
// optional description + optional names); the full context goes into the
// Drive file's own description field so Drive search finds it later.

const ARCHIVE_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function sanitizeForFilename(str, maxLen) {
  if (!str) return '';
  const cleaned = str.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
}

// Builds the short filename date segment matching how the edge function
// resolves the folder: year-month when a month is known (given or, absent a
// year, today's), just the year when only the year is known. Never includes
// a day-of-month, matching the folder structure (which only ever goes down
// to month).
function archiveDateLabel(year, month) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = year ? month : (month || now.getMonth() + 1);
  if (!m) return String(y);
  return `${y}-${String(m).padStart(2, '0')}`;
}

export async function uploadArchiveFiles(files, { kind, year, month, description, names }, uploaderName) {
  const dateLabel = archiveDateLabel(year, month);
  const now = new Date();

  const dateContext = year
    ? (month ? `${ARCHIVE_MONTH_NAMES[month - 1]} ${year}` : `${year} (month unknown)`)
    : `${ARCHIVE_MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const descLines = [
    `Date taken: ${dateContext}`,
    uploaderName ? `Uploaded by: ${uploaderName}` : null,
    description ? `Notes: ${description}` : null,
    names ? `People: ${names}` : null,
    `Uploaded: ${now.toISOString()}`,
  ].filter(Boolean);
  const driveDescription = descLines.join('\n');

  const namePart = sanitizeForFilename(description, 28);
  const whoPart = sanitizeForFilename(names, 28);

  let lastResult = null;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const suffix = files.length > 1 ? `-${i + 1}` : '';
    const rand = Math.random().toString(36).slice(2, 5);
    const filenameParts = [dateLabel, namePart, whoPart].filter(Boolean);
    const filename = `${filenameParts.join(' - ')}${suffix}-${rand}.${ext}`;
    const base64 = await fileToBase64(file);
    const res = await fetch(`${URL}/functions/v1/upload-archive-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ filename, mimeType: file.type || 'application/octet-stream', base64, kind, year: year || undefined, month: month || undefined, driveDescription }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `Upload failed for ${file.name}`);
    lastResult = data;
  }
  return lastResult; // { url, fileId, folderUrl } for the last file — all files in a batch share the same folder
}

// ── Upload Photos & Documents → existing Google Drive folders ──────────────
// Backed by the `archive-upload` edge function (Portal repo). Categories come
// live from the Drive folder structure; files go straight from the browser to
// Google Drive through a resumable-upload session, so large videos work.

async function archiveUploadCall(body) {
  const res = await fetch(`${URL}/functions/v1/archive-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// -> { photo: [{ id, label }], document: [{ id, label }] }
export async function fetchArchiveCategories() {
  const { photo, document } = await archiveUploadCall({ action: 'categories' });
  return { photo: photo || [], document: document || [] };
}

function putToDrive(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed for ${file.name} (${xhr.status})`)));
    xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}. Check your connection and try again.`));
    xhr.send(file);
  });
}

// opts: { kind, categoryId ('other' for Other), categoryLabel, otherText,
//         title, description, date }
// onProgress({ fileIndex, total, fraction }) — fraction is 0..1 overall.
export async function uploadToDriveArchive(files, opts, uploaderName, onProgress) {
  const total = files.length;
  const totalBytes = files.reduce((s, f) => s + (f.size || 1), 0) || 1;
  let doneBytes = 0;
  let folderUrl = null;
  for (let i = 0; i < total; i++) {
    const file = files[i];
    const start = await archiveUploadCall({
      action: 'start',
      kind: opts.kind,
      categoryId: opts.categoryId,
      otherText: opts.otherText,
      title: opts.title,
      description: opts.description,
      date: opts.date,
      uploaderName,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      index: i,
      total,
    });
    folderUrl = start.folderUrl;
    await putToDrive(start.uploadUrl, file, (f) =>
      onProgress?.({ fileIndex: i, total, fraction: (doneBytes + f * (file.size || 1)) / totalBytes }));
    doneBytes += file.size || 1;
    onProgress?.({ fileIndex: i + 1, total, fraction: doneBytes / totalBytes });
  }
  archiveUploadCall({ action: 'done', kind: opts.kind, categoryLabel: opts.categoryLabel, count: total, uploaderName }).catch(() => {});
  return { folderUrl, count: total };
}

// ── Activity log (surfaced in Portal's "Recent Activity" on the home page) ────

export async function logActivity({ vol, authUserId, action, description, tag, detail }) {
  const volunteerName = vol ? `${vol['First Name'] || ''} ${vol['Last Name'] || ''}`.trim() : null;
  return post('activity_log', {
    volunteer_name: volunteerName,
    volunteer_id: vol?.id ?? null,
    auth_user_id: authUserId,
    action,
    description,
    ...(tag !== undefined ? { tag } : {}),
    ...(detail !== undefined ? { detail } : {}),
  });
}

// ── Events Committee Planning Notes ────────────────────────────────────────

export async function fetchCommitteeEvents() {
  const rows = await get('events_committee?select=*&order=date.asc.nullslast');
  return Array.isArray(rows) ? rows : [];
}

export async function insertCommitteeEvent(payload) {
  const rows = await post('events_committee', payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

// Used by the auto-sync from Op Budget/Op Earnings event names: two
// concurrent loads (two tabs, dev double-invoke, etc.) could otherwise both
// decide the same name is "missing" and both insert it. on_conflict +
// ignore-duplicates makes a losing insert a silent no-op instead of a
// duplicate row (requires the name_key unique constraint from
// supabase-events-committee-dedupe.sql).
export async function insertCommitteeEventIfMissing(payload) {
  const rows = await post('events_committee?on_conflict=name_key', payload, { Prefer: 'return=representation,resolution=ignore-duplicates' });
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

// Keeps Event Overviews in step with the Events Committee: every committee event (that isn't hidden) gets an
// event_overview_cards row, which is what Event Overviews lists, and an undated card picks up the committee's date.
// `events` = rows from events_committee (name, date, hidden).
const OVERVIEW_DEFAULT_CHECKLIST = ['Flyer designed', 'Posted on social media', 'Newsletter mention', 'Tickets / RSVP page live', 'Reminder sent'].map(label => ({ label, done: false }));
export async function syncOverviewCardsFromCommittee(events) {
  const cards = await get('event_overview_cards?select=event_name,event_date');
  if (!Array.isArray(cards)) return;
  const have = new Map(cards.map(c => [String(c.event_name || '').trim().toLowerCase(), c]));
  const now = new Date().toISOString();
  const toCreate = [];
  for (const e of events || []) {
    const name = String(e.name || '').trim();
    const k = name.toLowerCase();
    if (!name || e.hidden || isNonEventName(k)) continue;
    const card = have.get(k);
    if (!card) {
      toCreate.push({ event_name: name, event_date: e.date || null, checklist: OVERVIEW_DEFAULT_CHECKLIST, updated_at: now });
      have.set(k, { event_name: name, event_date: e.date || null });
    } else if (!card.event_date && e.date) {
      await patch(`event_overview_cards?event_name=eq.${encodeURIComponent(card.event_name)}`, { event_date: e.date, updated_at: now });
    }
  }
  if (toCreate.length) await post('event_overview_cards?on_conflict=event_name', toCreate, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
}

// Events hidden from the cards (Events Committee page lists them so they can be brought back).
export async function fetchHiddenCommitteeEvents() {
  const rows = await get('events_committee?select=id,name,date&hidden=eq.true&order=name.asc');
  return Array.isArray(rows) ? rows : [];
}

export async function updateCommitteeEvent(id, payload) {
  const rows = await patch(`events_committee?id=eq.${id}`, payload);
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}

// Mirrors a committee event onto the Leadership Dashboard's "In-House Events"
// list and logs it to activity_log. That table requires a Portal app session
// (has_valid_app_session()) which Volunteer Hub's Supabase-auth users don't
// have, so this goes through a shared edge function (also used by the
// standalone Events Committee planning site) that does it with the service
// role key instead. Pass ihEventId on rename/reschedule to update the linked
// row in place rather than creating a new one.
export async function syncInHouseEvent({ name, date, ihEventId }) {
  try {
    const res = await fetch(`${URL}/functions/v1/log-committee-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ name, date, skipActivityLog: true, ...(ihEventId ? { ihEventId } : {}) }),
    });
    const data = await res.json();
    return data && data.success ? data.event : null;
  } catch {
    return null;
  }
}

export async function deleteCommitteeEvent(id) {
  const ok = await del(`events_committee?id=eq.${id}`);
  return { success: ok };
}

// ── Events Committee area planning (Overall/Programs/Volunteers/Logistics/
// Hospitality/Finance/Sponsorship/Interiors/Marketing) ─────────────────────

export async function fetchAreaData(eventId) {
  const rows = await get(`events_committee_areas?event_id=eq.${eventId}&select=*`);
  return Array.isArray(rows) ? rows : [];
}

// Upserts one area's row for an event. Pass only the fields you're changing
// (owner_name / pre_data / post_data) — existing ones are preserved via the
// merge-duplicates resolution, since Postgres upsert replaces the whole row
// otherwise; callers should pass the full pre_data/post_data object they
// want stored (not a partial patch), same as how the rest of this file works.
export async function saveArea(eventId, areaKey, { ownerName, preData, postData, authUserId } = {}) {
  const payload = { event_id: eventId, area_key: areaKey, updated_at: new Date().toISOString() };
  if (ownerName !== undefined) payload.owner_name = ownerName;
  if (preData !== undefined) payload.pre_data = preData;
  if (postData !== undefined) payload.post_data = postData;
  if (authUserId) payload.updated_by = authUserId;
  const rows = await post('events_committee_areas?on_conflict=event_id,area_key', payload, { Prefer: 'resolution=merge-duplicates,return=representation' });
  if (rows && rows.code) return { error: rows.message || rows.code };
  return { success: true, row: Array.isArray(rows) ? rows[0] : null };
}



// ── Events Committee voting ──────────────────────────────────────────────────
// Same idea as the Board's voting in the Portal. Tables: events_vote_items, events_votes
// (see supabase-events-committee-voting.sql).

// "Marketing not applicable" flag for an event, stored on its event_overview_cards row (shared with the Portal).
export async function fetchEventMarketingNA(name) {
  const rows = await get(`event_overview_cards?select=marketing_na&event_name=eq.${encodeURIComponent(name)}`);
  return Array.isArray(rows) && !!rows[0]?.marketing_na;
}

export async function setEventMarketingNA(name, value) {
  const res = await post('event_overview_cards?on_conflict=event_name',
    { event_name: name, marketing_na: !!value, updated_at: new Date().toISOString() },
    { Prefer: 'resolution=merge-duplicates,return=representation' });
  if (res && res.message) throw new Error(res.message);
}

export async function fetchVoteItems() {
  const rows = await get('events_vote_items?select=*&order=created_at.desc');
  return Array.isArray(rows) ? rows : [];
}

export async function fetchVotes() {
  const rows = await get('events_votes?select=*');
  return Array.isArray(rows) ? rows : [];
}

export async function createVoteItem(item) {
  const rows = await post('events_vote_items', item);
  if (rows && rows.message) throw new Error(rows.message);
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function closeVoteItem(id) {
  const rows = await patch(`events_vote_items?id=eq.${encodeURIComponent(id)}`, { status: 'Closed' });
  if (rows && rows.message) throw new Error(rows.message);
}

export async function deleteVoteItem(id) {
  // events_votes rows go with it (on delete cascade).
  return del(`events_vote_items?id=eq.${encodeURIComponent(id)}`);
}

export async function fetchVoteParts() {
  const rows = await get('events_vote_parts?select=*&order=sort_order.asc,created_at.asc');
  return Array.isArray(rows) ? rows : [];
}

export async function createVoteParts(itemId, parts) {
  if (!parts.length) return [];
  const rows = await post('events_vote_parts', parts.map((p, i) => ({ item_id: itemId, title: p.title, description: p.description || null, sort_order: i })));
  if (rows && rows.message) throw new Error(rows.message);
  return rows;
}

// One vote per person per voted-on piece (a whole item, or one part of it): a second submit changes the first.
// `entries` = [{ partId, choice, note, existingId, changedInMeeting }]
export async function castVotes({ itemId, voterId, voter, entries }) {
  for (const e of entries) {
    const body = { choice: e.choice, note: e.note || null, voter, updated_at: new Date().toISOString() };
    const res = e.existingId
      ? await patch(`events_votes?id=eq.${encodeURIComponent(e.existingId)}`, { ...body, changed_in_meeting: !!e.changedInMeeting })
      : await post('events_votes', { ...body, item_id: itemId, part_id: e.partId || null, voter_id: String(voterId), changed_in_meeting: false });
    if (res && res.message) throw new Error(res.message);
  }
}

export async function sendVoteNotification({ to, title, link }) {
  const gold = '#886c44';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;"><div style="height:14px;background:${gold};"></div><div style="padding:40px;text-align:center;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${gold};font-weight:bold;margin-bottom:14px;">EVENTS COMMITTEE</div><h1 style="margin:0 0 22px;font-size:26px;font-weight:400;color:#2a2420;">${esc(title)}</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 22px;"></div><p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">A new item is up for an Events Committee vote. Please review the details and cast your vote in the Volunteer Hub.</p><a href="${link}" style="display:inline-block;background:${gold};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;">Review &amp; Cast Your Vote</a></div></div></div>`;
  const text = `${title}\n\nA new item is up for an Events Committee vote. Please review the details and cast your vote in the Volunteer Hub.\n\nReview & cast your vote: ${link}`;
  const headers = await hdr(); delete headers.Prefer;
  const r = await fetch(`${URL}/functions/v1/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, subject: `Events Committee Vote: ${title}`, body: text, html, sender: 'Events Committee' }),
  });
  return r.ok;
}
