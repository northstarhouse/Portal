const { useState, useEffect } = React;

const SUPABASE_URL = "https://uvzwhhwzelaelfhfkvdb.supabase.co";
const SUPABASE_KEY = "sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do";
const WIX_FORMS_URL = "https://script.google.com/macros/s/AKfycbzY3c6_xF2ucrZrQnZLa1bcU2TIcFadBH9UEeIbJYMKumvxygql8ulN-67q1Vu_WM4h/exec";

const APP_TOKEN_KEY = 'nsh-app-token';

(function installFetchGate() {
  if (window.__nshFetchGated) return;
  window.__nshFetchGated = true;
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(SUPABASE_URL) === 0) {
      var token = null;
      try { token = localStorage.getItem(APP_TOKEN_KEY); } catch (e) {}
      if (token) {
        init = init || {};
        var headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
        headers.set('x-app-token', token);
        init.headers = headers;
      }
      var method = (init && init.method && init.method.toUpperCase()) || 'GET';
      return origFetch(input, init).then(function(res) {
        if (res && res.status === 401) {
          try { localStorage.removeItem(APP_TOKEN_KEY); } catch (e) {}
          window.dispatchEvent(new Event('nsh:token-invalid'));
        }
        // After any write, clear the cache for that table so next read is fresh
        if (res && res.ok && (method === 'PATCH' || method === 'POST' || method === 'DELETE')) {
          var m = url.match(/\/rest\/v1\/([^?#]+)/);
          if (m) {
            var tableName = decodeURIComponent(m[1]);
            window.__nshClearCache && window.__nshClearCache(tableName);
          }
        }
        return res;
      });
    }
    return origFetch(input, init);
  };
})();

function AppGate({ children }) {
  var [hasToken, setHasToken] = useState(function() {
    try { return !!localStorage.getItem(APP_TOKEN_KEY); } catch (e) { return false; }
  });
  var [pwd, setPwd] = useState('');
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState('');
  var [expired, setExpired] = useState(false);

  useEffect(function() {
    function onInvalid() { setHasToken(false); setExpired(true); }
    window.addEventListener('nsh:token-invalid', onInvalid);
    return function() { window.removeEventListener('nsh:token-invalid', onInvalid); };
  }, []);

  // Validate token on mount — RLS returns [] on bad token (not 401), so the
  // global fetch wrapper's 401 handler doesn't catch expiry. Probe explicitly.
  useEffect(function() {
    if (!hasToken) return;
    var cancelled = false;
    fetch(SUPABASE_URL + '/rest/v1/rpc/has_valid_app_session', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function(r) { return r.json(); }).then(function(valid) {
      if (cancelled) return;
      if (valid !== true) {
        try { localStorage.removeItem(APP_TOKEN_KEY); } catch (e) {}
        setHasToken(false); setExpired(true);
      }
    }).catch(function() { /* network error — leave hasToken alone */ });
    return function() { cancelled = true; };
  }, []);

  function attempt(e) {
    e.preventDefault();
    if (!pwd || busy) return;
    setBusy(true); setErr('');
    fetch(SUPABASE_URL + '/rest/v1/rpc/verify_app_password', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_password: pwd, p_user_agent: (navigator.userAgent || '').slice(0, 200) })
    }).then(function(r) {
      return r.json().then(function(data) { return { ok: r.ok, data: data }; });
    }).then(function(res) {
      if (!res.ok) { setErr('Something went wrong. Try again.'); setBusy(false); return; }
      if (!res.data) { setErr('Wrong password.'); setBusy(false); setPwd(''); return; }
      try { localStorage.setItem(APP_TOKEN_KEY, res.data); } catch (e) {}
      // Clear stale data cache from before the gate landed — pre-token requests
      // would have returned [] (RLS denial) and gotten cached as empty.
      try {
        Object.keys(sessionStorage).filter(function(k) { return k.indexOf('nsh4_') === 0; }).forEach(function(k) { sessionStorage.removeItem(k); });
      } catch (e) {}
      setHasToken(true); setPwd(''); setBusy(false); setExpired(false);
    }).catch(function() {
      setErr('Network error. Try again.'); setBusy(false);
    });
  }

  // On a genuine session expiry (was authenticated, now isn't), keep
  // `children` mounted underneath the overlay so any in-progress form
  // (e.g. an open edit modal) survives re-login instead of being
  // destroyed. A fresh, never-authenticated load still renders nothing
  // underneath, so no requests go out before the first successful login.
  return React.createElement(React.Fragment, null,
    (hasToken || expired) && children,
    !hasToken && React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: '#f7f3ec', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16, fontFamily: "'Calibri', 'Segoe UI', sans-serif" }
    },
      React.createElement('form', { onSubmit: attempt, style: { background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 360, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 24, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif", marginBottom: 8 } }, 'North Star House'),
        React.createElement('div', { style: { fontSize: 13, color: '#888', marginBottom: 28 } }, expired ? 'Session expired — please re-enter the password. Anything you had open is still here.' : 'Enter the password to view portal data.'),
        React.createElement('input', {
          autoFocus: true, type: 'password', value: pwd, disabled: busy,
          onChange: function(e) { setPwd(e.target.value); setErr(''); },
          placeholder: 'Password',
          style: { width: '100%', padding: '10px 14px', border: '0.5px solid ' + (err ? '#e05050' : '#e0d8cc'), borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: err ? 6 : 16, outline: 'none', textAlign: 'center', letterSpacing: 2 }
        }),
        err && React.createElement('div', { style: { fontSize: 12, color: '#e05050', marginBottom: 12 } }, err),
        React.createElement('button', {
          type: 'submit', disabled: busy || !pwd,
          style: { width: '100%', padding: '11px', background: '#b5a185', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy || !pwd ? 'not-allowed' : 'pointer', opacity: busy || !pwd ? 0.6 : 1 }
        }, busy ? 'Checking…' : 'Sign in'),
        React.createElement('div', { style: { fontSize: 11, color: '#bbb', marginTop: 24 } }, 'Need access? Ask Haley.')
      )
    )
  );
}

function sbFetch(table, columns) {
  const cols = columns.map(c => encodeURIComponent(c)).join(",");
  const url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=" + cols;
  return fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  }).then(r => r.json());
}

var CACHE_TTL = 5 * 60 * 1000; // 5 min within a session; sessionStorage clears on new visit
var _cache = {};
var LS_PREFIX = 'nsh4_';
function lsGet(key) {
  try {
    var r = sessionStorage.getItem(LS_PREFIX + key);
    if (!r) return null;
    var parsed = JSON.parse(r);
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object' && parsed.ts !== undefined) {
      if (Date.now() - parsed.ts > CACHE_TTL) { sessionStorage.removeItem(LS_PREFIX + key); return null; }
      return parsed.data;
    }
    return null;
  } catch(e) { return null; }
}
function lsSet(key, data) {
  try { sessionStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
}
function _cacheGet(key) {
  var entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { delete _cache[key]; return null; }
  return entry.data;
}
function _cacheSet(key, data) { _cache[key] = { ts: Date.now(), data: data }; }
function cachedSbFetch(table, columns) {
  var key = table + ':' + columns.slice().sort().join(',');
  var mem = _cacheGet(key); if (mem) return Promise.resolve(mem);
  var ls = lsGet(key); if (ls) { _cacheSet(key, ls); return Promise.resolve(ls); }
  return sbFetch(table, columns).then(function(data) {
    if (Array.isArray(data)) { _cacheSet(key, data); lsSet(key, data); }
    return data;
  });
}
function cachedFetchAll(table) {
  var key = table + ':*';
  var mem = _cacheGet(key); if (mem) return Promise.resolve(mem);
  var ls = lsGet(key); if (ls) { _cacheSet(key, ls); return Promise.resolve(ls); }
  var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?select=*';
  return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (Array.isArray(data)) { _cacheSet(key, data); lsSet(key, data); } return data; });
}
function cachedFetch(url) {
  var mem = _cacheGet(url); if (mem) return Promise.resolve(mem);
  var ls = lsGet(url); if (ls) { _cacheSet(url, ls); return Promise.resolve(ls); }
  return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (Array.isArray(data)) { _cacheSet(url, data); lsSet(url, data); } return data; });
}
function clearCache(table) {
  var enc = encodeURIComponent(table);
  Object.keys(_cache).forEach(function(k) {
    if (k.indexOf(table + ':') === 0 || k.indexOf('/' + enc + '?') !== -1) delete _cache[k];
  });
  Object.keys(sessionStorage).forEach(function(k) {
    if (!k.startsWith(LS_PREFIX)) return;
    var inner = k.slice(LS_PREFIX.length);
    if (inner.indexOf(table + ':') === 0 || inner.indexOf('/' + enc + '?') !== -1) sessionStorage.removeItem(k);
  });
}
window.__nshClearCache = clearCache;

function logActivity(description, action) {
  fetch(SUPABASE_URL + '/rest/v1/activity_log', {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: description, action: action })
  }).catch(function() {});
}

const CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";

// Kick off critical fetches immediately so data is ready when views mount
(function prefetch() {
  cachedSbFetch('2026 Volunteers', ['id','First Name','Last Name','Team','Event Tags','Status','Email','Phone Number','Preferred Contact','Address','Birthday','Volunteer Anniversary','CC','Nametag','Overview Notes','Background Notes','Notes','What they want to see at NSH','Favorite Quote','NSH Future Vision','Allergies','Special Considerations','Picture URL','Emergency Contact','Month','Day']);
  cachedSbFetch('2026 Donations', ['id','Donor Name','Last Name','Informal Names','Amount','Close Date','Donation Type','Payment Type','Account Type','Acknowledged','Salesforce','Email','Phone Number','Address','Benefits','Donation Notes','Donor Notes','Notes']);
  cachedSbFetch('Sponsors', ['id','Business Name','Main Contact','Donation','Fair Market Value','Area Supported','Acknowledged','NSH Contact','Notes','sponsor_status']);
  cachedFetchAll('Board Voting Items');
  cachedFetchAll('Board-Votes');
})();

function fetchCalendarEvents() {
  var proxy = "https://corsproxy.io/?" + encodeURIComponent(CALENDAR_ICAL_URL);
  return fetch(proxy).then(function(r) { return r.text(); }).then(function(text) {
    // Unfold continuation lines
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
    var events = [], current = null;
    text.split("\n").forEach(function(line) {
      if (line === "BEGIN:VEVENT") { current = {}; }
      else if (line === "END:VEVENT") { if (current) events.push(current); current = null; }
      else if (current) {
        var ci = line.indexOf(":");
        if (ci !== -1) {
          var rawKey = line.slice(0, ci);
          var val = line.slice(ci + 1);
          var baseKey = rawKey.split(";")[0];
          current[baseKey] = val;
        }
      }
    });
    return events;
  });
}

function parseIcalDate(val) {
  if (!val) return null;
  val = val.replace(/[^0-9TZ]/g, "");
  if (val.length === 8) return new Date(val.slice(0,4) + "-" + val.slice(4,6) + "-" + val.slice(6,8) + "T00:00:00");
  var y = val.slice(0,4), mo = val.slice(4,6), d = val.slice(6,8), h = val.slice(9,11), mi = val.slice(11,13), s = val.slice(13,15) || "00";
  return new Date(y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + s + (val.endsWith("Z") ? "Z" : ""));
}

const gold = "#886c44";
const cream = "#f8f4ec";

var MobileCtx = React.createContext(false);

var NAV_ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  quarterly: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>',
  volunteers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  donors: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  board: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  strategy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  operational: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sponsors: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
  financials: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  venue: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><path d="M9 2v4"/><path d="M15 2v4"/>',
  ideas: '<path d="M9 21h6"/><path d="M9 17.5h6"/><path d="M12 2a7 7 0 0 1 4.9 11.9l-.1.1c-.4.4-.8 1-1.1 1.5H8.3c-.3-.5-.7-1.1-1.1-1.5l-.1-.1A7 7 0 0 1 12 2z"/>',
  reviews: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  marketing: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  admin: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 3.5a4 4 0 0 1 0 7"/><path d="M20 20c0-3-2-5.5-4-6.5"/>',
};

function NavIcon({ id, active }) {
  return React.createElement('svg', {
    width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0, opacity: active ? 1 : 0.7 },
    dangerouslySetInnerHTML: { __html: NAV_ICONS[id] || '' }
  });
}

const modules = [
  { id: "home", label: "Overview" },
  { id: "quarterly", label: "Quarterly Update" },
  { id: "volunteers", label: "Volunteers" },
  { id: "donors", label: "Donations" },
  { id: "sponsors", label: "Sponsors" },
  { id: "board", label: "Board Voting" },
  { id: "strategy", label: "Strategic Goal Progress" },
  { id: "venue", label: "Venue Rentals" },
  { id: "ideas", label: "Ideas & Initiatives" },
  { id: "operational", label: "Operational Areas", hidden: true },
  { id: "financials", label: "Financials", hidden: true },
  { id: "reviews", label: "Reviews", hidden: true },
  { id: "admin", label: "Admin", hidden: true },
];

const mockData = {
  events: [
    { name: "Spring Garden Tour", date: "Apr 12", status: "Confirmed", revenue: "$1,200", guests: 45 },
    { name: "Founder's Gala", date: "May 3", status: "Pending", revenue: "$4,800", guests: 120 },
    { name: "Julia Morgan Lecture", date: "May 18", status: "Confirmed", revenue: "$600", guests: 30 },
    { name: "Mid-Summer Festival", date: "Jul 11", status: "Planning", revenue: "—", guests: 200 },
    { name: "Board Retreat", date: "Aug 5", status: "Confirmed", revenue: "—", guests: 14 },
  ],
  volunteers: [
    { name: "Margaret H.", role: "Garden Lead", hours: 42, lastShift: "Mar 18", status: "Active" },
    { name: "David K.", role: "Events Support", hours: 28, lastShift: "Mar 15", status: "Active" },
    { name: "Sara L.", role: "Archivist", hours: 35, lastShift: "Mar 10", status: "Active" },
    { name: "James T.", role: "Docent", hours: 19, lastShift: "Feb 28", status: "Inactive" },
    { name: "Priya M.", role: "Social Media", hours: 22, lastShift: "Mar 19", status: "Active" },
  ],
  donors: [
    { name: "Teichert Foundation", type: "Foundation", amount: "$10,000", year: 2025, status: "Received" },
    { name: "Robert & Jean Foote", type: "Individual", amount: "$2,500", year: 2025, status: "Pledged" },
    { name: "PG&E Community Giving", type: "Corporate", amount: "$5,000", year: 2025, status: "In Review" },
    { name: "McConnell Foundation", type: "Foundation", amount: "$7,500", year: 2024, status: "Received" },
    { name: "Anonymous", type: "Individual", amount: "$500", year: 2025, status: "Received" },
  ],
  marketing: [
    { platform: "Instagram", post: "Spring Hedgerow Walk", date: "Apr 5", status: "Scheduled", lead: "Haley" },
    { platform: "Facebook", post: "Volunteer Spotlight — Sara L.", date: "Apr 8", status: "Draft", lead: "Haley" },
    { platform: "Email", post: "April Newsletter", date: "Apr 1", status: "Sent", lead: "Haley" },
    { platform: "Instagram", post: "Mid-Summer Festival Announce", date: "Apr 15", status: "Draft", lead: "Haley" },
    { platform: "TikTok", post: "Julia Morgan Heritage Clip", date: "Apr 20", status: "Ideas", lead: "Haley" },
  ],
  financials: [
    { category: "Event Revenue", budget: "$18,000", actual: "$9,600", pct: 53 },
    { category: "Donations", budget: "$25,000", actual: "$18,000", pct: 72 },
    { category: "Grants", budget: "$30,000", actual: "$17,500", pct: 58 },
    { category: "Operations", budget: "$22,000", actual: "$10,200", pct: 46, expense: true },
    { category: "Programming", budget: "$8,000", actual: "$3,100", pct: 39, expense: true },
  ],
  archival: [
    { id: "NSH-001", name: "Foote Family Portrait, 1908", type: "Photograph", condition: "Good", location: "Storage A" },
    { id: "NSH-002", name: "Original Blueprint — Julia Morgan", type: "Document", condition: "Fragile", location: "Archive Box 3" },
    { id: "NSH-003", name: "Gold Rush Mining Equipment", type: "Artifact", condition: "Fair", location: "Display Case 1" },
    { id: "NSH-004", name: "North Star Mine Letter, 1902", type: "Document", condition: "Good", location: "Archive Box 1" },
    { id: "NSH-005", name: "Pelton Wheel Fragment", type: "Artifact", condition: "Fair", location: "Garden Shed" },
  ],
  board: [
    { member: "Carol W.", role: "Chair", attendance: "100%", lastVote: "Mar 12", status: "Active" },
    { member: "Thomas A.", role: "Treasurer", attendance: "92%", lastVote: "Mar 12", status: "Active" },
    { member: "Diane P.", role: "Secretary", attendance: "85%", lastVote: "Mar 12", status: "Active" },
    { member: "Raj S.", role: "Member", attendance: "78%", lastVote: "Feb 8", status: "Active" },
    { member: "Nina F.", role: "Member", attendance: "60%", lastVote: "Jan 15", status: "Watch" },
  ],
  strategy: [
    { pillar: "Historic Preservation", goal: "Complete 2nd floor feasibility study", progress: 90, owner: "Haley", due: "Q2 2025" },
    { pillar: "Community Programs", goal: "Launch Hedgerow Garden Walk", progress: 75, owner: "Haley", due: "Q2 2025" },
    { pillar: "Revenue Diversification", goal: "Secure 3 new grant sources", progress: 40, owner: "Board", due: "Q3 2025" },
    { pillar: "Volunteer Development", goal: "Grow volunteer base to 50 active", progress: 60, owner: "Haley", due: "Q4 2025" },
    { pillar: "Brand & Communications", goal: "Relaunch NSH website", progress: 55, owner: "Haley", due: "Q3 2025" },
  ],
};const statusColors = {
  Confirmed: { bg: "#e8f5e9", color: "#2e7d32" },
  Pending: { bg: "#fff8e1", color: "#8a6200" },
  Planning: { bg: "#e8eaf6", color: "#3949ab" },
  Active: { bg: "#e8f5e9", color: "#2e7d32" },
  Inactive: { bg: "#f3f3f3", color: "#757575" },
  Received: { bg: "#e8f5e9", color: "#2e7d32" },
  Pledged: { bg: "#e8eaf6", color: "#3949ab" },
  "In Review": { bg: "#fff8e1", color: "#8a6200" },
  Scheduled: { bg: "#e3f2fd", color: "#1565c0" },
  Draft: { bg: "#f3f3f3", color: "#555" },
  Sent: { bg: "#e8f5e9", color: "#2e7d32" },
  Ideas: { bg: "#fce4ec", color: "#880e4f" },
  Watch: { bg: "#fff3e0", color: "#e65100" },
  Good: { bg: "#e8f5e9", color: "#2e7d32" },
  Fair: { bg: "#fff8e1", color: "#8a6200" },
  Fragile: { bg: "#fce4ec", color: "#880e4f" },
};

function Badge({ status }) {
  const style = statusColors[status] || { bg: "#f3f3f3", color: "#555" };
  return (
    <span style={{ background: style.bg, color: style.color, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 18px", minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#2a2a2a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#777", marginTop: 2, minHeight: 16 }}>{sub || ''}</div>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ background: "#eee", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color || gold, borderRadius: 4, transition: "width 0.4s" }} />
    </div>
  );
}

function Table({ cols, rows, renderRow }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" }}>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ textAlign: "left", padding: "8px 10px", color: "#999", fontWeight: 500, borderBottom: "0.5px solid #e8e0d4", whiteSpace: "nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "0.5px solid #f0ebe2" }}>
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function Td({ children, muted }) {
  return <td style={{ padding: "9px 10px", color: muted ? "#aaa" : "#2a2a2a", whiteSpace: "nowrap" }}>{children}</td>;
}

const thisWeek = [
  { day: "Mon Mar 23", title: "Volunteer Garden Workday", time: "9:00 AM", type: "Volunteer" },
  { day: "Wed Mar 25", title: "Board Finance Committee", time: "3:00 PM", type: "Board" },
  { day: "Thu Mar 26", title: "Spring Tour Site Walk", time: "11:00 AM", type: "Event" },
  { day: "Sat Mar 28", title: "Community Open House", time: "1:00 PM", type: "Event" },
];

const typeColors = {
  Volunteer: { bg: "#e8f5e9", color: "#2e7d32" },
  Board: { bg: "#e8eaf6", color: "#3949ab" },
  Event: { bg: "#fff8e1", color: "#8a6200" },
};function HomeView({ navigate }) {
  const [donationTotal, setDonationTotal] = useState(null);
  const [activeVols, setActiveVols] = useState(null);
  const [calEvents, setCalEvents] = useState(null);
  const [birthdays, setBirthdays] = useState(null);
  const [ootNotices, setOotNotices] = useState(null);
  const [sponsors, setSponsors] = useState(null);
  const [inHouseEvents, setInHouseEvents] = useState([]);
  const [iheForm, setIheForm] = useState({ name: '', date: '', cost: '', link: '' });
  const [iheAdding, setIheAdding] = useState(false);
  const [iheSaving, setIheSaving] = useState(false);
  const [activity, setActivity] = useState(null);
  var isMobile = React.useContext(MobileCtx);
  useEffect(function() {
    cachedSbFetch('Sponsors', ['id','Business Name','Main Contact','Donation','Fair Market Value','Area Supported','Acknowledged','NSH Contact','Notes','sponsor_status']).then(function(rows) {
      if (Array.isArray(rows)) setSponsors(rows.filter(function(r) { return r['sponsor_status'] === 'current'; }));
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events') + '?select=*&order=date.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setInHouseEvents(rows);
    }).catch(function() {});
    fetch(SUPABASE_URL + '/rest/v1/donations?select=amount,date&date=gte.2026-01-01&date=lt.2027-01-01', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (!Array.isArray(rows)) return;
      var total = rows.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
      setDonationTotal(total);
    }).catch(function() {});
    cachedSbFetch('2026 Volunteers', ['Status', 'First Name', 'Last Name', 'Birthday', 'Picture URL']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      setActiveVols(rows.filter(function(r) { return (r['Status'] || '').trim().toLowerCase() === 'active'; }).length);
      var today = new Date(); today.setHours(0,0,0,0);
      var windowEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      var upcoming = rows.filter(function(r) {
        if (!r['Birthday']) return false;
        var parts = r['Birthday'].split('-');
        if (parts.length < 3) return false;
        var mo = parseInt(parts[1]) - 1, dy = parseInt(parts[2]);
        var thisYear = new Date(today.getFullYear(), mo, dy);
        var nextYear = new Date(today.getFullYear() + 1, mo, dy);
        return (thisYear >= today && thisYear <= windowEnd) || (nextYear >= today && nextYear <= windowEnd);
      }).map(function(r) {
        var parts = r['Birthday'].split('-');
        var mo = parseInt(parts[1]) - 1, dy = parseInt(parts[2]);
        var thisYear = new Date(today.getFullYear(), mo, dy);
        var bday = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, mo, dy);
        return Object.assign({}, r, { _bday: bday });
      }).sort(function(a, b) { return a._bday - b._bday; });
      setBirthdays(upcoming);
    });
    (function() {
      var today = new Date(); today.setHours(0,0,0,0);
      var future = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      var todayStr = today.toISOString().slice(0, 10);
      var futureStr = future.toISOString().slice(0, 10);
      fetch(SUPABASE_URL + '/rest/v1/oot_notices?select=*&end_date=gte.' + todayStr + '&start_date=lte.' + futureStr + '&order=start_date.asc', {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (Array.isArray(rows)) setOotNotices(rows);
        else setOotNotices([]);
      }).catch(function() { setOotNotices([]); });
    })();
    fetch(SUPABASE_URL + '/rest/v1/activity_log?select=*&order=created_at.desc&limit=15', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setActivity(Array.isArray(rows) ? rows : []);
    }).catch(function() { setActivity([]); });
    fetchCalendarEvents().then(function(events) {
      var now = new Date();
      var windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      var filtered = events.filter(function(ev) {
        var start = parseIcalDate(ev['DTSTART']);
        return start && start >= now && start <= windowEnd;
      }).sort(function(a, b) {
        return parseIcalDate(a['DTSTART']) - parseIcalDate(b['DTSTART']);
      }).slice(0, 8);
      setCalEvents(filtered);
    }).catch(function() { setCalEvents([]); });
  }, []);
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: "#5c3d1e", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>Today — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span style={{ color: '#777', fontSize: 13 }}>—</span>
          <span style={{ fontSize: 13, color: "#888" }}>Here's your organization at a glance.</span>
        </div>
      </div>

      {(function() {
        var next = nextUpcomingDue();
        var due = next.date;
        var now = new Date(); now.setHours(0,0,0,0);
        var days = Math.round((due - now) / 86400000);
        var dueStr = next.q + ' — ' + due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        var label = days === 0 ? 'Due today' : days + ' days away';
        var labelColor = '#c0392b';
        var labelBg = '#fce4e4';
        return (
          <div onClick={function() { navigate('quarterly'); }} style={{ background: "#fce4e4", border: "0.5px solid #e8a0a0", borderRadius: 6, padding: "7px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#f8d7d7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = '#fce4e4'; }}>
            <div style={{ fontSize: 14, color: '#c0392b' }}>⚠</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#c0392b", fontStyle: 'italic' }}>Quarterly Update Due — {dueStr}</div>
            <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: '#c0392b', flexShrink: 0 }}>{label} →</div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <div onClick={function() { navigate('donors'); }} style={{ cursor: 'pointer' }}><StatCard label="Donations" value={donationTotal === null ? '...' : '$' + donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></div>
        <div onClick={function() { navigate('volunteers'); }} style={{ cursor: 'pointer' }}><StatCard label="Active Volunteers" value={activeVols === null ? '...' : activeVols} /></div>
<div onClick={function() { navigate('sponsors'); }} style={{ cursor: 'pointer' }}><StatCard label="Sponsors" value={sponsors === null ? '...' : sponsors.length} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Happening This Week at North Star House
          </div>
          {calEvents === null && <div style={{ fontSize: 12, color: "#777" }}>Loading…</div>}
          {calEvents !== null && calEvents.length === 0 && <div style={{ fontSize: 12, color: "#777" }}>No upcoming events in the next 2 weeks.</div>}
          {calEvents !== null && calEvents.map(function(ev, i) {
            var start = parseIcalDate(ev['DTSTART']);
            var isAllDay = ev['DTSTART'] && ev['DTSTART'].replace(/[^0-9TZ]/g,'').length === 8;
            var dayStr = start ? start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            var todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var isToday = start && dayStr === todayStr;
            var end = ev['DTEND'] ? parseIcalDate(ev['DTEND']) : null;
            if (!end && ev['DURATION']) {
              var dur = ev['DURATION'];
              var durMs = 0;
              var wk = dur.match(/(\d+)W/); if (wk) durMs += parseInt(wk[1]) * 7 * 86400000;
              var dy = dur.match(/(\d+)D/); if (dy) durMs += parseInt(dy[1]) * 86400000;
              var hr = dur.match(/(\d+)H/); if (hr) durMs += parseInt(hr[1]) * 3600000;
              var mn = dur.match(/(\d+)M/); if (mn) durMs += parseInt(mn[1]) * 60000;
              if (durMs > 0 && start) end = new Date(start.getTime() + durMs);
            }
            var fmt = function(d) { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
            var timeStr = isAllDay ? 'All day'
              : end && end > start ? fmt(start) + ' – ' + fmt(end)
              : fmt(start);
            var title = (ev['SUMMARY'] || 'Untitled').replace(/\\,/g, ',').replace(/\\n/g, ' ');
            var tl = title.toLowerCase();
            var isDocent = /docent/.test(tl);
            var isEstate = !isDocent && /estate|walk.?thr|sierra|\(j\)|tour/.test(tl);
            var isWedding = /wedding/.test(tl);
            var isCommittee = /committee/.test(tl);
            var isMeeting = /meeting/.test(tl);
            var isCreative = /creative|class/.test(tl);
            var isEvent = /event|party/.test(tl);
            var isGoals = /goal/.test(tl);
            var dotColor = isDocent ? '#2e7d32' : isEstate ? '#c2185b' : isWedding ? '#b71c1c' : isCommittee ? '#e65100' : isMeeting ? '#f6c900' : isCreative ? '#00838f' : isEvent ? '#1565c0' : isGoals ? '#f57c00' : gold;
            var label = isDocent ? 'Docent Tour' : isEstate ? 'Estate Tour' : isWedding ? 'Wedding' : isCommittee ? 'Committee' : isMeeting ? 'Meeting' : isCreative ? 'Creative' : isEvent ? 'Event' : isGoals ? 'Goals' : 'Other';
            var labelBg = isDocent ? '#e8f5e9' : isEstate ? '#fce4ec' : isWedding ? '#ffebee' : isCommittee ? '#fff3e0' : isMeeting ? '#fff9c4' : isCreative ? '#e0f7fa' : isEvent ? '#e3f2fd' : isGoals ? '#fff8e1' : '#f0ebe2';
            return (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, background: isToday ? '#fffbf0' : 'transparent', border: isToday ? '0.5px solid #e8d9b0' : 'none', borderRadius: isToday ? 8 : 0, padding: isToday ? '8px 10px' : '2px 0' }}>
                <div style={{ minWidth: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: "#2a2a2a" }}>{title}</span>
                    {isToday && <span style={{ fontSize: 10, fontWeight: 600, color: gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>Today</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{dayStr}{timeStr !== 'All day' ? ' · ' + timeStr : ''}</div>
                </div>
                {label && <span style={{ fontSize: 12, background: labelBg, color: dotColor, borderRadius: 20, fontWeight: 500, flexShrink: 0, width: 90, textAlign: 'center', display: 'inline-block', padding: '2px 0' }}>{label}</span>}
              </div>
            );
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0ebe2", fontSize: 12, color: "#999" }}>
            Synced from Google Calendar
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
            Recent Activity
          </div>
          {activity === null && <div style={{ fontSize: 12, color: '#aaa' }}>Loading…</div>}
          {activity !== null && activity.length === 0 && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No recent activity from the Volunteer Hub.</div>}
          {activity !== null && activity.map(function(a, i) {
            var ts = a.created_at ? new Date(a.created_at) : null;
            var mins = ts ? Math.round((Date.now() - ts.getTime()) / 60000) : null;
            var when = mins === null ? '' : mins < 1 ? 'just now' : mins < 60 ? mins + 'm ago' : mins < 1440 ? Math.round(mins / 60) + 'h ago' : ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={a.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i === activity.length - 1 ? 0 : 10 }}>
                <div style={{ minWidth: 6, height: 6, borderRadius: '50%', background: gold, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#2a2a2a' }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{when}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={function() { navigate('birthdays'); }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Upcoming Birthdays
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>See all →</span>
          </div>
          {birthdays === null && <div style={{ fontSize: 12, color: '#aaa' }}>Loading…</div>}
          {birthdays !== null && birthdays.length === 0 && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No birthdays in the next 30 days.</div>}
          {birthdays !== null && birthdays.map(function(v, i) {
            var isToday = v._bday.toDateString() === new Date().toDateString();
            var dayStr = v._bday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: isToday ? '#fffbf0' : 'transparent', border: isToday ? '0.5px solid #e8d9b0' : 'none', borderRadius: isToday ? 8 : 0, padding: isToday ? '8px 10px' : '2px 0' }}>
                {v['Picture URL'] ? (
                  <img src={driveImg(v['Picture URL'])} alt={v['First Name']} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0ebe2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: gold, flexShrink: 0 }}>
                    {(v['First Name'] || '?')[0]}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v['First Name']} {v['Last Name']}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{dayStr}{isToday ? ' 🎂' : ''}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Out of Town */}
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Out of Town
          </div>
          {ootNotices === null && <div style={{ fontSize: 12, color: '#aaa' }}>Loading…</div>}
          {ootNotices !== null && ootNotices.length === 0 && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No one out of town in the next 60 days.</div>}
          {ootNotices !== null && ootNotices.map(function(entry, i) {
            var today = new Date(); today.setHours(0,0,0,0);
            var start = new Date(entry.start_date + 'T12:00:00');
            var end = new Date(entry.end_date + 'T12:00:00');
            var isActive = start <= today && end >= today;
            var startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            var endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: isActive ? '#fffbf0' : 'transparent', border: isActive ? '0.5px solid #e8d9b0' : 'none', borderRadius: isActive ? 8 : 0, padding: isActive ? '8px 10px' : '2px 0' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0ebe2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: gold, flexShrink: 0 }}>
                  {(entry.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{startStr} – {endStr}{isActive ? ' ✈️' : ''}</div>
                  {entry.notes && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* In-House Events */}
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: gold, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              In-House Events
            </div>
            <button onClick={function() { setIheAdding(true); setIheForm({ name: '', date: '', cost: '' }); }} style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
          </div>

          {iheAdding && (
            <div style={{ background: '#faf8f4', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="Event name" value={iheForm.name} onChange={function(e) { setIheForm(function(f) { return Object.assign({}, f, { name: e.target.value }); }); }}
                  style={{ fontSize: 13, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '6px 10px', outline: 'none' }} />
                <input type="date" value={iheForm.date} onChange={function(e) { setIheForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }}
                  style={{ fontSize: 13, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '6px 10px', outline: 'none' }} />
                <input placeholder="Cost (e.g. 150)" type="number" value={iheForm.cost} onChange={function(e) { setIheForm(function(f) { return Object.assign({}, f, { cost: e.target.value }); }); }}
                  style={{ fontSize: 13, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '6px 10px', outline: 'none' }} />
                <input placeholder="Link (optional)" value={iheForm.link} onChange={function(e) { setIheForm(function(f) { return Object.assign({}, f, { link: e.target.value }); }); }}
                  style={{ fontSize: 13, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '6px 10px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={iheSaving || !iheForm.name || !iheForm.date} onClick={function() {
                    setIheSaving(true);
                    var row = { name: iheForm.name, date: iheForm.date, cost: iheForm.cost ? parseFloat(iheForm.cost) : null, link: iheForm.link || null };
                    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events'), {
                      method: 'POST',
                      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                      body: JSON.stringify(row)
                    }).then(function(r) { return r.json(); }).then(function(res) {
                      console.log('IHE insert response:', JSON.stringify(res));
                      if (res && res.code) { alert('Error: ' + (res.message || res.code)); setIheSaving(false); return; }
                      var created = Array.isArray(res) ? res[0] : res;
                      setInHouseEvents(function(prev) { return prev.concat([created]).sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }); });
                      setIheAdding(false);
                      setIheSaving(false);
                    }).catch(function(err) { console.error('IHE error:', err); setIheSaving(false); });
                  }} style={{ flex: 1, fontSize: 12, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontWeight: 600, opacity: (iheSaving || !iheForm.name || !iheForm.date) ? 0.5 : 1 }}>
                    {iheSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={function() { setIheAdding(false); }} style={{ fontSize: 12, background: '#f0ebe2', color: '#555', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {inHouseEvents.length === 0 && !iheAdding && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No events added yet.</div>}
          {inHouseEvents.map(function(ev, i) {
            var d = ev.date ? new Date(ev.date + 'T00:00:00') : null;
            var dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            var isPast = d && d < new Date();
            return (
              <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, opacity: isPast ? 0.5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ev.link
                    ? <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', textDecoration: 'none' }}>{ev.name} ↗</a>
                    : <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
                  }
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{dateStr}{ev.cost ? ' · $' + Number(ev.cost).toLocaleString() : ''}</div>
                </div>
                <button onClick={function() {
                  fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events') + '?id=eq.' + ev.id, {
                    method: 'DELETE',
                    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
                  }).then(function() {
                    setInHouseEvents(function(prev) { return prev.filter(function(e) { return e.id !== ev.id; }); });
                  });
                }} style={{ fontSize: 11, background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }} title="Remove">✕</button>
              </div>
            );
          })}
        </div>
        </div>

      </div>

    </div>
  );
}function EventsView({ navigate }) {
  var { useState, useEffect, useMemo } = React;
  var [tab, setTab] = useState('pnl');
  var [loading, setLoading] = useState(true);
  var [budgetRows, setBudgetRows] = useState([]);
  var [earningsRows, setEarningsRows] = useState([]);
  var [inHouse, setInHouse] = useState([]);
  var [expanded, setExpanded] = useState(null);
  var todayStr = new Date().toISOString().slice(0, 10);
  var [feedback, setFeedback] = useState([]);
  var [feedbackLoading, setFeedbackLoading] = useState(true);
  var [showAddFeedback, setShowAddFeedback] = useState(false);
  var [feedbackForm, setFeedbackForm] = useState({ event_name: '', source: '', name: '', role: '', feedback: '', date: todayStr });
  var [savingFeedback, setSavingFeedback] = useState(false);
  var [editingFeedbackId, setEditingFeedbackId] = useState(null);
  var [editFeedbackForm, setEditFeedbackForm] = useState(null);
  var [savingFeedbackEdit, setSavingFeedbackEdit] = useState(false);
  var [expandedFeedback, setExpandedFeedback] = useState({});
  var [showAddEarning, setShowAddEarning] = useState(false);
  var [earningForm, setEarningForm] = useState({ event: '', earning_source: '', amount: '', notes: '', date: todayStr });
  var [savingEarning, setSavingEarning] = useState(false);
  var [showAddExpense, setShowAddExpense] = useState(false);
  var [expenseForm, setExpenseForm] = useState({ event_name: '', type: 'Purchase', description: '', amount: '', date: todayStr, purchased_by: '' });
  var [savingExpense, setSavingExpense] = useState(false);
  var [editingEarningId, setEditingEarningId] = useState(null);
  var [editEarningForm, setEditEarningForm] = useState(null);
  var [savingEarningEdit, setSavingEarningEdit] = useState(false);
  var [editingExpenseId, setEditingExpenseId] = useState(null);
  var [editExpenseForm, setEditExpenseForm] = useState(null);
  var [savingExpenseEdit, setSavingExpenseEdit] = useState(false);

  useEffect(function() {
    var hdrs = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?area=eq.Events&select=*', { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?area=eq.Events&select=*', { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events') + '?select=*&order=date.asc', { headers: hdrs }).then(function(r) { return r.json(); })
    ]).then(function(res) {
      setBudgetRows(Array.isArray(res[0]) ? res[0] : []);
      setEarningsRows(Array.isArray(res[1]) ? res[1] : []);
      setInHouse(Array.isArray(res[2]) ? res[2] : []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Event Feedback') + '?select=*&order=date.desc,id.desc', { headers: hdrs }).then(function(r) { return r.json(); }).then(function(rows) {
      setFeedback(Array.isArray(rows) ? rows : []);
      setFeedbackLoading(false);
    }).catch(function() { setFeedbackLoading(false); });
  }, []);

  function fmt(n) { return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  var groups = useMemo(function() {
    var byEvent = {};
    function bucket(name) {
      var key = (name || '').trim() || 'Uncategorized';
      if (!byEvent[key]) byEvent[key] = { event: key, earnings: 0, costs: 0, earningsRows: [], expenseRows: [], date: null, link: null };
      return byEvent[key];
    }
    earningsRows.forEach(function(e) { var b = bucket(e.event); b.earnings += parseFloat(e.amount) || 0; b.earningsRows.push(e); });
    budgetRows.forEach(function(b0) {
      var b = bucket(b0.event_name);
      b.expenseRows.push(b0);
      if (b0.type === 'Purchase' || b0.type === 'In-Kind') b.costs += parseFloat(b0.amount) || 0;
    });
    inHouse.forEach(function(ev) {
      var name = (ev.name || '').trim();
      if (!name) return;
      var match = Object.keys(byEvent).find(function(k) { return k.toLowerCase() === name.toLowerCase(); });
      if (!match) return;
      byEvent[match].date = ev.date || byEvent[match].date;
      byEvent[match].link = ev.link || byEvent[match].link;
    });
    var list = Object.keys(byEvent).map(function(k) { var r = byEvent[k]; return Object.assign({}, r, { net: r.earnings - r.costs }); });
    list.sort(function(a, b) {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return b.net - a.net;
    });
    return list;
  }, [budgetRows, earningsRows, inHouse]);

  var totalEarnings = groups.reduce(function(s, r) { return s + r.earnings; }, 0);
  var totalCosts = groups.reduce(function(s, r) { return s + r.costs; }, 0);
  var eventNameOptions = groups.map(function(g) { return g.event; }).filter(function(n) { return n && n !== 'Uncategorized'; });
  var feedbackSourceOptions = Array.from(new Set(feedback.map(function(f) { return (f.source || '').trim(); }).filter(Boolean))).sort();

  function addEarning(e) {
    e.preventDefault();
    setSavingEarning(true);
    var payload = { area: 'Events', event: earningForm.event, earning_source: earningForm.earning_source || null, amount: parseFloat(earningForm.amount) || 0, notes: earningForm.notes || null, date: earningForm.date || null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setSavingEarning(false);
      if (rows && rows.code) { alert('Add failed: ' + (rows.message || rows.code)); return; }
      clearCache('Op Earnings');
      if (rows && rows[0]) setEarningsRows(function(prev) { return [rows[0]].concat(prev); });
      setEarningForm({ event: '', earning_source: '', amount: '', notes: '', date: todayStr });
      setShowAddEarning(false);
    }).catch(function() { setSavingEarning(false); });
  }

  function addExpense(e) {
    e.preventDefault();
    setSavingExpense(true);
    var payload = { area: 'Events', type: expenseForm.type, description: expenseForm.description, amount: parseFloat(expenseForm.amount) || 0, date: expenseForm.date || null, purchased_by: expenseForm.purchased_by || null, event_name: expenseForm.event_name || null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setSavingExpense(false);
      if (rows && rows.code) { alert('Add failed: ' + (rows.message || rows.hint || rows.code)); return; }
      clearCache('Op Budget');
      if (rows && rows[0]) setBudgetRows(function(prev) { return [rows[0]].concat(prev); });
      setExpenseForm({ event_name: '', type: 'Purchase', description: '', amount: '', date: todayStr, purchased_by: '' });
      setShowAddExpense(false);
    }).catch(function() { setSavingExpense(false); });
  }

  function startEditEarning(e) {
    setEditingEarningId(e.id);
    setEditEarningForm({ event: e.event || '', earning_source: e.earning_source || '', amount: e.amount != null ? String(e.amount) : '', notes: e.notes || '', date: e.date || todayStr });
  }

  function saveEditEarning() {
    if (!editEarningForm) return;
    setSavingEarningEdit(true);
    var patch = { event: editEarningForm.event, earning_source: editEarningForm.earning_source || null, amount: parseFloat(editEarningForm.amount) || 0, notes: editEarningForm.notes || null, date: editEarningForm.date || null };
    var id = editingEarningId;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function(r) {
      if (!r.ok) throw new Error('Failed to save');
      setSavingEarningEdit(false);
      clearCache('Op Earnings');
      setEarningsRows(function(prev) { return prev.map(function(e) { return e.id === id ? Object.assign({}, e, patch) : e; }); });
      setEditingEarningId(null);
      setEditEarningForm(null);
    }).catch(function() { setSavingEarningEdit(false); alert('Failed to save changes'); });
  }

  function deleteEarning(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('Op Earnings');
      setEarningsRows(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
    });
  }

  function startEditExpense(b) {
    setEditingExpenseId(b.id);
    setEditExpenseForm({ event_name: b.event_name || '', type: b.type || 'Purchase', description: b.description || '', amount: b.amount != null ? String(b.amount) : '', date: b.date || todayStr, purchased_by: b.purchased_by || '' });
  }

  function saveEditExpense() {
    if (!editExpenseForm) return;
    setSavingExpenseEdit(true);
    var patch = { event_name: editExpenseForm.event_name || null, type: editExpenseForm.type, description: editExpenseForm.description, amount: parseFloat(editExpenseForm.amount) || 0, date: editExpenseForm.date || null, purchased_by: editExpenseForm.purchased_by || null };
    var id = editingExpenseId;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function(r) {
      if (!r.ok) throw new Error('Failed to save');
      setSavingExpenseEdit(false);
      clearCache('Op Budget');
      setBudgetRows(function(prev) { return prev.map(function(b) { return b.id === id ? Object.assign({}, b, patch) : b; }); });
      setEditingExpenseId(null);
      setEditExpenseForm(null);
    }).catch(function() { setSavingExpenseEdit(false); alert('Failed to save changes'); });
  }

  function deleteExpense(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('Op Budget');
      setBudgetRows(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    });
  }

  function addFeedback(e) {
    e.preventDefault();
    setSavingFeedback(true);
    var payload = { event_name: feedbackForm.event_name || null, source: feedbackForm.source || null, name: feedbackForm.name || null, role: feedbackForm.role || null, feedback: feedbackForm.feedback, date: feedbackForm.date || null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Event Feedback'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setSavingFeedback(false);
      if (rows && rows.code) { alert('Add failed: ' + (rows.message || rows.code)); return; }
      clearCache('Event Feedback');
      if (rows && rows[0]) setFeedback(function(prev) { return [rows[0]].concat(prev); });
      setFeedbackForm({ event_name: '', source: '', name: '', role: '', feedback: '', date: todayStr });
      setShowAddFeedback(false);
    }).catch(function() { setSavingFeedback(false); });
  }

  function startEditFeedback(f) {
    setEditingFeedbackId(f.id);
    setEditFeedbackForm({ event_name: f.event_name || '', source: f.source || '', name: f.name || '', role: f.role || '', feedback: f.feedback || '', date: f.date || todayStr });
  }

  function saveEditFeedback() {
    if (!editFeedbackForm) return;
    setSavingFeedbackEdit(true);
    var patch = { event_name: editFeedbackForm.event_name || null, source: editFeedbackForm.source || null, name: editFeedbackForm.name || null, role: editFeedbackForm.role || null, feedback: editFeedbackForm.feedback, date: editFeedbackForm.date || null };
    var id = editingFeedbackId;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Event Feedback') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function(r) {
      if (!r.ok) throw new Error('Failed to save');
      setSavingFeedbackEdit(false);
      clearCache('Event Feedback');
      setFeedback(function(prev) { return prev.map(function(f) { return f.id === id ? Object.assign({}, f, patch) : f; }); });
      setEditingFeedbackId(null);
      setEditFeedbackForm(null);
    }).catch(function() { setSavingFeedbackEdit(false); alert('Failed to save changes'); });
  }

  function deleteFeedback(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Event Feedback') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('Event Feedback');
      setFeedback(function(prev) { return prev.filter(function(f) { return f.id !== id; }); });
    });
  }

  function toggleFeedback(id) {
    setExpandedFeedback(function(prev) { var n = Object.assign({}, prev); n[id] = !n[id]; return n; });
  }

  var fieldSt = { width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' };
  var fieldLbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' };

  return (
    <div>
      <datalist id="events-hub-event-options">
        {eventNameOptions.map(function(n) { return <option key={n} value={n} />; })}
      </datalist>
      <datalist id="events-hub-feedback-source-options">
        {feedbackSourceOptions.map(function(n) { return <option key={n} value={n} />; })}
      </datalist>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={function() { navigate('admin'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: gold, fontSize: 13, fontWeight: 500, padding: 0 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Events</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Earnings & expenses by event, pulled from the Events operational area</div>
        </div>
        {tab === 'pnl' && (
          <button onClick={function() { setShowAddEarning(function(s) { return !s; }); setShowAddExpense(false); }} style={{ fontSize: 12, background: showAddEarning ? '#f5f0ea' : gold, color: showAddEarning ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}>{showAddEarning ? 'Cancel' : '+ Log Earning'}</button>
        )}
        {tab === 'pnl' && (
          <button onClick={function() { setShowAddExpense(function(s) { return !s; }); setShowAddEarning(false); }} style={{ fontSize: 12, background: showAddExpense ? '#f5f0ea' : gold, color: showAddExpense ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}>{showAddExpense ? 'Cancel' : '+ Log Expense'}</button>
        )}
        {tab === 'feedback' && (
          <button onClick={function() { setShowAddFeedback(function(s) { return !s; }); }} style={{ fontSize: 12, background: showAddFeedback ? '#f5f0ea' : gold, color: showAddFeedback ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}>{showAddFeedback ? 'Cancel' : '+ Add Feedback'}</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '0.5px solid #e8dece' }}>
        <button onClick={function() { setTab('pnl'); }} style={{ background: 'none', border: 'none', borderBottom: tab === 'pnl' ? '2px solid ' + gold : '2px solid transparent', padding: '8px 4px', marginBottom: -1, fontSize: 13, fontWeight: tab === 'pnl' ? 600 : 400, color: tab === 'pnl' ? '#2a2a2a' : '#999', cursor: 'pointer' }}>Profit & Loss</button>
        <button onClick={function() { setTab('feedback'); }} style={{ background: 'none', border: 'none', borderBottom: tab === 'feedback' ? '2px solid ' + gold : '2px solid transparent', padding: '8px 4px', marginBottom: -1, marginLeft: 16, fontSize: 13, fontWeight: tab === 'feedback' ? 600 : 400, color: tab === 'feedback' ? '#2a2a2a' : '#999', cursor: 'pointer' }}>Reviews & Feedback{feedback.length > 0 ? ' (' + feedback.length + ')' : ''}</button>
      </div>

      {tab === 'pnl' && showAddEarning && (
        <form onSubmit={addEarning} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={fieldLbl}>Event</label>
              <input required value={earningForm.event} onChange={function(e) { setEarningForm(function(f) { return Object.assign({}, f, { event: e.target.value }); }); }} list="events-hub-event-options" style={fieldSt} placeholder="e.g. Spring Gala" />
            </div>
            <div>
              <label style={fieldLbl}>Source</label>
              <input value={earningForm.earning_source} onChange={function(e) { setEarningForm(function(f) { return Object.assign({}, f, { earning_source: e.target.value }); }); }} style={fieldSt} placeholder="e.g. Ticket sales" />
            </div>
            <div>
              <label style={fieldLbl}>Amount</label>
              <input required type="number" step="0.01" min="0" value={earningForm.amount} onChange={function(e) { setEarningForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} style={fieldSt} placeholder="0.00" />
            </div>
            <div>
              <label style={fieldLbl}>Date</label>
              <input type="date" value={earningForm.date} onChange={function(e) { setEarningForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={fieldSt} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLbl}>Notes</label>
            <input value={earningForm.notes} onChange={function(e) { setEarningForm(function(f) { return Object.assign({}, f, { notes: e.target.value }); }); }} style={fieldSt} placeholder="Optional notes…" />
          </div>
          <button type="submit" disabled={savingEarning} style={{ fontSize: 12, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, opacity: savingEarning ? 0.5 : 1 }}>{savingEarning ? 'Saving…' : 'Add Earning'}</button>
        </form>
      )}

      {tab === 'pnl' && showAddExpense && (
        <form onSubmit={addExpense} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={fieldLbl}>Event</label>
              <input required value={expenseForm.event_name} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { event_name: e.target.value }); }); }} list="events-hub-event-options" style={fieldSt} placeholder="e.g. Spring Gala" />
            </div>
            <div>
              <label style={fieldLbl}>Type</label>
              <select value={expenseForm.type} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { type: e.target.value }); }); }} style={fieldSt}>
                <option value="Purchase">Purchase</option>
                <option value="In-Kind">In-Kind</option>
              </select>
            </div>
            <div>
              <label style={fieldLbl}>Amount</label>
              <input required type="number" step="0.01" min="0" value={expenseForm.amount} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} style={fieldSt} placeholder="0.00" />
            </div>
            <div>
              <label style={fieldLbl}>Date</label>
              <input type="date" value={expenseForm.date} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={fieldSt} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLbl}>Description</label>
            <input required value={expenseForm.description} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} style={fieldSt} placeholder="What was this for…" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLbl}>Purchased By</label>
            <input value={expenseForm.purchased_by} onChange={function(e) { setExpenseForm(function(f) { return Object.assign({}, f, { purchased_by: e.target.value }); }); }} style={fieldSt} placeholder="Optional" />
          </div>
          <button type="submit" disabled={savingExpense} style={{ fontSize: 12, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, opacity: savingExpense ? 0.5 : 1 }}>{savingExpense ? 'Saving…' : 'Add Expense'}</button>
        </form>
      )}

      {tab === 'pnl' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Earnings" value={fmt(totalEarnings)} />
        <StatCard label="Costs" value={fmt(totalCosts)} />
        <StatCard label="Net" value={fmt(totalEarnings - totalCosts)} />
      </div>
      )}

      {tab === 'pnl' && (loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa', fontSize: 13 }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#ccc', fontSize: 13 }}>No events tracked yet — add earnings or expenses under Operational Areas → Events.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(function(g) {
            var isOpen = expanded === g.event;
            return (
              <div key={g.event} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={function() { setExpanded(isOpen ? null : g.event); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fdfcfb', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{g.event}</div>
                    {g.date && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{new Date(g.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: '#5a8a5a', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{fmt(g.earnings)}</span>
                  <span style={{ fontSize: 12, color: '#c07040', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>-{fmt(g.costs)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: g.net >= 0 ? '#2e7d32' : '#c62828', minWidth: 80, textAlign: 'right' }}>{g.net >= 0 ? '' : '-'}{fmt(Math.abs(g.net))}</span>
                  <span style={{ fontSize: 12, color: '#ccc' }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '4px 16px 14px' }}>
                    {g.link && <a href={g.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: gold, textDecoration: 'none' }}>Event details ↗</a>}
                    {g.earningsRows.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Earnings</div>
                        {g.earningsRows.map(function(e, i) {
                          if (editingEarningId === e.id && editEarningForm) {
                            return (
                              <div key={i} style={{ padding: '8px 0', borderBottom: '0.5px solid #f5f1eb' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                                  <input value={editEarningForm.event} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { event: ev.target.value }); }); }} list="events-hub-event-options" style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Event" />
                                  <input value={editEarningForm.earning_source} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { earning_source: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Source" />
                                  <input type="number" step="0.01" min="0" value={editEarningForm.amount} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { amount: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Amount" />
                                  <input type="date" value={editEarningForm.date} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { date: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                </div>
                                <input value={editEarningForm.notes} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { notes: ev.target.value }); }); }} style={{ width: '100%', padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} placeholder="Notes" />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={saveEditEarning} disabled={savingEarningEdit} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: savingEarningEdit ? 0.6 : 1 }}>{savingEarningEdit ? 'Saving…' : 'Save'}</button>
                                  <button onClick={function() { setEditingEarningId(null); setEditEarningForm(null); }} disabled={savingEarningEdit} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: '#666', cursor: 'pointer' }}>Cancel</button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '0.5px solid #f5f1eb' }}>
                              <span style={{ color: '#555' }}>{e.earning_source || 'Earning'}{e.notes ? ' — ' + e.notes : ''}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span style={{ color: '#5a8a5a', fontWeight: 600 }}>{fmt(e.amount)}</span>
                                <button onClick={function() { startEditEarning(e); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={function() { deleteEarning(e.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 13, padding: '0 2px' }}>×</button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {g.expenseRows.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Expenses</div>
                        {g.expenseRows.map(function(b, i) {
                          if (editingExpenseId === b.id && editExpenseForm) {
                            return (
                              <div key={i} style={{ padding: '8px 0', borderBottom: '0.5px solid #f5f1eb' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                                  <input value={editExpenseForm.event_name} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { event_name: ev.target.value }); }); }} list="events-hub-event-options" style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Event" />
                                  <select value={editExpenseForm.type} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { type: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}>
                                    <option value="Purchase">Purchase</option>
                                    <option value="In-Kind">In-Kind</option>
                                  </select>
                                  <input type="number" step="0.01" min="0" value={editExpenseForm.amount} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { amount: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Amount" />
                                  <input type="date" value={editExpenseForm.date} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { date: ev.target.value }); }); }} style={{ padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                </div>
                                <input value={editExpenseForm.description} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { description: ev.target.value }); }); }} style={{ width: '100%', padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} placeholder="Description" />
                                <input value={editExpenseForm.purchased_by} onChange={function(ev) { setEditExpenseForm(function(f) { return Object.assign({}, f, { purchased_by: ev.target.value }); }); }} style={{ width: '100%', padding: '5px 7px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} placeholder="Purchased by" />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={saveEditExpense} disabled={savingExpenseEdit} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: savingExpenseEdit ? 0.6 : 1 }}>{savingExpenseEdit ? 'Saving…' : 'Save'}</button>
                                  <button onClick={function() { setEditingExpenseId(null); setEditExpenseForm(null); }} disabled={savingExpenseEdit} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: '#666', cursor: 'pointer' }}>Cancel</button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '0.5px solid #f5f1eb' }}>
                              <span style={{ color: '#555' }}>{b.description}{b.type ? ' (' + b.type + ')' : ''}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span style={{ color: '#c07040', fontWeight: 600 }}>{fmt(b.amount)}</span>
                                <button onClick={function() { startEditExpense(b); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={function() { deleteExpense(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 13, padding: '0 2px' }}>×</button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {g.earningsRows.length === 0 && g.expenseRows.length === 0 && (
                      <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic', marginTop: 8 }}>No financial entries recorded for this event yet.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'feedback' && showAddFeedback && (
        <form onSubmit={addFeedback} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={fieldLbl}>Event Name</label>
              <select required value={feedbackForm.event_name} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { event_name: e.target.value }); }); }} style={fieldSt}>
                <option value="">Select an event…</option>
                {eventNameOptions.map(function(n) { return <option key={n} value={n}>{n}</option>; })}
              </select>
            </div>
            <div>
              <label style={fieldLbl}>Source</label>
              <input value={feedbackForm.source} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { source: e.target.value }); }); }} list="events-hub-feedback-source-options" style={fieldSt} placeholder="e.g. Google review, comment card…" />
            </div>
            <div>
              <label style={fieldLbl}>Name</label>
              <input value={feedbackForm.name} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { name: e.target.value }); }); }} style={fieldSt} placeholder="Who left this feedback (optional)" />
            </div>
            <div>
              <label style={fieldLbl}>Role</label>
              <input value={feedbackForm.role} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { role: e.target.value }); }); }} style={fieldSt} placeholder="e.g. Guest, Vendor, Volunteer…" />
            </div>
            <div>
              <label style={fieldLbl}>Date</label>
              <input type="date" value={feedbackForm.date} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={fieldSt} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLbl}>Feedback</label>
            <textarea required value={feedbackForm.feedback} onChange={function(e) { setFeedbackForm(function(f) { return Object.assign({}, f, { feedback: e.target.value }); }); }} style={Object.assign({}, fieldSt, { minHeight: 70, resize: 'vertical', fontFamily: 'inherit' })} placeholder="What did they say…" />
          </div>
          <button type="submit" disabled={savingFeedback} style={{ fontSize: 12, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, opacity: savingFeedback ? 0.5 : 1 }}>{savingFeedback ? 'Saving…' : 'Add Feedback'}</button>
        </form>
      )}

      {tab === 'feedback' && (
        feedbackLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#aaa', fontSize: 13 }}>Loading…</div>
        ) : feedback.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#ccc', fontSize: 13 }}>No feedback recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedback.map(function(f) {
              if (editingFeedbackId === f.id && editFeedbackForm) {
                return (
                  <div key={f.id} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <select value={editFeedbackForm.event_name} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { event_name: e.target.value }); }); }} style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}>
                        <option value="">Select an event…</option>
                        {eventNameOptions.map(function(n) { return <option key={n} value={n}>{n}</option>; })}
                      </select>
                      <input value={editFeedbackForm.source} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { source: e.target.value }); }); }} list="events-hub-feedback-source-options" style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Source" />
                      <input value={editFeedbackForm.name} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { name: e.target.value }); }); }} style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Name" />
                      <input value={editFeedbackForm.role} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { role: e.target.value }); }); }} style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Role" />
                      <input type="date" value={editFeedbackForm.date} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { date: e.target.value }); }); }} style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <textarea value={editFeedbackForm.feedback} onChange={function(e) { setEditFeedbackForm(function(ff) { return Object.assign({}, ff, { feedback: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', minHeight: 60, resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={saveEditFeedback} disabled={savingFeedbackEdit} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingFeedbackEdit ? 0.6 : 1 }}>{savingFeedbackEdit ? 'Saving…' : 'Save'}</button>
                      <button onClick={function() { setEditingFeedbackId(null); setEditFeedbackForm(null); }} disabled={savingFeedbackEdit} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                );
              }
              var isFeedbackOpen = !!expandedFeedback[f.id];
              return (
                <div key={f.id} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                    <button onClick={function() { toggleFeedback(f.id); }} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{f.name || 'Anonymous'}{f.role ? ' - ' + f.role : ''}</div>
                        {(f.event_name || f.source) && (
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                            {f.event_name}{f.event_name && f.source ? ' · ' : ''}{f.source}
                          </div>
                        )}
                      </div>
                      {f.date && <span style={{ fontSize: 11, color: '#ccc', flexShrink: 0 }}>{new Date(f.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      <span style={{ fontSize: 12, color: '#ccc', flexShrink: 0 }}>{isFeedbackOpen ? '▲' : '▼'}</span>
                    </button>
                    <button onClick={function() { startEditFeedback(f); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={function() { deleteFeedback(f.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                  {isFeedbackOpen && (
                    <div style={{ padding: '0 16px 14px', fontSize: 13, color: '#555', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.feedback}</div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function driveImg(url) {
  if (!url) return null;
  var i = url.indexOf("/d/");
  if (i === -1) return url;
  var rest = url.substring(i + 3);
  var id = rest.split("/")[0].split("?")[0];
  return "https://drive.google.com/thumbnail?id=" + id + "&sz=w200";
}

function sbInsert(table, row) {
  return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table), {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  }).then(r => r.json());
}

function sbUpdate(table, firstName, lastName, row) {
  var fnKey = encodeURIComponent('"First Name"');
  var lnKey = encodeURIComponent('"Last Name"');
  return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?' + fnKey + '=eq.' + encodeURIComponent(firstName) + '&' + lnKey + '=eq.' + encodeURIComponent(lastName), {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  }).then(r => r.json());
}

function sbPatchById(table, id, row) {
  return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  }).then(r => r.json());
}

var DEFAULT_LIST_COLOR = '#0d6eab';
var TEAM_COLORS = {
  'Grounds':      { bg: '#e8f5e9', color: '#2e7d32' },
  'Construction': { bg: '#fff3e0', color: '#e65100' },
  'Events Team':  { bg: '#e3f2fd', color: '#1565c0' },
  'Events':       { bg: '#e3f2fd', color: '#1565c0' },
  'Event Support':{ bg: '#e8eaf6', color: '#3949ab' },
  'Interiors':    { bg: '#f3e5f5', color: '#6a1b9a' },
  'Fundraising':  { bg: '#fff8e1', color: '#8a6200' },
  'Staff':        { bg: '#f3f3f3', color: '#555' },
  'Board Member': { bg: '#fce4ec', color: '#880e4f' },
  'New':          { bg: '#e0f7fa', color: '#006064' },
  'Docent':       { bg: '#fbe9e7', color: '#8d3d2b' },
  'Docents':      { bg: '#fbe9e7', color: '#8d3d2b' },
  'Volunteer Exchange': { bg: '#e8f4fd', color: '#0d6eab' },
  'Support':      { bg: '#f0f4f8', color: '#3a5068' },
  'Venue':        { bg: '#ede7f6', color: '#4527a0' },
  'Marketing':    { bg: '#fce4ec', color: '#c2185b' },
  'Restoration':  { bg: '#fff3e0', color: '#e65100' },
  'General':      { bg: '#f5f5f5', color: '#555' },
  'Other':        { bg: '#f5f5f5', color: '#777' },
};
function getAreaColor(aoi) {
  if (!aoi) return { bg: '#f5f1eb', color: '#888' };
  if (TEAM_COLORS[aoi]) return TEAM_COLORS[aoi];
  var lower = aoi.toLowerCase();
  var key = Object.keys(TEAM_COLORS).find(function(k) {
    return k.toLowerCase() === lower || lower.indexOf(k.toLowerCase()) === 0 || k.toLowerCase().indexOf(lower) === 0;
  });
  return key ? TEAM_COLORS[key] : { bg: '#f5f1eb', color: '#888' };
}
var TEAM_OPTIONS = Object.keys(TEAM_COLORS).filter(function(k) { return ['Events','Docents','Restoration','General','Other'].indexOf(k) === -1; });

function TeamPicker({ value, onChange, extraTeams }) {
  const { useState: useS } = React;
  const [open, setOpen] = useS(false);
  const [search, setSearch] = useS('');
  const [newTag, setNewTag] = useS('');
  var selected = value ? value.split('|').map(function(t) { return t.trim(); }).filter(Boolean) : [];
  var allOptions = TEAM_OPTIONS.concat((extraTeams || []).filter(function(t) { return TEAM_OPTIONS.indexOf(t) === -1; }));

  function toggle(opt) {
    var next;
    if (selected.indexOf(opt) !== -1) {
      next = selected.filter(function(t) { return t !== opt; });
    } else {
      next = selected.concat([opt]);
    }
    onChange({ target: { name: 'Team', value: next.join(' | ') } });
  }

  function remove(opt) {
    var next = selected.filter(function(t) { return t !== opt; });
    onChange({ target: { name: 'Team', value: next.join(' | ') } });
  }

  function addNewTag() {
    var trimmed = newTag.trim();
    if (!trimmed) return;
    if (selected.indexOf(trimmed) === -1) toggle(trimmed);
    setNewTag('');
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={function() { setOpen(function(o) { return !o; }); }}
        style={{ minHeight: 38, border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}
      >
        {selected.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Select teams...</span>}
        {selected.map(function(t) {
          return (
            <span key={t} style={{ background: (TEAM_COLORS[t] || { bg: '#f3f3f3' }).bg, color: (TEAM_COLORS[t] || { color: '#555' }).color, fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {t}
              <span
                onClick={function(e) { e.stopPropagation(); remove(t); }}
                style={{ cursor: 'pointer', opacity: 0.6, fontSize: 12, lineHeight: 1, marginLeft: 2 }}
              >×</span>
            </span>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4 }}>
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #f0ece6' }}>
            <input
              autoFocus
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              onClick={function(e) { e.stopPropagation(); }}
              placeholder="Search areas..."
              style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
            {allOptions.filter(function(opt) { return opt.toLowerCase().indexOf(search.toLowerCase()) !== -1; }).map(function(opt) {
              var isOn = selected.indexOf(opt) !== -1;
              return (
                <div
                  key={opt}
                  onClick={function() { toggle(opt); }}
                  style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOn ? (TEAM_COLORS[opt] || { bg: '#f3f3f3' }).bg : '#fff', color: isOn ? (TEAM_COLORS[opt] || { color: '#555' }).color : '#2a2a2a' }}
                  onMouseEnter={function(e) { if (!isOn) e.currentTarget.style.background = '#faf8f4'; }}
                  onMouseLeave={function(e) { if (!isOn) e.currentTarget.style.background = '#fff'; }}
                >
                  {opt}
                  {isOn && <span style={{ color: gold, fontSize: 12, fontWeight: 600 }}>✓</span>}
                </div>
              );
            })}
          </div>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
            <input
              value={newTag}
              onChange={function(e) { setNewTag(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addNewTag(); } }}
              placeholder="New area name..."
              style={{ flex: 1, padding: '6px 10px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}
            />
            <button type="button" onClick={function(e) { e.stopPropagation(); addNewTag(); }} disabled={!newTag.trim()} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: newTag.trim() ? 1 : 0.4, flexShrink: 0 }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventTagPicker({ value, onChange, colors, options }) {
  const { useState: useS } = React;
  const [open, setOpen] = useS(false);
  const [search, setSearch] = useS('');
  const [newTag, setNewTag] = useS('');
  var selected = value ? value.split('|').map(function(t) { return t.trim(); }).filter(Boolean) : [];
  var allOptions = (options || []).filter(function(t) { return selected.indexOf(t) === -1; });

  function tagColor(t) { return (colors && colors[t]) || DEFAULT_LIST_COLOR; }

  function toggle(t) {
    var next = selected.indexOf(t) !== -1 ? selected.filter(function(x) { return x !== t; }) : selected.concat([t]);
    onChange({ target: { name: 'Event Tags', value: next.join(' | ') } });
  }

  function remove(t) {
    onChange({ target: { name: 'Event Tags', value: selected.filter(function(x) { return x !== t; }).join(' | ') } });
  }

  function addNewTag() {
    var trimmed = newTag.trim();
    if (!trimmed) return;
    if (selected.indexOf(trimmed) === -1) onChange({ target: { name: 'Event Tags', value: selected.concat([trimmed]).join(' | ') } });
    setNewTag('');
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={function() { setOpen(function(o) { return !o; }); }}
        style={{ minHeight: 38, border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}
      >
        {selected.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Select lists...</span>}
        {selected.map(function(t) {
          var c = tagColor(t);
          return (
            <span key={t} style={{ background: c + '22', color: c, fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {t}
              <span onClick={function(e) { e.stopPropagation(); remove(t); }} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 12, lineHeight: 1, marginLeft: 2 }}>×</span>
            </span>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4 }}>
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #f0ece6' }}>
            <input
              autoFocus
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              onClick={function(e) { e.stopPropagation(); }}
              placeholder="Search lists..."
              style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
            {allOptions.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No other lists yet</div>
            ) : allOptions.filter(function(opt) { return opt.toLowerCase().indexOf(search.toLowerCase()) !== -1; }).map(function(opt) {
              var c = tagColor(opt);
              return (
                <div
                  key={opt}
                  onClick={function() { toggle(opt); }}
                  style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  {opt}
                </div>
              );
            })}
          </div>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
            <input
              value={newTag}
              onChange={function(e) { setNewTag(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addNewTag(); } }}
              placeholder="New list name..."
              style={{ flex: 1, padding: '6px 10px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}
            />
            <button type="button" onClick={function(e) { e.stopPropagation(); addNewTag(); }} disabled={!newTag.trim()} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: newTag.trim() ? 1 : 0.4, flexShrink: 0 }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

var volInputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
var volLabelStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
var volGrp = { marginBottom: 14 };
var volSecLabel = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

var VOL_MONTHS = [['01','January'],['02','February'],['03','March'],['04','April'],['05','May'],['06','June'],['07','July'],['08','August'],['09','September'],['10','October'],['11','November'],['12','December']];

function VolDatePicker({ label, name, value, onChange, noDay }) {
  const { useState: useS } = React;
  function parseVal(v) {
    var parts = (v || '').split('-');
    if (parts.length !== 3) return { mn: '', dy: '', yr: '' };
    return { mn: parts[1] || '', dy: String(parseInt(parts[2]) || ''), yr: parts[0] === '0001' ? '' : parts[0] };
  }
  var [local, setLocal] = useS(function() { return parseVal(value); });
  var mn = local.mn, dy = local.dy, yr = local.yr;
  var currentYear = new Date().getFullYear();

  function notify(month, day, year) {
    setLocal({ mn: month, dy: day, yr: year });
    if (!month || (!year && !noDay)) { onChange({ target: { name: name, value: '' } }); return; }
    var y = String(year || '0001').padStart(4, '0');
    var m = String(month).padStart(2, '0');
    var d = noDay ? '01' : (day ? String(day).padStart(2, '0') : '');
    if (!noDay && !d) { onChange({ target: { name: name, value: '' } }); return; }
    onChange({ target: { name: name, value: y + '-' + m + '-' + d } });
  }

  var daysInMonth = mn ? new Date(2000, parseInt(mn), 0).getDate() : 31;
  var selStyle = Object.assign({}, volInputStyle, { flex: 1, marginTop: 0, padding: '8px 6px' });

  return (
    <div style={volGrp}>
      <label style={volLabelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <select style={Object.assign({}, selStyle, { flex: 3 })} value={mn} onChange={function(e) { notify(e.target.value, dy, yr); }}>
          <option value="">Month</option>
          {VOL_MONTHS.map(function(mo) { return <option key={mo[0]} value={mo[0]}>{mo[1]}</option>; })}
        </select>
        {!noDay && (
          <select style={Object.assign({}, selStyle, { flex: 2 })} value={dy} onChange={function(e) { notify(mn, e.target.value, yr); }}>
            <option value="">Day</option>
            {Array.from({ length: daysInMonth }, function(_, i) { return i + 1; }).map(function(n) { return <option key={n} value={n}>{n}</option>; })}
          </select>
        )}
        <select style={Object.assign({}, selStyle, { flex: 2 })} value={yr} onChange={function(e) { notify(mn, dy, e.target.value); }}>
          <option value="">Year</option>
          {Array.from({ length: currentYear - 1929 }, function(_, i) { return currentYear - i; }).map(function(y) { return <option key={y} value={y}>{y}</option>; })}
        </select>
      </div>
    </div>
  );
}

function VolForm({ form, onChange, saving, onSubmit, title, onCancel, onDelete, extraTeams, listColors, eventTagOptions }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>{title}</div>
          <button type="button" onClick={onCancel} style={{ background: '#f0ece6', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>✕ Close</button>
        </div>
        <form onSubmit={onSubmit}>
          <span style={volSecLabel}>Basic Info</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><label style={volLabelStyle}>First Name *</label><input required name="First Name" value={form['First Name']} onChange={onChange} style={volInputStyle} /></div>
            <div><label style={volLabelStyle}>Last Name *</label><input required name="Last Name" value={form['Last Name']} onChange={onChange} style={volInputStyle} /></div>
          </div>
          <div style={volGrp}><label style={volLabelStyle}>Status</label><select name="Status" value={form['Status']} onChange={onChange} style={volInputStyle}><option value="Active">Active</option><option value="On-Call Supporter">On-Call Supporter</option><option value="Inactive">Inactive</option></select></div>
          <div style={volGrp}><label style={volLabelStyle}>Team</label><div style={{ marginTop: 4 }}><TeamPicker value={form['Team']} onChange={onChange} extraTeams={extraTeams || []} /></div></div>
          <div style={volGrp}><label style={volLabelStyle}>Custom Lists</label><div style={{ marginTop: 4 }}><EventTagPicker value={form['Event Tags']} onChange={onChange} colors={listColors} options={eventTagOptions} /></div></div>
          <span style={volSecLabel}>Contact</span>
          <div style={volGrp}><label style={volLabelStyle}>Email</label><input name="Email" type="email" value={form['Email']} onChange={onChange} style={volInputStyle} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Phone Number</label><input name="Phone Number" value={form['Phone Number']} onChange={onChange} style={volInputStyle} /></div>
          <div style={Object.assign({}, volGrp, { background: '#f7f3ec', borderRadius: 8, padding: '10px 12px' })}>
            <label style={volLabelStyle}>Preferred Contact Method</label>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              {[['phone','Phone'],['email','Email']].map(function(opt) {
                var method = opt[0], lbl = opt[1];
                var val = form['Preferred Contact'] || '';
                var checked = val === method || val === 'both';
                return (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={checked} style={{ accentColor: '#886c44', cursor: 'pointer' }} onChange={function() {
                      var phoneOn = method === 'phone' ? !checked : (val === 'phone' || val === 'both');
                      var emailOn = method === 'email' ? !checked : (val === 'email' || val === 'both');
                      var next = phoneOn && emailOn ? 'both' : phoneOn ? 'phone' : emailOn ? 'email' : '';
                      onChange({ target: { name: 'Preferred Contact', value: next || '' } });
                    }} />
                    <span style={{ color: checked ? '#886c44' : '#333', fontWeight: checked ? 600 : 400 }}>{lbl}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div style={volGrp}><label style={volLabelStyle}>Address</label><input name="Address" value={form['Address']} onChange={onChange} style={volInputStyle} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Emergency Contact</label><input name="Emergency Contact" value={form['Emergency Contact']} onChange={onChange} style={volInputStyle} /></div>
          <span style={volSecLabel}>Volunteer Info</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><VolDatePicker label="Birthday" name="Birthday" value={form['Birthday']} onChange={onChange} noDay={false} /></div>
            <div><VolDatePicker label="Anniversary" name="Volunteer Anniversary" value={form['Volunteer Anniversary']} onChange={onChange} noDay={true} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><label style={volLabelStyle}>Month</label><input name="Month" value={form['Month']} onChange={onChange} style={volInputStyle} /></div>
            <div><label style={volLabelStyle}>Day</label><input name="Day" value={form['Day']} onChange={onChange} style={volInputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="CC" checked={form['CC']} onChange={onChange} /> CC</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Nametag" checked={form['Nametag']} onChange={onChange} /> Nametag</label>
          </div>
          <div style={volGrp}><label style={volLabelStyle}>Picture URL (Google Drive)</label><input name="Picture URL" value={form['Picture URL']} onChange={onChange} style={volInputStyle} placeholder="https://drive.google.com/..." /></div>
          <span style={volSecLabel}>Notes</span>
          <div style={volGrp}><label style={volLabelStyle}>Overview Notes</label><textarea name="Overview Notes" value={form['Overview Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Background Notes</label><textarea name="Background Notes" value={form['Background Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Notes</label><textarea name="Notes" value={form['Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <span style={volSecLabel}>Goals & About</span>
          <div style={volGrp}><label style={volLabelStyle}>What they want to see at NSH</label><textarea name="What they want to see at NSH" value={form['What they want to see at NSH']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Favorite Quote</label><textarea name="Favorite Quote" value={form['Favorite Quote'] || ''} onChange={onChange} rows={2} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>NSH Future Vision</label><textarea name="NSH Future Vision" value={form['NSH Future Vision'] || ''} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Allergies <span style={{ color: '#888', fontWeight: 400 }}>(visible to volunteers)</span></label><textarea name="Allergies" value={form['Allergies'] || ''} onChange={onChange} rows={2} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Special Considerations <span style={{ color: '#888', fontWeight: 400 }}>(private — coordinators only)</span></label><textarea name="Special Considerations" value={form['Special Considerations'] || ''} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            {onDelete && <button type="button" onClick={onDelete} style={{ padding: '10px 14px', background: 'transparent', border: '0.5px solid #e8a0a0', borderRadius: 8, fontSize: 12, color: '#c0392b', cursor: 'pointer', fontWeight: 500 }}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

function VolunteersView() {
  var isMobile = React.useContext(MobileCtx);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('active');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarding, setOnboarding] = useState([]);
  var OB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvOZozfWfzXyS5GyAHDyzQbXf-A8GxNMKTTRh6BGDJCVAAdimGW7MvLdhl0Ab0PuUgmUfm8xpZRUyP/pub?gid=544068320&single=true&output=csv';
  var HOUR_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [hoursData, setHoursData] = React.useState({});
  const [listColors, setListColors] = useState({});

  function buildHoursMapFromLogs(logs) {
    var byName = {};
    logs.forEach(function(log) {
      var name = (log.name || '').trim();
      if (!name) return;
      if (!byName[name]) byName[name] = [];
      byName[name].push(log);
    });
    var result = {};
    Object.keys(byName).forEach(function(name) {
      var nameLogs = byName[name];
      var key = name.toLowerCase();
      var months = {};
      var total = 0;
      for (var i = 0; i < nameLogs.length; i++) {
        if (nameLogs[i].action !== 'check-in') continue;
        var checkOut = null;
        for (var j = i + 1; j < nameLogs.length; j++) {
          if (nameLogs[j].action === 'check-out') { checkOut = nameLogs[j]; break; }
        }
        if (!checkOut) continue;
        var hours = (new Date(checkOut.timestamp) - new Date(nameLogs[i].timestamp)) / 3600000;
        if (hours <= 0 || hours > 24) continue;
        var m = HOUR_MONTHS[new Date(nameLogs[i].timestamp).getMonth()];
        months[m] = (months[m] || 0) + hours;
        total += hours;
      }
      if (!result[key]) { result[key] = { total: total, months: months }; }
      else {
        result[key].total += total;
        HOUR_MONTHS.forEach(function(m) { if (months[m]) result[key].months[m] = (result[key].months[m] || 0) + months[m]; });
      }
    });
    return result;
  }

  function getVolHours(vol) {
    var first = (vol['First Name'] || '').trim().toLowerCase();
    var last = (vol['Last Name'] || '').trim().toLowerCase();
    var full = (first + ' ' + last).trim();
    var merged = { total: 0, months: {} };
    var found = false;
    Object.keys(hoursData).forEach(function(key) {
      if (key === full || key === first || (last && key === last) || (first && key.split(' ')[0] === first && (!last || key.split(' ')[1] === last))) {
        found = true;
        merged.total += hoursData[key].total;
        HOUR_MONTHS.forEach(function(m) { if (hoursData[key].months[m]) merged.months[m] = (merged.months[m] || 0) + hoursData[key].months[m]; });
      }
    });
    return found ? merged : null;
  }
  function parseObCSV(text) {
    var lines = text.split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) return [];
    function splitCSVLine(line) {
      var cols = []; var cur = ''; var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
        else { cur += c; }
      }
      cols.push(cur);
      return cols.map(function(v) { return v.trim(); });
    }
    var headers = splitCSVLine(lines[0]).map(function(h) { return h.toLowerCase().replace(/^"|"$/g, ''); });
    return lines.slice(1).map(function(line) {
      var cols = splitCSVLine(line);
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = (cols[i] || '').replace(/^"|"$/g, '').trim(); });
      return {
        first_name: obj['first name'] || obj['firstname'] || '',
        last_name: obj['last name'] || obj['lastname'] || '',
        area_of_interest: obj['area'] || obj['area of interest'] || '',
        email: obj['email'] || '',
        phone: obj['phone number'] || obj['phone'] || '',
        start_date: obj['date'] || obj['timestamp'] || ''
      };
    }).filter(function(p) { return p.first_name; });
  }
  const today = new Date().toISOString().slice(0, 10);
  var OB_STAGES = ['Form Submitted', 'Processed by Haley', 'Welcome Email Sent', 'Info Sent to Lead', 'Lead Contact Made', 'First Meeting', 'Paperwork Received', 'Added to Kiosk', '30-Day Check-In', '60-Day Check-In'];
  var OB_TERMINAL = ['Successfully Onboarded', 'No Longer Interested'];
  const [obSaving, setObSaving] = useState(false);
  const [obActing, setObActing] = useState(null);
  const [obSelectedId, setObSelectedId] = useState(null);
  const [obEditId, setObEditId] = useState(null);
  const [obEditForm, setObEditForm] = useState({});
  const [obEditSaving, setObEditSaving] = useState(false);

  var emptyForm = {
    'First Name': '', 'Last Name': '', 'Team': '', 'Event Tags': '', 'Status': 'Active',
    'Email': '', 'Phone Number': '', 'Address': '', 'Birthday': '',
    'Volunteer Anniversary': '', 'CC': false, 'Nametag': false,
    'Overview Notes': '', 'Background Notes': '', 'Notes': '',
    'Preferred Contact': '', 'What they want to see at NSH': '', 'Favorite Quote': '', 'NSH Future Vision': '', 'Allergies': '', 'Special Considerations': '',
    'Picture URL': '', 'Emergency Contact': '', 'Month': '', 'Day': ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(function() {
    cachedSbFetch('2026 Volunteers', ['id','First Name','Last Name','Team','Event Tags','Status','Email','Phone Number','Address','Birthday','Volunteer Anniversary','CC','Nametag','Overview Notes','Background Notes','Notes','What they want to see at NSH','NSH Future Vision','Allergies','Special Considerations','Picture URL','Emergency Contact','Month','Day'])
      .then(function(data) {
        if (Array.isArray(data)) setVolunteers(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('List Tag Colors') + '?select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (!Array.isArray(rows)) return;
      var map = {};
      rows.forEach(function(r) { map[r.tag] = r.color; });
      setListColors(map);
    }).catch(function() {});
    var cachedHours = lsGet('hours_summary_sb');
    if (cachedHours) { setHoursData(cachedHours); }
    (function() {
      var year = new Date().getFullYear();
      fetch(SUPABASE_URL + '/rest/v1/kiosk_logs?type=eq.volunteer&timestamp=gte.' + year + '-01-01T00:00:00.000Z&timestamp=lt.' + (year + 1) + '-01-01T00:00:00.000Z&order=name.asc,timestamp.asc&select=timestamp,name,action', {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      }).then(function(r) { return r.json(); }).then(function(logs) {
        if (!Array.isArray(logs)) return;
        var parsed = buildHoursMapFromLogs(logs);
        setHoursData(parsed);
        lsSet('hours_summary_sb', parsed);
      }).catch(function() {});
    })();

    Promise.all([
      fetch(OB_SHEET_URL).then(function(r) { return r.text(); }).catch(function() { return ''; }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding') + '?select=*', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }).then(function(r) { return r.json(); }).catch(function() { return []; })
    ]).then(function(results) {
      var sheetPeople = parseObCSV(results[0]);
      var sbRows = Array.isArray(results[1]) ? results[1] : [];
      var stageMap = {};
      sbRows.forEach(function(r) { if (r.email) stageMap[r.email.toLowerCase()] = r; });
      var merged = sheetPeople.map(function(p, i) {
        var sb = p.email ? stageMap[p.email.toLowerCase()] : null;
        var sd = (sb && sb.stage_dates) ? Object.assign({}, sb.stage_dates) : {};
        if (!sd['Form Submitted'] && p.start_date) sd['Form Submitted'] = p.start_date;
        return { _sbId: sb ? sb.id : null, id: sb ? sb.id : ('sheet-' + i), first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone, area_of_interest: p.area_of_interest, start_date: p.start_date, pipeline_stage: sb ? (sb.pipeline_stage || 'Form Submitted') : 'Form Submitted', status: sb ? (sb.status || 'In Progress') : 'In Progress', stage_dates: sd, survey_sent: sb ? !!sb.survey_sent : false, notes: sb ? (sb.notes || '') : '', address: sb ? (sb.address || '') : '', birthday: sb ? (sb.birthday || '') : '', emergency_contact: sb ? (sb.emergency_contact || '') : '', team: sb ? (sb.team || '') : '' };
      });
      setOnboarding(merged);
    });
  }, []);

  function addObEntry(e) {
    e.preventDefault();
    setObSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ first_name: obForm.first_name, last_name: obForm.last_name || null, email: obForm.email || null, phone: obForm.phone || null, area_of_interest: obForm.area_of_interest || null, start_date: obForm.start_date || null, notes: obForm.notes || null, pipeline_stage: 'New Inquiry', status: 'In Progress' })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows.code) { setObSaving(false); alert('Failed: ' + (rows.message || rows.code)); return; }
      setObSaving(false);
      if (rows && rows[0]) setOnboarding(function(p) { return p.concat([rows[0]]); });
      setObForm(emptyOBForm);
      setShowAddOb(false);
    });
  }

  function obSetStage(ob, stage) {
    setObActing(ob.id);
    var stageToday = new Date().toISOString().slice(0, 10);
    var newStageDates = Object.assign({}, ob.stage_dates || {});
    newStageDates[stage] = stageToday;
    var patch = { pipeline_stage: stage, stage_dates: newStageDates };
    if (stage === 'Successfully Onboarded') patch.status = 'Complete';
    else if (stage === 'No Longer Interested') patch.status = "Didn't Stick";
    var req;
    if (ob._sbId) {
      req = fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding') + '?id=eq.' + ob._sbId, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      }).then(function() { return { sbId: ob._sbId }; });
    } else {
      req = fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(Object.assign({ first_name: ob.first_name, last_name: ob.last_name || null, email: ob.email || null, phone: ob.phone || null, area_of_interest: ob.area_of_interest || null, start_date: ob.start_date || null, status: patch.status || 'In Progress' }, patch))
      }).then(function(r) { return r.json(); }).then(function(rows) { return { sbId: rows && rows[0] ? rows[0].id : null }; });
    }
    req.then(function(result) {
      if (stage === 'Successfully Onboarded') {
        var volPayload = { 'First Name': ob.first_name, 'Last Name': ob.last_name || '', 'Status': 'Active', 'Email': ob.email || '', 'Phone Number': ob.phone || '', 'Address': ob.address || '', 'Birthday': ob.birthday || '', 'Emergency Contact': ob.emergency_contact || '', 'Team': ob.team || ob.area_of_interest || '', 'Notes': ob.notes || '' };
        fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Volunteers'), {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(volPayload)
        }).then(function(r) { return r.json(); }).then(function(rows) {
          clearCache('2026 Volunteers');
          if (rows && rows[0]) setVolunteers(function(p) { return p.concat([rows[0]]); });
        });
      }
      setOnboarding(function(p) { return p.map(function(o) { return o.id === ob.id ? Object.assign({}, o, patch, { _sbId: result.sbId || o._sbId, id: result.sbId || o.id }) : o; }); });
      setObActing(null);
      setObSelectedId(null);
    });
  }

  function toggleSurvey(ob) {
    var newVal = !ob.survey_sent;
    if (!ob._sbId) return;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding') + '?id=eq.' + ob._sbId, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_sent: newVal })
    });
    setOnboarding(function(p) { return p.map(function(o) { return o.id === ob.id ? Object.assign({}, o, { survey_sent: newVal }) : o; }); });
  }

  function openObEdit(ob) {
    setObEditId(ob.id);
    setObEditForm({ first_name: ob.first_name || '', last_name: ob.last_name || '', email: ob.email || '', phone: ob.phone || '', area_of_interest: ob.area_of_interest || '', address: ob.address || '', birthday: ob.birthday || '', emergency_contact: ob.emergency_contact || '', notes: ob.notes || '', team: ob.team || '' });
  }

  function saveObEdit() {
    var ob = onboarding.find(function(o) { return o.id === obEditId; });
    if (!ob) return;
    setObEditSaving(true);
    var patch = { first_name: obEditForm.first_name, last_name: obEditForm.last_name, email: obEditForm.email || null, phone: obEditForm.phone || null, area_of_interest: obEditForm.area_of_interest || null, address: obEditForm.address || null, birthday: obEditForm.birthday || null, emergency_contact: obEditForm.emergency_contact || null, notes: obEditForm.notes || null, team: obEditForm.team || null };
    if (ob._sbId) {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding') + '?id=eq.' + ob._sbId, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      }).then(function() {
        setOnboarding(function(p) { return p.map(function(o) { return o.id === obEditId ? Object.assign({}, o, patch) : o; }); });
        setObEditId(null); setObEditSaving(false);
      }).catch(function() { setObEditSaving(false); });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Vol Onboarding'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(Object.assign({}, patch, { pipeline_stage: ob.pipeline_stage || 'Form Submitted', status: ob.status || 'In Progress' }))
      }).then(function(r) { return r.json(); }).then(function(rows) {
        var newId = rows && rows[0] ? rows[0].id : null;
        setOnboarding(function(p) { return p.map(function(o) { return o.id === obEditId ? Object.assign({}, o, patch, newId ? { _sbId: newId, id: newId } : {}) : o; }); });
        setObEditId(null); setObEditSaving(false);
      }).catch(function() { setObEditSaving(false); });
    }
  }

  var active = volunteers.filter(function(v) { return v['Status'] === 'Active'; }).length;
  var inactive = volunteers.filter(function(v) { return v['Status'] === 'Inactive'; }).length;
  var oncall = volunteers.filter(function(v) { return v['Status'] === 'On-Call Supporter'; }).length;
  var tabList = volunteers.filter(function(v) {
    if (tab === 'active') return v['Status'] === 'Active';
    if (tab === 'oncall') return v['Status'] === 'On-Call Supporter';
    return v['Status'] === 'Inactive';
  });
  var customTeams = [];
  volunteers.forEach(function(v) {
    (v['Team'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).forEach(function(t) {
      if (TEAM_OPTIONS.indexOf(t) === -1 && customTeams.indexOf(t) === -1) customTeams.push(t);
    });
  });
  var allEventTags = [];
  volunteers.forEach(function(v) {
    (v['Event Tags'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).forEach(function(t) {
      if (allEventTags.indexOf(t) === -1) allEventTags.push(t);
    });
  });
  allEventTags.sort();
  var allTeamOptions = TEAM_OPTIONS.concat(customTeams);
  var teamSet = ['All'].concat(allTeamOptions.filter(function(t) {
    return tabList.some(function(v) { return (v['Team'] || '').split('|').map(function(x) { return x.trim(); }).indexOf(t) !== -1; });
  }));
  var teams = teamSet.length - 1;
  function teamSortKey(v) {
    if (v['First Name'] === 'Ken' && v['Last Name'] === 'Underwood') return '0';
    var t = (v['Team'] || '').split('|')[0].trim();
    if (t === 'Board Member') return '1';
    if (t === 'Staff') {
      if (v['First Name'] === 'Haley' && v['Last Name'] === 'Wright') return '20';
      if (v['First Name'] === 'Jen') return '21';
      return '22_' + (v['Last Name'] || '');
    }
    return '3_' + t;
  }
  var filtered = filterTeam === 'All'
    ? tabList.slice().sort(function(a, b) { return teamSortKey(a).localeCompare(teamSortKey(b)); })
    : tabList.filter(function(v) {
        return (v['Team'] || '').split('|').map(function(x) { return x.trim(); }).indexOf(filterTeam) !== -1;
      });
  if (searchQuery.trim()) {
    var sq = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(function(v) {
      var name = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).toLowerCase();
      return name.includes(sq) || (v['Email'] || '').toLowerCase().includes(sq) || (v['Phone Number'] || '').toLowerCase().includes(sq) || (v['Team'] || '').toLowerCase().includes(sq);
    });
  }

  function fmtBirthday(val) {
    if (!val) return '';
    var d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return val;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  function fmtAnniversary(val) {
    if (!val) return '';
    var d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return val;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function initials(v) {
    return ((v['First Name'] || '')[0] || '').toUpperCase() + ((v['Last Name'] || '')[0] || '').toUpperCase();
  }

  function handleFormChange(e) {
    var key = e.target.name;
    var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; });
  }

  function openEdit(v) {
    setForm({
      'First Name': v['First Name'] || '',
      'Last Name': v['Last Name'] || '',
      'Team': v['Team'] || '',
      'Event Tags': v['Event Tags'] || '',
      'Status': v['Status'] || 'Active',
      'Email': v['Email'] || '',
      'Phone Number': v['Phone Number'] || '',
      'Address': v['Address'] || '',
      'Birthday': v['Birthday'] || '',
      'Volunteer Anniversary': v['Volunteer Anniversary'] || '',
      'CC': String(v['CC']).toUpperCase() === 'TRUE',
      'Nametag': String(v['Nametag']).toUpperCase() === 'TRUE',
      'Overview Notes': v['Overview Notes'] || '',
      'Background Notes': v['Background Notes'] || '',
      'Notes': v['Notes'] || '',
      'What they want to see at NSH': v['What they want to see at NSH'] || '',
      'Preferred Contact': v['Preferred Contact'] || '',
      'Favorite Quote': v['Favorite Quote'] || '',
      'NSH Future Vision': v['NSH Future Vision'] || '',
      'Allergies': v['Allergies'] || '',
      'Special Considerations': v['Special Considerations'] || '',
      'Picture URL': v['Picture URL'] || '',
      'Emergency Contact': v['Emergency Contact'] || '',
      'Month': v['Month'] || '',
      'Day': v['Day'] || ''
    });
    setEditing(true);
  }

  function handleAddSubmit(e) {
    e.preventDefault();
    setSaving(true);
    var row = {};
    Object.keys(form).forEach(function(k) {
      if (form[k] !== '' && form[k] !== false) row[k] = form[k] === true ? 'TRUE' : form[k];
    });
    if (!form['CC']) row['CC'] = 'FALSE';
    if (!form['Nametag']) row['Nametag'] = 'FALSE';
    sbInsert('2026 Volunteers', row).then(function(res) {
      setSaving(false);
      clearCache('2026 Volunteers');
      var inserted = Array.isArray(res) ? res[0] : res;
      if (inserted && inserted['First Name']) setVolunteers(function(p) { return p.concat([inserted]); });
      setShowAdd(false);
      setForm(emptyForm);
    }).catch(function() { setSaving(false); });
  }

  function handleDeleteVolunteer() {
    if (!selected) return;
    if (!window.confirm('Delete ' + selected['First Name'] + ' ' + selected['Last Name'] + '? This cannot be undone.')) return;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?id=eq.' + selected.id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('2026 Volunteers');
      setVolunteers(function(prev) { return prev.filter(function(v) { return v.id !== selected.id; }); });
      setSelected(null);
      setEditing(false);
    });
  }

  function handleEditSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    var row = {};
    Object.keys(form).forEach(function(k) {
      if (form[k] !== '') row[k] = form[k] === true ? 'TRUE' : form[k] === false ? 'FALSE' : form[k];
    });
    sbUpdate('2026 Volunteers', selected['First Name'], selected['Last Name'], row)
      .then(function(res) {
        setSaving(false);
        if (res && res.code) { alert('Save failed: ' + (res.message || JSON.stringify(res))); return; }
        clearCache('2026 Volunteers');
        var updated = Array.isArray(res) ? res[0] : res;
        var merged = Object.assign({}, selected, row, updated || {});
        setVolunteers(function(prev) { return prev.map(function(v) { return v['First Name'] === selected['First Name'] && v['Last Name'] === selected['Last Name'] ? merged : v; }); });
        setSelected(merged);
        setEditing(false);
      })
      .catch(function(err) { setSaving(false); alert('Save error: ' + err.message); });
  }

  function InfoRow({ label, value, link, preferred }) {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 110, fontSize: 12, color: '#777', flexShrink: 0, paddingTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          {label}
          {preferred && <span style={{ fontSize: 10, fontWeight: 600, color: gold, background: '#f0ebe2', padding: '1px 6px', borderRadius: 10 }}>preferred</span>}
        </div>
        <div style={{ fontSize: 12, color: '#2a2a2a', flex: 1, lineHeight: 1.4 }}>
          {link ? <a href={link} style={{ color: gold, textDecoration: 'none' }}>{value}</a> : value}
        </div>
      </div>
    );
  }

  function NoteBlock({ label, value }) {
    if (!value) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        {label && <div style={{ fontSize: 12, color: '#888', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>}
        <div style={{ fontSize: 12, color: '#444', lineHeight: 1.65, background: '#faf8f4', borderRadius: 8, padding: '10px 14px' }}>{value}</div>
      </div>
    );
  }

  return (
    <div>
      {!showOnboarding && (
      <React.Fragment>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Volunteers" value={loading ? '...' : volunteers.length} />
        <StatCard label="Active" value={loading ? '...' : active} />
        <div onClick={function() { setShowOnboarding(true); }} style={{ cursor: 'pointer' }} onMouseEnter={function(e) { e.currentTarget.style.opacity='0.85'; }} onMouseLeave={function(e) { e.currentTarget.style.opacity='1'; }}>
          <StatCard label="Onboarding" value={onboarding.filter(function(o) { return o.status === 'In Progress'; }).length} />
        </div>
        <StatCard label="Teams" value={loading ? '...' : teams} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, background: '#f0ebe3', borderRadius: 10, padding: 3 }}>
          <button
            onClick={function() { setTab('active'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 12, fontWeight: tab === 'active' ? 600 : 400, cursor: 'pointer', background: tab === 'active' ? '#fff' : 'transparent', color: tab === 'active' ? '#2a2a2a' : '#999', boxShadow: tab === 'active' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >Active <span style={{ fontSize: 12, color: tab === 'active' ? gold : '#bbb', fontWeight: 500 }}>{active}</span></button>
          <button
            onClick={function() { setTab('oncall'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: tab === 'oncall' ? 600 : 400, cursor: 'pointer', background: tab === 'oncall' ? '#fff' : 'transparent', color: tab === 'oncall' ? '#2a2a2a' : '#999', boxShadow: tab === 'oncall' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >On-Call <span style={{ fontSize: 12, color: tab === 'oncall' ? gold : '#bbb', fontWeight: 500 }}>{oncall}</span></button>
          <button
            onClick={function() { setTab('inactive'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 12, fontWeight: tab === 'inactive' ? 600 : 400, cursor: 'pointer', background: tab === 'inactive' ? '#fff' : 'transparent', color: tab === 'inactive' ? '#2a2a2a' : '#999', boxShadow: tab === 'inactive' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >Inactive <span style={{ fontSize: 12, color: tab === 'inactive' ? gold : '#bbb', fontWeight: 500 }}>{inactive}</span></button>
        </div>
        <button onClick={function() { setForm(emptyForm); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add Volunteer</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 12, pointerEvents: 'none' }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={function(e) { setSearchQuery(e.target.value); }}
          placeholder="Search volunteers by name, email, phone, or team..."
          style={{ width: '100%', padding: '8px 12px 8px 30px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
        />
        {searchQuery && (
          <button onClick={function() { setSearchQuery(''); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', fontSize: 15, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        )}
      </div>

      {!loading && teamSet.length > 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {teamSet.map(function(t) {
            var isActive = filterTeam === t;
            var tc = TEAM_COLORS[t] || { bg: '#f3f3f3', color: '#555' };
            return (
              <button
                key={t}
                onClick={function() { setFilterTeam(t); }}
                style={{
                  border: isActive ? 'none' : '0.5px solid #e0d8cc',
                  borderRadius: 5,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  background: isActive ? tc.bg : '#fff',
                  color: isActive ? tc.color : '#888',
                  transition: 'all 0.15s'
                }}
              >{t}</button>
            );
          })}
        </div>
      )}

      {error && <div style={{ background: '#fce4e4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#c0392b' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#777', fontSize: 12 }}>Loading volunteers...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13, fontStyle: 'italic' }}>No volunteers match your search.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
          {filtered.map(function(v, i) {
            var imgUrl = v['Picture URL'] ? driveImg(v['Picture URL']) : null;
            return (
              <div key={i} onClick={function() { setSelected(v); }}
                onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(136,108,68,0.15)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
                style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.18s' }}>
                {imgUrl ? (
                  <img src={imgUrl} alt={v['First Name']} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, background: '#eee' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: gold, color: '#fff', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{initials(v)}</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a', marginBottom: 3, lineHeight: 1.3 }}>{v['First Name']} {v['Last Name']}</div>
                {v['Team'] && <div style={{ fontSize: 12, color: '#777', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(v['Team'] || '').split('|')[0].trim()}</div>}
                <Badge status={v['Status'] || 'Active'} />
                {(v['Event Tags'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).length > 0 && (
                  <div style={{ fontSize: 10, color: '#0d6eab', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏷 {(v['Event Tags'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).length}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </React.Fragment>
      )}

      {selected && !editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 18, maxWidth: 620, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.22)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header band */}
            <div style={{ background: 'linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)', padding: '28px 28px 20px', borderBottom: '0.5px solid #e8dece', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {selected['Picture URL'] ? (
                  <img src={driveImg(selected['Picture URL'])} alt={selected['First Name']} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: gold, color: '#fff', fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }}>{initials(selected)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 600, color: '#1e1a16', marginBottom: 3, lineHeight: 1.2 }}>{selected['First Name']} {selected['Last Name']}</div>
                  {selected['Team'] && <div style={{ fontSize: 12, color: '#9a7f5a', marginBottom: 6, fontWeight: 500 }}>{selected['Team']}</div>}
                  <Badge status={selected['Status'] || 'Active'} />
                  {selected['Overview Notes'] && <div style={{ fontSize: 12, color: '#7a6a55', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>{selected['Overview Notes']}</div>}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
                <button onClick={function() { openEdit(selected); }} style={{ background: '#fff', border: '0.5px solid #ddd4c4', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: '#7a6a55', cursor: 'pointer', fontWeight: 500 }}>Edit</button>
                <button onClick={function() { setSelected(null); }} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#666', lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px 24px', overflowY: 'auto' }}>
              {(selected['Email'] || selected['Phone Number'] || selected['Address'] || selected['Emergency Contact']) && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Contact</span>
                  <InfoRow label="Email" value={selected['Email']} link={'mailto:' + selected['Email']} preferred={selected['Preferred Contact'] === 'email' || selected['Preferred Contact'] === 'both'} />
                  <InfoRow label="Phone" value={selected['Phone Number']} preferred={selected['Preferred Contact'] === 'phone' || selected['Preferred Contact'] === 'both'} />
                  <InfoRow label="Address" value={selected['Address']} />
                  <InfoRow label="Emergency" value={selected['Emergency Contact']} />
                </div>
              )}
              {(selected['Volunteer Anniversary'] || selected['Birthday']) && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Volunteer Info</span>
                  <InfoRow label="Anniversary" value={fmtAnniversary(selected['Volunteer Anniversary'])} />
                  <InfoRow label="Birthday" value={fmtBirthday(selected['Birthday'])} />
                </div>
              )}
              {(selected['Background Notes'] || selected['Notes']) && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Notes</span>
                  <NoteBlock label="Background" value={selected['Background Notes']} />
                  <NoteBlock label="Additional" value={selected['Notes']} />
                </div>
              )}
              {(selected['What they want to see at NSH'] || selected['Favorite Quote'] || selected['NSH Future Vision'] || selected['Allergies'] || selected['Special Considerations']) && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Goals & About</span>
                  {selected['What they want to see at NSH'] && <NoteBlock label="What they want to see at NSH" value={selected['What they want to see at NSH']} />}
                  {selected['Favorite Quote'] && <NoteBlock label="Favorite Quote" value={selected['Favorite Quote']} />}
                  {selected['NSH Future Vision'] && <NoteBlock label="NSH Future Vision" value={selected['NSH Future Vision']} />}
                  {selected['Allergies'] && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: '#c0392b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>⚠ Allergies</div><div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{selected['Allergies']}</div></div>}
                  {selected['Special Considerations'] && <div style={{ background: '#fafafa', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '8px 12px' }}><div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>🔒 Special Considerations</div><div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{selected['Special Considerations']}</div></div>}
                </div>
              )}
              {(selected['Event Tags'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Custom Lists</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(selected['Event Tags'] || '').split('|').map(function(t) { return t.trim(); }).filter(Boolean).map(function(t) {
                      var c = listColors[t] || DEFAULT_LIST_COLOR;
                      return <span key={t} style={{ background: c + '22', color: c, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{t}</span>;
                    })}
                  </div>
                </div>
              )}
              {(function() {
                var data = getVolHours(selected);
                if (!data || data.total === 0) return (
                  <div style={{ marginBottom: 4 }}>
                    <span style={volSecLabel}>Volunteer Hours</span>
                    <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No hours recorded</div>
                  </div>
                );
                var activeMonths = HOUR_MONTHS.filter(function(m) { return data.months[m] > 0; }).reverse();
                var yr = new Date().getFullYear();
                return (
                  <div style={{ marginBottom: 4 }}>
                    <span style={volSecLabel}>Volunteer Hours</span>
                    <div style={{ fontSize: 15, fontWeight: 700, color: gold, marginBottom: 10 }}>{data.total.toFixed(1)} hrs total</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {activeMonths.map(function(m) {
                        return (
                          <div key={m} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', padding: '5px 0', borderBottom: '0.5px solid #f5f0ea' }}>
                            <span>{m} {yr}</span>
                            <span style={{ fontWeight: 600, color: '#2a2a2a' }}>{data.months[m].toFixed(1)} hrs</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <button onClick={function() { setSelected(null); }} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'transparent', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#999', fontWeight: 500 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selected && editing && (
        <VolForm
          form={form}
          onChange={handleFormChange}
          saving={saving}
          title={'Edit — ' + selected['First Name'] + ' ' + selected['Last Name']}
          onSubmit={handleEditSubmit}
          onCancel={function() { setEditing(false); }}
          onDelete={handleDeleteVolunteer}
          extraTeams={customTeams}
          listColors={listColors}
          eventTagOptions={allEventTags}
        />
      )}

      {showOnboarding && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={function() { setShowOnboarding(false); setObSelectedId(null); }} style={{ background: 'none', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>← Back</button>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a' }}>Volunteer Onboarding Pipeline</div>
            <div style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>{onboarding.filter(function(o) { return o.status === 'In Progress'; }).length} in pipeline</div>
            {obSelectedId && <button onClick={function() { setObSelectedId(null); }} style={{ marginLeft: 'auto', background: 'none', border: '0.5px solid #e0d8cc', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#888', cursor: 'pointer' }}>Deselect</button>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: 16, alignItems: 'start' }}>

            {/* Left: Person list */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 }}>In Pipeline</div>
              </div>
              {onboarding.filter(function(o) { return o.status === 'In Progress'; }).length === 0
                ? <div style={{ padding: '20px 14px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No one in pipeline</div>
                : onboarding.filter(function(o) { return o.status === 'In Progress'; }).map(function(ob) {
                    var isSel = obSelectedId === ob.id;
                    var tc = getAreaColor(ob.area_of_interest);
                    return (
                      <div key={ob.id} onClick={function() { setObSelectedId(isSel ? null : ob.id); }}
                        style={{ padding: '10px 14px', borderBottom: '0.5px solid #f5f1eb', cursor: 'pointer', background: isSel ? tc.bg : '#fff', borderLeft: '3px solid ' + (isSel ? tc.color : 'transparent'), transition: 'all 0.12s' }}
                        onMouseEnter={function(e) { if (!isSel) e.currentTarget.style.background = '#faf8f5'; }}
                        onMouseLeave={function(e) { if (!isSel) e.currentTarget.style.background = '#fff'; }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{ob.first_name} {ob.last_name}</div>
                        {ob.area_of_interest && (
                          <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.color, border: '0.5px solid ' + tc.color + '44', borderRadius: 10, padding: '1px 7px' }}>{ob.area_of_interest}</span>
                        )}
                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>{ob.pipeline_stage || 'Form Submitted'}</div>
                      </div>
                    );
                  })
              }
            </div>

            {/* Right: Pipeline stages */}
            <div>
              {obSelectedId && (function() {
                var selOb = onboarding.find(function(o) { return o.id === obSelectedId; });
                if (!selOb) return null;
                var tc = getAreaColor(selOb.area_of_interest);
                return (
                  <div style={{ background: tc.bg, border: '0.5px solid ' + tc.color + '66', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>{selOb.first_name} {selOb.last_name}</div>
                    {selOb.area_of_interest && <span style={{ fontSize: 11, background: '#fff', color: tc.color, border: '0.5px solid ' + tc.color + '66', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{selOb.area_of_interest}</span>}
                    {selOb.email && <span style={{ fontSize: 12, color: '#888' }}>{selOb.email}</span>}
                    {selOb.phone && <span style={{ fontSize: 12, color: '#888' }}>{selOb.phone}</span>}
                    <span style={{ fontSize: 11, color: tc.color, fontWeight: 500, marginLeft: 'auto' }}>← click a stage to move</span>
                    <button onClick={function(e) { e.stopPropagation(); openObEdit(selOb); }} style={{ fontSize: 11, background: '#fff', color: tc.color, border: '0.5px solid ' + tc.color + '66', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 500 }}>Edit</button>
                  </div>
                );
              })()}

              <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
                {OB_STAGES.map(function(stage, si) {
                  var peopleHere = onboarding.filter(function(o) { return (o.pipeline_stage || 'Form Submitted') === stage && o.status === 'In Progress'; });
                  var selOb = obSelectedId ? onboarding.find(function(o) { return o.id === obSelectedId; }) : null;
                  var selIsHere = selOb && (selOb.pipeline_stage || 'Form Submitted') === stage;
                  var canMove = selOb && !selIsHere && selOb.status === 'In Progress';
                  var hasAnyone = peopleHere.length > 0;
                  return (
                    <div key={stage} style={{ borderBottom: si < OB_STAGES.length - 1 ? '0.5px solid #f0ebe3' : 'none', background: selIsHere ? '#fef9f0' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: hasAnyone ? gold : '#f0ebe2', color: hasAnyone ? '#fff' : '#ccc', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{si + 1}</div>
                        <div style={{ fontSize: 13, fontWeight: hasAnyone ? 600 : 400, color: hasAnyone ? '#2a2a2a' : '#bbb', flex: 1 }}>{stage}</div>
                        {canMove && (
                          <button onClick={function() { obSetStage(selOb, stage); }} disabled={obActing === selOb.id}
                            style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 500, opacity: obActing === selOb.id ? 0.5 : 1 }}>Move here</button>
                        )}
                      </div>
                      {hasAnyone && (
                        <div style={{ padding: '2px 16px 10px 46px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {peopleHere.map(function(ob) {
                            var isSel = obSelectedId === ob.id;
                            var tc = getAreaColor(ob.area_of_interest);
                            return (
                              <div key={ob.id} onClick={function() { setObSelectedId(isSel ? null : ob.id); }}
                                style={{ display: 'flex', flexDirection: 'column', background: isSel ? tc.color : tc.bg, border: '0.5px solid ' + tc.color + '66', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', transition: 'all 0.12s', minWidth: 90 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? '#fff' : '#2a2a2a' }}>{ob.first_name} {ob.last_name}</span>
                                {ob.area_of_interest && <span style={{ fontSize: 10, color: isSel ? 'rgba(255,255,255,0.85)' : tc.color, fontWeight: 500 }}>{ob.area_of_interest}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Terminal stages */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '0.5px solid #e8e0d5' }}>
                  {[{ stage: 'Successfully Onboarded', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: '✓' }, { stage: 'No Longer Interested', bg: '#fef2f2', color: '#ef4444', border: '#fecaca', icon: '✕' }].map(function(t, ti) {
                    var peopleHere = onboarding.filter(function(o) { return o.pipeline_stage === t.stage; });
                    var selOb = obSelectedId ? onboarding.find(function(o) { return o.id === obSelectedId; }) : null;
                    var canMove = selOb && selOb.pipeline_stage !== t.stage && selOb.status === 'In Progress';
                    return (
                      <div key={t.stage} style={{ background: t.bg, padding: '12px 16px', borderLeft: ti === 1 ? '0.5px solid ' + t.border : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.icon} {t.stage}</div>
                          {canMove && (
                            <button onClick={function() { obSetStage(selOb, t.stage); }} disabled={obActing === selOb.id}
                              style={{ fontSize: 11, background: t.color, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 500 }}>Move</button>
                          )}
                        </div>
                        {peopleHere.length === 0
                          ? <div style={{ fontSize: 11, color: t.color, opacity: 0.4 }}>None yet</div>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{peopleHere.map(function(ob) {
                              var tc = getAreaColor(ob.area_of_interest);
                              return <span key={ob.id} style={{ fontSize: 11, background: '#fff', color: t.color, border: '0.5px solid ' + t.border, borderRadius: 20, padding: '2px 10px', fontWeight: 500 }}>{ob.first_name} {ob.last_name}</span>;
                            })}</div>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Year in Review */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Volunteer Year in Review</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: '#ecfdf5', borderBottom: '0.5px solid #a7f3d0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>✓ Successfully Onboarded</span>
                  <span style={{ fontSize: 11, color: '#059669', opacity: 0.7 }}>{onboarding.filter(function(o) { return o.pipeline_stage === 'Successfully Onboarded'; }).length}</span>
                </div>
                {onboarding.filter(function(o) { return o.pipeline_stage === 'Successfully Onboarded'; }).length === 0
                  ? <div style={{ padding: '20px 16px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>None yet</div>
                  : onboarding.filter(function(o) { return o.pipeline_stage === 'Successfully Onboarded'; }).map(function(ob) {
                      var d = (ob.stage_dates || {})['Successfully Onboarded'];
                      return (
                        <div key={ob.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #f5f1eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{ob.first_name} {ob.last_name}</div>
                            {ob.area_of_interest && <div style={{ fontSize: 11, color: '#888' }}>{ob.area_of_interest}</div>}
                          </div>
                          {d && <div style={{ fontSize: 11, color: '#aaa' }}>{d}</div>}
                        </div>
                      );
                    })
                }
              </div>
              <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: '#fef2f2', borderBottom: '0.5px solid #fecaca', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>✕ No Longer Interested</span>
                  <span style={{ fontSize: 11, color: '#ef4444', opacity: 0.7 }}>{onboarding.filter(function(o) { return o.pipeline_stage === 'No Longer Interested'; }).length}</span>
                </div>
                {onboarding.filter(function(o) { return o.pipeline_stage === 'No Longer Interested'; }).length === 0
                  ? <div style={{ padding: '20px 16px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>None yet</div>
                  : onboarding.filter(function(o) { return o.pipeline_stage === 'No Longer Interested'; }).map(function(ob) {
                      var d = (ob.stage_dates || {})['No Longer Interested'];
                      return (
                        <div key={ob.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #f5f1eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div onClick={function() { toggleSurvey(ob); }} title={ob.survey_sent ? 'Survey sent' : 'Mark survey sent'}
                            style={{ width: 18, height: 18, border: '1.5px solid ' + (ob.survey_sent ? '#059669' : '#d0ccc6'), borderRadius: 4, background: ob.survey_sent ? '#059669' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 11, color: '#fff', fontWeight: 700, transition: 'all 0.15s' }}>
                            {ob.survey_sent ? '✓' : ''}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{ob.first_name} {ob.last_name}</div>
                            {ob.area_of_interest && <div style={{ fontSize: 11, color: '#888' }}>{ob.area_of_interest}</div>}
                          </div>
                          {d && <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{d}</div>}
                        </div>
                      );
                    })
                }
                {onboarding.filter(function(o) { return o.pipeline_stage === 'No Longer Interested'; }).length > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: '0.5px solid #f0ebe3' }}>
                    <span style={{ fontSize: 11, color: '#bbb' }}>Check box when exit survey has been sent</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {obEditId && (function() {
        var ob = onboarding.find(function(o) { return o.id === obEditId; });
        if (!ob) return null;
        var tc = getAreaColor(ob.area_of_interest || obEditForm.area_of_interest);
        var fi = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff', fontFamily: 'system-ui, sans-serif' };
        var lb = { fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 3 };
        var grp = { marginBottom: 12 };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.2)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: tc.bg, borderRadius: '16px 16px 0 0' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a' }}>Edit — {ob.first_name} {ob.last_name}</div>
                  <div style={{ fontSize: 11, color: tc.color, marginTop: 2 }}>Onboarding Record</div>
                </div>
                <button onClick={function() { setObEditId(null); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={grp}><label style={lb}>First Name</label><input value={obEditForm.first_name} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { first_name: e.target.value }); }); }} style={fi} /></div>
                  <div style={grp}><label style={lb}>Last Name</label><input value={obEditForm.last_name} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { last_name: e.target.value }); }); }} style={fi} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={grp}><label style={lb}>Email</label><input type="email" value={obEditForm.email} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { email: e.target.value }); }); }} style={fi} /></div>
                  <div style={grp}><label style={lb}>Phone</label><input value={obEditForm.phone} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { phone: e.target.value }); }); }} style={fi} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={grp}><label style={lb}>Area of Interest</label><input value={obEditForm.area_of_interest} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { area_of_interest: e.target.value }); }); }} style={fi} /></div>
                  <div style={grp}><label style={lb}>Team Assignment</label><input value={obEditForm.team} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { team: e.target.value }); }); }} placeholder="e.g. Grounds" style={fi} /></div>
                </div>
                <div style={grp}><label style={lb}>Address</label><input value={obEditForm.address} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { address: e.target.value }); }); }} style={fi} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={grp}><label style={lb}>Birthday (MM/DD/YYYY)</label><input value={obEditForm.birthday} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { birthday: e.target.value }); }); }} placeholder="e.g. 06/15/1985" style={fi} /></div>
                  <div style={grp}><label style={lb}>Emergency Contact</label><input value={obEditForm.emergency_contact} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { emergency_contact: e.target.value }); }); }} placeholder="Name & phone" style={fi} /></div>
                </div>
                <div style={grp}><label style={lb}>Notes</label><textarea value={obEditForm.notes} onChange={function(e) { setObEditForm(function(f) { return Object.assign({}, f, { notes: e.target.value }); }); }} rows={3} style={Object.assign({}, fi, { resize: 'vertical' })} placeholder="Paperwork notes, orientation details…" /></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={saveObEdit} disabled={obEditSaving} style={{ flex: 1, background: '#b5a185', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: obEditSaving ? 0.7 : 1 }}>{obEditSaving ? 'Saving…' : 'Save Changes'}</button>
                  <button onClick={function() { setObEditId(null); }} style={{ padding: '9px 18px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showAdd && (
        <VolForm
          form={form}
          onChange={handleFormChange}
          saving={saving}
          title="Add Volunteer"
          onSubmit={handleAddSubmit}
          onCancel={function() { setShowAdd(false); }}
          extraTeams={customTeams}
          listColors={listColors}
          eventTagOptions={allEventTags}
        />
      )}
    </div>
  );
}

var DONOR_TIERS_NSH = [
  { tier: 'blue_giant',    min: 2500, label: 'Blue Giant Star Sponsor', color: '#1565c0', bg: '#dbeafe', border: '#93c5fd' },
  { tier: 'red_giant',     min: 1000, label: 'Red Giant Star Sponsor',  color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
  { tier: 'evening_star',  min: 500,  label: 'Evening Star',            color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
  { tier: 'morning_star',  min: 250,  label: 'Morning Star',            color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { tier: 'rising_star',   min: 100,  label: 'Rising Star',             color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
  { tier: 'shooting_star', min: 50,   label: 'Shooting Star',           color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc' },
  { tier: 'none',          min: 0,    label: 'Non-member',              color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
];
function nshGetTier(cyTotal) { return DONOR_TIERS_NSH.find(function(t){return cyTotal>=t.min;})||DONOR_TIERS_NSH[DONOR_TIERS_NSH.length-1]; }
function nshGetStatus(lastGiftDate) {
  if(!lastGiftDate) return 'non_donor';
  var yr=new Date(lastGiftDate).getFullYear(), now=new Date().getFullYear();
  if(yr===now) return 'current';
  if(yr===now-1) return 'recently_lapsed';
  return 'long_lapsed';
}
var NSH_STATUS_PILLS={current:{background:'#d1fae5',color:'#065f46'},recently_lapsed:{background:'#fef9c3',color:'#713f12'},long_lapsed:{background:'#ffedd5',color:'#7c2d12'},non_donor:{background:'#f3f4f6',color:'#6b7280'}};
var NSH_STATUS_LABELS={current:'Current',recently_lapsed:'Lapsed',long_lapsed:'Long Lapsed',non_donor:'Non-donor'};
var NSH_TYPE_COLORS={'Donation':{bg:'#dbeafe',color:'#1d4ed8'},'Membership':{bg:'#d1fae5',color:'#065f46'},'Restricted':{bg:'#fce7f3',color:'#831843'},'Membership, Donation':{bg:'#ede9fe',color:'#5b21b6'},'Brick Purchase':{bg:'#fee2e2',color:'#7f1d1d'},'Tribute':{bg:'#fef9c3',color:'#713f12'}};

function DonorsView() {
  var THIS_YEAR = new Date().getFullYear();
  var DONATION_TYPES = ['Donation','Membership','Restricted','Membership, Donation','Brick Purchase','Tribute'];
  var PAYMENT_TYPES = ['Website','Check','Cash','Credit Card','ACH','Other'];
  var ACCOUNT_TYPES = ['Individual','Family','Household','Foundation','Corporate','Organization'];
  var emptyAddForm = {formal_name:'',informal_first_name:'',account_type:'Individual',email:'',phone:'',address:'',amount:'',date:'',type:'Donation',payment_type:'Website',acknowledged:false,donation_notes:''};
  var emptyGiftForm = {amount:'',date:'',type:'Donation',payment_type:'Website',acknowledged:false,donation_notes:''};

  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [filters, setFilters] = useState({search:'',status:'current',tier:'all',donationType:'all',year:'all',hasAddress:'all'});
  const [sortKey, setSortKey] = useState('last_gift_date');
  const [sortDir, setSortDir] = useState('desc');
  const [editDon, setEditDon] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [addGiftForm, setAddGiftForm] = useState(emptyGiftForm);
  const [addingGift, setAddingGift] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addMode, setAddMode] = useState('search');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addExistingDonor, setAddExistingDonor] = useState(null);

  var DONATION_TYPES = ['Donation','Membership','Restricted','Membership, Donation','Brick Purchase','Tribute'];
  var PAYMENT_TYPES = ['Website','Check','Cash','Credit Card','ACH','Other'];
  var ACCOUNT_TYPES = ['Individual','Family','Household','Foundation','Corporate','Organization'];

  function buildDonor(donorRow, dons) {
    var cyTotal = dons.filter(function(d){return d.date&&new Date(d.date).getFullYear()===THIS_YEAR;}).reduce(function(s,d){return s+d.amount;},0);
    var lifeCalc = dons.reduce(function(s,d){return s+d.amount;},0);
    var lifetimeTotal = Math.max(lifeCalc, donorRow.historical_lifetime_giving||0);
    var sorted = dons.slice().sort(function(a,b){return b.date>a.date?1:-1;});
    var lastGift = sorted[0]||null;
    return Object.assign({},donorRow,{
      donations: dons,
      current_year_total: cyTotal,
      lifetime_total: lifetimeTotal,
      last_gift_date: lastGift?lastGift.date:null,
      last_gift_amount: lastGift?lastGift.amount:null,
      status: nshGetStatus(lastGift?lastGift.date:null),
      tier: nshGetTier(cyTotal).tier,
    });
  }


  useEffect(function() {
    Promise.all([
      fetch(SUPABASE_URL+'/rest/v1/donors?select=*&order=formal_name',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}).then(function(r){return r.json();}),
      fetch(SUPABASE_URL+'/rest/v1/donations?select=*',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}).then(function(r){return r.json();}),
      fetch(SUPABASE_URL+'/rest/v1/donor_tags?select=donor_id,tags(*)',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}}).then(function(r){return r.json();})
    ]).then(function(results) {
      var donorRows=results[0], donationRows=results[1], tagRows=Array.isArray(results[2])?results[2]:[];
      if(!Array.isArray(donorRows)||!Array.isArray(donationRows)){setError('Failed to load');setLoading(false);return;}
      var byDonor={};
      donationRows.forEach(function(d){if(!byDonor[d.donor_id])byDonor[d.donor_id]=[];byDonor[d.donor_id].push(d);});
      var tagsByDonor={};
      tagRows.forEach(function(r){if(!r.tags)return;if(!tagsByDonor[r.donor_id])tagsByDonor[r.donor_id]=[];tagsByDonor[r.donor_id].push(r.tags);});
      setDonors(donorRows.map(function(d){return Object.assign(buildDonor(d,byDonor[d.id]||[]),{tags:tagsByDonor[d.id]||[]});}));
      setLoading(false);
    }).catch(function(err){setError(err.message);setLoading(false);});
  }, []);

  // Derived data
  var availableYears = (function(){var y={};donors.forEach(function(d){(d.donations||[]).forEach(function(don){if(don.date)y[don.date.slice(0,4)]=true;});});return Object.keys(y).sort(function(a,b){return b-a;});})();
  var availableTypes = (function(){var t={};donors.forEach(function(d){(d.donations||[]).forEach(function(don){if(don.type)t[don.type]=true;});});return Object.keys(t).sort();})();

  var filteredDonors = donors.filter(function(d) {
    if(filters.search){var s=filters.search.toLowerCase();if(!(d.formal_name||'').toLowerCase().includes(s)&&!(d.email||'').toLowerCase().includes(s))return false;}
    if(filters.status!=='all'&&d.status!==filters.status)return false;
    if(filters.tier!=='all'&&d.tier!==filters.tier)return false;
    if(filters.hasAddress==='yes'&&!(d.address||'').trim())return false;
    if(filters.hasAddress==='no'&&(d.address||'').trim())return false;
    if(filters.donationType!=='all'||filters.year!=='all'){
      var hasDon=(d.donations||[]).some(function(don){
        var tm=filters.donationType==='all'||don.type===filters.donationType;
        var ym=filters.year==='all'||(don.date||'').startsWith(filters.year);
        return tm&&ym;
      });
      if(!hasDon)return false;
    }
    return true;
  });

  var totalRaised = filteredDonors.reduce(function(s,d){
    return s+(d.donations||[]).filter(function(don){
      var tm=filters.donationType==='all'||don.type===filters.donationType;
      var ym=filters.year==='all'||(don.date||'').startsWith(filters.year);
      return tm&&ym;
    }).reduce(function(ss,don){return ss+don.amount;},0);
  },0);
  var membersCount = filteredDonors.filter(function(d){return(d.donations||[]).some(function(don){return(don.type||'').includes('Membership');});}).length;

  var TIER_ORD={blue_giant:6,red_giant:5,evening_star:4,morning_star:3,rising_star:2,shooting_star:1,none:0};
  var STATUS_ORD={current:3,recently_lapsed:2,long_lapsed:1,non_donor:0};
  var sortedDonors = filteredDonors.slice().sort(function(a,b){
    var cmp=0;
    if(sortKey==='formal_name')cmp=(a.formal_name||'').localeCompare(b.formal_name||'');
    else if(sortKey==='status')cmp=(STATUS_ORD[a.status]||0)-(STATUS_ORD[b.status]||0);
    else if(sortKey==='tier')cmp=(TIER_ORD[a.tier]||0)-(TIER_ORD[b.tier]||0);
    else if(sortKey==='current_year_total')cmp=a.current_year_total-b.current_year_total;
    else if(sortKey==='lifetime_total')cmp=a.lifetime_total-b.lifetime_total;
    else if(sortKey==='last_gift_date')cmp=new Date(a.last_gift_date||'1900').getTime()-new Date(b.last_gift_date||'1900').getTime();
    return sortDir==='asc'?cmp:-cmp;
  });

  var allVisibleIds=sortedDonors.map(function(d){return d.id;});
  var allChecked=allVisibleIds.length>0&&allVisibleIds.every(function(id){return!!selectedIds[id];});
  var someChecked=allVisibleIds.some(function(id){return!!selectedIds[id];});

  function handleSort(key){if(sortKey===key)setSortDir(function(d){return d==='asc'?'desc':'asc';});else{setSortKey(key);setSortDir('desc');}}
  function toggleAll(){if(allChecked){setSelectedIds({});}else{var n={};allVisibleIds.forEach(function(id){n[id]=true;});setSelectedIds(n);}}
  function toggleOne(id){setSelectedIds(function(prev){var n=Object.assign({},prev);if(n[id])delete n[id];else n[id]=true;return n;});}

  function fmtAmt(n){return(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
  function fmtAmtFull(n){return(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});}
  function fmtDate(d){if(!d)return '—';return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}

  function exportCSV(){
    var headers=['Name','Status','Tier','This Year','Lifetime','Last Gift','Email','Phone','Address'];
    var rows=sortedDonors.map(function(d){return [d.formal_name,d.status,d.tier,d.current_year_total,d.lifetime_total,d.last_gift_date||'',d.email||'',d.phone||'','"'+(d.address||'').replace(/"/g,"'")+'"'].join(',');});
    var csv=[headers.join(',')].concat(rows).join('\n');
    var blob=new Blob([csv],{type:'text/csv'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='donors.csv';a.click();URL.revokeObjectURL(url);
  }

  function updateDonorInState(donorId, updater) {
    setDonors(function(prev){return prev.map(function(d){if(d.id!==donorId)return d;var newD=updater(d);return buildDonor(Object.assign({},d),newD.donations);});});
    setSelected(function(prev){if(!prev||prev.id!==donorId)return prev;var newD=updater(prev);return buildDonor(Object.assign({},prev),newD.donations);});
  }

  function deleteDonation(don){
    if(!window.confirm('Delete this donation? This cannot be undone.'))return;
    fetch(SUPABASE_URL+'/rest/v1/donations?id=eq.'+don.id,{method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
      .then(function(){
        if(selected)updateDonorInState(selected.id,function(d){return{donations:d.donations.filter(function(x){return x.id!==don.id;})};});
        setEditDon(null);
      });
  }

  function saveEditDonation(e){
    e.preventDefault();setEditSaving(true);
    var patch={amount:parseFloat(String(editForm.amount||0).replace(/[^\d.]/g,'')||0),date:editForm.date,type:editForm.type,payment_type:editForm.payment_type||null,acknowledged:!!editForm.acknowledged,donation_notes:editForm.donation_notes||null};
    fetch(SUPABASE_URL+'/rest/v1/donations?id=eq.'+editDon.id,{method:'PATCH',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)})
      .then(function(r){return r.json();}).then(function(rows){
        setEditSaving(false);
        var updated=Array.isArray(rows)?rows[0]:rows;
        if(selected)updateDonorInState(selected.id,function(d){return{donations:d.donations.map(function(x){return x.id===editDon.id?Object.assign({},x,updated):x;})};});
        setEditDon(null);
      }).catch(function(){setEditSaving(false);});
  }

  function submitAddGift(e){
    e.preventDefault();setAddingGift(true);
    if(!selected)return;
    fetch(SUPABASE_URL+'/rest/v1/donations',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({donor_id:selected.id,amount:parseFloat(String(addGiftForm.amount||0).replace(/[^\d.]/g,'')||0),date:addGiftForm.date,type:addGiftForm.type,payment_type:addGiftForm.payment_type||null,acknowledged:!!addGiftForm.acknowledged,donation_notes:addGiftForm.donation_notes||null})})
      .then(function(r){return r.json();}).then(function(rows){
        setAddingGift(false);
        var newDon=Array.isArray(rows)?rows[0]:rows;
        logActivity('New donation of $'+(parseFloat(newDon.amount)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' from '+(selected.formal_name||'a donor'),'donation_added');
        updateDonorInState(selected.id,function(d){return{donations:d.donations.concat([newDon])};});
        setAddGiftForm(emptyGiftForm);
      }).catch(function(){setAddingGift(false);});
  }

  function submitGiftForExisting(e){
    e.preventDefault();
    if(!addExistingDonor)return;
    setSaving(true);
    fetch(SUPABASE_URL+'/rest/v1/donations',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({donor_id:addExistingDonor.id,amount:parseFloat(String(addGiftForm.amount||0).replace(/[^\d.]/g,'')||0),date:addGiftForm.date,type:addGiftForm.type,payment_type:addGiftForm.payment_type||null,acknowledged:!!addGiftForm.acknowledged,donation_notes:addGiftForm.donation_notes||null})})
      .then(function(r){return r.json();}).then(function(rows){
        setSaving(false);
        var newDon=Array.isArray(rows)?rows[0]:rows;
        logActivity('New donation of $'+(parseFloat(newDon.amount)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' from '+(addExistingDonor.formal_name||'a donor'),'donation_added');
        updateDonorInState(addExistingDonor.id,function(d){return{donations:d.donations.concat([newDon])};});
        setShowAdd(false);setAddGiftForm(emptyGiftForm);setAddExistingDonor(null);setAddMode('search');setAddSearchQuery('');
      }).catch(function(){setSaving(false);});
  }

  function handleAddSubmit(e){
    e.preventDefault();setSaving(true);
    fetch(SUPABASE_URL+'/rest/v1/donors?formal_name=ilike.'+encodeURIComponent(addForm.formal_name)+'&limit=1&select=id',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
      .then(function(r){return r.json();}).then(function(existing){
        if(Array.isArray(existing)&&existing.length>0)return existing[0].id;
        return fetch(SUPABASE_URL+'/rest/v1/donors',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},
          body:JSON.stringify({formal_name:addForm.formal_name,informal_first_name:addForm.informal_first_name||null,account_type:addForm.account_type||null,email:addForm.email||null,phone:addForm.phone||null,address:addForm.address||null,historical_lifetime_giving:0,historical_donation_count:0})})
          .then(function(r){return r.json();}).then(function(rows){return rows[0].id;});
      }).then(function(donorId){
        return fetch(SUPABASE_URL+'/rest/v1/donations',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},
          body:JSON.stringify({donor_id:donorId,amount:parseFloat(String(addForm.amount||0).replace(/[^\d.]/g,'')||0),date:addForm.date,type:addForm.type,payment_type:addForm.payment_type||null,acknowledged:!!addForm.acknowledged,donation_notes:addForm.donation_notes||null})})
          .then(function(r){return r.json();}).then(function(donRows){
            var newDon=Array.isArray(donRows)?donRows[0]:donRows;
            return fetch(SUPABASE_URL+'/rest/v1/donors?id=eq.'+donorId+'&select=*',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
              .then(function(r){return r.json();}).then(function(dr){return{donor:Array.isArray(dr)?dr[0]:dr,donation:newDon};});
          });
      }).then(function(result){
        setSaving(false);
        var d=result.donor,don=result.donation;
        logActivity('New donation of $'+(parseFloat(don.amount)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' from '+(d.formal_name||'a donor'),'donation_added');
        var newDonorObj=buildDonor(d,[don]);
        setDonors(function(prev){
          var exists=prev.some(function(x){return x.id===d.id;});
          if(exists){return prev.map(function(x){if(x.id!==d.id)return x;return buildDonor(Object.assign({},x),x.donations.concat([don]));});}
          return [newDonorObj].concat(prev);
        });
        setShowAdd(false);setAddForm(emptyAddForm);setAddMode('search');setAddSearchQuery('');
      }).catch(function(){setSaving(false);});
  }

  var iStyle={width:'100%',padding:'8px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,marginTop:4,boxSizing:'border-box',fontFamily:'system-ui, sans-serif',background:'#fff'};
  var lStyle={fontSize:12,color:'#666',fontWeight:500};
  var sec={fontSize:11,textTransform:'uppercase',letterSpacing:1.2,color:'#888',fontWeight:600,marginBottom:6,marginTop:16,display:'block'};

  function getDonsByYear(dons){
    var byY={};
    (dons||[]).forEach(function(d){var yr=d.date?d.date.slice(0,4):'?';if(!byY[yr])byY[yr]=[];byY[yr].push(d);});
    return Object.keys(byY).sort(function(a,b){return b-a;}).map(function(yr){return{year:yr,dons:byY[yr]};});
  }

  return (
    <div style={{position:'relative'}}>
      {/* Filter bar */}
      <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,marginBottom:14}}>
        <div style={{position:'relative',flex:'1 1 160px',minWidth:160}}>
          <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#aaa',fontSize:12,pointerEvents:'none'}}>🔍</span>
          <input type="text" placeholder="Search donors..." value={filters.search}
            onChange={function(e){setFilters(function(f){return Object.assign({},f,{search:e.target.value});});}}
            style={{width:'100%',padding:'7px 12px 7px 30px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff',boxSizing:'border-box'}} />
        </div>
        <select value={filters.status} onChange={function(e){setFilters(function(f){return Object.assign({},f,{status:e.target.value});});}}
          style={{padding:'7px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff'}}>
          <option value="all">All Statuses</option>
          <option value="current">Current</option>
          <option value="recently_lapsed">Recently Lapsed</option>
          <option value="long_lapsed">Long Lapsed</option>
          <option value="non_donor">Non-Donor</option>
        </select>
        <select value={filters.tier} onChange={function(e){setFilters(function(f){return Object.assign({},f,{tier:e.target.value});});}}
          style={{padding:'7px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff'}}>
          <option value="all">All Tiers</option>
          {DONOR_TIERS_NSH.filter(function(t){return t.tier!=='none';}).map(function(t){return <option key={t.tier} value={t.tier}>{t.label}</option>;})}
        </select>
        <select value={filters.donationType} onChange={function(e){setFilters(function(f){return Object.assign({},f,{donationType:e.target.value});});}}
          style={{padding:'7px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff'}}>
          <option value="all">All Types</option>
          {availableTypes.map(function(t){return <option key={t} value={t}>{t}</option>;})}
        </select>
        <select value={filters.year} onChange={function(e){setFilters(function(f){return Object.assign({},f,{year:e.target.value});});}}
          style={{padding:'7px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff'}}>
          <option value="all">All Years</option>
          {availableYears.map(function(y){return <option key={y} value={y}>{y}</option>;})}
        </select>
        <select value={filters.hasAddress} onChange={function(e){setFilters(function(f){return Object.assign({},f,{hasAddress:e.target.value});});}}
          style={{padding:'7px 10px',border:'0.5px solid #e0d8cc',borderRadius:8,fontSize:12,background:'#fff'}}>
          <option value="all">All</option>
          <option value="yes">Has Address</option>
          <option value="no">No Address</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto'}}>
          <span style={{fontSize:11,color:'#aaa'}}>{filteredDonors.length} donor{filteredDonors.length!==1?'s':''}</span>
          <button onClick={exportCSV} style={{padding:'7px 14px',background:gold,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer'}}>↓ Export CSV</button>
          <button onClick={function(){setAddForm(emptyAddForm);setAddGiftForm(emptyGiftForm);setAddExistingDonor(null);setAddSearchQuery('');setAddMode('search');setShowAdd(true);}} style={{padding:'7px 14px',background:gold,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer'}}>+ Add Donation</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        <StatCard label="Total Raised" value={loading?'...':fmtAmtFull(totalRaised)} sub={filters.year==='all'?'All Years':filters.year+' YTD'} />
        <StatCard label="Donors in View" value={loading?'...':filteredDonors.length} sub="in view" />
        <StatCard label="Members" value={loading?'...':membersCount} />
        <StatCard label="Total Records" value={loading?'...':donors.length} />
      </div>

      {error && <div style={{background:'#fce4e4',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#c0392b'}}>Error: {error}</div>}

      {/* Table + panel layout */}
      <div style={{display:'flex',gap:0,position:'relative'}}>
        <div style={{flex:1,minWidth:0,background:'#fff',border:'0.5px solid #e0d8cc',borderRadius:10,overflow:'hidden',marginRight:selected?428:0,transition:'margin-right 0.2s'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:40,color:'#777',fontSize:12}}>Loading donors...</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:'0.5px solid #e0d8cc',background:'#faf8f4'}}>
                    <th style={{width:36,paddingLeft:14,paddingRight:6,paddingTop:10,paddingBottom:10}}>
                      <input type="checkbox" checked={allChecked}
                        ref={function(el){if(el)el.indeterminate=someChecked&&!allChecked;}}
                        onChange={toggleAll} style={{accentColor:gold,cursor:'pointer'}} />
                    </th>
                    {[
                      {label:'Donor',k:'formal_name',align:'left'},
                      {label:'Status',k:'status',align:'left'},
                      {label:'Tier',k:'tier',align:'left'},
                      {label:'This Year',k:'current_year_total',align:'right'},
                      {label:'Lifetime',k:'lifetime_total',align:'right'},
                      {label:'Last Gift',k:'last_gift_date',align:'right'},
                    ].map(function(h){
                      var active=sortKey===h.k;
                      return (
                        <th key={h.k} onClick={function(){handleSort(h.k);}}
                          style={{padding:'10px 14px',textAlign:h.align,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:0.8,color:active?'#555':'#999',cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}>
                          {h.label}{active?(sortDir==='asc'?' ↑':' ↓'):' ⇅'}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedDonors.length===0 ? (
                    <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'#aaa',fontSize:12}}>No donors match your filters.</td></tr>
                  ) : sortedDonors.map(function(d){
                    var tierInfo=nshGetTier(d.current_year_total);
                    var isSelected=selected&&selected.id===d.id;
                    var isChecked=!!selectedIds[d.id];
                    return (
                      <tr key={d.id} onClick={function(){setSelected(d);setEditDon(null);}}
                        style={{borderBottom:'0.5px solid #f0ebe2',cursor:'pointer',background:isChecked?'#fef9ec':(isSelected?'#faf4e8':'#fff'),transition:'background 0.1s',opacity:d.deceased?0.55:1}}>
                        <td style={{paddingLeft:14,paddingRight:6,paddingTop:10,paddingBottom:10}}
                          onClick={function(e){e.stopPropagation();toggleOne(d.id);}}>
                          <input type="checkbox" checked={isChecked} onChange={function(){toggleOne(d.id);}} onClick={function(e){e.stopPropagation();}} style={{accentColor:gold,cursor:'pointer'}} />
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div>
                              <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                                <span style={{fontWeight:500,color:'#2a2a2a'}}>{d.formal_name}</span>
                                {d.starred && <span style={{color:'#b5a185',fontSize:12}}>★</span>}
                                {d.deceased && <span style={{fontSize:9,fontWeight:600,padding:'1px 5px',borderRadius:20,background:'#e5e7eb',color:'#6b7280'}}>Deceased</span>}
                                {(d.tags||[]).map(function(tag){return <span key={tag.id} title={tag.name} style={{width:7,height:7,borderRadius:'50%',background:tag.color,flexShrink:0,display:'inline-block'}}/>;})}
                              </div>
                              {d.informal_first_name && <div style={{fontSize:11,color:'#999',marginTop:1}}>{d.informal_first_name}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <span style={{display:'inline-flex',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,...(NSH_STATUS_PILLS[d.status]||{background:'#f3f4f6',color:'#6b7280'})}}>
                            {NSH_STATUS_LABELS[d.status]||d.status}
                          </span>
                          {(d.tags||[]).length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:4}}>
                            {(d.tags||[]).map(function(tag){return <span key={tag.id} style={{display:'inline-flex',alignItems:'center',gap:3,padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:500,background:tag.color+'22',color:tag.color}}>{tag.name}</span>;})}
                          </div>}
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          {d.tier==='none'
                            ? <span style={{color:'#ccc',fontSize:11}}>—</span>
                            : <span style={{display:'inline-flex',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,background:tierInfo.bg,color:tierInfo.color,border:'1px solid '+tierInfo.border}}>{tierInfo.label}</span>}
                        </td>
                        <td style={{padding:'10px 14px',textAlign:'right',fontWeight:500,color:'#2a2a2a'}}>
                          {d.current_year_total>0?fmtAmt(d.current_year_total):<span style={{color:'#ccc'}}>—</span>}
                        </td>
                        <td style={{padding:'10px 14px',textAlign:'right',color:'#555'}}>
                          {fmtAmt(d.lifetime_total)}
                        </td>
                        <td style={{padding:'10px 14px',textAlign:'right',color:'#888',fontSize:11}}>
                          {fmtDate(d.last_gift_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{padding:'10px 14px',fontSize:11,color:'#aaa',borderTop:'0.5px solid #f0ebe2'}}>
                {sortedDonors.length} donor{sortedDonors.length!==1?'s':''}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right-side slide panel */}
      {selected && (
        <div style={{position:'fixed',top:0,right:0,width:420,height:'100vh',background:'#fff',boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',zIndex:500,display:'flex',flexDirection:'column',overflowY:'hidden'}}>
          {/* Panel header */}
          <div style={{background:'linear-gradient(135deg,#f8f4ec 0%,#f0e8dc 100%)',padding:'20px 24px 16px',borderBottom:'0.5px solid #e8dece',flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:600,color:'#1e1a16',marginBottom:2,lineHeight:1.3}}>{selected.formal_name}</div>
                {selected.informal_first_name && <div style={{fontSize:11,color:'#888',marginBottom:4}}>Goes by {selected.informal_first_name}</div>}
              </div>
              <button onClick={function(){setSelected(null);setEditDon(null);}}
                style={{background:'rgba(0,0,0,0.06)',border:'none',borderRadius:'50%',width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,color:'#666',flexShrink:0,marginLeft:8}}>×</button>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:10}}>
              {(function(){var ti=nshGetTier(selected.current_year_total);return ti.tier!=='none'?<span style={{fontSize:11,fontWeight:600,color:ti.color,background:ti.bg,border:'1px solid '+ti.border,borderRadius:20,padding:'2px 10px'}}>✦ {ti.label}</span>:null;})()}
              <span style={{fontSize:11,borderRadius:20,padding:'2px 8px',fontWeight:500,...(NSH_STATUS_PILLS[selected.status]||{background:'#f3f4f6',color:'#6b7280'})}}>
                {NSH_STATUS_LABELS[selected.status]||selected.status}
              </span>
              {(selected.tags||[]).map(function(tag){return <span key={tag.id} style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,background:tag.color+'22',color:tag.color}}>{tag.name}</span>;})}
            </div>
            {/* Giving summary */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
              {[
                {label:'This Year',val:fmtAmt(selected.current_year_total)},
                {label:'Lifetime',val:fmtAmt(selected.lifetime_total)},
                {label:'Gifts',val:(selected.donations||[]).length},
              ].map(function(s){return (
                <div key={s.label} style={{background:'rgba(255,255,255,0.6)',borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a'}}>{s.val}</div>
                  <div style={{fontSize:10,color:'#888',marginTop:1}}>{s.label}</div>
                </div>
              );})}
            </div>
          </div>

          {/* Panel body */}
          <div style={{overflowY:'auto',flex:1,padding:'14px 24px 24px'}}>
            {/* Contact */}
            <span style={sec}>Contact</span>
            <div style={{fontSize:12,lineHeight:1.7,marginBottom:8}}>
              {selected.email && <div><span style={{color:'#777'}}>Email </span><a href={'mailto:'+selected.email} style={{color:gold,textDecoration:'none'}}>{selected.email}</a></div>}
              {selected.phone && <div><span style={{color:'#777'}}>Phone </span>{selected.phone}</div>}
              {selected.employer && <div><span style={{color:'#777'}}>Employer </span>{selected.employer}</div>}
              {selected.nsh_contact && <div><span style={{color:'#777'}}>NSH Contact </span>{selected.nsh_contact}</div>}
              {selected.address && <div><span style={{color:'#777'}}>Address </span><span style={{whiteSpace:'pre-line'}}>{selected.address}</span></div>}
            </div>

            {selected.background && <div style={{marginBottom:10}}><span style={sec}>Background</span><div style={{fontSize:12,background:'#faf8f4',borderRadius:8,padding:'8px 12px',color:'#444',lineHeight:1.6}}>{selected.background}</div></div>}
            {selected.first_connected && <div style={{marginBottom:10}}><span style={sec}>What Ties Them to NSH</span><div style={{fontSize:12,background:'#faf8f4',borderRadius:8,padding:'8px 12px',color:'#444',lineHeight:1.6}}>{selected.first_connected}</div></div>}
            {selected.donor_notes && <div style={{marginBottom:10}}><span style={sec}>Donor Notes</span><div style={{fontSize:12,background:'#faf8f4',borderRadius:8,padding:'8px 12px',color:'#444',lineHeight:1.6}}>{selected.donor_notes}</div></div>}

            {/* Donation history by year */}
            <span style={sec}>Donation History</span>
            {(selected.donations||[]).length===0 && <div style={{fontSize:12,color:'#aaa',marginBottom:10}}>No donations on record.</div>}
            {getDonsByYear(selected.donations).map(function(grp){
              var yrTotal=grp.dons.reduce(function(s,d){return s+d.amount;},0);
              return (
                <div key={grp.year} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:600,color:'#555'}}>{grp.year}</span>
                    <span style={{fontSize:11,color:'#888'}}>{fmtAmtFull(yrTotal)}</span>
                  </div>
                  <div style={{border:'0.5px solid #e0d8cc',borderRadius:8,overflow:'hidden'}}>
                    {grp.dons.slice().sort(function(a,b){return b.date>a.date?1:-1;}).map(function(don,i){
                      var tc=NSH_TYPE_COLORS[don.type]||{bg:'#f3f3f3',color:'#555'};
                      var acked=don.acknowledged===true||String(don.acknowledged).toUpperCase()==='TRUE';
                      var isEditing=editDon&&editDon.id===don.id;
                      return (
                        <div key={don.id||i} style={{borderBottom:i<grp.dons.length-1?'0.5px solid #f0ebe2':'none',background:'#fff'}}>
                          {isEditing ? (
                            <form onSubmit={saveEditDonation} style={{padding:'10px 12px'}}>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                                <div><label style={lStyle}>Amount</label><input required value={editForm.amount||''} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{amount:e.target.value});});}} style={iStyle} /></div>
                                <div><label style={lStyle}>Date</label><input type="date" value={editForm.date||''} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{date:e.target.value});});}} style={iStyle} /></div>
                              </div>
                              <div style={{marginBottom:8}}><label style={lStyle}>Type</label>
                                <select value={editForm.type||''} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{type:e.target.value});});}} style={iStyle}>
                                  {DONATION_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                                </select>
                              </div>
                              <div style={{marginBottom:8}}><label style={lStyle}>Payment Type</label>
                                <select value={editForm.payment_type||''} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{payment_type:e.target.value});});}} style={iStyle}>
                                  {PAYMENT_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                                </select>
                              </div>
                              <div style={{marginBottom:8}}><label style={lStyle}>Notes</label><textarea value={editForm.donation_notes||''} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{donation_notes:e.target.value});});}} rows={2} style={Object.assign({},iStyle,{resize:'vertical'})} /></div>
                              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,marginBottom:10,cursor:'pointer'}}><input type="checkbox" checked={!!editForm.acknowledged} onChange={function(e){setEditForm(function(f){return Object.assign({},f,{acknowledged:e.target.checked});});}} /> Acknowledged</label>
                              <div style={{display:'flex',gap:8}}>
                                <button type="submit" disabled={editSaving} style={{flex:1,background:gold,color:'#fff',border:'none',borderRadius:6,padding:'7px',fontSize:12,fontWeight:500,cursor:'pointer',opacity:editSaving?0.7:1}}>{editSaving?'Saving...':'Save'}</button>
                                <button type="button" onClick={function(){setEditDon(null);}} style={{padding:'7px 12px',background:'#f5f0ea',border:'none',borderRadius:6,fontSize:12,color:'#666',cursor:'pointer'}}>Cancel</button>
                                <button type="button" onClick={function(){deleteDonation(don);}} style={{padding:'7px 12px',background:'transparent',border:'0.5px solid #e8a0a0',borderRadius:6,cursor:'pointer',fontSize:12,color:'#c0392b'}}>Delete</button>
                              </div>
                            </form>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px'}}>
                              <div style={{display:'flex',gap:6,alignItems:'center',flex:1,flexWrap:'wrap'}}>
                                <span style={{background:tc.bg,color:tc.color,fontSize:11,fontWeight:500,padding:'2px 7px',borderRadius:20,whiteSpace:'nowrap'}}>{don.type}</span>
                                <span style={{fontSize:12,color:'#888'}}>{fmtDate(don.date)}</span>
                                <span style={{fontSize:12,fontWeight:600,color:'#2a2a2a'}}>{fmtAmtFull(don.amount)}</span>
                                <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:acked?'#e8f5e9':'#fff8e1',color:acked?'#2e7d32':'#8a6200',fontWeight:500}}>{acked?'Thanked':'Pending'}</span>
                              </div>
                              <button onClick={function(e){e.stopPropagation();setEditDon(don);setEditForm({amount:String(don.amount),date:don.date||'',type:don.type||'Donation',payment_type:don.payment_type||'',acknowledged:don.acknowledged===true||String(don.acknowledged).toUpperCase()==='TRUE',donation_notes:don.donation_notes||''});}}
                                style={{fontSize:11,color:'#888',background:'none',border:'0.5px solid #e0d8cc',borderRadius:6,padding:'3px 10px',cursor:'pointer',flexShrink:0,marginLeft:6}}>Edit</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Add Gift */}
            <span style={sec}>Add Gift</span>
            <form onSubmit={submitAddGift} style={{background:'#faf8f4',borderRadius:8,padding:'12px 14px',border:'0.5px solid #e0d8cc'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div><label style={lStyle}>Amount *</label><input required value={addGiftForm.amount} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{amount:e.target.value});});}} style={iStyle} placeholder="$0.00" /></div>
                <div><label style={lStyle}>Date *</label><input required type="date" value={addGiftForm.date} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{date:e.target.value});});}} style={iStyle} /></div>
              </div>
              <div style={{marginBottom:8}}><label style={lStyle}>Type</label>
                <select value={addGiftForm.type} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{type:e.target.value});});}} style={iStyle}>
                  {DONATION_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                </select>
              </div>
              <div style={{marginBottom:8}}><label style={lStyle}>Payment Type</label>
                <select value={addGiftForm.payment_type} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{payment_type:e.target.value});});}} style={iStyle}>
                  {PAYMENT_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                </select>
              </div>
              <div style={{marginBottom:8}}><label style={lStyle}>Notes</label><textarea value={addGiftForm.donation_notes} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{donation_notes:e.target.value});});}} rows={2} style={Object.assign({},iStyle,{resize:'vertical'})} /></div>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,marginBottom:10,cursor:'pointer'}}><input type="checkbox" checked={addGiftForm.acknowledged} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{acknowledged:e.target.checked});});}} /> Acknowledged / Thanked</label>
              <button type="submit" disabled={addingGift} style={{width:'100%',background:gold,color:'#fff',border:'none',borderRadius:8,padding:'8px',fontSize:12,fontWeight:500,cursor:'pointer',opacity:addingGift?0.7:1}}>{addingGift?'Saving...':'Add Gift'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Donation modal */}
      {showAdd && (
        <div onClick={function(){setShowAdd(false);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.32)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:'#fff',borderRadius:16,padding:28,maxWidth:640,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.18)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
              {addMode!=='search' && (
                <button onClick={function(){setAddMode('search');setAddExistingDonor(null);}} style={{background:'none',border:'none',fontSize:16,cursor:'pointer',color:'#aaa',padding:0}}>←</button>
              )}
              <div style={{fontSize:17,fontWeight:600,color:'#2a2a2a',flex:1}}>{addMode==='existing'?'Gift for '+(addExistingDonor&&addExistingDonor.formal_name):addMode==='new'?'New Donor':'Add Donation'}</div>
              <button onClick={function(){setShowAdd(false);}} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#bbb'}}>×</button>
            </div>

            {addMode==='search' && (function(){
              var q=addSearchQuery.trim();
              var results=q?donors.filter(function(d){var s=q.toLowerCase();return (d.formal_name||'').toLowerCase().includes(s)||(d.informal_first_name||'').toLowerCase().includes(s)||(d.email||'').toLowerCase().includes(s);}).slice(0,8):[];
              return (
                <div>
                  <label style={lStyle}>Search for an existing donor</label>
                  <input autoFocus value={addSearchQuery} onChange={function(e){setAddSearchQuery(e.target.value);}} placeholder="Type a name…" style={Object.assign({},iStyle,{marginTop:4})} />
                  {q && (
                    <div style={{marginTop:6,border:'0.5px solid #e0d8cc',borderRadius:8,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
                      {results.length===0 ? (
                        <div style={{padding:'10px 12px',fontSize:12,color:'#bbb'}}>No matches found</div>
                      ) : results.map(function(d){
                        return (
                          <div key={d.id} onClick={function(){setAddExistingDonor(d);setAddGiftForm(emptyGiftForm);setAddMode('existing');}}
                            style={{padding:'9px 12px',cursor:'pointer',borderBottom:'0.5px solid #f5f0ea',background:'#fff'}}
                            onMouseEnter={function(e){e.currentTarget.style.background='#faf8f4';}}
                            onMouseLeave={function(e){e.currentTarget.style.background='#fff';}}>
                            <div style={{fontSize:13,fontWeight:500,color:'#2a2a2a'}}>{d.formal_name}</div>
                            {(d.informal_first_name||d.email) && <div style={{fontSize:11,color:'#aaa',marginTop:1}}>{[d.informal_first_name,d.email].filter(Boolean).join(' · ')}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',gap:10,margin:'18px 0'}}>
                    <div style={{flex:1,height:1,background:'#f0ece6'}} />
                    <span style={{fontSize:11,color:'#bbb'}}>or</span>
                    <div style={{flex:1,height:1,background:'#f0ece6'}} />
                  </div>
                  <button type="button" onClick={function(){setAddForm(emptyAddForm);setAddMode('new');}} style={{width:'100%',padding:'10px',border:'1px dashed #e0d8cc',borderRadius:8,fontSize:13,color:'#999',background:'none',cursor:'pointer'}}>+ Create new donor profile</button>
                </div>
              );
            })()}

            {addMode==='existing' && (
              <form onSubmit={submitGiftForExisting}>
                <span style={{...sec,marginTop:0}}>Gift Details</span>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div><label style={lStyle}>Amount *</label><input required value={addGiftForm.amount} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{amount:e.target.value});});}} style={iStyle} placeholder="$0.00" /></div>
                  <div><label style={lStyle}>Date *</label><input required type="date" value={addGiftForm.date} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{date:e.target.value});});}} style={iStyle} /></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div><label style={lStyle}>Donation Type</label>
                    <select value={addGiftForm.type} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{type:e.target.value});});}} style={iStyle}>
                      {DONATION_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                    </select>
                  </div>
                  <div><label style={lStyle}>Payment Type</label>
                    <select value={addGiftForm.payment_type} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{payment_type:e.target.value});});}} style={iStyle}>
                      {PAYMENT_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:14}}><label style={lStyle}>Donation Notes</label><textarea value={addGiftForm.donation_notes} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{donation_notes:e.target.value});});}} rows={2} style={Object.assign({},iStyle,{resize:'vertical'})} /></div>
                <div style={{marginBottom:14}}><label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}><input type="checkbox" checked={addGiftForm.acknowledged} onChange={function(e){setAddGiftForm(function(f){return Object.assign({},f,{acknowledged:e.target.checked});});}} /> Acknowledged / Thanked</label></div>
                <div style={{display:'flex',gap:10}}>
                  <button type="submit" disabled={saving} style={{flex:1,background:gold,color:'#fff',border:'none',borderRadius:8,padding:10,fontSize:12,fontWeight:500,cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Saving...':'Add Gift'}</button>
                  <button type="button" onClick={function(){setShowAdd(false);}} style={{flex:1,padding:10,background:'#f5f0ea',border:'none',borderRadius:8,fontSize:12,color:'#666',cursor:'pointer',fontWeight:500}}>Cancel</button>
                </div>
              </form>
            )}

            {addMode==='new' && (
              <form onSubmit={handleAddSubmit}>
                <span style={{...sec,marginTop:0}}>Donor</span>
                <div style={{marginBottom:14}}><label style={lStyle}>Formal Name *</label><input required value={addForm.formal_name} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{formal_name:e.target.value});});}} style={iStyle} placeholder="e.g. Mr. and Mrs. John Smith" /></div>
                <div style={{marginBottom:14}}><label style={lStyle}>Informal First Name</label><input value={addForm.informal_first_name} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{informal_first_name:e.target.value});});}} style={iStyle} placeholder="e.g. John" /></div>
                <div style={{marginBottom:14}}><label style={lStyle}>Account Type</label>
                  <select value={addForm.account_type} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{account_type:e.target.value});});}} style={iStyle}>
                    {ACCOUNT_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                  </select>
                </div>
                <span style={sec}>Contact</span>
                <div style={{marginBottom:14}}><label style={lStyle}>Email</label><input type="email" value={addForm.email} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{email:e.target.value});});}} style={iStyle} /></div>
                <div style={{marginBottom:14}}><label style={lStyle}>Phone</label><input value={addForm.phone} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{phone:e.target.value});});}} style={iStyle} /></div>
                <div style={{marginBottom:14}}><label style={lStyle}>Address</label><textarea value={addForm.address} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{address:e.target.value});});}} rows={3} style={Object.assign({},iStyle,{resize:'vertical'})} /></div>
                <span style={sec}>Donation</span>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div><label style={lStyle}>Amount *</label><input required value={addForm.amount} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{amount:e.target.value});});}} style={iStyle} placeholder="$0.00" /></div>
                  <div><label style={lStyle}>Date</label><input type="date" value={addForm.date} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{date:e.target.value});});}} style={iStyle} /></div>
                </div>
                <div style={{marginBottom:14}}><label style={lStyle}>Donation Type</label>
                  <select value={addForm.type} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{type:e.target.value});});}} style={iStyle}>
                    {DONATION_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                  </select>
                </div>
                <div style={{marginBottom:14}}><label style={lStyle}>Payment Type</label>
                  <select value={addForm.payment_type} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{payment_type:e.target.value});});}} style={iStyle}>
                    {PAYMENT_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>;})}
                  </select>
                </div>
                <div style={{marginBottom:14}}><label style={lStyle}>Donation Notes</label><textarea value={addForm.donation_notes} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{donation_notes:e.target.value});});}} rows={2} style={Object.assign({},iStyle,{resize:'vertical'})} /></div>
                <div style={{marginBottom:14}}><label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}><input type="checkbox" checked={addForm.acknowledged} onChange={function(e){setAddForm(function(f){return Object.assign({},f,{acknowledged:e.target.checked});});}} /> Acknowledged / Thanked</label></div>
                <div style={{display:'flex',gap:10}}>
                  <button type="submit" disabled={saving} style={{flex:1,background:gold,color:'#fff',border:'none',borderRadius:8,padding:10,fontSize:12,fontWeight:500,cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Saving...':'Add Donation'}</button>
                  <button type="button" onClick={function(){setShowAdd(false);}} style={{flex:1,padding:10,background:'#f5f0ea',border:'none',borderRadius:8,fontSize:12,color:'#666',cursor:'pointer',fontWeight:500}}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingView() {
  var { useState, useEffect } = React;
  var [links, setLinks] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showAdd, setShowAdd] = useState(false);
  var [addLabel, setAddLabel] = useState('');
  var [addUrl, setAddUrl] = useState('');
  var [saving, setSaving] = useState(false);

  useEffect(function() {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources') + '?area=eq.Marketing-Hub&select=*&order=id.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setLinks(rows);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  function addLink(e) {
    e.preventDefault();
    if (!addLabel.trim() || !addUrl.trim() || saving) return;
    var url = addUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ area: 'Marketing-Hub', title: addLabel.trim(), url: url })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows) && rows[0]) setLinks(function(p) { return p.concat([rows[0]]); });
      setAddLabel(''); setAddUrl(''); setShowAdd(false); setSaving(false);
    }).catch(function() { setSaving(false); });
  }

  function deleteLink(id) {
    setLinks(function(p) { return p.filter(function(l) { return l.id !== id; }); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources') + '?id=eq.' + id, {
      method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a', letterSpacing: 0.2 }}>Quick Links</div>
          <button onClick={function() { setShowAdd(function(v) { return !v; }); }} style={{ background: showAdd ? '#f5f0ea' : gold, color: showAdd ? '#888' : '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showAdd ? 'Cancel' : '+ Add Button'}</button>
        </div>

        {showAdd && (
          <form onSubmit={addLink} style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 18, border: '0.5px solid #e8e0d5' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={addLabel} onChange={function(e) { setAddLabel(e.target.value); }} placeholder="Button label" style={{ flex: '1 1 140px', padding: '8px 12px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff' }} />
              <input value={addUrl} onChange={function(e) { setAddUrl(e.target.value); }} placeholder="https://…" style={{ flex: '2 1 200px', padding: '8px 12px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff' }} />
              <button type="submit" disabled={saving || !addLabel.trim() || !addUrl.trim()} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (saving || !addLabel.trim() || !addUrl.trim()) ? 0.6 : 1, flexShrink: 0 }}>Save</button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Loading…</div>
        ) : links.length === 0 ? (
          <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No buttons yet — add one above.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {links.map(function(lnk) {
              return (
                <div key={lnk.id} style={{ position: 'relative' }}>
                  <a href={lnk.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '14px 16px', background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, textDecoration: 'none', color: '#2a2a2a', fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.4, transition: 'background 0.15s, border-color 0.15s' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#f5efe6'; e.currentTarget.style.borderColor = gold; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#faf8f5'; e.currentTarget.style.borderColor = '#e8e0d5'; }}>
                    {lnk.title}
                  </a>
                  <button onClick={function() { deleteLink(lnk.id); }} title="Remove" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
                    onMouseEnter={function(e) { e.currentTarget.style.color = '#e57373'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.color = '#ddd'; }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function RichEditor({ value, onChange, placeholder }) {
  var ref = React.useRef(null);
  var initialized = React.useRef(false);
  React.useEffect(function() {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || '';
      initialized.current = true;
    }
  }, []);
  function exec(cmd) { ref.current.focus(); document.execCommand(cmd, false, null); }
  return (
    <div style={{ border: '0.5px solid #e0d8cc', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
      <style>{'.rich-editor:empty:before{content:attr(data-placeholder);color:#bbb;pointer-events:none}'}</style>
      <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderBottom: '0.5px solid #f0ebe2', background: '#faf8f4' }}>
        <button type="button" onMouseDown={function(e) { e.preventDefault(); exec('bold'); }} style={{ background: 'none', border: '0.5px solid #e0d8cc', borderRadius: 5, padding: '1px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#444', lineHeight: 1.6 }}>B</button>
        <button type="button" onMouseDown={function(e) { e.preventDefault(); exec('italic'); }} style={{ background: 'none', border: '0.5px solid #e0d8cc', borderRadius: 5, padding: '1px 8px', fontSize: 12, fontStyle: 'italic', cursor: 'pointer', color: '#444', lineHeight: 1.6 }}>I</button>
      </div>
      <div ref={ref} className="rich-editor" contentEditable={true} suppressContentEditableWarning={true}
        onInput={function() { onChange(ref.current.innerHTML); }}
        data-placeholder={placeholder || 'Write something…'}
        style={{ minHeight: 72, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, background: '#fff' }}
      />
    </div>
  );
}

var BOARD_MEMBERS = ['Ken', 'Rick', 'Wyn', 'Paula', 'Jeff', 'Rich'];
var VOTE_COLORS = { 'Yes': { bg: '#e8f5e9', color: '#2e7d32' }, 'No': { bg: '#ffebee', color: '#c62828' }, 'Abstain': { bg: '#f3f0ff', color: '#7c3aed' }, 'Not in attendance': { bg: '#f5f5f5', color: '#888' } };

function BoardView() {
  var isMobile = React.useContext(MobileCtx);
  const [items, setItems] = React.useState([]);
  const [votes, setVotes] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [topicForm, setTopicForm] = React.useState({ title: '', description: '', attachment_url: '', submitted_by: '', due_date: '', meeting_date: '' });
  const [voteForm, setVoteForm] = React.useState({ voter: '', choice: '', note: '' });
  const [showPostMeeting, setShowPostMeeting] = React.useState(false);
  const [voteSaving, setVoteSaving] = React.useState(false);
  const [topicSaving, setTopicSaving] = React.useState(false);
  const [attachUploading, setAttachUploading] = React.useState(false);
  const [attachFileName, setAttachFileName] = React.useState('');
  const [showAdmin, setShowAdmin] = React.useState(false);
  const [adminAuthed, setAdminAuthed] = React.useState(false);
  const [adminPwInput, setAdminPwInput] = React.useState('');
  const [adminPwError, setAdminPwError] = React.useState(false);
  const [closingId, setClosingId] = React.useState(null);

  function handleAttachUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    setAttachFileName(file.name);
    setAttachUploading(true);
    var path = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    fetch(SUPABASE_URL + '/storage/v1/object/board-attachments/' + path, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: file
    }).then(function(r) {
      return r.text().then(function(text) {
        setAttachUploading(false);
        if (!r.ok) { alert('Upload failed (' + r.status + '): ' + text); return; }
        var url = SUPABASE_URL + '/storage/v1/object/public/board-attachments/' + path;
        setTopicForm(function(f) { return Object.assign({}, f, { attachment_url: url }); });
      });
    }).catch(function(err) { setAttachUploading(false); alert('Upload error: ' + err.message); });
  }

  function sbFetchAll(table) {
    var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?select=*';
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }).then(function(r) { return r.json(); });
  }

  function fetchVotesForItems(itemsData) {
    var idSet = new Set(itemsData.map(function(i) { return i.title; }).filter(function(t) { return t; }));
    var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Board-Votes') + '?select=*';
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!Array.isArray(data)) return data;
        if (idSet.size === 0) return [];
        return data.filter(function(v) { return idSet.has(String(v.topicId)); });
      });
  }

  function load() {
    setLoading(true);
    setLoadError(null);
    clearCache('Board-Votes');
    clearCache('Board Voting Items');
    cachedFetchAll('Board Voting Items').then(function(itemsData) {
      if (!Array.isArray(itemsData)) {
        setLoadError('Board Voting Items: ' + ((itemsData && itemsData.message) ? itemsData.message : JSON.stringify(itemsData)));
        setLoading(false);
        return;
      }
      var sorted = itemsData.sort(function(a, b) {
        var da = a.created_at ? new Date(a.created_at).getTime() : 0;
        var db = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (db !== da) return db - da;
        return (b.row_id || 0) - (a.row_id || 0);
      });
      setItems(sorted);
      setVotes([]);
      fetchVotesForItems(itemsData).then(function(votesData) {
        if (!Array.isArray(votesData)) {
          setLoadError('Board-Votes: ' + ((votesData && votesData.message) ? votesData.message : JSON.stringify(votesData)));
          setLoading(false);
          return;
        }
        setVotes(votesData);
        setLoading(false);
      }).catch(function(err) { setLoadError(err.message); setLoading(false); });
    }).catch(function(err) { setLoadError(err.message); setLoading(false); });
  }

  React.useEffect(function() { load(); }, []);

  function itemVotes(item) {
    return votes.filter(function(v) { return v.topicId === item.title; });
  }

  function isRevealed(item) {
    if (item.status === 'Closed') return true;
    var iv = itemVotes(item);
    var allVoted = BOARD_MEMBERS.every(function(m) { return iv.some(function(v) { return v.voter === m; }); });
    var pastDue = item.due_date && item.due_date <= new Date().toISOString().slice(0, 10);
    return allVoted || pastDue;
  }

  function closeVote(item) {
    setClosingId(item.row_id);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Board Voting Items') + '?row_id=eq.' + encodeURIComponent(item.row_id), {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'Closed' })
    }).then(function(r) { return r.json(); }).then(function() {
      setItems(function(prev) { return prev.map(function(i) { return i.row_id === item.row_id ? Object.assign({}, i, { status: 'Closed' }) : i; }); });
      setClosingId(null);
    }).catch(function() { setClosingId(null); });
  }

  function isWon(item) {
    var t = tally(item);
    return t.yes > t.no && t.yes > 0;
  }

  function tally(item) {
    var iv = itemVotes(item);
    return {
      yes: iv.filter(function(v) { return v.choice === 'Yes'; }).length,
      no: iv.filter(function(v) { return v.choice === 'No'; }).length,
      abstain: iv.filter(function(v) { return v.choice === 'Abstain'; }).length,
      absent: iv.filter(function(v) { return v.choice === 'Not in attendance'; }).length
    };
  }

  function refreshVotes() {
    fetchVotesForItems(items).then(function(data) {
      if (Array.isArray(data)) { setVotes(data); clearCache('Board-Votes'); }
    });
  }

  function handleVoteSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!voteForm.voter || !voteForm.choice) return;
    setVoteSaving(true);
    var existing = votes.find(function(v) { return v.topicId === selected.title && v.voter === voteForm.voter; });
    var today = new Date().toDateString();
    var isInMeeting = selected.meeting_date && new Date(selected.meeting_date + 'T12:00:00').toDateString() === today;
    var payload = { topicId: selected.title, voter: voteForm.voter, choice: voteForm.choice, note: voteForm.note || null };
    if (existing) {
      var fullPayload = Object.assign({}, payload, { changed_in_meeting: isInMeeting ? true : (existing.changed_in_meeting || false) });
      sbPatchById('Board-Votes', existing.id, fullPayload).then(function() {
        setVoteSaving(false);
        setVoteForm({ voter: '', choice: '', note: '' });
        refreshVotes();
      });
    } else {
      sbInsert('Board-Votes', Object.assign({}, payload, { changed_in_meeting: false })).then(function(rows) {
        if (rows && rows.message) { alert('Error saving vote: ' + rows.message); setVoteSaving(false); return; }
        setVoteSaving(false);
        setVoteForm({ voter: '', choice: '', note: '' });
        refreshVotes();
      }).catch(function(err) { alert('Error: ' + err); setVoteSaving(false); });
    }
  }

  function handleTopicSubmit(e) {
    e.preventDefault();
    if (!topicForm.title) return;
    setTopicSaving(true);
    sbInsert('Board Voting Items', {
      title: topicForm.title,
      description: topicForm.description || null,
      attachment_url: topicForm.attachment_url || null,
      submitted_by: topicForm.submitted_by || null,
      due_date: topicForm.due_date || null,
      meeting_date: topicForm.meeting_date || null,
      status: 'Open'
    }).then(function(rows) {
      if (rows && rows.message) { alert('Error: ' + rows.message); setTopicSaving(false); return; }
      setTopicSaving(false);
      setShowAdd(false);
      setTopicForm({ title: '', description: '', attachment_url: '', submitted_by: '', due_date: '', meeting_date: '' });
      setAttachFileName(''); setAttachUploading(false);
      clearCache('Board Voting Items');
      load();
    }).catch(function(err) { alert('Error: ' + err); setTopicSaving(false); });
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  var bInp = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 3, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
  var bLbl = { fontSize: 12, color: '#666', fontWeight: 500 };
  var bGrp = { marginBottom: 14 };

  if (loading) return <div style={{ color: '#777', fontSize: 12, padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (loadError) return <div style={{ color: '#c62828', fontSize: 12, padding: 20, background: '#ffebee', borderRadius: 8, border: '0.5px solid #ffcdd2' }}><strong>Supabase error:</strong> {loadError}<br/><br/>Make sure you've run the SQL setup in Supabase and that RLS is disabled on both tables.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Voting Topics</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{items.length} topic{items.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={function() { setShowAdmin(true); }} style={{ background: '#fff', color: '#555', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Admin
          </button>
          <button onClick={function() { setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add Topic</button>
        </div>
      </div>

      {items.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 40 }}>No voting items yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(function() {
          var byNewest = function(a, b) {
            var da = a.created_at ? new Date(a.created_at).getTime() : 0;
            var db = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (db !== da) return db - da;
            return (b.row_id || 0) - (a.row_id || 0);
          };
          var openItems = items.filter(function(i) { return !isRevealed(i); }).sort(byNewest);
          var closedItems = items.filter(function(i) { return isRevealed(i); }).sort(byNewest);
          var allItems = openItems.concat(closedItems);
          return allItems.map(function(item, idx) {
          var iv = itemVotes(item);
          var revealed = isRevealed(item);
          var t = tally(item);
          var showDivider = idx === openItems.length && closedItems.length > 0 && openItems.length > 0;
          return (
            <React.Fragment key={item.id}>
              {showDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <div style={{ flex: 1, height: '0.5px', background: '#e0d8cc' }} />
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Closed</span>
                  <div style={{ flex: 1, height: '0.5px', background: '#e0d8cc' }} />
                </div>
              )}
            <div
              key={item.id}
              onClick={function() { setSelected(item); setVoteForm({ voter: '', choice: '', note: '' }); }}
              style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#777' }}>
                    {item.submitted_by ? <span>Submitted by {item.submitted_by}{item.due_date ? ' · ' : ''}</span> : null}
                    {item.due_date ? <span>Due {fmtDate(item.due_date)}</span> : null}
                    {item.meeting_date ? <span> · Meeting {fmtDate(item.meeting_date)}</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#777' }}>{iv.length}/{BOARD_MEMBERS.length} voted</span>
                  {revealed
                    ? <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 4 }}>Closed</span>
                    : <span style={{ background: '#fff3e0', color: '#e65100', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 4 }}>Open</span>
                  }
                </div>
              </div>
              {revealed && (
                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                  {[['Yes', t.yes, '#2e7d32'], ['No', t.no, '#c62828'], ['Abstain', t.abstain, '#7c3aed']].map(function(entry) {
                    return <div key={entry[0]} style={{ fontSize: 12, color: entry[2], fontWeight: 600 }}>{entry[1]} {entry[0]}</div>;
                  })}
                </div>
              )}
            </div>
            </React.Fragment>
          );
          });
        })()}
      </div>

      {selected && (
        <>
        {isMobile && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1010 }} />}
        <div style={isMobile
          ? { position: 'fixed', left: 0, right: 0, bottom: 0, height: '88vh', background: '#fff', zIndex: 1011, boxShadow: '0 -4px 32px rgba(0,0,0,0.14)', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px 16px 0 0' }
          : { position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: '#fff', zIndex: 1011, boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }
        }>
          {isMobile && <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: '#e0d8cc' }} /></div>}
          <div style={{ padding: isMobile ? '8px 16px 12px' : '20px 24px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {!isMobile && <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>← Back</button>}
            {isMobile && <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.title}</div>}
            <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb', lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ padding: isMobile ? '14px 16px' : '24px 28px', flex: 1 }}>
            <div style={{ background: '#fff', borderRadius: 0 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#2a2a2a', marginBottom: 6 }}>{selected.title}</div>
                <div style={{ fontSize: 12, color: '#777' }}>
                  {selected.submitted_by ? <span>Submitted by {selected.submitted_by}</span> : null}
                  {selected.due_date ? <span> · Due {fmtDate(selected.due_date)}</span> : null}
                  {selected.meeting_date ? <span> · Meeting {fmtDate(selected.meeting_date)}</span> : null}
                </div>
            </div>

            {selected.description && (
              <div dangerouslySetInnerHTML={{ __html: selected.description }} style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 16, padding: '12px 14px', background: '#faf8f4', borderRadius: 0, borderLeft: '3px solid ' + gold }} />
            )}

            {selected.attachment_url && (
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, color: gold, fontWeight: 700, lineHeight: 1 }}>→</span>
                <a href={selected.attachment_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: gold, textDecoration: 'none', border: '2px solid ' + gold, borderRadius: '999px', padding: '6px 16px', background: '#fffdf7' }}>View Attachment</a>
              </div>
            )}

            {isRevealed(selected) ? (
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 12 }}>Results</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {(function() {
                    var t = tally(selected);
                    return [
                      { label: 'Yes', count: t.yes, bg: '#e8f5e9', border: '#a5d6a7', color: '#2e7d32' },
                      { label: 'No', count: t.no, bg: '#ffebee', border: '#ef9a9a', color: '#c62828' },
                      { label: 'Abstain / Not in Attendance', count: t.abstain + t.absent, bg: '#f3f0ff', border: '#c4b5fd', color: '#7c3aed' },
                    ].map(function(entry) {
                      return (
                        <div key={entry.label} style={{ background: entry.bg, border: '1px solid ' + entry.border, borderRadius: 4, padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 700, color: entry.color, lineHeight: 1 }}>{entry.count}</div>
                          <div style={{ fontSize: 12, color: entry.color, fontWeight: 600, marginTop: 4, opacity: 0.8 }}>{entry.label}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 10 }}>Individual Votes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {BOARD_MEMBERS.map(function(m) {
                    var mv = itemVotes(selected).find(function(v) { return v.voter === m; });
                    if (!mv) return (
                      <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 2, fontSize: 12 }}>
                        <span style={{ fontWeight: 500, color: '#2a2a2a' }}>{m}</span>
                        <span style={{ color: '#999' }}>—</span>
                        <span style={{ color: '#777', fontSize: 12 }}>No vote</span>
                      </div>
                    );
                    var vc = VOTE_COLORS[mv.choice] || { bg: '#f5f5f5', color: '#888' };
                    return (
                      <div key={m} style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 2, fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 500, color: '#2a2a2a' }}>{m}</span>
                          <span style={{ color: '#999' }}>—</span>
                          <span style={{ background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{mv.choice}</span>
                          {mv.changed_in_meeting && <span style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Changed in meeting</span>}
                        </div>
                        {mv.note && <div style={{ fontSize: 12, color: '#777', marginTop: 4, fontStyle: 'italic' }}>{mv.note}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a', marginBottom: 14 }}>Cast your vote</div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={bLbl}>Your name</label>
                    <select value={voteForm.voter} onChange={function(e) { setVoteForm(function(f) { return Object.assign({}, f, { voter: e.target.value, choice: '', note: '' }); }); }} style={Object.assign({}, bInp, { marginTop: 4 })}>
                      <option value="">Select name…</option>
                      {BOARD_MEMBERS.map(function(m) {
                        var hasVoted = itemVotes(selected).some(function(v) { return v.voter === m; });
                        return <option key={m} value={m} style={{ color: hasVoted ? '#bbb' : '#2a2a2a' }}>{m}{hasVoted ? ' (Already voted)' : ''}</option>;
                      })}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={bLbl}>Vote</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {['Yes', 'No', 'Abstain', 'Not in attendance'].map(function(opt) {
                        var vc2 = VOTE_COLORS[opt];
                        var active = voteForm.choice === opt;
                        return (
                          <button key={opt} type="button" onClick={function() { setVoteForm(function(f) { return Object.assign({}, f, { choice: opt }); }); }}
                            style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px solid ' + (active ? vc2.color : '#e0d8cc'), background: active ? vc2.bg : '#fff', color: active ? vc2.color : '#888', fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.1s' }}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <textarea value={voteForm.note} onChange={function(e) { setVoteForm(function(f) { return Object.assign({}, f, { note: e.target.value }); }); }} rows={2} style={Object.assign({}, bInp, { resize: 'vertical', marginBottom: 12 })} placeholder="Note (optional)…" />
                  <button onClick={handleVoteSubmit} disabled={voteSaving || !voteForm.choice || !voteForm.voter}
                    style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (voteSaving || !voteForm.choice || !voteForm.voter) ? 0.5 : 1 }}>
                    {voteSaving ? 'Saving…' : 'Submit Vote'}
                  </button>
                </div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 10 }}>
                  Vote Status · {itemVotes(selected).length}/{BOARD_MEMBERS.length} submitted
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {BOARD_MEMBERS.map(function(m) {
                    var mv = itemVotes(selected).find(function(v) { return v.voter === m; });
                    return (
                      <div key={m} style={{ background: '#fafafa', borderRadius: 6, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a', flex: 1 }}>{m}</span>
                        {mv
                          ? <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>✓ Voted</span>
                          : <span style={{ fontSize: 12, color: '#bbb' }}>No vote yet</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
        </>
      )}

      {showAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #f0ece6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a' }}>Vote Admin</div>
              <button onClick={function() { setShowAdmin(false); setAdminAuthed(false); setAdminPwInput(''); setAdminPwError(false); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>
            {!adminAuthed ? (
              <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13, color: '#555' }}>Enter admin password to continue</div>
                <input
                  type="password"
                  value={adminPwInput}
                  onChange={function(e) { setAdminPwInput(e.target.value); setAdminPwError(false); }}
                  onKeyDown={function(e) { if (e.key === 'Enter') { if (adminPwInput.trim() === 'JM1905') { setAdminAuthed(true); setAdminPwInput(''); } else { setAdminPwError(true); } } }}
                  placeholder="Password"
                  style={{ border: '0.5px solid ' + (adminPwError ? '#c62828' : '#d0c8bc'), borderRadius: 8, padding: '9px 14px', fontSize: 13, width: 220, outline: 'none' }}
                  autoFocus
                />
                {adminPwError && <div style={{ fontSize: 11, color: '#c62828' }}>Incorrect password</div>}
                <button onClick={function() { if (adminPwInput.trim() === 'JM1905') { setAdminAuthed(true); setAdminPwInput(''); } else { setAdminPwError(true); } }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Unlock</button>
              </div>
            ) : (
            <div style={{ padding: '16px 24px' }}>
              {items.length === 0
                ? <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: 32 }}>No voting items.</div>
                : (function() {
                    var byNewest = function(a, b) { var da = a.created_at ? new Date(a.created_at).getTime() : 0; var db = b.created_at ? new Date(b.created_at).getTime() : 0; if (db !== da) return db - da; return (b.row_id || 0) - (a.row_id || 0); };
                    var openItems = items.filter(function(i) { return !isRevealed(i); }).sort(byNewest);
                    var closedItems = items.filter(function(i) { return isRevealed(i); }).sort(byNewest);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {openItems.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>Open</div>}
                        {openItems.map(function(item) {
                          var t = tally(item);
                          var iv = itemVotes(item);
                          var won = isWon(item);
                          var isClosing = closingId === item.row_id;
                          return (
                            <div key={item.id} style={{ background: won ? '#f0faf0' : '#faf8f5', border: '0.5px solid ' + (won ? '#a5d6a7' : '#e8e0d5'), borderRadius: 10, padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{item.title}</div>
                                    {won && <span style={{ fontSize: 10, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 20 }}>Majority Yes</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8 }}>
                                    <span style={{ color: '#2e7d32', fontWeight: 600 }}>{t.yes} Yes</span>
                                    <span style={{ color: '#c62828', fontWeight: 600 }}>{t.no} No</span>
                                    <span style={{ color: '#7c3aed', fontWeight: 600 }}>{t.abstain + t.absent} Abstain</span>
                                    <span style={{ color: '#888' }}>{iv.length}/{BOARD_MEMBERS.length} voted</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {BOARD_MEMBERS.map(function(m) {
                                      var mv = iv.find(function(v) { return v.voter === m; });
                                      var vc = mv ? (VOTE_COLORS[mv.choice] || { bg: '#f5f5f5', color: '#888' }) : null;
                                      return (
                                        <span key={m} title={mv ? m + ': ' + mv.choice : m + ': No vote'} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: vc ? vc.bg : '#f0ece6', color: vc ? vc.color : '#bbb', fontWeight: vc ? 600 : 400 }}>
                                          {m.split(' ')[0]}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <button
                                  onClick={function() { closeVote(item); }}
                                  disabled={isClosing}
                                  style={{ background: won ? '#2e7d32' : '#fff', color: won ? '#fff' : '#555', border: '0.5px solid ' + (won ? '#2e7d32' : '#e0d8cc'), borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: isClosing ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                  {isClosing ? 'Closing…' : 'Close Vote'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {closedItems.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
                              <div style={{ flex: 1, height: '0.5px', background: '#e0d8cc' }} />
                              <span style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Closed</span>
                              <div style={{ flex: 1, height: '0.5px', background: '#e0d8cc' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {closedItems.map(function(item) {
                                var t = tally(item);
                                var iv = itemVotes(item);
                                var passed = isWon(item);
                                return (
                                  <div key={item.id} style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{item.title}</div>
                                          {passed
                                            ? <span style={{ fontSize: 10, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 20 }}>Passed</span>
                                            : t.no > t.yes
                                              ? <span style={{ fontSize: 10, fontWeight: 700, background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: 20 }}>Failed</span>
                                              : <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f0ea', color: '#888', padding: '2px 8px', borderRadius: 20 }}>Tied</span>
                                          }
                                        </div>
                                        <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                                          <span style={{ color: '#2e7d32', fontWeight: 600 }}>{t.yes} Yes</span>
                                          <span style={{ color: '#c62828', fontWeight: 600 }}>{t.no} No</span>
                                          <span style={{ color: '#7c3aed', fontWeight: 600 }}>{t.abstain + t.absent} Abstain</span>
                                          <span style={{ color: '#888' }}>{iv.length}/{BOARD_MEMBERS.length} voted</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
              }
            </div>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 4, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a', marginBottom: 20 }}>New Voting Topic</div>
            <form onSubmit={handleTopicSubmit}>
              <div style={bGrp}><label style={bLbl}>Title *</label><input required value={topicForm.title} onChange={function(e) { setTopicForm(function(f) { return Object.assign({}, f, { title: e.target.value }); }); }} style={bInp} placeholder="Topic title…" /></div>
              <div style={bGrp}><label style={bLbl}>Description</label><RichEditor value={topicForm.description} onChange={function(html) { setTopicForm(function(f) { return Object.assign({}, f, { description: html }); }); }} placeholder="Background, details, context…" /></div>
              <div style={bGrp}>
                <label style={bLbl}>Attachment</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '8px 12px', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 12 }}>
                  <span style={{ background: gold, color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{attachUploading ? 'Uploading…' : 'Choose file'}</span>
                  <span style={{ color: attachFileName ? '#2a2a2a' : '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachFileName || 'No file chosen'}</span>
                  <input type="file" onChange={handleAttachUpload} style={{ display: 'none' }} />
                </label>
                {topicForm.attachment_url && !attachUploading && <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 4 }}>✓ Uploaded</div>}
              </div>
              <div style={bGrp}><label style={bLbl}>Submitted By</label><input value={topicForm.submitted_by} onChange={function(e) { setTopicForm(function(f) { return Object.assign({}, f, { submitted_by: e.target.value }); }); }} style={bInp} placeholder="Name…" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label style={bLbl}>Due Date</label><input type="date" value={topicForm.due_date} onChange={function(e) { setTopicForm(function(f) { return Object.assign({}, f, { due_date: e.target.value }); }); }} style={bInp} /></div>
                <div><label style={bLbl}>Meeting Date</label><input type="date" value={topicForm.meeting_date} onChange={function(e) { setTopicForm(function(f) { return Object.assign({}, f, { meeting_date: e.target.value }); }); }} style={bInp} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={topicSaving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: topicSaving ? 0.7 : 1 }}>{topicSaving ? 'Saving…' : 'Add Topic'}</button>
                <button type="button" onClick={function() { setShowAdd(false); }} style={{ flex: 1, padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
var GOAL_STATUS_OPTS = ['Not started', 'In progress', 'On track', 'Complete', 'Blocked'];
var GOAL_STATUS_COLORS = {
  'On track': { bg: '#e8f5e9', color: '#2e7d32' },
  'In progress': { bg: '#fff3e0', color: '#e65100' },
  'Complete': { bg: '#e3f2fd', color: '#1565c0' },
  'Blocked': { bg: '#ffebee', color: '#c62828' },
  'Not started': { bg: '#f5f5f5', color: '#888' },
};
var GOAL_TYPE_LABELS = { annual: 'This Year', future: 'Future Goals', three_year_vision: '3-Year Vision' };
var CATEGORY_ORDER = ['Fund Development', 'House and Grounds Development', 'Programs and Events', 'Organizational Development'];

function BoardSlidesModal({ onClose }) {
  const { useState: useS, useEffect: useE } = React;
  var yr = new Date().getFullYear();
  var cq = 'Q' + Math.ceil((new Date().getMonth() + 1) / 3);
  const [selQ, setSelQ] = useS(cq);
  const [selYear, setSelYear] = useS(yr);
  const [opGoals, setOpGoals] = useS([]);
  const [opUpdates, setOpUpdates] = useS([]);
  const [champReviews, setChampReviews] = useS([]);
  const [boardData, setBoardData] = useS([]);
  const [loading, setLoading] = useS(true);
  const [editingArea, setEditingArea] = useS(null);
  const [editForm, setEditForm] = useS({});
  const [saving, setSaving] = useS(false);
  const [activeArea, setActiveArea] = useS(OPERATIONAL_AREAS[0]);

  function fetchAll(q, y) {
    setLoading(true);
    var base = SUPABASE_URL + '/rest/v1/';
    var qs = '?quarter=eq.' + q + '&year=eq.' + y + '&select=*';
    var hdrs = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    Promise.all([
      fetch(base + encodeURIComponent('Op Quarter Goals') + qs, { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(base + encodeURIComponent('Op Quarterly Updates') + qs, { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(base + encodeURIComponent('Op Co-Champion Reviews') + qs, { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(base + 'board_presentation' + qs, { headers: hdrs }).then(function(r) { return r.json(); }),
    ]).then(function(results) {
      setOpGoals(Array.isArray(results[0]) ? results[0] : []);
      setOpUpdates(Array.isArray(results[1]) ? results[1] : []);
      setChampReviews(Array.isArray(results[2]) ? results[2] : []);
      setBoardData(Array.isArray(results[3]) ? results[3] : []);
      setLoading(false);
    });
  }

  useE(function() { fetchAll(selQ, selYear); }, [selQ, selYear]);

  function forArea(arr, area) { return arr.find(function(r) { return r.area === area; }) || {}; }

  function openEdit(area) {
    var bd = forArea(boardData, area);
    setEditForm({ solution: bd.solution || '', further_details: bd.further_details || '', primary_focus_override: bd.primary_focus_override || '', board_notes: bd.board_notes || '' });
    setEditingArea(area);
  }

  function saveEdit(area) {
    setSaving(true);
    var bd = forArea(boardData, area);
    var method = bd.id ? 'PATCH' : 'POST';
    var url = SUPABASE_URL + '/rest/v1/board_presentation' + (bd.id ? '?id=eq.' + bd.id : '');
    var payload = Object.assign({ area: area, quarter: selQ, year: selYear }, editForm);
    fetch(url, {
      method: method,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(res) {
      var row = Array.isArray(res) ? res[0] : res;
      setBoardData(function(prev) {
        var next = prev.filter(function(r) { return r.area !== area; });
        if (row && row.id) next.push(row);
        return next;
      });
      setSaving(false);
      setEditingArea(null);
    }).catch(function() { setSaving(false); });
  }

  var slideCardStyle = { background: '#fff', border: '1px solid #d4c9b5', borderRadius: 4, overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', fontFamily: "'Calibri', 'Segoe UI', sans-serif" };
  var slideTitleStyle = { background: gold, color: '#fff', padding: '12px 20px', fontSize: 18, fontWeight: 700, fontFamily: "'Georgia', serif" };
  var slideBodyStyle = { padding: '16px 20px' };
  var sectionLabelStyle = { fontSize: 13, fontWeight: 700, color: '#2a2a2a', marginBottom: 6 };
  var bulletStyle = { fontSize: 13, color: '#333', marginLeft: 16, lineHeight: 1.8 };
  var boxStyle = { border: '1px solid #bbb', borderRadius: 2, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#333', lineHeight: 1.7 };
  var labelInBoxStyle = { fontWeight: 700, color: '#2a2a2a' };
  var sidebarStyle = { background: gold, color: '#fff', padding: '12px 14px', borderRadius: 3, minWidth: 180, maxWidth: 200, flexShrink: 0, fontSize: 12, lineHeight: 1.6 };

  function NeedsSlide(area) {
    var u = forArea(opUpdates, area);
    var bd = forArea(boardData, area);
    var isEditing = editingArea === area + '_needs';
    var toList = function(v) { if (Array.isArray(v)) return v.filter(Boolean); if (v && typeof v === 'string') return v.split('\n').filter(Boolean); return []; };
    var challenges = toList(u.challenges_details) .length ? toList(u.challenges_details) : toList(u.challenges);
    var support = toList(u.support_details).length ? toList(u.support_details) : toList(u.support_needed);
    var leadNotes = u.other_notes || '';
    var solution = isEditing ? editForm.solution : (bd.solution || '');
    var further = isEditing ? editForm.further_details : (bd.further_details || '');
    return (
      <div style={slideCardStyle}>
        <div style={slideTitleStyle}>{area} Needs</div>
        <div style={slideBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 }}>
            <div>
              <div style={sectionLabelStyle}>Challenges:</div>
              {challenges.length > 0
                ? <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{challenges.map(function(c, i) { return <li key={i} style={bulletStyle}>• {c}</li>; })}</ul>
                : <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>None submitted</div>}
            </div>
            <div>
              <div style={sectionLabelStyle}>Support Needed:</div>
              {support.length > 0
                ? <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{support.map(function(s, i) { return <li key={i} style={bulletStyle}>• {s}</li>; })}</ul>
                : <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>None submitted</div>}
            </div>
          </div>
          {leadNotes && <div style={{ marginBottom: 14 }}><span style={sectionLabelStyle}>Lead Notes: </span><span style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>{leadNotes}</span></div>}
          {(solution || further || isEditing) && (
            <div style={boxStyle}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>SOLUTION</div>
                    <textarea value={editForm.solution} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { solution: e.target.value }); }); }} style={{ width: '100%', border: '0.5px solid #d0c8bc', borderRadius: 4, padding: '6px 8px', fontSize: 13, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} placeholder="Solution…" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>FURTHER DETAILS</div>
                    <textarea value={editForm.further_details} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { further_details: e.target.value }); }); }} style={{ width: '100%', border: '0.5px solid #d0c8bc', borderRadius: 4, padding: '6px 8px', fontSize: 13, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} placeholder="Further details…" />
                  </div>
                </div>
              ) : (
                <div>
                  {solution && <div><span style={labelInBoxStyle}>Solution: </span>{solution}</div>}
                  {further && <div style={{ marginTop: solution ? 8 : 0 }}><span style={labelInBoxStyle}>Further Details: </span>{further}</div>}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {isEditing ? (
              <>
                <button onClick={function() { setEditingArea(null); }} style={{ fontSize: 11, background: 'none', border: '0.5px solid #ccc', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', color: '#666' }}>Cancel</button>
                <button onClick={function() { saveEdit(area); }} disabled={saving} style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 14px', cursor: 'pointer', fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button onClick={function() { openEdit(area + '_needs'); setEditForm(function(f) { var bd = forArea(boardData, area); return { solution: bd.solution || '', further_details: bd.further_details || '', primary_focus_override: bd.primary_focus_override || '', board_notes: bd.board_notes || '' }; }); setEditingArea(area + '_needs'); }} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 5, padding: '4px 12px', cursor: 'pointer' }}>Edit Slide</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function GoalsSlide(area) {
    var g = forArea(opGoals, area);
    var u = forArea(opUpdates, area);
    var cr = forArea(champReviews, area);
    var bd = forArea(boardData, area);
    var isEditing = editingArea === area + '_goals';
    var primaryFocus = (isEditing ? editForm.primary_focus_override : (bd.primary_focus_override || '')) || g.primary_focus || '';
    var boardNotes = isEditing ? editForm.board_notes : (bd.board_notes || '');
    var goals = goalEntries(g, u);
    var stColors = { 'On Track': '#2e7d32', 'Behind': '#c07040', 'Complete': '#2e7d32', 'At Risk': '#c62828' };
    return (
      <div style={slideCardStyle}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <div style={slideTitleStyle}>{selQ} Goals: {area}</div>
            <div style={slideBodyStyle}>
              {primaryFocus && <div style={Object.assign({}, boxStyle, { marginTop: 0, marginBottom: 14 })}><span style={labelInBoxStyle}>Primary Focus: </span>{primaryFocus}</div>}
              {goals.length === 0 && <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>No goals submitted for this quarter.</div>}
              {goals.map(function(entry, i) {
                var stColor = entry.status && stColors[entry.status] ? stColors[entry.status] : null;
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#2a2a2a' }}>
                      <span style={{ fontWeight: 700 }}>Goal {i + 1}:</span> {entry.text}
                      {entry.status && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: stColor || '#888', background: '#f5f0ea', padding: '1px 7px', borderRadius: 20 }}>{entry.status}</span>}
                    </div>
                    {entry.summary && <div style={{ fontSize: 12, color: '#666', marginLeft: 16, marginTop: 2 }}>{entry.summary}</div>}
                  </div>
                );
              })}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {isEditing ? (
                  <>
                    <button onClick={function() { setEditingArea(null); }} style={{ fontSize: 11, background: 'none', border: '0.5px solid #ccc', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', color: '#666' }}>Cancel</button>
                    <button onClick={function() { saveEdit(area); }} disabled={saving} style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 14px', cursor: 'pointer', fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
                  </>
                ) : (
                  <button onClick={function() { var bd = forArea(boardData, area); setEditForm({ solution: bd.solution || '', further_details: bd.further_details || '', primary_focus_override: bd.primary_focus_override || '', board_notes: bd.board_notes || '' }); setEditingArea(area + '_goals'); }} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 5, padding: '4px 12px', cursor: 'pointer' }}>Edit Slide</button>
                )}
              </div>
            </div>
          </div>
          <div style={sidebarStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '0.5px solid rgba(255,255,255,0.3)', paddingBottom: 6, marginBottom: 8 }}>Co-Champion Notes</div>
            {cr.discussion_focus && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Focus: </span>{cr.discussion_focus}</div>}
            {cr.potential_actions && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Actions: </span>{cr.potential_actions}</div>}
            {!cr.discussion_focus && !cr.potential_actions && <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No review yet</div>}
            {isEditing && (
              <div style={{ marginTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.3)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>PRIMARY FOCUS OVERRIDE</div>
                <textarea value={editForm.primary_focus_override} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { primary_focus_override: e.target.value }); }); }} style={{ width: '100%', border: 'none', borderRadius: 3, padding: '5px 7px', fontSize: 11, minHeight: 50, resize: 'vertical', boxSizing: 'border-box', color: '#2a2a2a' }} placeholder="Override primary focus…" />
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, marginTop: 8 }}>BOARD NOTES</div>
                <textarea value={editForm.board_notes} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { board_notes: e.target.value }); }); }} style={{ width: '100%', border: 'none', borderRadius: 3, padding: '5px 7px', fontSize: 11, minHeight: 60, resize: 'vertical', boxSizing: 'border-box', color: '#2a2a2a' }} placeholder="Board notes…" />
              </div>
            )}
            {!isEditing && boardNotes && (
              <div style={{ marginTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.3)', paddingTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Board Notes:</div>
                <div>{boardNotes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', overflowY: 'auto' }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#f7f3ec', borderRadius: 10, width: '100%', maxWidth: 820, minHeight: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '0.5px solid #e8e0d5', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Editable Board Slides</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Populates from quarterly submissions + co-champion reviews</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={selQ} onChange={function(e) { setSelQ(e.target.value); }} style={{ fontSize: 12, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '5px 8px', background: '#fff', color: '#2a2a2a' }}>
              {['Q1','Q2','Q3','Q4'].map(function(q) { return <option key={q}>{q}</option>; })}
            </select>
            <select value={selYear} onChange={function(e) { setSelYear(Number(e.target.value)); }} style={{ fontSize: 12, border: '0.5px solid #d0c8bc', borderRadius: 6, padding: '5px 8px', background: '#fff', color: '#2a2a2a' }}>
              {[yr-1, yr, yr+1].map(function(y) { return <option key={y}>{y}</option>; })}
            </select>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb', lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Area nav */}
        <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '0.5px solid #f0ece6', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OPERATIONAL_AREAS.map(function(a) {
            return <button key={a} onClick={function() { setActiveArea(a); setEditingArea(null); }} style={{ fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 20, border: '0.5px solid ' + (activeArea === a ? gold : '#d0c8bc'), background: activeArea === a ? gold : '#fff', color: activeArea === a ? '#fff' : '#555', cursor: 'pointer' }}>{a}</button>;
          })}
        </div>
        {/* Slides */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 13 }}>Loading…</div>
          ) : (
            <div>
              {NeedsSlide(activeArea)}
              {GoalsSlide(activeArea)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StrategyView() {
  const { useState: useS, useEffect: useE } = React;
  var isMobile = React.useContext(MobileCtx);
  const [goals, setGoals] = useS([]);
  const [loading, setLoading] = useS(true);
  const [tab, setTab] = useS('annual');
  const [activeCat, setActiveCat] = useS(null);
  const [editing, setEditing] = useS(null);
  const [editForm, setEditForm] = useS({});
  const [saving, setSaving] = useS(false);
  const [showUpdatesFor, setShowUpdatesFor] = useS(null);
  const [slides, setSlides] = useS({});
  const [uploadingQ, setUploadingQ] = useS(null);
  const [showBoardSlides, setShowBoardSlides] = useS(false);

  var SLIDE_YEAR = new Date().getFullYear();
  var SLIDE_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  var SLIDE_BUCKET = 'strategic-plan-slides';

  useE(function() {
    var loaded = {};
    var checks = SLIDE_QUARTERS.map(function(q) {
      var url = SUPABASE_URL + '/storage/v1/object/public/' + SLIDE_BUCKET + '/' + SLIDE_YEAR + '/' + q + '.pdf';
      return fetch(url, { method: 'HEAD' }).then(function(r) {
        if (r.ok) loaded[q] = url;
      }).catch(function() {});
    });
    Promise.all(checks).then(function() { setSlides(Object.assign({}, loaded)); });
  }, []);

  function uploadSlide(q, file) {
    if (!file) return;
    setUploadingQ(q);
    var path = SLIDE_YEAR + '/' + q + '.pdf';
    var url = SUPABASE_URL + '/storage/v1/object/' + SLIDE_BUCKET + '/' + path;
    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: file,
    }).then(function(r) {
      if (!r.ok) { r.text().then(function(t) { alert('Upload failed: ' + t); }); setUploadingQ(null); return; }
      var publicUrl = SUPABASE_URL + '/storage/v1/object/public/' + SLIDE_BUCKET + '/' + path + '?t=' + Date.now();
      setSlides(function(prev) { return Object.assign({}, prev, { [q]: publicUrl }); });
      setUploadingQ(null);
    }).catch(function(e) { alert('Upload error: ' + e.message); setUploadingQ(null); });
  }

  function load(bustCache) {
    if (bustCache) clearCache('Strategic Goals');
    cachedFetchAll('Strategic Goals').then(function(d) {
      var sorted = Array.isArray(d) ? d.slice().sort(function(a,b){ return (a.category||'').localeCompare(b.category||'') || a.id - b.id; }) : [];
      setGoals(sorted); setLoading(false);
    });
  }
  useE(function() { load(); }, []);

  function openEdit(g) {
    setEditing(g.id);
    setEditForm({ status: g.status || 'Not started', lead: g.lead || '', due_date: g.due_date || '', updates: g.updates || '' });
  }

  function handleSave(g) {
    setSaving(true);
    sbPatchById('Strategic Goals', g.id, editForm).then(function() {
      setSaving(false);
      setEditing(null);
      load(true);
    });
  }

  var tabStyle = function(t) {
    return { padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 5, cursor: 'pointer',
      background: tab === t ? gold : '#f0ebe2', color: tab === t ? '#fff' : '#666' };
  };

  if (loading) return <div style={{ padding: 40, color: '#777', fontSize: 12 }}>Loading…</div>;

  var filtered = activeCat ? goals.filter(function(g) { return g.goal_type === tab && g.category === activeCat; }) : [];

  function CatBox(cat) {
    var catGoals = goals.filter(function(g) { return g.category === cat && g.goal_type !== 'three_year_vision'; });
    var done = catGoals.filter(function(g) { return g.status === 'Complete'; }).length;
    var inprog = catGoals.filter(function(g) { return g.status === 'In progress' || g.status === 'On track'; }).length;
    var pct = catGoals.length ? Math.round((done / catGoals.length) * 100) : 0;
    var inprogPct = catGoals.length ? Math.round((inprog / catGoals.length) * 100) : 0;
    return (
      <div key={cat} onClick={function() { setActiveCat(cat); setEditing(null); }}
        style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
        onMouseEnter={function(e) { e.currentTarget.style.borderColor = gold; e.currentTarget.style.background = '#fdf8f0'; }}
        onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e8e0d5'; e.currentTarget.style.background = '#fff'; }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', marginBottom: 12, lineHeight: 1.3 }}>{cat}</div>
        <div style={{ height: 10, background: '#ede8e0', borderRadius: 99, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
          <div style={{ width: pct + '%', background: '#4caf50', transition: 'width 0.4s' }} />
          <div style={{ width: inprogPct + '%', background: '#f5a623', transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888' }}>
          <span style={{ color: '#4caf50', fontWeight: 600 }}>{done} complete</span>
          <span>{inprog} in progress</span>
          <span>{catGoals.length - done - inprog} not started</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {showBoardSlides && <BoardSlidesModal onClose={function() { setShowBoardSlides(false); }} />}
      {!activeCat ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
              View progress across strategic goals at a glance. Click any progress line to see more details for that focus area.
            </div>
            <button onClick={function() { setShowBoardSlides(true); }} style={{ flexShrink: 0, marginLeft: 16, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Editable Slides
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {CATEGORY_ORDER.map(function(cat) { return CatBox(cat); })}
          </div>

          {/* Quarterly Plan Slides */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0ece6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>Quarterly Plan Slides</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{SLIDE_YEAR} — upload a PDF slide deck for each quarter</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', borderTop: 'none' }}>
              {SLIDE_QUARTERS.map(function(q, i) {
                var url = slides[q];
                var busy = uploadingQ === q;
                var inputId = 'slide-upload-' + q;
                return (
                  <div key={q} style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderLeft: i > 0 ? '0.5px solid #f0ece6' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>{q}</div>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: url ? '#fdecea' : '#faf8f5', border: url ? '0.5px solid #f5c6c2' : '1.5px dashed #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={url ? '#e57373' : '#ccc'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                      </svg>
                    </div>
                    {url ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <a href={url.split('?')[0]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: gold, textDecoration: 'underline' }}>View PDF</a>
                        <label htmlFor={inputId} style={{ fontSize: 11, color: '#bbb', cursor: 'pointer', textDecoration: 'underline' }}>Replace</label>
                      </div>
                    ) : (
                      <label htmlFor={inputId} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', border: '0.5px solid #e0d8cc', borderRadius: 20, color: busy ? '#aaa' : '#666', cursor: busy ? 'default' : 'pointer', background: '#faf8f5' }}>
                        {busy ? 'Uploading…' : 'Upload PDF'}
                      </label>
                    )}
                    <input id={inputId} type="file" accept="application/pdf" style={{ display: 'none' }}
                      onChange={function(e) { var f = e.target.files && e.target.files[0]; if (f) uploadSlide(q, f); e.target.value = ''; }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{activeCat}</div>
          <button onClick={function() { setActiveCat(null); setEditing(null); setShowUpdatesFor(null); }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '4px 8px' }}>← All areas</button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: '#bbb', fontSize: 13, fontStyle: 'italic', padding: '10px 0' }}>No goals for this area.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {filtered.map(function(g) {
                var sc = GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS['Not started'];
                var isEdit = editing === g.id;
                return (
                  <div key={g.id} style={{ background: '#faf8f5', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: 12, color: '#777', lineHeight: 1.5 }}>{g.description}</div>}
                      </div>
                      {tab !== 'three_year_vision' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {g.status && <span style={{ background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{g.status}</span>}
                          <button onClick={function() { isEdit ? setEditing(null) : openEdit(g); }}
                            style={{ fontSize: 12, color: isEdit ? '#aaa' : gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
                            {isEdit ? 'Cancel' : 'Edit'}
                          </button>
                        </div>
                      )}
                    </div>
                    {tab !== 'three_year_vision' && !isEdit && (g.lead || g.due_date) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                        {g.lead && <div style={{ fontSize: 12, color: '#777' }}>Lead: <span style={{ color: '#555' }}>{g.lead}</span></div>}
                        {g.due_date && <div style={{ fontSize: 12, color: '#777' }}>Date: <span style={{ color: '#555' }}>{g.due_date}</span></div>}
                      </div>
                    )}
                    {tab !== 'three_year_vision' && !isEdit && showUpdatesFor === g.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #f0ece6' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 6 }}>Updates</div>
                        {g.updates
                          ? <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{g.updates}</div>
                          : <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>No updates yet.</div>}
                      </div>
                    )}
                    {tab !== 'three_year_vision' && !isEdit && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={function() { setShowUpdatesFor(showUpdatesFor === g.id ? null : g.id); }}
                          style={{ fontSize: 11, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}>
                          {showUpdatesFor === g.id ? 'Hide Updates' : 'View Updates'}
                        </button>
                      </div>
                    )}
                    {isEdit && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #f0ebe2' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 12, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Status</label>
                            <select value={editForm.status} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { status: e.target.value }); }); }}
                              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                              {GOAL_STATUS_OPTS.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Lead</label>
                            <input value={editForm.lead} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { lead: e.target.value }); }); }}
                              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} placeholder="Name…" />
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Date</label>
                          <input type="date" value={editForm.due_date} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { due_date: e.target.value }); }); }}
                            style={{ padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12 }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Updates</label>
                          <textarea value={editForm.updates || ''} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { updates: e.target.value }); }); }}
                            rows={3} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }} placeholder="Latest progress, notes…" />
                        </div>
                        <button onClick={function() { handleSave(g); }} disabled={saving}
                          style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <div style={{ borderTop: '0.5px solid #f0ece6', paddingTop: 14, marginTop: 4, display: 'flex', gap: 8 }}>
          {['annual', 'future', 'three_year_vision'].map(function(t) {
            return <button key={t} onClick={function() { setTab(t); setEditing(null); setShowUpdatesFor(null); }} style={tabStyle(t)}>{GOAL_TYPE_LABELS[t]}</button>;
          })}
        </div>
      </div>
      )}
    </div>
  );
}

var CHALLENGE_OPTIONS = ['Capacity or volunteer limitations','Budget or funding constraints','Scheduling or timing issues','Cross-area coordination gaps','External factors','Other'];
var SUPPORT_OPTIONS = ['Staff or volunteer help','Marketing or communications','Board guidance or decision','Funding or fundraising support','Facilities or logistics','Other'];

function currentQuarterStr() { var m = new Date().getMonth(); return m <= 2 ? 'Q1' : m <= 5 ? 'Q2' : m <= 8 ? 'Q3' : 'Q4'; }
function quarterDueDate(q, yr) {
  if (q === 'Q1') return new Date(yr, 2, 31);
  if (q === 'Q2') return new Date(yr, 5, 30);
  if (q === 'Q3') return new Date(yr, 8, 30);
  return new Date(yr, 11, 10);
}
function nextUpcomingDue() {
  var now = new Date(); now.setHours(0,0,0,0);
  var yr = now.getFullYear();
  var candidates = ['Q1','Q2','Q3','Q4'].map(function(q) { return { q: q, yr: yr, date: quarterDueDate(q, yr) }; })
    .concat(['Q1','Q2','Q3','Q4'].map(function(q) { return { q: q, yr: yr+1, date: quarterDueDate(q, yr+1) }; }));
  return candidates.find(function(c) { return c.date >= now; }) || candidates[0];
}
function nextQ(q, yr) { return q === 'Q1' ? {q:'Q2',yr:yr} : q === 'Q2' ? {q:'Q3',yr:yr} : q === 'Q3' ? {q:'Q4',yr:yr} : {q:'Q1',yr:yr+1}; }
// Builds the full list of goals (fixed goal_1..3 plus any extra_goals) for a quarter, merging in-progress update fields (u) over the stored goal-row fields (g).
function goalEntries(g, u) {
  g = g || {}; u = u || {};
  var out = [];
  ['1','2','3'].forEach(function(n) {
    var text = g['goal_' + n];
    if (!text) return;
    out.push({ text: text, status: u['goal_' + n + '_status'] || g['goal_' + n + '_status'], summary: u['goal_' + n + '_summary'] || g['goal_' + n + '_summary'] });
  });
  var extra = Array.isArray(g.extra_goals) ? g.extra_goals : [];
  extra.forEach(function(text, i) {
    if (!text) return;
    var status = (Array.isArray(u.extra_goals_status) && u.extra_goals_status[i]) || (Array.isArray(g.extra_goals_status) && g.extra_goals_status[i]);
    var summary = (Array.isArray(u.extra_goals_summary) && u.extra_goals_summary[i]) || (Array.isArray(g.extra_goals_summary) && g.extra_goals_summary[i]);
    out.push({ text: text, status: status, summary: summary, extraIndex: i });
  });
  return out;
}

function QuarterlyView({ navigateOp, quarterlyArea, navigateToQuarterly }) {
  var { useState, useEffect } = React;
  var isMobile = React.useContext(MobileCtx);
  var cq = currentQuarterStr();
  var cy = new Date().getFullYear();
  var [area, setArea] = useState(quarterlyArea || '');
  var [quarter, setQuarter] = useState(cq);
  var [year, setYear] = useState(cy);
  var [currentGoals, setCurrentGoals] = useState(null);
  var emptyForm = { what_went_well: '', goal_1_status: 'On Track', goal_1_summary: '', goal_2_status: 'On Track', goal_2_summary: '', goal_3_status: 'On Track', goal_3_summary: '', challenges: [], challenges_details: '', support_needed: [], support_details: '', other_notes: '', next_focus: '', goal_1: '', goal_2: '', goal_3: '', extra_goals: [], extra_goals_status: [], extra_goals_summary: [] };
  var [form, setForm] = useState(emptyForm);
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);
  var [existingReflection, setExistingReflection] = useState(null);

  useEffect(function() {
    if (!area) return;
    setExistingReflection(null);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*&order=date_submitted.desc&limit=1', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows) && rows[0]) {
        var r = rows[0];
        setExistingReflection(r);
        setForm(function(f) {
          return Object.assign({}, f, {
            what_went_well: r.successes || '',
            goal_1_status: r.goal_1_status || 'On Track',
            goal_1_summary: r.goal_1_summary || '',
            goal_2_status: r.goal_2_status || 'On Track',
            goal_2_summary: r.goal_2_summary || '',
            goal_3_status: r.goal_3_status || 'On Track',
            goal_3_summary: r.goal_3_summary || '',
            challenges: r.challenges || [],
            challenges_details: r.challenges_details || '',
            support_needed: r.support_needed || [],
            support_details: r.support_details || '',
            other_notes: r.other_notes || '',
            next_focus: r.next_focus || '',
            goal_1: r.goal_1 || '',
            goal_2: r.goal_2 || '',
            goal_3: r.goal_3 || '',
            extra_goals: r.extra_goals || [],
            extra_goals_status: r.extra_goals_status || [],
            extra_goals_summary: r.extra_goals_summary || [],
          });
        });
      }
    });
  }, [area, quarter, year]);

  useEffect(function() {
    if (!area) return;
    setCurrentGoals(null);
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*').then(function(rows) {
      if (rows && rows[0]) {
        setCurrentGoals(rows[0]);
        setForm(function(f) {
          return Object.assign({}, f, {
            goal_1_status: rows[0].goal_1_status || 'On Track',
            goal_1_summary: rows[0].goal_1_summary || '',
            goal_2_status: rows[0].goal_2_status || 'On Track',
            goal_2_summary: rows[0].goal_2_summary || '',
            goal_3_status: rows[0].goal_3_status || 'On Track',
            goal_3_summary: rows[0].goal_3_summary || '',
            extra_goals_status: rows[0].extra_goals_status || [],
            extra_goals_summary: rows[0].extra_goals_summary || []
          });
        });
      }
    });
  }, [area, quarter, year]);

  function toggleCheck(field, val) {
    setForm(function(f) {
      var arr = f[field];
      var next = arr.indexOf(val) !== -1 ? arr.filter(function(x) { return x !== val; }) : arr.concat([val]);
      var patch = {}; patch[field] = next;
      return Object.assign({}, f, patch);
    });
  }

  function setArrayAt(field, i, val) {
    setForm(function(f) {
      var arr = f[field].slice();
      arr[i] = val;
      var patch = {}; patch[field] = arr;
      return Object.assign({}, f, patch);
    });
  }

  function addExtraGoal() {
    setForm(function(f) { return Object.assign({}, f, { extra_goals: f.extra_goals.concat(['']) }); });
  }

  function removeExtraGoal(i) {
    setForm(function(f) { return Object.assign({}, f, { extra_goals: f.extra_goals.filter(function(_, idx) { return idx !== i; }) }); });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    var nq = nextQ(quarter, year);
    var payload = { area: area, quarter: quarter, year: year, date_submitted: new Date().toISOString().slice(0,10), successes: form.what_went_well, goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary, extra_goals_status: form.extra_goals_status, extra_goals_summary: form.extra_goals_summary, challenges: form.challenges, challenges_details: form.challenges_details, support_needed: form.support_needed, support_details: form.support_details, other_notes: form.other_notes, next_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3, extra_goals: form.extra_goals };
    var currentGoalsUpdate = currentGoals ? fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?id=eq.' + currentGoals.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary, extra_goals_status: form.extra_goals_status, extra_goals_summary: form.extra_goals_summary })
    }) : Promise.resolve();
    var reflectionFetch = existingReflection
      ? fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?id=eq.' + existingReflection.id, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({}, payload, { date_submitted: new Date().toISOString().slice(0,10) }))
        })
      : fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates'), {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        });
    reflectionFetch.then(function(r) { return r.status === 204 ? null : r.json(); }).then(function() {
      var goalsPayload = { area: area, quarter: nq.q, year: nq.yr, primary_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3, extra_goals: form.extra_goals.filter(Boolean) };
      var headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
      var nextGoalsSave = fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(nq.q) + '&year=eq.' + nq.yr, { headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(rows) {
          if (Array.isArray(rows) && rows[0]) {
            return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?id=eq.' + rows[0].id, {
              method: 'PATCH', headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }), body: JSON.stringify(goalsPayload)
            });
          } else {
            return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals'), {
              method: 'POST', headers: Object.assign({}, headers, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(goalsPayload)
            });
          }
        });
      return Promise.all([nextGoalsSave, currentGoalsUpdate]);
    }).then(function() {
      clearCache('Op Quarter Goals');
      clearCache('Op Quarterly Updates');
      setSaving(false);
      logActivity(area + ' submitted their ' + quarter + ' ' + year + ' quarterly review', 'quarterly_review_submitted');
      if (navigateOp && area) { navigateOp(area); } else { setSaved(true); setTimeout(function() { setSaved(false); }, 4000); }
    });
  }

  var secStyle = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 12, marginTop: 4, display: 'block' };
  var inpStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 14, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#2a2a2a' };
  var grp = { marginBottom: 16 };
  var card = { background: '#fff', border: '0.5px solid #e8e0d5', borderTop: 'none', padding: '22px 28px' };
  var cardFirst = { background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: '10px 10px 0 0', padding: '22px 28px' };
  var cardLast = { background: '#fff', border: '0.5px solid #e8e0d5', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '22px 28px', marginBottom: 20 };
  var lbl = { fontSize: 13, color: '#444', fontWeight: 500 };
  var nqLabel = nextQ(quarter, year).q + ' ' + nextQ(quarter, year).yr;

  return (
    <div style={{ maxWidth: "100%" }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 8 }}>About Quarterly Updates</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, fontStyle: 'italic' }}>Share quarterly progress, challenges, and support needs for each focus area.</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['1', 'Area lead submits this form'], ['2', 'Co-Champions review submissions'], ['3', 'Discussed as main item on Board agenda']].map(function(s) {
              return (
                <div key={s[0]} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: '#666' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: gold, color: '#fff', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s[0]}</span>
                  {s[1]}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 10 }}>Quarterly Schedule</div>
          {(function() {
            var all = [
              { q: 'Q1', dates: 'Jan 1 – Mar 31', due: 'Mar 31', champion: 'Apr 2', board: 'Apr 16' },
              { q: 'Q2', dates: 'Apr 1 – Jun 30', due: 'Jun 30', champion: 'Jul 2', board: 'Jul 16' },
              { q: 'Q3', dates: 'Jul 1 – Sep 30', due: 'Sep 30', champion: 'Oct 1', board: 'Oct 15' },
              { q: 'Q4', dates: 'Oct 1 – Dec 31', due: 'Dec 10', champion: 'Dec 10', board: 'Dec 17' },
            ];
            var ci = all.findIndex(function(x) { return x.q === quarter; });
            var next = all[(ci + 1) % 4];
            var visible = [all[ci], next];
            return visible.map(function(q, idx) {
              var isCurrent = idx === 0;
              return (
                <div key={q.q} style={{ marginBottom: idx === 0 ? 10 : 0, paddingBottom: idx === 0 ? 10 : 0, borderBottom: idx === 0 ? '0.5px solid #ede5d8' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? gold : '#888' }}>{q.q}</span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>{q.dates}</span>
                    {isCurrent && <span style={{ fontSize: 10, background: gold, color: '#fff', borderRadius: 20, padding: '1px 7px', fontWeight: 600 }}>Current</span>}
                    {!isCurrent && <span style={{ fontSize: 10, color: '#bbb', fontStyle: 'italic' }}>Up next</span>}
                  </div>
                  <div style={{ fontSize: 11, color: isCurrent ? '#777' : '#aaa', lineHeight: 1.8, paddingLeft: 2 }}>
                    <span style={{ color: isCurrent ? '#999' : '#bbb' }}>Due:</span> {q.due} &nbsp;·&nbsp; <span style={{ color: isCurrent ? '#999' : '#bbb' }}>Co-Champions:</span> {q.champion} &nbsp;·&nbsp; <span style={{ color: isCurrent ? '#999' : '#bbb' }}>Board:</span> {q.board}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={cardFirst}>
          <span style={secStyle}>Area & Period</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={grp}>
              <label style={lbl}>Organizational Area *</label>
              <select required value={area} onChange={function(e) { setArea(e.target.value); }} style={inpStyle}>
                <option value="">Select area...</option>
                {OPERATIONAL_AREAS.map(function(a) { return <option key={a}>{a}</option>; })}
              </select>
            </div>
            <div style={grp}>
              <label style={lbl}>Quarter *</label>
              <select required value={quarter} onChange={function(e) { setQuarter(e.target.value); }} style={inpStyle}>
                <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
              </select>
            </div>
            <div style={grp}>
              <label style={lbl}>Year</label>
              <input type="number" value={year} onChange={function(e) { setYear(parseInt(e.target.value) || cy); }} style={inpStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date Submitted</label><input readOnly value={new Date().toLocaleDateString('en-US')} style={Object.assign({}, inpStyle, { background: '#f9f7f4', color: '#999' })} /></div>
            <div><label style={lbl}>Due Date</label><input readOnly value={quarterDueDate(quarter, year).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} style={Object.assign({}, inpStyle, { background: '#f9f7f4', color: '#999' })} /></div>
          </div>
        </div>

        <div style={card}>
          <span style={secStyle}>Goal Progress</span>
          {currentGoals && currentGoals.primary_focus && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#faf8f5', borderRadius: 6, borderLeft: '3px solid ' + gold }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: gold, fontWeight: 600, marginBottom: 4 }}>Primary Focus — {quarter} {year}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{currentGoals.primary_focus}</div>
            </div>
          )}
          {currentGoals ? (
            [['goal_1','goal_1_status','goal_1_summary'], ['goal_2','goal_2_status','goal_2_summary'], ['goal_3','goal_3_status','goal_3_summary']].map(function(keys, i) {
              var goalText = currentGoals[keys[0]];
              if (!goalText) return null;
              var statusKey = keys[1]; var summaryKey = keys[2];
              var statusColors = { 'On Track': { bg: '#eaf3ea', color: '#3a7d3a' }, 'Behind': { bg: '#fff3e0', color: '#c07040' }, 'Complete': { bg: '#e8f5e9', color: '#2e7d32' }, 'At Risk': { bg: '#fdecea', color: '#c62828' } };
              var sc = statusColors[form[statusKey]] || statusColors['On Track'];
              return (
                <div key={keys[0]} style={{ borderBottom: i < 2 ? '0.5px solid #f0ece6' : 'none', paddingBottom: 14, marginBottom: i < 2 ? 14 : 0 }}>
                  <div style={{ fontSize: 14, color: '#2a2a2a', fontWeight: 500, marginBottom: 8 }}>{i+1}. {goalText}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
                    <div>
                      <label style={lbl}>Status</label>
                      <select value={form[statusKey]} onChange={function(e) { var v = e.target.value; setForm(function(f) { var p = {}; p[statusKey] = v; return Object.assign({}, f, p); }); }} style={Object.assign({}, inpStyle, { background: sc.bg, color: sc.color, fontWeight: 600 })}>
                        <option>On Track</option><option>Behind</option><option>At Risk</option><option>Complete</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Progress Summary</label>
                      <input value={form[summaryKey]} onChange={function(e) { var v = e.target.value; setForm(function(f) { var p = {}; p[summaryKey] = v; return Object.assign({}, f, p); }); }} style={inpStyle} placeholder="Brief update on this goal..." />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>Select an area and quarter to update goal statuses.</div>
          )}
          {currentGoals && Array.isArray(currentGoals.extra_goals) && currentGoals.extra_goals.map(function(goalText, i) {
            if (!goalText) return null;
            var statusColors = { 'On Track': { bg: '#eaf3ea', color: '#3a7d3a' }, 'Behind': { bg: '#fff3e0', color: '#c07040' }, 'Complete': { bg: '#e8f5e9', color: '#2e7d32' }, 'At Risk': { bg: '#fdecea', color: '#c62828' } };
            var st = form.extra_goals_status[i] || 'On Track';
            var sc = statusColors[st] || statusColors['On Track'];
            return (
              <div key={'extra_' + i} style={{ borderTop: '0.5px solid #f0ece6', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 14, color: '#2a2a2a', fontWeight: 500, marginBottom: 8 }}>{4 + i}. {goalText}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
                  <div>
                    <label style={lbl}>Status</label>
                    <select value={st} onChange={function(e) { setArrayAt('extra_goals_status', i, e.target.value); }} style={Object.assign({}, inpStyle, { background: sc.bg, color: sc.color, fontWeight: 600 })}>
                      <option>On Track</option><option>Behind</option><option>At Risk</option><option>Complete</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Progress Summary</label>
                    <input value={form.extra_goals_summary[i] || ''} onChange={function(e) { setArrayAt('extra_goals_summary', i, e.target.value); }} style={inpStyle} placeholder="Brief update on this goal..." />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={card}>
          <span style={secStyle}>What Went Well</span>
          <div style={grp}>
            <label style={lbl}>Successes & Forward Movement</label>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Goals achieved and measurable progress this quarter.</div>
            <textarea value={form.what_went_well} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { what_went_well: e.target.value }); }); }} rows={4} style={Object.assign({}, inpStyle, { resize: 'vertical' })} />
          </div>
        </div>

        <div style={card}>
          <span style={secStyle}>Challenges Encountered</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {CHALLENGE_OPTIONS.map(function(opt) {
              var on = form.challenges.indexOf(opt) !== -1;
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', color: on ? '#2a2a2a' : '#555', userSelect: 'none' }}>
                  <input type="checkbox" checked={on} onChange={function() { toggleCheck('challenges', opt); }} style={{ width: 16, height: 16, accentColor: gold, cursor: 'pointer', flexShrink: 0 }} />
                  {opt}
                </label>
              );
            })}
          </div>
          <div style={grp}>
            <label style={lbl}>Details</label>
            <textarea value={form.challenges_details} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { challenges_details: e.target.value }); }); }} rows={3} style={Object.assign({}, inpStyle, { resize: 'vertical' })} />
          </div>
        </div>

        <div style={card}>
          <span style={secStyle}>Support Needed to Stay on Track</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {SUPPORT_OPTIONS.map(function(opt) {
              var on = form.support_needed.indexOf(opt) !== -1;
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', color: on ? '#2a2a2a' : '#555', userSelect: 'none' }}>
                  <input type="checkbox" checked={on} onChange={function() { toggleCheck('support_needed', opt); }} style={{ width: 16, height: 16, accentColor: gold, cursor: 'pointer', flexShrink: 0 }} />
                  {opt}
                </label>
              );
            })}
          </div>
          <div style={grp}>
            <label style={lbl}>Details</label>
            <textarea value={form.support_details} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { support_details: e.target.value }); }); }} rows={3} style={Object.assign({}, inpStyle, { resize: 'vertical' })} />
          </div>
        </div>

        <div style={card}>
          <span style={secStyle}>Other Notes</span>
          <div style={grp}>
            <label style={lbl}>Decisions or approvals needed</label>
            <textarea value={form.other_notes} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { other_notes: e.target.value }); }); }} rows={3} style={Object.assign({}, inpStyle, { resize: 'vertical' })} />
          </div>
        </div>

        <div style={cardLast}>
          <span style={secStyle}>Next Quarter Focus & Goals</span>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>These will auto-populate as {nqLabel} goals for {area || 'this area'}.</div>
          <div style={grp}>
            <label style={lbl}>Primary Focus for Next Quarter</label>
            <input value={form.next_focus} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { next_focus: e.target.value }); }); }} style={inpStyle} placeholder="Primary focus..." />
          </div>
          {['goal_1','goal_2','goal_3'].map(function(key, i) {
            return (
              <div key={key} style={grp}>
                <label style={lbl}>{i+1}.</label>
                <input value={form[key]} onChange={function(e) { var v = e.target.value; setForm(function(f) { var p = {}; p[key] = v; return Object.assign({}, f, p); }); }} style={inpStyle} placeholder={'Goal ' + (i+1) + '...'} />
              </div>
            );
          })}
          {form.extra_goals.map(function(text, i) {
            return (
              <div key={'extra_' + i} style={grp}>
                <label style={lbl}>{4 + i}.</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={text} onChange={function(e) { setArrayAt('extra_goals', i, e.target.value); }} style={inpStyle} placeholder={'Goal ' + (4 + i) + '...'} />
                  <button type="button" onClick={function() { removeExtraGoal(i); }} style={{ background: 'none', border: '0.5px solid #ddd', color: '#aaa', borderRadius: 6, padding: '9px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addExtraGoal} style={{ background: 'none', border: '1px dashed ' + gold, color: gold, borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>+ Add a goal</button>
        </div>

        <button type="submit" disabled={saving || !area} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontSize: 14, fontWeight: 600, cursor: saving || !area ? 'not-allowed' : 'pointer', opacity: (saving || !area) ? 0.6 : 1, width: '100%', marginBottom: 8 }}>
          {saving ? 'Submitting...' : 'Submit Quarterly Update'}
        </button>
        {saved && <div style={{ textAlign: 'center', color: '#2e7d32', fontSize: 13, fontWeight: 600, padding: 8 }}>Submitted! Next quarter goals saved.</div>}
      </form>
    </div>
  );
}

function EventsProfitLossModal({ onClose }) {
  var { useState, useEffect } = React;
  var [loading, setLoading] = useState(true);
  var [rows, setRows] = useState([]);

  useEffect(function() {
    var hdrs = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?area=eq.Events&select=*', { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?area=eq.Events&select=*', { headers: hdrs }).then(function(r) { return r.json(); })
    ]).then(function(res) {
      var budgetRows = Array.isArray(res[0]) ? res[0] : [];
      var earningsRows = Array.isArray(res[1]) ? res[1] : [];
      var byEvent = {};
      function bucket(name) {
        var key = (name || '').trim() || 'Uncategorized';
        if (!byEvent[key]) byEvent[key] = { event: key, earnings: 0, costs: 0 };
        return byEvent[key];
      }
      earningsRows.forEach(function(e) { bucket(e.event).earnings += parseFloat(e.amount) || 0; });
      budgetRows.forEach(function(b) { if (b.type === 'Purchase' || b.type === 'In-Kind') bucket(b.event_name).costs += parseFloat(b.amount) || 0; });
      var list = Object.keys(byEvent).map(function(k) { var r = byEvent[k]; return Object.assign({}, r, { net: r.earnings - r.costs }); });
      list.sort(function(a, b) { return b.net - a.net; });
      setRows(list);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  function fmt(n) { return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var totalEarnings = rows.reduce(function(s, r) { return s + r.earnings; }, 0);
  var totalCosts = rows.reduce(function(s, r) { return s + r.costs; }, 0);
  var totalNet = totalEarnings - totalCosts;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 600, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>Events — Profit / Loss</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb' }}>×</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 13 }}>No earnings or expenses recorded yet.</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Earnings</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#5a8a5a', marginTop: 4 }}>{fmt(totalEarnings)}</div>
              </div>
              <div style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Costs</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#c07040', marginTop: 4 }}>{fmt(totalCosts)}</div>
              </div>
              <div style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Net</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: totalNet >= 0 ? '#2e7d32' : '#c62828', marginTop: 4 }}>{totalNet >= 0 ? '' : '-'}{fmt(Math.abs(totalNet))}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 0 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600, borderBottom: '0.5px solid #f0ece6' }}>
              <span style={{ flex: 1 }}>Event</span>
              <span style={{ width: 90, textAlign: 'right' }}>Earnings</span>
              <span style={{ width: 90, textAlign: 'right' }}>Costs</span>
              <span style={{ width: 90, textAlign: 'right' }}>Net</span>
            </div>
            {rows.map(function(r) {
              return (
                <div key={r.event} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}>{r.event}</span>
                  <span style={{ fontSize: 12, color: '#5a8a5a', width: 90, textAlign: 'right' }}>{fmt(r.earnings)}</span>
                  <span style={{ fontSize: 12, color: '#c07040', width: 90, textAlign: 'right' }}>-{fmt(r.costs)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 90, textAlign: 'right', color: r.net >= 0 ? '#2e7d32' : '#c62828' }}>{r.net >= 0 ? '' : '-'}{fmt(Math.abs(r.net))}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OperationalView({ opArea, navigateToQuarterly }) {
  var { useState, useEffect } = React;
  var isMobile = React.useContext(MobileCtx);
  var area = opArea || OPERATIONAL_AREAS[0];
  var [areaInfo, setAreaInfo] = useState(null);
  var [budget, setBudget] = useState([]);
  var [vols, setVols] = useState([]);
  var [allVolsForReimburse, setAllVolsForReimburse] = useState([]);
  var [showBudget, setShowBudget] = useState(false);
  var [showVols, setShowVols] = useState(false);
  var [editLead, setEditLead] = useState(false);
  var [leadInput, setLeadInput] = useState('');
  var [showEarnings, setShowEarnings] = useState(false);
  var [showPnl, setShowPnl] = useState(false);
  var [earnings, setEarnings] = useState([]);
  var emptyEarningsForm = { event: '', earning_source: '', amount: '', notes: '', date: today };
  var [earningsForm, setEarningsForm] = useState(emptyEarningsForm);
  var [earningsSaving, setEarningsSaving] = useState(false);
  var [editingEarningId, setEditingEarningId] = useState(null);
  var [editEarningForm, setEditEarningForm] = useState(null);
  var [editEarningSaving, setEditEarningSaving] = useState(false);
  var today = new Date().toISOString().slice(0, 10);
  var [budgetForm, setBudgetForm] = useState({ type: 'Purchase', description: '', amount: '', date: today, needs_reimbursement: false, volunteer_name: '', purchased_by: '', event_name: '' });
  var [budgetSaving, setBudgetSaving] = useState(false);
  var [editingBudgetId, setEditingBudgetId] = useState(null);
  var [editBudgetForm, setEditBudgetForm] = useState(null);
  var [editBudgetSaving, setEditBudgetSaving] = useState(false);
  var [uploadingId, setUploadingId] = useState(null);
  var fileInputRef = React.useRef(null);
  var [budgetReceiptFiles, setBudgetReceiptFiles] = useState([]);
  var budgetReceiptRef = React.useRef(null);
  var [reimburseVolQuery, setReimburseVolQuery] = useState('');
  var [showReimburseVolDrop, setShowReimburseVolDrop] = useState(false);
  var [noteEdit, setNoteEdit] = useState(null);
  var [noteVal, setNoteVal] = useState('');
  var [noteSaving, setNoteSaving] = useState(null);
  var [quarterGoals, setQuarterGoals] = useState(null);
  var [quarterUpdate, setQuarterUpdate] = useState(null);
  var [cardFlipped, setCardFlipped] = useState(false);
  var [resources, setResources] = useState([]);
  var [showAddResource, setShowAddResource] = useState(false);
  var [resourceType, setResourceType] = useState('link');
  var [resourceTitle, setResourceTitle] = useState('');
  var [resourceUrl, setResourceUrl] = useState('');
  var [resourceSaving, setResourceSaving] = useState(false);
  var resourceFileRef = React.useRef(null);
  var [showSponsorForm, setShowSponsorForm] = useState(false);
  var [showTodo, setShowTodo] = useState(false);
  var [todoItems, setTodoItems] = useState([]);
  var [todoLoading, setTodoLoading] = useState(false);
  var [todoInput, setTodoInput] = useState('');
  var [todoSaving, setTodoSaving] = useState(false);
  var todoTodayStr = new Date().toISOString().slice(0, 10);
  var [todoSelectedDate, setTodoSelectedDate] = useState(todoTodayStr);
  var [todoInputTime, setTodoInputTime] = useState('');
  var [todoInputHours, setTodoInputHours] = useState('');
  var [todoEditingTimeId, setTodoEditingTimeId] = useState(null);
  var [todoEditTimeVal, setTodoEditTimeVal] = useState('');
  var [todoEditingHoursId, setTodoEditingHoursId] = useState(null);
  var [todoEditHoursVal, setTodoEditHoursVal] = useState('');
  var emptySponsorForm = { 'Business Name': '', 'Main Contact': '', 'Phone Number': '', 'Email Address': '', 'Mailing Address': '', 'Donation': '', 'Fair Market Value': '', 'Area Supported': area, 'Date Recieved': '', 'NSH Contact': '' };
  var [sponsorForm, setSponsorForm] = useState(emptySponsorForm);
  var [sponsorSaving, setSponsorSaving] = useState(false);
  var [sponsorSaved, setSponsorSaved] = useState(false);
  var cq = currentQuarterStr();
  var [selectedQ, setSelectedQ] = useState(cq);
  var emptyCcForm = { status: 'On track', discussion_focus: '', potential_actions: '', escalation: 'None', escalation_other: '', priority_confirmation: 'Approved', review_date: '' };
  var [ccReview, setCcReview] = useState(null);
  var [ccForm, setCcForm] = useState(emptyCcForm);
  var [ccSaving, setCcSaving] = useState(false);
  var [ccEditing, setCcEditing] = useState(false);

  useEffect(function() {
    setQuarterGoals(null);
    setQuarterUpdate(null);
    setCcReview(null);
    setCcEditing(false);
    setCardFlipped(false);
    var yr = new Date().getFullYear();
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(selectedQ) + '&year=eq.' + yr + '&select=*').then(function(rows) {
      if (rows && rows[0]) setQuarterGoals(rows[0]);
    });
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(selectedQ) + '&year=eq.' + yr + '&select=*&order=date_submitted.desc&limit=1').then(function(rows) {
      if (rows && rows[0]) setQuarterUpdate(rows[0]);
    });
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews') + '?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(selectedQ) + '&year=eq.' + yr + '&select=*&limit=1').then(function(rows) {
      if (rows && rows[0]) { setCcReview(rows[0]); setCcForm(Object.assign({}, emptyCcForm, rows[0])); }
    });
  }, [area, selectedQ]);

  useEffect(function() {
    setAreaInfo(null);
    setBudget([]);
    setVols([]);
    setResources([]);
    setEditLead(false);
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Operational Areas') + '?area=eq.' + encodeURIComponent(area) + '&select=*').then(function(rows) {
      if (rows && rows[0]) { setAreaInfo(rows[0]); setLeadInput(rows[0].lead || ''); }
    });
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?area=eq.' + encodeURIComponent(area) + '&select=*&order=date.desc,id.desc').then(function(rows) {
      if (Array.isArray(rows)) setBudget(rows);
    });
    cachedSbFetch('2026 Volunteers', ['id','First Name','Last Name','Team','Notes','Overview Notes','Status','Picture URL','Phone Number','Email']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      setVols(rows.filter(function(v) {
        if (!v.Team) return false;
        var areaAliases = { 'Events': ['events team', 'event support', 'events'], 'Docents': ['docent', 'docents'], 'Venue': ['venue'] };
        var matches = areaAliases[area] || [area.toLowerCase()];
        return v.Team.split(/[,|]/).some(function(t) { return matches.indexOf(t.trim().toLowerCase()) !== -1; });
      }));
      setAllVolsForReimburse(rows);
    });
    cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources') + '?area=eq.' + encodeURIComponent(area) + '&select=*&order=created_at.asc').then(function(rows) {
      if (Array.isArray(rows)) setResources(rows);
    });
    if (area === 'Events') {
      cachedFetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?area=eq.' + encodeURIComponent(area) + '&select=*&order=date.desc,id.desc').then(function(rows) {
        if (Array.isArray(rows)) setEarnings(rows);
      });
    }
  }, [area]);

  function saveLead() {
    if (!leadInput) return;
    if (areaInfo) {
      sbPatchById('Operational Areas', areaInfo.id, { lead: leadInput }).then(function() {
        clearCache('Operational Areas');
        setAreaInfo(Object.assign({}, areaInfo, { lead: leadInput }));
        setEditLead(false);
      });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Operational Areas'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ area: area, lead: leadInput })
      }).then(function(r) { return r.json(); }).then(function(rows) {
        clearCache('Operational Areas');
        if (rows && rows[0]) setAreaInfo(rows[0]);
        setEditLead(false);
      });
    }
  }

  function addEarningItem(e) {
    e.preventDefault();
    setEarningsSaving(true);
    var payload = { area: area, event: earningsForm.event, earning_source: earningsForm.earning_source, amount: parseFloat(earningsForm.amount) || 0, notes: earningsForm.notes || null, date: earningsForm.date || null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows.code) { setEarningsSaving(false); alert('Add failed: ' + (rows.message || rows.code)); return; }
      clearCache('Op Earnings');
      setEarningsSaving(false);
      if (rows && rows[0]) setEarnings(function(prev) { return [rows[0]].concat(prev); });
      setEarningsForm(emptyEarningsForm);
    });
  }

  function deleteEarningItem(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('Op Earnings');
      setEarnings(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
    });
  }

  function startEditEarning(e) {
    setEditingEarningId(e.id);
    setEditEarningForm({ event: e.event || '', earning_source: e.earning_source || '', amount: e.amount != null ? String(e.amount) : '', notes: e.notes || '', date: e.date || today });
  }

  function cancelEditEarning() {
    setEditingEarningId(null);
    setEditEarningForm(null);
  }

  function saveEditEarning() {
    if (!editEarningForm) return;
    setEditEarningSaving(true);
    var patch = { event: editEarningForm.event, earning_source: editEarningForm.earning_source || null, amount: parseFloat(editEarningForm.amount) || 0, notes: editEarningForm.notes || null, date: editEarningForm.date || null };
    var id = editingEarningId;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Earnings') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function(r) {
      if (!r.ok) throw new Error('Failed to save');
      setEditEarningSaving(false);
      clearCache('Op Earnings');
      setEarnings(function(prev) { return prev.map(function(e) { return e.id === id ? Object.assign({}, e, patch) : e; }); });
      setEditingEarningId(null);
      setEditEarningForm(null);
    }).catch(function() { setEditEarningSaving(false); alert('Failed to save changes'); });
  }

  function parseReceipts(receiptUrl) {
    if (!receiptUrl) return [];
    try { var p = JSON.parse(receiptUrl); if (Array.isArray(p)) return p; } catch(e) {}
    return [receiptUrl];
  }

  function uploadFile(file, itemId) {
    var ext = (file.name.split('.').pop() || 'bin');
    var slug = area.toLowerCase().replace(/\s+/g, '-');
    var filename = slug + '-' + itemId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
    return fetch(SUPABASE_URL + '/storage/v1/object/receipts/' + filename, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    }).then(function() { return SUPABASE_URL + '/storage/v1/object/public/receipts/' + filename; });
  }

  function addBudgetItem(e) {
    e.preventDefault();
    setBudgetSaving(true);
    var files = budgetReceiptFiles;
    var payload = { area: area, type: budgetForm.type, description: budgetForm.description, amount: parseFloat(budgetForm.amount) || 0, date: budgetForm.date || null, purchased_by: budgetForm.purchased_by || null };
    if (area === 'Events') payload.event_name = budgetForm.event_name || null;
    if (budgetForm.needs_reimbursement) { payload.needs_reimbursement = true; payload.volunteer_name = budgetForm.volunteer_name || null; }
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows.code) { setBudgetSaving(false); alert('Add failed: ' + (rows.message || rows.hint || rows.code)); return; }
      var newRow = rows && rows[0];
      if (!newRow) { setBudgetSaving(false); return; }
      function finish(finalRow) {
        clearCache('Op Budget');
        setBudgetSaving(false);
        setBudget(function(prev) { return [finalRow].concat(prev); });
        setBudgetForm({ type: 'Purchase', description: '', amount: '', date: today, needs_reimbursement: false, volunteer_name: '', purchased_by: '', event_name: '' });
        setReimburseVolQuery('');
        setBudgetReceiptFiles([]);
        if (budgetReceiptRef.current) budgetReceiptRef.current.value = '';
      }
      if (!files.length) { finish(newRow); return; }
      Promise.all(files.map(function(f) { return uploadFile(f, newRow.id); })).then(function(urls) {
        var receiptVal = urls.length === 1 ? urls[0] : JSON.stringify(urls);
        fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + newRow.id, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt_url: receiptVal })
        }).then(function() { finish(Object.assign({}, newRow, { receipt_url: receiptVal })); });
      });
    });
  }

  function deleteBudgetItem(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('Op Budget');
      setBudget(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    });
  }

  function startEditBudget(b) {
    setEditingBudgetId(b.id);
    setEditBudgetForm({ type: b.type || 'Purchase', description: b.description || '', amount: b.amount != null ? String(b.amount) : '', date: b.date || today, needs_reimbursement: !!b.needs_reimbursement, volunteer_name: b.volunteer_name || '', purchased_by: b.purchased_by || '', event_name: b.event_name || '' });
  }

  function cancelEditBudget() {
    setEditingBudgetId(null);
    setEditBudgetForm(null);
  }

  function saveEditBudget() {
    if (!editBudgetForm) return;
    setEditBudgetSaving(true);
    var patch = { type: editBudgetForm.type, description: editBudgetForm.description, amount: parseFloat(editBudgetForm.amount) || 0, date: editBudgetForm.date || null, purchased_by: editBudgetForm.purchased_by || null, needs_reimbursement: !!editBudgetForm.needs_reimbursement, volunteer_name: editBudgetForm.needs_reimbursement ? (editBudgetForm.volunteer_name || null) : null };
    if (area === 'Events') patch.event_name = editBudgetForm.event_name || null;
    var id = editingBudgetId;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }
    , body: JSON.stringify(patch)
    }).then(function() {
      clearCache('Op Budget');
      setBudget(function(prev) { return prev.map(function(b) { return b.id === id ? Object.assign({}, b, patch) : b; }); });
      setEditingBudgetId(null);
      setEditBudgetForm(null);
      setEditBudgetSaving(false);
    }).catch(function() { setEditBudgetSaving(false); });
  }

  function todoNowTime() { var n = new Date(); return n.toTimeString().slice(0, 5); }

  function loadTodo() {
    setTodoLoading(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo') + '?select=*&order=date_submitted.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setTodoItems(rows);
      setTodoLoading(false);
    }).catch(function() { setTodoLoading(false); });
  }

  function todoGetDate(t) { return (t.date_submitted || '').slice(0, 10); }
  function todoGetTime(t) { var ds = t.date_submitted || ''; return (ds.length >= 16 && ds[10] === 'T') ? ds.slice(11, 16) : ''; }
  function todoFmtTime(hhmm) { if (!hhmm) return ''; var p = hhmm.split(':'); var h = parseInt(p[0], 10); var ampm = h >= 12 ? 'PM' : 'AM'; return (h % 12 || 12) + ':' + p[1] + ' ' + ampm; }
  function todoNavigateDay(delta) { var d = new Date(todoSelectedDate + 'T12:00:00'); d.setDate(d.getDate() + delta); setTodoSelectedDate(d.toISOString().slice(0, 10)); }
  function todoGetWeekDays(dateStr) {
    var d = new Date(dateStr + 'T12:00:00'); var day = d.getDay(); var offset = day === 0 ? -6 : 1 - day;
    var mon = new Date(d); mon.setDate(d.getDate() + offset);
    var days = []; for (var i = 0; i < 7; i++) { var dd = new Date(mon); dd.setDate(mon.getDate() + i); days.push(dd.toISOString().slice(0, 10)); } return days;
  }

  function addTodoItem(e) {
    e.preventDefault();
    if (!todoInput.trim()) return;
    setTodoSaving(true);
    var timeToUse = todoInputTime || todoNowTime();
    var ds = todoSelectedDate + 'T' + timeToUse;
    var hrs = todoInputHours ? parseFloat(todoInputHours) : null;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ item: todoInput.trim(), date_submitted: ds, done: false, date_done: null, hours: hrs })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows) && rows[0]) setTodoItems(function(p) {
        var next = p.concat([rows[0]]);
        return next.sort(function(a, b) { return (a.date_submitted || '') < (b.date_submitted || '') ? -1 : 1; });
      });
      setTodoInput(''); setTodoInputTime(todoNowTime()); setTodoInputHours('');
      setTodoSaving(false);
    }).catch(function() { setTodoSaving(false); });
  }

  function saveTodoTime(t) {
    var ds = todoEditTimeVal ? todoGetDate(t) + 'T' + todoEditTimeVal : todoGetDate(t);
    setTodoItems(function(p) {
      var next = p.map(function(x) { return x.id === t.id ? Object.assign({}, x, { date_submitted: ds }) : x; });
      return next.sort(function(a, b) { return (a.date_submitted || '') < (b.date_submitted || '') ? -1 : 1; });
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo') + '?id=eq.' + t.id, {
      method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_submitted: ds })
    });
    setTodoEditingTimeId(null);
  }

  function saveTodoHours(t) {
    var hrs = todoEditHoursVal !== '' ? parseFloat(todoEditHoursVal) : null;
    setTodoItems(function(p) { return p.map(function(x) { return x.id === t.id ? Object.assign({}, x, { hours: hrs }) : x; }); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo') + '?id=eq.' + t.id, {
      method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: hrs })
    });
    setTodoEditingHoursId(null);
  }

  function toggleTodoItem(id, currentDone) {
    var nowDone = !currentDone;
    var patch = { done: nowDone, date_done: nowDone ? new Date().toISOString() : null };
    setTodoItems(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, patch) : t; }); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
  }

  function deleteTodoItem(id) {
    setTodoItems(function(p) { return p.filter(function(t) { return t.id !== id; }); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Marketing Todo') + '?id=eq.' + id, {
      method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    });
  }

  function handleReceiptSelect(e) {
    var newFiles = Array.from(e.target.files || []);
    if (!newFiles.length || !uploadingId) { e.target.value = ''; return; }
    var id = uploadingId;
    var existingItem = budget.find(function(b) { return b.id === id; });
    var existing = parseReceipts(existingItem && existingItem.receipt_url);
    setUploadingId('loading-' + id);
    Promise.all(newFiles.map(function(f) { return uploadFile(f, id); })).then(function(newUrls) {
      var all = existing.concat(newUrls);
      var receiptVal = all.length === 1 ? all[0] : JSON.stringify(all);
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_url: receiptVal })
      }).then(function() {
        clearCache('Op Budget');
        setBudget(function(prev) { return prev.map(function(b) { return b.id === id ? Object.assign({}, b, { receipt_url: receiptVal }) : b; }); });
        setUploadingId(null);
        e.target.value = '';
      });
    });
  }

  function submitCcReview(e) {
    e.preventDefault();
    setCcSaving(true);
    var yr = new Date().getFullYear();
    var payload = { area: area, quarter: selectedQ, year: yr, status: ccForm.status, discussion_focus: ccForm.discussion_focus || null, potential_actions: ccForm.potential_actions || null, escalation: ccForm.escalation, escalation_other: ccForm.escalation === 'Other' ? ccForm.escalation_other || null : null, priority_confirmation: ccForm.priority_confirmation, review_date: ccForm.review_date || null };
    if (ccReview) {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews') + '?id=eq.' + ccReview.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(rows) {
        clearCache('Op Co-Champion Reviews');
        var updated = (rows && rows[0]) ? rows[0] : Object.assign({}, ccReview, payload);
        setCcReview(updated); setCcSaving(false); setCcEditing(false);
      });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(rows) {
        clearCache('Op Co-Champion Reviews');
        if (rows && rows[0]) setCcReview(rows[0]);
        setCcSaving(false); setCcEditing(false);
      });
    }
  }

  function saveNote(v) {
    setNoteSaving(v.id);
    sbUpdate('2026 Volunteers', v['First Name'], v['Last Name'], { Notes: noteVal }).then(function() {
      setVols(function(prev) { return prev.map(function(x) { return x.id === v.id ? Object.assign({}, x, { Notes: noteVal }) : x; }); });
      setNoteEdit(null);
      setNoteSaving(null);
    });
  }

  var eventNameOptions = area === 'Events' ? Array.from(new Set(budget.concat(earnings).map(function(b) { return (b.event_name || b.event || '').trim(); }).filter(Boolean))).sort() : [];
  var totalPurchases = budget.filter(function(b) { return b.type === 'Purchase'; }).reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
  var totalInKind = budget.filter(function(b) { return b.type === 'In-Kind'; }).reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
  var totalSpent = totalPurchases + totalInKind;
  var areaDefaults = AREA_DEFAULTS[area] || {};
  var allocation = areaDefaults.budget;
  var defaultLead = areaDefaults.lead || '';
  function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  var cardHover = { cursor: 'pointer', background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '16px 20px', flex: 1, minWidth: 150 };

  return (
    <div>
      {area === 'Events' && <datalist id="event-name-options">{eventNameOptions.map(function(n) { return <option key={n} value={n} />; })}</datalist>}
      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', border: '0.5px solid #e8e0d5', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 6 }}>Operational Area</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{area}</div>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            {(function() {
              if (area === 'Venue') {
                return (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 2 }}>Lead</div>
                    <span style={{ fontSize: 15, color: '#2a2a2a', fontWeight: 500 }}>Staff</span>
                  </div>
                );
              }
              var leadName = areaInfo && areaInfo.lead ? areaInfo.lead : defaultLead;
              var leadPic = areaDefaults.pic || '';
              if (editLead) {
                return (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select autoFocus value={leadInput} onChange={function(e) { setLeadInput(e.target.value); }} style={{ fontSize: 13, padding: '5px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, background: '#fff', minWidth: 160 }}>
                      <option value="">— Select lead —</option>
                      {vols.map(function(v) { var n = v['First Name'] + ' ' + v['Last Name']; return <option key={v.id} value={n}>{n}</option>; })}
                    </select>
                    <button onClick={saveLead} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={function() { setEditLead(false); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#666' }}>Cancel</button>
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={function() { setEditLead(true); setLeadInput(leadName || ''); }}>
                  {leadPic ? (
                    <img src={driveImg(leadPic)} alt={leadName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#999', flexShrink: 0 }}>
                      {leadName ? leadName[0] : '?'}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 2 }}>Lead</div>
                    <span style={{ fontSize: 15, color: '#2a2a2a', fontWeight: 500 }}>{leadName || <span style={{ color: '#ccc', fontStyle: 'italic' }}>Not set</span>}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div onClick={function() { setShowBudget(true); }} style={cardHover}
            onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 8 }}>Budget</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: gold }}>{allocation != null ? fmt(allocation) : '$0'}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>{fmt(totalPurchases)} / {allocation != null ? fmt(allocation) : '$0'}</div>
            <div style={{ fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 }}>View / Add entries →</div>
          </div>
          {area === 'Events' && (
            <div onClick={function() { setShowEarnings(true); }} style={cardHover}
              onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 8 }}>Earnings</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: gold }}>{fmt(earnings.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0))}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>{earnings.length} {earnings.length === 1 ? 'entry' : 'entries'}</div>
              <div style={{ fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 }}>View / Add entries →</div>
            </div>
          )}
          <div onClick={function() { setShowVols(true); }} style={cardHover}
            onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 8 }}>Volunteers</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a' }}>{vols.length}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>assigned to {area}</div>
            <div style={{ fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 }}>View / Add notes →</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: 16, marginBottom: 20 }}>
        {/* Goals card — full card flip */}
        {(function() {
          var stColors = { 'On Track': { bg: '#eaf3ea', color: '#3a7d3a' }, 'Behind': { bg: '#fff3e0', color: '#c07040' }, 'Complete': { bg: '#e8f5e9', color: '#2e7d32' }, 'At Risk': { bg: '#fdecea', color: '#c62828' } };
          var frontCard = (
            <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', border: '0.5px solid #e8e0d5' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600 }}>{selectedQ} {new Date().getFullYear()} Goals</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['Q1','Q2','Q3','Q4'].map(function(q) {
                    var isActive = q === selectedQ;
                    var isCurrent = q === cq;
                    return (
                      <button key={q} onClick={function() { setSelectedQ(q); }} style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, padding: '2px 9px', borderRadius: 5, border: '0.5px solid ' + (isActive ? gold : '#e0d8cc'), background: isActive ? gold : '#fff', color: isActive ? '#fff' : isCurrent ? gold : '#aaa', cursor: 'pointer' }}>{q}</button>
                    );
                  })}
                </div>
              </div>
              {quarterGoals ? (
                <div>
                  {quarterGoals.primary_focus && <div style={{ marginBottom: 12 }}><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>Primary Focus</span><div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', marginTop: 3, lineHeight: 1.5 }}>{quarterGoals.primary_focus}</div></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {goalEntries(quarterGoals).map(function(entry, i) {
                      var sc = entry.status && stColors[entry.status] ? stColors[entry.status] : null;
                      return (
                        <div key={i} style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e8e0d5' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Goal {i+1}</span>
                              <div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 2, lineHeight: 1.5 }}>{entry.text}</div>
                            </div>
                            {sc && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0 }}>{entry.status}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 14 }}>
                    <button onClick={function(e) { e.stopPropagation(); setCardFlipped(true); }} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>View Full Reflection →</button>
                  </div>
                </div>
              ) : quarterUpdate ? (
                <div>
                  <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic', marginBottom: 12 }}>No goals set for {selectedQ} yet.</div>
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={function(e) { e.stopPropagation(); setCardFlipped(true); }} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>View Full Reflection →</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>No goals set for {selectedQ} yet.</div>
              )}
            </div>
          );
          var backCard = (
            <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', border: '0.5px solid #e8e0d5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600 }}>{selectedQ} {new Date().getFullYear()} Reflection</div>
                <button onClick={function(e) { e.stopPropagation(); setCardFlipped(false); }} style={{ fontSize: 11, color: '#888', background: 'none', border: '0.5px solid #ccc', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 500 }}>← Goals</button>
              </div>
              {(quarterGoals || quarterUpdate) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {quarterGoals && (
                    <div>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>Goal Progress</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        {goalEntries(quarterGoals, quarterUpdate).map(function(entry, i) {
                          var sc = entry.status && stColors[entry.status] ? stColors[entry.status] : null;
                          return (
                            <div key={i} style={{ background: sc ? sc.bg : '#faf8f5', borderRadius: 8, padding: '8px 12px', border: '0.5px solid ' + (sc ? sc.color + '33' : '#e8e0d5') }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Goal {i+1} — <span style={{ color: '#555', fontWeight: 600 }}>{entry.text}</span></div>
                                  {entry.summary && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginTop: 3 }}>{entry.summary}</div>}
                                </div>
                                {sc && <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#fff', color: sc.color, flexShrink: 0 }}>{entry.status}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {quarterUpdate && (quarterUpdate.what_went_well || quarterUpdate.successes) && <div><span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>What Went Well</span><div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 3, lineHeight: 1.6 }}>{quarterUpdate.what_went_well || quarterUpdate.successes}</div></div>}
                  {quarterUpdate && (function() {
                    var checked = [].concat(quarterUpdate.challenges || []);
                    if (!checked.length) return null;
                    return (
                      <div>
                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>Challenges Encountered</span>
                        <div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 4, lineHeight: 1.6, fontWeight: 600 }}>{checked.join(' | ')}</div>
                        {quarterUpdate.challenges_details && <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{quarterUpdate.challenges_details}</div>}
                      </div>
                    );
                  })()}
                  {quarterUpdate && (function() {
                    var checked = [].concat(quarterUpdate.support_needed || []);
                    if (!checked.length) return null;
                    return (
                      <div>
                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>Support Needed</span>
                        <div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 4, lineHeight: 1.6, fontWeight: 600 }}>{checked.join(' | ')}</div>
                        {quarterUpdate.support_details && <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{quarterUpdate.support_details}</div>}
                      </div>
                    );
                  })()}
                  {quarterUpdate && quarterUpdate.other_notes && <div><span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600 }}>Other Notes</span><div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 3, lineHeight: 1.6 }}>{quarterUpdate.other_notes}</div></div>}
                  {quarterUpdate && quarterUpdate.date_submitted && <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Submitted {quarterUpdate.date_submitted}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>No reflection submitted yet.</div>
              )}
            </div>
          );
          return cardFlipped ? backCard : frontCard;
        })()}


        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', border: '0.5px solid #e8e0d5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600 }}>Area Resources</div>
            {area === 'Marketing' && (
              <button onClick={function() { setTodoInputTime(todoNowTime()); setShowTodo(true); loadTodo(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: gold, padding: '0 2px', lineHeight: 1, opacity: 0.7 }}>★</button>
            )}
          </div>
          {area === 'Events' && (
            <div onClick={function() { setShowPnl(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6, background: '#faf8f5', borderRadius: 8, border: '0.5px solid #e8e0d5', cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#f5f0e8'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#faf8f5'; }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
              <span style={{ fontSize: 13, fontWeight: 500, color: gold, flex: 1 }}>Profit / Loss by Event</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>Earnings vs. costs</span>
            </div>
          )}
          {resources.length === 0 && area !== 'Events'
            ? <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic', marginBottom: 12 }}>No resources added yet.</div>
            : resources.map(function(r) {
                return (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6, background: '#faf8f5', borderRadius: 8, border: '0.5px solid #e8e0d5', textDecoration: 'none', color: '#2a2a2a' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#f5f0e8'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#faf8f5'; }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 500, color: gold, flex: 1 }}>{r.title}</span>
                    {r.description && <span style={{ fontSize: 11, color: '#aaa' }}>{r.description}</span>}
                  </a>
                );
              })
          }

          {showAddResource ? (
            <div style={{ background: '#faf8f5', borderRadius: 8, padding: '12px 14px', marginBottom: 6, border: '0.5px solid #e8e0d5' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {['link','file'].map(function(t) {
                  return <button key={t} onClick={function() { setResourceType(t); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '0.5px solid ' + (resourceType === t ? gold : '#e0d8cc'), background: resourceType === t ? gold : '#fff', color: resourceType === t ? '#fff' : '#888', cursor: 'pointer', fontWeight: resourceType === t ? 600 : 400 }}>{t === 'link' ? 'Link' : 'Upload File'}</button>;
                })}
              </div>
              <input value={resourceTitle} onChange={function(e) { setResourceTitle(e.target.value); }} placeholder="Title" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
              {resourceType === 'link'
                ? <input value={resourceUrl} onChange={function(e) { setResourceUrl(e.target.value); }} placeholder="https://…" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
                : <div style={{ marginBottom: 8 }}>
                    <button onClick={function() { resourceFileRef.current.click(); }} style={{ fontSize: 12, color: gold, background: '#fff', border: '0.5px dashed ' + gold, borderRadius: 7, padding: '7px 14px', cursor: 'pointer', width: '100%' }}>
                      {resourceUrl ? '✓ ' + resourceUrl.split('/').pop().slice(0,30) : 'Choose file…'}
                    </button>
                    <input ref={resourceFileRef} type="file" style={{ display: 'none' }} onChange={function(e) {
                      var file = e.target.files[0];
                      if (!file) return;
                      if (!resourceTitle) setResourceTitle(file.name.replace(/\.[^.]+$/, ''));
                      setResourceUrl('__file__:' + file.name);
                    }} />
                  </div>
              }
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={resourceSaving} onClick={function() {
                  if (!resourceTitle) return;
                  setResourceSaving(true);
                  function saveRecord(url) {
                    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources'), {
                      method: 'POST',
                      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                      body: JSON.stringify({ area: area, title: resourceTitle, url: url })
                    }).then(function(r) { return r.json(); }).then(function(rows) {
                      clearCache('Op Resources');
                      setResourceSaving(false);
                      if (rows && rows[0]) setResources(function(prev) { return prev.concat([rows[0]]); });
                      setResourceTitle(''); setResourceUrl(''); setShowAddResource(false);
                    });
                  }
                  if (resourceType === 'link') {
                    saveRecord(resourceUrl);
                  } else {
                    var file = resourceFileRef.current && resourceFileRef.current.files[0];
                    if (!file) { setResourceSaving(false); return; }
                    var ext = file.name.split('.').pop();
                    var filename = area.replace(/\s+/g,'-').toLowerCase() + '-' + Date.now() + '.' + ext;
                    fetch(SUPABASE_URL + '/storage/v1/object/area-resources/' + filename, {
                      method: 'POST',
                      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type },
                      body: file
                    }).then(function() {
                      saveRecord(SUPABASE_URL + '/storage/v1/object/public/area-resources/' + filename);
                    }).catch(function() { setResourceSaving(false); });
                  }
                }} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '7px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: resourceSaving ? 0.7 : 1 }}>{resourceSaving ? 'Saving…' : 'Add'}</button>
                <button onClick={function() { setShowAddResource(false); setResourceTitle(''); setResourceUrl(''); }} style={{ padding: '7px 12px', background: '#f0ece6', border: 'none', borderRadius: 7, fontSize: 12, color: '#666', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={function() { setShowAddResource(true); setResourceType('link'); }} style={{ width: '100%', marginTop: 4, padding: '8px 12px', background: 'none', border: 'none', fontSize: 12, color: gold, fontWeight: 500, cursor: 'pointer', textAlign: 'right', display: 'block' }}>
              Add Resource →
            </button>
          )}

          <button onClick={function() { setSponsorForm(Object.assign({}, emptySponsorForm, { 'Area Supported': area })); setSponsorSaved(false); setShowSponsorForm(true); }} style={{ width: '100%', marginTop: 6, padding: '9px 12px', background: '#faf8f5', border: '0.5px dashed ' + gold, borderRadius: 8, fontSize: 12, color: gold, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
            + In-Kind Sponsorship Form
          </button>
        </div>
      </div>

      {showSponsorForm && (function() {
        var areaOptions = ['Restoration','Grounds','Events','Interiors','Construction','Docents','Fundraising','Marketing','Venue','General'];
        var fi = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
        var lb = { fontSize: 12, color: '#666', fontWeight: 500, display: 'block', marginBottom: 4 };
        var grp = { marginBottom: 14 };
        function fc(e) { var k = e.target.name, v = e.target.value; setSponsorForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }
        function handleSubmit(e) {
          e.preventDefault();
          setSponsorSaving(true);
          var row = {};
          Object.keys(sponsorForm).forEach(function(k) { if (sponsorForm[k]) row[k] = sponsorForm[k]; });
          fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsors'), {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify(row)
          }).then(function(r) { return r.json(); }).then(function() {
            clearCache('Sponsors');
            setSponsorSaving(false);
            setSponsorSaved(true);
            setSponsorForm(Object.assign({}, emptySponsorForm, { 'Area Supported': area }));
          }).catch(function() { setSponsorSaving(false); });
        }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>In-Kind Sponsorship</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Documentation Form</div>
                </div>
                <button onClick={function() { setShowSponsorForm(false); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#bbb' }}>×</button>
              </div>
              {sponsorSaved && <div style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Submitted successfully — sponsor added to the list.</div>}
              <form onSubmit={handleSubmit}>
                <div style={grp}><label style={lb}>Sponsor Name *</label><input required name="Business Name" value={sponsorForm['Business Name']} onChange={fc} style={fi} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div><label style={lb}>Main Contact</label><input name="Main Contact" value={sponsorForm['Main Contact']} onChange={fc} style={fi} /></div>
                  <div><label style={lb}>Phone Number</label><input name="Phone Number" value={sponsorForm['Phone Number']} onChange={fc} style={fi} /></div>
                </div>
                <div style={grp}><label style={lb}>Email Address</label><input name="Email Address" type="email" value={sponsorForm['Email Address']} onChange={fc} style={fi} /></div>
                <div style={grp}><label style={lb}>Mailing Address</label><input name="Mailing Address" value={sponsorForm['Mailing Address']} onChange={fc} style={fi} /></div>
                <div style={{ borderTop: '0.5px solid #f0ece6', margin: '16px 0' }} />
                <div style={grp}><label style={lb}>In-Kind Donation Description</label><textarea name="Donation" value={sponsorForm['Donation']} onChange={fc} rows={3} style={Object.assign({}, fi, { resize: 'vertical' })} /></div>
                <div style={grp}><label style={lb}>Estimated Fair Market Value</label><input name="Fair Market Value" value={sponsorForm['Fair Market Value']} onChange={fc} style={fi} placeholder="e.g. $500" /></div>
                <div style={grp}>
                  <label style={lb}>Area Supported</label>
                  <select name="Area Supported" value={sponsorForm['Area Supported']} onChange={fc} style={fi}>
                    <option value="">Select area…</option>
                    {areaOptions.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div><label style={lb}>Date Received</label><input name="Date Recieved" type="date" value={sponsorForm['Date Recieved']} onChange={fc} style={fi} /></div>
                  <div><label style={lb}>NSH Contact</label><input name="NSH Contact" value={sponsorForm['NSH Contact']} onChange={fc} style={fi} /></div>
                </div>
                <button type="submit" disabled={sponsorSaving} style={{ width: '100%', background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 600, cursor: sponsorSaving ? 'not-allowed' : 'pointer', opacity: sponsorSaving ? 0.7 : 1 }}>{sponsorSaving ? 'Submitting…' : 'Submit Sponsorship'}</button>
              </form>
            </div>
          </div>
        );
      })()}

      {showBudget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>{area} — Budget</div>
              <button onClick={function() { setShowBudget(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb' }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[{ label: 'Purchases', val: totalPurchases, color: '#c07040' }, { label: 'In-Kind', val: totalInKind, color: '#5a8a5a' }, { label: 'Total', val: totalPurchases + totalInKind, color: gold }].map(function(s) {
                return (
                  <div key={s.label} style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{fmt(s.val)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 12 }}>Add Entry</div>
              <form onSubmit={addBudgetItem}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Type</div>
                    <select value={budgetForm.type} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { type: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, background: '#fff' }}>
                      <option>Purchase</option>
                      <option>In-Kind</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Amount ($)</div>
                    <input type="number" step="0.01" min="0" value={budgetForm.amount} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="0.00" />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Description</div>
                  <input value={budgetForm.description} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="What was purchased or donated..." />
                </div>
                {area === 'Events' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Event Name</div>
                    <input value={budgetForm.event_name} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { event_name: e.target.value }); }); }} list="event-name-options" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="Which event was this for..." />
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Purchased By</div>
                  <input value={budgetForm.purchased_by} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { purchased_by: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="Who made this purchase..." />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Receipts (optional)</div>
                  <div
                    onClick={function() { budgetReceiptRef.current && budgetReceiptRef.current.click(); }}
                    style={{ border: '0.5px dashed #e0d8cc', borderRadius: 7, padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: budgetReceiptFiles.length ? '#2a2a2a' : '#bbb', background: '#fafaf8', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span>{budgetReceiptFiles.length === 0 ? 'Attach images or PDFs…' : budgetReceiptFiles.length === 1 ? budgetReceiptFiles[0].name : budgetReceiptFiles.length + ' files attached'}</span>
                    {budgetReceiptFiles.length > 0 && <span onClick={function(ev) { ev.stopPropagation(); setBudgetReceiptFiles([]); if (budgetReceiptRef.current) budgetReceiptRef.current.value = ''; }} style={{ marginLeft: 'auto', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>×</span>}
                  </div>
                  <input ref={budgetReceiptRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={function(e) { setBudgetReceiptFiles(Array.from(e.target.files || [])); }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: budgetForm.needs_reimbursement ? '#b45309' : '#555' }}>
                    <input type="checkbox" checked={budgetForm.needs_reimbursement} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { needs_reimbursement: e.target.checked, volunteer_name: '' }); }); setReimburseVolQuery(''); }} style={{ width: 15, height: 15, accentColor: gold, cursor: 'pointer' }} />
                    Needs reimbursement?
                    {budgetForm.needs_reimbursement && <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>Will appear in Financials</span>}
                  </label>
                </div>
                {budgetForm.needs_reimbursement && (function() {
                  var allVols = allVolsForReimburse.filter(function(v) { return v['Status'] === 'Active' || v['Status'] === 'active'; });
                  if (!allVols.length) allVols = allVolsForReimburse;
                  var filtered = reimburseVolQuery ? allVols.filter(function(v) {
                    var name = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim().toLowerCase();
                    return name.includes(reimburseVolQuery.toLowerCase());
                  }) : [];
                  return (
                    <div style={{ marginBottom: 12, position: 'relative' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Reimburse To *</div>
                      <input
                        value={reimburseVolQuery}
                        onChange={function(e) { setReimburseVolQuery(e.target.value); setBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: '' }); }); setShowReimburseVolDrop(true); }}
                        onFocus={function() { setShowReimburseVolDrop(true); }}
                        onBlur={function() { setTimeout(function() { setShowReimburseVolDrop(false); }, 150); }}
                        placeholder="Type a volunteer name…"
                        style={{ width: '100%', padding: '7px 10px', border: '0.5px solid ' + (budgetForm.volunteer_name ? '#22c55e' : '#e0d8cc'), borderRadius: 7, fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
                      />
                      {budgetForm.volunteer_name && (
                        <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 3 }}>✓ {budgetForm.volunteer_name}</div>
                      )}
                      {showReimburseVolDrop && filtered.length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 99, left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 180, overflowY: 'auto' }}>
                          {filtered.map(function(v) {
                            var fullName = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim();
                            return (
                              <div key={v.id} onMouseDown={function() { setBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: fullName }); }); setReimburseVolQuery(fullName); setShowReimburseVolDrop(false); }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid #f5f0ea', background: '#fff' }}
                                onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                                onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}>
                                <div style={{ fontWeight: 500, color: '#2a2a2a' }}>{fullName}</div>
                                {v['Address'] && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{v['Address']}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                    <input type="date" value={budgetForm.date} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} />
                  </div>
                  <button type="submit" disabled={budgetSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: budgetSaving ? 0.7 : 1 }}>{budgetSaving ? 'Saving…' : 'Add'}</button>
                </div>
              </form>
            </div>
            {budget.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No entries yet.</div>
            ) : budget.map(function(b) {
              if (editingBudgetId === b.id && editBudgetForm) {
                return (
                  <div key={b.id} style={{ padding: '12px 0', borderBottom: '0.5px solid #f0ece6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <select value={editBudgetForm.type} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { type: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, background: '#fff' }}>
                        <option>Purchase</option>
                        <option>In-Kind</option>
                      </select>
                      <input type="number" step="0.01" min="0" value={editBudgetForm.amount} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12 }} placeholder="Amount" />
                    </div>
                    <input value={editBudgetForm.description} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} placeholder="Description" />
                    {area === 'Events' && (
                      <input value={editBudgetForm.event_name} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { event_name: e.target.value }); }); }} list="event-name-options" style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} placeholder="Event name" />
                    )}
                    <input value={editBudgetForm.purchased_by} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { purchased_by: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} placeholder="Purchased by" />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input type="date" value={editBudgetForm.date} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={{ padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12 }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editBudgetForm.needs_reimbursement} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { needs_reimbursement: e.target.checked }); }); }} style={{ width: 14, height: 14, accentColor: gold, cursor: 'pointer' }} />
                        Needs reimbursement
                      </label>
                    </div>
                    {editBudgetForm.needs_reimbursement && (
                      <input value={editBudgetForm.volunteer_name} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: e.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} placeholder="Reimburse to" />
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={cancelEditBudget} style={{ fontSize: 12, background: 'none', border: '0.5px solid #ccc', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#666' }}>Cancel</button>
                      <button onClick={saveEditBudget} disabled={editBudgetSaving} style={{ fontSize: 12, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, opacity: editBudgetSaving ? 0.7 : 1 }}>{editBudgetSaving ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: b.type === 'Purchase' ? '#fef0e6' : '#eaf3ea', color: b.type === 'Purchase' ? '#c07040' : '#5a8a5a', flexShrink: 0 }}>{b.type}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#2a2a2a', minWidth: 0 }}>
                    {b.description || '—'}
                    {(b.event_name || b.purchased_by) && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                        {b.event_name && <span>{b.event_name}</span>}
                        {b.event_name && b.purchased_by && <span> · </span>}
                        {b.purchased_by && <span>Purchased by {b.purchased_by}</span>}
                      </div>
                    )}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', flexShrink: 0 }}>{fmt(parseFloat(b.amount) || 0)}</span>
                  <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{b.date}</span>
                  {b.needs_reimbursement && <span title="Needs reimbursement" style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>$ Reimburse</span>}
                  {(function() {
                    var receipts = parseReceipts(b.receipt_url);
                    var isLoading = uploadingId === 'loading-' + b.id;
                    if (receipts.length > 0) return (
                      <button onClick={function() { receipts.forEach(function(u) { window.open(u, '_blank'); }); }} title={receipts.length + ' attachment' + (receipts.length > 1 ? 's' : '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: gold, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        {receipts.length > 1 && <span style={{ fontSize: 10, fontWeight: 600 }}>{receipts.length}</span>}
                      </button>
                    );
                    return <button onClick={function() { setUploadingId(b.id); fileInputRef.current.click(); }} disabled={isLoading} title="Attach receipt" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px 4px', flexShrink: 0, opacity: isLoading ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>{isLoading ? <span style={{ fontSize: 11 }}>…</span> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}</button>;
                  })()}
                  <button onClick={function() { startEditBudget(b); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={function() { deleteBudgetItem(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                </div>
              );
            })}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={handleReceiptSelect} />
          </div>
        </div>
      )}

      {showEarnings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>Events — Earnings</div>
              <button onClick={function() { setShowEarnings(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>
            <div style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Total Earnings</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: gold, marginTop: 4 }}>{fmt(earnings.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0))}</div>
            </div>
            <div style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 12 }}>Add Entry</div>
              <form onSubmit={addEarningItem}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Event</div>
                    <input value={earningsForm.event} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { event: e.target.value }); }); }} list="event-name-options" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="e.g. Spring Gala" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Earning Source</div>
                    <input value={earningsForm.earning_source} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { earning_source: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="e.g. Ticket sales" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Amount ($)</div>
                    <input required type="number" step="0.01" min="0" value={earningsForm.amount} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="0.00" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                    <input type="date" value={earningsForm.date} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Notes</div>
                  <input value={earningsForm.notes} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { notes: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="Optional notes…" />
                </div>
                <button type="submit" disabled={earningsSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: earningsSaving ? 0.7 : 1 }}>{earningsSaving ? 'Saving…' : 'Add'}</button>
              </form>
            </div>
            {earnings.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No entries yet.</div>
            ) : earnings.map(function(e) {
              if (editingEarningId === e.id && editEarningForm) {
                return (
                  <div key={e.id} style={{ padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input value={editEarningForm.event} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { event: ev.target.value }); }); }} list="event-name-options" style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Event" />
                      <input value={editEarningForm.earning_source} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { earning_source: ev.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Source" />
                      <input type="number" step="0.01" min="0" value={editEarningForm.amount} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { amount: ev.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="Amount" />
                      <input type="date" value={editEarningForm.date} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { date: ev.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <input value={editEarningForm.notes} onChange={function(ev) { setEditEarningForm(function(f) { return Object.assign({}, f, { notes: ev.target.value }); }); }} style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', marginBottom: 8 }} placeholder="Notes" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={saveEditEarning} disabled={editEarningSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: editEarningSaving ? 0.6 : 1 }}>{editEarningSaving ? 'Saving…' : 'Save'}</button>
                      <button onClick={cancelEditEarning} disabled={editEarningSaving} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                      {e.event && <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{e.event}</span>}
                      {e.earning_source && <span style={{ fontSize: 12, color: '#888' }}>{e.earning_source}</span>}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', marginLeft: 'auto' }}>{fmt(e.amount || 0)}</span>
                    </div>
                    {e.notes && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{e.notes}</div>}
                    {e.date && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{e.date}</div>}
                  </div>
                  <button onClick={function() { startEditEarning(e); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={function() { deleteEarningItem(e.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showPnl && <EventsProfitLossModal onClose={function() { setShowPnl(false); }} />}

      {showVols && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>{area} Volunteers ({vols.length})</div>
              <button onClick={function() { setShowVols(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb' }}>x</button>
            </div>
            {vols.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No volunteers assigned to {area}.</div>
            ) : vols.map(function(v) {
              var isEditing = noteEdit === v.id;
              return (
                <div key={v.id} style={{ borderBottom: '0.5px solid #f0ece6', paddingBottom: 14, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {v['Picture URL'] ? (
                      <img src={driveImg(v['Picture URL'])} alt={v['First Name']} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#999', flexShrink: 0 }}>
                        {(v['First Name'] || '?')[0]}
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</span>
                      {v['Overview Notes'] && <span style={{ fontSize: 13, color: '#999', fontStyle: 'italic', marginLeft: 6 }}>{v['Overview Notes']}</span>}
                      {(v['Phone Number'] || v['Email']) ? (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
                          {[v['Phone Number'], v['Email']].filter(function(x) { return x && x.trim(); }).join(' | ')}
                        </div>
                      ) : null}
                    </div>
                    <select
                      value={v.Status || 'Active'}
                      onChange={function(e) {
                        var newStatus = e.target.value;
                        sbUpdate('2026 Volunteers', v['First Name'], v['Last Name'], { Status: newStatus });
                        setVols(function(prev) { return prev.map(function(x) { return x.id === v.id ? Object.assign({}, x, { Status: newStatus }) : x; }); });
                      }}
                      style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px', border: '0.5px solid #e0d8cc', borderRadius: 5, color: v.Status === 'Active' ? '#5a8a5a' : '#aaa', background: '#fff', cursor: 'pointer' }}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                  {isEditing ? (
                    <div>
                      <textarea value={noteVal} onChange={function(e) { setNoteVal(e.target.value); }} rows={3} autoFocus style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', resize: 'vertical', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button onClick={function() { saveNote(v); }} disabled={noteSaving === v.id} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: noteSaving === v.id ? 0.7 : 1 }}>{noteSaving === v.id ? 'Saving...' : 'Save'}</button>
                        <button onClick={function() { setNoteEdit(null); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#666' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, color: v.Notes ? '#555' : '#ccc', fontStyle: v.Notes ? 'normal' : 'italic', lineHeight: 1.5 }}>{v.Notes || 'No notes'}</div>
                      <button onClick={function() { setNoteEdit(v.id); setNoteVal(v.Notes || ''); }} style={{ flexShrink: 0, fontSize: 11, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Edit note</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showTodo && (function() {
        var weekDays = todoGetWeekDays(todoSelectedDate);
        var DAY_LABELS = ['M','T','W','T','F','S','S'];
        var dayItems = todoItems.filter(function(t) { return todoGetDate(t) === todoSelectedDate; });
        var activeItems = dayItems.filter(function(t) { return !t.done; });
        var doneItems = dayItems.filter(function(t) { return t.done; });
        var isToday = todoSelectedDate === todoTodayStr;
        var displayDate = new Date(todoSelectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        var dayTotalHours = dayItems.reduce(function(s, t) { return s + (t.hours || 0); }, 0);
        var fmtHours = function(h) { return h % 1 === 0 ? h + 'h' : h.toFixed(1) + 'h'; };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>★ Marketing Work Log</div>
                  {dayTotalHours > 0 && <div style={{ fontSize: 11, color: gold, fontWeight: 600, marginTop: 1 }}>{fmtHours(dayTotalHours)} logged today</div>}
                </div>
                <button onClick={function() { setShowTodo(false); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Close</button>
              </div>
              {/* Week strip */}
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #f5f1eb', display: 'flex', gap: 3, flexShrink: 0 }}>
                {weekDays.map(function(d, i) {
                  var dayH = todoItems.filter(function(t) { return todoGetDate(t) === d; }).reduce(function(s, t) { return s + (t.hours || 0); }, 0);
                  var cnt = todoItems.filter(function(t) { return todoGetDate(t) === d; }).length;
                  var isSel = d === todoSelectedDate; var isTod = d === todoTodayStr;
                  return (
                    <button key={d} onClick={function() { setTodoSelectedDate(d); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 2px', background: isSel ? gold : 'transparent', borderRadius: 7, border: 'none', cursor: 'pointer', color: isSel ? '#fff' : isTod ? gold : '#888' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{DAY_LABELS[i]}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{new Date(d + 'T12:00:00').getDate()}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, height: 14, background: isSel ? 'rgba(255,255,255,0.25)' : cnt === 0 ? 'transparent' : '#fef3c7', color: isSel ? '#fff' : '#b45309', borderRadius: 10, padding: cnt > 0 ? '1px 4px' : 0, display: 'flex', alignItems: 'center' }}>{dayH > 0 ? fmtHours(dayH) : cnt > 0 ? cnt + ' task' + (cnt > 1 ? 's' : '') : ''}</span>
                    </button>
                  );
                })}
              </div>
              {/* Day nav */}
              <div style={{ padding: '8px 14px', borderBottom: '0.5px solid #f5f1eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <button onClick={function() { todoNavigateDay(-1); }} style={{ background: '#f5f1eb', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#666' }}>←</button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>{displayDate}</div>
                  {!isToday && <button onClick={function() { setTodoSelectedDate(todoTodayStr); }} style={{ fontSize: 11, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>Back to today</button>}
                </div>
                <button onClick={function() { todoNavigateDay(1); }} style={{ background: '#f5f1eb', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#666' }}>→</button>
              </div>
              {/* Add entry */}
              <form onSubmit={addTodoItem} style={{ padding: '10px 14px', borderBottom: '0.5px solid #f5f1eb', display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={todoInput} onChange={function(e) { setTodoInput(e.target.value); }} placeholder="What did you work on?" style={{ flex: '1 1 180px', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, fontFamily: 'system-ui, sans-serif' }} />
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <input type="time" value={todoInputTime} onChange={function(e) { setTodoInputTime(e.target.value); }} style={{ padding: '8px 6px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, width: 96 }} />
                  <button type="button" onClick={function() { setTodoInputTime(todoNowTime()); }} title="Use current time" style={{ background: '#f5f1eb', border: 'none', borderRadius: 7, padding: '8px 8px', fontSize: 12, color: gold, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>Now</button>
                </div>
                <input type="number" value={todoInputHours} onChange={function(e) { setTodoInputHours(e.target.value); }} placeholder="hrs" min="0" max="24" step="0.25" style={{ padding: '8px 8px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, width: 58, flexShrink: 0 }} />
                <button type="submit" disabled={todoSaving || !todoInput.trim()} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (todoSaving || !todoInput.trim()) ? 0.6 : 1, flexShrink: 0 }}>Log</button>
              </form>
              {/* Entry list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {todoLoading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading…</div>
                ) : dayItems.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#ccc', fontSize: 13 }}>Nothing logged for this day.</div>
                ) : (
                  <div>
                    {activeItems.length > 0 && (
                      <div>
                        <div style={{ padding: '7px 16px', fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, background: '#fdfcfb', borderBottom: '0.5px solid #f0ece6' }}>Active · {activeItems.length}</div>
                        {activeItems.map(function(t) {
                          var time = todoGetTime(t); var isEditingTime = todoEditingTimeId === t.id; var isEditingHours = todoEditingHoursId === t.id;
                          return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', borderBottom: '0.5px solid #f9f6f2' }}>
                              <input type="checkbox" checked={false} onChange={function() { toggleTodoItem(t.id, false); }} style={{ accentColor: gold, width: 15, height: 15, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: '#2a2a2a', lineHeight: 1.4 }}>{t.item}</div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {isEditingTime ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <input type="time" value={todoEditTimeVal} onChange={function(e) { setTodoEditTimeVal(e.target.value); }} autoFocus style={{ padding: '3px 6px', border: '0.5px solid ' + gold, borderRadius: 6, fontSize: 12 }} />
                                      <button onClick={function() { saveTodoTime(t); }} style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                                      <button onClick={function() { setTodoEditingTimeId(null); }} style={{ fontSize: 11, background: '#f0ece6', color: '#666', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={function() { setTodoEditingTimeId(t.id); setTodoEditTimeVal(time); }} style={{ fontSize: 11, color: time ? gold : '#ccc', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: time ? 500 : 400 }}>⏰ {time ? todoFmtTime(time) : '+ set time'}</button>
                                  )}
                                  {isEditingHours ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <input type="number" value={todoEditHoursVal} onChange={function(e) { setTodoEditHoursVal(e.target.value); }} autoFocus min="0" max="24" step="0.25" style={{ padding: '3px 6px', border: '0.5px solid ' + gold, borderRadius: 6, fontSize: 12, width: 58 }} />
                                      <span style={{ fontSize: 11, color: '#888' }}>hrs</span>
                                      <button onClick={function() { saveTodoHours(t); }} style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                                      <button onClick={function() { setTodoEditingHoursId(null); }} style={{ fontSize: 11, background: '#f0ece6', color: '#666', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={function() { setTodoEditingHoursId(t.id); setTodoEditHoursVal(t.hours != null ? String(t.hours) : ''); }} style={{ fontSize: 11, color: t.hours ? '#2a2a2a' : '#ccc', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{t.hours ? '⏱ ' + fmtHours(t.hours) : '+ hours'}</button>
                                  )}
                                </div>
                              </div>
                              <button onClick={function() { deleteTodoItem(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {doneItems.length > 0 && (
                      <div>
                        <div style={{ padding: '7px 16px', fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, background: '#fdfcfb', borderBottom: '0.5px solid #f0ece6', borderTop: activeItems.length > 0 ? '0.5px solid #f0ece6' : 'none' }}>Done · {doneItems.length}</div>
                        {doneItems.map(function(t) {
                          var time = todoGetTime(t);
                          return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', borderBottom: '0.5px solid #f9f6f2', background: '#fafaf9' }}>
                              <input type="checkbox" checked={true} onChange={function() { toggleTodoItem(t.id, true); }} style={{ accentColor: gold, width: 15, height: 15, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: '#bbb', textDecoration: 'line-through', lineHeight: 1.4 }}>{t.item}</div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                                  {time && <span style={{ fontSize: 11, color: '#ccc' }}>⏰ {todoFmtTime(time)}</span>}
                                  {t.hours && <span style={{ fontSize: 11, color: '#ccc' }}>⏱ {fmtHours(t.hours)}</span>}
                                </div>
                              </div>
                              <button onClick={function() { deleteTodoItem(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {dayTotalHours > 0 && (
                      <div style={{ padding: '10px 16px', background: '#fdfcfb', borderTop: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#888' }}>{dayItems.length} {dayItems.length === 1 ? 'entry' : 'entries'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: gold }}>Total: {fmtHours(dayTotalHours)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SponsorsView() {
  var { useState, useEffect, useRef } = React;
  var isMobile = React.useContext(MobileCtx);
  var [sponsors, setSponsors] = useState(null);
  var [selected, setSelected] = useState(null);
  var [acks, setAcks] = useState([]);
  var [ackForm, setAckForm] = useState({ date: new Date().toISOString().slice(0,10), method: '', notes: '' });
  var [ackSaving, setAckSaving] = useState(false);
  var [logoUploading, setLogoUploading] = useState(false);
  var logoInputRef = useRef(null);
  var [allInKind, setAllInKind] = useState([]);
  var [inkind, setInkind] = useState([]);
  var [inkindForm, setInkindForm] = useState({ description: '', date: new Date().toISOString().slice(0,10), value: '' });
  var [inkindSaving, setInkindSaving] = useState(false);
  var [editing, setEditing] = useState(false);
  var [editSponsorForm, setEditSponsorForm] = useState({});
  var [editSponsorSaving, setEditSponsorSaving] = useState(false);
  var emptyAddForm = { 'Business Name': '', 'Main Contact': '', 'Donation': '', 'Fair Market Value': '', 'Area Supported': '', 'NSH Contact': '', 'Phone Number': '', 'Email Address': '', 'Mailing Address': '', 'Date Recieved': '', 'Notes': '' };
  var [showAdd, setShowAdd] = useState(false);
  var [addForm, setAddForm] = useState(emptyAddForm);
  var [addSaving, setAddSaving] = useState(false);
  var [tab, setTab] = useState('current');

  useEffect(function() {
    cachedFetchAll('Sponsors').then(function(rows) {
      if (Array.isArray(rows)) setSponsors(rows.slice().sort(function(a,b){return a.id-b.id;}));
    });
    cachedFetchAll('Sponsor In-Kind').then(function(rows) {
      if (Array.isArray(rows)) setAllInKind(rows);
    });
  }, []);

  useEffect(function() {
    if (!selected) { setAcks([]); setInkind([]); return; }
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor Acknowledgments') + '?sponsor_id=eq.' + selected.id + '&select=*&order=date.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setAcks(rows);
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor In-Kind') + '?sponsor_id=eq.' + selected.id + '&select=*&order=date.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setInkind(rows);
    });
  }, [selected]);

  function selectSponsor(s) {
    setSelected(s);
    setAckForm({ date: new Date().toISOString().slice(0,10), method: '', notes: '' });
    setInkindForm({ description: '', date: new Date().toISOString().slice(0,10), value: '' });
  }

  var TIERS = [
    { name: 'Innovator', min: 5000, color: '#7c3aed', bg: '#f3f0ff', border: '#c4b5fd', range: '$5,000–$9,999',
      benefits: ['Builder benefits, plus:', 'One "Sponsor Highlight" article in one of our quarterly newsletters', 'An 8"×8" commemorative brick placed as part of the brick terrace capital project', 'Picnic lunch or reception for you and ten guests in the North Star House'] },
    { name: 'Builder', min: 2500, color: '#1565c0', bg: '#e3f2fd', border: '#90caf9', range: '$2,500–$4,999',
      benefits: ['Believer benefits, plus:', 'Named Solo Sponsor of one NSHC event (name/logo in materials, event signage, recognized from stage)', 'A 4"×8" commemorative brick placed as part of the brick terrace capital project', 'Personal VIP tour of the upstairs construction project!'] },
    { name: 'Believer', min: 1000, color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7', range: '$1,000–$2,499',
      benefits: ['Company name/logo listed as a Sponsor in event programs, newsletters, website and yearly Sponsorship Banner', 'Invitation to State of the Star membership celebration', 'Two complimentary tickets to a NSHC event', 'Custom made plaque with yearly stars', 'Sponsor Spotlight on our social media platforms'] },
    { name: 'Friend of NSH', min: 250, color: '#b45309', bg: '#fffbeb', border: '#fcd34d', range: '$250–$999',
      benefits: ['Business name listed as a Friend in event programs, newsletters, and website', 'Invitation to State of the Star membership celebration'] },
  ];

  function getTier(total) {
    return TIERS.find(function(t) { return total >= t.min; }) || null;
  }

  function sponsorInKindTotal(sponsorId) {
    return allInKind.filter(function(e) { return e.sponsor_id === sponsorId; })
      .reduce(function(sum, e) { return sum + (parseFloat(e.value) || 0); }, 0);
  }

  function submitInKind(e) {
    e.preventDefault();
    if (!inkindForm.description || !inkindForm.date || !inkindForm.value) return;
    setInkindSaving(true);
    var payload = { sponsor_id: selected.id, description: inkindForm.description, date: inkindForm.date, value: parseFloat(inkindForm.value) };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor In-Kind'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.ok ? r.json() : r.json().then(function(e) { throw new Error(e.message || e.code || r.status); }); }).then(function(rows) {
      setInkindSaving(false);
      if (!Array.isArray(rows) || !rows[0]) { alert('Save failed: ' + JSON.stringify(rows)); return; }
      setInkind(function(prev) { return [rows[0]].concat(prev); });
      setAllInKind(function(prev) { return prev.concat([rows[0]]); });
      clearCache('Sponsor In-Kind');
      setInkindForm({ description: '', date: new Date().toISOString().slice(0,10), value: '' });
    }).catch(function(err) { alert('Error saving in-kind: ' + err.message); setInkindSaving(false); });
  }

  function deleteInKind(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor In-Kind') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      setInkind(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
      setAllInKind(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
    });
  }

  function handleLogoUpload(e) {
    var file = e.target.files[0];
    if (!file || !selected) return;
    setLogoUploading(true);
    var ext = file.name.split('.').pop();
    var filename = 'sponsor-' + selected.id + '-' + Date.now() + '.' + ext;
    fetch(SUPABASE_URL + '/storage/v1/object/sponsor-logos/' + filename, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type },
      body: file
    }).then(function(storageRes) {
      if (!storageRes.ok) {
        return storageRes.json().then(function(err) {
          alert('Logo upload failed: ' + (err.message || err.error || storageRes.status));
          setLogoUploading(false);
        });
      }
      var url = SUPABASE_URL + '/storage/v1/object/public/sponsor-logos/' + filename;
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsors') + '?id=eq.' + selected.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ logo_url: url })
      }).then(function(patchRes) {
        if (!patchRes.ok) {
          return patchRes.json().then(function(err) {
            alert('Failed to save logo URL: ' + (err.message || err.hint || patchRes.status) + '\n\nMake sure you have run: ALTER TABLE "Sponsors" ADD COLUMN IF NOT EXISTS logo_url TEXT;');
            setLogoUploading(false);
          });
        }
        var updated = Object.assign({}, selected, { logo_url: url });
        setSelected(updated);
        clearCache('Sponsors');
        setSponsors(function(prev) { return prev.map(function(s) { return s.id === selected.id ? updated : s; }); });
        setLogoUploading(false);
        e.target.value = '';
      });
    }).catch(function(err) { alert('Upload error: ' + err.message); setLogoUploading(false); });
  }

  function submitAck(e) {
    e.preventDefault();
    if (!ackForm.date) return;
    setAckSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor Acknowledgments'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ sponsor_id: selected.id, date: ackForm.date, method: ackForm.method || null, notes: ackForm.notes || null })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setAckSaving(false);
      if (Array.isArray(rows) && rows[0]) setAcks(function(prev) { return [rows[0]].concat(prev); });
      setAckForm({ date: new Date().toISOString().slice(0,10), method: '', notes: '' });
    }).catch(function() { setAckSaving(false); });
  }

  function deleteAck(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsor Acknowledgments') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() { setAcks(function(prev) { return prev.filter(function(a) { return a.id !== id; }); }); });
  }

  function saveEditSponsor() {
    if (!selected) return;
    setEditSponsorSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsors') + '?id=eq.' + selected.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(editSponsorForm)
    }).then(function() {
      var updated = Object.assign({}, selected, editSponsorForm);
      setSelected(updated);
      setSponsors(function(prev) { return prev.map(function(s) { return s.id === selected.id ? updated : s; }); });
      clearCache('Sponsors');
      setEditing(false);
      setEditSponsorSaving(false);
    }).catch(function() { setEditSponsorSaving(false); });
  }

  function submitAddSponsor(e) {
    e.preventDefault();
    if (!addForm['Business Name']) return;
    setAddSaving(true);
    var row = {};
    Object.keys(addForm).forEach(function(k) { if (addForm[k]) row[k] = addForm[k]; });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsors'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row)
    }).then(function(r) { return r.ok ? r.json() : r.json().then(function(err) { throw new Error(err.message || r.status); }); })
      .then(function(rows) {
        setAddSaving(false);
        if (!Array.isArray(rows) || !rows[0]) { alert('Save failed: ' + JSON.stringify(rows)); return; }
        var newSponsor = rows[0];
        clearCache('Sponsors');
        setSponsors(function(prev) { return (prev || []).concat([newSponsor]); });
        setShowAdd(false);
        setAddForm(emptyAddForm);
        setSelected(newSponsor);
      }).catch(function(err) { alert('Error adding sponsor: ' + err.message); setAddSaving(false); });
  }

  function InfoRow({ label, value, link }) {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 120, fontSize: 12, color: '#777', flexShrink: 0, paddingTop: 1 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#2a2a2a', flex: 1, lineHeight: 1.5 }}>
          {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: gold, textDecoration: 'none' }}>{value}</a> : value}
        </div>
      </div>
    );
  }

  var inpStyle = { width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box' };

  function resolvedTab(s) {
    if (s.sponsor_status) return s.sponsor_status;
    return 'current';
  }

  function setStatus(s, status) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Sponsors') + '?id=eq.' + s.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsor_status: status })
    }).then(function() {
      clearCache('Sponsors');
      setSponsors(function(prev) { return prev.map(function(sp) { return sp.id === s.id ? Object.assign({}, sp, { sponsor_status: status }) : sp; }); });
      setSelected(function(prev) { return prev && prev.id === s.id ? Object.assign({}, prev, { sponsor_status: status }) : prev; });
    });
  }

  var currentSponsors = sponsors ? sponsors.filter(function(s) { return resolvedTab(s) === 'current'; }) : [];
  var pastSponsors = sponsors ? sponsors.filter(function(s) { return resolvedTab(s) === 'past'; }) : [];
  var potentialSponsors = sponsors ? sponsors.filter(function(s) { return resolvedTab(s) === 'potential'; }) : [];
  var visibleSponsors = tab === 'current' ? currentSponsors : tab === 'past' ? pastSponsors : potentialSponsors;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Current" value={sponsors === null ? '...' : currentSponsors.length} />
        <StatCard label="Past" value={sponsors === null ? '...' : pastSponsors.length} />
        <StatCard label="Potential" value={sponsors === null ? '...' : potentialSponsors.length} />
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#f5f0ea', borderRadius: 10, padding: 4 }}>
        {[['current','Current'],['past','Past'],['potential','Potential']].map(function(pair) {
          var active = tab === pair[0];
          return (
            <button key={pair[0]} onClick={function() { setTab(pair[0]); setSelected(null); }}
              style={{ flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: active ? 600 : 400, background: active ? '#fff' : 'transparent', color: active ? '#2a2a2a' : '#888', cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {pair[1]}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#aaa' }}>{sponsors !== null ? visibleSponsors.length + ' sponsor' + (visibleSponsors.length !== 1 ? 's' : '') : ''}</div>
        <button onClick={function() { setAddForm(Object.assign({}, emptyAddForm, { sponsor_status: tab === 'current' ? null : tab })); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add New Sponsor</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (selected && !isMobile) ? '240px 1fr' : '1fr', gap: 16 }}>
        <div>
          {sponsors === null && <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>}
          {sponsors !== null && visibleSponsors.length === 0 && <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>No {tab} sponsors yet.</div>}
          {sponsors !== null && visibleSponsors.map(function(s) {
            var isSelected = selected && selected.id === s.id;
            return (
              <div key={s.id} onClick={function() { selectSponsor(isSelected ? null : s); }}
                style={{ background: isSelected ? '#faf5ee' : '#fff', border: '0.5px solid ' + (isSelected ? gold : '#e8e0d5'), borderRadius: 10, padding: '14px 18px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14 }}
                onMouseEnter={function(e) { if (!isSelected) e.currentTarget.style.background = '#fdfaf6'; }}
                onMouseLeave={function(e) { if (!isSelected) e.currentTarget.style.background = isSelected ? '#faf5ee' : '#fff'; }}>
                {s.logo_url
                  ? <img src={s.logo_url} alt={s['Business Name']} onError={function(e) { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, flexShrink: 0, border: '0.5px solid #e8e0d5' }} />
                  : null}
                <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f0ece6', display: s.logo_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: gold, flexShrink: 0 }}>{(s['Business Name'] || '?')[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a', marginBottom: 3 }}>{s['Business Name']}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {s['Main Contact'] && <span style={{ fontSize: 12, color: '#666' }}>{s['Main Contact']}</span>}
                    {s['Area Supported'] && <span style={{ fontSize: 12, color: '#aaa' }}>{s['Area Supported']}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {(function() {
                    var total = sponsorInKindTotal(s.id);
                    var tier = getTier(total);
                    return (
                      <>
                        {total > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: gold }}>${total.toLocaleString()}</div>}
                        {tier && <span style={{ fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 20, padding: '1px 8px' }}>{tier.name}</span>}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, padding: '20px 22px', alignSelf: 'start', position: 'sticky', top: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1, paddingRight: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', lineHeight: 1.3, marginBottom: 6 }}>{selected['Business Name']}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[['current','Current'],['past','Past'],['potential','Potential']].map(function(pair) {
                    var active = resolvedTab(selected) === pair[0];
                    return (
                      <button key={pair[0]} onClick={function() { setStatus(selected, pair[0]); }}
                        style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, border: '1px solid ' + (active ? gold : '#e0d8cc'), background: active ? '#faf5ee' : 'transparent', color: active ? gold : '#aaa', fontWeight: active ? 600 : 400, cursor: active ? 'default' : 'pointer' }}
                        disabled={active}>
                        {pair[1]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={function() { setEditSponsorForm({ 'Business Name': selected['Business Name'] || '', 'Main Contact': selected['Main Contact'] || '', 'Donation': selected['Donation'] || '', 'Fair Market Value': selected['Fair Market Value'] || '', 'Area Supported': selected['Area Supported'] || '', 'NSH Contact': selected['NSH Contact'] || '', 'Phone Number': selected['Phone Number'] || '', 'Email Address': selected['Email Address'] || '', 'Mailing Address': selected['Mailing Address'] || '', 'Date Recieved': selected['Date Recieved'] || '', 'Notes': selected['Notes'] || '' }); setEditing(true); }} style={{ background: 'none', border: '0.5px solid #e0d8cc', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#888', cursor: 'pointer' }}>Edit</button>
                <button onClick={function() { setSelected(null); setEditing(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb', lineHeight: 1 }}>×</button>
              </div>
            </div>
            {editing && (
              <div style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '0.5px solid #e8e0d5' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 12 }}>Edit Sponsor</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {[['Business Name','Business Name'],['Main Contact','Main Contact'],['Donation','Donation'],['Fair Market Value','Fair Market Value'],['Area Supported','Area Supported'],['NSH Contact','NSH Contact'],['Phone Number','Phone'],['Email Address','Email'],['Mailing Address','Address'],['Date Recieved','Date Received']].map(function(pair) {
                    return (
                      <div key={pair[0]}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{pair[1]}</div>
                        <input value={editSponsorForm[pair[0]] || ''} onChange={function(e) { var k = pair[0]; var v = e.target.value; setEditSponsorForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }} style={inpStyle} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Notes</div>
                  <textarea value={editSponsorForm['Notes'] || ''} onChange={function(e) { var v = e.target.value; setEditSponsorForm(function(f) { return Object.assign({}, f, { Notes: v }); }); }} rows={3} style={Object.assign({}, inpStyle, { resize: 'vertical' })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEditSponsor} disabled={editSponsorSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flex: 1 }}>{editSponsorSaving ? 'Saving…' : 'Save'}</button>
                  <button onClick={function() { setEditing(false); }} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 7, padding: '7px 16px', fontSize: 12, color: '#888', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Logo */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>Logo</div>
              {selected.logo_url
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={selected.logo_url} alt="logo" onError={function(e) { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='block'; }} style={{ maxHeight: 60, maxWidth: 160, objectFit: 'contain', border: '0.5px solid #e8e0d5', borderRadius: 6, padding: 4 }} />
                    <button onClick={function() { logoInputRef.current.click(); }} disabled={logoUploading} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>{logoUploading ? 'Uploading…' : 'Replace'}</button>
                  </div>
                : <button onClick={function() { logoInputRef.current.click(); }} disabled={logoUploading} style={{ fontSize: 12, color: gold, background: '#faf8f5', border: '0.5px dashed ' + gold, borderRadius: 8, padding: '10px 16px', cursor: 'pointer', width: '100%' }}>{logoUploading ? 'Uploading…' : '+ Upload Logo'}</button>
              }
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </div>

            {/* Info */}
            <InfoRow label="Main Contact" value={selected['Main Contact']} />
            <InfoRow label="Donation" value={selected['Donation']} />
            <InfoRow label="Fair Market Value" value={selected['Fair Market Value']} />
            <InfoRow label="Area Supported" value={selected['Area Supported']} />
            <InfoRow label="NSH Contact" value={selected['NSH Contact']} />
            <InfoRow label="Phone" value={selected['Phone Number']} />
            <InfoRow label="Email" value={selected['Email Address']} link={'mailto:' + selected['Email Address']} />
            <InfoRow label="Mailing Address" value={selected['Mailing Address']} />
            <InfoRow label="Date Received" value={selected['Date Recieved']} />
            {selected['Notes'] && (
              <div style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Notes</div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{selected['Notes']}</div>
              </div>
            )}

            {/* In-Kind Contributions */}
            <div style={{ borderTop: '0.5px solid #f0ece6', paddingTop: 16, marginTop: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600, marginBottom: 12 }}>In-Kind Contributions</div>
              {(function() {
                var total = inkind.reduce(function(s,e){return s+(parseFloat(e.value)||0);},0);
                var tier = getTier(total);
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: tier ? 10 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>${total.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: '#aaa' }}>total in-kind value</span>
                      {tier && <span style={{ fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 20, padding: '2px 10px' }}>{tier.name}</span>}
                    </div>
                    {tier && (
                      <div style={{ background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: tier.color, marginBottom: 6 }}>{tier.name} Benefits · {tier.range}</div>
                        {tier.benefits.map(function(b, i) {
                          return <div key={i} style={{ fontSize: 11, color: tier.color, opacity: 0.85, marginBottom: 3, paddingLeft: b.endsWith(':') ? 0 : 8 }}>{b.endsWith(':') ? b : '• ' + b}</div>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              <form onSubmit={submitInKind} style={{ background: '#faf8f5', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Scope of Work *</div>
                  <textarea value={inkindForm.description} onChange={function(e){setInkindForm(function(f){return Object.assign({},f,{description:e.target.value});});}} rows={2} style={Object.assign({}, inpStyle, { resize: 'vertical' })} placeholder="Describe the in-kind work or service…" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date *</div>
                    <input type="date" value={inkindForm.date} onChange={function(e){setInkindForm(function(f){return Object.assign({},f,{date:e.target.value});});}} style={inpStyle} required />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Ballpark Value ($) *</div>
                    <input type="number" min="0" step="1" value={inkindForm.value} onChange={function(e){setInkindForm(function(f){return Object.assign({},f,{value:e.target.value});});}} style={inpStyle} placeholder="e.g. 1500" required />
                  </div>
                </div>
                <button type="submit" disabled={inkindSaving || !inkindForm.description || !inkindForm.date || !inkindForm.value} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (inkindSaving || !inkindForm.description || !inkindForm.date || !inkindForm.value) ? 0.6 : 1, width: '100%' }}>{inkindSaving ? 'Saving…' : 'Add In-Kind Entry'}</button>
              </form>
              {inkind.length === 0
                ? <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>No in-kind entries yet.</div>
                : inkind.map(function(e) {
                    return (
                      <div key={e.id} style={{ padding: '8px 0', borderBottom: '0.5px solid #f5f0ea', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>${(parseFloat(e.value)||0).toLocaleString()}</span>
                            <span style={{ fontSize: 11, color: '#aaa' }}>{e.date}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{e.description}</div>
                        </div>
                        <button onClick={function() { deleteInKind(e.id); }} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: '2px 4px' }}>×</button>
                      </div>
                    );
                  })
              }
            </div>

            {/* Acknowledgments */}
            <div style={{ borderTop: '0.5px solid #f0ece6', paddingTop: 16, marginTop: 8 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', fontWeight: 600, marginBottom: 12 }}>Acknowledgment Log</div>
              <form onSubmit={submitAck} style={{ background: '#faf8f5', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date</div>
                    <input type="date" value={ackForm.date} onChange={function(e) { setAckForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={inpStyle} required />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Method</div>
                    <input value={ackForm.method} onChange={function(e) { setAckForm(function(f) { return Object.assign({}, f, { method: e.target.value }); }); }} style={inpStyle} placeholder="Letter, email, call…" />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Notes</div>
                  <textarea value={ackForm.notes} onChange={function(e) { setAckForm(function(f) { return Object.assign({}, f, { notes: e.target.value }); }); }} rows={2} style={Object.assign({}, inpStyle, { resize: 'vertical' })} placeholder="Details…" />
                </div>
                <button type="submit" disabled={ackSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: ackSaving ? 0.7 : 1, width: '100%' }}>{ackSaving ? 'Saving…' : 'Log Acknowledgment'}</button>
              </form>
              {acks.length === 0
                ? <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>No acknowledgments logged yet.</div>
                : acks.map(function(a) {
                    return (
                      <div key={a.id} style={{ padding: '8px 0', borderBottom: '0.5px solid #f5f0ea', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{a.date}</span>
                            {a.method && <span style={{ fontSize: 11, color: gold, background: '#faf5ee', borderRadius: 20, padding: '1px 8px' }}>{a.method}</span>}
                          </div>
                          {a.notes && <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{a.notes}</div>}
                        </div>
                        <button onClick={function() { deleteAck(a.id); }} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: '2px 4px' }}>×</button>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a' }}>New Sponsor</div>
              <button onClick={function() { setShowAdd(false); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>
            <form onSubmit={submitAddSponsor}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[['Business Name','Business Name *',true],['Main Contact','Main Contact',false],['Donation','Donation',false],['Fair Market Value','Fair Market Value',false],['Area Supported','Area Supported',false],['NSH Contact','NSH Contact',false],['Phone Number','Phone',false],['Email Address','Email',false],['Mailing Address','Address',false],['Date Recieved','Date Received',false]].map(function(pair) {
                  return (
                    <div key={pair[0]}>
                      <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>{pair[1]}</label>
                      <input required={pair[2]} value={addForm[pair[0]] || ''} onChange={function(e) { var k = pair[0]; var v = e.target.value; setAddForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }} style={inpStyle} placeholder={pair[1].replace(' *','')} />
                    </div>
                  );
                })}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={addForm['Notes'] || ''} onChange={function(e) { var v = e.target.value; setAddForm(function(f) { return Object.assign({}, f, { Notes: v }); }); }} rows={3} style={Object.assign({}, inpStyle, { resize: 'vertical' })} placeholder="Any additional notes…" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={addSaving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: addSaving ? 0.7 : 1 }}>{addSaving ? 'Saving…' : 'Add Sponsor'}</button>
                <button type="button" onClick={function() { setShowAdd(false); }} style={{ padding: '9px 18px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function QuarterWorkspaceView({ navigate }) {
  var { useState: useS, useEffect: useE, useRef } = React;
  var year = new Date().getFullYear();
  var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  var m = new Date().getMonth();
  var defaultQ = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
  var [wsQ, setWsQ] = useS(defaultQ);
  var [goals, setGoals] = useS({});
  var [updates, setUpdates] = useS({});
  var [notes, setNotes] = useS({});
  var [loading, setLoading] = useS(true);
  var [saving, setSaving] = useS({});
  var hdrs = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };

  useE(function() {
    setLoading(true);
    Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?quarter=eq.' + encodeURIComponent(wsQ) + '&year=eq.' + year + '&select=*', { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?quarter=eq.' + encodeURIComponent(wsQ) + '&year=eq.' + year + '&select=*&order=date_submitted.desc', { headers: hdrs }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/quarterly_notes?quarter=eq.' + encodeURIComponent(wsQ) + '&year=eq.' + year + '&select=*', { headers: hdrs }).then(function(r) { return r.json(); })
    ]).then(function(res) {
      var gm = {}; (Array.isArray(res[0]) ? res[0] : []).forEach(function(g) { gm[g.area] = g; });
      var um = {}; (Array.isArray(res[1]) ? res[1] : []).forEach(function(u) { if (!um[u.area]) um[u.area] = u; });
      var nm = {}; (Array.isArray(res[2]) ? res[2] : []).forEach(function(n) { nm[n.area] = n; });
      setGoals(gm); setUpdates(um); setNotes(nm);
      setLoading(false);
    });
  }, [wsQ]);

  function saveNote(area, field, val) {
    var key = area;
    setSaving(function(s) { return Object.assign({}, s, { [area + '.' + field]: true }); });
    var existing = notes[key];
    var payload = { area: area, quarter: wsQ, year: year, [field]: val || null, updated_at: new Date().toISOString() };
    var req = existing
      ? fetch(SUPABASE_URL + '/rest/v1/quarterly_notes?area=eq.' + encodeURIComponent(area) + '&quarter=eq.' + encodeURIComponent(wsQ) + '&year=eq.' + year, { method: 'PATCH', headers: Object.assign({}, hdrs, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ [field]: val || null, updated_at: new Date().toISOString() }) })
      : fetch(SUPABASE_URL + '/rest/v1/quarterly_notes', { method: 'POST', headers: Object.assign({}, hdrs, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(payload) });
    req.then(function(r) { return r.json(); }).then(function(rows) {
      var saved = Array.isArray(rows) ? rows[0] : rows;
      if (saved) setNotes(function(prev) { return Object.assign({}, prev, { [area]: saved }); });
      setSaving(function(s) { var next = Object.assign({}, s); delete next[area + '.' + field]; return next; });
    }).catch(function() {
      setSaving(function(s) { var next = Object.assign({}, s); delete next[area + '.' + field]; return next; });
    });
  }

  var inpSt = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, background: '#fdfcfb', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', resize: 'vertical', lineHeight: 1.55 };
  var secHd = { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 };
  var noteHd = { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  var chip = function(text, bg, color) { return React.createElement('span', { style: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color: color } }, text); };

  function AreaCard(props) {
    var area = props.area;
    var g = goals[area] || {};
    var u = updates[area];
    var n = notes[area] || {};
    var [localNotes, setLocalNotes] = useS({ goals_notes: n.goals_notes || '', reflection_notes: n.reflection_notes || '', next_quarter_notes: n.next_quarter_notes || '' });
    useE(function() { setLocalNotes({ goals_notes: n.goals_notes || '', reflection_notes: n.reflection_notes || '', next_quarter_notes: n.next_quarter_notes || '' }); }, [n.goals_notes, n.reflection_notes, n.next_quarter_notes]);

    var statusColors = { 'On track': { bg: '#e8f5e9', color: '#2e7d32' }, 'Minor adjustments needed': { bg: '#fff3e0', color: '#e65100' }, 'Off track - intervention required': { bg: '#ffebee', color: '#c62828' } };
    var hasSubmission = !!u;
    var hasGoals = !!(g.goal_1 || g.primary_focus);

    return (
      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', background: '#fdfcfb', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2a2a', flex: 1 }}>{area}</div>
          {hasSubmission ? chip('Reflection submitted', '#e8f5e9', '#2e7d32') : chip('No reflection', '#f5f0ea', '#aaa')}
          {!hasGoals && chip('No goals set', '#fce4e4', '#c62828')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left: review content */}
          <div style={{ padding: '14px 16px', borderRight: '0.5px solid #f0ece6' }}>

            {/* Goals */}
            <div style={{ marginBottom: 14 }}>
              <div style={secHd}>Quarterly Goals</div>
              {g.primary_focus && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Primary Focus</div><div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{g.primary_focus}</div></div>}
              {goalEntries(g, u).map(function(entry, idx) {
                var stColors = { 'On Track': { bg: '#eaf3ea', color: '#3a7d3a' }, 'Behind': { bg: '#fff3e0', color: '#c07040' }, 'Complete': { bg: '#e8f5e9', color: '#2e7d32' }, 'At Risk': { bg: '#fdecea', color: '#c62828' } };
                var sc = entry.status && stColors[entry.status] ? stColors[entry.status] : null;
                return (
                  <div key={idx} style={{ marginBottom: 6, background: sc ? sc.bg : '#faf8f5', borderRadius: 7, padding: '7px 10px', border: '0.5px solid ' + (sc ? sc.color + '33' : '#e8e0d5') }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>Goal {idx + 1}</div>
                        <div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{entry.text}</div>
                        {entry.summary && <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, marginTop: 3 }}>{entry.summary}</div>}
                      </div>
                      {sc && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#fff', color: sc.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{entry.status}</span>}
                    </div>
                  </div>
                );
              })}
              {!hasGoals && <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No goals submitted.</div>}
            </div>

            {/* Reflection */}
            <div style={{ borderTop: '0.5px solid #f5f1eb', paddingTop: 12, marginBottom: 14 }}>
              <div style={secHd}>Quarterly Reflection</div>
              {u ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {u.what_went_well || u.successes ? <div><div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>What Went Well</div><div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{u.what_went_well || u.successes}</div></div> : null}
                  {u.challenges && u.challenges.length > 0 ? <div><div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Challenges</div><div style={{ fontSize: 12, color: '#555' }}>{(Array.isArray(u.challenges) ? u.challenges : [u.challenges]).join(' · ')}</div>{u.challenges_details && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{u.challenges_details}</div>}</div> : null}
                  {u.support_needed && u.support_needed.length > 0 ? <div><div style={{ fontSize: 10, color: '#e65100', marginBottom: 2, fontWeight: 600 }}>Support Needed</div><div style={{ fontSize: 12, color: '#555' }}>{(Array.isArray(u.support_needed) ? u.support_needed : [u.support_needed]).join(' · ')}</div>{u.support_details && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{u.support_details}</div>}</div> : null}
                  {u.other_notes ? <div><div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Other Notes</div><div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{u.other_notes}</div></div> : null}
                  {u.next_focus ? <div><div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Next Quarter Focus</div><div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{u.next_focus}</div></div> : null}
                </div>
              ) : <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No reflection submitted yet.</div>}
            </div>

            {/* Next Q goals preview */}
            {(g.goal_1 || g.goal_2 || g.goal_3) && (
              <div style={{ borderTop: '0.5px solid #f5f1eb', paddingTop: 12 }}>
                <div style={secHd}>Next Quarter Focus</div>
                {u && u.next_focus ? <div style={{ fontSize: 12, color: '#2a2a2a', lineHeight: 1.5 }}>{u.next_focus}</div> : <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Not provided.</div>}
              </div>
            )}
          </div>

          {/* Right: notes */}
          <div style={{ padding: '14px 16px', background: '#fefcf8' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={noteHd}>
                <span>Goals Notes</span>
                {saving[area + '.goals_notes'] && <span style={{ fontSize: 9, color: '#bbb', fontWeight: 400 }}>saving…</span>}
              </div>
              <textarea
                value={localNotes.goals_notes}
                onChange={function(e) { setLocalNotes(function(l) { return Object.assign({}, l, { goals_notes: e.target.value }); }); }}
                onBlur={function(e) { if (e.target.value !== (n.goals_notes || '')) saveNote(area, 'goals_notes', e.target.value); }}
                placeholder="Notes on goals & progress…"
                rows={4}
                style={inpSt}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={noteHd}>
                <span>Reflection Notes</span>
                {saving[area + '.reflection_notes'] && <span style={{ fontSize: 9, color: '#bbb', fontWeight: 400 }}>saving…</span>}
              </div>
              <textarea
                value={localNotes.reflection_notes}
                onChange={function(e) { setLocalNotes(function(l) { return Object.assign({}, l, { reflection_notes: e.target.value }); }); }}
                onBlur={function(e) { if (e.target.value !== (n.reflection_notes || '')) saveNote(area, 'reflection_notes', e.target.value); }}
                placeholder="Discussion points, board focus areas, action items…"
                rows={5}
                style={inpSt}
              />
            </div>
            <div>
              <div style={noteHd}>
                <span>Next Quarter Notes</span>
                {saving[area + '.next_quarter_notes'] && <span style={{ fontSize: 9, color: '#bbb', fontWeight: 400 }}>saving…</span>}
              </div>
              <textarea
                value={localNotes.next_quarter_notes}
                onChange={function(e) { setLocalNotes(function(l) { return Object.assign({}, l, { next_quarter_notes: e.target.value }); }); }}
                onBlur={function(e) { if (e.target.value !== (n.next_quarter_notes || '')) saveNote(area, 'next_quarter_notes', e.target.value); }}
                placeholder="Priorities, recommendations for next quarter…"
                rows={3}
                style={inpSt}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={function() { navigate('reviews'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Reviews
        </button>
        <div style={{ fontSize: 12, color: '#ccc' }}>/</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>Review Workspace</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {quarters.map(function(q) {
            return (
              <button key={q} onClick={function() { setWsQ(q); }}
                style={{ padding: '5px 14px', borderRadius: 7, border: '0.5px solid ' + (wsQ === q ? gold : '#e0d8cc'), background: wsQ === q ? '#fef9f0' : '#fff', color: wsQ === q ? gold : '#888', fontSize: 12, fontWeight: wsQ === q ? 700 : 400, cursor: 'pointer' }}>
                {q}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#aaa' }}>{wsQ} {year} — Notes auto-save when you leave each field.</div>
      </div>
      {loading
        ? <div style={{ padding: 32, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Loading…</div>
        : OPERATIONAL_AREAS.map(function(area) { return React.createElement(AreaCard, { key: area, area: area }); })
      }
    </div>
  );
}

function ReviewsView({ navigate }) {
  var { useState, useEffect } = React;
  var year = new Date().getFullYear();
  var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  var [submitted, setSubmitted] = useState(null);
  var [reviewed, setReviewed] = useState({});   // 'area:quarter' -> review row
  var [activeCell, setActiveCell] = useState(null); // {area, quarter}
  var emptyCcForm = { status: 'On track', discussion_focus: '', potential_actions: '', escalation: 'None', escalation_other: '', priority_confirmation: 'Approved', review_date: '' };
  var [ccForm, setCcForm] = useState(emptyCcForm);
  var [ccSaving, setCcSaving] = useState(false);
  var [printQ, setPrintQ] = useState(null); // null = closed, else 'Q1'-'Q4'
  var [printing, setPrinting] = useState(false);

  function doPrint(quarter) {
    setPrinting(true);
    var headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    var nq = nextQ(quarter, year);
    Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*', { headers: headers }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*&order=date_submitted.desc', { headers: headers }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?quarter=eq.' + encodeURIComponent(nq.q) + '&year=eq.' + nq.yr + '&select=*', { headers: headers }).then(function(r) { return r.json(); })
    ]).then(function(results) {
      var goals = Array.isArray(results[0]) ? results[0] : [];
      var updates = Array.isArray(results[1]) ? results[1] : [];
      var nextGoals = Array.isArray(results[2]) ? results[2] : [];
      var goalsMap = {};
      goals.forEach(function(g) { goalsMap[g.area] = g; });
      var updatesMap = {};
      updates.forEach(function(u) { if (!updatesMap[u.area]) updatesMap[u.area] = u; });
      var nextGoalsMap = {};
      nextGoals.forEach(function(g) { nextGoalsMap[g.area] = g; });

      var line = '<hr style="border:none;border-top:1px solid #ccc;margin:14px 0">';
      var label = function(t) { return '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;margin-bottom:6px;margin-top:16px">' + t + '</div>'; };
      var field = function(val, lines) {
        lines = lines || 1;
        if (val) return '<div style="font-size:13px;color:#222;line-height:1.6;margin-bottom:4px">' + val.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') + '</div>';
        if (lines === 1) return '<div style="border-bottom:1px solid #bbb;height:22px;margin-bottom:8px"></div>';
        var out = '';
        for (var i = 0; i < lines; i++) out += '<div style="border-bottom:1px solid #bbb;height:22px;margin-bottom:8px"></div>';
        return out;
      };
      var radio = function(opts, checked) {
        return '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px">' + opts.map(function(o) {
          var on = checked === o;
          return '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#333"><span style="width:13px;height:13px;border-radius:50%;border:1.5px solid #888;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + (on ? '<span style="width:7px;height:7px;border-radius:50%;background:#888;display:block"></span>' : '') + '</span>' + o + '</label>';
        }).join('') + '</div>';
      };
      var checkboxList = function(opts, checked) {
        var arr = Array.isArray(checked) ? checked : [];
        return '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:8px">' + opts.map(function(o) {
          var on = arr.indexOf(o) !== -1;
          return '<label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#333"><span style="width:14px;height:14px;border:1.5px solid ' + (on ? '#2a2a2a' : '#888') + ';border-radius:2px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#2a2a2a;line-height:1">' + (on ? '&#10003;' : '&nbsp;') + '</span>' + o + '</label>';
        }).join('') + '</div>';
      };

      var nqLabel = nq.q + ' ' + nq.yr;
      var pages = OPERATIONAL_AREAS.map(function(area, idx) {
        var g = goalsMap[area] || {};
        var u = updatesMap[area];
        var ng = nextGoalsMap[area] || {};
        var pageBreak = idx > 0 ? 'page-break-before:always;' : '';
        var html = '<div style="' + pageBreak + 'padding:32px 40px;font-family:Georgia,serif;max-width:700px;margin:0 auto">';
        html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">';
        html += '<div style="font-size:22px;font-weight:700;color:#2a2a2a">' + area + '</div>';
        html += '<div style="font-size:13px;color:#888">' + quarter + ' ' + year + '</div>';
        html += '</div>' + line;

        // Goals
        html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Quarterly Goals</div>';
        if (g.primary_focus || !u) {
          html += label('Primary Focus') + field(g.primary_focus, 1);
        }
        goalEntries(g, u).forEach(function(entry, i) {
          html += label('Goal ' + (i + 1));
          html += '<div style="margin-bottom:4px">' + field(entry.text, 1) + '</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
          html += '<div>' + label('Status') + field(entry.status, 1) + '</div>';
          html += '<div>' + label('Summary') + field(entry.summary, 1) + '</div>';
          html += '</div>';
        });

        html += line;

        // Reflection
        html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Quarterly Reflection</div>';
        if (u) {
          html += label('What Went Well') + field(u.what_went_well || u.successes, 2);
          html += label('Challenges') + checkboxList(['Capacity or volunteer limitations','Budget or funding constraints','Scheduling or timing issues','Cross-area coordination gaps','External factors','Other'], u.challenges);
          if (u.challenges_details) html += '<div style="font-size:12px;color:#555;margin-bottom:8px;margin-top:2px">' + u.challenges_details.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
          html += label('Support Needed') + checkboxList(['Staff or volunteer help','Marketing or communications','Board guidance or decision','Funding or fundraising support','Facilities or logistics','Other'], u.support_needed);
          if (u.support_details) html += '<div style="font-size:12px;color:#555;margin-bottom:8px;margin-top:2px">' + u.support_details.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
          html += label('Other Notes') + field(u.other_notes, 2);
          html += label('Next Quarter Focus') + field(u.next_focus, 2);
          if (u.date_submitted) html += '<div style="font-size:11px;color:#aaa;margin-top:8px">Submitted ' + u.date_submitted + '</div>';
        } else {
          html += label('What Went Well') + field(null, 3);
          html += label('Challenges') + checkboxList(['Capacity or volunteer limitations','Budget or funding constraints','Scheduling or timing issues','Cross-area coordination gaps','External factors','Other'], []);
          html += label('Support Needed') + checkboxList(['Staff or volunteer help','Marketing or communications','Board guidance or decision','Funding or fundraising support','Facilities or logistics','Other'], []);
          html += label('Other Notes') + field(null, 2);
          html += label('Next Quarter Focus') + field(null, 2);
        }

        html += line;

        // Next Quarter Goals
        html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Next Quarter Goals (' + nqLabel + ')</div>';
        var ngExtra = Array.isArray(ng.extra_goals) ? ng.extra_goals.filter(Boolean) : [];
        if (ng.primary_focus || ng.goal_1 || ng.goal_2 || ng.goal_3 || ngExtra.length) {
          if (ng.primary_focus) html += label('Primary Focus') + field(ng.primary_focus, 1);
          ['1','2','3'].forEach(function(n) {
            var gval = ng['goal_' + n];
            if (gval) { html += label('Goal ' + n) + field(gval, 1); }
            else { html += label('Goal ' + n) + field(null, 1); }
          });
          ngExtra.forEach(function(gval, i) { html += label('Goal ' + (4 + i)) + field(gval, 1); });
        } else {
          html += '<div style="font-size:12px;color:#aaa;font-style:italic;margin-bottom:8px">No goals submitted yet for ' + nqLabel + '.</div>';
          html += label('Primary Focus') + field(null, 1);
          ['1','2','3'].forEach(function(n) { html += label('Goal ' + n) + field(null, 1); });
        }

        html += line;

        // Co-Champion Review (blank)
        html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Co-Champion Review</div>';
        html += label('Review Status');
        html += radio(['On track', 'Minor adjustments needed', 'Off track - intervention required'], null);
        html += label('Discussion Focus') + '<div style="font-size:11px;color:#aaa;margin-bottom:6px">What should the board focus on during discussion regarding this area?</div>' + field(null, 3);
        html += label('Potential Actions') + '<div style="font-size:11px;color:#aaa;margin-bottom:6px">Are there actions the board may want to consider?</div>' + field(null, 3);
        html += label('Escalation');
        html += radio(['None', 'Requires budget review', 'Requires policy clarification', 'Other'], null);
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:12px;color:#555">If Other:</span>' + field(null,1) + '</div>';
        html += label('Priority Confirmation (Next Quarter)');
        html += radio(['Approved', 'Adjusted', 'Replaced'], null);
        html += label('Review Completed') + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:#555">Date:</span><div style="border-bottom:1px solid #bbb;width:160px;height:22px"></div></div>';
        html += '</div>';
        return html;
      });

      var doc = '<!DOCTYPE html><html><head><title>NSH ' + quarter + ' ' + year + ' Review Packet</title><style>@media print{body{margin:0}}</style></head><body>' + pages.join('') + '</body></html>';
      var w = window.open('', '_blank');
      w.document.write(doc);
      w.document.close();
      w.focus();
      setTimeout(function() { w.print(); }, 400);
      setPrinting(false);
      setPrintQ(null);
    });
  }

  function loadData() {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?year=eq.' + year + '&select=area,quarter,support_needed&order=date_submitted.desc', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function(r) { return r.json(); }).then(function(rows) {
        var s = {};
        if (Array.isArray(rows)) rows.forEach(function(r) { if (!s[r.area + ':' + r.quarter]) s[r.area + ':' + r.quarter] = r; });
        setSubmitted(s);
      });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews') + '?year=eq.' + year + '&select=*', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function(r) { return r.json(); }).then(function(rows) {
        var rv = {};
        if (Array.isArray(rows)) rows.forEach(function(r) { rv[r.area + ':' + r.quarter] = r; });
        setReviewed(rv);
      });
  }

  useEffect(function() { loadData(); }, []);

  function openCell(area, quarter) {
    var key = area + ':' + quarter;
    var existing = reviewed[key];
    setCcForm(existing ? Object.assign({}, emptyCcForm, existing) : emptyCcForm);
    setActiveCell({ area: area, quarter: quarter });
  }

  function submitReview(e) {
    e.preventDefault();
    setCcSaving(true);
    var key = activeCell.area + ':' + activeCell.quarter;
    var existing = reviewed[key];
    var payload = { area: activeCell.area, quarter: activeCell.quarter, year: year, status: ccForm.status, discussion_focus: ccForm.discussion_focus || null, potential_actions: ccForm.potential_actions || null, escalation: ccForm.escalation, escalation_other: ccForm.escalation === 'Other' ? ccForm.escalation_other || null : null, priority_confirmation: ccForm.priority_confirmation, review_date: ccForm.review_date || null };
    var req = existing
      ? fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews') + '?id=eq.' + existing.id, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      : fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Co-Champion Reviews'), { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) });
    req.then(function(r) { return r.json(); }).then(function(rows) {
      var saved = (rows && rows[0]) ? rows[0] : Object.assign({ id: existing && existing.id }, payload);
      setReviewed(function(prev) { var next = Object.assign({}, prev); next[key] = saved; return next; });
      setCcSaving(false);
      setActiveCell(null);
    });
  }

  var statusColors = { 'On track': { bg: '#e8f5e9', color: '#2e7d32' }, 'Minor adjustments needed': { bg: '#fff3e0', color: '#e65100' }, 'Off track - intervention required': { bg: '#ffebee', color: '#c62828' } };
  var ccInp = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, background: '#fff', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' };
  var ccLbl = { fontSize: 11, color: '#888', fontWeight: 500, marginBottom: 4, display: 'block' };
  var ccGrp = { marginBottom: 14 };

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e0d5', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600 }}>Quarterly Updates — {year}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={function() { navigate('quarter-workspace'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Review &amp; Add Notes
            </button>
            <button onClick={function() { setPrintQ('Q1'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Packet
            </button>
          </div>
        </div>
        <div className="nsh-reviews-scroll" style={{ padding: '0 20px' }}>
          <div style={{ minWidth: 400 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(4, 1fr)', borderBottom: '0.5px solid #f0ece6', padding: '10px 0' }}>
            <div />
            {quarters.map(function(q) {
              return <div key={q} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>{q}</div>;
            })}
          </div>
          {submitted === null
            ? <div style={{ padding: '20px 0', color: '#bbb', fontSize: 13, textAlign: 'center' }}>Loading…</div>
            : OPERATIONAL_AREAS.map(function(area) {
              return (
                <div key={area} style={{ display: 'grid', gridTemplateColumns: '160px repeat(4, 1fr)', borderBottom: '0.5px solid #f9f6f2', padding: '12px 0', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}>{area}</div>
                  {quarters.map(function(q) {
                    var key = area + ':' + q;
                    var submission = submitted && submitted[key];
                    var hasReflection = !!submission;
                    var hasReview = reviewed[key];
                    var needsSupport = submission && Array.isArray(submission.support_needed) && submission.support_needed.length > 0;
                    return (
                      <div key={q} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {hasReview ? (
                            <button onClick={function() { openCell(area, q); }} title="Review submitted — click to edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={gold} stroke={gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                          ) : hasReflection ? (
                            <button onClick={function() { openCell(area, q); }} title="Reflection received — click to add review" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </div>
                            </button>
                          ) : (
                            <div title="Not yet submitted" style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #e0d8cc', background: '#faf8f5' }} />
                          )}
                          {needsSupport && (
                            <div title={'Needs support: ' + submission.support_needed.join(', ')} style={{ position: 'absolute', top: -4, right: -6, width: 10, height: 10, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff', flexShrink: 0 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          }
        </div>
        </div>
      </div>

      {printQ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a', marginBottom: 6, fontFamily: "'Cardo', serif" }}>Print Review Packet</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>Select a quarter to print goals, reflections, and blank co-champion review forms for all areas.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {['Q1','Q2','Q3','Q4'].map(function(q) {
                return (
                  <button key={q} onClick={function() { setPrintQ(q); }}
                    style={{ padding: '12px', borderRadius: 9, border: '0.5px solid ' + (printQ === q ? gold : '#e0d8cc'), background: printQ === q ? '#fef9f0' : '#faf8f5', color: printQ === q ? gold : '#555', fontSize: 14, fontWeight: printQ === q ? 700 : 400, cursor: 'pointer', transition: 'all 0.1s' }}>
                    {q}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={function() { doPrint(printQ); }} disabled={printing} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: printing ? 0.7 : 1 }}>
                {printing ? 'Preparing…' : 'Print ' + printQ + ' Packet'}
              </button>
              <button onClick={function() { setPrintQ(null); }} style={{ padding: '10px 16px', background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {activeCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{activeCell.area}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{activeCell.quarter} {year} — Co-Champion Review</div>
              </div>
              <button onClick={function() { setActiveCell(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>
            <form onSubmit={submitReview}>
              <div style={ccGrp}>
                <span style={ccLbl}>Review Status</span>
                {['On track', 'Minor adjustments needed', 'Off track - intervention required'].map(function(opt) {
                  return (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: '#2a2a2a' }}>
                      <input type="radio" name="cc_status" value={opt} checked={ccForm.status === opt} onChange={function() { setCcForm(function(f) { return Object.assign({}, f, { status: opt }); }); }} style={{ accentColor: gold }} />
                      {opt}
                    </label>
                  );
                })}
              </div>
              <div style={ccGrp}>
                <span style={ccLbl}>Discussion Focus</span>
                <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>What should the board focus on during discussion regarding this area?</div>
                <textarea value={ccForm.discussion_focus} onChange={function(e) { setCcForm(function(f) { return Object.assign({}, f, { discussion_focus: e.target.value }); }); }} rows={3} style={Object.assign({}, ccInp, { resize: 'vertical' })} />
              </div>
              <div style={ccGrp}>
                <span style={ccLbl}>Potential Actions</span>
                <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>Are there actions the board may want to consider?</div>
                <textarea value={ccForm.potential_actions} onChange={function(e) { setCcForm(function(f) { return Object.assign({}, f, { potential_actions: e.target.value }); }); }} rows={3} style={Object.assign({}, ccInp, { resize: 'vertical' })} />
              </div>
              <div style={ccGrp}>
                <span style={ccLbl}>Escalation</span>
                {['None', 'Requires budget review', 'Requires policy clarification', 'Other'].map(function(opt) {
                  return (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: '#2a2a2a' }}>
                      <input type="radio" name="cc_escalation" value={opt} checked={ccForm.escalation === opt} onChange={function() { setCcForm(function(f) { return Object.assign({}, f, { escalation: opt }); }); }} style={{ accentColor: gold }} />
                      {opt}
                    </label>
                  );
                })}
                {ccForm.escalation === 'Other' && <input value={ccForm.escalation_other} onChange={function(e) { setCcForm(function(f) { return Object.assign({}, f, { escalation_other: e.target.value }); }); }} style={Object.assign({}, ccInp, { marginTop: 4 })} placeholder="Describe escalation…" />}
              </div>
              <div style={ccGrp}>
                <span style={ccLbl}>Priority Confirmation (Next Quarter)</span>
                {['Approved', 'Adjusted', 'Replaced'].map(function(opt) {
                  return (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: '#2a2a2a' }}>
                      <input type="radio" name="cc_priority" value={opt} checked={ccForm.priority_confirmation === opt} onChange={function() { setCcForm(function(f) { return Object.assign({}, f, { priority_confirmation: opt }); }); }} style={{ accentColor: gold }} />
                      {opt}
                    </label>
                  );
                })}
              </div>
              <div style={ccGrp}>
                <span style={ccLbl}>Review Completed</span>
                <input type="date" value={ccForm.review_date} onChange={function(e) { setCcForm(function(f) { return Object.assign({}, f, { review_date: e.target.value }); }); }} style={ccInp} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={ccSaving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: ccSaving ? 0.7 : 1 }}>{ccSaving ? 'Saving…' : 'Submit Review'}</button>
                <button type="button" onClick={function() { setActiveCell(null); }} style={{ padding: '10px 16px', background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FinancialsView() {
  var { useState, useEffect, useRef } = React;

  // Reimbursements
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(true);
  var [markingId, setMarkingId] = useState(null);
  var [noteBoxId, setNoteBoxId] = useState(null);
  var [noteBoxAction, setNoteBoxAction] = useState(null);
  var [noteDraft, setNoteDraft] = useState('');
  var [reviewerName, setReviewerName] = useState(function() { try { return localStorage.getItem('nsh-reviewer-name') || ''; } catch (e) { return ''; } });

  // Earnings (Creative Rentals)
  var RENTAL_NAMES = ['Yoga with Teena Bates', 'Mahjong Group', 'Donation Box', 'Book Sales', 'Other'];
  var PAYMENT_TYPES = ['Cash', 'Card', 'Check'];
  var emptyRentalForm = { name: 'Yoga with Teena Bates', custom_name: '', amount: '', date: new Date().toISOString().slice(0,10), payment_type: 'Cash' };
  var [rentals, setRentals] = useState([]);
  var [rentalsLoading, setRentalsLoading] = useState(true);
  var [rentalForm, setRentalForm] = useState(emptyRentalForm);
  var [rentalSaving, setRentalSaving] = useState(false);
  var [showRentalForm, setShowRentalForm] = useState(false);

  // Cash Log (Expenditures)
  var [cashLog, setCashLog] = useState([]);
  var [cashLoading, setCashLoading] = useState(true);
  var emptyCashForm = { description: '', amount: '', date: new Date().toISOString().slice(0,10), direction: 'Out' };
  var [cashForm, setCashForm] = useState(emptyCashForm);
  var [showCashForm, setShowCashForm] = useState(false);
  var [cashSaving, setCashSaving] = useState(false);

  // Resources
  var [resources, setResources] = useState([]);
  var [resourcesLoading, setResourcesLoading] = useState(true);
  var [ideas, setIdeas] = useState([]);
  var [volList, setVolList] = useState([]);
  var [showAddResource, setShowAddResource] = useState(false);
  var [resourceType, setResourceType] = useState('link');
  var [resourceTitle, setResourceTitle] = useState('');
  var [resourceUrl, setResourceUrl] = useState('');
  var [resourceSaving, setResourceSaving] = useState(false);
  var resourceFileRef = useRef(null);
  var [showPnl, setShowPnl] = useState(false);


  function loadReimbursements() {
    setLoading(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?needs_reimbursement=eq.true&select=*&order=date.desc,id.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) { setItems(Array.isArray(rows) ? rows : []); setLoading(false); });
  }

  function loadRentals() {
    setRentalsLoading(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Creative Rentals') + '?select=*&order=date.desc,id.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) { setRentals(Array.isArray(rows) ? rows : []); setRentalsLoading(false); });
  }

  useEffect(function() {
    loadReimbursements();
    loadRentals();
    cachedSbFetch('2026 Volunteers', ['id', 'First Name', 'Last Name', 'Address', 'Status']).then(function(rows) {
      if (Array.isArray(rows)) setVolList(rows);
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Ideas') + '?select=id,title,submitted_by', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) { if (Array.isArray(rows)) setIdeas(rows); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Cash Log') + '?select=*&order=date.desc,id.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setCashLog(rows);
      setCashLoading(false);
    }).catch(function() { setCashLoading(false); });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources') + '?area=eq.Financials&select=*&order=created_at.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setResources(rows);
      setResourcesLoading(false);
    }).catch(function() { setResourcesLoading(false); });
  }, []);

  function markReimbursed(id) {
    setMarkingId(id);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ needs_reimbursement: false })
    }).then(function() {
      clearCache('Op Budget');
      setMarkingId(null);
      setItems(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    });
  }

  // Volunteer-submitted reimbursement workflow (rows with volunteer_auth_user_id set)
  var REIM_STATUSES = ['Submitted', 'Pending Review', 'More Information Needed', 'Approved', 'Paid', 'Denied'];
  var REIM_STATUS_COLORS = {
    'Submitted': '#1d4ed8', 'Pending Review': '#92600c', 'More Information Needed': '#c2410c',
    'Approved': '#15803d', 'Paid': '#15803d', 'Denied': '#c0392b'
  };

  function updateReimbursementStatus(id, status, reviewerNotes) {
    setMarkingId(id);
    try { localStorage.setItem('nsh-reviewer-name', reviewerName || ''); } catch (e) {}
    var payload = { status: status, reviewed_at: new Date().toISOString(), reviewed_by: reviewerName || null };
    if (reviewerNotes !== undefined) payload.reviewer_notes = reviewerNotes || null;
    if (status === 'Paid' || status === 'Denied') payload.needs_reimbursement = false;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      clearCache('Op Budget');
      setMarkingId(null);
      setNoteBoxId(null);
      setNoteBoxAction(null);
      setNoteDraft('');
      var updated = rows && rows[0];
      if (payload.needs_reimbursement === false) {
        setItems(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
      } else if (updated) {
        setItems(function(prev) { return prev.map(function(b) { return b.id === id ? updated : b; }); });
      }
    });
  }

  function openNoteBox(id, action) {
    setNoteBoxId(id);
    setNoteBoxAction(action);
    setNoteDraft('');
  }

  function reimReceipts(receiptUrl) {
    if (!receiptUrl) return [];
    try { var p = JSON.parse(receiptUrl); if (Array.isArray(p)) return p; } catch (e) {}
    return [receiptUrl];
  }

  function submitRental(e) {
    e.preventDefault();
    var finalName = rentalForm.name === 'Other' ? rentalForm.custom_name : rentalForm.name;
    if (!finalName || !rentalForm.amount || !rentalForm.date) return;
    setRentalSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Creative Rentals'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ name: finalName, amount: parseFloat(rentalForm.amount), date: rentalForm.date, payment_type: rentalForm.payment_type })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      var newRow = (rows && rows[0]) ? rows[0] : { name: finalName, amount: parseFloat(rentalForm.amount), date: rentalForm.date, payment_type: rentalForm.payment_type };
      setRentals(function(prev) { return [newRow].concat(prev); });
      setRentalForm(emptyRentalForm);
      setShowRentalForm(false);
      setRentalSaving(false);
    }).catch(function() { setRentalSaving(false); });
  }

  function submitCash(e) {
    e.preventDefault();
    if (!cashForm.description || !cashForm.amount || !cashForm.date) return;
    setCashSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Cash Log'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ description: cashForm.description, amount: parseFloat(cashForm.amount), date: cashForm.date, direction: cashForm.direction })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      var newRow = rows && rows[0] ? rows[0] : { description: cashForm.description, amount: parseFloat(cashForm.amount), date: cashForm.date, direction: cashForm.direction };
      setCashLog(function(p) { return [newRow].concat(p); });
      setCashForm(emptyCashForm); setShowCashForm(false); setCashSaving(false);
    }).catch(function() { setCashSaving(false); });
  }

  function deleteCash(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Cash Log') + '?id=eq.' + id, {
      method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() { setCashLog(function(p) { return p.filter(function(c) { return c.id !== id; }); }); });
  }


  function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var reimTotal = items.reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
  var rentTotal = rentals.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
  var byArea = {};
  items.forEach(function(b) { var a = b.area || 'Unknown'; if (!byArea[a]) byArea[a] = []; byArea[a].push(b); });

  var inpSt = { width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' };

  return (
    <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <button onClick={function() { setShowPnl(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Events Profit / Loss</button>
    </div>
    {showPnl && <EventsProfitLossModal onClose={function() { setShowPnl(false); }} />}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e0d5', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdfcfb' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>Pending Reimbursements</div>
            {!loading && items.length > 0 && <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600, marginTop: 2 }}>{fmt(reimTotal)} total · {items.length} item{items.length !== 1 ? 's' : ''}</div>}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: '24px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '24px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No pending reimbursements.</div>
        ) : (
          <div>
          {Object.keys(byArea).sort().map(function(area) {
            var areaItems = byArea[area];
            var areaTotal = areaItems.reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
            return (
              <div key={area}>
                <div style={{ padding: '10px 18px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{area}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>{fmt(areaTotal)}</div>
                  </div>
                </div>
                {areaItems.map(function(b) {
                  var isMarking = markingId === b.id;
                  var volMatch = b.volunteer_name && volList.find(function(v) { return ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim() === b.volunteer_name; });
                  var volAddress = volMatch && volMatch['Address'];

                  // Legacy Portal-logged reimbursement (no Volunteer Hub identity) — unchanged behavior.
                  if (!b.volunteer_auth_user_id) {
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#2a2a2a' }}>{b.description || '—'}</div>
                          {b.volunteer_name && (
                            <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 500, marginTop: 2 }}>
                              {b.volunteer_name}{volAddress ? <span style={{ color: '#888', fontWeight: 400 }}> · {volAddress}</span> : null}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{b.date || ''}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2a2a', flexShrink: 0 }}>{fmt(parseFloat(b.amount) || 0)}</div>
                        {b.receipt_url && (
                          <a href={b.receipt_url} target="_blank" title="View receipt" style={{ color: gold, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                          </a>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: isMarking ? 'default' : 'pointer', flexShrink: 0 }}>
                          <input type="checkbox" checked={false} disabled={isMarking} onChange={function() { markReimbursed(b.id); }} style={{ accentColor: '#059669', width: 14, height: 14 }} />
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>{isMarking ? '…' : 'Reimbursed'}</span>
                        </label>
                      </div>
                    );
                  }

                  // Volunteer Hub submission — full status workflow.
                  var receipts = reimReceipts(b.receipt_url);
                  var statusColor = REIM_STATUS_COLORS[b.status] || '#666';
                  var noteOpen = noteBoxId === b.id;
                  return (
                    <div key={b.id} style={{ padding: '11px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#2a2a2a' }}>{b.description || '—'}</div>
                          <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 500, marginTop: 2 }}>
                            {b.volunteer_name || 'Volunteer'}{volAddress ? <span style={{ color: '#888', fontWeight: 400 }}> · {volAddress}</span> : null}
                          </div>
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                            {b.date || ''}{b.event_name ? ' · ' + b.event_name : ''}
                          </div>
                          {b.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' }}>"{b.notes}"</div>}
                          {b.reviewer_notes && (b.status === 'More Information Needed' || b.status === 'Denied') && (
                            <div style={{ fontSize: 11, color: statusColor, marginTop: 4 }}><strong>Note sent:</strong> {b.reviewer_notes}</div>
                          )}
                          {receipts.length > 0 && (
                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                              {receipts.map(function(url, i) {
                                return <a key={i} href={url} target="_blank" style={{ fontSize: 11, color: gold }}>Receipt{receipts.length > 1 ? ' ' + (i + 1) : ''}</a>;
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2a2a' }}>{fmt(parseFloat(b.amount) || 0)}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: statusColor, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{b.status || 'Submitted'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {b.status === 'Submitted' && (
                          <button disabled={isMarking} onClick={function() { updateReimbursementStatus(b.id, 'Pending Review'); }} style={{ fontSize: 11, background: '#f5f0ea', color: '#666', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Start Review</button>
                        )}
                        {(b.status === 'Submitted' || b.status === 'Pending Review') && (
                          <>
                            <button disabled={isMarking} onClick={function() { updateReimbursementStatus(b.id, 'Approved', ''); }} style={{ fontSize: 11, background: '#e3f6ec', color: '#15803d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Approve</button>
                            <button disabled={isMarking} onClick={function() { openNoteBox(b.id, 'more_info'); }} style={{ fontSize: 11, background: '#fde8e0', color: '#c2410c', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Request Info</button>
                            <button disabled={isMarking} onClick={function() { openNoteBox(b.id, 'deny'); }} style={{ fontSize: 11, background: '#fbe4e4', color: '#c0392b', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Deny</button>
                          </>
                        )}
                        {b.status === 'Approved' && (
                          <button disabled={isMarking} onClick={function() { updateReimbursementStatus(b.id, 'Paid', ''); }} style={{ fontSize: 11, background: '#e3f6ec', color: '#15803d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>{isMarking ? 'Saving…' : 'Mark Paid'}</button>
                        )}
                        {b.status === 'More Information Needed' && (
                          <div style={{ fontSize: 11, color: '#c2410c' }}>Waiting on volunteer to resubmit.</div>
                        )}
                      </div>

                      {noteOpen && (
                        <div style={{ marginTop: 8, background: '#fdfcfb', border: '0.5px solid #e8e0d5', borderRadius: 8, padding: 10 }}>
                          <input placeholder="Your name (shown as reviewer)" value={reviewerName} onChange={function(e) { setReviewerName(e.target.value); }} style={{ width: '100%', padding: '6px 9px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
                          <textarea placeholder={noteBoxAction === 'deny' ? 'Reason for denial (sent to volunteer)' : 'What additional info is needed?'} value={noteDraft} onChange={function(e) { setNoteDraft(e.target.value); }} rows={2} style={{ width: '100%', padding: '6px 9px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={function() { setNoteBoxId(null); setNoteBoxAction(null); }} style={{ fontSize: 11, background: '#f5f0ea', color: '#666', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
                            <button disabled={!noteDraft.trim()} onClick={function() { updateReimbursementStatus(b.id, noteBoxAction === 'deny' ? 'Denied' : 'More Information Needed', noteDraft.trim()); }} style={{ fontSize: 11, background: noteBoxAction === 'deny' ? '#c0392b' : '#c2410c', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', opacity: !noteDraft.trim() ? 0.6 : 1 }}>{noteBoxAction === 'deny' ? 'Confirm Deny' : 'Send Request'}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ padding: '14px 18px', borderTop: '1.5px solid #e8e0d5', background: '#fdfcfb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{items.length} item{items.length !== 1 ? 's' : ''} · Total to reimburse</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309' }}>{fmt(reimTotal)}</div>
          </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e0d5', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdfcfb' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>Earnings</div>
            {!rentalsLoading && rentals.length > 0 && <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 2 }}>{fmt(rentTotal)} total · {rentals.length} entr{rentals.length !== 1 ? 'ies' : 'y'}</div>}
          </div>
          <button onClick={function() { setShowRentalForm(function(v) { return !v; }); }} style={{ fontSize: 12, background: showRentalForm ? '#f5f0ea' : gold, color: showRentalForm ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 500 }}>{showRentalForm ? 'Cancel' : '+ Log Earning'}</button>
        </div>
        {showRentalForm && (
          <form onSubmit={submitRental} style={{ padding: '16px 18px', borderBottom: '0.5px solid #f0ece6', background: '#fefcf8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Rental Name</label>
                <select name="name" value={rentalForm.name} onChange={function(e) { setRentalForm(function(f) { return Object.assign({}, f, { name: e.target.value, custom_name: '' }); }); }} style={inpSt}>
                  {RENTAL_NAMES.map(function(n) { return <option key={n} value={n}>{n}</option>; })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Payment Type</label>
                <select name="payment_type" value={rentalForm.payment_type} onChange={function(e) { setRentalForm(function(f) { return Object.assign({}, f, { payment_type: e.target.value }); }); }} style={inpSt}>
                  {PAYMENT_TYPES.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
                </select>
              </div>
            </div>
            {rentalForm.name === 'Other' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Specify Name</label>
                <input required name="custom_name" value={rentalForm.custom_name} onChange={function(e) { setRentalForm(function(f) { return Object.assign({}, f, { custom_name: e.target.value }); }); }} placeholder="Enter rental name" style={inpSt} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Amount</label>
                <input required name="amount" type="number" step="0.01" min="0" value={rentalForm.amount} onChange={function(e) { setRentalForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} placeholder="0.00" style={inpSt} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Date</label>
                <input required name="date" type="date" value={rentalForm.date} onChange={function(e) { setRentalForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={inpSt} />
              </div>
            </div>
            <button type="submit" disabled={rentalSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: rentalSaving ? 0.7 : 1 }}>{rentalSaving ? 'Saving…' : 'Save Earning'}</button>
          </form>
        )}
        {rentalsLoading ? (
          <div style={{ padding: '24px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Loading…</div>
        ) : rentals.length === 0 ? (
          <div style={{ padding: '24px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No earnings logged yet.</div>
        ) : rentals.map(function(r) {
          return (
            <div key={r.id || r.date + r.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#2a2a2a', fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{r.date}{r.payment_type ? ' · ' + r.payment_type : ''}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', flexShrink: 0 }}>{fmt(parseFloat(r.amount) || 0)}</div>
            </div>
          );
        })}
      </div>

      {/* Expenditures / Cash Log */}
      {(function() {
        var cashIn = cashLog.filter(function(c) { return c.direction === 'In'; }).reduce(function(s, c) { return s + (parseFloat(c.amount) || 0); }, 0);
        var cashOut = cashLog.filter(function(c) { return c.direction === 'Out'; }).reduce(function(s, c) { return s + (parseFloat(c.amount) || 0); }, 0);
        return (
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e0d5', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdfcfb' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>Expenditures</div>
                {!cashLoading && cashLog.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 2, display: 'flex', gap: 10 }}>
                    {cashIn > 0 && <span style={{ color: '#059669', fontWeight: 600 }}>↑ {fmt(cashIn)}</span>}
                    <span style={{ color: '#c62828', fontWeight: 600 }}>↓ {fmt(cashOut)}</span>
                    {cashIn > 0 && <span style={{ color: '#888', fontWeight: 500 }}>Net {fmt(cashIn - cashOut)}</span>}
                  </div>
                )}
              </div>
              <button onClick={function() { setShowCashForm(function(v) { return !v; }); }} style={{ fontSize: 12, background: showCashForm ? '#f5f0ea' : gold, color: showCashForm ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 500 }}>{showCashForm ? 'Cancel' : '+ Log Cash'}</button>
            </div>
            {showCashForm && (
              <form onSubmit={submitCash} style={{ padding: '14px 18px', borderBottom: '0.5px solid #f0ece6', background: '#fefcf8' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Description *</label>
                  <input required value={cashForm.description} onChange={function(e) { setCashForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} placeholder="What is this for?" style={inpSt} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Amount *</label>
                    <input required type="number" step="0.01" min="0" value={cashForm.amount} onChange={function(e) { setCashForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} placeholder="0.00" style={inpSt} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Date *</label>
                    <input required type="date" value={cashForm.date} onChange={function(e) { setCashForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={inpSt} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Direction</label>
                    <select value={cashForm.direction} onChange={function(e) { setCashForm(function(f) { return Object.assign({}, f, { direction: e.target.value }); }); }} style={inpSt}>
                      <option value="Out">Cash Out</option>
                      <option value="In">Cash In</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={cashSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: cashSaving ? 0.7 : 1 }}>{cashSaving ? 'Saving…' : 'Save'}</button>
              </form>
            )}
            {cashLoading ? (
              <div style={{ padding: '20px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Loading…</div>
            ) : cashLog.length === 0 ? (
              <div style={{ padding: '20px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No cash entries yet.</div>
            ) : cashLog.map(function(c) {
              var isIn = c.direction === 'In';
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isIn ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: isIn ? '#059669' : '#c62828' }}>{isIn ? '↑' : '↓'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#2a2a2a' }}>{c.description}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{c.date}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isIn ? '#059669' : '#c62828', flexShrink: 0 }}>{isIn ? '+' : '-'}{fmt(parseFloat(c.amount) || 0)}</div>
                  <button onClick={function() { deleteCash(c.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        );
      })()}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e0d5', overflow: 'hidden', gridColumn: 1 }}>
      <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>Resources</div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {resourcesLoading ? <div style={{ fontSize: 12, color: '#ccc' }}>Loading…</div> : resources.length === 0 && !showAddResource ? <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No resources yet.</div> : null}
        {resources.map(function(r) {
          return (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 4, background: '#faf8f5', textDecoration: 'none', cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#f5f0e8'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#faf8f5'; }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span style={{ fontSize: 13, fontWeight: 500, color: gold, flex: 1 }}>{r.title}</span>
            </a>
          );
        })}
        {showAddResource ? (
          <div style={{ background: '#faf8f5', borderRadius: 8, padding: '12px 14px', marginTop: 8, border: '0.5px solid #e8e0d5' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['link','file'].map(function(t) {
                return <button key={t} onClick={function() { setResourceType(t); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '0.5px solid ' + (resourceType === t ? gold : '#e0d8cc'), background: resourceType === t ? gold : '#fff', color: resourceType === t ? '#fff' : '#888', cursor: 'pointer', fontWeight: resourceType === t ? 600 : 400 }}>{t === 'link' ? 'Link' : 'Upload File'}</button>;
              })}
            </div>
            <input value={resourceTitle} onChange={function(e) { setResourceTitle(e.target.value); }} placeholder="Title" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
            {resourceType === 'link'
              ? <input value={resourceUrl} onChange={function(e) { setResourceUrl(e.target.value); }} placeholder="https://…" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
              : <div style={{ marginBottom: 8 }}>
                  <button onClick={function() { resourceFileRef.current.click(); }} style={{ fontSize: 12, color: gold, background: '#fff', border: '0.5px dashed ' + gold, borderRadius: 7, padding: '7px 14px', cursor: 'pointer', width: '100%' }}>
                    {resourceUrl ? '✓ ' + resourceUrl.split('/').pop().slice(0,30) : 'Choose file…'}
                  </button>
                  <input ref={resourceFileRef} type="file" style={{ display: 'none' }} onChange={function(e) {
                    var file = e.target.files[0];
                    if (!file) return;
                    if (!resourceTitle) setResourceTitle(file.name.replace(/\.[^.]+$/, ''));
                    setResourceUrl('__file__:' + file.name);
                  }} />
                </div>
            }
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={resourceSaving} onClick={function() {
                if (!resourceTitle) return;
                setResourceSaving(true);
                function saveRecord(url) {
                  fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Resources'), {
                    method: 'POST',
                    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                    body: JSON.stringify({ area: 'Financials', title: resourceTitle, url: url })
                  }).then(function(r) { return r.json(); }).then(function(rows) {
                    clearCache('Op Resources');
                    setResourceSaving(false);
                    if (rows && rows[0]) setResources(function(prev) { return prev.concat([rows[0]]); });
                    setResourceTitle(''); setResourceUrl(''); setShowAddResource(false);
                  });
                }
                if (resourceType === 'link') {
                  saveRecord(resourceUrl);
                } else {
                  var file = resourceFileRef.current && resourceFileRef.current.files[0];
                  if (!file) { setResourceSaving(false); return; }
                  var ext = file.name.split('.').pop();
                  var filename = 'financials-' + Date.now() + '.' + ext;
                  fetch(SUPABASE_URL + '/storage/v1/object/area-resources/' + filename, {
                    method: 'POST',
                    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type },
                    body: file
                  }).then(function() {
                    saveRecord(SUPABASE_URL + '/storage/v1/object/public/area-resources/' + filename);
                  }).catch(function() { setResourceSaving(false); });
                }
              }} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '7px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: resourceSaving ? 0.7 : 1 }}>{resourceSaving ? 'Saving…' : 'Add'}</button>
              <button onClick={function() { setShowAddResource(false); setResourceTitle(''); setResourceUrl(''); }} style={{ padding: '7px 12px', background: '#f0ece6', border: 'none', borderRadius: 7, fontSize: 12, color: '#666', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={function() { setShowAddResource(true); setResourceType('link'); }} style={{ width: '100%', marginTop: 4, padding: '8px 12px', background: 'none', border: 'none', fontSize: 12, color: gold, fontWeight: 500, cursor: 'pointer', textAlign: 'right', display: 'block' }}>
            Add Resource →
          </button>
        )}
      </div>
    </div>

    </div>

    </div>
  );
}

function IdeaForm({ formData, setFormData, onSubmit, onCancel, submitLabel, isSaving, volunteers }) {
  var inpSt = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, background: '#fff', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' };
  var lb = { fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 };
  var STATUS_OPTIONS = ['Exploring', 'Active', 'On Hold', 'Inactive', 'Completed'];
  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><label style={lb}>Title *</label><input required value={formData.title} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { title: e.target.value }); }); }} style={inpSt} placeholder="Name of idea or initiative" /></div>
        <div><label style={lb}>Status</label>
          <select value={formData.status} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { status: e.target.value }); }); }} style={inpSt}>
            {STATUS_OPTIONS.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: formData.status === 'Active' ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 12 }}>
        <div><label style={lb}>Submitted By</label>
          <select value={formData.submitted_by} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { submitted_by: e.target.value }); }); }} style={inpSt}>
            <option value="">— select volunteer —</option>
            {(volunteers || []).map(function(v) {
              var name = (v['First Name'] || '') + ' ' + (v['Last Name'] || '');
              return <option key={v.id} value={name.trim()}>{name.trim()}</option>;
            })}
          </select>
        </div>
        {formData.status === 'Active' && <div><label style={lb}>Total Budget ($)</label><input type="number" step="0.01" min="0" value={formData.budget || ''} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { budget: e.target.value }); }); }} style={inpSt} placeholder="0.00" /></div>}
      </div>
      <div style={{ marginBottom: 12 }}><label style={lb}>Notes — why it matters, context, ideas</label><textarea value={formData.notes} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { notes: e.target.value }); }); }} rows={3} style={Object.assign({}, inpSt, { resize: 'vertical' })} placeholder="Why this matters, background context, related ideas…" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div><label style={{ fontSize: 11, color: '#b45309', fontWeight: 600, display: 'block', marginBottom: 4 }}>Blockers — what's in the way</label><textarea value={formData.blockers} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { blockers: e.target.value }); }); }} rows={3} style={Object.assign({}, inpSt, { resize: 'vertical' })} placeholder="Obstacles, constraints, risks…" /></div>
        <div><label style={{ fontSize: 11, color: '#1565c0', fontWeight: 600, display: 'block', marginBottom: 4 }}>Gaps — what's missing</label><textarea value={formData.gaps} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { gaps: e.target.value }); }); }} rows={3} style={Object.assign({}, inpSt, { resize: 'vertical' })} placeholder="Resources, knowledge, support needed…" /></div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={lb}>Updates — latest progress</label><textarea value={formData.updates || ''} onChange={function(e) { setFormData(function(f) { return Object.assign({}, f, { updates: e.target.value }); }); }} rows={3} style={Object.assign({}, inpSt, { resize: 'vertical' })} placeholder="Latest progress, recent changes…" /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={isSaving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} style={{ padding: '9px 18px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
      </div>
    </form>
  );
}

function IdeasView() {
  var { useState, useEffect, useRef } = React;
  var isMobile = React.useContext(MobileCtx);
  var today = new Date().toISOString().slice(0, 10);

  var STATUS_OPTIONS = ['Exploring', 'Active', 'On Hold', 'Inactive', 'Completed'];
  var STATUS_COLORS = {
    'Exploring': { bg: '#e3f2fd', color: '#1565c0' },
    'Active':    { bg: '#e8f5e9', color: '#2e7d32' },
    'On Hold':   { bg: '#fff8e1', color: '#f57f17' },
    'Inactive':  { bg: '#fce4ec', color: '#c62828' },
    'Completed': { bg: '#f3e5f5', color: '#6a1b9a' },
  };

  var [ideas, setIdeas] = useState([]);
  var [loading, setLoading] = useState(true);
  var [selected, setSelected] = useState(null);
  var [mainTab, setMainTab] = useState('initiatives');
  var [filterStatus, setFilterStatus] = useState('Active');
  var [showAdd, setShowAdd] = useState(false);
  var [editing, setEditing] = useState(false);
  var emptyForm = { title: '', status: 'Exploring', submitted_by: '', notes: '', blockers: '', gaps: '', budget: '', updates: '' };
  var [showUpdates, setShowUpdates] = useState(false);
  var [form, setForm] = useState(emptyForm);
  var [editForm, setEditForm] = useState({});
  var [saving, setSaving] = useState(false);
  var [editSaving, setEditSaving] = useState(false);

  var [budgetItems, setBudgetItems] = useState([]);
  var [budgetLoading, setBudgetLoading] = useState(false);
  var emptyBF = { description: '', amount: '', date: today, expense_type: 'Purchase', volunteer_name: '' };
  var [budgetForm, setBudgetForm] = useState(emptyBF);
  var [showBudgetForm, setShowBudgetForm] = useState(false);
  var [budgetSaving, setBudgetSaving] = useState(false);
  var receiptRef = useRef(null);
  var [editingBudgetId, setEditingBudgetId] = useState(null);
  var [editBudgetForm, setEditBudgetForm] = useState({});
  var [editBudgetSaving, setEditBudgetSaving] = useState(false);
  var [volunteers, setVolunteers] = useState([]);
  var [volQuery, setVolQuery] = useState('');
  var [showVolDrop, setShowVolDrop] = useState(false);
  var [editVolQuery, setEditVolQuery] = useState('');
  var [showEditVolDrop, setShowEditVolDrop] = useState(false);

  var inpSt = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13, background: '#fff', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' };
  var lb = { fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 };

  useEffect(function() {
    cachedSbFetch('2026 Volunteers', ['id', 'First Name', 'Last Name', 'Address', 'Status']).then(function(rows) {
      if (Array.isArray(rows)) setVolunteers(rows.filter(function(v) { return v['Status'] === 'Active'; }).sort(function(a, b) { return (a['First Name'] || '').localeCompare(b['First Name'] || ''); }));
    });
  }, []);

  useEffect(function() {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Ideas') + '?select=*&order=created_at.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) { setIdeas(rows); } else { alert('Ideas table error: ' + JSON.stringify(rows)); }
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!selected || selected.status !== 'Active') { setBudgetItems([]); return; }
    setBudgetLoading(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?area=eq.' + encodeURIComponent(selected.title) + '&select=*&order=date.desc,id.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setBudgetItems(Array.isArray(rows) ? rows : []);
      setBudgetLoading(false);
    }).catch(function() { setBudgetLoading(false); });
  }, [selected]);

  function loadIdeas(thenFn) {
    return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Ideas') + '?select=*&order=created_at.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) { setIdeas(rows); if (thenFn) thenFn(rows); }
    });
  }

  function addIdea(e) {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    var payload = { title: form.title, status: form.status, submitted_by: form.submitted_by || null, notes: form.notes || null, blockers: form.blockers || null, gaps: form.gaps || null, budget: form.budget ? parseFloat(form.budget) : null, updates: form.updates || null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Ideas'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) {
      if (!r.ok) { return r.json().then(function(e) { alert('Error: ' + (e.message || JSON.stringify(e))); setSaving(false); }); }
      return r.json().then(function(rows) {
        setSaving(false);
        setForm(emptyForm); setShowAdd(false);
        var newStatus = payload.status;
        setMainTab(['Active','On Hold','Completed','Inactive'].includes(newStatus) ? 'initiatives' : 'ideas');
        setFilterStatus(newStatus || 'Active');
        loadIdeas(function(allRows) {
          var match = allRows.find(function(x) { return rows && rows[0] ? x.id === rows[0].id : x.title === payload.title; });
          if (match) setSelected(match);
        });
      });
    }).catch(function(err) { setSaving(false); alert('Network error: ' + err); });
  }

  function saveEdit() {
    if (!selected) return;
    setEditSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Ideas') + '?id=eq.' + selected.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    }).then(function() {
      var updated = Object.assign({}, selected, editForm);
      setIdeas(function(p) { return p.map(function(i) { return i.id === selected.id ? updated : i; }); });
      setSelected(updated);
      setEditing(false);
      setEditSaving(false);
      var newStatus = editForm.status;
      setMainTab(['Active', 'On Hold', 'Completed', 'Inactive'].includes(newStatus) ? 'initiatives' : 'ideas');
      setFilterStatus('All');
    }).catch(function() { setEditSaving(false); });
  }

  function submitBudget(e) {
    e.preventDefault();
    if (!budgetForm.description || !budgetForm.amount || !budgetForm.date || !selected) return;
    setBudgetSaving(true);
    var isInKind = budgetForm.expense_type === 'In-Kind';
    var needsReimb = budgetForm.expense_type === 'Reimbursement';
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ area: selected.title, description: budgetForm.description, amount: parseFloat(budgetForm.amount), date: budgetForm.date, type: isInKind ? 'In-Kind' : 'Purchase', needs_reimbursement: needsReimb, volunteer_name: needsReimb ? (budgetForm.volunteer_name || null) : null })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows.message) { alert('Budget error: ' + rows.message); setBudgetSaving(false); return; }
      var newRow = rows && rows[0] ? rows[0] : {};
      var file = receiptRef.current && receiptRef.current.files[0];
      function finish(row) {
        setBudgetItems(function(p) { return [row].concat(p); });
        setBudgetForm(emptyBF); setShowBudgetForm(false); setBudgetSaving(false);
        if (receiptRef.current) receiptRef.current.value = '';
      }
      if (file && newRow.id) {
        var ext = file.name.split('.').pop();
        var fn = 'idea-' + newRow.id + '-' + Date.now() + '.' + ext;
        fetch(SUPABASE_URL + '/storage/v1/object/receipts/' + fn, {
          method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type }, body: file
        }).then(function() {
          var url = SUPABASE_URL + '/storage/v1/object/public/receipts/' + fn;
          fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + newRow.id, {
            method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt_url: url })
          }).then(function() { finish(Object.assign({}, newRow, { receipt_url: url })); });
        }).catch(function() { finish(newRow); });
      } else { finish(newRow); }
    }).catch(function(err) { alert('Budget error: ' + err); setBudgetSaving(false); });
  }

  function deleteBudgetItem(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() { setBudgetItems(function(p) { return p.filter(function(b) { return b.id !== id; }); }); });
  }

  function updateBudgetItem(e) {
    e.preventDefault();
    setEditBudgetSaving(true);
    var isInKind = editBudgetForm.expense_type === 'In-Kind';
    var needsReimb = editBudgetForm.expense_type === 'Reimbursement';
    var patch = { description: editBudgetForm.description, amount: parseFloat(editBudgetForm.amount), date: editBudgetForm.date, type: isInKind ? 'In-Kind' : 'Purchase', needs_reimbursement: needsReimb, volunteer_name: needsReimb ? (editBudgetForm.volunteer_name || null) : null };
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + editingBudgetId, {
      method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    }).then(function() {
      setBudgetItems(function(p) { return p.map(function(b) { return b.id === editingBudgetId ? Object.assign({}, b, patch) : b; }); });
      setEditingBudgetId(null);
      setEditBudgetSaving(false);
    }).catch(function() { setEditBudgetSaving(false); });
  }

  function fmtMoney(n) { return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  var INITIATIVES_STATUSES = ['Active', 'On Hold', 'Completed', 'Inactive'];
  var IDEA_STATUSES = ['Exploring'];
  var tabStatuses = mainTab === 'initiatives' ? INITIATIVES_STATUSES : IDEA_STATUSES;
  var filtered = ideas.filter(function(i) {
    if (!tabStatuses.includes(i.status)) return false;
    return filterStatus === 'All' || i.status === filterStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Ideas & Initiatives</div>
        <button onClick={function() { setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ New Idea</button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e0d5' }}>
        {[{ id: 'initiatives', label: 'Active Initiatives' }, { id: 'ideas', label: 'Idea Stage' }].map(function(t) {
          var isOn = mainTab === t.id;
          return (
            <button key={t.id} onClick={function() { setMainTab(t.id); setFilterStatus('All'); setSelected(null); }}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: isOn ? 700 : 400, color: isOn ? gold : '#aaa', background: 'none', border: 'none', borderBottom: '2px solid ' + (isOn ? gold : 'transparent'), cursor: 'pointer', marginBottom: -1 }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {mainTab === 'initiatives' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['Active', 'On Hold', 'Completed', 'All'].map(function(s) {
            var sc = STATUS_COLORS[s] || { bg: '#f5f0ea', color: '#888' };
            var isOn = filterStatus === s;
            return (
              <button key={s} onClick={function() { setFilterStatus(s); setSelected(null); }}
                style={{ fontSize: 11, fontWeight: isOn ? 700 : 400, padding: '3px 12px', borderRadius: 20, border: '0.5px solid ' + (isOn ? sc.color : '#e0d8cc'), background: isOn ? sc.bg : '#fff', color: isOn ? sc.color : '#999', cursor: 'pointer' }}>
                {s}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '240px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 }}>{filtered.length} idea{filtered.length !== 1 ? 's' : ''}</div>
            </div>
            {filtered.length === 0
              ? <div style={{ padding: '20px 14px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No ideas yet.</div>
              : filtered.map(function(idea) {
                  var sc = STATUS_COLORS[idea.status] || { bg: '#f5f5f5', color: '#888' };
                  var isSel = selected && selected.id === idea.id;
                  return (
                    <div key={idea.id} onClick={function() { setSelected(isSel ? null : idea); setEditing(false); setShowUpdates(false); }}
                      style={{ padding: '10px 14px', borderBottom: '0.5px solid #f5f1eb', cursor: 'pointer', background: isSel ? sc.bg : '#fff', borderLeft: '3px solid ' + (isSel ? sc.color : 'transparent'), transition: 'all 0.12s' }}
                      onMouseEnter={function(e) { if (!isSel) e.currentTarget.style.background = '#faf8f5'; }}
                      onMouseLeave={function(e) { if (!isSel) e.currentTarget.style.background = '#fff'; }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{idea.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, border: '0.5px solid ' + sc.color + '44', borderRadius: 10, padding: '1px 7px' }}>{idea.status}</span>
                        {idea.submitted_by && <span style={{ fontSize: 11, color: '#aaa' }}>{idea.submitted_by}</span>}
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {selected && (function() {
            var sc = STATUS_COLORS[selected.status] || { bg: '#f5f5f5', color: '#888' };
            var budgetTotal = budgetItems.reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
            return (
              <div>
                <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ background: sc.bg, padding: '16px 20px', borderBottom: '0.5px solid ' + sc.color + '33', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#2a2a2a', marginBottom: 6 }}>{selected.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', color: sc.color, border: '0.5px solid ' + sc.color + '66', borderRadius: 10, padding: '2px 8px' }}>{selected.status}</span>
                        {selected.submitted_by && <span style={{ fontSize: 12, color: '#888' }}>by {selected.submitted_by}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      {selected.status === 'Active' && selected.budget && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: budgetTotal > parseFloat(selected.budget) ? '#c62828' : '#2e7d32' }}>{fmtMoney(parseFloat(selected.budget) - budgetTotal)} remaining</div>
                        </div>
                      )}
                      <button onClick={function() { setEditing(true); setEditForm({ title: selected.title, status: selected.status, submitted_by: selected.submitted_by || '', notes: selected.notes || '', blockers: selected.blockers || '', gaps: selected.gaps || '', budget: selected.budget || '', updates: selected.updates || '' }); }}
                        style={{ background: '#fff', border: '0.5px solid ' + sc.color + '66', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: sc.color, cursor: 'pointer', fontWeight: 500 }}>Edit</button>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    {selected.notes && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 6 }}>Notes</div>
                        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {selected.blockers && (
                        <div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b45309', fontWeight: 600, marginBottom: 6 }}>Blockers</div>
                          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.blockers}</div>
                        </div>
                      )}
                      {selected.gaps && (
                        <div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#1565c0', fontWeight: 600, marginBottom: 6 }}>Gaps</div>
                          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.gaps}</div>
                        </div>
                      )}
                    </div>
                    {showUpdates && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f0ece6' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600, marginBottom: 6 }}>Updates</div>
                        {selected.updates
                          ? <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.updates}</div>
                          : <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>No updates yet.</div>}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <button onClick={function() { setShowUpdates(function(v) { return !v; }); }}
                        style={{ fontSize: 11, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}>
                        {showUpdates ? 'Hide Updates' : 'View Updates'}
                      </button>
                    </div>
                  </div>
                </div>

                {selected.status === 'Active' && (
                  <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdfcfb' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>Active Initiatives</div>
                        {!budgetLoading && (
                          <div style={{ fontSize: 12, marginTop: 2 }}>
                            {selected.budget
                              ? <span style={{ color: budgetTotal > parseFloat(selected.budget) ? '#c62828' : '#2e7d32', fontWeight: 600 }}>{fmtMoney(budgetTotal)} of {fmtMoney(parseFloat(selected.budget))} spent</span>
                              : budgetItems.length > 0 ? <span style={{ color: '#888' }}>{fmtMoney(budgetTotal)} · {budgetItems.length} item{budgetItems.length !== 1 ? 's' : ''}</span> : null
                            }
                          </div>
                        )}
                      </div>
                      <button onClick={function() { setShowBudgetForm(function(v) { return !v; }); }} style={{ fontSize: 12, background: showBudgetForm ? '#f5f0ea' : gold, color: showBudgetForm ? '#666' : '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 500 }}>{showBudgetForm ? 'Cancel' : '+ Log Expense'}</button>
                    </div>
                    {showBudgetForm && (
                      <form onSubmit={submitBudget} style={{ padding: '14px 18px', borderBottom: '0.5px solid #f0ece6', background: '#fefcf8' }}>
                        <div style={{ marginBottom: 10 }}><label style={lb}>Description *</label><input required value={budgetForm.description} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} placeholder="What was purchased or contributed" style={inpSt} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div><label style={lb}>Amount *</label><input required type="number" step="0.01" min="0" value={budgetForm.amount} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} placeholder="0.00" style={inpSt} /></div>
                          <div><label style={lb}>Date *</label><input required type="date" value={budgetForm.date} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={inpSt} /></div>
                          <div><label style={lb}>Type</label>
                            <select value={budgetForm.expense_type} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { expense_type: e.target.value }); }); }} style={inpSt}>
                              <option value="Purchase">Purchase</option>
                              <option value="Reimbursement">Reimbursement</option>
                              <option value="In-Kind">In-Kind</option>
                            </select>
                          </div>
                        </div>
                        {budgetForm.expense_type === 'Reimbursement' && (function() {
                          var filtered = volunteers.filter(function(v) {
                            var name = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim().toLowerCase();
                            return volQuery && name.includes(volQuery.toLowerCase());
                          });
                          return (
                            <div style={{ marginBottom: 10, position: 'relative' }}>
                              <label style={lb}>Reimburse To (volunteer) *</label>
                              <input
                                value={volQuery}
                                onChange={function(e) { setVolQuery(e.target.value); setBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: '' }); }); setShowVolDrop(true); }}
                                onFocus={function() { setShowVolDrop(true); }}
                                onBlur={function() { setTimeout(function() { setShowVolDrop(false); }, 150); }}
                                placeholder="Type a volunteer name…"
                                style={inpSt}
                              />
                              {budgetForm.volunteer_name && <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 3 }}>✓ {budgetForm.volunteer_name}</div>}
                              {showVolDrop && filtered.length > 0 && (
                                <div style={{ position: 'absolute', zIndex: 99, left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 180, overflowY: 'auto' }}>
                                  {filtered.map(function(v) {
                                    var fullName = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim();
                                    return (
                                      <div key={v.id} onMouseDown={function() { setBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: fullName }); }); setVolQuery(fullName); setShowVolDrop(false); }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid #f5f0ea' }}
                                        onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                                        onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}>
                                        <div style={{ fontWeight: 500, color: '#2a2a2a' }}>{fullName}</div>
                                        {v['Address'] && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{v['Address']}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: gold, fontWeight: 500 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            Attach receipt
                            <input ref={receiptRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} />
                          </label>
                          <button type="submit" disabled={budgetSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: budgetSaving ? 0.7 : 1 }}>{budgetSaving ? 'Saving…' : 'Save'}</button>
                        </div>
                      </form>
                    )}
                    {budgetLoading ? (
                      <div style={{ padding: '20px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Loading…</div>
                    ) : budgetItems.length === 0 ? (
                      <div style={{ padding: '20px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No expenses logged yet.</div>
                    ) : budgetItems.map(function(b) {
                      var isEditingThis = editingBudgetId === b.id;
                      if (isEditingThis) {
                        return (
                          <form key={b.id} onSubmit={updateBudgetItem} style={{ padding: '12px 18px', borderBottom: '0.5px solid #f9f6f2', background: '#fdfcfb', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input value={editBudgetForm.description} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} placeholder="Description" required style={inpSt} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input type="number" step="0.01" value={editBudgetForm.amount} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { amount: e.target.value }); }); }} placeholder="Amount" required style={Object.assign({}, inpSt, { flex: 1 })} />
                              <input type="date" value={editBudgetForm.date} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} required style={Object.assign({}, inpSt, { flex: 1 })} />
                            </div>
                            <select value={editBudgetForm.expense_type} onChange={function(e) { setEditBudgetForm(function(f) { return Object.assign({}, f, { expense_type: e.target.value }); }); }} style={inpSt}>
                              <option value="Purchase">Purchase</option>
                              <option value="Reimbursement">Reimbursement</option>
                              <option value="In-Kind">In-Kind</option>
                            </select>
                            {editBudgetForm.expense_type === 'Reimbursement' && (function() {
                              var filteredE = volunteers.filter(function(v) {
                                var name = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim().toLowerCase();
                                return editVolQuery && name.includes(editVolQuery.toLowerCase());
                              });
                              return (
                                <div style={{ position: 'relative' }}>
                                  <label style={lb}>Reimburse To (volunteer)</label>
                                  <input
                                    value={editVolQuery}
                                    onChange={function(e) { setEditVolQuery(e.target.value); setEditBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: '' }); }); setShowEditVolDrop(true); }}
                                    onFocus={function() { setShowEditVolDrop(true); }}
                                    onBlur={function() { setTimeout(function() { setShowEditVolDrop(false); }, 150); }}
                                    placeholder="Type a volunteer name…"
                                    style={inpSt}
                                  />
                                  {editBudgetForm.volunteer_name && <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 3 }}>✓ {editBudgetForm.volunteer_name}</div>}
                                  {showEditVolDrop && filteredE.length > 0 && (
                                    <div style={{ position: 'absolute', zIndex: 99, left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                                      {filteredE.map(function(v) {
                                        var fullName = ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).trim();
                                        return (
                                          <div key={v.id} onMouseDown={function() { setEditBudgetForm(function(f) { return Object.assign({}, f, { volunteer_name: fullName }); }); setEditVolQuery(fullName); setShowEditVolDrop(false); }}
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid #f5f0ea' }}
                                            onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                                            onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}>
                                            <div style={{ fontWeight: 500, color: '#2a2a2a' }}>{fullName}</div>
                                            {v['Address'] && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{v['Address']}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="submit" disabled={editBudgetSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{editBudgetSaving ? 'Saving…' : 'Save'}</button>
                              <button type="button" onClick={function() { setEditingBudgetId(null); }} style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          </form>
                        );
                      }
                      return (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#2a2a2a' }}>{b.description}</div>
                            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{b.date}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: b.type === 'In-Kind' ? '#2e7d32' : b.needs_reimbursement ? '#b45309' : '#2a2a2a', flexShrink: 0 }}>{fmtMoney(b.amount)}</div>
                          {b.type === 'In-Kind' && <span style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>In-Kind</span>}
                          {b.needs_reimbursement && <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>$ Reimb.</span>}
                          {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noopener noreferrer" title="View attachment" style={{ color: gold, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></a>}
                          <button onClick={function() { setEditingBudgetId(b.id); setEditBudgetForm({ description: b.description, amount: b.amount, date: b.date, expense_type: b.needs_reimbursement ? 'Reimbursement' : b.type === 'In-Kind' ? 'In-Kind' : 'Purchase', volunteer_name: b.volunteer_name || '' }); setEditVolQuery(b.volunteer_name || ''); setShowEditVolDrop(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 11, padding: '2px 4px', flexShrink: 0 }}>Edit</button>
                          <button onClick={function() { deleteBudgetItem(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {editing && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.2)', maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a' }}>Edit Idea</div>
              <button type="button" onClick={function() { setEditing(false); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>✕ Close</button>
            </div>
            <IdeaForm formData={editForm} setFormData={setEditForm} onSubmit={function(e) { e.preventDefault(); saveEdit(); }} onCancel={function() { setEditing(false); }} submitLabel="Save Changes" isSaving={editSaving} volunteers={volunteers} />
          </div>
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.2)', maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a' }}>New Idea</div>
              <button type="button" onClick={function() { setShowAdd(false); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>✕ Close</button>
            </div>
            <IdeaForm formData={form} setFormData={setForm} onSubmit={addIdea} onCancel={function() { setShowAdd(false); }} submitLabel="Add Idea" isSaving={saving} volunteers={volunteers} />
          </div>
        </div>
      )}
    </div>
  );
}

var ADMIN_FORMS = [
  { label: "In-Kind Documentation Form", url: "https://drive.google.com/file/d/1cNGysqW__wS2IEKDaNzG1MPo-5JCE-ay/view" },
  { label: "Reimbursement Form", url: "https://drive.google.com/file/d/1Vkfh6Z5eM1RPUtw6j8mQjqKM71-YFPrW/view" },
  { label: "Board Submission Form", url: "https://drive.google.com/file/d/1_-AcaquXeK-O1x9AOubbQNCwoLWzu3f_/view" },
  { label: "Incident & Injury Form", url: "https://drive.google.com/file/d/1UNzWO6b_-YbKd_rYUxC5GkA2dRQVfcg-/view" },
  { label: "Brick Form", url: "https://drive.google.com/file/d/128gaSH9S_JtsjmxPd5Fq_ugumetBTiwt/view" },
  { label: "Thank You Notes", url: "https://drive.google.com/drive/folders/1Mi8nNZzNWx1fz7CQ11XiW8SHPqQnBAgR?usp=sharing" },
  { label: "2026 Pricing Guide", url: "https://drive.google.com/drive/folders/1Mi8nNZzNWx1fz7CQ11XiW8SHPqQnBAgR" },
  { label: "Creative Rental Form", url: "https://drive.google.com/file/d/1Lp3WDaYukjmZ4lB_iS4sJj9PC6fjzz6I/view" },
  { label: "Creative Rental Contract", url: "https://docs.google.com/document/d/1hKb9QK7MmrNpbmQcONyqNFbffEYGqJm5/edit?rtpof=true&sd=true#heading=h.3ff89qn2162x" },
];

var ADMIN_TOOLS = [
  {
    label: "Voicemails",
    url: "https://docs.google.com/spreadsheets/d/1kqVXngOaf_X1lrB6Nbi5U_3NJ4_P_fGMqxhyqdfuDT0/edit?gid=0#gid=0",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  },
  {
    label: "Accounting Info",
    url: "https://docs.google.com/spreadsheets/d/1VcV4DksZpcZX6SxTteYJDvbaOB2qSBDDzDALiynWdgM/edit?gid=433669438#gid=433669438",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>,
  },
  {
    label: "Archives",
    url: "https://northstarhouse.github.io/north-star-archives/",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  },
  {
    label: "Kiosk",
    url: "https://northstarhouse.github.io/northstar-kiosk/",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  },
  {
    label: "Event Planning",
    url: "https://northstarhouse.github.io/nsh-events-committee/",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    label: "Form Builder",
    url: "https://northstarhouse.github.io/NSH-forms/",
    icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
];

var docIcon = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;

function AdminToolCard(props) {
  var tool = props.tool;
  var card = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: tool.url ? '#fff' : '#faf8f5',
      border: '0.5px solid #e0d8cc', borderRadius: 10,
      padding: '13px 16px', cursor: tool.url ? 'pointer' : 'default',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      color: tool.url ? '#3a3226' : '#aaa', fontSize: 13, fontWeight: 500,
    }}
      onMouseEnter={tool.url ? function(e) { e.currentTarget.style.borderColor = '#b5a185'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(136,108,68,0.1)'; } : undefined}
      onMouseLeave={tool.url ? function(e) { e.currentTarget.style.borderColor = '#e0d8cc'; e.currentTarget.style.boxShadow = 'none'; } : undefined}
    >
      <span style={{ color: tool.url ? '#b5a185' : '#ccc', flexShrink: 0 }}>{props.icon}</span>
      {tool.label}
    </div>
  );
  if (!tool.url) return card;
  return <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>;
}

function AdminView({ navigate }) {
  var emailIcon = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/><polyline points="2,18 8,13"/><polyline points="22,18 16,13"/></svg>;
  var checkIcon = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  var eventsIcon = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>Tools</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {ADMIN_TOOLS.map(function(tool) {
          return <AdminToolCard key={tool.label} tool={tool} icon={tool.icon} />;
        })}
        <div
          onClick={function() { navigate('vol-email-lists'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '13px 16px', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', color: '#3a3226', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#b5a185'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(136,108,68,0.1)'; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e0d8cc'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span style={{ color: '#b5a185', flexShrink: 0 }}>{emailIcon}</span>
          Volunteer Email Lists
        </div>
        <div
          onClick={function() { navigate('wix-forms'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '13px 16px', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', color: '#3a3226', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#b5a185'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(136,108,68,0.1)'; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e0d8cc'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span style={{ color: '#b5a185', flexShrink: 0 }}>{checkIcon}</span>
          Form Submissions
        </div>
        <div
          onClick={function() { navigate('events'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '13px 16px', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', color: '#3a3226', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#b5a185'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(136,108,68,0.1)'; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e0d8cc'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span style={{ color: '#b5a185', flexShrink: 0 }}>{eventsIcon}</span>
          Events
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>Forms & Outreach</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {ADMIN_FORMS.map(function(form) {
          return <AdminToolCard key={form.label} tool={form} icon={docIcon} />;
        })}
      </div>
    </div>
  );
}

function VolEmailListsView({ navigate }) {
  var { useState: useS, useEffect: useE, useMemo } = React;
  var [volunteers, setVolunteers] = useS(null);
  var [logs, setLogs] = useS([]);
  var [activeOnly, setActiveOnly] = useS(true);
  var [expandedTeams, setExpandedTeams] = useS({});
  var [copied, setCopied] = useS(null);
  var [modal, setModal] = useS(null);
  var [subject, setSubject] = useS('');
  var [body, setBody] = useS('');
  var [sent, setSent] = useS(false);
  var [sending, setSending] = useS(false);
  var [sendError, setSendError] = useS(null);
  var [scheduled, setScheduled] = useS(false);
  var [scheduleAt, setScheduleAt] = useS('');
  var editorRef = React.useRef(null);
  var [showCreateList, setShowCreateList] = useS(false);
  var [newListName, setNewListName] = useS('');
  var [newListSearch, setNewListSearch] = useS('');
  var [newListSelected, setNewListSelected] = useS({});
  var [creatingList, setCreatingList] = useS(false);
  var [createListError, setCreateListError] = useS(null);
  var [editingTag, setEditingTag] = useS(null);
  var [editTagName, setEditTagName] = useS('');
  var [editSelected, setEditSelected] = useS({});
  var [editSearch, setEditSearch] = useS('');
  var [savingEdit, setSavingEdit] = useS(false);
  var [editError, setEditError] = useS(null);
  var [tagColors, setTagColors] = useS({});
  var [newListColor, setNewListColor] = useS(DEFAULT_LIST_COLOR);
  var [editTagColor, setEditTagColor] = useS(DEFAULT_LIST_COLOR);

  useE(function() {
    cachedSbFetch('2026 Volunteers', ['id','First Name','Last Name','Email','Status','Team','Event Tags','Overview Notes','Phone Number']).then(function(data) {
      if (Array.isArray(data)) setVolunteers(data);
    });
    fetch(SUPABASE_URL + '/rest/v1/volunteer_email_logs?select=*&order=sent_at.desc&limit=20', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (Array.isArray(data)) setLogs(data);
    }).catch(function() {});
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('List Tag Colors') + '?select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (!Array.isArray(rows)) return;
      var map = {};
      rows.forEach(function(r) { map[r.tag] = r.color; });
      setTagColors(map);
    }).catch(function() {});
  }, []);

  function getTagColor(tag) { return tagColors[tag] || DEFAULT_LIST_COLOR; }

  function saveTagColor(tag, color) {
    setTagColors(function(prev) { var n = Object.assign({}, prev); n[tag] = color; return n; });
    return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('List Tag Colors') + '?tag=eq.' + encodeURIComponent(tag), {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ color: color })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows) && rows.length > 0) return;
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('List Tag Colors'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag, color: color })
      });
    }).catch(function() {});
  }

  function deleteTagColor(tag) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('List Tag Colors') + '?tag=eq.' + encodeURIComponent(tag), {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).catch(function() {});
    setTagColors(function(prev) { var n = Object.assign({}, prev); delete n[tag]; return n; });
  }

  function parseTeams(t) {
    if (!t) return [];
    return t.split(/[,|]/).map(function(s) { return s.replace(/\bNEW\b/g, '').trim(); }).filter(Boolean);
  }

  function isActive(v) { return (v['Status'] || '').trim().toLowerCase() === 'active'; }

  var displayed = useMemo(function() {
    if (!volunteers) return [];
    return activeOnly ? volunteers.filter(isActive) : volunteers;
  }, [volunteers, activeOnly]);

  var groups = useMemo(function() {
    if (!displayed.length) return [];
    var tagMap = {};
    displayed.forEach(function(v) {
      parseTeams(v['Team']).forEach(function(t) {
        if (!tagMap[t]) tagMap[t] = [];
        tagMap[t].push(v);
      });
    });
    var knownOrder = TEAM_OPTIONS;
    var known = knownOrder.filter(function(t) { return tagMap[t]; }).map(function(t) { return { tag: t, members: tagMap[t] }; });
    var custom = Object.keys(tagMap).filter(function(t) { return TEAM_OPTIONS.indexOf(t) === -1; }).sort().map(function(t) { return { tag: t, members: tagMap[t] }; });
    return known.concat(custom);
  }, [displayed]);

  var eventGroups = useMemo(function() {
    if (!displayed.length) return [];
    var tagMap = {};
    displayed.forEach(function(v) {
      parseTeams(v['Event Tags']).forEach(function(t) {
        if (!tagMap[t]) tagMap[t] = [];
        tagMap[t].push(v);
      });
    });
    return Object.keys(tagMap).sort().map(function(t) { return { tag: t, members: tagMap[t] }; });
  }, [displayed]);

  function toggleNewListSelected(id) {
    setNewListSelected(function(prev) { var n = Object.assign({}, prev); n[id] = !n[id]; return n; });
  }

  function createTagList() {
    var tag = newListName.trim();
    if (!tag) return;
    var ids = Object.keys(newListSelected).filter(function(id) { return newListSelected[id]; });
    if (!ids.length) return;
    setCreatingList(true);
    setCreateListError(null);
    Promise.all(ids.map(function(id) {
      var v = volunteers.find(function(x) { return String(x.id) === id; });
      if (!v) return Promise.resolve();
      var existing = parseTeams(v['Event Tags']);
      if (existing.indexOf(tag) !== -1) return Promise.resolve();
      var nextVal = existing.concat([tag]).join(' | ');
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?id=eq.' + v.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'Event Tags': nextVal })
      }).then(function(r) {
        if (!r.ok) throw new Error('Failed to tag ' + v['First Name'] + ' ' + v['Last Name']);
        return { id: v.id, val: nextVal };
      });
    })).then(function(results) {
      var updates = {};
      results.forEach(function(r) { if (r) updates[r.id] = r.val; });
      setVolunteers(function(prev) { return prev.map(function(v) { return updates[v.id] !== undefined ? Object.assign({}, v, { 'Event Tags': updates[v.id] }) : v; }); });
      clearCache('2026 Volunteers');
      saveTagColor(tag, newListColor);
      setCreatingList(false);
      setShowCreateList(false);
      setNewListName('');
      setNewListColor(DEFAULT_LIST_COLOR);
      setNewListSearch('');
      setNewListSelected({});
    }).catch(function(err) {
      setCreatingList(false);
      setCreateListError(err.message || 'Failed to create tag list');
    });
  }

  function startEditGroup(tag) {
    var sel = {};
    (volunteers || []).forEach(function(v) {
      if (parseTeams(v['Event Tags']).indexOf(tag) !== -1) sel[String(v.id)] = true;
    });
    setEditingTag(tag);
    setEditTagName(tag.replace(/^volunteered for:\s*/i, ''));
    setEditTagColor(getTagColor(tag));
    setEditSelected(sel);
    setEditSearch('');
    setEditError(null);
  }

  function toggleEditSelected(id) {
    setEditSelected(function(prev) { var n = Object.assign({}, prev); n[id] = !n[id]; return n; });
  }

  function applyTagChange(oldTag, newTag, selectedIds) {
    setSavingEdit(true);
    setEditError(null);
    var affected = {};
    selectedIds.forEach(function(id) { affected[id] = true; });
    (volunteers || []).forEach(function(v) {
      if (parseTeams(v['Event Tags']).indexOf(oldTag) !== -1) affected[String(v.id)] = true;
    });
    var ids = Object.keys(affected);
    Promise.all(ids.map(function(id) {
      var v = volunteers.find(function(x) { return String(x.id) === id; });
      if (!v) return Promise.resolve();
      var tags = parseTeams(v['Event Tags']).filter(function(t) { return t !== oldTag; });
      var shouldHave = newTag && selectedIds.indexOf(id) !== -1;
      if (shouldHave && tags.indexOf(newTag) === -1) tags.push(newTag);
      var nextVal = tags.join(' | ');
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?id=eq.' + v.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'Event Tags': nextVal })
      }).then(function(r) {
        if (!r.ok) throw new Error('Failed to update ' + v['First Name'] + ' ' + v['Last Name']);
        return { id: v.id, val: nextVal };
      });
    })).then(function(results) {
      var updates = {};
      results.forEach(function(r) { if (r) updates[r.id] = r.val; });
      setVolunteers(function(prev) { return prev.map(function(v) { return updates[v.id] !== undefined ? Object.assign({}, v, { 'Event Tags': updates[v.id] }) : v; }); });
      clearCache('2026 Volunteers');
      setSavingEdit(false);
      setEditingTag(null);
    }).catch(function(err) {
      setSavingEdit(false);
      setEditError(err.message || 'Failed to save changes');
    });
  }

  function saveEditGroup() {
    var newTag = editTagName.trim();
    if (!newTag) return;
    var oldTag = editingTag;
    var selectedIds = Object.keys(editSelected).filter(function(id) { return editSelected[id]; });
    saveTagColor(newTag, editTagColor);
    if (newTag !== oldTag) deleteTagColor(oldTag);
    applyTagChange(oldTag, newTag, selectedIds);
  }

  function deleteTagList(tag) {
    if (!window.confirm('Delete the "' + tag + '" list? This removes the tag from every volunteer who has it.')) return;
    deleteTagColor(tag);
    applyTagChange(tag, null, []);
  }

  function toggleTeam(tag) {
    setExpandedTeams(function(prev) { var n = Object.assign({}, prev); n[tag] = !n[tag]; return n; });
  }

  function copyEmails(members, tag) {
    var emails = members.filter(function(v) { return v['Email'] && v['Email'].trim(); }).map(function(v) { return v['Email'].trim(); }).join(', ');
    navigator.clipboard.writeText(emails);
    setCopied(tag);
    setTimeout(function() { setCopied(null); }, 2000);
  }

  function openModal(tag, members) {
    var withEmail = members.filter(function(v) { return v['Email'] && v['Email'].trim(); });
    setModal({ tag: tag, members: withEmail });
    setSubject(tag + ' — ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    setBody('');
    setSent(false);
    setSendError(null);
    setScheduled(false);
    setScheduleAt('');
    setTimeout(function() { if (editorRef.current) editorRef.current.innerHTML = ''; }, 0);
  }

  function fmt(cmd, val) {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(cmd, false, val || null);
  }

  function renderGroupCard(g, colorFn, editable) {
    var withEmail = g.members.filter(function(v) { return v['Email'] && v['Email'].trim(); });
    var noEmail = g.members.filter(function(v) { return !v['Email'] || !v['Email'].trim(); });
    var isOpen = !!expandedTeams[g.tag];
    var isEditing = editable && editingTag === g.tag;
    var tc = colorFn(g.tag);
    return (
      <div key={g.tag} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden' }}>
        {/* Group header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fdfcfb', borderBottom: (isOpen || isEditing) ? '0.5px solid #f0ece6' : 'none' }}>
          <button onClick={function() { toggleTeam(g.tag); }} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{g.tag}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tc.bg, color: tc.color }}>
              {withEmail.length}{withEmail.length !== g.members.length ? '/' + g.members.length : ''} with email
            </span>
            {noEmail.length > 0 && <span style={{ fontSize: 10, color: '#b45309' }}>⚠ {noEmail.length} no email</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ccc' }}>{isOpen ? '▲' : '▼'}</span>
          </button>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {editable && (
              <button onClick={function() { isEditing ? setEditingTag(null) : startEditGroup(g.tag); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, border: '0.5px solid #e0d8cc', borderRadius: 7, background: isEditing ? '#f0ece6' : '#fff', color: '#666', cursor: 'pointer' }}>
                {isEditing ? 'Cancel edit' : '✎ Edit list'}
              </button>
            )}
            <button onClick={function() { copyEmails(g.members, g.tag); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, border: '0.5px solid #e0d8cc', borderRadius: 7, background: '#fff', color: copied === g.tag ? '#2e7d32' : '#666', cursor: 'pointer' }}>
              {copied === g.tag ? '✓ Copied' : '⧉ Copy emails'}
            </button>
            <button onClick={function() { openModal(g.tag, g.members); }} disabled={withEmail.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, border: 'none', borderRadius: 7, background: gold, color: '#fff', fontWeight: 600, cursor: withEmail.length === 0 ? 'not-allowed' : 'pointer', opacity: withEmail.length === 0 ? 0.4 : 1 }}>
              ✉ Email group
            </button>
          </div>
        </div>
        {/* Edit panel */}
        {isEditing && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>List name</label>
                <input value={editTagName} onChange={function(e) { setEditTagName(e.target.value); }} style={Object.assign({}, volInputStyle, { marginTop: 0 })} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Color</label>
                <input type="color" value={editTagColor} onChange={function(e) { setEditTagColor(e.target.value); }} style={{ width: 38, height: 34, border: '0.5px solid #e0d8cc', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Volunteers ({Object.keys(editSelected).filter(function(id) { return editSelected[id]; }).length} selected)</label>
              <input value={editSearch} onChange={function(e) { setEditSearch(e.target.value); }} placeholder="Search volunteers…" style={Object.assign({}, volInputStyle, { marginTop: 0, marginBottom: 8 })} />
              <div style={{ background: '#faf8f4', borderRadius: 8, padding: '6px 10px', maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {(volunteers || [])
                  .filter(function(v) { return !editSearch.trim() || ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).toLowerCase().indexOf(editSearch.trim().toLowerCase()) !== -1; })
                  .sort(function(a, b) { return (a['Last Name'] || '').localeCompare(b['Last Name'] || ''); })
                  .map(function(v) {
                    var checked = !!editSelected[String(v.id)];
                    return (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 12, color: '#2a2a2a', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={function() { toggleEditSelected(String(v.id)); }} style={{ accentColor: gold }} />
                        {v['First Name']} {v['Last Name']}
                        {!v['Email'] && <span style={{ fontSize: 10, color: '#ddd', fontStyle: 'italic' }}>no email</span>}
                      </label>
                    );
                  })}
              </div>
            </div>
            {editError && <div style={{ fontSize: 12, color: '#c0392b', background: '#fce4e4', borderRadius: 8, padding: '8px 12px' }}>{editError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEditGroup} disabled={!editTagName.trim() || savingEdit} style={{ flex: 1, padding: '8px', background: gold, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!editTagName.trim() || savingEdit) ? 0.5 : 1 }}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={function() { deleteTagList(g.tag); }} disabled={savingEdit} style={{ padding: '8px 14px', background: '#fce4e4', border: 'none', borderRadius: 8, fontSize: 12, color: '#c0392b', cursor: 'pointer', fontWeight: 500 }}>Delete list</button>
              <button onClick={function() { setEditingTag(null); }} disabled={savingEdit} style={{ padding: '8px 14px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
        {/* Member list */}
        {isOpen && !isEditing && (
          <div>
            {g.members.slice().sort(function(a, b) { return (a['Last Name'] || '').localeCompare(b['Last Name'] || ''); }).map(function(v, i) {
              var initials = ((v['First Name'] || '')[0] || '').toUpperCase() + ((v['Last Name'] || '')[0] || '').toUpperCase();
              return (
                <div key={v.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < g.members.length - 1 ? '0.5px solid #f5f1eb' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: gold, opacity: isActive(v) ? 1 : 0.4, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</span>
                    {v['Overview Notes'] && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>{v['Overview Notes']}</span>}
                    {!isActive(v) && <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>Inactive</span>}
                  </div>
                  {v['Email'] && v['Email'].trim() ? (
                    <a href={'mailto:' + v['Email'].trim()} style={{ fontSize: 11, color: '#aaa', textDecoration: 'none', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v['Email'].trim()}</a>
                  ) : (
                    <span style={{ fontSize: 11, color: '#ddd', fontStyle: 'italic' }}>no email</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function handleSend() {
    if (!modal) return;
    var htmlBody = editorRef.current ? editorRef.current.innerHTML : body;
    setSending(true);
    setSendError(null);

    if (scheduled && scheduleAt) {
      fetch(SUPABASE_URL + '/rest/v1/scheduled_volunteer_emails', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ send_at: new Date(scheduleAt).toISOString(), team_tag: modal.tag, recipient_count: modal.members.length, recipients: modal.members.map(function(v) { return v['Email'].trim(); }), subject: subject, body: htmlBody, status: 'pending' })
      }).then(function(r) {
        if (!r.ok) return r.json().then(function(j) { throw new Error(j.message || j.error || 'Failed to schedule'); });
        setSent(true);
      }).catch(function(err) {
        setSendError(err.message || 'Unknown error');
      }).finally(function() { setSending(false); });
      return;
    }

    fetch(SUPABASE_URL + '/functions/v1/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify({ to: modal.members.map(function(v) { return v['Email'].trim(); }), subject: subject, body: htmlBody })
    }).then(function(r) { return r.json().then(function(j) { return { ok: r.ok, json: j }; }); }).then(function(res) {
      if (!res.ok) throw new Error(res.json.error || 'Send failed');
      setSent(true);
      return fetch(SUPABASE_URL + '/rest/v1/volunteer_email_logs', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ sent_at: new Date().toISOString(), team_tag: modal.tag, recipient_count: modal.members.length, recipients: modal.members.map(function(v) { return (v['First Name'] || '') + ' ' + (v['Last Name'] || '') + ' <' + v['Email'] + '>'; }), subject: subject })
      });
    }).then(function() {
      return fetch(SUPABASE_URL + '/rest/v1/volunteer_email_logs?select=*&order=sent_at.desc&limit=20', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }).then(function(r) { return r.json(); }).then(function(data) { if (Array.isArray(data)) setLogs(data); });
    }).catch(function(err) {
      setSendError(err.message || 'Unknown error');
    }).finally(function() { setSending(false); });
  }

  var inpSt = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', outline: 'none', background: '#fff' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={function() { navigate('admin'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: gold, fontSize: 13, fontWeight: 500, padding: 0 }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Volunteer Email Lists</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Auto-populated from volunteer database · click a group to expand</div>
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}>
          <input type="checkbox" checked={activeOnly} onChange={function(e) { setActiveOnly(e.target.checked); }} style={{ accentColor: gold }} />
          Active only
        </label>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Group list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {volunteers === null ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#aaa', fontSize: 13 }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#ccc', fontSize: 13 }}>No volunteers found.</div>
          ) : groups.map(function(g) { return renderGroupCard(g, function(tag) { return TEAM_COLORS[tag] || { bg: '#f5f5f5', color: '#555' }; }); })}
        </div>

        {/* Recent sends sidebar */}
        {logs.length > 0 && (
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 16 }}>
              <div style={{ padding: '10px 14px', background: '#fdfcfb', borderBottom: '0.5px solid #f0ece6' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Recent Sends</div>
              </div>
              {logs.map(function(log, i) {
                return (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: i < logs.length - 1 ? '0.5px solid #f5f1eb' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{log.team_tag}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#aaa' }}>{log.recipient_count} recipients</span>
                      <span style={{ fontSize: 10, color: '#ccc' }}>{new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom / one-off lists */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a', fontFamily: "'Cardo', serif", marginBottom: 4 }}>Custom Lists</div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>Any one-off group of volunteers — an event, an outreach group, anything you need to email as a batch</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {volunteers === null ? null : eventGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#ccc', fontSize: 13, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12 }}>No custom lists yet — create one below.</div>
          ) : eventGroups.map(function(g) { return renderGroupCard(g, function(tag) { var c = getTagColor(tag); return { bg: c + '22', color: c }; }, true); })}
        </div>
      </div>

      {/* Create a new volunteer list */}
      <div style={{ marginTop: 20, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden' }}>
        <button onClick={function() { setShowCreateList(function(s) { return !s; }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fdfcfb', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>+ Create a new list</span>
          <span style={{ fontSize: 12, color: '#ccc' }}>{showCreateList ? '▲' : '▼'}</span>
        </button>
        {showCreateList && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>List name</label>
                <input value={newListName} onChange={function(e) { setNewListName(e.target.value); }} placeholder="e.g. Fall Gala, Newsletter Signups…" style={inpSt} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Color</label>
                <input type="color" value={newListColor} onChange={function(e) { setNewListColor(e.target.value); }} style={{ width: 38, height: 34, border: '0.5px solid #e0d8cc', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Select volunteers ({Object.keys(newListSelected).filter(function(id) { return newListSelected[id]; }).length} selected)</label>
              <input value={newListSearch} onChange={function(e) { setNewListSearch(e.target.value); }} placeholder="Search volunteers…" style={Object.assign({}, inpSt, { marginBottom: 8 })} />
              <div style={{ background: '#faf8f4', borderRadius: 8, padding: '6px 10px', maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {(volunteers || [])
                  .filter(function(v) { return !newListSearch.trim() || ((v['First Name'] || '') + ' ' + (v['Last Name'] || '')).toLowerCase().indexOf(newListSearch.trim().toLowerCase()) !== -1; })
                  .sort(function(a, b) { return (a['Last Name'] || '').localeCompare(b['Last Name'] || ''); })
                  .map(function(v) {
                    var checked = !!newListSelected[String(v.id)];
                    return (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 12, color: '#2a2a2a', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={function() { toggleNewListSelected(String(v.id)); }} style={{ accentColor: gold }} />
                        {v['First Name']} {v['Last Name']}
                        {!v['Email'] && <span style={{ fontSize: 10, color: '#ddd', fontStyle: 'italic' }}>no email</span>}
                      </label>
                    );
                  })}
              </div>
            </div>
            {createListError && <div style={{ fontSize: 12, color: '#c0392b', background: '#fce4e4', borderRadius: 8, padding: '8px 12px' }}>{createListError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={createTagList}
                disabled={!newListName.trim() || !Object.keys(newListSelected).some(function(id) { return newListSelected[id]; }) || creatingList}
                style={{ flex: 1, padding: '9px', background: gold, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!newListName.trim() || !Object.keys(newListSelected).some(function(id) { return newListSelected[id]; }) || creatingList) ? 0.5 : 1 }}
              >{creatingList ? 'Creating…' : 'Create list'}</button>
              <button onClick={function() { setShowCreateList(false); setNewListName(''); setNewListSearch(''); setNewListSelected({}); setCreateListError(null); }} disabled={creatingList} style={{ padding: '9px 16px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Email modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 12px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid #f0ece6' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2a2a' }}>Email {modal.tag}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{modal.members.length} recipient{modal.members.length !== 1 ? 's' : ''} with email</div>
              </div>
              <button onClick={function() { setModal(null); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#666', cursor: 'pointer' }}>✕</button>
            </div>

            {sent ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: scheduled ? '#e0f2fe' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20 }}>{scheduled ? '🕐' : '✓'}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{scheduled ? 'Email scheduled!' : 'Email sent!'}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  {scheduled
                    ? 'Queued for ' + new Date(scheduleAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + modal.members.length + ' recipient' + (modal.members.length !== 1 ? 's' : '')
                    : 'Delivered to ' + modal.members.length + ' recipient' + (modal.members.length !== 1 ? 's' : '') + ' from info@northstarhouse.org'}
                </div>
                <button onClick={function() { setModal(null); }} style={{ marginTop: 16, padding: '7px 20px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Recipients */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Recipients ({modal.members.length})</div>
                  <div style={{ background: '#faf8f4', borderRadius: 8, padding: '8px 10px', maxHeight: 90, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {modal.members.map(function(v) {
                      return (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a', flexShrink: 0 }}>{v['First Name']} {v['Last Name']}</span>
                          <span style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v['Email']}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Subject</label>
                  <input value={subject} onChange={function(e) { setSubject(e.target.value); }} placeholder="Subject line…" style={inpSt} />
                </div>
                {/* Formatting toolbar + editor */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Message</label>
                  <div style={{ border: '0.5px solid #e0d8cc', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '0.5px solid #f0ece6', background: '#fdfcfb', flexWrap: 'wrap' }}>
                      {[
                        { label: 'B', cmd: 'bold', style: { fontWeight: 700 }, title: 'Bold' },
                        { label: 'I', cmd: 'italic', style: { fontStyle: 'italic' }, title: 'Italic' },
                        { label: 'U', cmd: 'underline', style: { textDecoration: 'underline' }, title: 'Underline' },
                      ].map(function(b) {
                        return (
                          <button key={b.cmd} onMouseDown={function(e) { e.preventDefault(); fmt(b.cmd); }} title={b.title}
                            style={Object.assign({ padding: '3px 8px', border: '0.5px solid #e0d8cc', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#444', lineHeight: 1.4 }, b.style)}>
                            {b.label}
                          </button>
                        );
                      })}
                      <div style={{ width: 1, background: '#e0d8cc', margin: '2px 4px', alignSelf: 'stretch' }} />
                      <button onMouseDown={function(e) { e.preventDefault(); fmt('insertUnorderedList'); }} title="Bullet list"
                        style={{ padding: '3px 8px', border: '0.5px solid #e0d8cc', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#444' }}>• List</button>
                      <button onMouseDown={function(e) { e.preventDefault(); fmt('insertOrderedList'); }} title="Numbered list"
                        style={{ padding: '3px 8px', border: '0.5px solid #e0d8cc', borderRadius: 5, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#444' }}>1. List</button>
                      <div style={{ width: 1, background: '#e0d8cc', margin: '2px 4px', alignSelf: 'stretch' }} />
                      <button onMouseDown={function(e) { e.preventDefault(); fmt('removeFormat'); }} title="Clear formatting"
                        style={{ padding: '3px 8px', border: '0.5px solid #e0d8cc', borderRadius: 5, background: '#fff', fontSize: 11, cursor: 'pointer', color: '#aaa' }}>Clear</button>
                    </div>
                    {/* Editor */}
                    <div
                      ref={editorRef}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      className="nsh-editor"
                      data-placeholder="Email body…"
                      onInput={function(e) { setBody(e.currentTarget.innerHTML); }}
                      style={{ minHeight: 120, padding: '10px 12px', fontSize: 13, color: '#2a2a2a', outline: 'none', background: '#faf8f4', lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}
                    />
                  </div>
                  <style>{'.nsh-editor[contenteditable]:empty:before{content:attr(data-placeholder);color:#bbb;pointer-events:none;}'}</style>
                </div>
                {/* Scheduling */}
                <div style={{ background: '#fdfcfb', border: '0.5px solid #f0ece6', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: scheduled ? 10 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>🕐 Schedule for later</span>
                    <button onClick={function() { setScheduled(function(s) { return !s; }); }} style={{ background: scheduled ? gold : '#e0d8cc', border: 'none', borderRadius: 20, width: 36, height: 20, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: scheduled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                    </button>
                  </div>
                  {scheduled && (
                    <div>
                      <label style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Send at</label>
                      <input type="datetime-local" value={scheduleAt} onChange={function(e) { setScheduleAt(e.target.value); }} min={new Date().toISOString().slice(0,16)} style={Object.assign({}, inpSt, { width: '100%' })} />
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 5 }}>Saved to queue — requires a Supabase scheduled trigger to send.</div>
                    </div>
                  )}
                </div>
                {sendError && <div style={{ fontSize: 12, color: '#c0392b', background: '#fce4e4', borderRadius: 8, padding: '8px 12px' }}>{sendError}</div>}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button onClick={handleSend} disabled={!subject.trim() || sending || (scheduled && !scheduleAt)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: gold, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!subject.trim() || sending || (scheduled && !scheduleAt)) ? 0.5 : 1 }}>
                    {sending ? 'Saving…' : scheduled ? '🕐 Schedule Email' : '✉ Send Email'}
                  </button>
                  <button onClick={function() { setModal(null); }} disabled={sending} style={{ padding: '9px 16px', background: '#f0ece6', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancel</button>
                </div>
                <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>{scheduled ? 'Will send from info@northstarhouse.org at scheduled time' : 'Sends from info@northstarhouse.org'}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Form Submissions — auto-populated from Wix, notes + handled checkmarks ── */
function WixFormsView({ navigate }) {
  const { useState: useS, useEffect: useE, useRef: useR } = React;
  const [data, setData] = useS(null); // { submissions: [...] } | null while loading
  const [selected, setSelected] = useS(null);
  const [activeForm, setActiveForm] = useS(null);
  const [notesDraft, setNotesDraft] = useS('');
  const [notesSaving, setNotesSaving] = useS(false);
  const [handlingId, setHandlingId] = useS(null);
  const cacheKey = 'wixforms:v1';

  useE(function() {
    var cancelled = false;
    var cached = lsGet(cacheKey);
    if (cached) setData({ submissions: cached });

    fetch(WIX_FORMS_URL).then(function(r) { return r.json(); }).then(function(json) {
      var rawForms = (json.forms && json.forms.submissions) || [];
      var ids = rawForms.map(function(s) { return s.id; });
      var overridesPromise = ids.length > 0
        ? fetch(SUPABASE_URL + '/rest/v1/data_wix_forms?select=id,internal_notes,status&id=in.(' + ids.map(encodeURIComponent).join(',') + ')', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }).then(function(r) { return r.json(); })
        : Promise.resolve([]);
      return overridesPromise.then(function(overrides) {
        var overrideMap = {};
        (Array.isArray(overrides) ? overrides : []).forEach(function(row) { overrideMap[row.id] = row; });
        var merged = rawForms.map(function(sub) {
          var ov = overrideMap[sub.id];
          return Object.assign({}, sub, {
            internal_notes: ov && ov.internal_notes != null ? ov.internal_notes : (sub.internal_notes || null),
            status: ov && ov.status != null ? ov.status : sub.status,
          });
        });
        if (cancelled) return;
        setData({ submissions: merged });
        lsSet(cacheKey, merged);
      });
    }).catch(function() {
      if (!cancelled && !cached) setData({ submissions: [] });
    });

    return function() { cancelled = true; };
  }, []);

  useE(function() { setNotesDraft(selected ? (selected.internal_notes || '') : ''); }, [selected]);

  var rows = (data && data.submissions ? data.submissions : []).filter(function(r) { return (r.form_name || '').trim().toLowerCase() !== 'other form'; });
  var formNames = Array.from(new Set(rows.map(function(r) { return r.form_name; }))).sort();
  var grouped = formNames.map(function(name) { return { name: name, items: rows.filter(function(r) { return r.form_name === name; }) }; });
  var activeFormName = activeForm && formNames.indexOf(activeForm) !== -1 ? activeForm : (formNames[0] || null);
  var activeGroup = grouped.filter(function(g) { return g.name === activeFormName; })[0] || null;

  function fmtTs(ts) { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  function upsertOverride(sub, patch) {
    return fetch(SUPABASE_URL + '/rest/v1/data_wix_forms', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(Object.assign({
        id: sub.id, form_id: sub.form_id, form_name: (sub.form_name || '').trim(),
        status: sub.status || '', created_at: sub.created_at, fields: sub.fields,
        internal_notes: sub.internal_notes || null,
      }, patch))
    });
  }

  function saveNotes() {
    if (!selected) return;
    setNotesSaving(true);
    var noteValue = notesDraft.trim() || null;
    upsertOverride(selected, { internal_notes: noteValue }).then(function(r) {
      if (r.ok) {
        setSelected(function(prev) { return prev ? Object.assign({}, prev, { internal_notes: noteValue }) : prev; });
        setData(function(prev) { return prev ? { submissions: prev.submissions.map(function(s) { return s.id === selected.id ? Object.assign({}, s, { internal_notes: noteValue }) : s; }) } : prev; });
      }
    }).finally(function() { setNotesSaving(false); });
  }

  function toggleHandled(sub) {
    if (handlingId === sub.id) return;
    setHandlingId(sub.id);
    var newStatus = sub.status === 'handled' ? '' : 'handled';
    upsertOverride(sub, { status: newStatus }).then(function(r) {
      if (r.ok) {
        if (newStatus === 'handled') logActivity((sub.form_name || 'A form') + ' submission was marked handled', 'form_handled');
        setData(function(prev) { return prev ? { submissions: prev.submissions.map(function(s) { return s.id === sub.id ? Object.assign({}, s, { status: newStatus }) : s; }) } : prev; });
        setSelected(function(prev) { return prev && prev.id === sub.id ? Object.assign({}, prev, { status: newStatus }) : prev; });
      }
    }).finally(function() { setHandlingId(null); });
  }

  var notesInputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', outline: 'none', background: '#fff', resize: 'none' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={function() { navigate('admin'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: gold, fontSize: 13, fontWeight: 500, padding: 0 }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>Form Submissions</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Live from Wix · check off once handled, add internal notes</div>
        </div>
      </div>

      {data === null ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa', fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No form submissions found.</div>
      ) : (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            {grouped.map(function(g) {
              var isActive = g.name === activeFormName;
              var latest = g.items[0];
              return (
                <button key={g.name} onClick={function() { setActiveForm(g.name); setSelected(null); }}
                  style={{ textAlign: 'left', background: isActive ? '#fdf8ee' : '#fff', border: isActive ? '0.5px solid #dcc9a0' : '0.5px solid #e0d8cc', borderRadius: 10, padding: 14, cursor: 'pointer' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: isActive ? gold : '#aaa', marginBottom: 6 }}>Wix Form</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', lineHeight: 1.3 }}>{g.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2a2a2a', marginTop: 8 }}>{g.items.length}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>submission{g.items.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 10, color: '#ccc', marginTop: 6 }}>{latest ? 'Latest: ' + fmtTs(latest.created_at) : 'No submissions yet'}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeGroup && (
                <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#fdfcfb', borderBottom: '0.5px solid #f0ece6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: gold, marginBottom: 2 }}>Selected Form</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{activeGroup.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {activeGroup.items.filter(function(s) { return s.status === 'handled'; }).length > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#2e7d32' }}>{activeGroup.items.filter(function(s) { return s.status === 'handled'; }).length} handled</div>
                      )}
                      <div style={{ fontSize: 11, color: '#aaa' }}>{activeGroup.items.length} submission{activeGroup.items.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div>
                    {activeGroup.items.map(function(sub, i) {
                      var fields = sub.fields || {};
                      var first = fields['First Name'] || '';
                      var last = fields['Last Name'] || '';
                      var email = fields['Email'] || fields['Email Address'] || '';
                      var preview = [first, last].filter(Boolean).join(' ') || email || (Object.values(fields).filter(Boolean)[0]) || '';
                      var isHandled = sub.status === 'handled';
                      return (
                        <div key={sub.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: i < activeGroup.items.length - 1 ? '0.5px solid #f5f1eb' : 'none', background: (selected && selected.id === sub.id) ? '#fdf8ee' : (isHandled ? '#fafafa' : 'transparent') }}>
                          <input type="checkbox" title="Mark as handled" checked={isHandled} disabled={handlingId === sub.id}
                            onChange={function() { toggleHandled(sub); }}
                            style={{ marginTop: 3, width: 15, height: 15, accentColor: '#2e7d32', cursor: 'pointer', flexShrink: 0, opacity: handlingId === sub.id ? 0.5 : 1 }} />
                          <button onClick={function() { setSelected(function(prev) { return prev && prev.id === sub.id ? null : sub; }); }}
                            style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                {sub.internal_notes && <div style={{ fontSize: 11, color: '#8a6d3b', background: '#fdf3d9', borderRadius: 6, padding: '3px 8px', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.internal_notes}</div>}
                                {preview && <div style={{ fontSize: 13, color: isHandled ? '#aaa' : '#2a2a2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>}
                                {email && email !== preview && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                              </div>
                              <div style={{ fontSize: 11, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtTs(sub.created_at)}</div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#ccc' }}>{rows.length} submission{rows.length !== 1 ? 's' : ''} across {formNames.length} form{formNames.length !== 1 ? 's' : ''}</div>
            </div>

            {selected && (
              <div style={{ width: 340, flexShrink: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: 20, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: gold, marginBottom: 3 }}>{selected.form_name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{fmtTs(selected.created_at)}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Internal Notes</label>
                  <textarea rows={4} value={notesDraft} onChange={function(e) { setNotesDraft(e.target.value); }} disabled={notesSaving}
                    placeholder="Add internal notes for this submission" style={notesInputStyle} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={saveNotes} disabled={notesSaving} style={{ padding: '7px 16px', background: gold, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: notesSaving ? 'not-allowed' : 'pointer', opacity: notesSaving ? 0.6 : 1 }}>
                      {notesSaving ? 'Saving…' : 'Save Notes'}
                    </button>
                  </div>
                </div>
                {Object.keys(selected.fields || {}).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(selected.fields).map(function(entry) {
                      return (
                        <div key={entry[0]}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{entry[0]}</div>
                          <div style={{ fontSize: 13, color: '#2a2a2a', whiteSpace: 'pre-wrap' }}>{entry[1]}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>No field data captured.</div>
                )}
              </div>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function BirthdaysView({ navigate }) {
  var isMobile = React.useContext(MobileCtx);
  var gold = '#b5a185';
  const [vols, setVols] = useState(null);
  const [allActive, setAllActive] = useState(null);

  useEffect(function() {
    cachedSbFetch('2026 Volunteers', ['First Name', 'Last Name', 'Birthday', 'Picture URL', 'Status']).then(function(rows) {
      if (!Array.isArray(rows)) { setVols([]); setAllActive([]); return; }
      var active = rows.filter(function(r) { return r['Status'] === 'Active'; });
      setAllActive(active);
      var today = new Date();
      var withBday = active.filter(function(r) { return r['Birthday']; }).map(function(r) {
        var raw = r['Birthday'];
        var mo = null, dy = null;
        var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) { mo = parseInt(iso[2]) - 1; dy = parseInt(iso[3]); }
        else {
          var slash = raw.match(/^(\d{1,2})\/(\d{1,2})/);
          if (slash) { mo = parseInt(slash[1]) - 1; dy = parseInt(slash[2]); }
        }
        if (mo === null || dy === null) return null;
        var thisYear = new Date(today.getFullYear(), mo, dy);
        var isToday = thisYear.toDateString() === today.toDateString();
        return Object.assign({}, r, { _mo: mo, _dy: dy, _isToday: isToday });
      }).filter(Boolean).sort(function(a, b) { return a._mo !== b._mo ? a._mo - b._mo : a._dy - b._dy; });
      setVols(withBday);
    });
  }, []);

  var byMonth = {};
  if (vols) {
    vols.forEach(function(v) {
      if (!byMonth[v._mo]) byMonth[v._mo] = [];
      byMonth[v._mo].push(v);
    });
  }
  var months = Object.keys(byMonth).map(Number).sort(function(a, b) { return a - b; });

  var missingBday = allActive ? allActive.filter(function(r) { return !r['Birthday']; }).sort(function(a, b) { return (a['First Name'] || '').localeCompare(b['First Name'] || ''); }) : [];
  var missingPic  = allActive ? allActive.filter(function(r) { return !r['Picture URL']; }).sort(function(a, b) { return (a['First Name'] || '').localeCompare(b['First Name'] || ''); }) : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={function() { navigate('home'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: gold, fontSize: 13, fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#2a2a2a', fontFamily: 'Georgia, serif' }}>Volunteer Birthdays</h2>
      </div>
      {vols === null && <div style={{ fontSize: 13, color: '#aaa' }}>Loading…</div>}
      {vols !== null && vols.length === 0 && <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>No birthdays found.</div>}
      {months.map(function(mo) {
        return (
          <div key={mo} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #e0d8cc' }}>
              {MONTH_NAMES[mo]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byMonth[mo].map(function(v, i) {
                var dayStr = (v._mo + 1) + '/' + v._dy;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: v._isToday ? '#fffbf0' : '#fff', border: v._isToday ? '0.5px solid #e8d9b0' : '0.5px solid #f0ebe2', borderRadius: 8, padding: '8px 12px' }}>
                    {v['Picture URL'] ? (
                      <img src={driveImg(v['Picture URL'])} alt={v['First Name']} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0ebe2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: gold, flexShrink: 0 }}>
                        {(v['First Name'] || '?')[0]}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{dayStr}{v._isToday ? ' 🎂' : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {allActive !== null && (missingBday.length > 0 || missingPic.length > 0) && (
        <div style={{ marginTop: 16, borderTop: '0.5px solid #e0d8cc', paddingTop: 24, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
          {missingBday.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e07070', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Missing Birthday ({missingBday.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {missingBday.map(function(v, i) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff5f5', border: '0.5px solid #fdd', borderRadius: 7 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fde8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#c07070', flexShrink: 0 }}>
                        {(v['First Name'] || '?')[0]}
                      </div>
                      <span style={{ fontSize: 13, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {missingPic.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e07070', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Missing Picture ({missingPic.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {missingPic.map(function(v, i) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff5f5', border: '0.5px solid #fdd', borderRadius: 7 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fde8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#c07070', flexShrink: 0 }}>
                        {(v['First Name'] || '?')[0]}
                      </div>
                      <span style={{ fontSize: 13, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VenueRentalsView() {
  const { useState: useS, useEffect: useE, useRef: useR } = React;
  const [weddings, setWeddings] = useS([]);
  const [tracking, setTracking] = useS({});
  const [loading, setLoading] = useS(true);
  const [calError, setCalError] = useS(null);
  const [savingUid, setSavingUid] = useS(null);
  const [editingField, setEditingField] = useS(null); // { uid, field: 'ig'|'album', val }
  const debounceTimers = useR({});

  useE(function() {
    // Fetch calendar + tracking in parallel
    var proxy = 'https://corsproxy.io/?' + encodeURIComponent(CALENDAR_ICAL_URL);
    var calPromise = fetch(proxy).then(function(r) { return r.text(); }).then(function(text) {
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
      var events = [], current = null;
      text.split('\n').forEach(function(line) {
        if (line === 'BEGIN:VEVENT') { current = {}; }
        else if (line === 'END:VEVENT') { if (current) events.push(current); current = null; }
        else if (current) {
          var ci = line.indexOf(':');
          if (ci !== -1) { var k = line.slice(0, ci).split(';')[0]; current[k] = line.slice(ci + 1); }
        }
      });
      return events;
    });
    var trackPromise = fetch(SUPABASE_URL + '/rest/v1/venue_wedding_tracking?select=*&order=event_date.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); });

    Promise.all([calPromise, trackPromise]).then(function(results) {
      var events = results[0];
      var trackRows = Array.isArray(results[1]) ? results[1] : [];
      // Filter weddings — any event with "wedding" in summary
      var weds = events.filter(function(e) {
        return e.SUMMARY && e.SUMMARY.toLowerCase().indexOf('wedding') !== -1;
      }).map(function(e) {
        var dt = parseIcalDate(e['DTSTART'] || e['DTSTART;VALUE=DATE'] || '');
        return { uid: e.UID || (e.SUMMARY + '_' + e.DTSTART), title: e.SUMMARY || 'Untitled', date: dt };
      }).filter(function(w) { return w.date && w.date.getFullYear() >= 2026; })
        .sort(function(a, b) { return a.date - b.date; });
      setWeddings(weds);
      var map = {};
      trackRows.forEach(function(r) { map[r.event_uid] = r; });
      setTracking(map);
      setLoading(false);
    }).catch(function(err) { setCalError(err.message); setLoading(false); });
  }, []);

  function getTrack(uid) {
    return tracking[uid] || { pictures_done: false, blog_done: false, socials_done: false, photographer_link: '', photo_album_link: '' };
  }

  function saveTrack(uid, title, date, patch) {
    var existing = tracking[uid];
    var merged = Object.assign({}, getTrack(uid), patch);
    setTracking(function(prev) { return Object.assign({}, prev, { [uid]: Object.assign({}, prev[uid] || {}, patch) }); });
    setSavingUid(uid);
    var dateStr = date ? date.toISOString().slice(0, 10) : null;
    if (existing && existing.id) {
      fetch(SUPABASE_URL + '/rest/v1/venue_wedding_tracking?id=eq.' + existing.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (Array.isArray(rows) && rows[0]) setTracking(function(prev) { return Object.assign({}, prev, { [uid]: rows[0] }); });
        setSavingUid(null);
      }).catch(function() { setSavingUid(null); });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/venue_wedding_tracking', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ event_uid: uid, event_title: title, event_date: dateStr, pictures_done: merged.pictures_done, blog_done: merged.blog_done, socials_done: merged.socials_done, photographer_link: merged.photographer_link || null, photo_album_link: merged.photo_album_link || null })
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (Array.isArray(rows) && rows[0]) setTracking(function(prev) { return Object.assign({}, prev, { [uid]: rows[0] }); });
        setSavingUid(null);
      }).catch(function() { setSavingUid(null); });
    }
  }

  function handlePhotogChange(uid, title, date, val) {
    setTracking(function(prev) { return Object.assign({}, prev, { [uid]: Object.assign({}, prev[uid] || {}, { photographer_link: val }) }); });
    clearTimeout(debounceTimers.current[uid + '_ig']);
    debounceTimers.current[uid + '_ig'] = setTimeout(function() { saveTrack(uid, title, date, { photographer_link: val || null }); }, 700);
  }

  function handleAlbumChange(uid, title, date, val) {
    setTracking(function(prev) { return Object.assign({}, prev, { [uid]: Object.assign({}, prev[uid] || {}, { photo_album_link: val }) }); });
    clearTimeout(debounceTimers.current[uid + '_album']);
    debounceTimers.current[uid + '_album'] = setTimeout(function() { saveTrack(uid, title, date, { photo_album_link: val || null }); }, 700);
  }

  function Checkbox({ checked, onChange, label, color }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
        <div onClick={onChange} style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid ' + (checked ? color : '#d0c8bc'), background: checked ? color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', cursor: 'pointer' }}>
          {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>}
        </div>
        <span style={{ fontSize: 12, color: checked ? color : '#999', fontWeight: checked ? 600 : 400 }}>{label}</span>
      </label>
    );
  }

  function dismissWedding(w) {
    var existing = tracking[w.uid];
    var dateStr = w.date ? w.date.toISOString().slice(0, 10) : null;
    setTracking(function(prev) { return Object.assign({}, prev, { [w.uid]: Object.assign({}, prev[w.uid] || {}, { hidden: true }) }); });
    if (existing && existing.id) {
      fetch(SUPABASE_URL + '/rest/v1/venue_wedding_tracking?id=eq.' + existing.id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true })
      });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/venue_wedding_tracking', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_uid: w.uid, event_title: w.title, event_date: dateStr, hidden: true })
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (Array.isArray(rows) && rows[0]) setTracking(function(prev) { return Object.assign({}, prev, { [w.uid]: rows[0] }); });
      });
    }
  }

  var now = new Date();
  var visible = weddings.filter(function(w) { return !getTrack(w.uid).hidden; });
  var past = visible.filter(function(w) { return w.date < now; });
  var upcoming = visible.filter(function(w) { return w.date >= now; });

  function WeddingCard(w) {
    var t = getTrack(w.uid);
    var allDone = t.pictures_done && t.blog_done && t.socials_done;
    var noneChecked = !t.pictures_done && !t.blog_done && !t.socials_done;
    var oneMonthAgo = new Date(now); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    var overdue = noneChecked && w.date < oneMonthAgo;
    var isSaving = savingUid === w.uid;
    var dateStr = w.date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    var anyChecked = t.pictures_done || t.blog_done || t.socials_done;
    var borderColor = allDone ? '#c8e6c9' : anyChecked ? '#ffb74d' : overdue ? '#e57373' : '#e8e0d5';
    var bgColor = '#fff';
    return (
      <div key={w.uid} style={{ background: bgColor, border: '0.5px solid ' + borderColor, borderRadius: 10, padding: '14px 18px', transition: 'border-color 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{w.title}</div>
              {allDone && <span style={{ fontSize: 10, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', padding: '1px 8px', borderRadius: 20 }}>Complete</span>}
              {isSaving && <span style={{ fontSize: 10, color: '#bbb' }}>saving…</span>}
              <button onClick={function() { if (window.confirm('Remove "' + w.title + '" from this list?')) dismissWedding(w); }} title="Remove duplicate" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{dateStr}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {(editingField && editingField.uid === w.uid && editingField.field === 'ig') ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fce4f3', border: '0.5px solid #e8b4d8', borderRadius: 20, padding: '3px 12px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c13584" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#c13584" stroke="none"/></svg>
                  <input autoFocus value={editingField.val}
                    onChange={function(e) { setEditingField(function(ef) { return Object.assign({}, ef, { val: e.target.value }); }); }}
                    onKeyDown={function(e) { if (e.key === 'Enter') { handlePhotogChange(w.uid, w.title, w.date, editingField.val); setEditingField(null); } if (e.key === 'Escape') setEditingField(null); }}
                    onBlur={function() { handlePhotogChange(w.uid, w.title, w.date, editingField.val); setEditingField(null); }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontWeight: 600, color: '#c13584', width: 160 }} />
                </div>
              ) : t.photographer_link ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <a href={'https://instagram.com/' + t.photographer_link.replace(/^@/, '')} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fce4f3', border: '0.5px solid #e8b4d8', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#c13584', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                    {t.photographer_link.startsWith('@') ? t.photographer_link : '@' + t.photographer_link}
                  </a>
                  <button onClick={function() { setEditingField({ uid: w.uid, field: 'ig', val: t.photographer_link || '' }); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✎</button>
                </div>
              ) : (
                <button onClick={function() { setEditingField({ uid: w.uid, field: 'ig', val: '' }); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: '0.5px dashed #d0c8bc', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#bbb', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                  @photographer
                </button>
              )}
              {(editingField && editingField.uid === w.uid && editingField.field === 'album') ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f5f0e8', border: '0.5px solid #d4c4a0', borderRadius: 20, padding: '3px 12px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <input autoFocus value={editingField.val}
                    onChange={function(e) { setEditingField(function(ef) { return Object.assign({}, ef, { val: e.target.value }); }); }}
                    onKeyDown={function(e) { if (e.key === 'Enter') { handleAlbumChange(w.uid, w.title, w.date, editingField.val); setEditingField(null); } if (e.key === 'Escape') setEditingField(null); }}
                    onBlur={function() { handleAlbumChange(w.uid, w.title, w.date, editingField.val); setEditingField(null); }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontWeight: 600, color: gold, width: 140 }} />
                </div>
              ) : t.photo_album_link ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <a href={t.photo_album_link.startsWith('http') ? t.photo_album_link : 'https://' + t.photo_album_link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f5f0e8', border: '0.5px solid #d4c4a0', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: gold, textDecoration: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Photo Album
                  </a>
                  <button onClick={function() { setEditingField({ uid: w.uid, field: 'album', val: t.photo_album_link || '' }); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✎</button>
                </div>
              ) : (
                <button onClick={function() { setEditingField({ uid: w.uid, field: 'album', val: '' }); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: '0.5px dashed #d0c8bc', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#bbb', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Photo Album
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
            <Checkbox checked={!!t.pictures_done} label="Pictures" color="#7c3aed"
              onChange={function() { saveTrack(w.uid, w.title, w.date, { pictures_done: !t.pictures_done }); }} />
            <Checkbox checked={!!t.blog_done} label="Blog" color={gold}
              onChange={function() { saveTrack(w.uid, w.title, w.date, { blog_done: !t.blog_done }); }} />
            <Checkbox checked={!!t.socials_done} label="Socials" color="#e91e8c"
              onChange={function() { saveTrack(w.uid, w.title, w.date, { socials_done: !t.socials_done }); }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif", marginBottom: 6 }}>Venue Rentals</div>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 24 }}>Wedding tracking and post-event checklist</div>

      {loading && <div style={{ color: '#aaa', fontSize: 13, padding: 40, textAlign: 'center' }}>Loading calendar…</div>}
      {calError && <div style={{ color: '#c62828', fontSize: 12, background: '#ffebee', borderRadius: 8, padding: 16 }}>Could not load calendar: {calError}</div>}

      {!loading && !calError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {upcoming.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', marginBottom: 10 }}>Upcoming Weddings ({upcoming.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{upcoming.map(WeddingCard)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', marginBottom: 10 }}>Past Weddings ({past.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{past.sort(function(a,b){return b.date-a.date;}).map(WeddingCard)}</div>
            </div>
          )}
          {weddings.length === 0 && (
            <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No weddings found in the calendar.</div>
          )}
        </div>
      )}
    </div>
  );
}

const views = {
  home: HomeView,
  birthdays: BirthdaysView,
  events: EventsView,
  quarterly: QuarterlyView,
  volunteers: VolunteersView,
  donors: DonorsView,
  marketing: MarketingView,
  board: BoardView,
  sponsors: SponsorsView,
  strategy: StrategyView,
  venue: VenueRentalsView,
  ideas: IdeasView,
  operational: OperationalView,
  financials: FinancialsView,
  reviews: ReviewsView,
  'quarter-workspace': QuarterWorkspaceView,
  admin: AdminView,
  'vol-email-lists': VolEmailListsView,
  'wix-forms': WixFormsView,
};

var OPERATIONAL_AREAS = ['Construction','Grounds','Interiors','Docents','Fundraising','Events','Marketing','Venue'];
var AREA_DEFAULTS = {
  'Construction':  { lead: 'Rick Panos',       budget: 12000, pic: 'https://drive.google.com/file/d/1hbFJxUUQEsuhoWnTDeARg6peSHCpiBFH/view?usp=drive_link' },
  'Grounds':       { lead: 'Paula Campbell',   budget: 14000, pic: 'https://drive.google.com/file/d/17J0cF_okHkAs_HCRjuYm0TnpM0v8Ek5-/view?usp=sharing' },
  'Interiors':     { lead: 'Bec Freeman',      budget: 2500,  pic: 'https://drive.google.com/file/d/1PsjDfGQLqDF9BVc5wuBd-Qx9D5E0Hvf4/view?usp=drive_link' },
  'Docents':       { lead: 'Rich Hill',        budget: 1000,  pic: 'https://drive.google.com/file/d/1gBzqnzekKkTLn8mnn2mxt-PqAeeMZSJs/view?usp=drive_link' },
  'Fundraising':   { lead: 'Kaelen Jennings',  budget: null,  pic: '' },
  'Events':        { lead: 'Barb Kusha',       budget: 7500,  pic: '' },
  'Marketing':     { lead: 'Haley Wright',     budget: 1000,  pic: 'https://drive.google.com/file/d/17Tse_3jiKZwmkVTTKMtt64zDghfZ8WrV/view?usp=drive_link' },
  'Venue':         { lead: 'Staff',            budget: null,  pic: '' },
};

var validModuleIds = Object.keys(views);
function hashToModule() {
  var h = window.location.hash.replace(/^#/, '');
  return validModuleIds.indexOf(h) !== -1 ? h : 'home';
}

function Dashboard() {
  const [active, setActive] = useState(hashToModule);
  const [opOpen, setOpOpen] = useState(false);
  const [opArea, setOpArea] = useState(null);
  const [quarterlyArea, setQuarterlyArea] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const View = views[active];
  const mod = modules.find(m => m.id === active);

  function navigate(id) {
    window.location.hash = id;
    setActive(id);
  }

  React.useEffect(function() {
    function onHashChange() { setActive(hashToModule()); }
    window.addEventListener('hashchange', onHashChange);
    return function() { window.removeEventListener('hashchange', onHashChange); };
  }, []);

  React.useEffect(function() {
    var fn = function() { setIsMobile(window.innerWidth < 768); };
    window.addEventListener('resize', fn);
    return function() { window.removeEventListener('resize', fn); };
  }, []);

  return (
    <MobileCtx.Provider value={isMobile}>
    <div style={{ display: "flex", minHeight: "100vh", background: cream, fontFamily: 'system-ui, sans-serif' }}>
      <style>{".nsh-sidebar::-webkit-scrollbar { display: none; } .nsh-reviews-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }"}</style>
      <div style={{ display: isMobile ? "none" : "flex", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        <div className="nsh-sidebar" style={{ width: 220, background: "#2a2a2e", display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", scrollbarWidth: "none" }}>
          <div style={{ padding: "20px 20px 14px", display: "flex", justifyContent: "center" }}>
            <img src="assets/logo.png" alt="North Star House" style={{ width: 195, display: "block" }} />
          </div>
          <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "0 0 8px" }} />
          <nav style={{ flex: 1, padding: "0 8px" }}>
            {modules.filter(m => !m.hidden).map(m => (
              <button key={m.id} onClick={() => { navigate(m.id); setOpOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                background: active === m.id ? "rgba(181,161,133,0.15)" : "transparent",
                border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left",
                color: active === m.id ? "#f0ebe3" : "rgba(255,255,255,0.5)",
                fontSize: 12, fontWeight: active === m.id ? 600 : 400,
                marginBottom: 2, transition: "all 0.15s"
              }}>
                <NavIcon id={m.id} active={active === m.id} />
                {m.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: "12px 8px 16px", borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 8 }}>
            <button onClick={() => setOpOpen(o => !o)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              background: opOpen ? "rgba(181,161,133,0.15)" : "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              color: opOpen ? "#f0ebe3" : "rgba(255,255,255,0.5)",
              fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s"
            }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.8 }}>
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Operational Areas
              <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>{opOpen ? "▲" : "▶"}</span>
            </button>
          </div>
          <div style={{ padding: "0 20px 20px" }} />
        </div>

        {/* Operational Areas flyout */}
        <div style={{
          width: opOpen ? 180 : 0, overflow: "hidden", transition: "width 0.25s ease",
          background: "#222226", borderLeft: opOpen ? "0.5px solid rgba(255,255,255,0.06)" : "none",
          display: "flex", flexDirection: "column", height: "100vh"
        }}>
          <div style={{ padding: "24px 0 16px 0", opacity: opOpen ? 1 : 0, transition: "opacity 0.2s ease 0.05s", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", padding: "0 16px", marginBottom: 10 }}>Areas</div>
            {OPERATIONAL_AREAS.map(function(area) {
              return (
                <button key={area} onClick={function() { setOpArea(area); navigate("operational"); }}
                  style={{
                    display: "block", width: "100%", padding: "9px 16px", background: opArea === area && active === "operational" ? "rgba(181,161,133,0.15)" : "transparent",
                    border: "none", cursor: "pointer", textAlign: "left",
                    color: opArea === area && active === "operational" ? "#b5a185" : "rgba(255,255,255,0.45)",
                    fontSize: 13, fontWeight: opArea === area && active === "operational" ? 600 : 400,
                    transition: "all 0.15s"
                  }}>
                  {area}
                </button>
              );
            })}
            <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "10px 16px 8px" }} />
            <button onClick={function() { navigate("financials"); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 16px",
                background: active === "financials" ? "rgba(181,161,133,0.15)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
                color: active === "financials" ? "#b5a185" : "rgba(255,255,255,0.45)",
                fontSize: 13, fontWeight: active === "financials" ? 600 : 400,
                transition: "all 0.15s"
              }}>
              Financials
            </button>
            <button onClick={function() { navigate("reviews"); }}
              style={{
                display: "block", width: "100%", padding: "9px 16px",
                background: active === "reviews" ? "rgba(181,161,133,0.15)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
                color: active === "reviews" ? "#b5a185" : "rgba(255,255,255,0.45)",
                fontSize: 13, fontWeight: active === "reviews" ? 600 : 400,
                transition: "all 0.15s"
              }}>
              Reviews
            </button>
            <button onClick={function() { navigate("admin"); }}
              style={{
                display: "block", width: "100%", padding: "9px 16px",
                background: active === "admin" ? "rgba(181,161,133,0.15)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
                color: active === "admin" ? "#b5a185" : "rgba(255,255,255,0.45)",
                fontSize: 13, fontWeight: active === "admin" ? 600 : 400,
                transition: "all 0.15s"
              }}>
              Admin
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile menu overlay */}
        {isMobile && mobileMenuOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, background: '#2a2a2e', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <img src="assets/logo.png" alt="NSH" style={{ height: 32 }} />
                <button onClick={function() { setMobileMenuOpen(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <nav style={{ flex: 1, padding: '8px 8px' }}>
                {modules.filter(function(m) { return !m.hidden; }).map(function(m) {
                  return (
                    <button key={m.id} onClick={function() { navigate(m.id); setOpOpen(false); setMobileMenuOpen(false); }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px',
                      background: active === m.id ? 'rgba(181,161,133,0.15)' : 'transparent',
                      border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                      color: active === m.id ? '#f0ebe3' : 'rgba(255,255,255,0.5)',
                      fontSize: 13, fontWeight: active === m.id ? 600 : 400, marginBottom: 2
                    }}>
                      <NavIcon id={m.id} active={active === m.id} />
                      {m.label}
                    </button>
                  );
                })}
              </nav>
              <div style={{ padding: '12px 8px 20px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>Operational Areas</div>
                {OPERATIONAL_AREAS.map(function(area) {
                  return (
                    <button key={area} onClick={function() { setOpArea(area); navigate('operational'); setMobileMenuOpen(false); }} style={{
                      display: 'block', width: '100%', padding: '9px 12px', background: opArea === area && active === 'operational' ? 'rgba(181,161,133,0.15)' : 'transparent',
                      border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                      color: opArea === area && active === 'operational' ? '#b5a185' : 'rgba(255,255,255,0.45)',
                      fontSize: 13, fontWeight: opArea === area && active === 'operational' ? 600 : 400, marginBottom: 2
                    }}>{area}</button>
                  );
                })}
                <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', margin: '8px 4px' }} />
                <button onClick={function() { navigate('financials'); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', background: active === 'financials' ? 'rgba(181,161,133,0.15)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: active === 'financials' ? '#b5a185' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: active === 'financials' ? 600 : 400, marginBottom: 2 }}>Financials</button>
                <button onClick={function() { navigate('reviews'); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', background: active === 'reviews' ? 'rgba(181,161,133,0.15)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: active === 'reviews' ? '#b5a185' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: active === 'reviews' ? 600 : 400, marginBottom: 2 }}>Reviews</button>
                <button onClick={function() { navigate('admin'); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', background: active === 'admin' ? 'rgba(181,161,133,0.15)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: active === 'admin' ? '#b5a185' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: active === 'admin' ? 600 : 400, marginBottom: 2 }}>Admin</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ background: "#fdfcfb", padding: isMobile ? "12px 16px 10px" : "24px 32px 18px", borderBottom: "3px solid rgba(136,108,68,0.35)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
            {isMobile && (
              <button onClick={function() { setMobileMenuOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#888', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            )}
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(136,108,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <NavIcon id={active} active={true} />
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 700, color: gold, fontFamily: "'Cardo', serif", textShadow: "1px 2px 0px rgba(136,108,68,0.2)" }}>{active === "financials" ? "Financials" : active === "reviews" ? "Reviews" : active === "admin" ? "Admin" : (mod && mod.label)}</h1>
            {active === "operational" && opArea && (
              <button onClick={function() { setQuarterlyArea(opArea); navigate("quarterly"); }} style={{ marginLeft: "auto", background: "transparent", color: gold, border: "1.5px solid " + gold, borderRadius: 9, padding: isMobile ? "7px 12px" : "9px 20px", fontSize: isMobile ? 11 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {isMobile ? "Quarterly ↗" : "Submit Quarterly Update"}
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, padding: isMobile ? "16px 14px" : "28px 32px", paddingBottom: isMobile ? 20 : undefined }}>
          <div style={{ maxWidth: 900 }}>
            <View navigate={navigate} opArea={opArea} navigateOp={function(a) { setOpArea(a); navigate('operational'); }} quarterlyArea={quarterlyArea} navigateToQuarterly={function(a) { setQuarterlyArea(a); navigate('quarterly'); }} />
          </div>
        </div>
      </div>
    </div>
    </MobileCtx.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(AppGate, null, React.createElement(Dashboard)));
