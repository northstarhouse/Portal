(() => {
  // src/app.jsx
  var { useState, useEffect } = React;
  var SUPABASE_URL = "https://uvzwhhwzelaelfhfkvdb.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2endoaHd6ZWxhZWxmaGZrdmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzI4OTksImV4cCI6MjA4OTYwODg5OX0.xw5n0MGm69u_FOiZHxbLNUCNQHehIJliO_s4YbTyfh8";
  function sbFetch(table, columns) {
    const cols = columns.map((c) => encodeURIComponent(c)).join(",");
    const url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=" + cols;
    return fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    }).then((r) => r.json());
  }
  var CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";
  function fetchCalendarEvents() {
    var proxy = "https://corsproxy.io/?" + encodeURIComponent(CALENDAR_ICAL_URL);
    return fetch(proxy).then(function(r) {
      return r.text();
    }).then(function(text) {
      text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
      var events = [], current = null;
      text.split("\n").forEach(function(line) {
        if (line === "BEGIN:VEVENT") {
          current = {};
        } else if (line === "END:VEVENT") {
          if (current) events.push(current);
          current = null;
        } else if (current) {
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
    if (val.length === 8) return /* @__PURE__ */ new Date(val.slice(0, 4) + "-" + val.slice(4, 6) + "-" + val.slice(6, 8) + "T00:00:00");
    var y = val.slice(0, 4), mo = val.slice(4, 6), d = val.slice(6, 8), h = val.slice(9, 11), mi = val.slice(11, 13), s = val.slice(13, 15) || "00";
    return /* @__PURE__ */ new Date(y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + s + (val.endsWith("Z") ? "Z" : ""));
  }
  var gold = "#886c44";
  var cream = "#f8f4ec";
  var NAV_ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    quarterly: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>',
    volunteers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    donors: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    board: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    strategy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    operational: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  };
  function NavIcon({ id, active }) {
    return React.createElement("svg", {
      width: 15,
      height: 15,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { flexShrink: 0, opacity: active ? 1 : 0.7 },
      dangerouslySetInnerHTML: { __html: NAV_ICONS[id] || "" }
    });
  }
  var modules = [
    { id: "home", label: "Overview" },
    { id: "quarterly", label: "Quarterly Update" },
    { id: "volunteers", label: "Volunteers" },
    { id: "donors", label: "Donors & Donations" },
    { id: "board", label: "Board Voting" },
    { id: "strategy", label: "Strategic Goal Progress" },
    { id: "operational", label: "Operational Areas", hidden: true }
  ];
  var mockData = {
    events: [
      { name: "Spring Garden Tour", date: "Apr 12", status: "Confirmed", revenue: "$1,200", guests: 45 },
      { name: "Founder's Gala", date: "May 3", status: "Pending", revenue: "$4,800", guests: 120 },
      { name: "Julia Morgan Lecture", date: "May 18", status: "Confirmed", revenue: "$600", guests: 30 },
      { name: "Mid-Summer Festival", date: "Jul 11", status: "Planning", revenue: "\u2014", guests: 200 },
      { name: "Board Retreat", date: "Aug 5", status: "Confirmed", revenue: "\u2014", guests: 14 }
    ],
    volunteers: [
      { name: "Margaret H.", role: "Garden Lead", hours: 42, lastShift: "Mar 18", status: "Active" },
      { name: "David K.", role: "Events Support", hours: 28, lastShift: "Mar 15", status: "Active" },
      { name: "Sara L.", role: "Archivist", hours: 35, lastShift: "Mar 10", status: "Active" },
      { name: "James T.", role: "Docent", hours: 19, lastShift: "Feb 28", status: "Inactive" },
      { name: "Priya M.", role: "Social Media", hours: 22, lastShift: "Mar 19", status: "Active" }
    ],
    donors: [
      { name: "Teichert Foundation", type: "Foundation", amount: "$10,000", year: 2025, status: "Received" },
      { name: "Robert & Jean Foote", type: "Individual", amount: "$2,500", year: 2025, status: "Pledged" },
      { name: "PG&E Community Giving", type: "Corporate", amount: "$5,000", year: 2025, status: "In Review" },
      { name: "McConnell Foundation", type: "Foundation", amount: "$7,500", year: 2024, status: "Received" },
      { name: "Anonymous", type: "Individual", amount: "$500", year: 2025, status: "Received" }
    ],
    marketing: [
      { platform: "Instagram", post: "Spring Hedgerow Walk", date: "Apr 5", status: "Scheduled", lead: "Haley" },
      { platform: "Facebook", post: "Volunteer Spotlight \u2014 Sara L.", date: "Apr 8", status: "Draft", lead: "Haley" },
      { platform: "Email", post: "April Newsletter", date: "Apr 1", status: "Sent", lead: "Haley" },
      { platform: "Instagram", post: "Mid-Summer Festival Announce", date: "Apr 15", status: "Draft", lead: "Haley" },
      { platform: "TikTok", post: "Julia Morgan Heritage Clip", date: "Apr 20", status: "Ideas", lead: "Haley" }
    ],
    financials: [
      { category: "Event Revenue", budget: "$18,000", actual: "$9,600", pct: 53 },
      { category: "Donations", budget: "$25,000", actual: "$18,000", pct: 72 },
      { category: "Grants", budget: "$30,000", actual: "$17,500", pct: 58 },
      { category: "Operations", budget: "$22,000", actual: "$10,200", pct: 46, expense: true },
      { category: "Programming", budget: "$8,000", actual: "$3,100", pct: 39, expense: true }
    ],
    archival: [
      { id: "NSH-001", name: "Foote Family Portrait, 1908", type: "Photograph", condition: "Good", location: "Storage A" },
      { id: "NSH-002", name: "Original Blueprint \u2014 Julia Morgan", type: "Document", condition: "Fragile", location: "Archive Box 3" },
      { id: "NSH-003", name: "Gold Rush Mining Equipment", type: "Artifact", condition: "Fair", location: "Display Case 1" },
      { id: "NSH-004", name: "North Star Mine Letter, 1902", type: "Document", condition: "Good", location: "Archive Box 1" },
      { id: "NSH-005", name: "Pelton Wheel Fragment", type: "Artifact", condition: "Fair", location: "Garden Shed" }
    ],
    board: [
      { member: "Carol W.", role: "Chair", attendance: "100%", lastVote: "Mar 12", status: "Active" },
      { member: "Thomas A.", role: "Treasurer", attendance: "92%", lastVote: "Mar 12", status: "Active" },
      { member: "Diane P.", role: "Secretary", attendance: "85%", lastVote: "Mar 12", status: "Active" },
      { member: "Raj S.", role: "Member", attendance: "78%", lastVote: "Feb 8", status: "Active" },
      { member: "Nina F.", role: "Member", attendance: "60%", lastVote: "Jan 15", status: "Watch" }
    ],
    strategy: [
      { pillar: "Historic Preservation", goal: "Complete 2nd floor feasibility study", progress: 90, owner: "Haley", due: "Q2 2025" },
      { pillar: "Community Programs", goal: "Launch Hedgerow Garden Walk", progress: 75, owner: "Haley", due: "Q2 2025" },
      { pillar: "Revenue Diversification", goal: "Secure 3 new grant sources", progress: 40, owner: "Board", due: "Q3 2025" },
      { pillar: "Volunteer Development", goal: "Grow volunteer base to 50 active", progress: 60, owner: "Haley", due: "Q4 2025" },
      { pillar: "Brand & Communications", goal: "Relaunch NSH website", progress: 55, owner: "Haley", due: "Q3 2025" }
    ]
  };
  var statusColors = {
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
    Fragile: { bg: "#fce4ec", color: "#880e4f" }
  };
  function Badge({ status }) {
    const style = statusColors[status] || { bg: "#f3f3f3", color: "#555" };
    return /* @__PURE__ */ React.createElement("span", { style: { background: style.bg, color: style.color, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" } }, status);
  }
  function StatCard({ label, value, sub }) {
    return /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 18px", minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 120 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 4 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 500, color: "#2a2a2a" } }, value), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 2, minHeight: 16 } }, sub || ""));
  }
  function Table({ cols, rows, renderRow }) {
    return /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, cols.map((c) => /* @__PURE__ */ React.createElement("th", { key: c, style: { textAlign: "left", padding: "8px 10px", color: "#999", fontWeight: 500, borderBottom: "0.5px solid #e8e0d4", whiteSpace: "nowrap" } }, c)))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((row, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: "0.5px solid #f0ebe2" } }, renderRow(row)))))));
  }
  function Td({ children, muted }) {
    return /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 10px", color: muted ? "#aaa" : "#2a2a2a", whiteSpace: "nowrap" } }, children);
  }
  function HomeView({ navigate }) {
    const [donationTotal, setDonationTotal] = useState(null);
    const [activeVols, setActiveVols] = useState(null);
    const [calEvents, setCalEvents] = useState(null);
    useEffect(function() {
      sbFetch("2026 Donations", ["Amount"]).then(function(rows) {
        if (!Array.isArray(rows)) return;
        var total = rows.reduce(function(s, r) {
          return s + parseFloat((r["Amount"] || "0").replace(/[^\d.]/g, "") || 0);
        }, 0);
        setDonationTotal(total);
      });
      sbFetch("2026 Volunteers", ["Status"]).then(function(rows) {
        if (!Array.isArray(rows)) return;
        setActiveVols(rows.filter(function(r) {
          return r["Status"] === "Active";
        }).length);
      });
      fetchCalendarEvents().then(function(events) {
        var now = /* @__PURE__ */ new Date();
        var windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1e3);
        var filtered = events.filter(function(ev) {
          var start = parseIcalDate(ev["DTSTART"]);
          return start && start >= now && start <= windowEnd;
        }).sort(function(a, b) {
          return parseIcalDate(a["DTSTART"]) - parseIcalDate(b["DTSTART"]);
        }).slice(0, 8);
        setCalEvents(filtered);
      }).catch(function() {
        setCalEvents([]);
      });
    }, []);
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#5c3d1e", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 } }, "Today \u2014 ", (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })), /* @__PURE__ */ React.createElement("span", { style: { color: "#777", fontSize: 13 } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#888" } }, "Here's your organization at a glance."))), (function() {
      var due = quarterDueDate(currentQuarterStr(), (/* @__PURE__ */ new Date()).getFullYear());
      var now = /* @__PURE__ */ new Date();
      now.setHours(0, 0, 0, 0);
      var days = Math.round((due - now) / 864e5);
      var dueStr = due.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      var label = days === 0 ? "Due today" : days < 0 ? Math.abs(days) + " days overdue" : days + " days away";
      var labelColor = "#c0392b";
      var labelBg = "#fce4e4";
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          onClick: function() {
            navigate("quarterly");
          },
          style: { background: "#fce4e4", border: "0.5px solid #e8a0a0", borderRadius: 6, padding: "7px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
          onMouseEnter: function(e) {
            e.currentTarget.style.background = "#f8d7d7";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.background = "#fce4e4";
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#c0392b" } }, "\u26A0"),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: "#c0392b", fontStyle: "italic" } }, "Quarterly Update Due \u2014 ", dueStr),
        /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#c0392b", flexShrink: 0 } }, label, " \u2192")
      );
    })(), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("donors");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Donations", value: donationTotal === null ? "..." : "$" + donationTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })), /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("volunteers");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Active Volunteers", value: activeVols === null ? "..." : activeVols })), /* @__PURE__ */ React.createElement(StatCard, { label: "2026 Events", value: "5", sub: "on the books" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Active Sponsors", value: "3", sub: "+ 1 in review" })), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })), "Happening Soon at North Star House"), calEvents === null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "Loading\u2026"), calEvents !== null && calEvents.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "No upcoming events in the next 2 weeks."), calEvents !== null && calEvents.map(function(ev, i) {
      var start = parseIcalDate(ev["DTSTART"]);
      var isAllDay = ev["DTSTART"] && ev["DTSTART"].replace(/[^0-9TZ]/g, "").length === 8;
      var dayStr = start ? start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
      var todayStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      var isToday = start && dayStr === todayStr;
      var end = ev["DTEND"] ? parseIcalDate(ev["DTEND"]) : null;
      if (!end && ev["DURATION"]) {
        var dur = ev["DURATION"];
        var durMs = 0;
        var wk = dur.match(/(\d+)W/);
        if (wk) durMs += parseInt(wk[1]) * 7 * 864e5;
        var dy = dur.match(/(\d+)D/);
        if (dy) durMs += parseInt(dy[1]) * 864e5;
        var hr = dur.match(/(\d+)H/);
        if (hr) durMs += parseInt(hr[1]) * 36e5;
        var mn = dur.match(/(\d+)M/);
        if (mn) durMs += parseInt(mn[1]) * 6e4;
        if (durMs > 0 && start) end = new Date(start.getTime() + durMs);
      }
      var fmt = function(d) {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      };
      var timeStr = isAllDay ? "All day" : end && end > start ? fmt(start) + " \u2013 " + fmt(end) : fmt(start);
      var title = (ev["SUMMARY"] || "Untitled").replace(/\\,/g, ",").replace(/\\n/g, " ");
      var tl = title.toLowerCase();
      var isDocent = /docent/.test(tl);
      var isEstate = !isDocent && /estate|walk.?thr|sierra|\(j\)|tour/.test(tl);
      var isWedding = /wedding/.test(tl);
      var isCommittee = /committee/.test(tl);
      var isMeeting = /meeting/.test(tl);
      var isCreative = /creative|class/.test(tl);
      var isEvent = /event|party/.test(tl);
      var isGoals = /goal/.test(tl);
      var dotColor = isDocent ? "#2e7d32" : isEstate ? "#c2185b" : isWedding ? "#b71c1c" : isCommittee ? "#e65100" : isMeeting ? "#f6c900" : isCreative ? "#00838f" : isEvent ? "#1565c0" : isGoals ? "#f57c00" : gold;
      var label = isDocent ? "Docent Tour" : isEstate ? "Estate Tour" : isWedding ? "Wedding" : isCommittee ? "Committee" : isMeeting ? "Meeting" : isCreative ? "Creative" : isEvent ? "Event" : isGoals ? "Goals" : "Other";
      var labelBg = isDocent ? "#e8f5e9" : isEstate ? "#fce4ec" : isWedding ? "#ffebee" : isCommittee ? "#fff3e0" : isMeeting ? "#fff9c4" : isCreative ? "#e0f7fa" : isEvent ? "#e3f2fd" : isGoals ? "#fff8e1" : "#f0ebe2";
      return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, background: isToday ? "#fffbf0" : "transparent", border: isToday ? "0.5px solid #e8d9b0" : "none", borderRadius: isToday ? 8 : 0, padding: isToday ? "8px 10px" : "2px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: isToday ? 700 : 500, color: "#2a2a2a" } }, title), isToday && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 600, color: gold, textTransform: "uppercase", letterSpacing: 0.8 } }, "Today")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 2 } }, dayStr, timeStr !== "All day" ? " \xB7 " + timeStr : "")), label && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, background: labelBg, color: dotColor, borderRadius: 20, fontWeight: 500, flexShrink: 0, width: 90, textAlign: "center", display: "inline-block", padding: "2px 0" } }, label));
    }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0ebe2", fontSize: 12, color: "#999" } }, "Synced from Google Calendar"))));
  }
  function EventsView() {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Events", value: "5", sub: "next 90 days" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Confirmed", value: "3" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Est. Revenue", value: "$6,600", sub: "confirmed only" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Est. Guests", value: "395", sub: "across all events" })), /* @__PURE__ */ React.createElement(
      Table,
      {
        cols: ["Event", "Date", "Status", "Est. Guests", "Revenue"],
        rows: mockData.events,
        renderRow: (r) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Td, null, r.name), /* @__PURE__ */ React.createElement(Td, { muted: true }, r.date), /* @__PURE__ */ React.createElement(Td, null, /* @__PURE__ */ React.createElement(Badge, { status: r.status })), /* @__PURE__ */ React.createElement(Td, { muted: true }, r.guests), /* @__PURE__ */ React.createElement(Td, null, r.revenue))
      }
    ));
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
    return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table), {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    }).then((r) => r.json());
  }
  function sbUpdate(table, firstName, lastName, row) {
    var fnKey = encodeURIComponent('"First Name"');
    var lnKey = encodeURIComponent('"Last Name"');
    return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?" + fnKey + "=eq." + encodeURIComponent(firstName) + "&" + lnKey + "=eq." + encodeURIComponent(lastName), {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    }).then((r) => r.json());
  }
  function sbPatchById(table, id, row) {
    return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    }).then((r) => r.json());
  }
  var TEAM_COLORS = {
    "Grounds": { bg: "#e8f5e9", color: "#2e7d32" },
    "Construction": { bg: "#fff3e0", color: "#e65100" },
    "Events Team": { bg: "#e3f2fd", color: "#1565c0" },
    "Event Support": { bg: "#e8eaf6", color: "#3949ab" },
    "Interiors": { bg: "#f3e5f5", color: "#6a1b9a" },
    "Fundraising": { bg: "#fff8e1", color: "#8a6200" },
    "Staff": { bg: "#f3f3f3", color: "#555" },
    "Board Member": { bg: "#fce4ec", color: "#880e4f" },
    "New": { bg: "#e0f7fa", color: "#006064" },
    "Docent": { bg: "#fbe9e7", color: "#8d3d2b" },
    "Volunteer Exchange": { bg: "#e8f4fd", color: "#0d6eab" },
    "Support List": { bg: "#f0f4f8", color: "#3a5068" },
    "Venue": { bg: "#ede7f6", color: "#4527a0" }
  };
  var TEAM_OPTIONS = Object.keys(TEAM_COLORS);
  function TeamPicker({ value, onChange }) {
    const { useState: useS } = React;
    const [open, setOpen] = useS(false);
    const [search, setSearch] = useS("");
    var selected = value ? value.split("|").map(function(t) {
      return t.trim();
    }).filter(Boolean) : [];
    function toggle(opt) {
      var next;
      if (selected.indexOf(opt) !== -1) {
        next = selected.filter(function(t) {
          return t !== opt;
        });
      } else {
        next = selected.concat([opt]);
      }
      onChange({ target: { name: "Team", value: next.join(" | ") } });
    }
    function remove(opt) {
      var next = selected.filter(function(t) {
        return t !== opt;
      });
      onChange({ target: { name: "Team", value: next.join(" | ") } });
    }
    return /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: function() {
          setOpen(function(o) {
            return !o;
          });
        },
        style: { minHeight: 38, border: "0.5px solid #e0d8cc", borderRadius: 8, padding: "5px 10px", cursor: "pointer", background: "#fff", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }
      },
      selected.length === 0 && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#999" } }, "Select teams..."),
      selected.map(function(t) {
        return /* @__PURE__ */ React.createElement("span", { key: t, style: { background: (TEAM_COLORS[t] || { bg: "#f3f3f3" }).bg, color: (TEAM_COLORS[t] || { color: "#555" }).color, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" } }, t, /* @__PURE__ */ React.createElement(
          "span",
          {
            onClick: function(e) {
              e.stopPropagation();
              remove(t);
            },
            style: { cursor: "pointer", opacity: 0.6, fontSize: 12, lineHeight: 1, marginLeft: 2 }
          },
          "\xD7"
        ));
      }),
      /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: 12, color: "#999", flexShrink: 0 } }, open ? "\u25B2" : "\u25BC")
    ), open && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 100, marginTop: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 10px", borderBottom: "0.5px solid #f0ece6" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        autoFocus: true,
        value: search,
        onChange: function(e) {
          setSearch(e.target.value);
        },
        onClick: function(e) {
          e.stopPropagation();
        },
        placeholder: "Search teams...",
        style: { width: "100%", padding: "6px 10px", border: "0.5px solid #e0d8cc", borderRadius: 6, fontSize: 12, boxSizing: "border-box", outline: "none" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { maxHeight: 200, overflowY: "auto", padding: "4px 0" } }, TEAM_OPTIONS.filter(function(opt) {
      return opt.toLowerCase().indexOf(search.toLowerCase()) !== -1;
    }).map(function(opt) {
      var isOn = selected.indexOf(opt) !== -1;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: opt,
          onClick: function() {
            toggle(opt);
          },
          style: { padding: "8px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: isOn ? (TEAM_COLORS[opt] || { bg: "#f3f3f3" }).bg : "#fff", color: isOn ? (TEAM_COLORS[opt] || { color: "#555" }).color : "#2a2a2a" },
          onMouseEnter: function(e) {
            if (!isOn) e.currentTarget.style.background = "#faf8f4";
          },
          onMouseLeave: function(e) {
            if (!isOn) e.currentTarget.style.background = "#fff";
          }
        },
        opt,
        isOn && /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontSize: 12, fontWeight: 600 } }, "\u2713")
      );
    }))));
  }
  var volInputStyle = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
  var volLabelStyle = { fontSize: 12, color: "#666", fontWeight: 500 };
  var volGrp = { marginBottom: 14 };
  var volSecLabel = { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 10, marginTop: 20, display: "block" };
  function VolForm({ form, onChange, saving, onSubmit, title, onCancel }) {
    return /* @__PURE__ */ React.createElement("div", { onClick: onCancel, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 700, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, title), /* @__PURE__ */ React.createElement("form", { onSubmit }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Basic Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "First Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "First Name", value: form["First Name"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Last Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Last Name", value: form["Last Name"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Status"), /* @__PURE__ */ React.createElement("select", { name: "Status", value: form["Status"], onChange, style: volInputStyle }, /* @__PURE__ */ React.createElement("option", { value: "Active" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "Inactive" }, "Inactive"))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Team"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, /* @__PURE__ */ React.createElement(TeamPicker, { value: form["Team"], onChange }))), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: form["Email"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: form["Phone Number"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Address"), /* @__PURE__ */ React.createElement("input", { name: "Address", value: form["Address"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Emergency Contact"), /* @__PURE__ */ React.createElement("input", { name: "Emergency Contact", value: form["Emergency Contact"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Birthday"), /* @__PURE__ */ React.createElement("input", { name: "Birthday", type: "date", value: form["Birthday"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Anniversary"), /* @__PURE__ */ React.createElement("input", { name: "Volunteer Anniversary", type: "date", value: form["Volunteer Anniversary"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Month"), /* @__PURE__ */ React.createElement("input", { name: "Month", value: form["Month"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Day"), /* @__PURE__ */ React.createElement("input", { name: "Day", value: form["Day"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "CC", checked: form["CC"], onChange }), " CC"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Nametag", checked: form["Nametag"], onChange }), " Nametag")), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Picture URL (Google Drive)"), /* @__PURE__ */ React.createElement("input", { name: "Picture URL", value: form["Picture URL"], onChange, style: volInputStyle, placeholder: "https://drive.google.com/..." })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Overview Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Overview Notes", value: form["Overview Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Background Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Background Notes", value: form["Background Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: form["Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Goals"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "What they want to see at NSH"), /* @__PURE__ */ React.createElement("textarea", { name: "What they want to see at NSH", value: form["What they want to see at NSH"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 } }, saving ? "Saving..." : "Save"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onCancel, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel")))));
  }
  function VolunteersView() {
    const [volunteers, setVolunteers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filterTeam, setFilterTeam] = useState("All");
    const [tab, setTab] = useState("active");
    var emptyForm = {
      "First Name": "",
      "Last Name": "",
      "Team": "",
      "Status": "Active",
      "Email": "",
      "Phone Number": "",
      "Address": "",
      "Birthday": "",
      "Volunteer Anniversary": "",
      "CC": false,
      "Nametag": false,
      "Overview Notes": "",
      "Background Notes": "",
      "Notes": "",
      "What they want to see at NSH": "",
      "Picture URL": "",
      "Emergency Contact": "",
      "Month": "",
      "Day": ""
    };
    const [form, setForm] = useState(emptyForm);
    useEffect(function() {
      sbFetch("2026 Volunteers", ["First Name", "Last Name", "Team", "Status", "Email", "Phone Number", "Address", "Birthday", "Volunteer Anniversary", "CC", "Nametag", "Overview Notes", "Background Notes", "Notes", "What they want to see at NSH", "Picture URL", "Emergency Contact", "Month", "Day"]).then(function(data) {
        if (Array.isArray(data)) setVolunteers(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      }).catch(function(err) {
        setError(err.message);
        setLoading(false);
      });
    }, []);
    var active = volunteers.filter(function(v) {
      return v["Status"] === "Active";
    }).length;
    var inactive = volunteers.filter(function(v) {
      return v["Status"] === "Inactive";
    }).length;
    var tabList = volunteers.filter(function(v) {
      return tab === "active" ? v["Status"] === "Active" : v["Status"] === "Inactive";
    });
    var teamSet = ["All"].concat(TEAM_OPTIONS.filter(function(t) {
      return tabList.some(function(v) {
        return (v["Team"] || "").split("|").map(function(x) {
          return x.trim();
        }).indexOf(t) !== -1;
      });
    }));
    var teams = teamSet.length - 1;
    function teamSortKey(v) {
      if (v["First Name"] === "Ken" && v["Last Name"] === "Underwood") return "0";
      var t = (v["Team"] || "").split("|")[0].trim();
      if (t === "Board Member") return "1";
      if (t === "Staff") return "2";
      return "3_" + t;
    }
    var filtered = filterTeam === "All" ? tabList.slice().sort(function(a, b) {
      return teamSortKey(a).localeCompare(teamSortKey(b));
    }) : tabList.filter(function(v) {
      return (v["Team"] || "").split("|").map(function(x) {
        return x.trim();
      }).indexOf(filterTeam) !== -1;
    });
    function fmtBirthday(val) {
      if (!val) return "";
      var d = /* @__PURE__ */ new Date(val + "T00:00:00");
      if (isNaN(d)) return val;
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    }
    function initials(v) {
      return ((v["First Name"] || "")[0] || "").toUpperCase() + ((v["Last Name"] || "")[0] || "").toUpperCase();
    }
    function handleFormChange(e) {
      var key = e.target.name;
      var val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm(function(prev) {
        var n = Object.assign({}, prev);
        n[key] = val;
        return n;
      });
    }
    function openEdit(v) {
      setForm({
        "First Name": v["First Name"] || "",
        "Last Name": v["Last Name"] || "",
        "Team": v["Team"] || "",
        "Status": v["Status"] || "Active",
        "Email": v["Email"] || "",
        "Phone Number": v["Phone Number"] || "",
        "Address": v["Address"] || "",
        "Birthday": v["Birthday"] || "",
        "Volunteer Anniversary": v["Volunteer Anniversary"] || "",
        "CC": String(v["CC"]).toUpperCase() === "TRUE",
        "Nametag": String(v["Nametag"]).toUpperCase() === "TRUE",
        "Overview Notes": v["Overview Notes"] || "",
        "Background Notes": v["Background Notes"] || "",
        "Notes": v["Notes"] || "",
        "What they want to see at NSH": v["What they want to see at NSH"] || "",
        "Picture URL": v["Picture URL"] || "",
        "Emergency Contact": v["Emergency Contact"] || "",
        "Month": v["Month"] || "",
        "Day": v["Day"] || ""
      });
      setEditing(true);
    }
    function handleAddSubmit(e) {
      e.preventDefault();
      setSaving(true);
      var row = {};
      Object.keys(form).forEach(function(k) {
        if (form[k] !== "" && form[k] !== false) row[k] = form[k] === true ? "TRUE" : form[k];
      });
      if (!form["CC"]) row["CC"] = "FALSE";
      if (!form["Nametag"]) row["Nametag"] = "FALSE";
      sbInsert("2026 Volunteers", row).then(function(res) {
        setSaving(false);
        var inserted = Array.isArray(res) ? res[0] : res;
        if (inserted && inserted["First Name"]) setVolunteers(function(p) {
          return p.concat([inserted]);
        });
        setShowAdd(false);
        setForm(emptyForm);
      }).catch(function() {
        setSaving(false);
      });
    }
    function handleEditSubmit(e) {
      e.preventDefault();
      if (!selected) return;
      setSaving(true);
      var row = {};
      Object.keys(form).forEach(function(k) {
        if (form[k] !== "") row[k] = form[k] === true ? "TRUE" : form[k] === false ? "FALSE" : form[k];
      });
      sbUpdate("2026 Volunteers", selected["First Name"], selected["Last Name"], row).then(function(res) {
        setSaving(false);
        if (res && res.code) {
          alert("Save failed: " + (res.message || JSON.stringify(res)));
          return;
        }
        var updated = Array.isArray(res) ? res[0] : res;
        var merged = Object.assign({}, selected, row, updated || {});
        setVolunteers(function(prev) {
          return prev.map(function(v) {
            return v["First Name"] === selected["First Name"] && v["Last Name"] === selected["Last Name"] ? merged : v;
          });
        });
        setSelected(merged);
        setEditing(false);
      }).catch(function(err) {
        setSaving(false);
        alert("Save error: " + err.message);
      });
    }
    function InfoRow({ label, value, link }) {
      if (!value) return null;
      return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, marginBottom: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 110, fontSize: 12, color: "#777", flexShrink: 0, paddingTop: 1 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#2a2a2a", flex: 1, lineHeight: 1.4 } }, link ? /* @__PURE__ */ React.createElement("a", { href: link, style: { color: gold, textDecoration: "none" } }, value) : value));
    }
    function NoteBlock({ label, value }) {
      if (!value) return null;
      return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, label && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#444", lineHeight: 1.65, background: "#faf8f4", borderRadius: 8, padding: "10px 14px" } }, value));
    }
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Volunteers", value: loading ? "..." : volunteers.length }), /* @__PURE__ */ React.createElement(StatCard, { label: "Active", value: loading ? "..." : active }), /* @__PURE__ */ React.createElement(StatCard, { label: "Teams", value: loading ? "..." : teams })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, background: "#f0ebe3", borderRadius: 10, padding: 3 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setTab("active");
          setFilterTeam("All");
        },
        style: { border: "none", borderRadius: 8, padding: "6px 18px", fontSize: 12, fontWeight: tab === "active" ? 600 : 400, cursor: "pointer", background: tab === "active" ? "#fff" : "transparent", color: tab === "active" ? "#2a2a2a" : "#999", boxShadow: tab === "active" ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }
      },
      "Active ",
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: tab === "active" ? gold : "#bbb", fontWeight: 500 } }, active)
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setTab("inactive");
          setFilterTeam("All");
        },
        style: { border: "none", borderRadius: 8, padding: "6px 18px", fontSize: 12, fontWeight: tab === "inactive" ? 600 : 400, cursor: "pointer", background: tab === "inactive" ? "#fff" : "transparent", color: tab === "inactive" ? "#2a2a2a" : "#999", boxShadow: tab === "inactive" ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }
      },
      "Inactive ",
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: tab === "inactive" ? gold : "#bbb", fontWeight: 500 } }, inactive)
    )), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setForm(emptyForm);
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" } }, "+ Add Volunteer")), !loading && teamSet.length > 2 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 } }, teamSet.map(function(t) {
      var isActive = filterTeam === t;
      var tc = TEAM_COLORS[t] || { bg: "#f3f3f3", color: "#555" };
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t,
          onClick: function() {
            setFilterTeam(t);
          },
          style: {
            border: isActive ? "none" : "0.5px solid #e0d8cc",
            borderRadius: 5,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: isActive ? 600 : 400,
            cursor: "pointer",
            background: isActive ? tc.bg : "#fff",
            color: isActive ? tc.color : "#888",
            transition: "all 0.15s"
          }
        },
        t
      );
    })), error && /* @__PURE__ */ React.createElement("div", { style: { background: "#fce4e4", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#c0392b" } }, "Error: ", error), loading ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#777", fontSize: 12 } }, "Loading volunteers...") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 } }, filtered.map(function(v, i) {
      var imgUrl = v["Picture URL"] ? driveImg(v["Picture URL"]) : null;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: i,
          onClick: function() {
            setSelected(v);
          },
          onMouseEnter: function(e) {
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(136,108,68,0.15)";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
          },
          style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 12, padding: "16px 12px", textAlign: "center", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.18s" }
        },
        imgUrl ? /* @__PURE__ */ React.createElement("img", { src: imgUrl, alt: v["First Name"], style: { width: 56, height: 56, borderRadius: "50%", objectFit: "cover", marginBottom: 10, background: "#eee" } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 56, height: 56, borderRadius: "50%", background: gold, color: "#fff", fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" } }, initials(v)),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: "#2a2a2a", marginBottom: 3, lineHeight: 1.3 } }, v["First Name"], " ", v["Last Name"]),
        v["Team"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (v["Team"] || "").split("|")[0].trim()),
        /* @__PURE__ */ React.createElement(Badge, { status: v["Status"] || "Active" })
      );
    })), selected && !editing && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setSelected(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 18, maxWidth: 620, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.22)", maxHeight: "92vh", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)", padding: "28px 28px 20px", borderBottom: "0.5px solid #e8dece", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 18 } }, selected["Picture URL"] ? /* @__PURE__ */ React.createElement("img", { src: driveImg(selected["Picture URL"]), alt: selected["First Name"], style: { width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 72, height: 72, borderRadius: "50%", background: gold, color: "#fff", fontSize: 24, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0 } }, initials(selected)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 19, fontWeight: 600, color: "#1e1a16", marginBottom: 3, lineHeight: 1.2 } }, selected["First Name"], " ", selected["Last Name"]), selected["Team"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#9a7f5a", marginBottom: 6, fontWeight: 500 } }, selected["Team"]), /* @__PURE__ */ React.createElement(Badge, { status: selected["Status"] || "Active" }), selected["Overview Notes"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#7a6a55", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" } }, selected["Overview Notes"]))), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 14, right: 14, display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      openEdit(selected);
    }, style: { background: "#fff", border: "0.5px solid #ddd4c4", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "#7a6a55", cursor: "pointer", fontWeight: 500 } }, "Edit"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#666", lineHeight: 1 } }, "\xD7"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 28px 24px", overflowY: "auto" } }, (selected["Email"] || selected["Phone Number"] || selected["Address"] || selected["Emergency Contact"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Contact"), /* @__PURE__ */ React.createElement(InfoRow, { label: "Email", value: selected["Email"], link: "mailto:" + selected["Email"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Phone", value: selected["Phone Number"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Address", value: selected["Address"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Emergency", value: selected["Emergency Contact"] })), (selected["Volunteer Anniversary"] || selected["Birthday"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Info"), /* @__PURE__ */ React.createElement(InfoRow, { label: "Anniversary", value: selected["Volunteer Anniversary"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Birthday", value: fmtBirthday(selected["Birthday"]) })), (selected["Background Notes"] || selected["Notes"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Notes"), /* @__PURE__ */ React.createElement(NoteBlock, { label: "Background", value: selected["Background Notes"] }), /* @__PURE__ */ React.createElement(NoteBlock, { label: "Additional", value: selected["Notes"] })), selected["What they want to see at NSH"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Goals"), /* @__PURE__ */ React.createElement(NoteBlock, { value: selected["What they want to see at NSH"] })), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { marginTop: 16, width: "100%", padding: "9px", background: "transparent", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#999", fontWeight: 500 } }, "Close")))), selected && editing && /* @__PURE__ */ React.createElement(
      VolForm,
      {
        form,
        onChange: handleFormChange,
        saving,
        title: "Edit \u2014 " + selected["First Name"] + " " + selected["Last Name"],
        onSubmit: handleEditSubmit,
        onCancel: function() {
          setEditing(false);
        }
      }
    ), showAdd && /* @__PURE__ */ React.createElement(
      VolForm,
      {
        form,
        onChange: handleFormChange,
        saving,
        title: "Add Volunteer",
        onSubmit: handleAddSubmit,
        onCancel: function() {
          setShowAdd(false);
        }
      }
    ));
  }
  function DonorsView() {
    const [donations, setDonations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filterType, setFilterType] = useState("All");
    var DONATION_TYPES = ["Donation", "Membership", "Restricted", "Membership, Donation", "Brick Purchase", "Tribute"];
    var PAYMENT_TYPES = ["Website", "Check", "Cash", "Credit Card", "ACH", "Other"];
    var ACCOUNT_TYPES = ["Individual", "Family", "Household", "Foundation", "Corporate", "Organization"];
    var emptyDonForm = {
      "Donor Name": "",
      "Last Name": "",
      "Informal Names": "",
      "Amount": "",
      "Close Date": "",
      "Donation Type": "Donation",
      "Payment Type": "Website",
      "Account Type": "Individual",
      "Acknowledged": false,
      "Salesforce": false,
      "Email": "",
      "Phone Number": "",
      "Address": "",
      "Benefits": "",
      "Donation Notes": "",
      "Donor Notes": "",
      "Notes": ""
    };
    const [form, setForm] = useState(emptyDonForm);
    useEffect(function() {
      sbFetch("2026 Donations", ["Donor Name", "Last Name", "Informal Names", "Amount", "Close Date", "Donation Type", "Payment Type", "Account Type", "Acknowledged", "Salesforce", "Email", "Phone Number", "Address", "Benefits", "Donation Notes", "Donor Notes", "Notes"]).then(function(data) {
        if (Array.isArray(data)) setDonations(data.sort(function(a, b) {
          return new Date(b["Close Date"]) - new Date(a["Close Date"]);
        }));
        else setError(JSON.stringify(data));
        setLoading(false);
      }).catch(function(err) {
        setError(err.message);
        setLoading(false);
      });
    }, []);
    function parseAmount(val) {
      return parseFloat((val || "0").replace(/[^\d.]/g, "") || 0);
    }
    function fmtAmount(val) {
      var n = parseAmount(val);
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(val) {
      if (!val) return "";
      var d = /* @__PURE__ */ new Date(val + "T00:00:00");
      if (isNaN(d)) return val;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    var totalRaised = donations.reduce(function(s, r) {
      return s + parseAmount(r["Amount"]);
    }, 0);
    var totalDonors = donations.length;
    var memberships = donations.filter(function(r) {
      return (r["Donation Type"] || "").includes("Membership");
    }).length;
    var acknowledged = donations.filter(function(r) {
      return r["Acknowledged"] === true || String(r["Acknowledged"]).toUpperCase() === "TRUE";
    }).length;
    var unacknowledged = totalDonors - acknowledged;
    function handleDonFormChange(e) {
      var key = e.target.name;
      var val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm(function(prev) {
        var n = Object.assign({}, prev);
        n[key] = val;
        return n;
      });
    }
    function handleDonSubmit(e) {
      e.preventDefault();
      setSaving(true);
      var row = {};
      Object.keys(form).forEach(function(k) {
        if (form[k] !== "") row[k] = form[k] === true ? "TRUE" : form[k] === false ? "FALSE" : form[k];
      });
      sbInsert("2026 Donations", row).then(function(res) {
        setSaving(false);
        var inserted = Array.isArray(res) ? res[0] : res;
        if (inserted && inserted["Donor Name"]) setDonations(function(p) {
          return p.concat([inserted]);
        });
        setShowAdd(false);
        setForm(emptyDonForm);
      }).catch(function() {
        setSaving(false);
      });
    }
    var iStyle = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 12, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
    var lStyle = { fontSize: 12, color: "#666", fontWeight: 500 };
    var grp = { marginBottom: 14 };
    var sec = { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 10, marginTop: 20, display: "block" };
    var typeColors = {
      "Donation": { bg: "#e3f2fd", color: "#1565c0" },
      "Membership": { bg: "#e8f5e9", color: "#2e7d32" },
      "Restricted": { bg: "#fce4ec", color: "#880e4f" },
      "Membership, Donation": { bg: "#f3e5f5", color: "#6a1b9a" },
      "Brick Purchase": { bg: "#fbe9e7", color: "#8d3d2b" },
      "Tribute": { bg: "#fff8e1", color: "#8a6200" }
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Raised", value: loading ? "..." : "$" + totalRaised.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: "2026 YTD" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Donations", value: loading ? "..." : totalDonors }), /* @__PURE__ */ React.createElement(StatCard, { label: "Memberships", value: loading ? "..." : memberships }), /* @__PURE__ */ React.createElement(StatCard, { label: "Need Thank You", value: loading ? "..." : unacknowledged, sub: unacknowledged > 0 ? "pending" : "all clear" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888" } }, loading ? "Loading..." : totalDonors + " donation" + (totalDonors !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setForm(emptyDonForm);
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" } }, "+ Add Donation")), error && /* @__PURE__ */ React.createElement("div", { style: { background: "#fce4e4", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#c0392b" } }, "Error: ", error), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 } }, ["All"].concat(DONATION_TYPES).map(function(t) {
      var active = filterType === t;
      var tc = typeColors[t] || { bg: "#f5f0ea", color: "#888" };
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t,
          onClick: function() {
            setFilterType(t);
          },
          style: { padding: "5px 14px", borderRadius: 5, border: "1.5px solid " + (active ? tc.color : "#e0d8cc"), background: active ? tc.bg : "#fff", color: active ? tc.color : "#888", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }
        },
        t
      );
    })), loading ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#777", fontSize: 12 } }, "Loading donations...") : /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "8px 16px", borderBottom: "0.5px solid #e8e0d4", background: "#faf8f4" } }, ["Donor", "Type", "Amount", "Date"].map(function(h) {
      return /* @__PURE__ */ React.createElement("div", { key: h, style: { fontSize: 12, color: "#777", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 } }, h);
    })), donations.filter(function(d) {
      return filterType === "All" || d["Donation Type"] === filterType;
    }).map(function(d, i) {
      var tc = typeColors[d["Donation Type"]] || { bg: "#f3f3f3", color: "#555" };
      var acked = d["Acknowledged"] === true || String(d["Acknowledged"]).toUpperCase() === "TRUE";
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: i,
          onClick: function() {
            setSelected(d);
          },
          onMouseEnter: function(e) {
            e.currentTarget.style.background = "#faf8f4";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.background = "#fff";
          },
          style: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "11px 16px", borderBottom: "0.5px solid #f0ebe2", cursor: "pointer", background: "#fff", alignItems: "center", transition: "background 0.12s" }
        },
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: "#2a2a2a" } }, d["Donor Name"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#999", marginTop: 1 } }, d["Account Type"])),
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { background: tc.bg, color: tc.color, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" } }, d["Donation Type"])),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a" } }, fmtAmount(d["Amount"])),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, fmtDate(d["Close Date"])), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: acked ? "#e8f5e9" : "#fff8e1", color: acked ? "#2e7d32" : "#8a6200" } }, acked ? "Thanked" : "Pending"))
      );
    })), selected && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setSelected(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, maxWidth: 540, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)", padding: "24px 28px 18px", borderBottom: "0.5px solid #e8dece", position: "relative", borderRadius: "16px 16px 0 0" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 19, fontWeight: 600, color: "#1e1a16", marginBottom: 4 } }, selected["Donor Name"]), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, (function() {
      var tc = typeColors[selected["Donation Type"]] || { bg: "#f3f3f3", color: "#555" };
      return /* @__PURE__ */ React.createElement("span", { style: { background: tc.bg, color: tc.color, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20 } }, selected["Donation Type"]);
    })(), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777" } }, fmtDate(selected["Close Date"]))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#666" } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 28px 24px", overflowY: "auto", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777", marginRight: 8 } }, "Amount"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, fontWeight: 600, color: gold } }, fmtAmount(selected["Amount"]))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Info"), selected["Informal Names"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Goes by"), selected["Informal Names"]), selected["Account Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Type"), selected["Account Type"]), selected["Email"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Email"), /* @__PURE__ */ React.createElement("a", { href: "mailto:" + selected["Email"], style: { color: gold, textDecoration: "none" } }, selected["Email"])), selected["Phone Number"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Phone"), selected["Phone Number"]), selected["Address"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Address"), /* @__PURE__ */ React.createElement("span", { style: { whiteSpace: "pre-line" } }, selected["Address"])), /* @__PURE__ */ React.createElement("span", { style: sec }, "Payment"), selected["Payment Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Method"), selected["Payment Type"]), selected["Benefits"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Benefits"), selected["Benefits"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Acknowledged"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#e8f5e9" : "#fff8e1", color: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#2e7d32" : "#8a6200" } }, selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "Thanked" : "Pending"))), /* @__PURE__ */ React.createElement("div", null, selected["Donation Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donation Notes"])), selected["Donor Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donor Notes"])), selected["Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Notes"])))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { marginTop: 16, width: "100%", padding: "9px", background: "transparent", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#999", fontWeight: 500 } }, "Close")))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowAdd(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 700, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, "Add Donation"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleDonSubmit }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "First / Full Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Donor Name", value: form["Donor Name"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Last Name"), /* @__PURE__ */ React.createElement("input", { name: "Last Name", value: form["Last Name"], onChange: handleDonFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Goes By (Informal)"), /* @__PURE__ */ React.createElement("input", { name: "Informal Names", value: form["Informal Names"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Account Type"), /* @__PURE__ */ React.createElement("select", { name: "Account Type", value: form["Account Type"], onChange: handleDonFormChange, style: iStyle }, ACCOUNT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Amount *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Amount", value: form["Amount"], onChange: handleDonFormChange, style: iStyle, placeholder: "$0.00" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Close Date"), /* @__PURE__ */ React.createElement("input", { name: "Close Date", type: "date", value: form["Close Date"], onChange: handleDonFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Type"), /* @__PURE__ */ React.createElement("select", { name: "Donation Type", value: form["Donation Type"], onChange: handleDonFormChange, style: iStyle }, DONATION_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Payment Type"), /* @__PURE__ */ React.createElement("select", { name: "Payment Type", value: form["Payment Type"], onChange: handleDonFormChange, style: iStyle }, PAYMENT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Benefits"), /* @__PURE__ */ React.createElement("input", { name: "Benefits", value: form["Benefits"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Acknowledged", checked: form["Acknowledged"], onChange: handleDonFormChange }), " Acknowledged / Thanked"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Salesforce", checked: form["Salesforce"], onChange: handleDonFormChange }), " In Salesforce")), /* @__PURE__ */ React.createElement("span", { style: sec }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: form["Email"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: form["Phone Number"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Address"), /* @__PURE__ */ React.createElement("textarea", { name: "Address", value: form["Address"], onChange: handleDonFormChange, rows: 3, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donation Notes", value: form["Donation Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donor Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donor Notes", value: form["Donor Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: form["Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 } }, saving ? "Saving..." : "Save Donation"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setShowAdd(false);
    }, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"))))));
  }
  function MarketingView() {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Posts This Month", value: "5" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Sent", value: "1" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Scheduled", value: "1" }), /* @__PURE__ */ React.createElement(StatCard, { label: "In Draft/Ideas", value: "3" })), /* @__PURE__ */ React.createElement(
      Table,
      {
        cols: ["Platform", "Post", "Scheduled Date", "Lead", "Status"],
        rows: mockData.marketing,
        renderRow: (r) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Td, null, r.platform), /* @__PURE__ */ React.createElement(Td, null, r.post), /* @__PURE__ */ React.createElement(Td, { muted: true }, r.date), /* @__PURE__ */ React.createElement(Td, { muted: true }, r.lead), /* @__PURE__ */ React.createElement(Td, null, /* @__PURE__ */ React.createElement(Badge, { status: r.status })))
      }
    ));
  }
  function RichEditor({ value, onChange, placeholder }) {
    var ref = React.useRef(null);
    var initialized = React.useRef(false);
    React.useEffect(function() {
      if (ref.current && !initialized.current) {
        ref.current.innerHTML = value || "";
        initialized.current = true;
      }
    }, []);
    function exec(cmd) {
      ref.current.focus();
      document.execCommand(cmd, false, null);
    }
    return /* @__PURE__ */ React.createElement("div", { style: { border: "0.5px solid #e0d8cc", borderRadius: 8, overflow: "hidden", marginTop: 4 } }, /* @__PURE__ */ React.createElement("style", null, ".rich-editor:empty:before{content:attr(data-placeholder);color:#bbb;pointer-events:none}"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, padding: "5px 8px", borderBottom: "0.5px solid #f0ebe2", background: "#faf8f4" } }, /* @__PURE__ */ React.createElement("button", { type: "button", onMouseDown: function(e) {
      e.preventDefault();
      exec("bold");
    }, style: { background: "none", border: "0.5px solid #e0d8cc", borderRadius: 5, padding: "1px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#444", lineHeight: 1.6 } }, "B"), /* @__PURE__ */ React.createElement("button", { type: "button", onMouseDown: function(e) {
      e.preventDefault();
      exec("italic");
    }, style: { background: "none", border: "0.5px solid #e0d8cc", borderRadius: 5, padding: "1px 8px", fontSize: 12, fontStyle: "italic", cursor: "pointer", color: "#444", lineHeight: 1.6 } }, "I")), /* @__PURE__ */ React.createElement(
      "div",
      {
        ref,
        className: "rich-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        onInput: function() {
          onChange(ref.current.innerHTML);
        },
        "data-placeholder": placeholder || "Write something\u2026",
        style: { minHeight: 72, padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, background: "#fff" }
      }
    ));
  }
  var BOARD_MEMBERS = ["Ken", "Rick", "Wyn", "Paula", "Jeff", "Rich"];
  var VOTE_COLORS = { "Yes": { bg: "#e8f5e9", color: "#2e7d32" }, "No": { bg: "#ffebee", color: "#c62828" }, "Abstain": { bg: "#fff3e0", color: "#e65100" }, "Not in attendance": { bg: "#f5f5f5", color: "#888" } };
  function BoardView() {
    const [items, setItems] = React.useState([]);
    const [votes, setVotes] = React.useState([]);
    const [selected, setSelected] = React.useState(null);
    const [showAdd, setShowAdd] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(null);
    const [topicForm, setTopicForm] = React.useState({ title: "", description: "", attachment_url: "", submitted_by: "", due_date: "", meeting_date: "" });
    const [voteForm, setVoteForm] = React.useState({ voter: "", choice: "", note: "" });
    const [showPostMeeting, setShowPostMeeting] = React.useState(false);
    const [voteSaving, setVoteSaving] = React.useState(false);
    const [topicSaving, setTopicSaving] = React.useState(false);
    const [attachUploading, setAttachUploading] = React.useState(false);
    const [attachFileName, setAttachFileName] = React.useState("");
    function handleAttachUpload(e) {
      var file = e.target.files[0];
      if (!file) return;
      setAttachFileName(file.name);
      setAttachUploading(true);
      var path = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      fetch(SUPABASE_URL + "/storage/v1/object/board-attachments/" + encodeURIComponent(path), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type || "application/octet-stream" },
        body: file
      }).then(function(r) {
        return r.json();
      }).then(function(res) {
        setAttachUploading(false);
        var url = SUPABASE_URL + "/storage/v1/object/public/board-attachments/" + encodeURIComponent(path);
        setTopicForm(function(f) {
          return Object.assign({}, f, { attachment_url: url });
        });
      }).catch(function() {
        setAttachUploading(false);
      });
    }
    function sbFetchAll(table) {
      var url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=*";
      return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
        return r.json();
      });
    }
    function load() {
      setLoading(true);
      setLoadError(null);
      Promise.all([
        sbFetchAll("Board Voting Items"),
        sbFetchAll("Board-Votes")
      ]).then(function(results) {
        var itemsData = results[0];
        var votesData = results[1];
        if (!Array.isArray(itemsData)) {
          setLoadError("Board Voting Items: " + (itemsData && itemsData.message ? itemsData.message : JSON.stringify(itemsData)));
          setLoading(false);
          return;
        }
        if (!Array.isArray(votesData)) {
          setLoadError("Board-Votes: " + (votesData && votesData.message ? votesData.message : JSON.stringify(votesData)));
          setLoading(false);
          return;
        }
        console.log("Board Voting Items:", itemsData);
        console.log("Board-Votes:", votesData);
        var sorted = itemsData.sort(function(a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setItems(sorted);
        setVotes(votesData);
        setLoading(false);
      }).catch(function(err) {
        setLoadError(err.message);
        setLoading(false);
      });
    }
    React.useEffect(function() {
      load();
    }, []);
    function itemVotes(item) {
      return votes.filter(function(v) {
        return v.topicId === item.id;
      });
    }
    function isRevealed(item) {
      var iv = itemVotes(item);
      var allVoted = BOARD_MEMBERS.every(function(m) {
        return iv.some(function(v) {
          return v.voter === m;
        });
      });
      var pastDue = item.due_date && new Date(item.due_date) < /* @__PURE__ */ new Date();
      return allVoted || pastDue;
    }
    function tally(item) {
      var iv = itemVotes(item);
      return {
        yes: iv.filter(function(v) {
          return v.choice === "Yes";
        }).length,
        no: iv.filter(function(v) {
          return v.choice === "No";
        }).length,
        abstain: iv.filter(function(v) {
          return v.choice === "Abstain";
        }).length,
        absent: iv.filter(function(v) {
          return v.choice === "Not in attendance";
        }).length
      };
    }
    function handleVoteSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!voteForm.voter || !voteForm.choice) return;
      setVoteSaving(true);
      var existing = votes.find(function(v) {
        return v.topicId === selected.id && v.voter === voteForm.voter;
      });
      var today = (/* @__PURE__ */ new Date()).toDateString();
      var isInMeeting = selected.meeting_date && (/* @__PURE__ */ new Date(selected.meeting_date + "T12:00:00")).toDateString() === today;
      var payload = { topicId: selected.id, voter: voteForm.voter, choice: voteForm.choice, note: voteForm.note || null };
      var prom;
      if (existing) {
        prom = sbPatchById("Board-Votes", existing.id, Object.assign({}, payload, { changed_in_meeting: isInMeeting ? true : existing.changed_in_meeting || false }));
      } else {
        prom = sbInsert("Board-Votes", Object.assign({}, payload, { changed_in_meeting: false }));
      }
      prom.then(function() {
        setVoteSaving(false);
        setVoteForm({ voter: "", choice: "", note: "" });
        setShowPostMeeting(false);
        load();
      });
    }
    function handleTopicSubmit(e) {
      e.preventDefault();
      if (!topicForm.title) return;
      setTopicSaving(true);
      sbInsert("Board Voting Items", {
        title: topicForm.title,
        description: topicForm.description || null,
        attachment_url: topicForm.attachment_url || null,
        submitted_by: topicForm.submitted_by || null,
        due_date: topicForm.due_date || null,
        meeting_date: topicForm.meeting_date || null,
        status: "Open"
      }).then(function() {
        setTopicSaving(false);
        setShowAdd(false);
        setTopicForm({ title: "", description: "", attachment_url: "", submitted_by: "", due_date: "", meeting_date: "" });
        setAttachFileName("");
        setAttachUploading(false);
        load();
      });
    }
    function fmtDate(d) {
      if (!d) return "\u2014";
      return (/* @__PURE__ */ new Date(d + "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    var bInp = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 3, fontSize: 12, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
    var bLbl = { fontSize: 12, color: "#666", fontWeight: 500 };
    var bGrp = { marginBottom: 14 };
    if (loading) return /* @__PURE__ */ React.createElement("div", { style: { color: "#777", fontSize: 12, padding: 40, textAlign: "center" } }, "Loading\u2026");
    if (loadError) return /* @__PURE__ */ React.createElement("div", { style: { color: "#c62828", fontSize: 12, padding: 20, background: "#ffebee", borderRadius: 8, border: "0.5px solid #ffcdd2" } }, /* @__PURE__ */ React.createElement("strong", null, "Supabase error:"), " ", loadError, /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("br", null), "Make sure you've run the SQL setup in Supabase and that RLS is disabled on both tables.");
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888" } }, items.length, " topic", items.length !== 1 ? "s" : ""), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 500, cursor: "pointer" } }, "+ Add Topic")), items.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "#777", fontSize: 12, textAlign: "center", padding: 40 } }, "No voting items yet."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, (function() {
      var openItems = items.filter(function(i) {
        return !isRevealed(i);
      });
      var closedItems = items.filter(function(i) {
        return isRevealed(i);
      });
      var allItems = openItems.concat(closedItems);
      return allItems.map(function(item, idx) {
        var iv = itemVotes(item);
        var revealed = isRevealed(item);
        var t = tally(item);
        var showDivider = idx === openItems.length && closedItems.length > 0 && openItems.length > 0;
        return /* @__PURE__ */ React.createElement(React.Fragment, { key: item.id }, showDivider && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "6px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: "0.5px", background: "#e0d8cc" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 } }, "Closed"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: "0.5px", background: "#e0d8cc" } })), /* @__PURE__ */ React.createElement(
          "div",
          {
            key: item.id,
            onClick: function() {
              setSelected(item);
              setVoteForm({ voter: "", choice: "", note: "" });
            },
            style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 4, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s" },
            onMouseEnter: function(e) {
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)";
            },
            onMouseLeave: function(e) {
              e.currentTarget.style.boxShadow = "none";
            }
          },
          /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 600, color: "#2a2a2a", marginBottom: 4 } }, item.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, item.submitted_by ? /* @__PURE__ */ React.createElement("span", null, "Submitted by ", item.submitted_by, item.due_date ? " \xB7 " : "") : null, item.due_date ? /* @__PURE__ */ React.createElement("span", null, "Due ", fmtDate(item.due_date)) : null, item.meeting_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Meeting ", fmtDate(item.meeting_date)) : null)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginLeft: 16, flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777" } }, iv.length, "/", BOARD_MEMBERS.length, " voted"), revealed ? /* @__PURE__ */ React.createElement("span", { style: { background: "#e8f5e9", color: "#2e7d32", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 4 } }, "Closed \u2013 Decision Made") : /* @__PURE__ */ React.createElement("span", { style: { background: "#fff3e0", color: "#e65100", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 4 } }, "Open"))),
          revealed && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 10 } }, [["Yes", t.yes, "#2e7d32"], ["No", t.no, "#c62828"], ["Abstain", t.abstain, "#e65100"]].map(function(entry) {
            return /* @__PURE__ */ React.createElement("div", { key: entry[0], style: { fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { color: entry[2], fontWeight: 600 } }, entry[1]), /* @__PURE__ */ React.createElement("span", { style: { color: "#777" } }, " ", entry[0]));
          }))
        ));
      });
    })()), selected && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "#fff", zIndex: 1011, boxShadow: "-4px 0 32px rgba(0,0,0,0.12)", overflowY: "auto", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 24px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 } }, "\u2190 Back"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb", lineHeight: 1 } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: "24px 28px", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 600, color: "#2a2a2a", marginBottom: 6 } }, selected.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, selected.submitted_by ? /* @__PURE__ */ React.createElement("span", null, "Submitted by ", selected.submitted_by) : null, selected.due_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Due ", fmtDate(selected.due_date)) : null, selected.meeting_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Meeting ", fmtDate(selected.meeting_date)) : null)), selected.description && /* @__PURE__ */ React.createElement("div", { dangerouslySetInnerHTML: { __html: selected.description }, style: { fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16, padding: "12px 14px", background: "#faf8f4", borderRadius: 0, borderLeft: "3px solid " + gold } }), selected.attachment_url && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("a", { href: selected.attachment_url, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 12, color: gold, textDecoration: "none" } }, "\u{1F4CE} View Attachment")), isRevealed(selected) ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 12 } }, "Results"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 } }, (function() {
      var t = tally(selected);
      return [
        { label: "Yes", count: t.yes, bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32" },
        { label: "No", count: t.no, bg: "#ffebee", border: "#ef9a9a", color: "#c62828" },
        { label: "Abstain / Not in Attendance", count: t.abstain + t.absent, bg: "#f5f5f5", border: "#e0e0e0", color: "#888" }
      ].map(function(entry) {
        return /* @__PURE__ */ React.createElement("div", { key: entry.label, style: { background: entry.bg, border: "1px solid " + entry.border, borderRadius: 4, padding: "14px 16px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: entry.color, lineHeight: 1 } }, entry.count), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: entry.color, fontWeight: 600, marginTop: 4, opacity: 0.8 } }, entry.label));
      });
    })()), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 10 } }, "Individual Votes"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 } }, BOARD_MEMBERS.map(function(m) {
      var mv = itemVotes(selected).find(function(v) {
        return v.voter === m;
      });
      if (!mv) return /* @__PURE__ */ React.createElement("div", { key: m, style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fafafa", borderRadius: 2, fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500, color: "#2a2a2a" } }, m), /* @__PURE__ */ React.createElement("span", { style: { color: "#999" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { color: "#777", fontSize: 12 } }, "No vote"));
      var vc = VOTE_COLORS[mv.choice] || { bg: "#f5f5f5", color: "#888" };
      return /* @__PURE__ */ React.createElement("div", { key: m, style: { padding: "8px 12px", background: "#fafafa", borderRadius: 2, fontSize: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500, color: "#2a2a2a" } }, m), /* @__PURE__ */ React.createElement("span", { style: { color: "#999" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, mv.choice), mv.changed_in_meeting && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", fontWeight: 600, padding: "2px 8px", borderRadius: 20 } }, "Changed in meeting")), mv.note && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 4, fontStyle: "italic" } }, mv.note));
    }))) : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 12 } }, "Votes \xB7 ", itemVotes(selected).length, "/", BOARD_MEMBERS.length, " submitted"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, BOARD_MEMBERS.map(function(m) {
      var mv = itemVotes(selected).find(function(v) {
        return v.voter === m;
      });
      var vc = mv ? VOTE_COLORS[mv.choice] || { bg: "#f5f5f5", color: "#888" } : null;
      return /* @__PURE__ */ React.createElement("div", { key: m, style: { background: "#fafafa", borderRadius: 2, padding: "10px 14px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: mv ? "#aaa" : "#2a2a2a" } }, m), mv && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "#999" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, mv.choice)), mv && mv.changed_in_meeting && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", fontWeight: 600, padding: "2px 8px", borderRadius: 20 } }, "Changed in meeting"), !mv && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777" } }, "No vote yet")), mv && mv.note && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 4, fontStyle: "italic" } }, mv.note));
    })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 20 } }, !showPostMeeting ? /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: function() {
          setShowPostMeeting(true);
          setVoteForm({ voter: "", choice: "", note: "" });
        },
        style: { fontSize: 12, color: gold, background: "none", border: "1px solid #e0d8cc", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 500 }
      },
      "+ Add Post-Meeting Votes"
    ) : /* @__PURE__ */ React.createElement("div", { style: { background: "#fafafa", borderRadius: 2, padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a", marginBottom: 12 } }, "Add Post-Meeting Vote"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Board Member"), /* @__PURE__ */ React.createElement("select", { value: voteForm.voter, onChange: function(e) {
      setVoteForm(function(f) {
        return Object.assign({}, f, { voter: e.target.value, choice: "", note: "" });
      });
    }, style: Object.assign({}, bInp, { marginTop: 4 }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select member\u2026"), BOARD_MEMBERS.map(function(m) {
      return /* @__PURE__ */ React.createElement("option", { key: m, value: m }, m);
    }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 } }, ["Yes", "No", "Abstain", "Not in attendance"].map(function(opt) {
      var vc2 = VOTE_COLORS[opt];
      var active = voteForm.choice === opt;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: opt,
          type: "button",
          onClick: function() {
            setVoteForm(function(f) {
              return Object.assign({}, f, { choice: opt });
            });
          },
          style: { padding: "6px 12px", borderRadius: 20, border: "1.5px solid " + (active ? vc2.color : "#e0d8cc"), background: active ? vc2.bg : "#fff", color: active ? vc2.color : "#888", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }
        },
        opt
      );
    })), /* @__PURE__ */ React.createElement("textarea", { value: voteForm.note, onChange: function(e) {
      setVoteForm(function(f) {
        return Object.assign({}, f, { note: e.target.value });
      });
    }, rows: 2, style: Object.assign({}, bInp, { resize: "vertical", marginBottom: 10 }), placeholder: "Note (optional)\u2026" }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleVoteSubmit,
        disabled: voteSaving || !voteForm.choice || !voteForm.voter,
        style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: voteSaving || !voteForm.choice || !voteForm.voter ? 0.6 : 1 }
      },
      voteSaving ? "Saving\u2026" : "Save Vote"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: function() {
          setShowPostMeeting(false);
          setVoteForm({ voter: "", choice: "", note: "" });
        },
        style: { padding: "8px 16px", background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 }
      },
      "Cancel"
    )))))))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowAdd(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 4, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, "New Voting Topic"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleTopicSubmit }, /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Title *"), /* @__PURE__ */ React.createElement("input", { required: true, value: topicForm.title, onChange: function(e) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { title: e.target.value });
      });
    }, style: bInp, placeholder: "Topic title\u2026" })), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Description"), /* @__PURE__ */ React.createElement(RichEditor, { value: topicForm.description, onChange: function(html) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { description: html });
      });
    }, placeholder: "Background, details, context\u2026" })), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Attachment"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 6, padding: "8px 12px", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", background: "#fff", fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { background: gold, color: "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 500, flexShrink: 0 } }, attachUploading ? "Uploading\u2026" : "Choose file"), /* @__PURE__ */ React.createElement("span", { style: { color: attachFileName ? "#2a2a2a" : "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, attachFileName || "No file chosen"), /* @__PURE__ */ React.createElement("input", { type: "file", onChange: handleAttachUpload, style: { display: "none" } })), topicForm.attachment_url && !attachUploading && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#2e7d32", marginTop: 4 } }, "\u2713 Uploaded")), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Submitted By"), /* @__PURE__ */ React.createElement("input", { value: topicForm.submitted_by, onChange: function(e) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { submitted_by: e.target.value });
      });
    }, style: bInp, placeholder: "Name\u2026" })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Due Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: topicForm.due_date, onChange: function(e) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { due_date: e.target.value });
      });
    }, style: bInp })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Meeting Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: topicForm.meeting_date, onChange: function(e) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { meeting_date: e.target.value });
      });
    }, style: bInp }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: topicSaving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: topicSaving ? 0.7 : 1 } }, topicSaving ? "Saving\u2026" : "Add Topic"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setShowAdd(false);
    }, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"))))));
  }
  var GOAL_STATUS_OPTS = ["Not started", "In progress", "On track", "Complete", "Blocked"];
  var GOAL_STATUS_COLORS = {
    "On track": { bg: "#e8f5e9", color: "#2e7d32" },
    "In progress": { bg: "#fff3e0", color: "#e65100" },
    "Complete": { bg: "#e3f2fd", color: "#1565c0" },
    "Blocked": { bg: "#ffebee", color: "#c62828" },
    "Not started": { bg: "#f5f5f5", color: "#888" }
  };
  var GOAL_TYPE_LABELS = { annual: "This Year", future: "Future Goals", three_year_vision: "3-Year Vision" };
  var CATEGORY_ORDER = ["Fund Development", "House and Grounds Development", "Programs and Events", "Organizational Development"];
  function StrategyView() {
    const { useState: useS, useEffect: useE } = React;
    const [goals, setGoals] = useS([]);
    const [loading, setLoading] = useS(true);
    const [tab, setTab] = useS("annual");
    const [activeCat, setActiveCat] = useS(null);
    const [editing, setEditing] = useS(null);
    const [editForm, setEditForm] = useS({});
    const [saving, setSaving] = useS(false);
    function load() {
      var url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Strategic Goals") + "?select=*&order=category,id";
      fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
        return r.json();
      }).then(function(d) {
        setGoals(Array.isArray(d) ? d : []);
        setLoading(false);
      });
    }
    useE(function() {
      load();
    }, []);
    function openEdit(g) {
      setEditing(g.id);
      setEditForm({ status: g.status || "Not started", lead: g.lead || "", due_date: g.due_date || "" });
    }
    function handleSave(g) {
      setSaving(true);
      sbPatchById("Strategic Goals", g.id, editForm).then(function() {
        setSaving(false);
        setEditing(null);
        load();
      });
    }
    var tabStyle = function(t) {
      return {
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 500,
        border: "none",
        borderRadius: 5,
        cursor: "pointer",
        background: tab === t ? gold : "#f0ebe2",
        color: tab === t ? "#fff" : "#666"
      };
    };
    if (loading) return /* @__PURE__ */ React.createElement("div", { style: { padding: 40, color: "#777", fontSize: 12 } }, "Loading\u2026");
    var filtered = activeCat ? goals.filter(function(g) {
      return g.goal_type === tab && g.category === activeCat;
    }) : [];
    function CatBox(cat) {
      var catGoals = goals.filter(function(g) {
        return g.category === cat && g.goal_type !== "three_year_vision";
      });
      var done = catGoals.filter(function(g) {
        return g.status === "Complete";
      }).length;
      var inprog = catGoals.filter(function(g) {
        return g.status === "In progress" || g.status === "On track";
      }).length;
      var pct = catGoals.length ? Math.round(done / catGoals.length * 100) : 0;
      var inprogPct = catGoals.length ? Math.round(inprog / catGoals.length * 100) : 0;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: cat,
          onClick: function() {
            setActiveCat(cat);
            setEditing(null);
          },
          style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" },
          onMouseEnter: function(e) {
            e.currentTarget.style.borderColor = gold;
            e.currentTarget.style.background = "#fdf8f0";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.borderColor = "#e8e0d5";
            e.currentTarget.style.background = "#fff";
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", marginBottom: 12, lineHeight: 1.3 } }, cat),
        /* @__PURE__ */ React.createElement("div", { style: { height: 10, background: "#ede8e0", borderRadius: 99, overflow: "hidden", display: "flex", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { width: pct + "%", background: "#4caf50", transition: "width 0.4s" } }), /* @__PURE__ */ React.createElement("div", { style: { width: inprogPct + "%", background: "#f5a623", transition: "width 0.4s" } })),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, fontSize: 12, color: "#888" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#4caf50", fontWeight: 600 } }, done, " complete"), /* @__PURE__ */ React.createElement("span", null, inprog, " in progress"), /* @__PURE__ */ React.createElement("span", null, catGoals.length - done - inprog, " not started"))
      );
    }
    return /* @__PURE__ */ React.createElement("div", null, !activeCat ? /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 } }, CATEGORY_ORDER.map(function(cat) {
      return CatBox(cat);
    })) : /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, padding: "20px 24px", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, activeCat), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setActiveCat(null);
      setEditing(null);
    }, style: { background: "none", border: "none", fontSize: 12, color: "#aaa", cursor: "pointer", padding: "4px 8px" } }, "\u2190 All areas")), filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, fontStyle: "italic", padding: "10px 0" } }, "No goals for this area.") : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 } }, filtered.map(function(g) {
      var sc = GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS["Not started"];
      var isEdit = editing === g.id;
      return /* @__PURE__ */ React.createElement("div", { key: g.id, style: { background: "#faf8f5", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 16px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", marginBottom: 4 } }, g.title), g.description && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", lineHeight: 1.5 } }, g.description)), tab !== "three_year_vision" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } }, g.status && /* @__PURE__ */ React.createElement("span", { style: { background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, g.status), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: function() {
            isEdit ? setEditing(null) : openEdit(g);
          },
          style: { fontSize: 12, color: isEdit ? "#aaa" : gold, background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }
        },
        isEdit ? "Cancel" : "Edit"
      ))), tab !== "three_year_vision" && !isEdit && (g.lead || g.due_date) && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16, marginTop: 8 } }, g.lead && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "Lead: ", /* @__PURE__ */ React.createElement("span", { style: { color: "#555" } }, g.lead)), g.due_date && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "Due: ", /* @__PURE__ */ React.createElement("span", { style: { color: "#555" } }, g.due_date))), isEdit && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, paddingTop: 14, borderTop: "0.5px solid #f0ebe2" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Status"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: editForm.status,
          onChange: function(e) {
            setEditForm(function(f) {
              return Object.assign({}, f, { status: e.target.value });
            });
          },
          style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 12, background: "#fff" }
        },
        GOAL_STATUS_OPTS.map(function(s) {
          return /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s);
        })
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Lead"), /* @__PURE__ */ React.createElement(
        "input",
        {
          value: editForm.lead,
          onChange: function(e) {
            setEditForm(function(f) {
              return Object.assign({}, f, { lead: e.target.value });
            });
          },
          style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 12, boxSizing: "border-box" },
          placeholder: "Name\u2026"
        }
      ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Due Date"), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "date",
          value: editForm.due_date,
          onChange: function(e) {
            setEditForm(function(f) {
              return Object.assign({}, f, { due_date: e.target.value });
            });
          },
          style: { padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 12 }
        }
      )), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: function() {
            handleSave(g);
          },
          disabled: saving,
          style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 }
        },
        saving ? "Saving\u2026" : "Save"
      )));
    })), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid #f0ece6", paddingTop: 14, marginTop: 4, display: "flex", gap: 8 } }, ["annual", "future", "three_year_vision"].map(function(t) {
      return /* @__PURE__ */ React.createElement("button", { key: t, onClick: function() {
        setTab(t);
        setEditing(null);
      }, style: tabStyle(t) }, GOAL_TYPE_LABELS[t]);
    }))));
  }
  var CHALLENGE_OPTIONS = ["Capacity or volunteer limitations", "Budget or funding constraints", "Scheduling or timing issues", "Cross-area coordination gaps", "External factors", "Other"];
  var SUPPORT_OPTIONS = ["Staff or volunteer help", "Marketing or communications", "Board guidance or decision", "Funding or fundraising support", "Facilities or logistics", "Other"];
  function currentQuarterStr() {
    var m = (/* @__PURE__ */ new Date()).getMonth();
    return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
  }
  function quarterDueDate(q, yr) {
    if (q === "Q1") return new Date(yr, 2, 31);
    if (q === "Q2") return new Date(yr, 5, 30);
    if (q === "Q3") return new Date(yr, 8, 30);
    return new Date(yr, 11, 31);
  }
  function nextQ(q, yr) {
    return q === "Q1" ? { q: "Q2", yr } : q === "Q2" ? { q: "Q3", yr } : q === "Q3" ? { q: "Q4", yr } : { q: "Q1", yr: yr + 1 };
  }
  function QuarterlyView() {
    var { useState: useState2, useEffect: useEffect2 } = React;
    var cq = currentQuarterStr();
    var cy = (/* @__PURE__ */ new Date()).getFullYear();
    var [area, setArea] = useState2("");
    var [quarter, setQuarter] = useState2(cq);
    var [year, setYear] = useState2(cy);
    var [currentGoals, setCurrentGoals] = useState2(null);
    var emptyForm = { what_went_well: "", goal_1_status: "On Track", goal_1_summary: "", goal_2_status: "On Track", goal_2_summary: "", goal_3_status: "On Track", goal_3_summary: "", challenges: [], challenges_details: "", support_needed: [], support_details: "", other_notes: "", next_focus: "", goal_1: "", goal_2: "", goal_3: "" };
    var [form, setForm] = useState2(emptyForm);
    var [saving, setSaving] = useState2(false);
    var [saved, setSaved] = useState2(false);
    useEffect2(function() {
      if (!area) return;
      setCurrentGoals(null);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(quarter) + "&year=eq." + year + "&select=*", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows[0]) {
          setCurrentGoals(rows[0]);
          setForm(function(f) {
            return Object.assign({}, f, {
              goal_1_status: rows[0].goal_1_status || "On Track",
              goal_1_summary: rows[0].goal_1_summary || "",
              goal_2_status: rows[0].goal_2_status || "On Track",
              goal_2_summary: rows[0].goal_2_summary || "",
              goal_3_status: rows[0].goal_3_status || "On Track",
              goal_3_summary: rows[0].goal_3_summary || ""
            });
          });
        }
      });
    }, [area, quarter, year]);
    function toggleCheck(field, val) {
      setForm(function(f) {
        var arr = f[field];
        var next = arr.indexOf(val) !== -1 ? arr.filter(function(x) {
          return x !== val;
        }) : arr.concat([val]);
        var patch = {};
        patch[field] = next;
        return Object.assign({}, f, patch);
      });
    }
    function handleSubmit(e) {
      e.preventDefault();
      setSaving(true);
      var nq = nextQ(quarter, year);
      var payload = { area, quarter, year, date_submitted: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), successes: form.what_went_well, goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary, challenges: form.challenges, challenges_details: form.challenges_details, support_needed: form.support_needed, support_details: form.support_details, other_notes: form.other_notes, next_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3 };
      var currentGoalsUpdate = currentGoals ? fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?id=eq." + currentGoals.id, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ goal_1_status: form.goal_1_status, goal_1_summary: form.goal_1_summary, goal_2_status: form.goal_2_status, goal_2_summary: form.goal_2_summary, goal_3_status: form.goal_3_status, goal_3_summary: form.goal_3_summary })
      }) : Promise.resolve();
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarterly Updates"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.json();
      }).then(function() {
        var goalsPayload = { area, quarter: nq.q, year: nq.yr, primary_focus: form.next_focus, goal_1: form.goal_1, goal_2: form.goal_2, goal_3: form.goal_3 };
        return Promise.all([
          fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals"), {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify(goalsPayload)
          }),
          currentGoalsUpdate
        ]);
      }).then(function() {
        setSaving(false);
        setSaved(true);
        setForm(emptyForm);
        setTimeout(function() {
          setSaved(false);
        }, 4e3);
      });
    }
    var secStyle = { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 12, marginTop: 4, display: "block" };
    var inpStyle = { width: "100%", padding: "9px 12px", border: "0.5px solid #e0d8cc", borderRadius: 6, fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff", color: "#2a2a2a" };
    var grp = { marginBottom: 16 };
    var card = { background: "#fff", border: "0.5px solid #e8e0d5", borderTop: "none", padding: "22px 28px" };
    var cardFirst = { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: "10px 10px 0 0", padding: "22px 28px" };
    var cardLast = { background: "#fff", border: "0.5px solid #e8e0d5", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "22px 28px", marginBottom: 20 };
    var lbl = { fontSize: 13, color: "#444", fontWeight: 500 };
    var nqLabel = nextQ(quarter, year).q + " " + nextQ(quarter, year).yr;
    return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: "100%" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "14px 20px", marginBottom: 20, fontSize: 13, color: "#777", lineHeight: 1.6, fontStyle: "italic" } }, "Share quarterly progress, challenges, and support needs for each focus area."), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("div", { style: cardFirst }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Area & Period"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Organizational Area *"), /* @__PURE__ */ React.createElement("select", { required: true, value: area, onChange: function(e) {
      setArea(e.target.value);
    }, style: inpStyle }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select area..."), OPERATIONAL_AREAS.map(function(a) {
      return /* @__PURE__ */ React.createElement("option", { key: a }, a);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Quarter *"), /* @__PURE__ */ React.createElement("select", { required: true, value: quarter, onChange: function(e) {
      setQuarter(e.target.value);
    }, style: inpStyle }, /* @__PURE__ */ React.createElement("option", null, "Q1"), /* @__PURE__ */ React.createElement("option", null, "Q2"), /* @__PURE__ */ React.createElement("option", null, "Q3"), /* @__PURE__ */ React.createElement("option", null, "Q4"))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Year"), /* @__PURE__ */ React.createElement("input", { type: "number", value: year, onChange: function(e) {
      setYear(parseInt(e.target.value) || cy);
    }, style: inpStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Date Submitted"), /* @__PURE__ */ React.createElement("input", { readOnly: true, value: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US"), style: Object.assign({}, inpStyle, { background: "#f9f7f4", color: "#999" }) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Due Date"), /* @__PURE__ */ React.createElement("input", { readOnly: true, value: quarterDueDate(quarter, year).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), style: Object.assign({}, inpStyle, { background: "#f9f7f4", color: "#999" }) })))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Goal Progress"), currentGoals && currentGoals.primary_focus && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: "10px 14px", background: "#faf8f5", borderRadius: 6, borderLeft: "3px solid " + gold } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: gold, fontWeight: 600, marginBottom: 4 } }, "Primary Focus \u2014 ", quarter, " ", year), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a" } }, currentGoals.primary_focus)), currentGoals ? [["goal_1", "goal_1_status", "goal_1_summary"], ["goal_2", "goal_2_status", "goal_2_summary"], ["goal_3", "goal_3_status", "goal_3_summary"]].map(function(keys, i) {
      var goalText = currentGoals[keys[0]];
      if (!goalText) return null;
      var statusKey = keys[1];
      var summaryKey = keys[2];
      var statusColors2 = { "On Track": { bg: "#eaf3ea", color: "#3a7d3a" }, "Behind": { bg: "#fff3e0", color: "#c07040" }, "Complete": { bg: "#e8f5e9", color: "#2e7d32" }, "At Risk": { bg: "#fdecea", color: "#c62828" } };
      var sc = statusColors2[form[statusKey]] || statusColors2["On Track"];
      return /* @__PURE__ */ React.createElement("div", { key: keys[0], style: { borderBottom: i < 2 ? "0.5px solid #f0ece6" : "none", paddingBottom: 14, marginBottom: i < 2 ? 14 : 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#2a2a2a", fontWeight: 500, marginBottom: 8 } }, i + 1, ". ", goalText), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Status"), /* @__PURE__ */ React.createElement("select", { value: form[statusKey], onChange: function(e) {
        var v = e.target.value;
        setForm(function(f) {
          var p = {};
          p[statusKey] = v;
          return Object.assign({}, f, p);
        });
      }, style: Object.assign({}, inpStyle, { background: sc.bg, color: sc.color, fontWeight: 600 }) }, /* @__PURE__ */ React.createElement("option", null, "On Track"), /* @__PURE__ */ React.createElement("option", null, "Behind"), /* @__PURE__ */ React.createElement("option", null, "At Risk"), /* @__PURE__ */ React.createElement("option", null, "Complete"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Progress Summary"), /* @__PURE__ */ React.createElement("input", { value: form[summaryKey], onChange: function(e) {
        var v = e.target.value;
        setForm(function(f) {
          var p = {};
          p[summaryKey] = v;
          return Object.assign({}, f, p);
        });
      }, style: inpStyle, placeholder: "Brief update on this goal..." }))));
    }) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#bbb", fontStyle: "italic" } }, "Select an area and quarter to update goal statuses.")), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "What Went Well"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Successes & Forward Movement"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#888", marginBottom: 4 } }, "Goals achieved and measurable progress this quarter."), /* @__PURE__ */ React.createElement("textarea", { value: form.what_went_well, onChange: function(e) {
      setForm(function(f) {
        return Object.assign({}, f, { what_went_well: e.target.value });
      });
    }, rows: 4, style: Object.assign({}, inpStyle, { resize: "vertical" }) }))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Challenges Encountered"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 } }, CHALLENGE_OPTIONS.map(function(opt) {
      var on = form.challenges.indexOf(opt) !== -1;
      return /* @__PURE__ */ React.createElement("label", { key: opt, style: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer", color: on ? "#2a2a2a" : "#555", userSelect: "none" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: on, onChange: function() {
        toggleCheck("challenges", opt);
      }, style: { width: 16, height: 16, accentColor: gold, cursor: "pointer", flexShrink: 0 } }), opt);
    })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Details"), /* @__PURE__ */ React.createElement("textarea", { value: form.challenges_details, onChange: function(e) {
      setForm(function(f) {
        return Object.assign({}, f, { challenges_details: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpStyle, { resize: "vertical" }) }))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Support Needed to Stay on Track"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 } }, SUPPORT_OPTIONS.map(function(opt) {
      var on = form.support_needed.indexOf(opt) !== -1;
      return /* @__PURE__ */ React.createElement("label", { key: opt, style: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer", color: on ? "#2a2a2a" : "#555", userSelect: "none" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: on, onChange: function() {
        toggleCheck("support_needed", opt);
      }, style: { width: 16, height: 16, accentColor: gold, cursor: "pointer", flexShrink: 0 } }), opt);
    })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Details"), /* @__PURE__ */ React.createElement("textarea", { value: form.support_details, onChange: function(e) {
      setForm(function(f) {
        return Object.assign({}, f, { support_details: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpStyle, { resize: "vertical" }) }))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Other Notes"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Decisions or approvals needed"), /* @__PURE__ */ React.createElement("textarea", { value: form.other_notes, onChange: function(e) {
      setForm(function(f) {
        return Object.assign({}, f, { other_notes: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpStyle, { resize: "vertical" }) }))), /* @__PURE__ */ React.createElement("div", { style: cardLast }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Next Quarter Focus & Goals"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginBottom: 12 } }, "These will auto-populate as ", nqLabel, " goals for ", area || "this area", "."), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Primary Focus for Next Quarter"), /* @__PURE__ */ React.createElement("input", { value: form.next_focus, onChange: function(e) {
      setForm(function(f) {
        return Object.assign({}, f, { next_focus: e.target.value });
      });
    }, style: inpStyle, placeholder: "Primary focus..." })), ["goal_1", "goal_2", "goal_3"].map(function(key, i) {
      return /* @__PURE__ */ React.createElement("div", { key, style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, i + 1, "."), /* @__PURE__ */ React.createElement("input", { value: form[key], onChange: function(e) {
        var v = e.target.value;
        setForm(function(f) {
          var p = {};
          p[key] = v;
          return Object.assign({}, f, p);
        });
      }, style: inpStyle, placeholder: "Goal " + (i + 1) + "..." }));
    })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving || !area, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 14, fontWeight: 600, cursor: saving || !area ? "not-allowed" : "pointer", opacity: saving || !area ? 0.6 : 1, width: "100%", marginBottom: 8 } }, saving ? "Submitting..." : "Submit Quarterly Update"), saved && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", color: "#2e7d32", fontSize: 13, fontWeight: 600, padding: 8 } }, "Submitted! Next quarter goals saved.")));
  }
  function OperationalView({ opArea }) {
    var { useState: useState2, useEffect: useEffect2 } = React;
    var area = opArea || OPERATIONAL_AREAS[0];
    var [areaInfo, setAreaInfo] = useState2(null);
    var [budget, setBudget] = useState2([]);
    var [vols, setVols] = useState2([]);
    var [showBudget, setShowBudget] = useState2(false);
    var [showVols, setShowVols] = useState2(false);
    var [editLead, setEditLead] = useState2(false);
    var [leadInput, setLeadInput] = useState2("");
    var today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    var [budgetForm, setBudgetForm] = useState2({ type: "Purchase", description: "", amount: "", date: today });
    var [budgetSaving, setBudgetSaving] = useState2(false);
    var [uploadingId, setUploadingId] = useState2(null);
    var fileInputRef = React.useRef(null);
    var [noteEdit, setNoteEdit] = useState2(null);
    var [noteVal, setNoteVal] = useState2("");
    var [noteSaving, setNoteSaving] = useState2(null);
    var [quarterGoals, setQuarterGoals] = useState2(null);
    var cq = currentQuarterStr();
    useEffect2(function() {
      setAreaInfo(null);
      setBudget([]);
      setVols([]);
      setQuarterGoals(null);
      setEditLead(false);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(cq) + "&year=eq." + (/* @__PURE__ */ new Date()).getFullYear() + "&select=*", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows[0]) setQuarterGoals(rows[0]);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Operational Areas") + "?area=eq." + encodeURIComponent(area) + "&select=*", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows[0]) {
          setAreaInfo(rows[0]);
          setLeadInput(rows[0].lead || "");
        }
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?area=eq." + encodeURIComponent(area) + "&select=*&order=date.desc,id.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setBudget(rows);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("2026 Volunteers") + "?select=" + ["id", "First Name", "Last Name", "Team", "Notes", "Overview Notes", "Status", "Picture URL"].map(function(c) {
        return encodeURIComponent(c);
      }).join(","), {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (!Array.isArray(rows)) return;
        setVols(rows.filter(function(v) {
          if (!v.Team) return false;
          var areaAliases = { "Events": ["events team", "event support", "events"], "Docents": ["docent", "docents"] };
          var matches = areaAliases[area] || [area.toLowerCase()];
          return v.Team.split(",").some(function(t) {
            return matches.indexOf(t.trim().toLowerCase()) !== -1;
          });
        }));
      });
    }, [area]);
    function saveLead() {
      if (!areaInfo) return;
      sbPatchById("Operational Areas", areaInfo.id, { lead: leadInput }).then(function() {
        setAreaInfo(Object.assign({}, areaInfo, { lead: leadInput }));
        setEditLead(false);
      });
    }
    function addBudgetItem(e) {
      e.preventDefault();
      setBudgetSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ area, type: budgetForm.type, description: budgetForm.description, amount: parseFloat(budgetForm.amount) || 0, date: budgetForm.date || null })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setBudgetSaving(false);
        if (rows && rows[0]) setBudget(function(prev) {
          return [rows[0]].concat(prev);
        });
        setBudgetForm({ type: "Purchase", description: "", amount: "", date: today });
      });
    }
    function deleteBudgetItem(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        setBudget(function(prev) {
          return prev.filter(function(b) {
            return b.id !== id;
          });
        });
      });
    }
    function handleReceiptSelect(e) {
      var file = e.target.files[0];
      if (!file || !uploadingId) {
        e.target.value = "";
        return;
      }
      var id = uploadingId;
      var ext = file.name.split(".").pop();
      var filename = area.toLowerCase().replace(/\s+/g, "-") + "-" + id + "-" + Date.now() + "." + ext;
      fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + filename, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
        body: file
      }).then(function() {
        var url = SUPABASE_URL + "/storage/v1/object/public/receipts/" + filename;
        return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + id, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ receipt_url: url })
        }).then(function() {
          setBudget(function(prev) {
            return prev.map(function(b) {
              return b.id === id ? Object.assign({}, b, { receipt_url: url }) : b;
            });
          });
          setUploadingId(null);
          e.target.value = "";
        });
      });
    }
    function saveNote(v) {
      setNoteSaving(v.id);
      sbUpdate("2026 Volunteers", v["First Name"], v["Last Name"], { Notes: noteVal }).then(function() {
        setVols(function(prev) {
          return prev.map(function(x) {
            return x.id === v.id ? Object.assign({}, x, { Notes: noteVal }) : x;
          });
        });
        setNoteEdit(null);
        setNoteSaving(null);
      });
    }
    var totalPurchases = budget.filter(function(b) {
      return b.type === "Purchase";
    }).reduce(function(s, b) {
      return s + (parseFloat(b.amount) || 0);
    }, 0);
    var totalInKind = budget.filter(function(b) {
      return b.type === "In-Kind";
    }).reduce(function(s, b) {
      return s + (parseFloat(b.amount) || 0);
    }, 0);
    var totalSpent = totalPurchases + totalInKind;
    var areaDefaults = AREA_DEFAULTS[area] || {};
    var allocation = areaDefaults.budget;
    var defaultLead = areaDefaults.lead || "";
    function fmt(n) {
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    var cardHover = { cursor: "pointer", background: "#faf8f5", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 150 };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "22px 26px", border: "0.5px solid #e8e0d5", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 6 } }, "Operational Area"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, areaDefaults.icon && React.createElement("svg", { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 }, dangerouslySetInnerHTML: { __html: areaDefaults.icon } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, area))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 6 } }, "Lead"), editLead ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { value: leadInput, onChange: function(e) {
      setLeadInput(e.target.value);
    }, autoFocus: true, style: { fontSize: 14, padding: "5px 8px", border: "0.5px solid #e0d8cc", borderRadius: 6, width: 150 } }), /* @__PURE__ */ React.createElement("button", { onClick: saveLead, style: { background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" } }, "Save"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setEditLead(false);
    }, style: { background: "#f0ece6", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#666" } }, "Cancel")) : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 15, color: "#2a2a2a", fontWeight: 500 } }, areaInfo && areaInfo.lead ? areaInfo.lead : defaultLead ? defaultLead : /* @__PURE__ */ React.createElement("span", { style: { color: "#ccc", fontStyle: "italic" } }, "Not set")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setEditLead(true);
    }, style: { background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#bbb", padding: "2px 6px", borderRadius: 4 } }, "Edit")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: function() {
          setShowBudget(true);
        },
        style: cardHover,
        onMouseEnter: function(e) {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        },
        onMouseLeave: function(e) {
          e.currentTarget.style.boxShadow = "none";
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 8 } }, "Budget"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: gold } }, allocation ? fmt(allocation) : fmt(totalPurchases)),
      allocation != null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 3 } }, fmt(totalPurchases), " / ", fmt(allocation)),
      allocation == null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 4, fontStyle: "italic" } }, "No budget established"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 } }, "View / Add entries \u2192")
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: function() {
          setShowVols(true);
        },
        style: cardHover,
        onMouseEnter: function(e) {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        },
        onMouseLeave: function(e) {
          e.currentTarget.style.boxShadow = "none";
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 8 } }, "Volunteers"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#2a2a2a" } }, vols.length),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 4 } }, "assigned to ", area),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 } }, "View / Add notes \u2192")
    ))), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "18px 24px", border: "0.5px solid #e8e0d5", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 10 } }, cq, " ", (/* @__PURE__ */ new Date()).getFullYear(), " Goals"), quarterGoals ? /* @__PURE__ */ React.createElement("div", null, quarterGoals.primary_focus && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a", marginBottom: 12 } }, quarterGoals.primary_focus), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, [["goal_1", "goal_1_status", "goal_1_summary"], ["goal_2", "goal_2_status", "goal_2_summary"], ["goal_3", "goal_3_status", "goal_3_summary"]].map(function(keys, i) {
      var g = quarterGoals[keys[0]];
      if (!g) return null;
      var st = quarterGoals[keys[1]];
      var sm = quarterGoals[keys[2]];
      var stColors = { "On Track": { bg: "#eaf3ea", color: "#3a7d3a" }, "Behind": { bg: "#fff3e0", color: "#c07040" }, "Complete": { bg: "#e8f5e9", color: "#2e7d32" }, "At Risk": { bg: "#fdecea", color: "#c62828" } };
      var sc = st && stColors[st] ? stColors[st] : null;
      return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 } }, /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 600, flexShrink: 0, marginTop: 1 } }, i + 1, "."), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#2a2a2a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, g), sc && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0 } }, st)), sm && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 2 } }, sm)));
    }))) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#ccc", fontStyle: "italic" } }, "No goals set for ", cq, " yet. Submit a quarterly update to populate.")), showBudget && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowBudget(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a" } }, area, " \u2014 Budget"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowBudget(false);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb" } }, "x")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 } }, [{ label: "Purchases", val: totalPurchases, color: "#c07040" }, { label: "In-Kind", val: totalInKind, color: "#5a8a5a" }, { label: "Total", val: totalPurchases + totalInKind, color: gold }].map(function(s) {
      return /* @__PURE__ */ React.createElement("div", { key: s.label, style: { background: "#faf8f5", borderRadius: 8, padding: "10px 14px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600 } }, s.label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 } }, fmt(s.val)));
    })), /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 10, padding: "14px 16px", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 12 } }, "Add Entry"), /* @__PURE__ */ React.createElement("form", { onSubmit: addBudgetItem }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Type"), /* @__PURE__ */ React.createElement("select", { value: budgetForm.type, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { type: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13, background: "#fff" } }, /* @__PURE__ */ React.createElement("option", null, "Purchase"), /* @__PURE__ */ React.createElement("option", null, "In-Kind"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Amount ($)"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", min: "0", value: budgetForm.amount, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { amount: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "0.00" }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Description"), /* @__PURE__ */ React.createElement("input", { value: budgetForm.description, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { description: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "What was purchased or donated..." })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "flex-end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: budgetForm.date, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 } })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: budgetSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: budgetSaving ? 0.7 : 1 } }, "Add")))), budget.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, textAlign: "center", padding: "20px 0" } }, "No entries yet.") : budget.map(function(b) {
      var isUploading = uploadingId === b.id;
      return /* @__PURE__ */ React.createElement("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ece6" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 500, background: b.type === "Purchase" ? "#fef0e6" : "#eaf3ea", color: b.type === "Purchase" ? "#c07040" : "#5a8a5a", flexShrink: 0 } }, b.type), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: 13, color: "#2a2a2a" } }, b.description || "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", flexShrink: 0 } }, fmt(parseFloat(b.amount) || 0)), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#bbb", flexShrink: 0 } }, b.date), b.receipt_url ? /* @__PURE__ */ React.createElement("a", { href: b.receipt_url, target: "_blank", title: "View receipt", style: { fontSize: 14, color: gold, textDecoration: "none", flexShrink: 0 } }, "\u{1F4CE}") : /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setUploadingId(b.id);
        fileInputRef.current.click();
      }, disabled: isUploading, title: "Attach receipt", style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 13, padding: "2px 4px", flexShrink: 0, opacity: isUploading ? 0.5 : 1 } }, isUploading ? "\u2026" : "\u{1F4CE}"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        deleteBudgetItem(b.id);
      }, style: { background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 14, padding: "2px 4px", flexShrink: 0 } }, "\xD7"));
    }), /* @__PURE__ */ React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/*,.pdf", style: { display: "none" }, onChange: handleReceiptSelect }))), showVols && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowVols(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 500, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a" } }, area, " Volunteers (", vols.length, ")"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowVols(false);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb" } }, "x")), vols.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, textAlign: "center", padding: "30px 0" } }, "No volunteers assigned to ", area, ".") : vols.map(function(v) {
      var isEditing = noteEdit === v.id;
      return /* @__PURE__ */ React.createElement("div", { key: v.id, style: { borderBottom: "0.5px solid #f0ece6", paddingBottom: 14, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" } }, v["Picture URL"] ? /* @__PURE__ */ React.createElement("img", { src: driveImg(v["Picture URL"]), alt: v["First Name"], style: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: "#f0ece6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#999", flexShrink: 0 } }, (v["First Name"] || "?")[0]), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a" } }, v["First Name"], " ", v["Last Name"]), v["Overview Notes"] && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "#ccc" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#777" } }, v["Overview Notes"])), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: v.Status || "Active",
          onChange: function(e) {
            var newStatus = e.target.value;
            sbUpdate("2026 Volunteers", v["First Name"], v["Last Name"], { Status: newStatus });
            setVols(function(prev) {
              return prev.map(function(x) {
                return x.id === v.id ? Object.assign({}, x, { Status: newStatus }) : x;
              });
            });
          },
          style: { marginLeft: "auto", fontSize: 11, padding: "2px 6px", border: "0.5px solid #e0d8cc", borderRadius: 5, color: v.Status === "Active" ? "#5a8a5a" : "#aaa", background: "#fff", cursor: "pointer" }
        },
        /* @__PURE__ */ React.createElement("option", null, "Active"),
        /* @__PURE__ */ React.createElement("option", null, "Inactive")
      )), isEditing ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("textarea", { value: noteVal, onChange: function(e) {
        setNoteVal(e.target.value);
      }, rows: 3, autoFocus: true, style: { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, fontFamily: "system-ui, sans-serif", resize: "vertical", boxSizing: "border-box" } }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
        saveNote(v);
      }, disabled: noteSaving === v.id, style: { background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: noteSaving === v.id ? 0.7 : 1 } }, noteSaving === v.id ? "Saving..." : "Save"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setNoteEdit(null);
      }, style: { background: "#f0ece6", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", color: "#666" } }, "Cancel"))) : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: v.Notes ? "#555" : "#ccc", fontStyle: v.Notes ? "normal" : "italic", lineHeight: 1.5 } }, v.Notes || "No notes"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setNoteEdit(v.id);
        setNoteVal(v.Notes || "");
      }, style: { flexShrink: 0, fontSize: 11, color: gold, background: "none", border: "none", cursor: "pointer", fontWeight: 500 } }, "Edit note")));
    }))));
  }
  var views = {
    home: HomeView,
    events: EventsView,
    quarterly: QuarterlyView,
    volunteers: VolunteersView,
    donors: DonorsView,
    marketing: MarketingView,
    board: BoardView,
    strategy: StrategyView,
    operational: OperationalView
  };
  var OPERATIONAL_AREAS = ["Construction", "Grounds", "Interiors", "Docents", "Fundraising", "Events", "Marketing", "Venue"];
  var AREA_DEFAULTS = {
    "Construction": { lead: "Rick Panos", budget: 12e3, icon: '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/>' },
    "Grounds": { lead: "Paula Campbell", budget: 14e3, icon: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 1 1.3 4.2c-1.2 0-2.5-.2-3.7-.8-.5-2.1-.2-4 .9-5.5 1.2.3 2 .9 2.7 1.8z"/>' },
    "Interiors": { lead: "Rebeka Freeman", budget: 2500, icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>' },
    "Docents": { lead: "Rich Hill", budget: 1e3, icon: '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>' },
    "Fundraising": { lead: "Kaelen Jennings", budget: null, icon: '<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
    "Events": { lead: "Barb Kusha", budget: 7500, icon: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/>' },
    "Marketing": { lead: "Haley Wright", budget: 1e3, icon: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>' },
    "Venue": { lead: "Staff", budget: null, icon: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>' }
  };
  function Dashboard() {
    const [active, setActive] = useState("home");
    const [opOpen, setOpOpen] = useState(false);
    const [opArea, setOpArea] = useState(null);
    const View = views[active];
    const mod = modules.find((m) => m.id === active);
    return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", minHeight: "100vh", background: cream, fontFamily: "system-ui, sans-serif" } }, /* @__PURE__ */ React.createElement("style", null, ".nsh-sidebar::-webkit-scrollbar { display: none; }"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", position: "sticky", top: 0, height: "100vh", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "nsh-sidebar", style: { width: 220, background: "#2a2a2e", display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", scrollbarWidth: "none" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 20px 14px", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("img", { src: "assets/logo.png", alt: "North Star House", style: { width: 195, display: "block" } })), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "0 0 8px" } }), /* @__PURE__ */ React.createElement("nav", { style: { flex: 1, padding: "0 8px" } }, modules.filter((m) => !m.hidden).map((m) => /* @__PURE__ */ React.createElement("button", { key: m.id, onClick: () => {
      setActive(m.id);
      setOpOpen(false);
    }, style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "9px 12px",
      background: active === m.id ? "rgba(181,161,133,0.15)" : "transparent",
      border: "none",
      borderRadius: 7,
      cursor: "pointer",
      textAlign: "left",
      color: active === m.id ? "#f0ebe3" : "rgba(255,255,255,0.5)",
      fontSize: 12,
      fontWeight: active === m.id ? 600 : 400,
      marginBottom: 2,
      transition: "all 0.15s"
    } }, /* @__PURE__ */ React.createElement(NavIcon, { id: m.id, active: active === m.id }), m.label))), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 8px 16px", borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setOpOpen((o) => !o), style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 8,
      cursor: "pointer",
      textAlign: "left",
      background: opOpen ? "rgba(181,161,133,0.15)" : "rgba(255,255,255,0.05)",
      border: "0.5px solid rgba(255,255,255,0.12)",
      color: opOpen ? "#f0ebe3" : "rgba(255,255,255,0.5)",
      fontSize: 13,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 8,
      transition: "all 0.15s"
    } }, /* @__PURE__ */ React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0, opacity: 0.8 } }, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "21", x2: "16", y2: "21" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "17", x2: "12", y2: "21" })), "Operational Areas", /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: 10, opacity: 0.6 } }, opOpen ? "\u25B2" : "\u25B6"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 20px 20px" } })), /* @__PURE__ */ React.createElement("div", { style: {
      width: opOpen ? 180 : 0,
      overflow: "hidden",
      transition: "width 0.25s ease",
      background: "#222226",
      borderLeft: opOpen ? "0.5px solid rgba(255,255,255,0.06)" : "none",
      display: "flex",
      flexDirection: "column",
      height: "100vh"
    } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "24px 0 16px 0", opacity: opOpen ? 1 : 0, transition: "opacity 0.2s ease 0.05s", whiteSpace: "nowrap" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", padding: "0 16px", marginBottom: 10 } }, "Areas"), OPERATIONAL_AREAS.map(function(area) {
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: area,
          onClick: function() {
            setOpArea(area);
            setActive("operational");
          },
          style: {
            display: "block",
            width: "100%",
            padding: "9px 16px",
            background: opArea === area && active === "operational" ? "rgba(181,161,133,0.15)" : "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            color: opArea === area && active === "operational" ? "#b5a185" : "rgba(255,255,255,0.45)",
            fontSize: 13,
            fontWeight: opArea === area && active === "operational" ? 600 : 400,
            transition: "all 0.15s"
          }
        },
        area
      );
    })))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fdfcfb", padding: "24px 32px 18px", borderBottom: "3px solid rgba(136,108,68,0.35)", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { width: 38, height: 38, borderRadius: 9, background: "rgba(136,108,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(NavIcon, { id: active, active: true })), /* @__PURE__ */ React.createElement("h1", { style: { margin: 0, fontSize: 26, fontWeight: 700, color: gold, fontFamily: "'Cardo', serif", textShadow: "1px 2px 0px rgba(136,108,68,0.2)" } }, mod && mod.label))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, padding: "28px 32px" } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 900 } }, /* @__PURE__ */ React.createElement(View, { navigate: setActive, opArea })))));
  }
  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(Dashboard));
})();
