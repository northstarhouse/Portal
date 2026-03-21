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
  var modules = [
    { id: "home", label: "Overview", icon: "\u2302" },
    { id: "volunteers", label: "Volunteers", icon: "\u25CE" },
    { id: "donors", label: "Donors & Donations", icon: "\u25C7" },
    { id: "board", label: "Board Voting", icon: "\u25D1" },
    { id: "strategy", label: "Strategic Goal Progress", icon: "\u25C8" }
  ];
  var mockData = {
    events: [
      { name: "Spring Garden Tour", date: "Apr 12", status: "Confirmed", revenue: "$1,200", guests: 45 },
      { name: "Founder\u2019s Gala", date: "May 3", status: "Pending", revenue: "$4,800", guests: 120 },
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
    return /* @__PURE__ */ React.createElement("span", { style: { background: style.bg, color: style.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" } }, status);
  }
  function StatCard({ label, value, sub }) {
    return /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 18px", minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 120 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 4 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 500, color: "#2a2a2a" } }, value), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2, minHeight: 16 } }, sub || ""));
  }
  function Table({ cols, rows, renderRow }) {
    return /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, cols.map((c) => /* @__PURE__ */ React.createElement("th", { key: c, style: { textAlign: "left", padding: "8px 10px", color: "#999", fontWeight: 500, borderBottom: "0.5px solid #e8e0d4", whiteSpace: "nowrap" } }, c)))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((row, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: "0.5px solid #f0ebe2" } }, renderRow(row)))))));
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
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: gold, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 } }, "Today \u2014 March 20, 2026"), /* @__PURE__ */ React.createElement("h2", { style: { margin: 0, fontSize: 20, fontWeight: 500, color: "#2a2a2a" } }, "Good morning, North Star House"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "#888", margin: "4px 0 0" } }, "Here\u2019s your organization at a glance.")), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff4e5", border: "0.5px solid #e0c98a", borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, color: gold } }, "\u23CE"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: "#8a6200" } }, "Quarterly Update Due \u2014 March 31, 2026")), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", fontSize: 11, fontWeight: 500, color: "#c0392b", background: "#fce4e4", padding: "3px 10px", borderRadius: 20 } }, "11 days away")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("donors");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "YTD Donations", value: donationTotal === null ? "..." : "$" + donationTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: "of $50K goal" })), /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("volunteers");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Active Volunteers", value: activeVols === null ? "..." : activeVols })), /* @__PURE__ */ React.createElement(StatCard, { label: "2026 Events", value: "5", sub: "on the books" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Active Sponsors", value: "3", sub: "+ 1 in review" })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 } }, "Upcoming \u2014 NSH Calendar"), calEvents === null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#aaa" } }, "Loading\u2026"), calEvents !== null && calEvents.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#aaa" } }, "No upcoming events in the next 2 weeks."), calEvents !== null && calEvents.map(function(ev, i) {
      var start = parseIcalDate(ev["DTSTART"]);
      var isAllDay = ev["DTSTART"] && ev["DTSTART"].replace(/[^0-9TZ]/g, "").length === 8;
      var dayStr = start ? start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
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
      return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: "#2a2a2a" } }, title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2 } }, dayStr, timeStr !== "All day" ? " \xB7 " + timeStr : "")), label && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, background: labelBg, color: dotColor, borderRadius: 20, fontWeight: 500, flexShrink: 0, width: 90, textAlign: "center", display: "inline-block", padding: "2px 0" } }, label));
    }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0ebe2", fontSize: 11, color: "#bbb" } }, "Synced from Google Calendar")), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 } }, "In-House Events"), mockData.events.map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, e.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa" } }, e.date)), /* @__PURE__ */ React.createElement(Badge, { status: e.status }))))));
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
    "Support List": { bg: "#f0f4f8", color: "#3a5068" }
  };
  var TEAM_OPTIONS = Object.keys(TEAM_COLORS);
  function TeamPicker({ value, onChange }) {
    const { useState: useS } = React;
    const [open, setOpen] = useS(false);
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
      selected.length === 0 && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#bbb" } }, "Select teams..."),
      selected.map(function(t) {
        return /* @__PURE__ */ React.createElement("span", { key: t, style: { background: (TEAM_COLORS[t] || { bg: "#f3f3f3" }).bg, color: (TEAM_COLORS[t] || { color: "#555" }).color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" } }, t, /* @__PURE__ */ React.createElement(
          "span",
          {
            onClick: function(e) {
              e.stopPropagation();
              remove(t);
            },
            style: { cursor: "pointer", opacity: 0.6, fontSize: 14, lineHeight: 1, marginLeft: 2 }
          },
          "\xD7"
        ));
      }),
      /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: 11, color: "#bbb", flexShrink: 0 } }, open ? "\u25B2" : "\u25BC")
    ), open && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 100, marginTop: 4, padding: "6px 0", maxHeight: 220, overflowY: "auto" } }, TEAM_OPTIONS.map(function(opt) {
      var isOn = selected.indexOf(opt) !== -1;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: opt,
          onClick: function() {
            toggle(opt);
          },
          style: { padding: "8px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: isOn ? (TEAM_COLORS[opt] || { bg: "#f3f3f3" }).bg : "#fff", color: isOn ? (TEAM_COLORS[opt] || { color: "#555" }).color : "#2a2a2a" },
          onMouseEnter: function(e) {
            if (!isOn) e.currentTarget.style.background = "#faf8f4";
          },
          onMouseLeave: function(e) {
            if (!isOn) e.currentTarget.style.background = "#fff";
          }
        },
        opt,
        isOn && /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontSize: 14, fontWeight: 600 } }, "\u2713")
      );
    })));
  }
  var volInputStyle = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
  var volLabelStyle = { fontSize: 12, color: "#666", fontWeight: 500 };
  var volGrp = { marginBottom: 14 };
  var volSecLabel = { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#bbb", fontWeight: 600, marginBottom: 10, marginTop: 20, display: "block" };
  function VolForm({ form, onChange, saving, onSubmit, title, onCancel }) {
    return /* @__PURE__ */ React.createElement("div", { onClick: onCancel, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, title), /* @__PURE__ */ React.createElement("form", { onSubmit }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Basic Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "First Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "First Name", value: form["First Name"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Last Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Last Name", value: form["Last Name"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Status"), /* @__PURE__ */ React.createElement("select", { name: "Status", value: form["Status"], onChange, style: volInputStyle }, /* @__PURE__ */ React.createElement("option", { value: "Active" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "Inactive" }, "Inactive"))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Team"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, /* @__PURE__ */ React.createElement(TeamPicker, { value: form["Team"], onChange }))), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: form["Email"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: form["Phone Number"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Address"), /* @__PURE__ */ React.createElement("input", { name: "Address", value: form["Address"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Emergency Contact"), /* @__PURE__ */ React.createElement("input", { name: "Emergency Contact", value: form["Emergency Contact"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Birthday"), /* @__PURE__ */ React.createElement("input", { name: "Birthday", type: "date", value: form["Birthday"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Anniversary"), /* @__PURE__ */ React.createElement("input", { name: "Volunteer Anniversary", type: "date", value: form["Volunteer Anniversary"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Month"), /* @__PURE__ */ React.createElement("input", { name: "Month", value: form["Month"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Day"), /* @__PURE__ */ React.createElement("input", { name: "Day", value: form["Day"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "CC", checked: form["CC"], onChange }), " CC"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Nametag", checked: form["Nametag"], onChange }), " Nametag")), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Picture URL (Google Drive)"), /* @__PURE__ */ React.createElement("input", { name: "Picture URL", value: form["Picture URL"], onChange, style: volInputStyle, placeholder: "https://drive.google.com/..." })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Overview Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Overview Notes", value: form["Overview Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Background Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Background Notes", value: form["Background Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: form["Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Goals"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "What they want to see at NSH"), /* @__PURE__ */ React.createElement("textarea", { name: "What they want to see at NSH", value: form["What they want to see at NSH"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 } }, saving ? "Saving..." : "Save"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onCancel, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel")))));
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
      return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, marginBottom: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 110, fontSize: 12, color: "#aaa", flexShrink: 0, paddingTop: 1 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", flex: 1, lineHeight: 1.4 } }, link ? /* @__PURE__ */ React.createElement("a", { href: link, style: { color: gold, textDecoration: "none" } }, value) : value));
    }
    function NoteBlock({ label, value }) {
      if (!value) return null;
      return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, label && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#444", lineHeight: 1.65, background: "#faf8f4", borderRadius: 8, padding: "10px 14px" } }, value));
    }
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Volunteers", value: loading ? "..." : volunteers.length }), /* @__PURE__ */ React.createElement(StatCard, { label: "Active", value: loading ? "..." : active }), /* @__PURE__ */ React.createElement(StatCard, { label: "Teams", value: loading ? "..." : teams })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, background: "#f0ebe3", borderRadius: 10, padding: 3 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setTab("active");
          setFilterTeam("All");
        },
        style: { border: "none", borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: tab === "active" ? 600 : 400, cursor: "pointer", background: tab === "active" ? "#fff" : "transparent", color: tab === "active" ? "#2a2a2a" : "#999", boxShadow: tab === "active" ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }
      },
      "Active ",
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: tab === "active" ? gold : "#bbb", fontWeight: 500 } }, active)
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setTab("inactive");
          setFilterTeam("All");
        },
        style: { border: "none", borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: tab === "inactive" ? 600 : 400, cursor: "pointer", background: tab === "inactive" ? "#fff" : "transparent", color: tab === "inactive" ? "#2a2a2a" : "#999", boxShadow: tab === "inactive" ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }
      },
      "Inactive ",
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: tab === "inactive" ? gold : "#bbb", fontWeight: 500 } }, inactive)
    )), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setForm(emptyForm);
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, "+ Add Volunteer")), !loading && teamSet.length > 2 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 } }, teamSet.map(function(t) {
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
            borderRadius: 20,
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
    })), error && /* @__PURE__ */ React.createElement("div", { style: { background: "#fce4e4", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#c0392b" } }, "Error: ", error), loading ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 } }, "Loading volunteers...") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 } }, filtered.map(function(v, i) {
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
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: "#2a2a2a", marginBottom: 3, lineHeight: 1.3 } }, v["First Name"], " ", v["Last Name"]),
        v["Team"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (v["Team"] || "").split("|")[0].trim()),
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
    }, style: { marginTop: 16, width: "100%", padding: "9px", background: "transparent", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#999", fontWeight: 500 } }, "Close")))), selected && editing && /* @__PURE__ */ React.createElement(
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
    var iStyle = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
    var lStyle = { fontSize: 12, color: "#666", fontWeight: 500 };
    var grp = { marginBottom: 14 };
    var sec = { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#bbb", fontWeight: 600, marginBottom: 10, marginTop: 20, display: "block" };
    var typeColors = {
      "Donation": { bg: "#e3f2fd", color: "#1565c0" },
      "Membership": { bg: "#e8f5e9", color: "#2e7d32" },
      "Restricted": { bg: "#fce4ec", color: "#880e4f" },
      "Membership, Donation": { bg: "#f3e5f5", color: "#6a1b9a" },
      "Brick Purchase": { bg: "#fbe9e7", color: "#8d3d2b" },
      "Tribute": { bg: "#fff8e1", color: "#8a6200" }
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Raised", value: loading ? "..." : "$" + totalRaised.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: "2026 YTD" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Donations", value: loading ? "..." : totalDonors }), /* @__PURE__ */ React.createElement(StatCard, { label: "Memberships", value: loading ? "..." : memberships }), /* @__PURE__ */ React.createElement(StatCard, { label: "Need Thank You", value: loading ? "..." : unacknowledged, sub: unacknowledged > 0 ? "pending" : "all clear" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#888" } }, loading ? "Loading..." : totalDonors + " donation" + (totalDonors !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setForm(emptyDonForm);
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, "+ Add Donation")), error && /* @__PURE__ */ React.createElement("div", { style: { background: "#fce4e4", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#c0392b" } }, "Error: ", error), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 } }, ["All"].concat(DONATION_TYPES).map(function(t) {
      var active = filterType === t;
      var tc = typeColors[t] || { bg: "#f5f0ea", color: "#888" };
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t,
          onClick: function() {
            setFilterType(t);
          },
          style: { padding: "5px 14px", borderRadius: 20, border: "1.5px solid " + (active ? tc.color : "#e0d8cc"), background: active ? tc.bg : "#fff", color: active ? tc.color : "#888", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }
        },
        t
      );
    })), loading ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 } }, "Loading donations...") : /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "8px 16px", borderBottom: "0.5px solid #e8e0d4", background: "#faf8f4" } }, ["Donor", "Type", "Amount", "Date"].map(function(h) {
      return /* @__PURE__ */ React.createElement("div", { key: h, style: { fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 } }, h);
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
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: "#2a2a2a" } }, d["Donor Name"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", marginTop: 1 } }, d["Account Type"])),
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" } }, d["Donation Type"])),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a" } }, fmtAmount(d["Amount"])),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, fmtDate(d["Close Date"])), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: acked ? "#e8f5e9" : "#fff8e1", color: acked ? "#2e7d32" : "#8a6200" } }, acked ? "Thanked" : "Pending"))
      );
    })), selected && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setSelected(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, maxWidth: 540, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)", padding: "24px 28px 18px", borderBottom: "0.5px solid #e8dece", position: "relative", borderRadius: "16px 16px 0 0" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 19, fontWeight: 600, color: "#1e1a16", marginBottom: 4 } }, selected["Donor Name"]), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, (function() {
      var tc = typeColors[selected["Donation Type"]] || { bg: "#f3f3f3", color: "#555" };
      return /* @__PURE__ */ React.createElement("span", { style: { background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20 } }, selected["Donation Type"]);
    })(), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#aaa" } }, fmtDate(selected["Close Date"]))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#666" } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 28px 24px", overflowY: "auto", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#aaa", marginRight: 8 } }, "Amount"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, fontWeight: 600, color: gold } }, fmtAmount(selected["Amount"]))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Info"), selected["Informal Names"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Goes by"), selected["Informal Names"]), selected["Account Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Type"), selected["Account Type"]), selected["Email"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Email"), /* @__PURE__ */ React.createElement("a", { href: "mailto:" + selected["Email"], style: { color: gold, textDecoration: "none" } }, selected["Email"])), selected["Phone Number"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Phone"), selected["Phone Number"]), selected["Address"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Address"), /* @__PURE__ */ React.createElement("span", { style: { whiteSpace: "pre-line" } }, selected["Address"])), /* @__PURE__ */ React.createElement("span", { style: sec }, "Payment"), selected["Payment Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Method"), selected["Payment Type"]), selected["Benefits"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Benefits"), selected["Benefits"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa", marginRight: 8 } }, "Acknowledged"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#e8f5e9" : "#fff8e1", color: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#2e7d32" : "#8a6200" } }, selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "Thanked" : "Pending"))), /* @__PURE__ */ React.createElement("div", null, selected["Donation Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donation Notes"])), selected["Donor Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donor Notes"])), selected["Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Notes"])))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { marginTop: 16, width: "100%", padding: "9px", background: "transparent", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#999", fontWeight: 500 } }, "Close")))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowAdd(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, "Add Donation"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleDonSubmit }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "First / Full Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Donor Name", value: form["Donor Name"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Last Name"), /* @__PURE__ */ React.createElement("input", { name: "Last Name", value: form["Last Name"], onChange: handleDonFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Goes By (Informal)"), /* @__PURE__ */ React.createElement("input", { name: "Informal Names", value: form["Informal Names"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Account Type"), /* @__PURE__ */ React.createElement("select", { name: "Account Type", value: form["Account Type"], onChange: handleDonFormChange, style: iStyle }, ACCOUNT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Amount *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Amount", value: form["Amount"], onChange: handleDonFormChange, style: iStyle, placeholder: "$0.00" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Close Date"), /* @__PURE__ */ React.createElement("input", { name: "Close Date", type: "date", value: form["Close Date"], onChange: handleDonFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Type"), /* @__PURE__ */ React.createElement("select", { name: "Donation Type", value: form["Donation Type"], onChange: handleDonFormChange, style: iStyle }, DONATION_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Payment Type"), /* @__PURE__ */ React.createElement("select", { name: "Payment Type", value: form["Payment Type"], onChange: handleDonFormChange, style: iStyle }, PAYMENT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Benefits"), /* @__PURE__ */ React.createElement("input", { name: "Benefits", value: form["Benefits"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Acknowledged", checked: form["Acknowledged"], onChange: handleDonFormChange }), " Acknowledged / Thanked"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Salesforce", checked: form["Salesforce"], onChange: handleDonFormChange }), " In Salesforce")), /* @__PURE__ */ React.createElement("span", { style: sec }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: form["Email"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: form["Phone Number"], onChange: handleDonFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Address"), /* @__PURE__ */ React.createElement("textarea", { name: "Address", value: form["Address"], onChange: handleDonFormChange, rows: 3, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donation Notes", value: form["Donation Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donor Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donor Notes", value: form["Donor Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: form["Notes"], onChange: handleDonFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 } }, saving ? "Saving..." : "Save Donation"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setShowAdd(false);
    }, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"))))));
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
    }, style: { background: "none", border: "0.5px solid #e0d8cc", borderRadius: 5, padding: "1px 8px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#444", lineHeight: 1.6 } }, "B"), /* @__PURE__ */ React.createElement("button", { type: "button", onMouseDown: function(e) {
      e.preventDefault();
      exec("italic");
    }, style: { background: "none", border: "0.5px solid #e0d8cc", borderRadius: 5, padding: "1px 8px", fontSize: 13, fontStyle: "italic", cursor: "pointer", color: "#444", lineHeight: 1.6 } }, "I")), /* @__PURE__ */ React.createElement(
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
        style: { minHeight: 72, padding: "8px 10px", fontSize: 13, outline: "none", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, background: "#fff" }
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
    var bInp = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
    var bLbl = { fontSize: 12, color: "#666", fontWeight: 500 };
    var bGrp = { marginBottom: 14 };
    if (loading) return /* @__PURE__ */ React.createElement("div", { style: { color: "#aaa", fontSize: 14, padding: 40, textAlign: "center" } }, "Loading\u2026");
    if (loadError) return /* @__PURE__ */ React.createElement("div", { style: { color: "#c62828", fontSize: 13, padding: 20, background: "#ffebee", borderRadius: 8, border: "0.5px solid #ffcdd2" } }, /* @__PURE__ */ React.createElement("strong", null, "Supabase error:"), " ", loadError, /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("br", null), "Make sure you've run the SQL setup in Supabase and that RLS is disabled on both tables.");
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#888" } }, items.length, " topic", items.length !== 1 ? "s" : ""), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, "+ Add Topic")), items.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "#aaa", fontSize: 14, textAlign: "center", padding: 40 } }, "No voting items yet."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, (function() {
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
        return /* @__PURE__ */ React.createElement(React.Fragment, { key: item.id }, showDivider && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "6px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: "0.5px", background: "#e0d8cc" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#bbb", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 } }, "Closed"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: "0.5px", background: "#e0d8cc" } })), /* @__PURE__ */ React.createElement(
          "div",
          {
            key: item.id,
            onClick: function() {
              setSelected(item);
              setVoteForm({ voter: "", choice: "", note: "" });
            },
            style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s" },
            onMouseEnter: function(e) {
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)";
            },
            onMouseLeave: function(e) {
              e.currentTarget.style.boxShadow = "none";
            }
          },
          /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 500, color: "#2a2a2a", marginBottom: 4 } }, item.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa" } }, item.submitted_by ? /* @__PURE__ */ React.createElement("span", null, "Submitted by ", item.submitted_by, item.due_date ? " \xB7 " : "") : null, item.due_date ? /* @__PURE__ */ React.createElement("span", null, "Due ", fmtDate(item.due_date)) : null, item.meeting_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Meeting ", fmtDate(item.meeting_date)) : null)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginLeft: 16, flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#aaa" } }, iv.length, "/", BOARD_MEMBERS.length, " voted"), revealed ? /* @__PURE__ */ React.createElement("span", { style: { background: "#e8f5e9", color: "#2e7d32", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20 } }, "Revealed") : /* @__PURE__ */ React.createElement("span", { style: { background: "#fff3e0", color: "#e65100", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20 } }, "Open"))),
          revealed && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 10 } }, [["Yes", t.yes, "#2e7d32"], ["No", t.no, "#c62828"], ["Abstain", t.abstain, "#e65100"]].map(function(entry) {
            return /* @__PURE__ */ React.createElement("div", { key: entry[0], style: { fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { color: entry[2], fontWeight: 600 } }, entry[1]), /* @__PURE__ */ React.createElement("span", { style: { color: "#aaa" } }, " ", entry[0]));
          }))
        ));
      });
    })()), selected && /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: cream, zIndex: 1010, overflowY: "auto", padding: "32px" } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 } }, "\u2190 Back to topics"), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 16, padding: 36, boxShadow: "0 2px 20px rgba(0,0,0,0.06)" } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 600, color: "#2a2a2a", marginBottom: 6 } }, selected.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#aaa" } }, selected.submitted_by ? /* @__PURE__ */ React.createElement("span", null, "Submitted by ", selected.submitted_by) : null, selected.due_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Due ", fmtDate(selected.due_date)) : null, selected.meeting_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Meeting ", fmtDate(selected.meeting_date)) : null)), selected.description && /* @__PURE__ */ React.createElement("div", { dangerouslySetInnerHTML: { __html: selected.description }, style: { fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16, padding: "12px 14px", background: "#faf8f4", borderRadius: 8, borderLeft: "3px solid " + gold } }), selected.attachment_url && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("a", { href: selected.attachment_url, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 13, color: gold, textDecoration: "none" } }, "\u{1F4CE} View Attachment")), isRevealed(selected) ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#bbb", fontWeight: 600, marginBottom: 12 } }, "Results"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 } }, (function() {
      var t = tally(selected);
      return [
        { label: "Yes", count: t.yes, bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32" },
        { label: "No", count: t.no, bg: "#ffebee", border: "#ef9a9a", color: "#c62828" },
        { label: "Abstain / Not in Attendance", count: t.abstain + t.absent, bg: "#f5f5f5", border: "#e0e0e0", color: "#888" }
      ].map(function(entry) {
        return /* @__PURE__ */ React.createElement("div", { key: entry.label, style: { background: entry.bg, border: "1px solid " + entry.border, borderRadius: 12, padding: "14px 16px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: entry.color, lineHeight: 1 } }, entry.count), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: entry.color, fontWeight: 600, marginTop: 4, opacity: 0.8 } }, entry.label));
      });
    })()), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#bbb", fontWeight: 600, marginBottom: 10 } }, "Individual Votes"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 } }, BOARD_MEMBERS.map(function(m) {
      var mv = itemVotes(selected).find(function(v) {
        return v.voter === m;
      });
      if (!mv) return /* @__PURE__ */ React.createElement("div", { key: m, style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fafafa", borderRadius: 8, fontSize: 13 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500, color: "#2a2a2a" } }, m), /* @__PURE__ */ React.createElement("span", { style: { color: "#bbb" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { color: "#ccc", fontSize: 12 } }, "No vote"));
      var vc = VOTE_COLORS[mv.choice] || { bg: "#f5f5f5", color: "#888" };
      return /* @__PURE__ */ React.createElement("div", { key: m, style: { padding: "8px 12px", background: "#fafafa", borderRadius: 8, fontSize: 13 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500, color: "#2a2a2a" } }, m), /* @__PURE__ */ React.createElement("span", { style: { color: "#bbb" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, mv.choice), mv.changed_in_meeting && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", fontWeight: 600, padding: "2px 8px", borderRadius: 20 } }, "Changed in meeting")), mv.note && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 4, fontStyle: "italic" } }, mv.note));
    }))) : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#bbb", fontWeight: 600, marginBottom: 12 } }, "Votes \xB7 ", itemVotes(selected).length, "/", BOARD_MEMBERS.length, " submitted"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, BOARD_MEMBERS.map(function(m) {
      var mv = itemVotes(selected).find(function(v) {
        return v.voter === m;
      });
      var vc = mv ? VOTE_COLORS[mv.choice] || { bg: "#f5f5f5", color: "#888" } : null;
      return /* @__PURE__ */ React.createElement("div", { key: m, style: { background: "#fafafa", borderRadius: 10, padding: "10px 14px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 500, color: mv ? "#aaa" : "#2a2a2a" } }, m), mv && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "#bbb" } }, "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { background: vc.bg, color: vc.color, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, mv.choice)), mv && mv.changed_in_meeting && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", fontWeight: 600, padding: "2px 8px", borderRadius: 20 } }, "Changed in meeting"), !mv && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#ccc" } }, "No vote yet")), mv && mv.note && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", marginTop: 4, fontStyle: "italic" } }, mv.note));
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
    ) : /* @__PURE__ */ React.createElement("div", { style: { background: "#fafafa", borderRadius: 12, padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a", marginBottom: 12 } }, "Add Post-Meeting Vote"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Board Member"), /* @__PURE__ */ React.createElement("select", { value: voteForm.voter, onChange: function(e) {
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
        style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: voteSaving || !voteForm.choice || !voteForm.voter ? 0.6 : 1 }
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
        style: { padding: "8px 16px", background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer", fontWeight: 500 }
      },
      "Cancel"
    )))))))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowAdd(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, "New Voting Topic"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleTopicSubmit }, /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Title *"), /* @__PURE__ */ React.createElement("input", { required: true, value: topicForm.title, onChange: function(e) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { title: e.target.value });
      });
    }, style: bInp, placeholder: "Topic title\u2026" })), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Description"), /* @__PURE__ */ React.createElement(RichEditor, { value: topicForm.description, onChange: function(html) {
      setTopicForm(function(f) {
        return Object.assign({}, f, { description: html });
      });
    }, placeholder: "Background, details, context\u2026" })), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Attachment"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 6, padding: "8px 12px", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", background: "#fff", fontSize: 13 } }, /* @__PURE__ */ React.createElement("span", { style: { background: gold, color: "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 500, flexShrink: 0 } }, attachUploading ? "Uploading\u2026" : "Choose file"), /* @__PURE__ */ React.createElement("span", { style: { color: attachFileName ? "#2a2a2a" : "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, attachFileName || "No file chosen"), /* @__PURE__ */ React.createElement("input", { type: "file", onChange: handleAttachUpload, style: { display: "none" } })), topicForm.attachment_url && !attachUploading && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#2e7d32", marginTop: 4 } }, "\u2713 Uploaded")), /* @__PURE__ */ React.createElement("div", { style: bGrp }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Submitted By"), /* @__PURE__ */ React.createElement("input", { value: topicForm.submitted_by, onChange: function(e) {
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
    }, style: bInp }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: topicSaving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: topicSaving ? 0.7 : 1 } }, topicSaving ? "Saving\u2026" : "Add Topic"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setShowAdd(false);
    }, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"))))));
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
    var filtered = goals.filter(function(g) {
      return g.goal_type === tab;
    });
    var annualGoals = goals.filter(function(g) {
      return g.goal_type === "annual";
    });
    var onTrack = annualGoals.filter(function(g) {
      return g.status === "On track" || g.status === "Complete";
    }).length;
    var notStarted = annualGoals.filter(function(g) {
      return g.status === "Not started" || !g.status;
    }).length;
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
        borderRadius: 20,
        cursor: "pointer",
        background: tab === t ? gold : "#f0ebe2",
        color: tab === t ? "#fff" : "#666"
      };
    };
    if (loading) return /* @__PURE__ */ React.createElement("div", { style: { padding: 40, color: "#aaa", fontSize: 13 } }, "Loading\u2026");
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Annual Goals", value: annualGoals.length }), /* @__PURE__ */ React.createElement(StatCard, { label: "On Track / Complete", value: onTrack }), /* @__PURE__ */ React.createElement(StatCard, { label: "Not Started", value: notStarted }), /* @__PURE__ */ React.createElement(StatCard, { label: "Focus Areas", value: CATEGORY_ORDER.length })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } }, ["annual", "future", "three_year_vision"].map(function(t) {
      return /* @__PURE__ */ React.createElement("button", { key: t, onClick: function() {
        setTab(t);
      }, style: tabStyle(t) }, GOAL_TYPE_LABELS[t]);
    })), CATEGORY_ORDER.map(function(cat) {
      var catGoals = filtered.filter(function(g) {
        return g.category === cat;
      });
      if (catGoals.length === 0) return null;
      return /* @__PURE__ */ React.createElement("div", { key: cat, style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.4, color: gold, fontWeight: 700, marginBottom: 10 } }, cat), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, catGoals.map(function(g) {
        var sc = GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS["Not started"];
        var isEdit = editing === g.id;
        return /* @__PURE__ */ React.createElement("div", { key: g.id, style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "14px 16px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a", marginBottom: 4 } }, g.title), g.description && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777", lineHeight: 1.5 } }, g.description)), tab !== "three_year_vision" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } }, g.status && /* @__PURE__ */ React.createElement("span", { style: { background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, g.status), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: function() {
              isEdit ? setEditing(null) : openEdit(g);
            },
            style: { fontSize: 11, color: isEdit ? "#aaa" : gold, background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }
          },
          isEdit ? "Cancel" : "Edit"
        ))), tab !== "three_year_vision" && !isEdit && (g.lead || g.due_date) && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16, marginTop: 8 } }, g.lead && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa" } }, "Lead: ", /* @__PURE__ */ React.createElement("span", { style: { color: "#555" } }, g.lead)), g.due_date && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa" } }, "Due: ", /* @__PURE__ */ React.createElement("span", { style: { color: "#555" } }, g.due_date))), isEdit && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, paddingTop: 14, borderTop: "0.5px solid #f0ebe2" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Status"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: editForm.status,
            onChange: function(e) {
              setEditForm(function(f) {
                return Object.assign({}, f, { status: e.target.value });
              });
            },
            style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, background: "#fff" }
          },
          GOAL_STATUS_OPTS.map(function(s) {
            return /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s);
          })
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Lead"), /* @__PURE__ */ React.createElement(
          "input",
          {
            value: editForm.lead,
            onChange: function(e) {
              setEditForm(function(f) {
                return Object.assign({}, f, { lead: e.target.value });
              });
            },
            style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, boxSizing: "border-box" },
            placeholder: "Name\u2026"
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Due Date"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "date",
            value: editForm.due_date,
            onChange: function(e) {
              setEditForm(function(f) {
                return Object.assign({}, f, { due_date: e.target.value });
              });
            },
            style: { padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13 }
          }
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: function() {
              handleSave(g);
            },
            disabled: saving,
            style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 }
          },
          saving ? "Saving\u2026" : "Save"
        )));
      })));
    }));
  }
  var views = {
    home: HomeView,
    events: EventsView,
    volunteers: VolunteersView,
    donors: DonorsView,
    marketing: MarketingView,
    board: BoardView,
    strategy: StrategyView
  };
  function Dashboard() {
    const [active, setActive] = useState("home");
    const View = views[active];
    const mod = modules.find((m) => m.id === active);
    return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", minHeight: "100vh", background: cream, fontFamily: "system-ui, sans-serif" } }, /* @__PURE__ */ React.createElement("style", null, ".nsh-sidebar::-webkit-scrollbar { display: none; }"), /* @__PURE__ */ React.createElement("div", { className: "nsh-sidebar", style: { width: 220, background: "#2a2420", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", scrollbarWidth: "none" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "24px 20px 16px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 } }, "North Star House"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.35)" } }, "Command Center")), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "0 0 8px" } }), /* @__PURE__ */ React.createElement("nav", { style: { flex: 1, padding: "0 8px" } }, modules.map((m) => /* @__PURE__ */ React.createElement("button", { key: m.id, onClick: () => setActive(m.id), style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "9px 12px",
      background: active === m.id ? "rgba(136,108,68,0.18)" : "transparent",
      border: "none",
      borderRadius: 7,
      cursor: "pointer",
      textAlign: "left",
      color: active === m.id ? gold : "rgba(255,255,255,0.5)",
      fontSize: 13,
      fontWeight: active === m.id ? 500 : 400,
      marginBottom: 2,
      transition: "all 0.15s"
    } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, opacity: 0.8 } }, m.icon), m.label))), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 20px 20px", borderTop: "0.5px solid rgba(255,255,255,0.08)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.25)" } }, "Connected to Airtable"), /* @__PURE__ */ React.createElement("div", { style: { width: 8, height: 8, borderRadius: "50%", background: "#4caf50", display: "inline-block", marginRight: 5, marginTop: 6 } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "rgba(255,255,255,0.3)" } }, "Live sync"))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, padding: "28px 32px", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 900 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 22 } }, /* @__PURE__ */ React.createElement("h1", { style: { margin: 0, fontSize: 22, fontWeight: 500, color: "#2a2a2a" } }, mod && mod.label), /* @__PURE__ */ React.createElement("div", { style: { height: 2, width: 32, background: gold, borderRadius: 2, marginTop: 6 } })), /* @__PURE__ */ React.createElement(View, { navigate: setActive }))));
  }
  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(Dashboard));
})();
