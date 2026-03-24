const { useState, useEffect } = React;

const SUPABASE_URL = "https://uvzwhhwzelaelfhfkvdb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2endoaHd6ZWxhZWxmaGZrdmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzI4OTksImV4cCI6MjA4OTYwODg5OX0.xw5n0MGm69u_FOiZHxbLNUCNQHehIJliO_s4YbTyfh8";

function sbFetch(table, columns) {
  const cols = columns.map(c => encodeURIComponent(c)).join(",");
  const url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=" + cols;
  return fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  }).then(r => r.json());
}

var _cache = {};
var LS_PREFIX = 'nsh3_';
function lsGet(key) {
  try {
    var r = localStorage.getItem(LS_PREFIX + key);
    if (!r) return null;
    var parsed = JSON.parse(r);
    // guard against old {ts, data} format
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object' && parsed.data !== undefined) return parsed.data;
    return parsed;
  } catch(e) { return null; }
}
function lsSet(key, data) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(data)); } catch(e) {}
}
function cachedSbFetch(table, columns) {
  var key = table + ':' + columns.slice().sort().join(',');
  if (_cache[key]) return Promise.resolve(_cache[key]);
  var ls = lsGet(key); if (ls) { _cache[key] = ls; return Promise.resolve(ls); }
  return sbFetch(table, columns).then(function(data) {
    if (Array.isArray(data)) { _cache[key] = data; lsSet(key, data); }
    return data;
  });
}
function cachedFetchAll(table) {
  var key = table + ':*';
  if (_cache[key]) return Promise.resolve(_cache[key]);
  var ls = lsGet(key); if (ls) { _cache[key] = ls; return Promise.resolve(ls); }
  var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?select=*';
  return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (Array.isArray(data)) { _cache[key] = data; lsSet(key, data); } return data; });
}
function cachedFetch(url) {
  if (_cache[url]) return Promise.resolve(_cache[url]);
  var ls = lsGet(url); if (ls) { _cache[url] = ls; return Promise.resolve(ls); }
  return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (Array.isArray(data)) { _cache[url] = data; lsSet(url, data); } return data; });
}
function clearCache(table) {
  var enc = encodeURIComponent(table);
  Object.keys(_cache).forEach(function(k) {
    if (k.indexOf(table + ':') === 0 || k.indexOf('/' + enc + '?') !== -1) delete _cache[k];
  });
  Object.keys(localStorage).forEach(function(k) {
    if (!k.startsWith(LS_PREFIX)) return;
    var inner = k.slice(LS_PREFIX.length);
    if (inner.indexOf(table + ':') === 0 || inner.indexOf('/' + enc + '?') !== -1) localStorage.removeItem(k);
  });
}

const CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";

// Kick off critical fetches immediately so data is ready when views mount
(function prefetch() {
  cachedSbFetch('2026 Volunteers', ['First Name','Last Name','Team','Status','Email','Phone Number','Address','Birthday','Volunteer Anniversary','CC','Nametag','Overview Notes','Background Notes','Notes','What they want to see at NSH','Picture URL','Emergency Contact','Month','Day']);
  cachedSbFetch('2026 Donations', ['id','Donor Name','Last Name','Informal Names','Amount','Close Date','Donation Type','Payment Type','Account Type','Acknowledged','Salesforce','Email','Phone Number','Address','Benefits','Donation Notes','Donor Notes','Notes']);
  cachedSbFetch('Sponsors', ['id','Business Name','Main Contact','Donation','Fair Market Value','Area Supported','Acknowledged','NSH Contact','Notes']);
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
  reviews: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
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
  { id: "operational", label: "Operational Areas", hidden: true },
  { id: "financials", label: "Financials", hidden: true },
  { id: "reviews", label: "Reviews", hidden: true },
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
  const [sponsors, setSponsors] = useState(null);
  const [inHouseEvents, setInHouseEvents] = useState([]);
  const [iheForm, setIheForm] = useState({ name: '', date: '', cost: '', link: '' });
  const [iheAdding, setIheAdding] = useState(false);
  const [iheSaving, setIheSaving] = useState(false);
  var isMobile = React.useContext(MobileCtx);
  useEffect(function() {
    cachedSbFetch('Sponsors', ['id','Business Name','Main Contact','Donation','Fair Market Value','Area Supported','Acknowledged','NSH Contact','Notes']).then(function(rows) {
      if (Array.isArray(rows)) setSponsors(rows);
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events') + '?select=*&order=date.asc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setInHouseEvents(rows);
    }).catch(function() {});
    cachedSbFetch('2026 Donations', ['Amount']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      var total = rows.reduce(function(s, r) {
        return s + parseFloat((r['Amount'] || '0').replace(/[^\d.]/g, '') || 0);
      }, 0);
      setDonationTotal(total);
    });
    cachedSbFetch('2026 Volunteers', ['Status', 'First Name', 'Last Name', 'Birthday', 'Picture URL']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      setActiveVols(rows.filter(function(r) { return r['Status'] === 'Active'; }).length);
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

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div onClick={function() { navigate('donors'); }} style={{ cursor: 'pointer' }}><StatCard label="Donations" value={donationTotal === null ? '...' : '$' + donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></div>
        <div onClick={function() { navigate('volunteers'); }} style={{ cursor: 'pointer' }}><StatCard label="Active Volunteers" value={activeVols === null ? '...' : activeVols} /></div>
        <StatCard label="2026 Events" value="5" />
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

        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Upcoming Birthdays
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
                    var row = { name: iheForm.name, date: iheForm.date, cost: parseFloat(iheForm.cost) || 0, link: iheForm.link || null };
                    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('In-House Events'), {
                      method: 'POST',
                      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                      body: JSON.stringify(row)
                    }).then(function(r) { return r.json(); }).then(function(res) {
                      var created = Array.isArray(res) ? res[0] : res;
                      setInHouseEvents(function(prev) { return prev.concat([created]).sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }); });
                      setIheAdding(false);
                      setIheSaving(false);
                    }).catch(function() { setIheSaving(false); });
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
                    ? <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: gold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', textDecoration: 'none' }}>{ev.name} ↗</a>
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
  );
}function EventsView() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Events" value="5" sub="next 90 days" />
        <StatCard label="Confirmed" value="3" />
        <StatCard label="Est. Revenue" value="$6,600" sub="confirmed only" />
        <StatCard label="Est. Guests" value="395" sub="across all events" />
      </div>
      <Table
        cols={["Event", "Date", "Status", "Est. Guests", "Revenue"]}
        rows={mockData.events}
        renderRow={r => (<><Td>{r.name}</Td><Td muted>{r.date}</Td><Td><Badge status={r.status} /></Td><Td muted>{r.guests}</Td><Td>{r.revenue}</Td></>)}
      />
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

var TEAM_COLORS = {
  'Grounds':      { bg: '#e8f5e9', color: '#2e7d32' },
  'Construction': { bg: '#fff3e0', color: '#e65100' },
  'Events Team':  { bg: '#e3f2fd', color: '#1565c0' },
  'Event Support':{ bg: '#e8eaf6', color: '#3949ab' },
  'Interiors':    { bg: '#f3e5f5', color: '#6a1b9a' },
  'Fundraising':  { bg: '#fff8e1', color: '#8a6200' },
  'Staff':        { bg: '#f3f3f3', color: '#555' },
  'Board Member': { bg: '#fce4ec', color: '#880e4f' },
  'New':          { bg: '#e0f7fa', color: '#006064' },
  'Docent':           { bg: '#fbe9e7', color: '#8d3d2b' },
  'Volunteer Exchange': { bg: '#e8f4fd', color: '#0d6eab' },
  'Support':           { bg: '#f0f4f8', color: '#3a5068' },
  'Venue':             { bg: '#ede7f6', color: '#4527a0' },
  'Marketing':         { bg: '#fce4ec', color: '#c2185b' },
};
var TEAM_OPTIONS = Object.keys(TEAM_COLORS);

function TeamPicker({ value, onChange }) {
  const { useState: useS } = React;
  const [open, setOpen] = useS(false);
  const [search, setSearch] = useS('');
  var selected = value ? value.split('|').map(function(t) { return t.trim(); }).filter(Boolean) : [];

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
              placeholder="Search teams..."
              style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0d8cc', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
            {TEAM_OPTIONS.filter(function(opt) { return opt.toLowerCase().indexOf(search.toLowerCase()) !== -1; }).map(function(opt) {
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
        </div>
      )}
    </div>
  );
}

var volInputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
var volLabelStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
var volGrp = { marginBottom: 14 };
var volSecLabel = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

