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

const gold = "#886c44";
const cream = "#f8f4ec";

const modules = [
  { id: "home", label: "Overview", icon: "⌂" },
  { id: "events", label: "Events & Bookings", icon: "◈" },
  { id: "volunteers", label: "Volunteers", icon: "◎" },
  { id: "donors", label: "Donors & Donations", icon: "◇" },
  { id: "marketing", label: "Marketing / Content", icon: "◰" },
  { id: "board", label: "Board Activity", icon: "◑" },
  { id: "strategy", label: "Strategic Plan", icon: "◈" },
];

const mockData = {
  events: [
    { name: "Spring Garden Tour", date: "Apr 12", status: "Confirmed", revenue: "$1,200", guests: 45 },
    { name: "Founder’s Gala", date: "May 3", status: "Pending", revenue: "$4,800", guests: 120 },
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
    <span style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#2a2a2a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
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
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
};function HomeView() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: gold, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Today — March 20, 2026</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: "#2a2a2a" }}>Good morning, North Star House</h2>
        <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>Here’s your organization at a glance.</p>
      </div>

      <div style={{ background: "#fff4e5", border: "0.5px solid #e0c98a", borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 16, color: gold }}>⏎</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#8a6200" }}>Quarterly Update Due — March 31, 2026</div>
          <div style={{ fontSize: 12, color: "#b08040", marginTop: 2 }}>Donations · Volunteers · Sponsors · Events · Board Activity</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: "#c0392b", background: "#fce4e4", padding: "3px 10px", borderRadius: 20 }}>11 days away</div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="YTD Donations" value="$18,000" sub="of $25K goal" />
        <StatCard label="Active Volunteers" value="4" sub="of 5 total" />
        <StatCard label="2026 Events" value="5" sub="on the books" />
        <StatCard label="Active Sponsors" value="3" sub="+ 1 in review" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 }}>This Week at North Star House</div>
          {thisWeek.map((e, i) => {
            const tc = typeColors[e.type] || { bg: "#f3f3f3", color: "#555" };
            return (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ minWidth: 6, height: 6, borderRadius: "50%", background: tc.color, marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2a2a2a" }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{e.day} · {e.time}</div>
                </div>
                <span style={{ fontSize: 11, background: tc.bg, color: tc.color, padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap", fontWeight: 500 }}>{e.type}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0ebe2", fontSize: 11, color: "#bbb" }}>
            Synced from Google Calendar
          </div>
        </div>

        <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 }}>In-House Events</div>
          {mockData.events.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{e.date}</div>
              </div>
              <Badge status={e.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}function EventsView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
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
        {selected.length === 0 && <span style={{ fontSize: 13, color: '#bbb' }}>Select teams...</span>}
        {selected.map(function(t) {
          return (
            <span key={t} style={{ background: (TEAM_COLORS[t] || { bg: '#f3f3f3' }).bg, color: (TEAM_COLORS[t] || { color: '#555' }).color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {t}
              <span
                onClick={function(e) { e.stopPropagation(); remove(t); }}
                style={{ cursor: 'pointer', opacity: 0.6, fontSize: 14, lineHeight: 1, marginLeft: 2 }}
              >×</span>
            </span>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4, padding: '6px 0', maxHeight: 220, overflowY: 'auto' }}>
          {TEAM_OPTIONS.map(function(opt) {
            var isOn = selected.indexOf(opt) !== -1;
            return (
              <div
                key={opt}
                onClick={function() { toggle(opt); }}
                style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOn ? (TEAM_COLORS[opt] || { bg: '#f3f3f3' }).bg : '#fff', color: isOn ? (TEAM_COLORS[opt] || { color: '#555' }).color : '#2a2a2a' }}
                onMouseEnter={function(e) { if (!isOn) e.currentTarget.style.background = '#faf8f4'; }}
                onMouseLeave={function(e) { if (!isOn) e.currentTarget.style.background = '#fff'; }}
              >
                {opt}
                {isOn && <span style={{ color: gold, fontSize: 14, fontWeight: 600 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

var volInputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
var volLabelStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
var volGrp = { marginBottom: 14 };
var volSecLabel = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#bbb', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="CC" checked={form['CC']} onChange={onChange} /> CC</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Nametag" checked={form['Nametag']} onChange={onChange} /> Nametag</label>
          </div>
          <div style={volGrp}><label style={volLabelStyle}>Picture URL (Google Drive)</label><input name="Picture URL" value={form['Picture URL']} onChange={onChange} style={volInputStyle} placeholder="https://drive.google.com/..." /></div>
          <span style={volSecLabel}>Notes</span>
          <div style={volGrp}><label style={volLabelStyle}>Overview Notes</label><textarea name="Overview Notes" value={form['Overview Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Background Notes</label><textarea name="Background Notes" value={form['Background Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={volGrp}><label style={volLabelStyle}>Notes</label><textarea name="Notes" value={form['Notes']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <span style={volSecLabel}>Goals</span>
          <div style={volGrp}><label style={volLabelStyle}>What they want to see at NSH</label><textarea name="What they want to see at NSH" value={form['What they want to see at NSH']} onChange={onChange} rows={3} style={Object.assign({}, volInputStyle, { resize: 'vertical' })} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
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
        <div style={{ width: 110, fontSize: 12, color: '#aaa', flexShrink: 0, paddingTop: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#2a2a2a', flex: 1, lineHeight: 1.4 }}>
          {link ? <a href={link} style={{ color: gold, textDecoration: 'none' }}>{value}</a> : value}
        </div>
      </div>
    );
  }

  function NoteBlock({ label, value }) {
    if (!value) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        {label && <div style={{ fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>}
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.65, background: '#faf8f4', borderRadius: 8, padding: '10px 14px' }}>{value}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Total Volunteers" value={loading ? '...' : volunteers.length} />
        <StatCard label="Active" value={loading ? '...' : active} />
        <StatCard label="Teams" value={loading ? '...' : teams} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, background: '#f0ebe3', borderRadius: 10, padding: 3 }}>
          <button
            onClick={function() { setTab('active'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 13, fontWeight: tab === 'active' ? 600 : 400, cursor: 'pointer', background: tab === 'active' ? '#fff' : 'transparent', color: tab === 'active' ? '#2a2a2a' : '#999', boxShadow: tab === 'active' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >Active <span style={{ fontSize: 11, color: tab === 'active' ? gold : '#bbb', fontWeight: 500 }}>{active}</span></button>
          <button
            onClick={function() { setTab('inactive'); setFilterTeam('All'); }}
            style={{ border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 13, fontWeight: tab === 'inactive' ? 600 : 400, cursor: 'pointer', background: tab === 'inactive' ? '#fff' : 'transparent', color: tab === 'inactive' ? '#2a2a2a' : '#999', boxShadow: tab === 'inactive' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}
          >Inactive <span style={{ fontSize: 11, color: tab === 'inactive' ? gold : '#bbb', fontWeight: 500 }}>{inactive}</span></button>
        </div>
        <button onClick={function() { setForm(emptyForm); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add Volunteer</button>
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
                  borderRadius: 20,
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

      {error && <div style={{ background: '#fce4e4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#c0392b' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 13 }}>Loading volunteers...</div>
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
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a', marginBottom: 3, lineHeight: 1.3 }}>{v['First Name']} {v['Last Name']}</div>
                {v['Team'] && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(v['Team'] || '').split('|')[0].trim()}</div>}
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
              <button onClick={function() { setSelected(null); }} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'transparent', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#999', fontWeight: 500 }}>Close</button>
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
        if (Array.isArray(data)) setDonations(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      })
      .catch(function(err) { setError(err.message); setLoading(false); });
  }, []);

  function parseAmount(val) {
    return parseFloat((val || '0').replace(/[^d.]/g, '') || 0);
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

  var iStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', background: '#fff' };
  var lStyle = { fontSize: 12, color: '#666', fontWeight: 500 };
  var grp = { marginBottom: 14 };
  var sec = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: '#bbb', fontWeight: 600, marginBottom: 10, marginTop: 20, display: 'block' };

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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Total Raised" value={loading ? '...' : '$' + totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sub="2026 YTD" />
        <StatCard label="Donations" value={loading ? '...' : totalDonors} />
        <StatCard label="Memberships" value={loading ? '...' : memberships} />
        <StatCard label="Need Thank You" value={loading ? '...' : unacknowledged} sub={unacknowledged > 0 ? 'pending' : 'all clear'} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{loading ? 'Loading...' : totalDonors + ' donation' + (totalDonors !== 1 ? 's' : '')}</div>
        <button onClick={function() { setForm(emptyDonForm); setShowAdd(true); }} style={{ background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add Donation</button>
      </div>

      {error && <div style={{ background: '#fce4e4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#c0392b' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 13 }}>Loading donations...</div>
      ) : (
        <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, padding: '8px 16px', borderBottom: '0.5px solid #e8e0d4', background: '#faf8f4' }}>
            {['Donor', 'Type', 'Amount', 'Date'].map(function(h) {
              return <div key={h} style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>;
            })}
          </div>
          {donations.map(function(d, i) {
            var tc = typeColors[d['Donation Type']] || { bg: '#f3f3f3', color: '#555' };
            var acked = d['Acknowledged'] === true || String(d['Acknowledged']).toUpperCase() === 'TRUE';
            return (
              <div
                key={i}
                onClick={function() { setSelected(d); }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#faf8f4'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, padding: '11px 16px', borderBottom: i < donations.length - 1 ? '0.5px solid #f0ebe2' : 'none', cursor: 'pointer', background: '#fff', alignItems: 'center', transition: 'background 0.12s' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}>{d['Donor Name']}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{d['Account Type']}</div>
                </div>
                <div>
                  <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{d['Donation Type']}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{fmtAmount(d['Amount'])}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{fmtDate(d['Close Date'])}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: acked ? '#e8f5e9' : '#fff8e1', color: acked ? '#2e7d32' : '#8a6200' }}>{acked ? 'Thanked' : 'Pending'}</span>
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
                {(function() { var tc = typeColors[selected['Donation Type']] || { bg: '#f3f3f3', color: '#555' }; return <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>{selected['Donation Type']}</span>; })()}
                <span style={{ fontSize: 20, fontWeight: 700, color: gold }}>{fmtAmount(selected['Amount'])}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>{fmtDate(selected['Close Date'])}</span>
              </div>
              <button onClick={function() { setSelected(null); }} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '20px 28px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <div>
                  <span style={sec}>Donor Info</span>
                  {selected['Informal Names'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Goes by</span>{selected['Informal Names']}</div>}
                  {selected['Account Type'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Type</span>{selected['Account Type']}</div>}
                  {selected['Email'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Email</span><a href={'mailto:' + selected['Email']} style={{ color: gold, textDecoration: 'none' }}>{selected['Email']}</a></div>}
                  {selected['Phone Number'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Phone</span>{selected['Phone Number']}</div>}
                  {selected['Address'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Address</span><span style={{ whiteSpace: 'pre-line' }}>{selected['Address']}</span></div>}
                  <span style={sec}>Payment</span>
                  {selected['Payment Type'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Method</span>{selected['Payment Type']}</div>}
                  {selected['Benefits'] && <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: '#aaa', marginRight: 8 }}>Benefits</span>{selected['Benefits']}</div>}
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: '#aaa', marginRight: 8 }}>Acknowledged</span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: (selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? '#e8f5e9' : '#fff8e1', color: (selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? '#2e7d32' : '#8a6200' }}>
                      {(selected['Acknowledged'] === true || String(selected['Acknowledged']).toUpperCase() === 'TRUE') ? 'Thanked' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div>
                  {selected['Donation Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Donation Notes</span><div style={{ fontSize: 13, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Donation Notes']}</div></div>}
                  {selected['Donor Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Donor Notes</span><div style={{ fontSize: 13, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Donor Notes']}</div></div>}
                  {selected['Notes'] && <div style={{ marginBottom: 12 }}><span style={sec}>Notes</span><div style={{ fontSize: 13, background: '#faf8f4', borderRadius: 8, padding: '10px 14px', color: '#444', lineHeight: 1.6 }}>{selected['Notes']}</div></div>}
                </div>
              </div>
              <button onClick={function() { setSelected(null); }} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'transparent', border: '0.5px solid #e0d8cc', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#999', fontWeight: 500 }}>Close</button>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Acknowledged" checked={form['Acknowledged']} onChange={handleDonFormChange} /> Acknowledged / Thanked</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}><input type="checkbox" name="Salesforce" checked={form['Salesforce']} onChange={handleDonFormChange} /> In Salesforce</label>
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
                <button type="submit" disabled={saving} style={{ flex: 1, background: gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Donation'}</button>
                <button type="button" onClick={function() { setShowAdd(false); }} style={{ flex: 1, padding: 10, background: '#f5f0ea', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
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
}function BoardView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Board Members" value="5" />
        <StatCard label="Active" value="5" />
        <StatCard label="Avg Attendance" value="83%" />
        <StatCard label="Next Meeting" value="Apr 9" />
      </div>
      <Table
        cols={["Member", "Role", "Attendance", "Last Vote", "Status"]}
        rows={mockData.board}
        renderRow={r => (<><Td>{r.member}</Td><Td muted>{r.role}</Td><Td>{r.attendance}</Td><Td muted>{r.lastVote}</Td><Td><Badge status={r.status} /></Td></>)}
      />
    </div>
  );
}

function StrategyView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Strategic Goals" value="5" />
        <StatCard label="Avg Progress" value="64%" />
        <StatCard label="On Track" value="3" />
        <StatCard label="Needs Attention" value="2" />
      </div>
      <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {mockData.strategy.map((s, i) => (
          <div key={i} style={{ borderBottom: i < mockData.strategy.length - 1 ? "0.5px solid #f0ebe2" : "none", paddingBottom: i < mockData.strategy.length - 1 ? 14 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 12, color: gold, fontWeight: 500, marginBottom: 2 }}>{s.pillar}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.goal}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 60 }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: s.progress >= 70 ? "#2e7d32" : s.progress >= 40 ? "#8a6200" : "#c62828" }}>{s.progress}%</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>complete</div>
              </div>
            </div>
            <ProgressBar pct={s.progress} color={s.progress >= 70 ? "#4caf50" : s.progress >= 40 ? gold : "#e57373"} />
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#aaa" }}>Owner: <span style={{ color: "#555" }}>{s.owner}</span></div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Due: <span style={{ color: "#555" }}>{s.due}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const views = {
  home: HomeView,
  events: EventsView,
  volunteers: VolunteersView,
  donors: DonorsView,
  marketing: MarketingView,
  board: BoardView,
  strategy: StrategyView,
};function Dashboard() {
  const [active, setActive] = useState("home");
  const View = views[active];
  const mod = modules.find(m => m.id === active);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: cream, fontFamily: "system-ui, sans-serif" }}>
      <style>{".nsh-sidebar::-webkit-scrollbar { display: none; }"}</style>
      <div className="nsh-sidebar" style={{ width: 220, background: "#2a2420", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ padding: "24px 20px 16px" }}>
          <div style={{ fontSize: 11, color: gold, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>North Star House</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Command Center</div>
        </div>
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "0 0 8px" }} />
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {modules.map(m => (
            <button key={m.id} onClick={() => setActive(m.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
              background: active === m.id ? "rgba(136,108,68,0.18)" : "transparent",
              border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left",
              color: active === m.id ? gold : "rgba(255,255,255,0.5)",
              fontSize: 13, fontWeight: active === m.id ? 500 : 400,
              marginBottom: 2, transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 14, opacity: 0.8 }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 20px 20px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Connected to Airtable</div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", display: "inline-block", marginRight: 5, marginTop: 6 }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Live sync</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#2a2a2a" }}>{mod && mod.label}</h1>
            <div style={{ height: 2, width: 32, background: gold, borderRadius: 2, marginTop: 6 }} />
          </div>
          <View />
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(Dashboard));