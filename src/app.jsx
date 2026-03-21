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

const CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";

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

var NAV_ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  quarterly: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>',
  volunteers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  donors: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  board: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  strategy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
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
  { id: "donors", label: "Donors & Donations" },
  { id: "board", label: "Board Voting" },
  { id: "strategy", label: "Strategic Goal Progress" },
  { id: "operational", label: "Operational Areas", hidden: true },
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
  useEffect(function() {
    sbFetch('2026 Donations', ['Amount']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      var total = rows.reduce(function(s, r) {
        return s + parseFloat((r['Amount'] || '0').replace(/[^\d.]/g, '') || 0);
      }, 0);
      setDonationTotal(total);
    });
    sbFetch('2026 Volunteers', ['Status']).then(function(rows) {
      if (!Array.isArray(rows)) return;
      setActiveVols(rows.filter(function(r) { return r['Status'] === 'Active'; }).length);
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
        var due = new Date('2026-03-31');
        var now = new Date(); now.setHours(0,0,0,0);
        var days = Math.round((due - now) / 86400000);
        var dueStr = due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        var label = days === 0 ? 'Due today' : days < 0 ? Math.abs(days) + ' days overdue' : days + ' days away';
        var labelColor = '#c0392b';
        var labelBg = '#fce4e4';
        return (
          <div style={{ background: "#fff4e5", border: "0.5px solid #e0c98a", borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 16, color: gold }}>⏎</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#8a6200" }}>Quarterly Update Due — {dueStr}</div>
            <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: labelColor, background: labelBg, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>{label}</div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div onClick={function() { navigate('donors'); }} style={{ cursor: 'pointer' }}><StatCard label="Donations" value={donationTotal === null ? '...' : '$' + donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></div>
        <div onClick={function() { navigate('volunteers'); }} style={{ cursor: 'pointer' }}><StatCard label="Active Volunteers" value={activeVols === null ? '...' : activeVols} /></div>
        <StatCard label="2026 Events" value="5" sub="on the books" />
        <StatCard label="Active Sponsors" value="3" sub="+ 1 in review" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Happening Soon at North Star House
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
  'Support List':      { bg: '#f0f4f8', color: '#3a5068' },
  'Venue':             { bg: '#ede7f6', color: '#4527a0' },
};
var TEAM_OPTIONS = Object.keys(TEAM_COLORS);

function TeamPicker({ value, onChange }) {
  const { useState: useS } = React;
  const [open, setOpen] = useS(false);
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4, padding: '6px 0', maxHeight: 220, overflowY: 'auto' }}>
          {TEAM_OPTIONS.map(function(opt) {
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
      )}
    </div>
  );
}

var volInputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
var volLabelStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
var volGrp = { marginBottom: 14 };
var volSecLabel = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#999', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

function VolForm({ form, onChange, saving, onSubmit, title, onCancel }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
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
          </div>
        </form>
      </div>
    </div>
  );
}

function VolunteersView() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState('All');
  const [tab, setTab] = useState('active');

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
    sbFetch('2026 Volunteers', ['First Name','Last Name','Team','Status','Email','Phone Number','Address','Birthday','Volunteer Anniversary','CC','Nametag','Overview Notes','Background Notes','Notes','What they want to see at NSH','Picture URL','Emergency Contact','Month','Day'])
      .then(function(data) {
        if (Array.isArray(data)) setVolunteers(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
  }, []);

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
    if (t === 'Staff') return '2';
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
      var inserted = Array.isArray(res) ? res[0] : res;
      if (inserted && inserted['First Name']) setVolunteers(function(p) { return p.concat([inserted]); });
      setShowAdd(false);
      setForm(emptyForm);
    }).catch(function() { setSaving(false); });
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
        {label && <div style={{ fontSize: 12, color: '#999', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>}
        <div style={{ fontSize: 12, color: '#444', lineHeight: 1.65, background: '#faf8f4', borderRadius: 8, padding: '10px 14px' }}>{value}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Volunteers" value={loading ? '...' : volunteers.length} />
        <StatCard label="Active" value={loading ? '...' : active} />
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
        />
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
    sbFetch('2026 Donations', ['Donor Name','Last Name','Informal Names','Amount','Close Date','Donation Type','Payment Type','Account Type','Acknowledged','Salesforce','Email','Phone Number','Address','Benefits','Donation Notes','Donor Notes','Notes'])
      .then(function(data) {
        if (Array.isArray(data)) setDonations(data.sort(function(a, b) { return new Date(b['Close Date']) - new Date(a['Close Date']); }));
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
  }, []);

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
      var inserted = Array.isArray(res) ? res[0] : res;
      if (inserted && inserted['Donor Name']) setDonations(function(p) { return p.concat([inserted]); });
      setShowAdd(false);
      setForm(emptyDonForm);
    }).catch(function() { setSaving(false); });
  }

  var iStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
  var lStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
  var grp = { marginBottom: 14 };
  var sec = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#999', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

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
        <StatCard label="Need Thank You" value={loading ? '...' : unacknowledged} sub={unacknowledged > 0 ? 'pending' : 'all clear'} />
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
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a' }}>{d['Donor Name']}</div>
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
              <button onClick={function() { setSelected(null); }} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'transparent', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#999', fontWeight: 500 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div onClick={function() { setShowAdd(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
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
var VOTE_COLORS = { 'Yes': { bg: '#e8f5e9', color: '#2e7d32' }, 'No': { bg: '#ffebee', color: '#c62828' }, 'Abstain': { bg: '#fff3e0', color: '#e65100' }, 'Not in attendance': { bg: '#f5f5f5', color: '#888' } };

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
      sbFetchAll('Board Voting Items'),
      sbFetchAll('Board-Votes')
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
        <div style={{ fontSize: 12, color: '#888' }}>{items.length} topic{items.length !== 1 ? 's' : ''}</div>
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
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Closed</span>
                  <div style={{ flex: 1, height: '0.5px', background: '#e0d8cc' }} />
                </div>
              )}
            <div
              key={item.id}
              onClick={function() { setSelected(item); setVoteForm({ voter: '', choice: '', note: '' }); }}
              style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 4, padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
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
                  {[['Yes', t.yes, '#2e7d32'], ['No', t.no, '#c62828'], ['Abstain', t.abstain, '#e65100']].map(function(entry) {
                    return <div key={entry[0]} style={{ fontSize: 12 }}><span style={{ color: entry[2], fontWeight: 600 }}>{entry[1]}</span><span style={{ color: '#777' }}> {entry[0]}</span></div>;
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
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#999', fontWeight: 600, marginBottom: 12 }}>Results</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {(function() {
                    var t = tally(selected);
                    return [
                      { label: 'Yes', count: t.yes, bg: '#e8f5e9', border: '#a5d6a7', color: '#2e7d32' },
                      { label: 'No', count: t.no, bg: '#ffebee', border: '#ef9a9a', color: '#c62828' },
                      { label: 'Abstain / Not in Attendance', count: t.abstain + t.absent, bg: '#f5f5f5', border: '#e0e0e0', color: '#888' },
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
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#999', fontWeight: 600, marginBottom: 10 }}>Individual Votes</div>
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
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#999', fontWeight: 600, marginBottom: 12 }}>
                  Votes · {itemVotes(selected).length}/{BOARD_MEMBERS.length} submitted
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {BOARD_MEMBERS.map(function(m) {
                    var mv = itemVotes(selected).find(function(v) { return v.voter === m; });
                    var vc = mv ? (VOTE_COLORS[mv.choice] || { bg: '#f5f5f5', color: '#888' }) : null;
                    return (
                      <div key={m} style={{ background: '#fafafa', borderRadius: 2, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: mv ? '#aaa' : '#2a2a2a' }}>{m}</span>
                          {mv && <><span style={{ color: '#999' }}>—</span><span style={{ background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{mv.choice}</span></>}
                          {mv && mv.changed_in_meeting && <span style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>Changed in meeting</span>}
                          {!mv && <span style={{ fontSize: 12, color: '#777' }}>No vote yet</span>}
                        </div>
                        {mv && mv.note && <div style={{ fontSize: 12, color: '#777', marginTop: 4, fontStyle: 'italic' }}>{mv.note}</div>}
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
  const [goals, setGoals] = useS([]);
  const [loading, setLoading] = useS(true);
  const [tab, setTab] = useS('annual');
  const [editing, setEditing] = useS(null);
  const [editForm, setEditForm] = useS({});
  const [saving, setSaving] = useS(false);

  function load() {
    var url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Strategic Goals') + '?select=*&order=category,id';
    fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(d) { setGoals(Array.isArray(d) ? d : []); setLoading(false); });
  }
  useE(function() { load(); }, []);

  var filtered = goals.filter(function(g) { return g.goal_type === tab; });
  var annualGoals = goals.filter(function(g) { return g.goal_type === 'annual'; });
  var countNotStarted = goals.filter(function(g) { return g.goal_type !== 'three_year_vision' && (!g.status || g.status === 'Not started'); }).length;
  var countInProgress = goals.filter(function(g) { return g.goal_type !== 'three_year_vision' && (g.status === 'In progress' || g.status === 'On track'); }).length;
  var countComplete = goals.filter(function(g) { return g.goal_type !== 'three_year_vision' && g.status === 'Complete'; }).length;

  function openEdit(g) {
    setEditing(g.id);
    setEditForm({ status: g.status || 'Not started', lead: g.lead || '', due_date: g.due_date || '' });
  }

  function handleSave(g) {
    setSaving(true);
    sbPatchById('Strategic Goals', g.id, editForm).then(function() {
      setSaving(false);
      setEditing(null);
      load();
    });
  }

  var tabStyle = function(t) {
    return { padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 5, cursor: 'pointer',
      background: tab === t ? gold : '#f0ebe2', color: tab === t ? '#fff' : '#666' };
  };

  if (loading) return <div style={{ padding: 40, color: '#777', fontSize: 12 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Not Started" value={countNotStarted} />
        <StatCard label="In Progress" value={countInProgress} />
        <StatCard label="Completed" value={countComplete} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['annual', 'future', 'three_year_vision'].map(function(t) {
          return <button key={t} onClick={function() { setTab(t); }} style={tabStyle(t)}>{GOAL_TYPE_LABELS[t]}</button>;
        })}
      </div>

      {CATEGORY_ORDER.map(function(cat) {
        var catGoals = filtered.filter(function(g) { return g.category === cat; });
        if (catGoals.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.4, color: gold, fontWeight: 700, marginBottom: 10 }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {catGoals.map(function(g) {
                var sc = GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS['Not started'];
                var isEdit = editing === g.id;
                return (
                  <div key={g.id} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{g.title}</div>
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
          </div>
        );
      })}
    </div>
  );
}

function QuarterlyView() {
  return (
    <div style={{ color: '#777', fontSize: 12, padding: '40px 0' }}>
      Quarterly update coming soon.
    </div>
  );
}

function OperationalView({ opArea }) {
  var { useState, useEffect } = React;
  var area = opArea || OPERATIONAL_AREAS[0];
  var [areaInfo, setAreaInfo] = useState(null);
  var [budget, setBudget] = useState([]);
  var [vols, setVols] = useState([]);
  var [showBudget, setShowBudget] = useState(false);
  var [showVols, setShowVols] = useState(false);
  var [editLead, setEditLead] = useState(false);
  var [leadInput, setLeadInput] = useState('');
  var today = new Date().toISOString().slice(0, 10);
  var [budgetForm, setBudgetForm] = useState({ type: 'Purchase', description: '', amount: '', date: today });
  var [budgetSaving, setBudgetSaving] = useState(false);
  var [noteEdit, setNoteEdit] = useState(null);
  var [noteVal, setNoteVal] = useState('');
  var [noteSaving, setNoteSaving] = useState(null);

  useEffect(function() {
    setAreaInfo(null);
    setBudget([]);
    setVols([]);
    setEditLead(false);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Operational Areas') + '?area=eq.' + encodeURIComponent(area) + '&select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (rows && rows[0]) { setAreaInfo(rows[0]); setLeadInput(rows[0].lead || ''); }
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?area=eq.' + encodeURIComponent(area) + '&select=*&order=date.desc,id.desc', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (Array.isArray(rows)) setBudget(rows);
    });
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?select=' + encodeURIComponent('id,First Name,Last Name,Team,Notes,Overview Notes,Status'), {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function(r) { return r.json(); }).then(function(rows) {
      if (!Array.isArray(rows)) return;
      setVols(rows.filter(function(v) {
        if (!v.Team) return false;
        return v.Team.split(',').map(function(t) { return t.trim(); }).indexOf(area) !== -1;
      }));
    });
  }, [area]);

  function saveLead() {
    if (!areaInfo) return;
    sbPatchById('Operational Areas', areaInfo.id, { lead: leadInput }).then(function() {
      setAreaInfo(Object.assign({}, areaInfo, { lead: leadInput }));
      setEditLead(false);
    });
  }

  function addBudgetItem(e) {
    e.preventDefault();
    setBudgetSaving(true);
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget'), {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ area: area, type: budgetForm.type, description: budgetForm.description, amount: parseFloat(budgetForm.amount) || 0, date: budgetForm.date || null })
    }).then(function(r) { return r.json(); }).then(function(rows) {
      setBudgetSaving(false);
      if (rows && rows[0]) setBudget(function(prev) { return [rows[0]].concat(prev); });
      setBudgetForm({ type: 'Purchase', description: '', amount: '', date: today });
    });
  }

  function deleteBudgetItem(id) {
    fetch(SUPABASE_URL + '/rest/v1/' + encodeURIComponent('Op Budget') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(function() {
      setBudget(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    });
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
  function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  var cardHover = { cursor: 'pointer', background: '#faf8f5', border: '0.5px solid #e8e0d5', borderRadius: 10, padding: '16px 20px', flex: 1, minWidth: 150 };

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, padding: '22px 26px', border: '0.5px solid #e8e0d5', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#bbb', fontWeight: 600, marginBottom: 6 }}>Operational Area</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{area}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#bbb', fontWeight: 600, marginBottom: 6 }}>Lead</div>
            {editLead ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={leadInput} onChange={function(e) { setLeadInput(e.target.value); }} autoFocus style={{ fontSize: 14, padding: '5px 8px', border: '0.5px solid #e0d8cc', borderRadius: 6, width: 150 }} />
                <button onClick={saveLead} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Save</button>
                <button onClick={function() { setEditLead(false); }} style={{ background: '#f0ece6', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, color: '#2a2a2a', fontWeight: 500 }}>{areaInfo && areaInfo.lead ? areaInfo.lead : <span style={{ color: '#ccc', fontStyle: 'italic' }}>Not set</span>}</span>
                <button onClick={function() { setEditLead(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#bbb', padding: '2px 6px', borderRadius: 4 }}>Edit</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div onClick={function() { setShowBudget(true); }} style={cardHover}
            onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#bbb', fontWeight: 600, marginBottom: 8 }}>Budget</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: gold }}>{fmt(totalPurchases + totalInKind)}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{fmt(totalPurchases)} purchases · {fmt(totalInKind)} in-kind</div>
            <div style={{ fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 }}>View / Add entries →</div>
          </div>
          <div onClick={function() { setShowVols(true); }} style={cardHover}
            onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#bbb', fontWeight: 600, marginBottom: 8 }}>Volunteers</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a' }}>{vols.length}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>assigned to {area}</div>
            <div style={{ fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 }}>View / Add notes →</div>
          </div>
        </div>
      </div>

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
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#bbb', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{fmt(s.val)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#bbb', fontWeight: 600, marginBottom: 12 }}>Add Entry</div>
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                    <input type="date" value={budgetForm.date} onChange={function(e) { setBudgetForm(function(f) { return Object.assign({}, f, { date: e.target.value }); }); }} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0d8cc', borderRadius: 7, fontSize: 13 }} />
                  </div>
                  <button type="submit" disabled={budgetSaving} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: budgetSaving ? 0.7 : 1 }}>Add</button>
                </div>
              </form>
            </div>
            {budget.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No entries yet.</div>
            ) : budget.map(function(b) {
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0ece6' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: b.type === 'Purchase' ? '#fef0e6' : '#eaf3ea', color: b.type === 'Purchase' ? '#c07040' : '#5a8a5a', flexShrink: 0 }}>{b.type}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#2a2a2a' }}>{b.description || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', flexShrink: 0 }}>{fmt(parseFloat(b.amount) || 0)}</span>
                  <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{b.date}</span>
                  <button onClick={function() { deleteBudgetItem(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>x</button>
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{v['First Name']} {v['Last Name']}</span>
                    {v['Overview Notes'] && <><span style={{ color: '#ccc' }}>—</span><span style={{ fontSize: 13, color: '#777' }}>{v['Overview Notes']}</span></>}
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

const views = {
  home: HomeView,
  events: EventsView,
  quarterly: QuarterlyView,
  volunteers: VolunteersView,
  donors: DonorsView,
  marketing: MarketingView,
  board: BoardView,
  strategy: StrategyView,
  operational: OperationalView,
};

var OPERATIONAL_AREAS = ['Construction','Grounds','Interiors','Docents','Fundraising','Events','Marketing','Venue'];function Dashboard() {
  const [active, setActive] = useState("home");
  const [opOpen, setOpOpen] = useState(false);
  const [opArea, setOpArea] = useState(null);
  const View = views[active];
  const mod = modules.find(m => m.id === active);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: cream, fontFamily: "system-ui, sans-serif" }}>
      <style>{".nsh-sidebar::-webkit-scrollbar { display: none; }"}</style>
      <div style={{ display: "flex", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
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
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: gold, fontFamily: "'Cardo', serif", textShadow: "1px 2px 0px rgba(136,108,68,0.2)" }}>{mod && mod.label}</h1>
            <div style={{ height: 2, width: 32, background: gold, borderRadius: 2, marginTop: 10, opacity: 0.65 }} />
          </div>
          <View navigate={setActive} opArea={opArea} />
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(Dashboard));