function VolForm({ form, onChange, saving, onSubmit, title, onCancel, onDelete }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a', marginBottom: 20 }}>{title}</div>
        <form onSubmit={onSubmit}>
          <span style={volSecLabel}>Basic Info</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><label style={volLabelStyle}>First Name *</label><input required name="First Name" value={form['First Name']} onChange={onChange} style={volInputStyle} /></div>
            <div><label style={volLabelStyle}>Last Name *</label><input required name="Last Name" value={form['Last Name']} onChange={onChange} style={volInputStyle} /></div>
          </div>
          <div style={volGrp}><label style={volLabelStyle}>Status</label><select name="Status" value={form['Status']} onChange={onChange} style={volInputStyle}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
          <div style={volGrp}><label style={volLabelStyle}>Team</label><div style={{ marginTop: 4 }}><TeamPicker value={form['Team']} onChange={onChange} /></div></div>
          <span style={volSecLabel}>Contact</span>
          <div style={volGrp}><label style={volLabelStyle}>Email</label><input name="Email" type="email" value={form['Email']} onChange={onChange} style={volInputStyle} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Phone Number</label><input name="Phone Number" value={form['Phone Number']} onChange={onChange} style={volInputStyle} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Address</label><input name="Address" value={form['Address']} onChange={onChange} style={volInputStyle} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Emergency Contact</label><input name="Emergency Contact" value={form['Emergency Contact']} onChange={onChange} style={volInputStyle} /></div>
          <span style={volSecLabel}>Volunteer Info</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><label style={volLabelStyle}>Birthday</label><input name="Birthday" type="date" value={form['Birthday']} onChange={onChange} style={volInputStyle} /></div>
            <div><label style={volLabelStyle}>Anniversary</label><input name="Volunteer Anniversary" type="date" value={form['Volunteer Anniversary']} onChange={onChange} style={volInputStyle} /></div>
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
          <span style={volSecLabel}>Goals</span>
          <div style={volGrp}><label style={volLabelStyle}>What they want to see at NSH</label><textarea name="What they want to see at NSH" value={form['What they want to see at NSH']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
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
  const [tab, setTab] = useState('active');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarding, setOnboarding] = useState([]);
  var OB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvOZozfWfzXyS5GyAHDyzQbXf-A8GxNMKTTRh6BGDJCVAAdimGW7MvLdhl0Ab0PuUgmUfm8xpZRUyP/pub?gid=544068320&single=true&output=csv';
  var HOUR_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [hoursData, setHoursData] = React.useState({});

  function hoursRowsToMap(rows) {
    var result = {};
    rows.forEach(function(row) {
      var name = (row.name || '').trim();
      if (!name) return;
      var key = name.toLowerCase();
      var months = {};
      HOUR_MONTHS.forEach(function(m) {
        var v = parseFloat(row[m.toLowerCase()]) || 0;
        if (v > 0) months[m] = v;
      });
      var total = parseFloat(row.total_hours) || 0;
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

  var emptyForm = {
    'First Name': '', 'Last Name': '', 'Team': '', 'Status': 'Active',
    'Email': '', 'Phone Number': '', 'Address': '', 'Birthday': '',
    'Volunteer Anniversary': '', 'CC': false, 'Nametag': false,
    'Overview Notes': '', 'Background Notes': '', 'Notes': '',
    'What they want to see at NSH': '', 'Picture URL': '',
    'Emergency Contact': '', 'Month': '', 'Day': ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(function() {
    cachedSbFetch('2026 Volunteers', ['First Name','Last Name','Team','Status','Email','Phone Number','Address','Birthday','Volunteer Anniversary','CC','Nametag','Overview Notes','Background Notes','Notes','What they want to see at NSH','Picture URL','Emergency Contact','Month','Day'])
      .then(function(data) {
        if (Array.isArray(data)) setVolunteers(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
    var cachedHours = lsGet('hours_summary');
    if (cachedHours) { setHoursData(cachedHours); }
    else {
      fetch(SUPABASE_URL + '/rest/v1/volunteer_hours?select=*', {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (!Array.isArray(rows)) return;
        var parsed = hoursRowsToMap(rows);
        setHoursData(parsed);
        lsSet('hours_summary', parsed);
      }).catch(function() {});
    }

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
        return { _sbId: sb ? sb.id : null, id: sb ? sb.id : ('sheet-' + i), first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone, area_of_interest: p.area_of_interest, start_date: p.start_date, pipeline_stage: sb ? (sb.pipeline_stage || 'Form Submitted') : 'Form Submitted', status: sb ? (sb.status || 'In Progress') : 'In Progress', stage_dates: sd, survey_sent: sb ? !!sb.survey_sent : false };
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
        var volPayload = { 'First Name': ob.first_name, 'Last Name': ob.last_name || '', 'Status': 'Active', 'Email': ob.email || '', 'Phone Number': ob.phone || '' };
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

  var active = volunteers.filter(function(v) { return v['Status'] === 'Active'; }).length;
  var inactive = volunteers.filter(function(v) { return v['Status'] === 'Inactive'; }).length;
  var tabList = volunteers.filter(function(v) { return tab === 'active' ? v['Status'] === 'Active' : v['Status'] === 'Inactive'; });
  var teamSet = ['All'].concat(TEAM_OPTIONS.filter(function(t) {
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

  function fmtBirthday(val) {
    if (!val) return '';
    var d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return val;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
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

  function InfoRow({ label, value, link }) {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 110, fontSize: 12, color: '#777', flexShrink: 0, paddingTop: 1 }}>{label}</div>
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
            onClick={function() { setTab('inactive'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 12, fontWeight: tab === 'inactive' ? 600 : 400, cursor: 'pointer', background: tab === 'inactive' ? '#fff' : 'transparent', color: tab === 'inactive' ? '#2a2a2a' : '#999', boxShadow: tab === 'inactive' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >Inactive <span style={{ fontSize: 12, color: tab === 'inactive' ? gold : '#bbb', fontWeight: 500 }}>{inactive}</span></button>
        </div>
        <button onClick={function() { setForm(emptyForm); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add Volunteer</button>
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
              </div>
            );
          })}
        </div>
      )}
      </React.Fragment>
      )}

      {selected && !editing && (
        <div onClick={function() { setSelected(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
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
                  <InfoRow label="Email" value={selected['Email']} link={'mailto:' + selected['Email']} />
                  <InfoRow label="Phone" value={selected['Phone Number']} />
                  <InfoRow label="Address" value={selected['Address']} />
                  <InfoRow label="Emergency" value={selected['Emergency Contact']} />
                </div>
              )}
              {(selected['Volunteer Anniversary'] || selected['Birthday']) && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Volunteer Info</span>
                  <InfoRow label="Anniversary" value={selected['Volunteer Anniversary']} />
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
              {selected['What they want to see at NSH'] && (
                <div style={{ marginBottom: 4 }}>
                  <span style={volSecLabel}>Goals</span>
                  <NoteBlock value={selected['What they want to see at NSH']} />
                </div>
              )}
              {(function() {
                var data = getVolHours(selected);
                if (!data || data.total === 0) return null;
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

          {/* Selected person banner */}
          {obSelectedId && (function() {
            var selOb = onboarding.find(function(o) { return o.id === obSelectedId; });
            if (!selOb) return null;
            return (
              <div style={{ background: '#fef9f0', border: '0.5px solid ' + gold, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>{selOb.first_name} {selOb.last_name}</div>
                {selOb.area_of_interest && <span style={{ fontSize: 11, background: 'rgba(136,108,68,0.12)', color: gold, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{selOb.area_of_interest}</span>}
                {selOb.email && <span style={{ fontSize: 12, color: '#888' }}>{selOb.email}</span>}
                {selOb.phone && <span style={{ fontSize: 12, color: '#888' }}>{selOb.phone}</span>}
                {selOb.start_date && <span style={{ fontSize: 11, color: '#aaa' }}>Submitted: {selOb.start_date}</span>}
                <span style={{ fontSize: 11, color: gold, fontWeight: 500, marginLeft: 'auto' }}>← click any stage to move</span>
              </div>
            );
          })()}

          {/* Pipeline stages */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, overflow: 'hidden' }}>
            {OB_STAGES.map(function(stage, si) {
              var peopleHere = onboarding.filter(function(o) { return (o.pipeline_stage || 'Form Submitted') === stage && o.status === 'In Progress'; });
              var selOb = obSelectedId ? onboarding.find(function(o) { return o.id === obSelectedId; }) : null;
              var selIsHere = selOb && (selOb.pipeline_stage || 'Form Submitted') === stage;
              var canMove = selOb && !selIsHere && selOb.status === 'In Progress';
              var hasAnyone = peopleHere.length > 0;
              return (
                <div key={stage} style={{ borderBottom: si < OB_STAGES.length - 1 ? '0.5px solid #f0ebe3' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: selIsHere ? '#fef9f0' : 'transparent' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: hasAnyone ? gold : '#f0ebe2', color: hasAnyone ? '#fff' : '#ccc', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{si + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: hasAnyone ? 600 : 400, color: hasAnyone ? '#2a2a2a' : '#aaa' }}>{stage}</div>
                    </div>
                    {canMove && (
                      <button onClick={function() { obSetStage(selOb, stage); }} disabled={obActing === selOb.id}
                        style={{ fontSize: 11, background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500, opacity: obActing === selOb.id ? 0.5 : 1 }}>Move here</button>
                    )}
                  </div>
                  {hasAnyone && (
                    <div style={{ padding: '4px 18px 12px 50px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {peopleHere.map(function(ob) {
                        var isSel = obSelectedId === ob.id;
                        var stageDates = ob.stage_dates || {};
                        var dateStr = stageDates[stage] || (stage === 'Form Submitted' ? ob.start_date : null);
                        return (
                          <div key={ob.id} onClick={function() { setObSelectedId(isSel ? null : ob.id); }}
                            style={{ display: 'flex', flexDirection: 'column', background: isSel ? gold : '#f5f1eb', border: '0.5px solid ' + (isSel ? gold : '#e0d8cc'), borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.12s', minWidth: 100 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? '#fff' : '#2a2a2a' }}>{ob.first_name} {ob.last_name}</span>
                            {ob.area_of_interest && <span style={{ fontSize: 10, color: isSel ? 'rgba(255,255,255,0.8)' : gold, fontWeight: 500 }}>{ob.area_of_interest}</span>}
                            {dateStr && <span style={{ fontSize: 10, color: isSel ? 'rgba(255,255,255,0.6)' : '#bbb', marginTop: 1 }}>{dateStr}</span>}
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
                  <div key={t.stage} style={{ background: t.bg, padding: '14px 18px', borderLeft: ti === 1 ? '0.5px solid ' + t.border : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.icon} {t.stage}</div>
                      {canMove && (
                        <button onClick={function() { obSetStage(selOb, t.stage); }} disabled={obActing === selOb.id}
                          style={{ fontSize: 11, background: t.color, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 500, opacity: obActing === selOb.id ? 0.5 : 1 }}>Move</button>
                      )}
                    </div>
                    {peopleHere.length === 0
                      ? <div style={{ fontSize: 11, color: t.color, opacity: 0.4 }}>None yet</div>
                      : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{peopleHere.map(function(ob) { return <span key={ob.id} style={{ fontSize: 11, background: '#fff', color: t.color, border: '0.5px solid ' + t.border, borderRadius: 20, padding: '2px 10px', fontWeight: 500 }}>{ob.first_name} {ob.last_name}</span>; })}</div>
                    }
                  </div>
                );
              })}
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

      {showAdd && (
        <VolForm
          form={form}
          onChange={handleFormChange}
          saving={saving}
          title="Add Volunteer"
          onSubmit={handleAddSubmit}
          onCancel={function() { setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function DonorsView() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [editDon, setEditDon] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [donorBenefits, setDonorBenefits] = useState([]);

  var DONATION_TYPES = ['Donation','Membership','Restricted','Membership, Donation','Brick Purchase','Tribute'];
  var PAYMENT_TYPES = ['Website','Check','Cash','Credit Card','ACH','Other'];
  var ACCOUNT_TYPES = ['Individual','Family','Household','Foundation','Corporate','Organization'];

  var emptyDonForm = {
    'Donor Name': '', 'Last Name': '', 'Informal Names': '',
    'Amount': '', 'Close Date': '', 'Donation Type': 'Donation',
    'Payment Type': 'Website', 'Account Type': 'Individual',
    'Acknowledged': false, 'Salesforce': false,
    'Email': '', 'Phone Number': '', 'Address': '',
    'Benefits': '', 'Donation Notes': '', 'Donor Notes': '', 'Notes': ''
  };
  const [form, setForm] = useState(emptyDonForm);

  useEffect(function() {
    cachedSbFetch('2026 Donations', ['id','Donor Name','Last Name','Informal Names','Amount','Close Date','Donation Type','Payment Type','Account Type','Acknowledged','Salesforce','Email','Phone Number','Address','Benefits','Donation Notes','Donor Notes','Notes'])
      .then(function(data) {
        if (Array.isArray(data)) setDonations(data.sort(function(a, b) { return new Date(b['Close Date']) - new Date(a['Close Date']); }));
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
  }, []);

  useEffect(function() {
    if (!selected) { setDonorBenefits([]); return; }
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Donor Benefits') + '?donor_name=eq.' + encodeURIComponent(selected['Donor Name']) + '&select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setDonorBenefits(Array.isArray(rows) ? rows.map(function(r) { return r.benefit; }) : []);
    });
  }, [selected]);

  function parseAmount(val) {
    return parseFloat((val || '0').replace(/[^\d.]/g, '') || 0);
  }

  function fmtAmount(val) {
    var n = parseAmount(val);
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(val) {
    if (!val) return '';
    var d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  var totalRaised = donations.reduce(function(s, r) { return s + parseAmount(r['Amount']); }, 0);
  var totalDonors = donations.length;
  var memberships = donations.filter(function(r) { return (r['Donation Type'] || '').includes('Membership'); }).length;
  var acknowledged = donations.filter(function(r) { return r['Acknowledged'] === true || String(r['Acknowledged']).toUpperCase() === 'TRUE'; }).length;
  var unacknowledged = totalDonors - acknowledged;

  function deleteDonation(d) {
    if (!window.confirm('Delete this donation from ' + d['Donor Name'] + '? This cannot be undone.')) return;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Donations') + '?id=eq.' + d.id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      clearCache('2026 Donations');
      setDonations(function(prev) { return prev.filter(function(x) { return x.id !== d.id; }); });
      setSelected(null);
    });
    fetch('https://script.google.com/macros/s/AKfycbxknvigF90NbBe86zrXT6JvRlaDQmvsuYuRYCfOOLISwtzDO3X7hH5TIDH7ALemwCWy/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete', sheet: '2026 Donations', 'Donor Name': d['Donor Name'], 'Close Date': d['Close Date'] })
    });
  }

  function handleEditFormChange(e) {
    var { name, value, type, checked } = e.target;
    setEditForm(function(f) { return Object.assign({}, f, { [name]: type === 'checkbox' ? checked : value }); });
  }

  function saveEditDonation(e) {
    e.preventDefault();
    setEditSaving(true);
    var patch = Object.assign({}, editForm);
    delete patch.id;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Donations') + '?id=eq.' + editDon.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setEditSaving(false);
      clearCache('2026 Donations');
      var updated = rows && rows[0] ? rows[0] : Object.assign({}, editDon, patch);
      setDonations(function(prev) { return prev.map(function(x) { return x.id === editDon.id ? updated : x; }); });
      setEditDon(null);
      setSelected(null);
    });
  }

  function handleDonFormChange(e) {
    var key = e.target.name;
    var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; });
  }

  function handleDonSubmit(e) {
    e.preventDefault();
    setSaving(true);
    var row = {};
    Object.keys(form).forEach(function(k) {
      if (form[k] !== '') row[k] = form[k] === true ? 'TRUE' : form[k] === false ? 'FALSE' : form[k];
    });
    sbInsert('2026 Donations', row).then(function(res) {
      setSaving(false);
      clearCache('2026 Donations');
      var inserted = Array.isArray(res) ? res[0] : res;
      if (inserted && inserted['Donor Name']) setDonations(function(p) { return p.concat([inserted]); });
      setShowAdd(false);
      setForm(emptyDonForm);
      // Sync to Google Sheets → triggers thank you letter generation
      fetch('https://script.google.com/macros/s/AKfycbxknvigF90NbBe86zrXT6JvRlaDQmvsuYuRYCfOOLISwtzDO3X7hH5TIDH7ALemwCWy/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ sheet: '2026 Donations', row: row })
      });
    }).catch(function() { setSaving(false); });
  }

  var DONOR_TIERS = [
    { name: 'Blue Giant Star Sponsor', min: 2500, range: '$2,500–$4,999', color: '#1565c0', bg: '#dbeafe', border: '#93c5fd',
      ownBenefits: ['Private docent-led tour with complimentary refreshments for up to 12 guests', '4 Complimentary Event Tickets'] },
    { name: 'Red Giant Star Sponsor', min: 1000, range: '$1,000–$2,499', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5',
      ownBenefits: ['Custom engraved plaque with annual "stars"'] },
    { name: 'Evening Star', min: 500, range: '$500–$999', color: '#c2410c', bg: '#ffedd5', border: '#fdba74',
      ownBenefits: ['2 Complimentary Tickets to a North Star House event'] },
    { name: 'Morning Star', min: 250, range: '$250–$499', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd',
      ownBenefits: ['Recognition in our printed and digital event programs'] },
    { name: 'Rising Star', min: 100, range: '$100–$249', color: '#15803d', bg: '#dcfce7', border: '#86efac',
      ownBenefits: [] },
    { name: 'Shooting Star', min: 50, range: '$50–$99', color: '#b45309', bg: '#fef9c3', border: '#fde047',
      ownBenefits: ['Access to our Online Loyalty Program & Newsletter subscription', 'Invitation to our State of the Star Membership Celebration'] },
  ];

  function getDonorTier(total) {
    return DONOR_TIERS.find(function(t) { return total >= t.min; }) || null;
  }

  function getAllBenefits(tier) {
    if (!tier) return [];
    var tiersAsc = DONOR_TIERS.slice().reverse();
    var result = [];
    for (var i = 0; i < tiersAsc.length; i++) {
      result = result.concat(tiersAsc[i].ownBenefits);
      if (tiersAsc[i].name === tier.name) break;
    }
    return result;
  }

  function toggleBenefit(benefit) {
    var checked = donorBenefits.indexOf(benefit) !== -1;
    if (checked) {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Donor Benefits') + '?donor_name=eq.' + encodeURIComponent(selected['Donor Name']) + '&benefit=eq.' + encodeURIComponent(benefit), {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      }).then(function() { setDonorBenefits(function(prev) { return prev.filter(function(b) { return b !== benefit; }); }); });
    } else {
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Donor Benefits'), {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ donor_name: selected['Donor Name'], benefit: benefit })
      }).then(function() { setDonorBenefits(function(prev) { return prev.concat([benefit]); }); });
    }
  }

  var donorYTD = {};
  donations.forEach(function(d) {
    var n = d['Donor Name'];
    if (!donorYTD[n]) donorYTD[n] = 0;
    donorYTD[n] += parseAmount(d['Amount']);
  });

  var iStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
  var lStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
  var grp = { marginBottom: 14 };
  var sec = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

  var typeColors = {
    'Donation':            { bg: '#e3f2fd', color: '#1565c0' },
    'Membership':          { bg: '#e8f5e9', color: '#2e7d32' },
    'Restricted':          { bg: '#fce4ec', color: '#880e4f' },
    'Membership, Donation':{ bg: '#f3e5f5', color: '#6a1b9a' },
    'Brick Purchase':      { bg: '#fbe9e7', color: '#8d3d2b' },
    'Tribute':             { bg: '#fff8e1', color: '#8a6200' },
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Raised" value={loading ? '...' : '$' + totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sub="2026 YTD" />
        <StatCard label="Donations" value={loading ? '...' : totalDonors} />
        <StatCard label="Memberships" value={loading ? '...' : memberships} />
        <StatCard label="Need Thank You" value={loading ? '...' : unacknowledged} sub={unacknowledged > 0 ? '' : 'all clear'} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#888' }}>{loading ? 'Loading...' : totalDonors + ' donation' + (totalDonors !== 1 ? 's' : '')}</div>
        <button onClick={function() { setForm(emptyDonForm); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add Donation</button>
      </div>

      {error && <div style={{ background: '#fce4e4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#c0392b' }}>Error: {error}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {['All'].concat(DONATION_TYPES).map(function(t) {
          var active = filterType === t;
          var tc = typeColors[t] || { bg: '#f5f0ea', color: '#888' };
          return (
            <button key={t} onClick={function() { setFilterType(t); }}
              style={{ padding: '5px 14px', borderRadius: 5, border: '1.5px solid ' + (active ? tc.color : '#e0d8cc'), background: active ? tc.bg : '#fff', color: active ? tc.color : '#888', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
              {t}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#777', fontSize: 12 }}>Loading donations...</div>
      ) : (
        <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, padding: '8px 16px', borderBottom: '0.5px solid #e8e0d4', background: '#faf8f4' }}>
            {['Donor', 'Type', 'Amount', 'Date'].map(function(h) {
              return <div key={h} style={{ fontSize: 12, color: '#777', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>;
            })}
          </div>
          {donations.filter(function(d) { return filterType === 'All' || d['Donation Type'] === filterType; }).map(function(d, i) {
            var tc = typeColors[d['Donation Type']] || { bg: '#f3f3f3', color: '#555' };
            var acked = d['Acknowledged'] === true || String(d['Acknowledged']).toUpperCase() === 'TRUE';
            return (
              <div
                key={i}
                onClick={function() { setSelected(d); }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, padding: '11px 16px', borderBottom: '0.5px solid #f0ebe2', cursor: 'pointer', background: '#fff', alignItems: 'center', transition: 'background 0.12s' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(function() {
                      var tier = getDonorTier(donorYTD[d['Donor Name']] || 0);
                      return tier ? <span style={{ fontSize: 13, color: tier.color, lineHeight: 1 }} title={tier.name}>✦</span> : null;
                    })()}
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a' }}>{d['Donor Name']}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{d['Account Type']}</div>
                </div>
                <div>
                  <span style={{ background: tc.bg, color: tc.color, fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{d['Donation Type']}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{fmtAmount(d['Amount'])}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{fmtDate(d['Close Date'])}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: acked ? '#e8f5e9' : '#fff8e1', color: acked ? '#2e7d32' : '#8a6200' }}>{acked ? 'Thanked' : 'Pending'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div onClick={function() { setSelected(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)', padding: '24px 28px 18px', borderBottom: '0.5px solid #e8dece', position: 'relative', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 19, fontWeight: 600, color: '#1e1a16', marginBottom: 4 }}>{selected['Donor Name']}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(function() { var tc = typeColors[selected['Donation Type']] || { bg: '#f3f3f3', color: '#555' }; return <span style={{ background: tc.bg, color: tc.color, fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>{selected['Donation Type']}</span>; })()}
                <span style={{ fontSize: 12, color: '#777' }}>{fmtDate(selected['Close Date'])}</span>
                {(function() {
                  var ytd = donorYTD[selected['Donor Name']] || 0;
                  var tier = getDonorTier(ytd);
                  return tier ? <span style={{ fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 20, padding: '2px 10px' }}>✦ {tier.name}</span> : null;
                })()}
              </div>
              <button onClick={function() { setSelected(null); }} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '20px 28px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 20 }}><span style={{ fontSize: 12, color: '#777', marginRight: 8 }}>Amount</span><span style={{ fontSize: 16, fontWeight: 600, color: gold }}>{fmtAmount(selected['Amount'])}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <div>
                  <span style={sec}>Donor Info</span>
                  {selected['Informal Names'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Goes by</span>{selected['Informal Names']}</div>}
                  {selected['Account Type'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Type</span>{selected['Account Type']}</div>}
                  {selected['Email'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Email</span><a href={'mailto:' + selected['Email']} style={{ color: gold, textDecoration: 'none' }}>{selected['Email']}</a></div>}
                  {selected['Phone Number'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Phone</span>{selected['Phone Number']}</div>}
                  {selected['Address'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Address</span><span style={{ whiteSpace: 'pre-line' }}>{selected['Address']}</span></div>}
                  <span style={sec}>Payment</span>
                  {selected['Payment Type'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Method</span>{selected['Payment Type']}</div>}
                  {selected['Benefits'] && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: '#777', marginRight: 8 }}>Benefits</span>{selected['Benefits']}</div>}
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: '#777', marginRight: 8 }}>Acknowledged</span>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: (selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? '#e8f5e9' : '#fff8e1', color: (selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? '#2e7d32' : '#8a6200' }}>
                      {(selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? 'Thanked' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div>
                  {selected['Donation Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Donation Notes</span><div style={{ fontSize: 12, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Donation Notes']}</div></div>}
                  {selected['Donor Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Donor Notes</span><div style={{ fontSize: 12, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Donor Notes']}</div></div>}
                  {selected['Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Notes</span><div style={{ fontSize: 12, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Notes']}</div></div>}
                </div>
              </div>
              {(function() {
                var ytd = donorYTD[selected['Donor Name']] || 0;
                var tier = getDonorTier(ytd);
                if (!tier) return null;
                var benefits = getAllBenefits(tier);
                return (
                  <div style={{ marginTop: 20, padding: '14px 16px', background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tier.color }}>✦ {tier.name}</span>
                      <span style={{ fontSize: 11, color: tier.color, opacity: 0.7 }}>{tier.range} · YTD ${ytd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {benefits.map(function(b) {
                        var checked = donorBenefits.indexOf(b) !== -1;
                        return (
                          <label key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={checked} onChange={function() { toggleBenefit(b); }} style={{ marginTop: 2, accentColor: tier.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: tier.color, opacity: checked ? 1 : 0.7, textDecoration: checked ? 'none' : 'none', fontWeight: checked ? 600 : 400, lineHeight: 1.4 }}>{b}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={function() { setSelected(null); }} style={{ flex: 1, padding: '9px', background: 'transparent', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#999', fontWeight: 500 }}>Close</button>
                <button onClick={function() { setEditDon(selected); setEditForm(Object.assign({}, selected)); }} style={{ padding: '9px 20px', background: gold, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 500 }}>Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editDon && (
        <div onClick={function() { setEditDon(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a', marginBottom: 20 }}>Edit Donation</div>
            <form onSubmit={saveEditDonation}>
              <span style={sec}>Donor</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label style={lStyle}>First / Full Name *</label><input required name="Donor Name" value={editForm['Donor Name'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
                <div><label style={lStyle}>Last Name</label><input name="Last Name" value={editForm['Last Name'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              </div>
              <div style={grp}><label style={lStyle}>Goes By (Informal)</label><input name="Informal Names" value={editForm['Informal Names'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Account Type</label>
                <select name="Account Type" value={editForm['Account Type'] || ''} onChange={handleEditFormChange} style={iStyle}>
                  {ACCOUNT_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <span style={sec}>Donation</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label style={lStyle}>Amount *</label><input required name="Amount" value={editForm['Amount'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
                <div><label style={lStyle}>Close Date</label><input name="Close Date" type="date" value={editForm['Close Date'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              </div>
              <div style={grp}><label style={lStyle}>Donation Type</label>
                <select name="Donation Type" value={editForm['Donation Type'] || ''} onChange={handleEditFormChange} style={iStyle}>
                  {DONATION_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <div style={grp}><label style={lStyle}>Payment Type</label>
                <select name="Payment Type" value={editForm['Payment Type'] || ''} onChange={handleEditFormChange} style={iStyle}>
                  {PAYMENT_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <div style={grp}><label style={lStyle}>Benefits</label><input name="Benefits" value={editForm['Benefits'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Acknowledged" checked={!!editForm['Acknowledged']} onChange={handleEditFormChange} /> Acknowledged / Thanked</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Salesforce" checked={!!editForm['Salesforce']} onChange={handleEditFormChange} /> In Salesforce</label>
              </div>
              <span style={sec}>Contact</span>
              <div style={grp}><label style={lStyle}>Email</label><input name="Email" type="email" value={editForm['Email'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Phone Number</label><input name="Phone Number" value={editForm['Phone Number'] || ''} onChange={handleEditFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Address</label><textarea name="Address" value={editForm['Address'] || ''} onChange={handleEditFormChange} rows={3} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <span style={sec}>Notes</span>
              <div style={grp}><label style={lStyle}>Donation Notes</label><textarea name="Donation Notes" value={editForm['Donation Notes'] || ''} onChange={handleEditFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={grp}><label style={lStyle}>Donor Notes</label><textarea name="Donor Notes" value={editForm['Donor Notes'] || ''} onChange={handleEditFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={grp}><label style={lStyle}>Notes</label><textarea name="Notes" value={editForm['Notes'] || ''} onChange={handleEditFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={editSaving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: editSaving ? 0.7 : 1 }}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={function() { setEditDon(null); }} style={{ padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="button" onClick={function() { deleteDonation(editDon); setEditDon(null); }} style={{ padding: '10px 16px', background: 'transparent', border: '0.5px solid #e8a0a0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#c0392b', fontWeight: 500 }}>Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdd && (
        <div onClick={function() { setShowAdd(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#2a2a2a', marginBottom: 20 }}>Add Donation</div>
            <form onSubmit={handleDonSubmit}>
              <span style={sec}>Donor</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label style={lStyle}>First / Full Name *</label><input required name="Donor Name" value={form['Donor Name']} onChange={handleDonFormChange} style={iStyle} /></div>
                <div><label style={lStyle}>Last Name</label><input name="Last Name" value={form['Last Name']} onChange={handleDonFormChange} style={iStyle} /></div>
              </div>
              <div style={grp}><label style={lStyle}>Goes By (Informal)</label><input name="Informal Names" value={form['Informal Names']} onChange={handleDonFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Account Type</label>
                <select name="Account Type" value={form['Account Type']} onChange={handleDonFormChange} style={iStyle}>
                  {ACCOUNT_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <span style={sec}>Donation</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label style={lStyle}>Amount *</label><input required name="Amount" value={form['Amount']} onChange={handleDonFormChange} style={iStyle} placeholder="$0.00" /></div>
                <div><label style={lStyle}>Close Date</label><input name="Close Date" type="date" value={form['Close Date']} onChange={handleDonFormChange} style={iStyle} /></div>
              </div>
              <div style={grp}><label style={lStyle}>Donation Type</label>
                <select name="Donation Type" value={form['Donation Type']} onChange={handleDonFormChange} style={iStyle}>
                  {DONATION_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <div style={grp}><label style={lStyle}>Payment Type</label>
                <select name="Payment Type" value={form['Payment Type']} onChange={handleDonFormChange} style={iStyle}>
                  {PAYMENT_TYPES.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                </select>
              </div>
              <div style={grp}><label style={lStyle}>Benefits</label><input name="Benefits" value={form['Benefits']} onChange={handleDonFormChange} style={iStyle} /></div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Acknowledged" checked={form['Acknowledged']} onChange={handleDonFormChange} /> Acknowledged / Thanked</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Salesforce" checked={form['Salesforce']} onChange={handleDonFormChange} /> In Salesforce</label>
              </div>
              <span style={sec}>Contact</span>
              <div style={grp}><label style={lStyle}>Email</label><input name="Email" type="email" value={form['Email']} onChange={handleDonFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Phone Number</label><input name="Phone Number" value={form['Phone Number']} onChange={handleDonFormChange} style={iStyle} /></div>
              <div style={grp}><label style={lStyle}>Address</label><textarea name="Address" value={form['Address']} onChange={handleDonFormChange} rows={3} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <span style={sec}>Notes</span>
              <div style={grp}><label style={lStyle}>Donation Notes</label><textarea name="Donation Notes" value={form['Donation Notes']} onChange={handleDonFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={grp}><label style={lStyle}>Donor Notes</label><textarea name="Donor Notes" value={form['Donor Notes']} onChange={handleDonFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={grp}><label style={lStyle}>Notes</label><textarea name="Notes" value={form['Notes']} onChange={handleDonFormChange} rows={2} style={Object.assign({}, iStyle, { resize: 'vertical' })} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Donation'}</button>
                <button type="button" onClick={function() { setShowAdd(false); }} style={{ flex: 1, padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingView() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Posts This Month" value="5" />
        <StatCard label="Sent" value="1" />
        <StatCard label="Scheduled" value="1" />
        <StatCard label="In Draft/Ideas" value="3" />
      </div>
      <Table
        cols={["Platform", "Post", "Scheduled Date", "Lead", "Status"]}
        rows={mockData.marketing}
        renderRow={r => (<><Td>{r.platform}</Td><Td>{r.post}</Td><Td muted>{r.date}</Td><Td muted>{r.lead}</Td><Td><Badge status={r.status} /></Td></>)}
      />
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

  function handleAttachUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    setAttachFileName(file.name);
    setAttachUploading(true);
    var path = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    fetch(SUPABASE_URL + '/storage/v1/object/board-attachments/' + encodeURIComponent(path), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    }).then(function(r) { return r.json(); }).then(function(res) {
      setAttachUploading(false);
      var url = SUPABASE_URL + '/storage/v1/object/public/board-attachments/' + encodeURIComponent(path);
      setTopicForm(function(f) { return Object.assign({}, f, { attachment_url: url }); });
    }).catch(function() { setAttachUploading(false); });
  }

  function sbFetchAll(table) {
    var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?select=*';
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }).then(function(r) { return r.json(); });
  }

  function load() {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      cachedFetchAll('Board Voting Items'),
      cachedFetchAll('Board-Votes')
    ]).then(function(results) {
      var itemsData = results[0];
      var votesData = results[1];
      if (!Array.isArray(itemsData)) {
        setLoadError('Board Voting Items: ' + ((itemsData && itemsData.message) ? itemsData.message : JSON.stringify(itemsData)));
        setLoading(false);
        return;
      }
      if (!Array.isArray(votesData)) {
        setLoadError('Board-Votes: ' + ((votesData && votesData.message) ? votesData.message : JSON.stringify(votesData)));
        setLoading(false);
        return;
      }
      console.log('Board Voting Items:', itemsData);
      console.log('Board-Votes:', votesData);
      var sorted = itemsData.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      setItems(sorted);
      setVotes(votesData);
      setLoading(false);
    }).catch(function(err) { setLoadError(err.message); setLoading(false); });
  }

  React.useEffect(function() { load(); }, []);

  function itemVotes(item) {
    return votes.filter(function(v) { return v.topicId === item.id; });
  }

  function isRevealed(item) {
    var iv = itemVotes(item);
    var allVoted = BOARD_MEMBERS.every(function(m) { return iv.some(function(v) { return v.voter === m; }); });
    var pastDue = item.due_date && new Date(item.due_date) < new Date();
    return allVoted || pastDue;
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

  function handleVoteSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!voteForm.voter || !voteForm.choice) return;
    setVoteSaving(true);
    var existing = votes.find(function(v) { return v.topicId === selected.id && v.voter === voteForm.voter; });
    var today = new Date().toDateString();
    var isInMeeting = selected.meeting_date && new Date(selected.meeting_date + 'T12:00:00').toDateString() === today;
    var payload = { topicId: selected.id, voter: voteForm.voter, choice: voteForm.choice, note: voteForm.note || null };
    var prom;
    if (existing) {
      prom = sbPatchById('Board-Votes', existing.id, Object.assign({}, payload, { changed_in_meeting: isInMeeting ? true : (existing.changed_in_meeting || false) }));
    } else {
      prom = sbInsert('Board-Votes', Object.assign({}, payload, { changed_in_meeting: false }));
    }
    prom.then(function() {
      setVoteSaving(false);
      setVoteForm({ voter: '', choice: '', note: '' });
      setShowPostMeeting(false);
      clearCache('Board-Votes');
      load();
    });
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
    }).then(function() {
      setTopicSaving(false);
      setShowAdd(false);
      setTopicForm({ title: '', description: '', attachment_url: '', submitted_by: '', due_date: '', meeting_date: '' });
      setAttachFileName(''); setAttachUploading(false);
      clearCache('Board Voting Items');
      load();
    });
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
        <button onClick={function() { setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Add Topic</button>
      </div>

      {items.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 40 }}>No voting items yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(function() {
          var openItems = items.filter(function(i) { return !isRevealed(i); });
          var closedItems = items.filter(function(i) { return isRevealed(i); });
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#777' }}>
                    {item.submitted_by ? <span>Submitted by {item.submitted_by}{item.due_date ? ' · ' : ''}</span> : null}
                    {item.due_date ? <span>Due {fmtDate(item.due_date)}</span> : null}
                    {item.meeting_date ? <span> · Meeting {fmtDate(item.meeting_date)}</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#777' }}>{iv.length}/{BOARD_MEMBERS.length} voted</span>
                  {revealed
                    ? <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 4 }}>Closed – Decision Made</span>
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
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: '#fff', zIndex: 1011, boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>← Back</button>
            <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '24px 28px', flex: 1 }}>
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
              <div style={{ marginBottom: 16 }}>
                <a href={selected.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: gold, textDecoration: 'none' }}>📎 View Attachment</a>
              </div>
            )}

            {isRevealed(selected) ? (
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 12 }}>Results</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
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
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 600, marginBottom: 12 }}>
                  Votes · {itemVotes(selected).length}/{BOARD_MEMBERS.length} submitted
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {BOARD_MEMBERS.map(function(m) {
                    var mv = itemVotes(selected).find(function(v) { return v.voter === m; });
                    return (
                      <div key={m} style={{ background: '#fafafa', borderRadius: 2, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a' }}>{m}</span>
                          {mv && <><span style={{ color: '#999' }}>—</span><span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>Voted</span></>}
                          {!mv && <span style={{ fontSize: 12, color: '#777' }}>No vote yet</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 20 }}>
                  {!showPostMeeting ? (
                    <button type="button" onClick={function() { setShowPostMeeting(true); setVoteForm({ voter: '', choice: '', note: '' }); }}
                      style={{ fontSize: 12, color: gold, background: 'none', border: '1px solid #e0d8cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}>
                      + Add Post-Meeting Votes
                    </button>
                  ) : (
                    <div style={{ background: '#fafafa', borderRadius: 2, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 12 }}>Add Post-Meeting Vote</div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={bLbl}>Board Member</label>
                        <select value={voteForm.voter} onChange={function(e) { setVoteForm(function(f) { return Object.assign({}, f, { voter: e.target.value, choice: '', note: '' }); }); }} style={Object.assign({}, bInp, { marginTop: 4 })}>
                          <option value="">Select member…</option>
                          {BOARD_MEMBERS.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {['Yes', 'No', 'Abstain', 'Not in attendance'].map(function(opt) {
                          var vc2 = VOTE_COLORS[opt];
                          var active = voteForm.choice === opt;
                          return (
                            <button key={opt} type="button" onClick={function() { setVoteForm(function(f) { return Object.assign({}, f, { choice: opt }); }); }}
                              style={{ padding: '6px 12px', borderRadius: 20, border: '1.5px solid ' + (active ? vc2.color : '#e0d8cc'), background: active ? vc2.bg : '#fff', color: active ? vc2.color : '#888', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <textarea value={voteForm.note} onChange={function(e) { setVoteForm(function(f) { return Object.assign({}, f, { note: e.target.value }); }); }} rows={2} style={Object.assign({}, bInp, { resize: 'vertical', marginBottom: 10 })} placeholder="Note (optional)…" />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleVoteSubmit} disabled={voteSaving || !voteForm.choice || !voteForm.voter}
                          style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (voteSaving || !voteForm.choice || !voteForm.voter) ? 0.6 : 1 }}>
                          {voteSaving ? 'Saving…' : 'Save Vote'}
                        </button>
                        <button type="button" onClick={function() { setShowPostMeeting(false); setVoteForm({ voter: '', choice: '', note: '' }); }}
                          style={{ padding: '8px 16px', background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div onClick={function() { setShowAdd(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
    setEditForm({ status: g.status || 'Not started', lead: g.lead || '', due_date: g.due_date || '' });
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
      {!activeCat ? (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            View progress across strategic goals at a glance. Click any progress line to see more details for that focus area.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {CATEGORY_ORDER.map(function(cat) { return CatBox(cat); })}
          </div>
        </div>
      ) : (
      <div style={{ background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{activeCat}</div>
          <button onClick={function() { setActiveCat(null); setEditing(null); }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '4px 8px' }}>← All areas</button>
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
                        {g.due_date && <div style={{ fontSize: 12, color: '#777' }}>Due: <span style={{ color: '#555' }}>{g.due_date}</span></div>}
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
                          <label style={{ fontSize: 12, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>Due Date</label>
                          <input type="date" value={editForm.due_date} onChange={function(e) { setEditForm(function(f) { return Object.assign({}, f, { due_date: e.target.value }); }); }}
                            style={{ padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12 }} />
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
            return <button key={t} onClick={function() { setTab(t); setEditing(null); }} style={tabStyle(t)}>{GOAL_TYPE_LABELS[t]}</button>;
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

function QuarterlyView({ navigateOp, quarterlyArea, navigateToQuarterly }) {
  var { useState, useEffect } = React;
  var isMobile = React.useContext(MobileCtx);
  var cq = currentQuarterStr();
  var cy = new Date().getFullYear();
  var [area, setArea] = useState(quarterlyArea || '');
  var [quarter, setQuarter] = useState(cq);
  var [year, setYear] = useState(cy);
  var [currentGoals, setCurrentGoals] = useState(null);
  var emptyForm = { what_went_well: '', goal_1_status: 'On Track', goal_1_summary: '', goal_2_status: 'On Track', goal_2_summary: '', goal_3_status: 'On Track', goal_3_summary: '', challenges: [], challenges_details: '', support_needed: [], support_details: '', other_notes: '', next_focus: '', goal_1: '', goal_2: '', goal_3: '' };
  var [form, setForm] = useState(emptyForm);
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);

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
            goal_3_summary: rows[0].goal_3_summary || ''
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

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    var nq = nextQ(quarter, year);
    var payload = { area: area, quarter: quarter, year: year, date_submitted: new Date().toISOString().slice(0,10), successes: form.what_went_well, goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary, challenges: form.challenges, challenges_details: form.challenges_details, support_needed: form.support_needed, support_details: form.support_details, other_notes: form.other_notes, next_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3 };
    var currentGoalsUpdate = currentGoals ? fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?id=eq.' + currentGoals.id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary })
    }) : Promise.resolve();
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function() {
      var goalsPayload = { area: area, quarter: nq.q, year: nq.yr, primary_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3 };
      return Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals'), {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(goalsPayload)
        }),
        currentGoalsUpdate
      ]);
    }).then(function() {
      clearCache('Op Quarter Goals');
      clearCache('Op Quarterly Updates');
      setSaving(false);
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
        </div>

        <button type="submit" disabled={saving || !area} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontSize: 14, fontWeight: 600, cursor: saving || !area ? 'not-allowed' : 'pointer', opacity: (saving || !area) ? 0.6 : 1, width: '100%', marginBottom: 8 }}>
          {saving ? 'Submitting...' : 'Submit Quarterly Update'}
        </button>
        {saved && <div style={{ textAlign: 'center', color: '#2e7d32', fontSize: 13, fontWeight: 600, padding: 8 }}>Submitted! Next quarter goals saved.</div>}
      </form>
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
  var [showBudget, setShowBudget] = useState(false);
  var [showVols, setShowVols] = useState(false);
  var [editLead, setEditLead] = useState(false);
  var [leadInput, setLeadInput] = useState('');
  var [showEarnings, setShowEarnings] = useState(false);
  var [earnings, setEarnings] = useState([]);
  var emptyEarningsForm = { event: '', earning_source: '', amount: '', notes: '', date: today };
  var [earningsForm, setEarningsForm] = useState(emptyEarningsForm);
  var [earningsSaving, setEarningsSaving] = useState(false);
  var today = new Date().toISOString().slice(0, 10);
  var [budgetForm, setBudgetForm] = useState({ type: 'Purchase', description: '', amount: '', date: today, needs_reimbursement: false });
  var [budgetSaving, setBudgetSaving] = useState(false);
  var [uploadingId, setUploadingId] = useState(null);
  var fileInputRef = React.useRef(null);
  var [budgetReceiptFile, setBudgetReceiptFile] = useState(null);
  var budgetReceiptRef = React.useRef(null);
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

  function addBudgetItem(e) {
    e.preventDefault();
    setBudgetSaving(true);
    var file = budgetReceiptFile;
    var payload = { area: area, type: budgetForm.type, description: budgetForm.description, amount: parseFloat(budgetForm.amount) || 0, date: budgetForm.date || null };
    if (budgetForm.needs_reimbursement) payload.needs_reimbursement = true;
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows.code) { setBudgetSaving(false); alert('Add failed: ' + (rows.message || rows.hint || rows.code)); return; }
      var newRow = rows && rows[0];
      if (!newRow) { setBudgetSaving(false); return; }
      if (!file) {
        clearCache('Op Budget');
        setBudgetSaving(false);
        setBudget(function(prev) { return [newRow].concat(prev); });
        setBudgetForm({ type: 'Purchase', description: '', amount: '', date: today, needs_reimbursement: false });
        setBudgetReceiptFile(null);
        return;
      }
      var ext = file.name.split('.').pop();
      var filename = area.toLowerCase().replace(/\s+/g, '-') + '-' + newRow.id + '-' + Date.now() + '.' + ext;
      fetch(SUPABASE_URL + '/storage/v1/object/receipts/' + filename, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type },
        body: file
      }).then(function() {
        var url = SUPABASE_URL + '/storage/v1/object/public/receipts/' + filename;
        return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + newRow.id, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt_url: url })
        }).then(function() {
          clearCache('Op Budget');
          setBudgetSaving(false);
          setBudget(function(prev) { return [Object.assign({}, newRow, { receipt_url: url })].concat(prev); });
          setBudgetForm({ type: 'Purchase', description: '', amount: '', date: today, needs_reimbursement: false });
          setBudgetReceiptFile(null);
          if (budgetReceiptRef.current) budgetReceiptRef.current.value = '';
        });
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

  function handleReceiptSelect(e) {
    var file = e.target.files[0];
    if (!file || !uploadingId) { e.target.value = ''; return; }
    var id = uploadingId;
    var ext = file.name.split('.').pop();
    var filename = area.toLowerCase().replace(/\s+/g, '-') + '-' + id + '-' + Date.now() + '.' + ext;
    fetch(SUPABASE_URL + '/storage/v1/object/receipts/' + filename, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type },
      body: file
    }).then(function() {
      var url = SUPABASE_URL + '/storage/v1/object/public/receipts/' + filename;
      return fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_url: url })
      }).then(function() {
        clearCache('Op Budget');
        setBudget(function(prev) { return prev.map(function(b) { return b.id === id ? Object.assign({}, b, { receipt_url: url }) : b; }); });
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
          var goalRows = [['goal_1','goal_1_status','goal_1_summary'],['goal_2','goal_2_status','goal_2_summary'],['goal_3','goal_3_status','goal_3_summary']];
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
                    {goalRows.map(function(keys, i) {
                      var g = quarterGoals[keys[0]]; if (!g) return null;
                      var st = quarterGoals[keys[1]];
                      var sc = st && stColors[st] ? stColors[st] : null;
                      return (
                        <div key={i} style={{ background: '#faf8f5', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e8e0d5' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#888', fontWeight: 600 }}>Goal {i+1}</span>
                              <div style={{ fontSize: 13, color: '#2a2a2a', marginTop: 2, lineHeight: 1.5 }}>{g}</div>
                            </div>
                            {sc && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0 }}>{st}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 14 }}>
                    <button onClick={function(e) { e.stopPropagation(); setCardFlipped(true); }} style={{ fontSize: 11, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>View Full Reflection →</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>No goals set for {cq} yet.</div>
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
                        {goalRows.map(function(keys, i) {
                          var g = quarterGoals[keys[0]]; if (!g) return null;
                          var st = quarterGoals[keys[1]];
                          var sm = quarterGoals[keys[2]];
                          var sc = st && stColors[st] ? stColors[st] : null;
                          return (
                            <div key={i} style={{ background: sc ? sc.bg : '#faf8f5', borderRadius: 8, padding: '8px 12px', border: '0.5px solid ' + (sc ? sc.color + '33' : '#e8e0d5') }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Goal {i+1} — <span style={{ color: '#555', fontWeight: 600 }}>{g}</span></div>
                                  {sm && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{sm}</div>}
                                </div>
                                {sc && <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#fff', color: sc.color, flexShrink: 0 }}>{st}</span>}
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
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 12 }}>Area Resources</div>
          {resources.length === 0
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
          <div onClick={function() { setShowSponsorForm(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
        <div onClick={function() { setShowBudget(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Receipt (optional)</div>
                  <div
                    onClick={function() { budgetReceiptRef.current && budgetReceiptRef.current.click(); }}
                    style={{ border: '0.5px dashed #e0d8cc', borderRadius: 7, padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: budgetReceiptFile ? '#2a2a2a' : '#bbb', background: '#fafaf8', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span>{budgetReceiptFile ? budgetReceiptFile.name : 'Attach image or PDF…'}</span>
                    {budgetReceiptFile && <span onClick={function(ev) { ev.stopPropagation(); setBudgetReceiptFile(null); if (budgetReceiptRef.current) budgetReceiptRef.current.value = ''; }} style={{ marginLeft: 'auto', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>×</span>}
                  </div>
                  <input ref={budgetReceiptRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={function(e) { setBudgetReceiptFile(e.target.files[0] || null); }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: budgetForm.needs_reimbursement ? '#b45309' : '#555' }}>
                    <input type="checkbox" checked={budgetForm.needs_reimbursement} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { needs_reimbursement: e.target.checked }); }); }} style={{ width: 15, height: 15, accentColor: gold, cursor: 'pointer' }} />
                    Needs reimbursement?
                    {budgetForm.needs_reimbursement && <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>Will appear in Financials</span>}
                  </label>
                </div>
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
              var isUploading = uploadingId === b.id;
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: b.type === 'Purchase' ? '#fef0e6' : '#eaf3ea', color: b.type === 'Purchase' ? '#c07040' : '#5a8a5a', flexShrink: 0 }}>{b.type}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#2a2a2a' }}>{b.description || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', flexShrink: 0 }}>{fmt(parseFloat(b.amount) || 0)}</span>
                  <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{b.date}</span>
                  {b.needs_reimbursement && <span title="Needs reimbursement" style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>$ Reimburse</span>}
                  {b.receipt_url ? (
                    <a href={b.receipt_url} target="_blank" title="View receipt" style={{ color: gold, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></a>
                  ) : (
                    <button onClick={function() { setUploadingId(b.id); fileInputRef.current.click(); }} disabled={isUploading} title="Attach receipt" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px 4px', flexShrink: 0, opacity: isUploading ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>{isUploading ? <span style={{ fontSize: 11 }}>…</span> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}</button>
                  )}
                  <button onClick={function() { deleteBudgetItem(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                </div>
              );
            })}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleReceiptSelect} />
          </div>
        </div>
      )}

      {showEarnings && (
        <div onClick={function() { setShowEarnings(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
                    <input value={earningsForm.event} onChange={function(e) { setEarningsForm(function(f) { return Object.assign({}, f, { event: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} placeholder="e.g. Spring Gala" />
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
                  <button onClick={function() { deleteEarningItem(e.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showVols && (
        <div onClick={function() { setShowVols(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setInkindSaving(false);
      if (Array.isArray(rows) && rows[0]) {
        setInkind(function(prev) { return [rows[0]].concat(prev); });
        setAllInKind(function(prev) { return prev.concat([rows[0]]); });
        clearCache('Sponsor In-Kind');
      }
      setInkindForm({ description: '', date: new Date().toISOString().slice(0,10), value: '' });
    }).catch(function() { setInkindSaving(false); });
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

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Sponsors" value={sponsors === null ? '...' : sponsors.length} />
        <StatCard label="Total In-Kind" value={allInKind.length === 0 && sponsors !== null ? '$0' : ('$' + allInKind.reduce(function(s,e){return s+(parseFloat(e.value)||0);},0).toLocaleString())} />
        <StatCard label="Tiered Sponsors" value={sponsors === null ? '...' : sponsors.filter(function(s){return getTier(sponsorInKindTotal(s.id));}).length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (selected && !isMobile) ? '240px 1fr' : '1fr', gap: 16 }}>
        <div>
          {sponsors === null && <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>}
          {sponsors !== null && sponsors.length === 0 && <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>No sponsors yet.</div>}
          {sponsors !== null && sponsors.map(function(s) {
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
                  {s['Fair Market Value'] && <div style={{ fontSize: 13, fontWeight: 600, color: gold }}>{s['Fair Market Value']}</div>}
                  {(function() {
                    var tier = getTier(sponsorInKindTotal(s.id));
                    return tier ? <span style={{ fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: '1px solid ' + tier.border, borderRadius: 20, padding: '1px 8px' }}>{tier.name}</span> : null;
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
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{selected['Business Name']}</div>
              <button onClick={function() { setSelected(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

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
    </div>
  );
}

function ReviewsView() {
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
    Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarter Goals') + '?quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*', { headers: headers }).then(function(r) { return r.json(); }),
      fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Quarterly Updates') + '?quarter=eq.' + encodeURIComponent(quarter) + '&year=eq.' + year + '&select=*&order=date_submitted.desc', { headers: headers }).then(function(r) { return r.json(); })
    ]).then(function(results) {
      var goals = Array.isArray(results[0]) ? results[0] : [];
      var updates = Array.isArray(results[1]) ? results[1] : [];
      var goalsMap = {};
      goals.forEach(function(g) { goalsMap[g.area] = g; });
      var updatesMap = {};
      updates.forEach(function(u) { if (!updatesMap[u.area]) updatesMap[u.area] = u; });

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

      var pages = OPERATIONAL_AREAS.map(function(area, idx) {
        var g = goalsMap[area] || {};
        var u = updatesMap[area];
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
        ['1','2','3'].forEach(function(n) {
          var gval = g['goal_' + n];
          var st = g['goal_' + n + '_status'];
          var sm = g['goal_' + n + '_summary'];
          html += label('Goal ' + n);
          html += '<div style="margin-bottom:4px">' + field(gval, 1) + '</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
          html += '<div>' + label('Status') + field(st, 1) + '</div>';
          html += '<div>' + label('Summary') + field(sm, 1) + '</div>';
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
          <button onClick={function() { setPrintQ('Q1'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: gold, background: 'none', border: '0.5px solid ' + gold, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 500 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Packet
          </button>
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
        <div onClick={function() { setPrintQ(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010 }}>
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
        <div onClick={function() { setActiveCell(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
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
  var { useState, useEffect } = React;

  // Reimbursements
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(true);
  var [markingId, setMarkingId] = useState(null);

  // Earnings (Creative Rentals)
  var RENTAL_NAMES = ['Yoga with Teena Bates', 'Mahjong Group', 'Donation Box', 'Book Sales', 'Other'];
  var PAYMENT_TYPES = ['Cash', 'Card', 'Check'];
  var emptyRentalForm = { name: 'Yoga with Teena Bates', custom_name: '', amount: '', date: new Date().toISOString().slice(0,10), payment_type: 'Cash' };
  var [rentals, setRentals] = useState([]);
  var [rentalsLoading, setRentalsLoading] = useState(true);
  var [rentalForm, setRentalForm] = useState(emptyRentalForm);
  var [rentalSaving, setRentalSaving] = useState(false);
  var [showRentalForm, setShowRentalForm] = useState(false);

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

  useEffect(function() { loadReimbursements(); loadRentals(); }, []);

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

  function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var reimTotal = items.reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
  var rentTotal = rentals.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
  var byArea = {};
  items.forEach(function(b) { var a = b.area || 'Unknown'; if (!byArea[a]) byArea[a] = []; byArea[a].push(b); });

  var inpSt = { width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

      {/* Reimbursements */}
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
        ) : Object.keys(byArea).sort().map(function(area) {
          var areaItems = byArea[area];
          var areaTotal = areaItems.reduce(function(s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
          return (
            <div key={area}>
              <div style={{ padding: '10px 18px', borderBottom: '0.5px solid #f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdfcfb' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>{area}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>{fmt(areaTotal)}</div>
              </div>
              {areaItems.map(function(b) {
                var isMarking = markingId === b.id;
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '0.5px solid #f9f6f2' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#2a2a2a' }}>{b.description || '—'}</div>
                      {b.volunteer_name && <div style={{ fontSize: 12, color: '#555', fontWeight: 500, marginTop: 2 }}>{b.volunteer_name}{b.volunteer_address ? ' · ' + b.volunteer_address : ''}</div>}
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
              })}
            </div>
          );
        })}
      </div>

      {/* Earnings */}
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

    </div>
  );
}

const views = {
  home: HomeView,
  events: EventsView,
  quarterly: QuarterlyView,
  volunteers: VolunteersView,
  donors: DonorsView,
  marketing: MarketingView,
  board: BoardView,
  sponsors: SponsorsView,
  strategy: StrategyView,
  operational: OperationalView,
  financials: FinancialsView,
  reviews: ReviewsView,
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
};function Dashboard() {
  const [active, setActive] = useState("home");
  const [opOpen, setOpOpen] = useState(false);
  const [opArea, setOpArea] = useState(null);
  const [quarterlyArea, setQuarterlyArea] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const View = views[active];
  const mod = modules.find(m => m.id === active);

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
              <button key={m.id} onClick={() => { setActive(m.id); setOpOpen(false); }} style={{
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
                <button key={area} onClick={function() { setOpArea(area); setActive("operational"); }}
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
            <button onClick={function() { setActive("financials"); }}
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
            <button onClick={function() { setActive("reviews"); }}
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
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile menu overlay */}
        {isMobile && mobileMenuOpen && (
          <div onClick={function() { setMobileMenuOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, background: '#2a2a2e', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <img src="assets/logo.png" alt="NSH" style={{ height: 32 }} />
                <button onClick={function() { setMobileMenuOpen(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <nav style={{ flex: 1, padding: '8px 8px' }}>
                {modules.filter(function(m) { return !m.hidden; }).map(function(m) {
                  return (
                    <button key={m.id} onClick={function() { setActive(m.id); setOpOpen(false); setMobileMenuOpen(false); }} style={{
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
                    <button key={area} onClick={function() { setOpArea(area); setActive('operational'); setMobileMenuOpen(false); }} style={{
                      display: 'block', width: '100%', padding: '9px 12px', background: opArea === area && active === 'operational' ? 'rgba(181,161,133,0.15)' : 'transparent',
                      border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                      color: opArea === area && active === 'operational' ? '#b5a185' : 'rgba(255,255,255,0.45)',
                      fontSize: 13, fontWeight: opArea === area && active === 'operational' ? 600 : 400, marginBottom: 2
                    }}>{area}</button>
                  );
                })}
                <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', margin: '8px 4px' }} />
                <button onClick={function() { setActive('financials'); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', background: active === 'financials' ? 'rgba(181,161,133,0.15)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: active === 'financials' ? '#b5a185' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: active === 'financials' ? 600 : 400, marginBottom: 2 }}>Financials</button>
                <button onClick={function() { setActive('reviews'); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '9px 12px', background: active === 'reviews' ? 'rgba(181,161,133,0.15)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: active === 'reviews' ? '#b5a185' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: active === 'reviews' ? 600 : 400, marginBottom: 2 }}>Reviews</button>
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
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 700, color: gold, fontFamily: "'Cardo', serif", textShadow: "1px 2px 0px rgba(136,108,68,0.2)" }}>{active === "financials" ? "Financials" : active === "reviews" ? "Reviews" : (mod && mod.label)}</h1>
            {active === "operational" && opArea && (
              <button onClick={function() { setQuarterlyArea(opArea); setActive("quarterly"); }} style={{ marginLeft: "auto", background: "transparent", color: gold, border: "1.5px solid " + gold, borderRadius: 9, padding: isMobile ? "7px 12px" : "9px 20px", fontSize: isMobile ? 11 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {isMobile ? "Quarterly ↗" : "Submit Quarterly Update"}
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, padding: isMobile ? "16px 14px" : "28px 32px", paddingBottom: isMobile ? 20 : undefined }}>
          <div style={{ maxWidth: 900 }}>
            <View navigate={setActive} opArea={opArea} navigateOp={function(a) { setOpArea(a); setActive('operational'); }} quarterlyArea={quarterlyArea} navigateToQuarterly={function(a) { setQuarterlyArea(a); setActive('quarterly'); }} />
          </div>
        </div>
      </div>
    </div>
    </MobileCtx.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(Dashboard));