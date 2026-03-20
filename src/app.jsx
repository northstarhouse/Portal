const { useState } = React;

const gold = "#886c44";
const cream = "#f8f4ec";

const modules = [
  { id: "home", label: "Overview", icon: "⌂" },
  { id: "events", label: "Events & Bookings", icon: "◈" },
  { id: "volunteers", label: "Volunteers", icon: "◎" },
  { id: "donors", label: "Donors & Donations", icon: "◇" },
  { id: "marketing", label: "Marketing / Content", icon: "◰" },
  { id: "financials", label: "Financials", icon: "◻" },
  { id: "archival", label: "Archival / Objects", icon: "◫" },
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

function VolunteersView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total Volunteers" value="5" />
        <StatCard label="Active" value="4" />
        <StatCard label="Total Hours (YTD)" value="146" />
        <StatCard label="Avg Hours / Volunteer" value="29" />
      </div>
      <Table
        cols={["Name", "Role", "Hours YTD", "Last Shift", "Status"]}
        rows={mockData.volunteers}
        renderRow={r => (<><Td>{r.name}</Td><Td muted>{r.role}</Td><Td>{r.hours}</Td><Td muted>{r.lastShift}</Td><Td><Badge status={r.status} /></Td></>)}
      />
    </div>
  );
}

function DonorsView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total Donors" value="5" />
        <StatCard label="YTD Received" value="$18,000" />
        <StatCard label="Pledged / Pending" value="$7,500" />
        <StatCard label="Largest Gift" value="$10,000" sub="Teichert Foundation" />
      </div>
      <Table
        cols={["Donor", "Type", "Amount", "Year", "Status"]}
        rows={mockData.donors}
        renderRow={r => (<><Td>{r.name}</Td><Td muted>{r.type}</Td><Td>{r.amount}</Td><Td muted>{r.year}</Td><Td><Badge status={r.status} /></Td></>)}
      />
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
}function FinancialsView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total Revenue Budget" value="$73,000" />
        <StatCard label="Actual Revenue YTD" value="$45,100" sub="62% of goal" />
        <StatCard label="Total Expense Budget" value="$30,000" />
        <StatCard label="Actual Expenses YTD" value="$13,300" sub="44% spent" />
      </div>
      <div style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" }}>
        {mockData.financials.map((f, i) => (
          <div key={i} style={{ padding: "14px 18px", borderBottom: i < mockData.financials.length - 1 ? "0.5px solid #f0ebe2" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: f.expense ? "#c0392b" : "#2a7a4b" }}>{f.category}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{f.actual} <span style={{ color: "#ccc" }}>/ {f.budget}</span></div>
            </div>
            <ProgressBar pct={f.pct} color={f.expense ? "#e57373" : gold} />
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{f.pct}% of budget</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchivalView() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total Objects" value="5" />
        <StatCard label="Photographs" value="1" />
        <StatCard label="Documents" value="2" />
        <StatCard label="Artifacts" value="2" />
      </div>
      <Table
        cols={["ID", "Name", "Type", "Condition", "Location"]}
        rows={mockData.archival}
        renderRow={r => (<><Td muted>{r.id}</Td><Td>{r.name}</Td><Td muted>{r.type}</Td><Td><Badge status={r.condition} /></Td><Td muted>{r.location}</Td></>)}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mockData.strategy.map((s, i) => (
          <div key={i} style={{ background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" }}>
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
  financials: FinancialsView,
  archival: ArchivalView,
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