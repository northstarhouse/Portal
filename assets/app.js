var AppBundle = (() => {
  // src/app.jsx
  var { useState, useEffect } = React;
  var SUPABASE_URL = "https://uvzwhhwzelaelfhfkvdb.supabase.co";
  var DONORS_PASSWORD = "NSH";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2endoaHd6ZWxhZWxmaGZrdmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzI4OTksImV4cCI6MjA4OTYwODg5OX0.xw5n0MGm69u_FOiZHxbLNUCNQHehIJliO_s4YbTyfh8";
  function sbFetch(table, columns) {
    const cols = columns.map((c) => encodeURIComponent(c)).join(",");
    const url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=" + cols;
    return fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    }).then((r) => r.json());
  }
  var _cache = {};
  var LS_PREFIX = "nsh3_";
  function lsGet(key) {
    try {
      var r = localStorage.getItem(LS_PREFIX + key);
      if (!r) return null;
      var parsed = JSON.parse(r);
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object" && parsed.data !== void 0) return parsed.data;
      return parsed;
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, data) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
    } catch (e) {
    }
  }
  function cachedSbFetch(table, columns) {
    var key = table + ":" + columns.slice().sort().join(",");
    if (_cache[key]) return Promise.resolve(_cache[key]);
    var ls = lsGet(key);
    if (ls) {
      _cache[key] = ls;
      return Promise.resolve(ls);
    }
    return sbFetch(table, columns).then(function(data) {
      if (Array.isArray(data)) {
        _cache[key] = data;
        lsSet(key, data);
      }
      return data;
    });
  }
  function cachedFetchAll(table) {
    var key = table + ":*";
    if (_cache[key]) return Promise.resolve(_cache[key]);
    var ls = lsGet(key);
    if (ls) {
      _cache[key] = ls;
      return Promise.resolve(ls);
    }
    var url = SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + "?select=*";
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
      return r.json();
    }).then(function(data) {
      if (Array.isArray(data)) {
        _cache[key] = data;
        lsSet(key, data);
      }
      return data;
    });
  }
  function cachedFetch(url) {
    if (_cache[url]) return Promise.resolve(_cache[url]);
    var ls = lsGet(url);
    if (ls) {
      _cache[url] = ls;
      return Promise.resolve(ls);
    }
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
      return r.json();
    }).then(function(data) {
      if (Array.isArray(data)) {
        _cache[url] = data;
        lsSet(url, data);
      }
      return data;
    });
  }
  function clearCache(table) {
    var enc = encodeURIComponent(table);
    Object.keys(_cache).forEach(function(k) {
      if (k.indexOf(table + ":") === 0 || k.indexOf("/" + enc + "?") !== -1) delete _cache[k];
    });
    Object.keys(localStorage).forEach(function(k) {
      if (!k.startsWith(LS_PREFIX)) return;
      var inner = k.slice(LS_PREFIX.length);
      if (inner.indexOf(table + ":") === 0 || inner.indexOf("/" + enc + "?") !== -1) localStorage.removeItem(k);
    });
  }
  var CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";
  (function prefetch() {
    cachedSbFetch("2026 Volunteers", ["First Name", "Last Name", "Team", "Status", "Email", "Phone Number", "Address", "Birthday", "Volunteer Anniversary", "CC", "Nametag", "Overview Notes", "Background Notes", "Notes", "What they want to see at NSH", "Picture URL", "Emergency Contact", "Month", "Day"]);
    cachedSbFetch("2026 Donations", ["id", "Donor Name", "Last Name", "Informal Names", "Amount", "Close Date", "Donation Type", "Payment Type", "Account Type", "Acknowledged", "Salesforce", "Email", "Phone Number", "Address", "Benefits", "Donation Notes", "Donor Notes", "Notes"]);
    cachedSbFetch("Sponsors", ["id", "Business Name", "Main Contact", "Donation", "Fair Market Value", "Area Supported", "Acknowledged", "NSH Contact", "Notes"]);
    cachedFetchAll("Board Voting Items");
    cachedFetchAll("Board-Votes");
  })();
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
    ideas: '<path d="M9 21h6"/><path d="M9 17.5h6"/><path d="M12 2a7 7 0 0 1 4.9 11.9l-.1.1c-.4.4-.8 1-1.1 1.5H8.3c-.3-.5-.7-1.1-1.1-1.5l-.1-.1A7 7 0 0 1 12 2z"/>',
    reviews: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
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
    { id: "donors", label: "Donations" },
    { id: "sponsors", label: "Sponsors" },
    { id: "board", label: "Board Voting" },
    { id: "strategy", label: "Strategic Goal Progress" },
    { id: "ideas", label: "Ideas & Initiatives" },
    { id: "operational", label: "Operational Areas", hidden: true },
    { id: "financials", label: "Financials", hidden: true },
    { id: "reviews", label: "Reviews", hidden: true }
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
    const [birthdays, setBirthdays] = useState(null);
    const [sponsors, setSponsors] = useState(null);
    const [inHouseEvents, setInHouseEvents] = useState([]);
    const [iheForm, setIheForm] = useState({ name: "", date: "", cost: "", link: "" });
    const [iheAdding, setIheAdding] = useState(false);
    const [iheSaving, setIheSaving] = useState(false);
    var isMobile = React.useContext(MobileCtx);
    useEffect(function() {
      cachedSbFetch("Sponsors", ["id", "Business Name", "Main Contact", "Donation", "Fair Market Value", "Area Supported", "Acknowledged", "NSH Contact", "Notes"]).then(function(rows) {
        if (Array.isArray(rows)) setSponsors(rows);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("In-House Events") + "?select=*&order=date.asc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setInHouseEvents(rows);
      }).catch(function() {
      });
      cachedSbFetch("2026 Donations", ["Amount"]).then(function(rows) {
        if (!Array.isArray(rows)) return;
        var total = rows.reduce(function(s, r) {
          return s + parseFloat((r["Amount"] || "0").replace(/[^\d.]/g, "") || 0);
        }, 0);
        setDonationTotal(total);
      });
      cachedSbFetch("2026 Volunteers", ["Status", "First Name", "Last Name", "Birthday", "Picture URL"]).then(function(rows) {
        if (!Array.isArray(rows)) return;
        setActiveVols(rows.filter(function(r) {
          return r["Status"] === "Active";
        }).length);
        var today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        var windowEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1e3);
        var upcoming = rows.filter(function(r) {
          if (!r["Birthday"]) return false;
          var parts = r["Birthday"].split("-");
          if (parts.length < 3) return false;
          var mo = parseInt(parts[1]) - 1, dy = parseInt(parts[2]);
          var thisYear = new Date(today.getFullYear(), mo, dy);
          var nextYear = new Date(today.getFullYear() + 1, mo, dy);
          return thisYear >= today && thisYear <= windowEnd || nextYear >= today && nextYear <= windowEnd;
        }).map(function(r) {
          var parts = r["Birthday"].split("-");
          var mo = parseInt(parts[1]) - 1, dy = parseInt(parts[2]);
          var thisYear = new Date(today.getFullYear(), mo, dy);
          var bday = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, mo, dy);
          return Object.assign({}, r, { _bday: bday });
        }).sort(function(a, b) {
          return a._bday - b._bday;
        });
        setBirthdays(upcoming);
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
      var next = nextUpcomingDue();
      var due = next.date;
      var now = /* @__PURE__ */ new Date();
      now.setHours(0, 0, 0, 0);
      var days = Math.round((due - now) / 864e5);
      var dueStr = next.q + " \u2014 " + due.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      var label = days === 0 ? "Due today" : days + " days away";
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
    })(), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("donors");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Donations", value: donationTotal === null ? "..." : "$" + donationTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })), /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("volunteers");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Active Volunteers", value: activeVols === null ? "..." : activeVols })), /* @__PURE__ */ React.createElement("div", { onClick: function() {
      navigate("sponsors");
    }, style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Sponsors", value: sponsors === null ? "..." : sponsors.length }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })), "Happening This Week at North Star House"), calEvents === null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "Loading\u2026"), calEvents !== null && calEvents.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, "No upcoming events in the next 2 weeks."), calEvents !== null && calEvents.map(function(ev, i) {
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
    }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0ebe2", fontSize: 12, color: "#999" } }, "Synced from Google Calendar")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "7", r: "4" })), "Upcoming Birthdays"), birthdays === null && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa" } }, "Loading\u2026"), birthdays !== null && birthdays.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", fontStyle: "italic" } }, "No birthdays in the next 30 days."), birthdays !== null && birthdays.map(function(v, i) {
      var isToday = v._bday.toDateString() === (/* @__PURE__ */ new Date()).toDateString();
      var dayStr = v._bday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, background: isToday ? "#fffbf0" : "transparent", border: isToday ? "0.5px solid #e8d9b0" : "none", borderRadius: isToday ? 8 : 0, padding: isToday ? "8px 10px" : "2px 0" } }, v["Picture URL"] ? /* @__PURE__ */ React.createElement("img", { src: driveImg(v["Picture URL"]), alt: v["First Name"], style: { width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 36, height: 36, borderRadius: "50%", background: "#f0ebe2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: gold, flexShrink: 0 } }, (v["First Name"] || "?")[0]), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, v["First Name"], " ", v["Last Name"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginTop: 1 } }, dayStr, isToday ? " \u{1F382}" : "")));
    })), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 18px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: gold, display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })), "In-House Events"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setIheAdding(true);
      setIheForm({ name: "", date: "", cost: "" });
    }, style: { fontSize: 11, background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 } }, "+ Add")), iheAdding && /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f4", border: "0.5px solid #e0d8cc", borderRadius: 8, padding: "12px", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        placeholder: "Event name",
        value: iheForm.name,
        onChange: function(e) {
          setIheForm(function(f) {
            return Object.assign({}, f, { name: e.target.value });
          });
        },
        style: { fontSize: 13, border: "0.5px solid #d0c8bc", borderRadius: 6, padding: "6px 10px", outline: "none" }
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        value: iheForm.date,
        onChange: function(e) {
          setIheForm(function(f) {
            return Object.assign({}, f, { date: e.target.value });
          });
        },
        style: { fontSize: 13, border: "0.5px solid #d0c8bc", borderRadius: 6, padding: "6px 10px", outline: "none" }
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        placeholder: "Cost (e.g. 150)",
        type: "number",
        value: iheForm.cost,
        onChange: function(e) {
          setIheForm(function(f) {
            return Object.assign({}, f, { cost: e.target.value });
          });
        },
        style: { fontSize: 13, border: "0.5px solid #d0c8bc", borderRadius: 6, padding: "6px 10px", outline: "none" }
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        placeholder: "Link (optional)",
        value: iheForm.link,
        onChange: function(e) {
          setIheForm(function(f) {
            return Object.assign({}, f, { link: e.target.value });
          });
        },
        style: { fontSize: 13, border: "0.5px solid #d0c8bc", borderRadius: 6, padding: "6px 10px", outline: "none" }
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { disabled: iheSaving || !iheForm.name || !iheForm.date, onClick: function() {
      setIheSaving(true);
      var row = { name: iheForm.name, date: iheForm.date, cost: iheForm.cost ? parseFloat(iheForm.cost) : null, link: iheForm.link || null };
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("In-House Events"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(row)
      }).then(function(r) {
        return r.json();
      }).then(function(res) {
        console.log("IHE insert response:", JSON.stringify(res));
        if (res && res.code) {
          alert("Error: " + (res.message || res.code));
          setIheSaving(false);
          return;
        }
        var created = Array.isArray(res) ? res[0] : res;
        setInHouseEvents(function(prev) {
          return prev.concat([created]).sort(function(a, b) {
            return (a.date || "").localeCompare(b.date || "");
          });
        });
        setIheAdding(false);
        setIheSaving(false);
      }).catch(function(err) {
        console.error("IHE error:", err);
        setIheSaving(false);
      });
    }, style: { flex: 1, fontSize: 12, background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "6px 0", cursor: "pointer", fontWeight: 600, opacity: iheSaving || !iheForm.name || !iheForm.date ? 0.5 : 1 } }, iheSaving ? "Saving\u2026" : "Save"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setIheAdding(false);
    }, style: { fontSize: 12, background: "#f0ebe2", color: "#555", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" } }, "Cancel")))), inHouseEvents.length === 0 && !iheAdding && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", fontStyle: "italic" } }, "No events added yet."), inHouseEvents.map(function(ev, i) {
      var d = ev.date ? /* @__PURE__ */ new Date(ev.date + "T00:00:00") : null;
      var dateStr = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      var isPast = d && d < /* @__PURE__ */ new Date();
      return /* @__PURE__ */ React.createElement("div", { key: ev.id || i, style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: isPast ? 0.5 : 1 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, ev.link ? /* @__PURE__ */ React.createElement("a", { href: ev.link, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", textDecoration: "none" } }, ev.name, " \u2197") : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, ev.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginTop: 1 } }, dateStr, ev.cost ? " \xB7 $" + Number(ev.cost).toLocaleString() : "")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("In-House Events") + "?id=eq." + ev.id, {
          method: "DELETE",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
        }).then(function() {
          setInHouseEvents(function(prev) {
            return prev.filter(function(e) {
              return e.id !== ev.id;
            });
          });
        });
      }, style: { fontSize: 11, background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: "2px 4px", flexShrink: 0 }, title: "Remove" }, "\u2715"));
    })))));
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
    "Events": { bg: "#e3f2fd", color: "#1565c0" },
    "Event Support": { bg: "#e8eaf6", color: "#3949ab" },
    "Interiors": { bg: "#f3e5f5", color: "#6a1b9a" },
    "Fundraising": { bg: "#fff8e1", color: "#8a6200" },
    "Staff": { bg: "#f3f3f3", color: "#555" },
    "Board Member": { bg: "#fce4ec", color: "#880e4f" },
    "New": { bg: "#e0f7fa", color: "#006064" },
    "Docent": { bg: "#fbe9e7", color: "#8d3d2b" },
    "Docents": { bg: "#fbe9e7", color: "#8d3d2b" },
    "Volunteer Exchange": { bg: "#e8f4fd", color: "#0d6eab" },
    "Support": { bg: "#f0f4f8", color: "#3a5068" },
    "Venue": { bg: "#ede7f6", color: "#4527a0" },
    "Marketing": { bg: "#fce4ec", color: "#c2185b" },
    "Restoration": { bg: "#fff3e0", color: "#e65100" },
    "Garden and Landscaping": { bg: "#e8f5e9", color: "#2e7d32" },
    "Landscaping": { bg: "#e8f5e9", color: "#2e7d32" },
    "Garden": { bg: "#e8f5e9", color: "#2e7d32" },
    "General": { bg: "#f5f5f5", color: "#555" },
    "Other": { bg: "#f5f5f5", color: "#777" }
  };
  function getAreaColor(aoi) {
    if (!aoi) return { bg: "#f5f1eb", color: "#888" };
    if (TEAM_COLORS[aoi]) return TEAM_COLORS[aoi];
    var lower = aoi.toLowerCase();
    var key = Object.keys(TEAM_COLORS).find(function(k) {
      return k.toLowerCase() === lower || lower.indexOf(k.toLowerCase()) === 0 || k.toLowerCase().indexOf(lower) === 0;
    });
    return key ? TEAM_COLORS[key] : { bg: "#f5f1eb", color: "#888" };
  }
  var TEAM_OPTIONS = Object.keys(TEAM_COLORS).filter(function(k) {
    return ["Events", "Docents", "Restoration", "General", "Other"].indexOf(k) === -1;
  });
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
  function VolForm({ form, onChange, saving, onSubmit, title, onCancel, onDelete }) {
    return /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 700, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a" } }, title), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onCancel, style: { background: "#f0ece6", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "\u2715 Close")), /* @__PURE__ */ React.createElement("form", { onSubmit }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Basic Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "First Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "First Name", value: form["First Name"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Last Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Last Name", value: form["Last Name"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Status"), /* @__PURE__ */ React.createElement("select", { name: "Status", value: form["Status"], onChange, style: volInputStyle }, /* @__PURE__ */ React.createElement("option", { value: "Active" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "Inactive" }, "Inactive"))), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Team"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, /* @__PURE__ */ React.createElement(TeamPicker, { value: form["Team"], onChange }))), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: form["Email"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: form["Phone Number"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Address"), /* @__PURE__ */ React.createElement("input", { name: "Address", value: form["Address"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Emergency Contact"), /* @__PURE__ */ React.createElement("input", { name: "Emergency Contact", value: form["Emergency Contact"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Info"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Birthday"), /* @__PURE__ */ React.createElement("input", { name: "Birthday", type: "date", value: form["Birthday"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Anniversary"), /* @__PURE__ */ React.createElement("input", { name: "Volunteer Anniversary", type: "date", value: form["Volunteer Anniversary"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Month"), /* @__PURE__ */ React.createElement("input", { name: "Month", value: form["Month"], onChange, style: volInputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Day"), /* @__PURE__ */ React.createElement("input", { name: "Day", value: form["Day"], onChange, style: volInputStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "CC", checked: form["CC"], onChange }), " CC"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Nametag", checked: form["Nametag"], onChange }), " Nametag")), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Picture URL (Google Drive)"), /* @__PURE__ */ React.createElement("input", { name: "Picture URL", value: form["Picture URL"], onChange, style: volInputStyle, placeholder: "https://drive.google.com/..." })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Overview Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Overview Notes", value: form["Overview Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Background Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Background Notes", value: form["Background Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: form["Notes"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Goals"), /* @__PURE__ */ React.createElement("div", { style: volGrp }, /* @__PURE__ */ React.createElement("label", { style: volLabelStyle }, "What they want to see at NSH"), /* @__PURE__ */ React.createElement("textarea", { name: "What they want to see at NSH", value: form["What they want to see at NSH"], onChange, rows: 3, style: Object.assign({}, volInputStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: saving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.7 : 1 } }, saving ? "Saving..." : "Save"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onCancel, style: { flex: 1, padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"), onDelete && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onDelete, style: { padding: "10px 14px", background: "transparent", border: "0.5px solid #e8a0a0", borderRadius: 8, fontSize: 12, color: "#c0392b", cursor: "pointer", fontWeight: 500 } }, "Delete")))));
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
    const [filterTeam, setFilterTeam] = useState("All");
    const [tab, setTab] = useState("active");
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboarding, setOnboarding] = useState([]);
    var OB_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRvOZozfWfzXyS5GyAHDyzQbXf-A8GxNMKTTRh6BGDJCVAAdimGW7MvLdhl0Ab0PuUgmUfm8xpZRUyP/pub?gid=544068320&single=true&output=csv";
    var HOUR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [hoursData, setHoursData] = React.useState({});
    function hoursRowsToMap(rows) {
      var result = {};
      rows.forEach(function(row) {
        var name = (row.name || "").trim();
        if (!name) return;
        var key = name.toLowerCase();
        var months = {};
        HOUR_MONTHS.forEach(function(m) {
          var v = parseFloat(row[m.toLowerCase()]) || 0;
          if (v > 0) months[m] = v;
        });
        var total = parseFloat(row.total_hours) || 0;
        if (!result[key]) {
          result[key] = { total, months };
        } else {
          result[key].total += total;
          HOUR_MONTHS.forEach(function(m) {
            if (months[m]) result[key].months[m] = (result[key].months[m] || 0) + months[m];
          });
        }
      });
      return result;
    }
    function getVolHours(vol) {
      var first = (vol["First Name"] || "").trim().toLowerCase();
      var last = (vol["Last Name"] || "").trim().toLowerCase();
      var full = (first + " " + last).trim();
      var merged = { total: 0, months: {} };
      var found = false;
      Object.keys(hoursData).forEach(function(key) {
        if (key === full || key === first || last && key === last || first && key.split(" ")[0] === first && (!last || key.split(" ")[1] === last)) {
          found = true;
          merged.total += hoursData[key].total;
          HOUR_MONTHS.forEach(function(m) {
            if (hoursData[key].months[m]) merged.months[m] = (merged.months[m] || 0) + hoursData[key].months[m];
          });
        }
      });
      return found ? merged : null;
    }
    function parseObCSV(text) {
      var lines = text.split("\n").filter(function(l) {
        return l.trim();
      });
      if (lines.length < 2) return [];
      function splitCSVLine(line) {
        var cols = [];
        var cur = "";
        var inQ = false;
        for (var i = 0; i < line.length; i++) {
          var c = line[i];
          if (c === '"') {
            inQ = !inQ;
          } else if (c === "," && !inQ) {
            cols.push(cur);
            cur = "";
          } else {
            cur += c;
          }
        }
        cols.push(cur);
        return cols.map(function(v) {
          return v.trim();
        });
      }
      var headers = splitCSVLine(lines[0]).map(function(h) {
        return h.toLowerCase().replace(/^"|"$/g, "");
      });
      return lines.slice(1).map(function(line) {
        var cols = splitCSVLine(line);
        var obj = {};
        headers.forEach(function(h, i) {
          obj[h] = (cols[i] || "").replace(/^"|"$/g, "").trim();
        });
        return {
          first_name: obj["first name"] || obj["firstname"] || "",
          last_name: obj["last name"] || obj["lastname"] || "",
          area_of_interest: obj["area"] || obj["area of interest"] || "",
          email: obj["email"] || "",
          phone: obj["phone number"] || obj["phone"] || "",
          start_date: obj["date"] || obj["timestamp"] || ""
        };
      }).filter(function(p) {
        return p.first_name;
      });
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    var OB_STAGES = ["Form Submitted", "Processed by Haley", "Welcome Email Sent", "Info Sent to Lead", "Lead Contact Made", "First Meeting", "Paperwork Received", "Added to Kiosk", "30-Day Check-In", "60-Day Check-In"];
    var OB_TERMINAL = ["Successfully Onboarded", "No Longer Interested"];
    const [obSaving, setObSaving] = useState(false);
    const [obActing, setObActing] = useState(null);
    const [obSelectedId, setObSelectedId] = useState(null);
    const [obEditId, setObEditId] = useState(null);
    const [obEditForm, setObEditForm] = useState({});
    const [obEditSaving, setObEditSaving] = useState(false);
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
      cachedSbFetch("2026 Volunteers", ["First Name", "Last Name", "Team", "Status", "Email", "Phone Number", "Address", "Birthday", "Volunteer Anniversary", "CC", "Nametag", "Overview Notes", "Background Notes", "Notes", "What they want to see at NSH", "Picture URL", "Emergency Contact", "Month", "Day"]).then(function(data) {
        if (Array.isArray(data)) setVolunteers(data);
        else setError(JSON.stringify(data));
        setLoading(false);
      }).catch(function(err) {
        setError(err.message);
        setLoading(false);
      });
      var cachedHours = lsGet("hours_summary");
      if (cachedHours) {
        setHoursData(cachedHours);
      } else {
        fetch(SUPABASE_URL + "/rest/v1/volunteer_hours?select=*", {
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          if (!Array.isArray(rows)) return;
          var parsed = hoursRowsToMap(rows);
          setHoursData(parsed);
          lsSet("hours_summary", parsed);
        }).catch(function() {
        });
      }
      Promise.all([
        fetch(OB_SHEET_URL).then(function(r) {
          return r.text();
        }).catch(function() {
          return "";
        }),
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding") + "?select=*", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
          return r.json();
        }).catch(function() {
          return [];
        })
      ]).then(function(results) {
        var sheetPeople = parseObCSV(results[0]);
        var sbRows = Array.isArray(results[1]) ? results[1] : [];
        var stageMap = {};
        sbRows.forEach(function(r) {
          if (r.email) stageMap[r.email.toLowerCase()] = r;
        });
        var merged = sheetPeople.map(function(p, i) {
          var sb = p.email ? stageMap[p.email.toLowerCase()] : null;
          var sd = sb && sb.stage_dates ? Object.assign({}, sb.stage_dates) : {};
          if (!sd["Form Submitted"] && p.start_date) sd["Form Submitted"] = p.start_date;
          return { _sbId: sb ? sb.id : null, id: sb ? sb.id : "sheet-" + i, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone, area_of_interest: p.area_of_interest, start_date: p.start_date, pipeline_stage: sb ? sb.pipeline_stage || "Form Submitted" : "Form Submitted", status: sb ? sb.status || "In Progress" : "In Progress", stage_dates: sd, survey_sent: sb ? !!sb.survey_sent : false, notes: sb ? sb.notes || "" : "", address: sb ? sb.address || "" : "", birthday: sb ? sb.birthday || "" : "", emergency_contact: sb ? sb.emergency_contact || "" : "", team: sb ? sb.team || "" : "" };
        });
        setOnboarding(merged);
      });
    }, []);
    function addObEntry(e) {
      e.preventDefault();
      setObSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ first_name: obForm.first_name, last_name: obForm.last_name || null, email: obForm.email || null, phone: obForm.phone || null, area_of_interest: obForm.area_of_interest || null, start_date: obForm.start_date || null, notes: obForm.notes || null, pipeline_stage: "New Inquiry", status: "In Progress" })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows.code) {
          setObSaving(false);
          alert("Failed: " + (rows.message || rows.code));
          return;
        }
        setObSaving(false);
        if (rows && rows[0]) setOnboarding(function(p) {
          return p.concat([rows[0]]);
        });
        setObForm(emptyOBForm);
        setShowAddOb(false);
      });
    }
    function obSetStage(ob, stage) {
      setObActing(ob.id);
      var stageToday = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      var newStageDates = Object.assign({}, ob.stage_dates || {});
      newStageDates[stage] = stageToday;
      var patch = { pipeline_stage: stage, stage_dates: newStageDates };
      if (stage === "Successfully Onboarded") patch.status = "Complete";
      else if (stage === "No Longer Interested") patch.status = "Didn't Stick";
      var req;
      if (ob._sbId) {
        req = fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding") + "?id=eq." + ob._sbId, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        }).then(function() {
          return { sbId: ob._sbId };
        });
      } else {
        req = fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(Object.assign({ first_name: ob.first_name, last_name: ob.last_name || null, email: ob.email || null, phone: ob.phone || null, area_of_interest: ob.area_of_interest || null, start_date: ob.start_date || null, status: patch.status || "In Progress" }, patch))
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          return { sbId: rows && rows[0] ? rows[0].id : null };
        });
      }
      req.then(function(result) {
        if (stage === "Successfully Onboarded") {
          var volPayload = { "First Name": ob.first_name, "Last Name": ob.last_name || "", "Status": "Active", "Email": ob.email || "", "Phone Number": ob.phone || "", "Address": ob.address || "", "Birthday": ob.birthday || "", "Emergency Contact": ob.emergency_contact || "", "Team": ob.team || ob.area_of_interest || "", "Notes": ob.notes || "" };
          fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("2026 Volunteers"), {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify(volPayload)
          }).then(function(r) {
            return r.json();
          }).then(function(rows) {
            clearCache("2026 Volunteers");
            if (rows && rows[0]) setVolunteers(function(p) {
              return p.concat([rows[0]]);
            });
          });
        }
        setOnboarding(function(p) {
          return p.map(function(o) {
            return o.id === ob.id ? Object.assign({}, o, patch, { _sbId: result.sbId || o._sbId, id: result.sbId || o.id }) : o;
          });
        });
        setObActing(null);
        setObSelectedId(null);
      });
    }
    function toggleSurvey(ob) {
      var newVal = !ob.survey_sent;
      if (!ob._sbId) return;
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding") + "?id=eq." + ob._sbId, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ survey_sent: newVal })
      });
      setOnboarding(function(p) {
        return p.map(function(o) {
          return o.id === ob.id ? Object.assign({}, o, { survey_sent: newVal }) : o;
        });
      });
    }
    function openObEdit(ob) {
      setObEditId(ob.id);
      setObEditForm({ first_name: ob.first_name || "", last_name: ob.last_name || "", email: ob.email || "", phone: ob.phone || "", area_of_interest: ob.area_of_interest || "", address: ob.address || "", birthday: ob.birthday || "", emergency_contact: ob.emergency_contact || "", notes: ob.notes || "", team: ob.team || "" });
    }
    function saveObEdit() {
      var ob = onboarding.find(function(o) {
        return o.id === obEditId;
      });
      if (!ob) return;
      setObEditSaving(true);
      var patch = { first_name: obEditForm.first_name, last_name: obEditForm.last_name, email: obEditForm.email || null, phone: obEditForm.phone || null, area_of_interest: obEditForm.area_of_interest || null, address: obEditForm.address || null, birthday: obEditForm.birthday || null, emergency_contact: obEditForm.emergency_contact || null, notes: obEditForm.notes || null, team: obEditForm.team || null };
      if (ob._sbId) {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding") + "?id=eq." + ob._sbId, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        }).then(function() {
          setOnboarding(function(p) {
            return p.map(function(o) {
              return o.id === obEditId ? Object.assign({}, o, patch) : o;
            });
          });
          setObEditId(null);
          setObEditSaving(false);
        }).catch(function() {
          setObEditSaving(false);
        });
      } else {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Vol Onboarding"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(Object.assign({}, patch, { pipeline_stage: ob.pipeline_stage || "Form Submitted", status: ob.status || "In Progress" }))
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          var newId = rows && rows[0] ? rows[0].id : null;
          setOnboarding(function(p) {
            return p.map(function(o) {
              return o.id === obEditId ? Object.assign({}, o, patch, newId ? { _sbId: newId, id: newId } : {}) : o;
            });
          });
          setObEditId(null);
          setObEditSaving(false);
        }).catch(function() {
          setObEditSaving(false);
        });
      }
    }
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
      if (t === "Staff") {
        if (v["First Name"] === "Haley" && v["Last Name"] === "Wright") return "20";
        if (v["First Name"] === "Jen") return "21";
        return "22_" + (v["Last Name"] || "");
      }
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
        clearCache("2026 Volunteers");
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
    function handleDeleteVolunteer() {
      if (!selected) return;
      if (!window.confirm("Delete " + selected["First Name"] + " " + selected["Last Name"] + "? This cannot be undone.")) return;
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("2026 Volunteers") + "?id=eq." + selected.id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        clearCache("2026 Volunteers");
        setVolunteers(function(prev) {
          return prev.filter(function(v) {
            return v.id !== selected.id;
          });
        });
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
        if (form[k] !== "") row[k] = form[k] === true ? "TRUE" : form[k] === false ? "FALSE" : form[k];
      });
      sbUpdate("2026 Volunteers", selected["First Name"], selected["Last Name"], row).then(function(res) {
        setSaving(false);
        if (res && res.code) {
          alert("Save failed: " + (res.message || JSON.stringify(res)));
          return;
        }
        clearCache("2026 Volunteers");
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
    return /* @__PURE__ */ React.createElement("div", null, !showOnboarding && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Volunteers", value: loading ? "..." : volunteers.length }), /* @__PURE__ */ React.createElement(StatCard, { label: "Active", value: loading ? "..." : active }), /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowOnboarding(true);
    }, style: { cursor: "pointer" }, onMouseEnter: function(e) {
      e.currentTarget.style.opacity = "0.85";
    }, onMouseLeave: function(e) {
      e.currentTarget.style.opacity = "1";
    } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Onboarding", value: onboarding.filter(function(o) {
      return o.status === "In Progress";
    }).length })), /* @__PURE__ */ React.createElement(StatCard, { label: "Teams", value: loading ? "..." : teams })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, background: "#f0ebe3", borderRadius: 10, padding: 3 } }, /* @__PURE__ */ React.createElement(
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
    }))), selected && !editing && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setSelected(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1e3, padding: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 18, maxWidth: 620, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.22)", maxHeight: "92vh", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "linear-gradient(135deg, #f8f4ec 0%, #f0e8dc 100%)", padding: "28px 28px 20px", borderBottom: "0.5px solid #e8dece", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 18 } }, selected["Picture URL"] ? /* @__PURE__ */ React.createElement("img", { src: driveImg(selected["Picture URL"]), alt: selected["First Name"], style: { width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 72, height: 72, borderRadius: "50%", background: gold, color: "#fff", fontSize: 24, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0 } }, initials(selected)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 19, fontWeight: 600, color: "#1e1a16", marginBottom: 3, lineHeight: 1.2 } }, selected["First Name"], " ", selected["Last Name"]), selected["Team"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#9a7f5a", marginBottom: 6, fontWeight: 500 } }, selected["Team"]), /* @__PURE__ */ React.createElement(Badge, { status: selected["Status"] || "Active" }), selected["Overview Notes"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#7a6a55", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" } }, selected["Overview Notes"]))), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 14, right: 14, display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      openEdit(selected);
    }, style: { background: "#fff", border: "0.5px solid #ddd4c4", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "#7a6a55", cursor: "pointer", fontWeight: 500 } }, "Edit"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#666", lineHeight: 1 } }, "\xD7"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 28px 24px", overflowY: "auto" } }, (selected["Email"] || selected["Phone Number"] || selected["Address"] || selected["Emergency Contact"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Contact"), /* @__PURE__ */ React.createElement(InfoRow, { label: "Email", value: selected["Email"], link: "mailto:" + selected["Email"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Phone", value: selected["Phone Number"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Address", value: selected["Address"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Emergency", value: selected["Emergency Contact"] })), (selected["Volunteer Anniversary"] || selected["Birthday"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Info"), /* @__PURE__ */ React.createElement(InfoRow, { label: "Anniversary", value: selected["Volunteer Anniversary"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Birthday", value: fmtBirthday(selected["Birthday"]) })), (selected["Background Notes"] || selected["Notes"]) && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Notes"), /* @__PURE__ */ React.createElement(NoteBlock, { label: "Background", value: selected["Background Notes"] }), /* @__PURE__ */ React.createElement(NoteBlock, { label: "Additional", value: selected["Notes"] })), selected["What they want to see at NSH"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Goals"), /* @__PURE__ */ React.createElement(NoteBlock, { value: selected["What they want to see at NSH"] })), (function() {
      var data = getVolHours(selected);
      if (!data || data.total === 0) return null;
      var activeMonths = HOUR_MONTHS.filter(function(m) {
        return data.months[m] > 0;
      }).reverse();
      var yr = (/* @__PURE__ */ new Date()).getFullYear();
      return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: volSecLabel }, "Volunteer Hours"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: gold, marginBottom: 10 } }, data.total.toFixed(1), " hrs total"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 0 } }, activeMonths.map(function(m) {
        return /* @__PURE__ */ React.createElement("div", { key: m, style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", padding: "5px 0", borderBottom: "0.5px solid #f5f0ea" } }, /* @__PURE__ */ React.createElement("span", null, m, " ", yr), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, color: "#2a2a2a" } }, data.months[m].toFixed(1), " hrs"));
      })));
    })(), /* @__PURE__ */ React.createElement("button", { onClick: function() {
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
        },
        onDelete: handleDeleteVolunteer
      }
    ), showOnboarding && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowOnboarding(false);
      setObSelectedId(null);
    }, style: { background: "none", border: "0.5px solid #e0d8cc", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "\u2190 Back"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a" } }, "Volunteer Onboarding Pipeline"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginLeft: 4 } }, onboarding.filter(function(o) {
      return o.status === "In Progress";
    }).length, " in pipeline"), obSelectedId && /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setObSelectedId(null);
    }, style: { marginLeft: "auto", background: "none", border: "0.5px solid #e0d8cc", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#888", cursor: "pointer" } }, "Deselect")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "220px 1fr", gap: 16, alignItems: "start" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderBottom: "0.5px solid #f0ece6", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 } }, "In Pipeline")), onboarding.filter(function(o) {
      return o.status === "In Progress";
    }).length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 14px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No one in pipeline") : onboarding.filter(function(o) {
      return o.status === "In Progress";
    }).map(function(ob) {
      var isSel = obSelectedId === ob.id;
      var tc = getAreaColor(ob.area_of_interest);
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: ob.id,
          onClick: function() {
            setObSelectedId(isSel ? null : ob.id);
          },
          style: { padding: "10px 14px", borderBottom: "0.5px solid #f5f1eb", cursor: "pointer", background: isSel ? tc.bg : "#fff", borderLeft: "3px solid " + (isSel ? tc.color : "transparent"), transition: "all 0.12s" },
          onMouseEnter: function(e) {
            if (!isSel) e.currentTarget.style.background = "#faf8f5";
          },
          onMouseLeave: function(e) {
            if (!isSel) e.currentTarget.style.background = "#fff";
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a" } }, ob.first_name, " ", ob.last_name),
        ob.area_of_interest && /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.color, border: "0.5px solid " + tc.color + "44", borderRadius: 10, padding: "1px 7px" } }, ob.area_of_interest),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#bbb", marginTop: 3 } }, ob.pipeline_stage || "Form Submitted")
      );
    })), /* @__PURE__ */ React.createElement("div", null, obSelectedId && (function() {
      var selOb = onboarding.find(function(o) {
        return o.id === obSelectedId;
      });
      if (!selOb) return null;
      var tc = getAreaColor(selOb.area_of_interest);
      return /* @__PURE__ */ React.createElement("div", { style: { background: tc.bg, border: "0.5px solid " + tc.color + "66", borderRadius: 10, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, selOb.first_name, " ", selOb.last_name), selOb.area_of_interest && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, background: "#fff", color: tc.color, border: "0.5px solid " + tc.color + "66", padding: "2px 8px", borderRadius: 10, fontWeight: 600 } }, selOb.area_of_interest), selOb.email && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, selOb.email), selOb.phone && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, selOb.phone), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: tc.color, fontWeight: 500, marginLeft: "auto" } }, "\u2190 click a stage to move"), /* @__PURE__ */ React.createElement("button", { onClick: function(e) {
        e.stopPropagation();
        openObEdit(selOb);
      }, style: { fontSize: 11, background: "#fff", color: tc.color, border: "0.5px solid " + tc.color + "66", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 500 } }, "Edit"));
    })(), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, OB_STAGES.map(function(stage, si) {
      var peopleHere = onboarding.filter(function(o) {
        return (o.pipeline_stage || "Form Submitted") === stage && o.status === "In Progress";
      });
      var selOb = obSelectedId ? onboarding.find(function(o) {
        return o.id === obSelectedId;
      }) : null;
      var selIsHere = selOb && (selOb.pipeline_stage || "Form Submitted") === stage;
      var canMove = selOb && !selIsHere && selOb.status === "In Progress";
      var hasAnyone = peopleHere.length > 0;
      return /* @__PURE__ */ React.createElement("div", { key: stage, style: { borderBottom: si < OB_STAGES.length - 1 ? "0.5px solid #f0ebe3" : "none", background: selIsHere ? "#fef9f0" : "transparent" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 20, height: 20, borderRadius: "50%", background: hasAnyone ? gold : "#f0ebe2", color: hasAnyone ? "#fff" : "#ccc", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, si + 1), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: hasAnyone ? 600 : 400, color: hasAnyone ? "#2a2a2a" : "#bbb", flex: 1 } }, stage), canMove && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: function() {
            obSetStage(selOb, stage);
          },
          disabled: obActing === selOb.id,
          style: { fontSize: 11, background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 500, opacity: obActing === selOb.id ? 0.5 : 1 }
        },
        "Move here"
      )), hasAnyone && /* @__PURE__ */ React.createElement("div", { style: { padding: "2px 16px 10px 46px", display: "flex", flexWrap: "wrap", gap: 6 } }, peopleHere.map(function(ob) {
        var isSel = obSelectedId === ob.id;
        var tc = getAreaColor(ob.area_of_interest);
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: ob.id,
            onClick: function() {
              setObSelectedId(isSel ? null : ob.id);
            },
            style: { display: "flex", flexDirection: "column", background: isSel ? tc.color : tc.bg, border: "0.5px solid " + tc.color + "66", borderRadius: 8, padding: "5px 10px", cursor: "pointer", transition: "all 0.12s", minWidth: 90 }
          },
          /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: isSel ? "#fff" : "#2a2a2a" } }, ob.first_name, " ", ob.last_name),
          ob.area_of_interest && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: isSel ? "rgba(255,255,255,0.85)" : tc.color, fontWeight: 500 } }, ob.area_of_interest)
        );
      })));
    }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "0.5px solid #e8e0d5" } }, [{ stage: "Successfully Onboarded", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", icon: "\u2713" }, { stage: "No Longer Interested", bg: "#fef2f2", color: "#ef4444", border: "#fecaca", icon: "\u2715" }].map(function(t, ti) {
      var peopleHere = onboarding.filter(function(o) {
        return o.pipeline_stage === t.stage;
      });
      var selOb = obSelectedId ? onboarding.find(function(o) {
        return o.id === obSelectedId;
      }) : null;
      var canMove = selOb && selOb.pipeline_stage !== t.stage && selOb.status === "In Progress";
      return /* @__PURE__ */ React.createElement("div", { key: t.stage, style: { background: t.bg, padding: "12px 16px", borderLeft: ti === 1 ? "0.5px solid " + t.border : "none" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: t.color } }, t.icon, " ", t.stage), canMove && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: function() {
            obSetStage(selOb, t.stage);
          },
          disabled: obActing === selOb.id,
          style: { fontSize: 11, background: t.color, color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontWeight: 500 }
        },
        "Move"
      )), peopleHere.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: t.color, opacity: 0.4 } }, "None yet") : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, peopleHere.map(function(ob) {
        var tc = getAreaColor(ob.area_of_interest);
        return /* @__PURE__ */ React.createElement("span", { key: ob.id, style: { fontSize: 11, background: "#fff", color: t.color, border: "0.5px solid " + t.border, borderRadius: 20, padding: "2px 10px", fontWeight: 500 } }, ob.first_name, " ", ob.last_name);
      })));
    }))))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 28 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 } }, "Volunteer Year in Review"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#ecfdf5", borderBottom: "0.5px solid #a7f3d0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: "#059669" } }, "\u2713 Successfully Onboarded"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#059669", opacity: 0.7 } }, onboarding.filter(function(o) {
      return o.pipeline_stage === "Successfully Onboarded";
    }).length)), onboarding.filter(function(o) {
      return o.pipeline_stage === "Successfully Onboarded";
    }).length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 16px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "None yet") : onboarding.filter(function(o) {
      return o.pipeline_stage === "Successfully Onboarded";
    }).map(function(ob) {
      var d = (ob.stage_dates || {})["Successfully Onboarded"];
      return /* @__PURE__ */ React.createElement("div", { key: ob.id, style: { padding: "10px 16px", borderBottom: "0.5px solid #f5f1eb", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a" } }, ob.first_name, " ", ob.last_name), ob.area_of_interest && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888" } }, ob.area_of_interest)), d && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa" } }, d));
    })), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fef2f2", borderBottom: "0.5px solid #fecaca", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: "#ef4444" } }, "\u2715 No Longer Interested"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#ef4444", opacity: 0.7 } }, onboarding.filter(function(o) {
      return o.pipeline_stage === "No Longer Interested";
    }).length)), onboarding.filter(function(o) {
      return o.pipeline_stage === "No Longer Interested";
    }).length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 16px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "None yet") : onboarding.filter(function(o) {
      return o.pipeline_stage === "No Longer Interested";
    }).map(function(ob) {
      var d = (ob.stage_dates || {})["No Longer Interested"];
      return /* @__PURE__ */ React.createElement("div", { key: ob.id, style: { padding: "10px 16px", borderBottom: "0.5px solid #f5f1eb", display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement(
        "div",
        {
          onClick: function() {
            toggleSurvey(ob);
          },
          title: ob.survey_sent ? "Survey sent" : "Mark survey sent",
          style: { width: 18, height: 18, border: "1.5px solid " + (ob.survey_sent ? "#059669" : "#d0ccc6"), borderRadius: 4, background: ob.survey_sent ? "#059669" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 11, color: "#fff", fontWeight: 700, transition: "all 0.15s" }
        },
        ob.survey_sent ? "\u2713" : ""
      ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a" } }, ob.first_name, " ", ob.last_name), ob.area_of_interest && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888" } }, ob.area_of_interest)), d && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", flexShrink: 0 } }, d));
    }), onboarding.filter(function(o) {
      return o.pipeline_stage === "No Longer Interested";
    }).length > 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 16px", borderTop: "0.5px solid #f0ebe3" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#bbb" } }, "Check box when exit survey has been sent")))))), obEditId && (function() {
      var ob = onboarding.find(function(o) {
        return o.id === obEditId;
      });
      if (!ob) return null;
      var tc = getAreaColor(ob.area_of_interest || obEditForm.area_of_interest);
      var fi = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13, boxSizing: "border-box", background: "#fff", fontFamily: "system-ui, sans-serif" };
      var lb = { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 3 };
      var grp = { marginBottom: 12 };
      return /* @__PURE__ */ React.createElement("div", { onClick: function() {
        setObEditId(null);
      }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2e3, padding: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
        e.stopPropagation();
      }, style: { background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.2)", maxHeight: "92vh", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 24px 16px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: tc.bg, borderRadius: "16px 16px 0 0" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#2a2a2a" } }, "Edit \u2014 ", ob.first_name, " ", ob.last_name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: tc.color, marginTop: 2 } }, "Onboarding Record")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setObEditId(null);
      }, style: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa", lineHeight: 1 } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 24px", overflowY: "auto", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "First Name"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.first_name, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { first_name: e.target.value });
        });
      }, style: fi })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Last Name"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.last_name, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { last_name: e.target.value });
        });
      }, style: fi }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Email"), /* @__PURE__ */ React.createElement("input", { type: "email", value: obEditForm.email, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { email: e.target.value });
        });
      }, style: fi })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Phone"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.phone, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { phone: e.target.value });
        });
      }, style: fi }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Area of Interest"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.area_of_interest, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { area_of_interest: e.target.value });
        });
      }, style: fi })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Team Assignment"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.team, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { team: e.target.value });
        });
      }, placeholder: "e.g. Grounds", style: fi }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Address"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.address, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { address: e.target.value });
        });
      }, style: fi })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Birthday (MM/DD/YYYY)"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.birthday, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { birthday: e.target.value });
        });
      }, placeholder: "e.g. 06/15/1985", style: fi })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Emergency Contact"), /* @__PURE__ */ React.createElement("input", { value: obEditForm.emergency_contact, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { emergency_contact: e.target.value });
        });
      }, placeholder: "Name & phone", style: fi }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { value: obEditForm.notes, onChange: function(e) {
        setObEditForm(function(f) {
          return Object.assign({}, f, { notes: e.target.value });
        });
      }, rows: 3, style: Object.assign({}, fi, { resize: "vertical" }), placeholder: "Paperwork notes, orientation details\u2026" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } }, /* @__PURE__ */ React.createElement("button", { onClick: saveObEdit, disabled: obEditSaving, style: { flex: 1, background: "#b5a185", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: obEditSaving ? 0.7 : 1 } }, obEditSaving ? "Saving\u2026" : "Save Changes"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setObEditId(null);
      }, style: { padding: "9px 18px", background: "#f0ece6", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer" } }, "Cancel")))));
    })(), showAdd && /* @__PURE__ */ React.createElement(
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
    const [editDon, setEditDon] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const [donorBenefits, setDonorBenefits] = useState([]);
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
      cachedSbFetch("2026 Donations", ["id", "Donor Name", "Last Name", "Informal Names", "Amount", "Close Date", "Donation Type", "Payment Type", "Account Type", "Acknowledged", "Salesforce", "Email", "Phone Number", "Address", "Benefits", "Donation Notes", "Donor Notes", "Notes"]).then(function(data) {
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
    useEffect(function() {
      if (!selected) {
        setDonorBenefits([]);
        return;
      }
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Donor Benefits") + "?donor_name=eq." + encodeURIComponent(selected["Donor Name"]) + "&select=*", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setDonorBenefits(Array.isArray(rows) ? rows.map(function(r) {
          return r.benefit;
        }) : []);
      });
    }, [selected]);
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
    function deleteDonation(d) {
      if (!window.confirm("Delete this donation from " + d["Donor Name"] + "? This cannot be undone.")) return;
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("2026 Donations") + "?id=eq." + d.id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        clearCache("2026 Donations");
        setDonations(function(prev) {
          return prev.filter(function(x) {
            return x.id !== d.id;
          });
        });
        setSelected(null);
      });
      fetch("https://script.google.com/macros/s/AKfycbxknvigF90NbBe86zrXT6JvRlaDQmvsuYuRYCfOOLISwtzDO3X7hH5TIDH7ALemwCWy/exec", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "delete", sheet: "2026 Donations", "Donor Name": d["Donor Name"], "Close Date": d["Close Date"] })
      });
    }
    function handleEditFormChange(e) {
      var { name, value, type, checked } = e.target;
      setEditForm(function(f) {
        return Object.assign({}, f, { [name]: type === "checkbox" ? checked : value });
      });
    }
    function saveEditDonation(e) {
      e.preventDefault();
      setEditSaving(true);
      var patch = Object.assign({}, editForm);
      delete patch.id;
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("2026 Donations") + "?id=eq." + editDon.id, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch)
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setEditSaving(false);
        clearCache("2026 Donations");
        var updated = rows && rows[0] ? rows[0] : Object.assign({}, editDon, patch);
        setDonations(function(prev) {
          return prev.map(function(x) {
            return x.id === editDon.id ? updated : x;
          });
        });
        setEditDon(null);
        setSelected(null);
      });
    }
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
        clearCache("2026 Donations");
        var inserted = Array.isArray(res) ? res[0] : res;
        if (inserted && inserted["Donor Name"]) setDonations(function(p) {
          return p.concat([inserted]);
        });
        setShowAdd(false);
        setForm(emptyDonForm);
        fetch("https://script.google.com/macros/s/AKfycbxknvigF90NbBe86zrXT6JvRlaDQmvsuYuRYCfOOLISwtzDO3X7hH5TIDH7ALemwCWy/exec", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ sheet: "2026 Donations", row })
        });
      }).catch(function() {
        setSaving(false);
      });
    }
    var DONOR_TIERS = [
      {
        name: "Blue Giant Star Sponsor",
        min: 2500,
        range: "$2,500\u2013$4,999",
        color: "#1565c0",
        bg: "#dbeafe",
        border: "#93c5fd",
        ownBenefits: ["Private docent-led tour with complimentary refreshments for up to 12 guests", "4 Complimentary Event Tickets"]
      },
      {
        name: "Red Giant Star Sponsor",
        min: 1e3,
        range: "$1,000\u2013$2,499",
        color: "#b91c1c",
        bg: "#fee2e2",
        border: "#fca5a5",
        ownBenefits: ['Custom engraved plaque with annual "stars"']
      },
      {
        name: "Evening Star",
        min: 500,
        range: "$500\u2013$999",
        color: "#c2410c",
        bg: "#ffedd5",
        border: "#fdba74",
        ownBenefits: ["2 Complimentary Tickets to a North Star House event"]
      },
      {
        name: "Morning Star",
        min: 250,
        range: "$250\u2013$499",
        color: "#7c3aed",
        bg: "#ede9fe",
        border: "#c4b5fd",
        ownBenefits: ["Recognition in our printed and digital event programs"]
      },
      {
        name: "Rising Star",
        min: 100,
        range: "$100\u2013$249",
        color: "#15803d",
        bg: "#dcfce7",
        border: "#86efac",
        ownBenefits: []
      },
      {
        name: "Shooting Star",
        min: 50,
        range: "$50\u2013$99",
        color: "#b45309",
        bg: "#fef9c3",
        border: "#fde047",
        ownBenefits: ["Access to our Online Loyalty Program & Newsletter subscription", "Invitation to our State of the Star Membership Celebration"]
      }
    ];
    function getDonorTier(total) {
      return DONOR_TIERS.find(function(t) {
        return total >= t.min;
      }) || null;
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
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Donor Benefits") + "?donor_name=eq." + encodeURIComponent(selected["Donor Name"]) + "&benefit=eq." + encodeURIComponent(benefit), {
          method: "DELETE",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
        }).then(function() {
          setDonorBenefits(function(prev) {
            return prev.filter(function(b) {
              return b !== benefit;
            });
          });
        });
      } else {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Donor Benefits"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ donor_name: selected["Donor Name"], benefit })
        }).then(function() {
          setDonorBenefits(function(prev) {
            return prev.concat([benefit]);
          });
        });
      }
    }
    var donorYTD = {};
    donations.forEach(function(d) {
      var n = d["Donor Name"];
      if (!donorYTD[n]) donorYTD[n] = 0;
      donorYTD[n] += parseAmount(d["Amount"]);
    });
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
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Raised", value: loading ? "..." : "$" + totalRaised.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: "2026 YTD" }), /* @__PURE__ */ React.createElement(StatCard, { label: "Donations", value: loading ? "..." : totalDonors }), /* @__PURE__ */ React.createElement(StatCard, { label: "Memberships", value: loading ? "..." : memberships }), /* @__PURE__ */ React.createElement(StatCard, { label: "Need Thank You", value: loading ? "..." : unacknowledged, sub: unacknowledged > 0 ? "" : "all clear" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888" } }, loading ? "Loading..." : totalDonors + " donation" + (totalDonors !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
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
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, (function() {
          var tier = getDonorTier(donorYTD[d["Donor Name"]] || 0);
          return tier ? /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: tier.color, lineHeight: 1 }, title: tier.name }, "\u2726") : null;
        })(), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: "#2a2a2a" } }, d["Donor Name"])), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#999", marginTop: 1 } }, d["Account Type"])),
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
    })(), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777" } }, fmtDate(selected["Close Date"])), (function() {
      var ytd = donorYTD[selected["Donor Name"]] || 0;
      var tier = getDonorTier(ytd);
      return tier ? /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: "1px solid " + tier.border, borderRadius: 20, padding: "2px 10px" } }, "\u2726 ", tier.name) : null;
    })()), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#666" } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 28px 24px", overflowY: "auto", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777", marginRight: 8 } }, "Amount"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 16, fontWeight: 600, color: gold } }, fmtAmount(selected["Amount"]))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Info"), selected["Informal Names"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Goes by"), selected["Informal Names"]), selected["Account Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Type"), selected["Account Type"]), selected["Email"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Email"), /* @__PURE__ */ React.createElement("a", { href: "mailto:" + selected["Email"], style: { color: gold, textDecoration: "none" } }, selected["Email"])), selected["Phone Number"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Phone"), selected["Phone Number"]), selected["Address"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Address"), /* @__PURE__ */ React.createElement("span", { style: { whiteSpace: "pre-line" } }, selected["Address"])), /* @__PURE__ */ React.createElement("span", { style: sec }, "Payment"), selected["Payment Type"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Method"), selected["Payment Type"]), selected["Benefits"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Benefits"), selected["Benefits"]), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#777", marginRight: 8 } }, "Acknowledged"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#e8f5e9" : "#fff8e1", color: selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "#2e7d32" : "#8a6200" } }, selected["Acknowledged"] === true || String(selected["Acknowledged"]).toUpperCase() === "TRUE" ? "Thanked" : "Pending"))), /* @__PURE__ */ React.createElement("div", null, selected["Donation Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donation Notes"])), selected["Donor Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Donor Notes"])), selected["Notes"] && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, background: "#faf8f4", borderRadius: 8, padding: "10px 14px", color: "#444", lineHeight: 1.6 } }, selected["Notes"])))), (function() {
      var ytd = donorYTD[selected["Donor Name"]] || 0;
      var tier = getDonorTier(ytd);
      if (!tier) return null;
      var benefits = getAllBenefits(tier);
      return /* @__PURE__ */ React.createElement("div", { style: { marginTop: 20, padding: "14px 16px", background: tier.bg, border: "1px solid " + tier.border, borderRadius: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: tier.color } }, "\u2726 ", tier.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: tier.color, opacity: 0.7 } }, tier.range, " \xB7 YTD $", ytd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, benefits.map(function(b) {
        var checked = donorBenefits.indexOf(b) !== -1;
        return /* @__PURE__ */ React.createElement("label", { key: b, style: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked, onChange: function() {
          toggleBenefit(b);
        }, style: { marginTop: 2, accentColor: tier.color, flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: tier.color, opacity: checked ? 1 : 0.7, textDecoration: checked ? "none" : "none", fontWeight: checked ? 600 : 400, lineHeight: 1.4 } }, b));
      })));
    })(), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 16 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { flex: 1, padding: "9px", background: "transparent", border: "0.5px solid #e0d8cc", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#999", fontWeight: 500 } }, "Close"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setEditDon(selected);
      setEditForm(Object.assign({}, selected));
    }, style: { padding: "9px 20px", background: gold, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 500 } }, "Edit"))))), editDon && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setEditDon(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 700, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a", marginBottom: 20 } }, "Edit Donation"), /* @__PURE__ */ React.createElement("form", { onSubmit: saveEditDonation }, /* @__PURE__ */ React.createElement("span", { style: sec }, "Donor"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "First / Full Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Donor Name", value: editForm["Donor Name"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Last Name"), /* @__PURE__ */ React.createElement("input", { name: "Last Name", value: editForm["Last Name"] || "", onChange: handleEditFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Goes By (Informal)"), /* @__PURE__ */ React.createElement("input", { name: "Informal Names", value: editForm["Informal Names"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Account Type"), /* @__PURE__ */ React.createElement("select", { name: "Account Type", value: editForm["Account Type"] || "", onChange: handleEditFormChange, style: iStyle }, ACCOUNT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("span", { style: sec }, "Donation"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Amount *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Amount", value: editForm["Amount"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Close Date"), /* @__PURE__ */ React.createElement("input", { name: "Close Date", type: "date", value: editForm["Close Date"] || "", onChange: handleEditFormChange, style: iStyle }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Type"), /* @__PURE__ */ React.createElement("select", { name: "Donation Type", value: editForm["Donation Type"] || "", onChange: handleEditFormChange, style: iStyle }, DONATION_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Payment Type"), /* @__PURE__ */ React.createElement("select", { name: "Payment Type", value: editForm["Payment Type"] || "", onChange: handleEditFormChange, style: iStyle }, PAYMENT_TYPES.map(function(t) {
      return /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Benefits"), /* @__PURE__ */ React.createElement("input", { name: "Benefits", value: editForm["Benefits"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Acknowledged", checked: !!editForm["Acknowledged"], onChange: handleEditFormChange }), " Acknowledged / Thanked"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", name: "Salesforce", checked: !!editForm["Salesforce"], onChange: handleEditFormChange }), " In Salesforce")), /* @__PURE__ */ React.createElement("span", { style: sec }, "Contact"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Email"), /* @__PURE__ */ React.createElement("input", { name: "Email", type: "email", value: editForm["Email"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: editForm["Phone Number"] || "", onChange: handleEditFormChange, style: iStyle })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Address"), /* @__PURE__ */ React.createElement("textarea", { name: "Address", value: editForm["Address"] || "", onChange: handleEditFormChange, rows: 3, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("span", { style: sec }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donation Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donation Notes", value: editForm["Donation Notes"] || "", onChange: handleEditFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Donor Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Donor Notes", value: editForm["Donor Notes"] || "", onChange: handleEditFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lStyle }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { name: "Notes", value: editForm["Notes"] || "", onChange: handleEditFormChange, rows: 2, style: Object.assign({}, iStyle, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: editSaving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: editSaving ? 0.7 : 1 } }, editSaving ? "Saving..." : "Save Changes"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setEditDon(null);
    }, style: { padding: 10, background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "Cancel"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      deleteDonation(editDon);
      setEditDon(null);
    }, style: { padding: "10px 16px", background: "transparent", border: "0.5px solid #e8a0a0", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#c0392b", fontWeight: 500 } }, "Delete"))))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
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
  var VOTE_COLORS = { "Yes": { bg: "#e8f5e9", color: "#2e7d32" }, "No": { bg: "#ffebee", color: "#c62828" }, "Abstain": { bg: "#f3f0ff", color: "#7c3aed" }, "Not in attendance": { bg: "#f5f5f5", color: "#888" } };
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
        cachedFetchAll("Board Voting Items"),
        cachedFetchAll("Board-Votes")
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
        return v.topicId == item.id;
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
    function refreshVotes() {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Board-Votes") + "?select=*", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(data) {
        if (Array.isArray(data)) {
          setVotes(data);
          clearCache("Board-Votes");
        }
      });
    }
    function handleVoteSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!voteForm.voter || !voteForm.choice) return;
      setVoteSaving(true);
      var existing = votes.find(function(v) {
        return v.topicId == selected.id && v.voter === voteForm.voter;
      });
      var today = (/* @__PURE__ */ new Date()).toDateString();
      var isInMeeting = selected.meeting_date && (/* @__PURE__ */ new Date(selected.meeting_date + "T12:00:00")).toDateString() === today;
      var payload = { topicId: selected.id, voter: voteForm.voter, choice: voteForm.choice, note: voteForm.note || null };
      if (existing) {
        var fullPayload = Object.assign({}, payload, { changed_in_meeting: isInMeeting ? true : existing.changed_in_meeting || false });
        sbPatchById("Board-Votes", existing.id, fullPayload).then(function() {
          setVoteSaving(false);
          setVoteForm({ voter: "", choice: "", note: "" });
          refreshVotes();
        });
      } else {
        sbInsert("Board-Votes", Object.assign({}, payload, { changed_in_meeting: false })).then(function(rows) {
          if (rows && rows.message) {
            alert("Error saving vote: " + rows.message);
            setVoteSaving(false);
            return;
          }
          setVoteSaving(false);
          setVoteForm({ voter: "", choice: "", note: "" });
          refreshVotes();
        }).catch(function(err) {
          alert("Error: " + err);
          setVoteSaving(false);
        });
      }
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
      }).then(function(rows) {
        if (rows && rows.message) {
          alert("Error: " + rows.message);
          setTopicSaving(false);
          return;
        }
        setTopicSaving(false);
        setShowAdd(false);
        setTopicForm({ title: "", description: "", attachment_url: "", submitted_by: "", due_date: "", meeting_date: "" });
        setAttachFileName("");
        setAttachUploading(false);
        clearCache("Board Voting Items");
        load();
      }).catch(function(err) {
        alert("Error: " + err);
        setTopicSaving(false);
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
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 24, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, "Voting Topics"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 } }, items.length, " topic", items.length !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
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
            style: { background: "#fff", border: "0.5px solid #e0d8cc", borderRadius: 10, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s" },
            onMouseEnter: function(e) {
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)";
            },
            onMouseLeave: function(e) {
              e.currentTarget.style.boxShadow = "none";
            }
          },
          /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 600, color: "#2a2a2a", marginBottom: 4 } }, item.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#777" } }, item.submitted_by ? /* @__PURE__ */ React.createElement("span", null, "Submitted by ", item.submitted_by, item.due_date ? " \xB7 " : "") : null, item.due_date ? /* @__PURE__ */ React.createElement("span", null, "Due ", fmtDate(item.due_date)) : null, item.meeting_date ? /* @__PURE__ */ React.createElement("span", null, " \xB7 Meeting ", fmtDate(item.meeting_date)) : null)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginLeft: 16, flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#777" } }, iv.length, "/", BOARD_MEMBERS.length, " voted"), revealed ? /* @__PURE__ */ React.createElement("span", { style: { background: "#e8f5e9", color: "#2e7d32", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 4 } }, "Closed \u2013 Decision Made") : /* @__PURE__ */ React.createElement("span", { style: { background: "#fff3e0", color: "#e65100", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 4 } }, "Open"))),
          revealed && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 10 } }, [["Yes", t.yes, "#2e7d32"], ["No", t.no, "#c62828"], ["Abstain", t.abstain, "#7c3aed"]].map(function(entry) {
            return /* @__PURE__ */ React.createElement("div", { key: entry[0], style: { fontSize: 12, color: entry[2], fontWeight: 600 } }, entry[1], " ", entry[0]);
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
        { label: "Abstain / Not in Attendance", count: t.abstain + t.absent, bg: "#f3f0ff", border: "#c4b5fd", color: "#7c3aed" }
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
    }))) : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "18px 20px", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a", marginBottom: 14 } }, "Cast your vote"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Your name"), /* @__PURE__ */ React.createElement("select", { value: voteForm.voter, onChange: function(e) {
      setVoteForm(function(f) {
        return Object.assign({}, f, { voter: e.target.value, choice: "", note: "" });
      });
    }, style: Object.assign({}, bInp, { marginTop: 4 }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select name\u2026"), BOARD_MEMBERS.map(function(m) {
      var hasVoted = itemVotes(selected).some(function(v) {
        return v.voter === m;
      });
      return /* @__PURE__ */ React.createElement("option", { key: m, value: m, style: { color: hasVoted ? "#bbb" : "#2a2a2a" } }, m, hasVoted ? " (Already voted)" : "");
    }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: bLbl }, "Vote"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 } }, ["Yes", "No", "Abstain", "Not in attendance"].map(function(opt) {
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
          style: { padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (active ? vc2.color : "#e0d8cc"), background: active ? vc2.bg : "#fff", color: active ? vc2.color : "#888", fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.1s" }
        },
        opt
      );
    }))), /* @__PURE__ */ React.createElement("textarea", { value: voteForm.note, onChange: function(e) {
      setVoteForm(function(f) {
        return Object.assign({}, f, { note: e.target.value });
      });
    }, rows: 2, style: Object.assign({}, bInp, { resize: "vertical", marginBottom: 12 }), placeholder: "Note (optional)\u2026" }), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleVoteSubmit,
        disabled: voteSaving || !voteForm.choice || !voteForm.voter,
        style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: voteSaving || !voteForm.choice || !voteForm.voter ? 0.5 : 1 }
      },
      voteSaving ? "Saving\u2026" : "Submit Vote"
    )), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 10 } }, "Vote Status \xB7 ", itemVotes(selected).length, "/", BOARD_MEMBERS.length, " submitted"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, BOARD_MEMBERS.map(function(m) {
      var mv = itemVotes(selected).find(function(v) {
        return v.voter === m;
      });
      return /* @__PURE__ */ React.createElement("div", { key: m, style: { background: "#fafafa", borderRadius: 6, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 500, color: "#2a2a2a", flex: 1 } }, m), mv ? /* @__PURE__ */ React.createElement("span", { style: { background: "#e8f5e9", color: "#2e7d32", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 } }, "\u2713 Voted") : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#bbb" } }, "No vote yet"));
    })))))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
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
    var isMobile = React.useContext(MobileCtx);
    const [goals, setGoals] = useS([]);
    const [loading, setLoading] = useS(true);
    const [tab, setTab] = useS("annual");
    const [activeCat, setActiveCat] = useS(null);
    const [editing, setEditing] = useS(null);
    const [editForm, setEditForm] = useS({});
    const [saving, setSaving] = useS(false);
    function load(bustCache) {
      if (bustCache) clearCache("Strategic Goals");
      cachedFetchAll("Strategic Goals").then(function(d) {
        var sorted = Array.isArray(d) ? d.slice().sort(function(a, b) {
          return (a.category || "").localeCompare(b.category || "") || a.id - b.id;
        }) : [];
        setGoals(sorted);
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
        load(true);
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
    return /* @__PURE__ */ React.createElement("div", null, !activeCat ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#888", marginBottom: 16, lineHeight: 1.6 } }, "View progress across strategic goals at a glance. Click any progress line to see more details for that focus area."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 } }, CATEGORY_ORDER.map(function(cat) {
      return CatBox(cat);
    }))) : /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, padding: "20px 24px", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, activeCat), /* @__PURE__ */ React.createElement("button", { onClick: function() {
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
    return new Date(yr, 11, 10);
  }
  function nextUpcomingDue() {
    var now = /* @__PURE__ */ new Date();
    now.setHours(0, 0, 0, 0);
    var yr = now.getFullYear();
    var candidates = ["Q1", "Q2", "Q3", "Q4"].map(function(q) {
      return { q, yr, date: quarterDueDate(q, yr) };
    }).concat(["Q1", "Q2", "Q3", "Q4"].map(function(q) {
      return { q, yr: yr + 1, date: quarterDueDate(q, yr + 1) };
    }));
    return candidates.find(function(c) {
      return c.date >= now;
    }) || candidates[0];
  }
  function nextQ(q, yr) {
    return q === "Q1" ? { q: "Q2", yr } : q === "Q2" ? { q: "Q3", yr } : q === "Q3" ? { q: "Q4", yr } : { q: "Q1", yr: yr + 1 };
  }
  function QuarterlyView({ navigateOp, quarterlyArea, navigateToQuarterly }) {
    var { useState: useState2, useEffect: useEffect2 } = React;
    var isMobile = React.useContext(MobileCtx);
    var cq = currentQuarterStr();
    var cy = (/* @__PURE__ */ new Date()).getFullYear();
    var [area, setArea] = useState2(quarterlyArea || "");
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
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(quarter) + "&year=eq." + year + "&select=*").then(function(rows) {
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
        clearCache("Op Quarter Goals");
        clearCache("Op Quarterly Updates");
        setSaving(false);
        if (navigateOp && area) {
          navigateOp(area);
        } else {
          setSaved(true);
          setTimeout(function() {
            setSaved(false);
          }, 4e3);
        }
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
    return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: "100%" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "16px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 8 } }, "About Quarterly Updates"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.7, fontStyle: "italic" } }, "Share quarterly progress, challenges, and support needs for each focus area."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } }, [["1", "Area lead submits this form"], ["2", "Co-Champions review submissions"], ["3", "Discussed as main item on Board agenda"]].map(function(s) {
      return /* @__PURE__ */ React.createElement("div", { key: s[0], style: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, color: "#666" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 20, height: 20, borderRadius: "50%", background: gold, color: "#fff", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, s[0]), s[1]);
    }))), /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", border: "0.5px solid #e8e0d5", borderRadius: 10, padding: "16px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 10 } }, "Quarterly Schedule"), (function() {
      var all = [
        { q: "Q1", dates: "Jan 1 \u2013 Mar 31", due: "Mar 31", champion: "Apr 2", board: "Apr 16" },
        { q: "Q2", dates: "Apr 1 \u2013 Jun 30", due: "Jun 30", champion: "Jul 2", board: "Jul 16" },
        { q: "Q3", dates: "Jul 1 \u2013 Sep 30", due: "Sep 30", champion: "Oct 1", board: "Oct 15" },
        { q: "Q4", dates: "Oct 1 \u2013 Dec 31", due: "Dec 10", champion: "Dec 10", board: "Dec 17" }
      ];
      var ci = all.findIndex(function(x) {
        return x.q === quarter;
      });
      var next = all[(ci + 1) % 4];
      var visible = [all[ci], next];
      return visible.map(function(q, idx) {
        var isCurrent = idx === 0;
        return /* @__PURE__ */ React.createElement("div", { key: q.q, style: { marginBottom: idx === 0 ? 10 : 0, paddingBottom: idx === 0 ? 10 : 0, borderBottom: idx === 0 ? "0.5px solid #ede5d8" : "none" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: isCurrent ? gold : "#888" } }, q.q), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#aaa" } }, q.dates), isCurrent && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, background: gold, color: "#fff", borderRadius: 20, padding: "1px 7px", fontWeight: 600 } }, "Current"), !isCurrent && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: "#bbb", fontStyle: "italic" } }, "Up next")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: isCurrent ? "#777" : "#aaa", lineHeight: 1.8, paddingLeft: 2 } }, /* @__PURE__ */ React.createElement("span", { style: { color: isCurrent ? "#999" : "#bbb" } }, "Due:"), " ", q.due, " \xA0\xB7\xA0 ", /* @__PURE__ */ React.createElement("span", { style: { color: isCurrent ? "#999" : "#bbb" } }, "Co-Champions:"), " ", q.champion, " \xA0\xB7\xA0 ", /* @__PURE__ */ React.createElement("span", { style: { color: isCurrent ? "#999" : "#bbb" } }, "Board:"), " ", q.board));
      });
    })())), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("div", { style: cardFirst }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Area & Period"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Organizational Area *"), /* @__PURE__ */ React.createElement("select", { required: true, value: area, onChange: function(e) {
      setArea(e.target.value);
    }, style: inpStyle }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select area..."), OPERATIONAL_AREAS.map(function(a) {
      return /* @__PURE__ */ React.createElement("option", { key: a }, a);
    }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Quarter *"), /* @__PURE__ */ React.createElement("select", { required: true, value: quarter, onChange: function(e) {
      setQuarter(e.target.value);
    }, style: inpStyle }, /* @__PURE__ */ React.createElement("option", null, "Q1"), /* @__PURE__ */ React.createElement("option", null, "Q2"), /* @__PURE__ */ React.createElement("option", null, "Q3"), /* @__PURE__ */ React.createElement("option", null, "Q4"))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Year"), /* @__PURE__ */ React.createElement("input", { type: "number", value: year, onChange: function(e) {
      setYear(parseInt(e.target.value) || cy);
    }, style: inpStyle }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Date Submitted"), /* @__PURE__ */ React.createElement("input", { readOnly: true, value: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US"), style: Object.assign({}, inpStyle, { background: "#f9f7f4", color: "#999" }) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Due Date"), /* @__PURE__ */ React.createElement("input", { readOnly: true, value: quarterDueDate(quarter, year).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), style: Object.assign({}, inpStyle, { background: "#f9f7f4", color: "#999" }) })))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("span", { style: secStyle }, "Goal Progress"), currentGoals && currentGoals.primary_focus && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: "10px 14px", background: "#faf8f5", borderRadius: 6, borderLeft: "3px solid " + gold } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: gold, fontWeight: 600, marginBottom: 4 } }, "Primary Focus \u2014 ", quarter, " ", year), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a" } }, currentGoals.primary_focus)), currentGoals ? [["goal_1", "goal_1_status", "goal_1_summary"], ["goal_2", "goal_2_status", "goal_2_summary"], ["goal_3", "goal_3_status", "goal_3_summary"]].map(function(keys, i) {
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
  function OperationalView({ opArea, navigateToQuarterly }) {
    var { useState: useState2, useEffect: useEffect2 } = React;
    var isMobile = React.useContext(MobileCtx);
    var area = opArea || OPERATIONAL_AREAS[0];
    var [areaInfo, setAreaInfo] = useState2(null);
    var [budget, setBudget] = useState2([]);
    var [vols, setVols] = useState2([]);
    var [showBudget, setShowBudget] = useState2(false);
    var [showVols, setShowVols] = useState2(false);
    var [editLead, setEditLead] = useState2(false);
    var [leadInput, setLeadInput] = useState2("");
    var [showEarnings, setShowEarnings] = useState2(false);
    var [earnings, setEarnings] = useState2([]);
    var emptyEarningsForm = { event: "", earning_source: "", amount: "", notes: "", date: today };
    var [earningsForm, setEarningsForm] = useState2(emptyEarningsForm);
    var [earningsSaving, setEarningsSaving] = useState2(false);
    var today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    var [budgetForm, setBudgetForm] = useState2({ type: "Purchase", description: "", amount: "", date: today, needs_reimbursement: false });
    var [budgetSaving, setBudgetSaving] = useState2(false);
    var [uploadingId, setUploadingId] = useState2(null);
    var fileInputRef = React.useRef(null);
    var [budgetReceiptFile, setBudgetReceiptFile] = useState2(null);
    var budgetReceiptRef = React.useRef(null);
    var [noteEdit, setNoteEdit] = useState2(null);
    var [noteVal, setNoteVal] = useState2("");
    var [noteSaving, setNoteSaving] = useState2(null);
    var [quarterGoals, setQuarterGoals] = useState2(null);
    var [quarterUpdate, setQuarterUpdate] = useState2(null);
    var [cardFlipped, setCardFlipped] = useState2(false);
    var [resources, setResources] = useState2([]);
    var [showAddResource, setShowAddResource] = useState2(false);
    var [resourceType, setResourceType] = useState2("link");
    var [resourceTitle, setResourceTitle] = useState2("");
    var [resourceUrl, setResourceUrl] = useState2("");
    var [resourceSaving, setResourceSaving] = useState2(false);
    var resourceFileRef = React.useRef(null);
    var [showSponsorForm, setShowSponsorForm] = useState2(false);
    var emptySponsorForm = { "Business Name": "", "Main Contact": "", "Phone Number": "", "Email Address": "", "Mailing Address": "", "Donation": "", "Fair Market Value": "", "Area Supported": area, "Date Recieved": "", "NSH Contact": "" };
    var [sponsorForm, setSponsorForm] = useState2(emptySponsorForm);
    var [sponsorSaving, setSponsorSaving] = useState2(false);
    var [sponsorSaved, setSponsorSaved] = useState2(false);
    var cq = currentQuarterStr();
    var [selectedQ, setSelectedQ] = useState2(cq);
    var emptyCcForm = { status: "On track", discussion_focus: "", potential_actions: "", escalation: "None", escalation_other: "", priority_confirmation: "Approved", review_date: "" };
    var [ccReview, setCcReview] = useState2(null);
    var [ccForm, setCcForm] = useState2(emptyCcForm);
    var [ccSaving, setCcSaving] = useState2(false);
    var [ccEditing, setCcEditing] = useState2(false);
    useEffect2(function() {
      setQuarterGoals(null);
      setQuarterUpdate(null);
      setCcReview(null);
      setCcEditing(false);
      setCardFlipped(false);
      var yr = (/* @__PURE__ */ new Date()).getFullYear();
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(selectedQ) + "&year=eq." + yr + "&select=*").then(function(rows) {
        if (rows && rows[0]) setQuarterGoals(rows[0]);
      });
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarterly Updates") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(selectedQ) + "&year=eq." + yr + "&select=*&order=date_submitted.desc&limit=1").then(function(rows) {
        if (rows && rows[0]) setQuarterUpdate(rows[0]);
      });
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews") + "?area=eq." + encodeURIComponent(area) + "&quarter=eq." + encodeURIComponent(selectedQ) + "&year=eq." + yr + "&select=*&limit=1").then(function(rows) {
        if (rows && rows[0]) {
          setCcReview(rows[0]);
          setCcForm(Object.assign({}, emptyCcForm, rows[0]));
        }
      });
    }, [area, selectedQ]);
    useEffect2(function() {
      setAreaInfo(null);
      setBudget([]);
      setVols([]);
      setResources([]);
      setEditLead(false);
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Operational Areas") + "?area=eq." + encodeURIComponent(area) + "&select=*").then(function(rows) {
        if (rows && rows[0]) {
          setAreaInfo(rows[0]);
          setLeadInput(rows[0].lead || "");
        }
      });
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?area=eq." + encodeURIComponent(area) + "&select=*&order=date.desc,id.desc").then(function(rows) {
        if (Array.isArray(rows)) setBudget(rows);
      });
      cachedSbFetch("2026 Volunteers", ["id", "First Name", "Last Name", "Team", "Notes", "Overview Notes", "Status", "Picture URL", "Phone Number", "Email"]).then(function(rows) {
        if (!Array.isArray(rows)) return;
        setVols(rows.filter(function(v) {
          if (!v.Team) return false;
          var areaAliases = { "Events": ["events team", "event support", "events"], "Docents": ["docent", "docents"], "Venue": ["venue"] };
          var matches = areaAliases[area] || [area.toLowerCase()];
          return v.Team.split(/[,|]/).some(function(t) {
            return matches.indexOf(t.trim().toLowerCase()) !== -1;
          });
        }));
      });
      cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Resources") + "?area=eq." + encodeURIComponent(area) + "&select=*&order=created_at.asc").then(function(rows) {
        if (Array.isArray(rows)) setResources(rows);
      });
      if (area === "Events") {
        cachedFetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Earnings") + "?area=eq." + encodeURIComponent(area) + "&select=*&order=date.desc,id.desc").then(function(rows) {
          if (Array.isArray(rows)) setEarnings(rows);
        });
      }
    }, [area]);
    function saveLead() {
      if (!leadInput) return;
      if (areaInfo) {
        sbPatchById("Operational Areas", areaInfo.id, { lead: leadInput }).then(function() {
          clearCache("Operational Areas");
          setAreaInfo(Object.assign({}, areaInfo, { lead: leadInput }));
          setEditLead(false);
        });
      } else {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Operational Areas"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ area, lead: leadInput })
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          clearCache("Operational Areas");
          if (rows && rows[0]) setAreaInfo(rows[0]);
          setEditLead(false);
        });
      }
    }
    function addEarningItem(e) {
      e.preventDefault();
      setEarningsSaving(true);
      var payload = { area, event: earningsForm.event, earning_source: earningsForm.earning_source, amount: parseFloat(earningsForm.amount) || 0, notes: earningsForm.notes || null, date: earningsForm.date || null };
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Earnings"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows.code) {
          setEarningsSaving(false);
          alert("Add failed: " + (rows.message || rows.code));
          return;
        }
        clearCache("Op Earnings");
        setEarningsSaving(false);
        if (rows && rows[0]) setEarnings(function(prev) {
          return [rows[0]].concat(prev);
        });
        setEarningsForm(emptyEarningsForm);
      });
    }
    function deleteEarningItem(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Earnings") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        clearCache("Op Earnings");
        setEarnings(function(prev) {
          return prev.filter(function(e) {
            return e.id !== id;
          });
        });
      });
    }
    function addBudgetItem(e) {
      e.preventDefault();
      setBudgetSaving(true);
      var file = budgetReceiptFile;
      var payload = { area, type: budgetForm.type, description: budgetForm.description, amount: parseFloat(budgetForm.amount) || 0, date: budgetForm.date || null };
      if (budgetForm.needs_reimbursement) payload.needs_reimbursement = true;
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows.code) {
          setBudgetSaving(false);
          alert("Add failed: " + (rows.message || rows.hint || rows.code));
          return;
        }
        var newRow = rows && rows[0];
        if (!newRow) {
          setBudgetSaving(false);
          return;
        }
        if (!file) {
          clearCache("Op Budget");
          setBudgetSaving(false);
          setBudget(function(prev) {
            return [newRow].concat(prev);
          });
          setBudgetForm({ type: "Purchase", description: "", amount: "", date: today, needs_reimbursement: false });
          setBudgetReceiptFile(null);
          return;
        }
        var ext = file.name.split(".").pop();
        var filename = area.toLowerCase().replace(/\s+/g, "-") + "-" + newRow.id + "-" + Date.now() + "." + ext;
        fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + filename, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
          body: file
        }).then(function() {
          var url = SUPABASE_URL + "/storage/v1/object/public/receipts/" + filename;
          return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + newRow.id, {
            method: "PATCH",
            headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ receipt_url: url })
          }).then(function() {
            clearCache("Op Budget");
            setBudgetSaving(false);
            setBudget(function(prev) {
              return [Object.assign({}, newRow, { receipt_url: url })].concat(prev);
            });
            setBudgetForm({ type: "Purchase", description: "", amount: "", date: today, needs_reimbursement: false });
            setBudgetReceiptFile(null);
            if (budgetReceiptRef.current) budgetReceiptRef.current.value = "";
          });
        });
      });
    }
    function deleteBudgetItem(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        clearCache("Op Budget");
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
          clearCache("Op Budget");
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
    function submitCcReview(e) {
      e.preventDefault();
      setCcSaving(true);
      var yr = (/* @__PURE__ */ new Date()).getFullYear();
      var payload = { area, quarter: selectedQ, year: yr, status: ccForm.status, discussion_focus: ccForm.discussion_focus || null, potential_actions: ccForm.potential_actions || null, escalation: ccForm.escalation, escalation_other: ccForm.escalation === "Other" ? ccForm.escalation_other || null : null, priority_confirmation: ccForm.priority_confirmation, review_date: ccForm.review_date || null };
      if (ccReview) {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews") + "?id=eq." + ccReview.id, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload)
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          clearCache("Op Co-Champion Reviews");
          var updated = rows && rows[0] ? rows[0] : Object.assign({}, ccReview, payload);
          setCcReview(updated);
          setCcSaving(false);
          setCcEditing(false);
        });
      } else {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload)
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          clearCache("Op Co-Champion Reviews");
          if (rows && rows[0]) setCcReview(rows[0]);
          setCcSaving(false);
          setCcEditing(false);
        });
      }
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
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "14px 20px", border: "0.5px solid #e8e0d5", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 6 } }, "Operational Area"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, area)), /* @__PURE__ */ React.createElement("div", { style: { width: 200, flexShrink: 0 } }, (function() {
      if (area === "Venue") {
        return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 2 } }, "Lead"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 15, color: "#2a2a2a", fontWeight: 500 } }, "Staff"));
      }
      var leadName = areaInfo && areaInfo.lead ? areaInfo.lead : defaultLead;
      var leadPic = areaDefaults.pic || "";
      if (editLead) {
        return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } }, /* @__PURE__ */ React.createElement("select", { autoFocus: true, value: leadInput, onChange: function(e) {
          setLeadInput(e.target.value);
        }, style: { fontSize: 13, padding: "5px 8px", border: "0.5px solid #e0d8cc", borderRadius: 6, background: "#fff", minWidth: 160 } }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Select lead \u2014"), vols.map(function(v) {
          var n = v["First Name"] + " " + v["Last Name"];
          return /* @__PURE__ */ React.createElement("option", { key: v.id, value: n }, n);
        })), /* @__PURE__ */ React.createElement("button", { onClick: saveLead, style: { background: gold, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" } }, "Save"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
          setEditLead(false);
        }, style: { background: "#f0ece6", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#666" } }, "Cancel"));
      }
      return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }, onClick: function() {
        setEditLead(true);
        setLeadInput(leadName || "");
      } }, leadPic ? /* @__PURE__ */ React.createElement("img", { src: driveImg(leadPic), alt: leadName, style: { width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 48, height: 48, borderRadius: "50%", background: "#f0ece6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "#999", flexShrink: 0 } }, leadName ? leadName[0] : "?"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600, marginBottom: 2 } }, "Lead"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 15, color: "#2a2a2a", fontWeight: 500 } }, leadName || /* @__PURE__ */ React.createElement("span", { style: { color: "#ccc", fontStyle: "italic" } }, "Not set"))));
    })())), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
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
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: gold } }, allocation != null ? fmt(allocation) : "$0"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 3 } }, fmt(totalPurchases), " / ", allocation != null ? fmt(allocation) : "$0"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, marginTop: 10, fontWeight: 500 } }, "View / Add entries \u2192")
    ), area === "Events" && /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: function() {
          setShowEarnings(true);
        },
        style: cardHover,
        onMouseEnter: function(e) {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        },
        onMouseLeave: function(e) {
          e.currentTarget.style.boxShadow = "none";
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 8 } }, "Earnings"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: gold } }, fmt(earnings.reduce(function(s, e) {
        return s + (parseFloat(e.amount) || 0);
      }, 0))),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 3 } }, earnings.length, " ", earnings.length === 1 ? "entry" : "entries"),
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
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 16, marginBottom: 20 } }, (function() {
      var stColors = { "On Track": { bg: "#eaf3ea", color: "#3a7d3a" }, "Behind": { bg: "#fff3e0", color: "#c07040" }, "Complete": { bg: "#e8f5e9", color: "#2e7d32" }, "At Risk": { bg: "#fdecea", color: "#c62828" } };
      var goalRows = [["goal_1", "goal_1_status", "goal_1_summary"], ["goal_2", "goal_2_status", "goal_2_summary"], ["goal_3", "goal_3_status", "goal_3_summary"]];
      var frontCard = /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "18px 24px", border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600 } }, selectedQ, " ", (/* @__PURE__ */ new Date()).getFullYear(), " Goals"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, ["Q1", "Q2", "Q3", "Q4"].map(function(q) {
        var isActive = q === selectedQ;
        var isCurrent = q === cq;
        return /* @__PURE__ */ React.createElement("button", { key: q, onClick: function() {
          setSelectedQ(q);
        }, style: { fontSize: 11, fontWeight: isActive ? 700 : 400, padding: "2px 9px", borderRadius: 5, border: "0.5px solid " + (isActive ? gold : "#e0d8cc"), background: isActive ? gold : "#fff", color: isActive ? "#fff" : isCurrent ? gold : "#aaa", cursor: "pointer" } }, q);
      }))), quarterGoals ? /* @__PURE__ */ React.createElement("div", null, quarterGoals.primary_focus && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "Primary Focus"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", marginTop: 3, lineHeight: 1.5 } }, quarterGoals.primary_focus)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, goalRows.map(function(keys, i) {
        var g = quarterGoals[keys[0]];
        if (!g) return null;
        var st = quarterGoals[keys[1]];
        var sc = st && stColors[st] ? stColors[st] : null;
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { background: "#faf8f5", borderRadius: 8, padding: "10px 12px", border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600 } }, "Goal ", i + 1), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", marginTop: 2, lineHeight: 1.5 } }, g)), sc && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0 } }, st)));
      })), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", marginTop: 14 } }, /* @__PURE__ */ React.createElement("button", { onClick: function(e) {
        e.stopPropagation();
        setCardFlipped(true);
      }, style: { fontSize: 11, color: gold, background: "none", border: "0.5px solid " + gold, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 500 } }, "View Full Reflection \u2192"))) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#ccc", fontStyle: "italic" } }, "No goals set for ", cq, " yet."));
      var backCard = /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "18px 24px", border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600 } }, selectedQ, " ", (/* @__PURE__ */ new Date()).getFullYear(), " Reflection"), /* @__PURE__ */ React.createElement("button", { onClick: function(e) {
        e.stopPropagation();
        setCardFlipped(false);
      }, style: { fontSize: 11, color: "#888", background: "none", border: "0.5px solid #ccc", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 500 } }, "\u2190 Goals")), quarterGoals || quarterUpdate ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, quarterGoals && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "Goal Progress"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 } }, goalRows.map(function(keys, i) {
        var g = quarterGoals[keys[0]];
        if (!g) return null;
        var st = quarterGoals[keys[1]];
        var sm = quarterGoals[keys[2]];
        var sc = st && stColors[st] ? stColors[st] : null;
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { background: sc ? sc.bg : "#faf8f5", borderRadius: 8, padding: "8px 12px", border: "0.5px solid " + (sc ? sc.color + "33" : "#e8e0d5") } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#999", marginBottom: 2 } }, "Goal ", i + 1, " \u2014 ", /* @__PURE__ */ React.createElement("span", { style: { color: "#555", fontWeight: 600 } }, g)), sm && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", lineHeight: 1.5 } }, sm)), sc && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "#fff", color: sc.color, flexShrink: 0 } }, st)));
      }))), quarterUpdate && (quarterUpdate.what_went_well || quarterUpdate.successes) && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "What Went Well"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", marginTop: 3, lineHeight: 1.6 } }, quarterUpdate.what_went_well || quarterUpdate.successes)), quarterUpdate && (function() {
        var checked = [].concat(quarterUpdate.challenges || []);
        if (!checked.length) return null;
        return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "Challenges Encountered"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", marginTop: 4, lineHeight: 1.6, fontWeight: 600 } }, checked.join(" | ")), quarterUpdate.challenges_details && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", marginTop: 6, lineHeight: 1.5 } }, quarterUpdate.challenges_details));
      })(), quarterUpdate && (function() {
        var checked = [].concat(quarterUpdate.support_needed || []);
        if (!checked.length) return null;
        return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "Support Needed"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", marginTop: 4, lineHeight: 1.6, fontWeight: 600 } }, checked.join(" | ")), quarterUpdate.support_details && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", marginTop: 6, lineHeight: 1.5 } }, quarterUpdate.support_details));
      })(), quarterUpdate && quarterUpdate.other_notes && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600 } }, "Other Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", marginTop: 3, lineHeight: 1.6 } }, quarterUpdate.other_notes)), quarterUpdate && quarterUpdate.date_submitted && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", marginTop: 4 } }, "Submitted ", quarterUpdate.date_submitted)) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#ccc", fontStyle: "italic" } }, "No reflection submitted yet."));
      return cardFlipped ? backCard : frontCard;
    })(), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, padding: "18px 24px", border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: gold, fontWeight: 600, marginBottom: 12 } }, "Area Resources"), resources.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#ccc", fontStyle: "italic", marginBottom: 12 } }, "No resources added yet.") : resources.map(function(r) {
      return /* @__PURE__ */ React.createElement(
        "a",
        {
          key: r.id,
          href: r.url,
          target: "_blank",
          rel: "noopener noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, background: "#faf8f5", borderRadius: 8, border: "0.5px solid #e8e0d5", textDecoration: "none", color: "#2a2a2a" },
          onMouseEnter: function(e) {
            e.currentTarget.style.background = "#f5f0e8";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.background = "#faf8f5";
          }
        },
        /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }), /* @__PURE__ */ React.createElement("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "14", x2: "21", y2: "3" })),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 500, color: gold, flex: 1 } }, r.title),
        r.description && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#aaa" } }, r.description)
      );
    }), showAddResource ? /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 8, padding: "12px 14px", marginBottom: 6, border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, ["link", "file"].map(function(t) {
      return /* @__PURE__ */ React.createElement("button", { key: t, onClick: function() {
        setResourceType(t);
      }, style: { fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "0.5px solid " + (resourceType === t ? gold : "#e0d8cc"), background: resourceType === t ? gold : "#fff", color: resourceType === t ? "#fff" : "#888", cursor: "pointer", fontWeight: resourceType === t ? 600 : 400 } }, t === "link" ? "Link" : "Upload File");
    })), /* @__PURE__ */ React.createElement("input", { value: resourceTitle, onChange: function(e) {
      setResourceTitle(e.target.value);
    }, placeholder: "Title", style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: "border-box" } }), resourceType === "link" ? /* @__PURE__ */ React.createElement("input", { value: resourceUrl, onChange: function(e) {
      setResourceUrl(e.target.value);
    }, placeholder: "https://\u2026", style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: "border-box" } }) : /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      resourceFileRef.current.click();
    }, style: { fontSize: 12, color: gold, background: "#fff", border: "0.5px dashed " + gold, borderRadius: 7, padding: "7px 14px", cursor: "pointer", width: "100%" } }, resourceUrl ? "\u2713 " + resourceUrl.split("/").pop().slice(0, 30) : "Choose file\u2026"), /* @__PURE__ */ React.createElement("input", { ref: resourceFileRef, type: "file", style: { display: "none" }, onChange: function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!resourceTitle) setResourceTitle(file.name.replace(/\.[^.]+$/, ""));
      setResourceUrl("__file__:" + file.name);
    } })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { disabled: resourceSaving, onClick: function() {
      if (!resourceTitle) return;
      setResourceSaving(true);
      function saveRecord(url) {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Resources"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ area, title: resourceTitle, url })
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          clearCache("Op Resources");
          setResourceSaving(false);
          if (rows && rows[0]) setResources(function(prev) {
            return prev.concat([rows[0]]);
          });
          setResourceTitle("");
          setResourceUrl("");
          setShowAddResource(false);
        });
      }
      if (resourceType === "link") {
        saveRecord(resourceUrl);
      } else {
        var file = resourceFileRef.current && resourceFileRef.current.files[0];
        if (!file) {
          setResourceSaving(false);
          return;
        }
        var ext = file.name.split(".").pop();
        var filename = area.replace(/\s+/g, "-").toLowerCase() + "-" + Date.now() + "." + ext;
        fetch(SUPABASE_URL + "/storage/v1/object/area-resources/" + filename, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
          body: file
        }).then(function() {
          saveRecord(SUPABASE_URL + "/storage/v1/object/public/area-resources/" + filename);
        }).catch(function() {
          setResourceSaving(false);
        });
      }
    }, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: resourceSaving ? 0.7 : 1 } }, resourceSaving ? "Saving\u2026" : "Add"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAddResource(false);
      setResourceTitle("");
      setResourceUrl("");
    }, style: { padding: "7px 12px", background: "#f0ece6", border: "none", borderRadius: 7, fontSize: 12, color: "#666", cursor: "pointer" } }, "Cancel"))) : /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAddResource(true);
      setResourceType("link");
    }, style: { width: "100%", marginTop: 4, padding: "8px 12px", background: "none", border: "none", fontSize: 12, color: gold, fontWeight: 500, cursor: "pointer", textAlign: "right", display: "block" } }, "Add Resource \u2192"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSponsorForm(Object.assign({}, emptySponsorForm, { "Area Supported": area }));
      setSponsorSaved(false);
      setShowSponsorForm(true);
    }, style: { width: "100%", marginTop: 6, padding: "9px 12px", background: "#faf8f5", border: "0.5px dashed " + gold, borderRadius: 8, fontSize: 12, color: gold, fontWeight: 500, cursor: "pointer", textAlign: "left" } }, "+ In-Kind Sponsorship Form"))), showSponsorForm && (function() {
      var areaOptions = ["Restoration", "Grounds", "Events", "Interiors", "Construction", "Docents", "Fundraising", "Marketing", "Venue", "General"];
      var fi = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", background: "#fff" };
      var lb = { fontSize: 12, color: "#666", fontWeight: 500, display: "block", marginBottom: 4 };
      var grp = { marginBottom: 14 };
      function fc(e) {
        var k = e.target.name, v = e.target.value;
        setSponsorForm(function(f) {
          return Object.assign({}, f, { [k]: v });
        });
      }
      function handleSubmit(e) {
        e.preventDefault();
        setSponsorSaving(true);
        var row = {};
        Object.keys(sponsorForm).forEach(function(k) {
          if (sponsorForm[k]) row[k] = sponsorForm[k];
        });
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsors"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(row)
        }).then(function(r) {
          return r.json();
        }).then(function() {
          clearCache("Sponsors");
          setSponsorSaving(false);
          setSponsorSaved(true);
          setSponsorForm(Object.assign({}, emptySponsorForm, { "Area Supported": area }));
        }).catch(function() {
          setSponsorSaving(false);
        });
      }
      return /* @__PURE__ */ React.createElement("div", { onClick: function() {
        setShowSponsorForm(false);
      }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
        e.stopPropagation();
      }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, "In-Kind Sponsorship"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 } }, "Documentation Form")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setShowSponsorForm(false);
      }, style: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#bbb" } }, "\xD7")), sponsorSaved && /* @__PURE__ */ React.createElement("div", { style: { background: "#e8f5e9", color: "#2e7d32", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16 } }, "Submitted successfully \u2014 sponsor added to the list."), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Sponsor Name *"), /* @__PURE__ */ React.createElement("input", { required: true, name: "Business Name", value: sponsorForm["Business Name"], onChange: fc, style: fi })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Main Contact"), /* @__PURE__ */ React.createElement("input", { name: "Main Contact", value: sponsorForm["Main Contact"], onChange: fc, style: fi })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Phone Number"), /* @__PURE__ */ React.createElement("input", { name: "Phone Number", value: sponsorForm["Phone Number"], onChange: fc, style: fi }))), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Email Address"), /* @__PURE__ */ React.createElement("input", { name: "Email Address", type: "email", value: sponsorForm["Email Address"], onChange: fc, style: fi })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Mailing Address"), /* @__PURE__ */ React.createElement("input", { name: "Mailing Address", value: sponsorForm["Mailing Address"], onChange: fc, style: fi })), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid #f0ece6", margin: "16px 0" } }), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "In-Kind Donation Description"), /* @__PURE__ */ React.createElement("textarea", { name: "Donation", value: sponsorForm["Donation"], onChange: fc, rows: 3, style: Object.assign({}, fi, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Estimated Fair Market Value"), /* @__PURE__ */ React.createElement("input", { name: "Fair Market Value", value: sponsorForm["Fair Market Value"], onChange: fc, style: fi, placeholder: "e.g. $500" })), /* @__PURE__ */ React.createElement("div", { style: grp }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Area Supported"), /* @__PURE__ */ React.createElement("select", { name: "Area Supported", value: sponsorForm["Area Supported"], onChange: fc, style: fi }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select area\u2026"), areaOptions.map(function(a) {
        return /* @__PURE__ */ React.createElement("option", { key: a, value: a }, a);
      }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Date Received"), /* @__PURE__ */ React.createElement("input", { name: "Date Recieved", type: "date", value: sponsorForm["Date Recieved"], onChange: fc, style: fi })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "NSH Contact"), /* @__PURE__ */ React.createElement("input", { name: "NSH Contact", value: sponsorForm["NSH Contact"], onChange: fc, style: fi }))), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: sponsorSaving, style: { width: "100%", background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 600, cursor: sponsorSaving ? "not-allowed" : "pointer", opacity: sponsorSaving ? 0.7 : 1 } }, sponsorSaving ? "Submitting\u2026" : "Submit Sponsorship"))));
    })(), showBudget && /* @__PURE__ */ React.createElement("div", { onClick: function() {
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
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "What was purchased or donated..." })), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Receipt (optional)"), /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: function() {
          budgetReceiptRef.current && budgetReceiptRef.current.click();
        },
        style: { border: "0.5px dashed #e0d8cc", borderRadius: 7, padding: "8px 12px", fontSize: 13, cursor: "pointer", color: budgetReceiptFile ? "#2a2a2a" : "#bbb", background: "#fafaf8", display: "flex", alignItems: "center", gap: 8 }
      },
      /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 } }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" })),
      /* @__PURE__ */ React.createElement("span", null, budgetReceiptFile ? budgetReceiptFile.name : "Attach image or PDF\u2026"),
      budgetReceiptFile && /* @__PURE__ */ React.createElement("span", { onClick: function(ev) {
        ev.stopPropagation();
        setBudgetReceiptFile(null);
        if (budgetReceiptRef.current) budgetReceiptRef.current.value = "";
      }, style: { marginLeft: "auto", color: "#bbb", cursor: "pointer", fontSize: 14 } }, "\xD7")
    ), /* @__PURE__ */ React.createElement("input", { ref: budgetReceiptRef, type: "file", accept: "image/*,.pdf", style: { display: "none" }, onChange: function(e) {
      setBudgetReceiptFile(e.target.files[0] || null);
    } })), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: budgetForm.needs_reimbursement ? "#b45309" : "#555" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: budgetForm.needs_reimbursement, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { needs_reimbursement: e.target.checked });
      });
    }, style: { width: 15, height: 15, accentColor: gold, cursor: "pointer" } }), "Needs reimbursement?", budgetForm.needs_reimbursement && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "2px 7px", borderRadius: 10, fontWeight: 500 } }, "Will appear in Financials"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "flex-end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: budgetForm.date, onChange: function(e) {
      setBudgetForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 } })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: budgetSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: budgetSaving ? 0.7 : 1 } }, budgetSaving ? "Saving\u2026" : "Add")))), budget.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, textAlign: "center", padding: "20px 0" } }, "No entries yet.") : budget.map(function(b) {
      var isUploading = uploadingId === b.id;
      return /* @__PURE__ */ React.createElement("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ece6" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 500, background: b.type === "Purchase" ? "#fef0e6" : "#eaf3ea", color: b.type === "Purchase" ? "#c07040" : "#5a8a5a", flexShrink: 0 } }, b.type), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: 13, color: "#2a2a2a" } }, b.description || "\u2014"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a", flexShrink: 0 } }, fmt(parseFloat(b.amount) || 0)), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#bbb", flexShrink: 0 } }, b.date), b.needs_reimbursement && /* @__PURE__ */ React.createElement("span", { title: "Needs reimbursement", style: { fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 10, fontWeight: 600, flexShrink: 0 } }, "$ Reimburse"), b.receipt_url ? /* @__PURE__ */ React.createElement("a", { href: b.receipt_url, target: "_blank", title: "View receipt", style: { color: gold, textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }))) : /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setUploadingId(b.id);
        fileInputRef.current.click();
      }, disabled: isUploading, title: "Attach receipt", style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px 4px", flexShrink: 0, opacity: isUploading ? 0.5 : 1, display: "flex", alignItems: "center" } }, isUploading ? /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11 } }, "\u2026") : /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        deleteBudgetItem(b.id);
      }, style: { background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 14, padding: "2px 4px", flexShrink: 0 } }, "\xD7"));
    }), /* @__PURE__ */ React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/*,.pdf", style: { display: "none" }, onChange: handleReceiptSelect }))), showEarnings && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowEarnings(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a" } }, "Events \u2014 Earnings"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowEarnings(false);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb" } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 22 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600 } }, "Total Earnings"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: gold, marginTop: 4 } }, fmt(earnings.reduce(function(s, e) {
      return s + (parseFloat(e.amount) || 0);
    }, 0)))), /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 10, padding: "14px 16px", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 12 } }, "Add Entry"), /* @__PURE__ */ React.createElement("form", { onSubmit: addEarningItem }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Event"), /* @__PURE__ */ React.createElement("input", { value: earningsForm.event, onChange: function(e) {
      setEarningsForm(function(f) {
        return Object.assign({}, f, { event: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "e.g. Spring Gala" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Earning Source"), /* @__PURE__ */ React.createElement("input", { value: earningsForm.earning_source, onChange: function(e) {
      setEarningsForm(function(f) {
        return Object.assign({}, f, { earning_source: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "e.g. Ticket sales" }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Amount ($)"), /* @__PURE__ */ React.createElement("input", { required: true, type: "number", step: "0.01", min: "0", value: earningsForm.amount, onChange: function(e) {
      setEarningsForm(function(f) {
        return Object.assign({}, f, { amount: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "0.00" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: earningsForm.date, onChange: function(e) {
      setEarningsForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 } }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4 } }, "Notes"), /* @__PURE__ */ React.createElement("input", { value: earningsForm.notes, onChange: function(e) {
      setEarningsForm(function(f) {
        return Object.assign({}, f, { notes: e.target.value });
      });
    }, style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13 }, placeholder: "Optional notes\u2026" })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: earningsSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: earningsSaving ? 0.7 : 1 } }, earningsSaving ? "Saving\u2026" : "Add"))), earnings.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, textAlign: "center", padding: "20px 0" } }, "No entries yet.") : earnings.map(function(e) {
      return /* @__PURE__ */ React.createElement("div", { key: e.id, style: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ece6" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 2 } }, e.event && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#2a2a2a" } }, e.event), e.earning_source && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, e.earning_source), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#2e7d32", marginLeft: "auto" } }, fmt(e.amount || 0))), e.notes && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginTop: 2 } }, e.notes), e.date && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", marginTop: 2 } }, e.date)), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        deleteEarningItem(e.id);
      }, style: { background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 14, padding: "2px 4px", flexShrink: 0 } }, "\xD7"));
    }))), showVols && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowVols(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 500, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 600, color: "#2a2a2a" } }, area, " Volunteers (", vols.length, ")"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowVols(false);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb" } }, "x")), vols.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#bbb", fontSize: 13, textAlign: "center", padding: "30px 0" } }, "No volunteers assigned to ", area, ".") : vols.map(function(v) {
      var isEditing = noteEdit === v.id;
      return /* @__PURE__ */ React.createElement("div", { key: v.id, style: { borderBottom: "0.5px solid #f0ece6", paddingBottom: 14, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" } }, v["Picture URL"] ? /* @__PURE__ */ React.createElement("img", { src: driveImg(v["Picture URL"]), alt: v["First Name"], style: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 } }) : /* @__PURE__ */ React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: "#f0ece6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#999", flexShrink: 0 } }, (v["First Name"] || "?")[0]), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a" } }, v["First Name"], " ", v["Last Name"]), v["Overview Notes"] && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#999", fontStyle: "italic", marginLeft: 6 } }, v["Overview Notes"]), v["Phone Number"] || v["Email"] ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#888", marginTop: 1 } }, [v["Phone Number"], v["Email"]].filter(function(x) {
        return x && x.trim();
      }).join(" | ")) : null), /* @__PURE__ */ React.createElement(
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
  function SponsorsView() {
    var { useState: useState2, useEffect: useEffect2, useRef } = React;
    var isMobile = React.useContext(MobileCtx);
    var [sponsors, setSponsors] = useState2(null);
    var [selected, setSelected] = useState2(null);
    var [acks, setAcks] = useState2([]);
    var [ackForm, setAckForm] = useState2({ date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), method: "", notes: "" });
    var [ackSaving, setAckSaving] = useState2(false);
    var [logoUploading, setLogoUploading] = useState2(false);
    var logoInputRef = useRef(null);
    var [allInKind, setAllInKind] = useState2([]);
    var [inkind, setInkind] = useState2([]);
    var [inkindForm, setInkindForm] = useState2({ description: "", date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), value: "" });
    var [inkindSaving, setInkindSaving] = useState2(false);
    useEffect2(function() {
      cachedFetchAll("Sponsors").then(function(rows) {
        if (Array.isArray(rows)) setSponsors(rows.slice().sort(function(a, b) {
          return a.id - b.id;
        }));
      });
      cachedFetchAll("Sponsor In-Kind").then(function(rows) {
        if (Array.isArray(rows)) setAllInKind(rows);
      });
    }, []);
    useEffect2(function() {
      if (!selected) {
        setAcks([]);
        setInkind([]);
        return;
      }
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor Acknowledgments") + "?sponsor_id=eq." + selected.id + "&select=*&order=date.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setAcks(rows);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor In-Kind") + "?sponsor_id=eq." + selected.id + "&select=*&order=date.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setInkind(rows);
      });
    }, [selected]);
    function selectSponsor(s) {
      setSelected(s);
      setAckForm({ date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), method: "", notes: "" });
      setInkindForm({ description: "", date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), value: "" });
    }
    var TIERS = [
      {
        name: "Innovator",
        min: 5e3,
        color: "#7c3aed",
        bg: "#f3f0ff",
        border: "#c4b5fd",
        range: "$5,000\u2013$9,999",
        benefits: ["Builder benefits, plus:", 'One "Sponsor Highlight" article in one of our quarterly newsletters', 'An 8"\xD78" commemorative brick placed as part of the brick terrace capital project', "Picnic lunch or reception for you and ten guests in the North Star House"]
      },
      {
        name: "Builder",
        min: 2500,
        color: "#1565c0",
        bg: "#e3f2fd",
        border: "#90caf9",
        range: "$2,500\u2013$4,999",
        benefits: ["Believer benefits, plus:", "Named Solo Sponsor of one NSHC event (name/logo in materials, event signage, recognized from stage)", 'A 4"\xD78" commemorative brick placed as part of the brick terrace capital project', "Personal VIP tour of the upstairs construction project!"]
      },
      {
        name: "Believer",
        min: 1e3,
        color: "#2e7d32",
        bg: "#e8f5e9",
        border: "#a5d6a7",
        range: "$1,000\u2013$2,499",
        benefits: ["Company name/logo listed as a Sponsor in event programs, newsletters, website and yearly Sponsorship Banner", "Invitation to State of the Star membership celebration", "Two complimentary tickets to a NSHC event", "Custom made plaque with yearly stars", "Sponsor Spotlight on our social media platforms"]
      }
    ];
    function getTier(total) {
      return TIERS.find(function(t) {
        return total >= t.min;
      }) || null;
    }
    function sponsorInKindTotal(sponsorId) {
      return allInKind.filter(function(e) {
        return e.sponsor_id === sponsorId;
      }).reduce(function(sum, e) {
        return sum + (parseFloat(e.value) || 0);
      }, 0);
    }
    function submitInKind(e) {
      e.preventDefault();
      if (!inkindForm.description || !inkindForm.date || !inkindForm.value) return;
      setInkindSaving(true);
      var payload = { sponsor_id: selected.id, description: inkindForm.description, date: inkindForm.date, value: parseFloat(inkindForm.value) };
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor In-Kind"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.ok ? r.json() : r.json().then(function(e2) {
          throw new Error(e2.message || e2.code || r.status);
        });
      }).then(function(rows) {
        setInkindSaving(false);
        if (!Array.isArray(rows) || !rows[0]) {
          alert("Save failed: " + JSON.stringify(rows));
          return;
        }
        setInkind(function(prev) {
          return [rows[0]].concat(prev);
        });
        setAllInKind(function(prev) {
          return prev.concat([rows[0]]);
        });
        clearCache("Sponsor In-Kind");
        setInkindForm({ description: "", date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), value: "" });
      }).catch(function(err) {
        alert("Error saving in-kind: " + err.message);
        setInkindSaving(false);
      });
    }
    function deleteInKind(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor In-Kind") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        setInkind(function(prev) {
          return prev.filter(function(e) {
            return e.id !== id;
          });
        });
        setAllInKind(function(prev) {
          return prev.filter(function(e) {
            return e.id !== id;
          });
        });
      });
    }
    function handleLogoUpload(e) {
      var file = e.target.files[0];
      if (!file || !selected) return;
      setLogoUploading(true);
      var ext = file.name.split(".").pop();
      var filename = "sponsor-" + selected.id + "-" + Date.now() + "." + ext;
      fetch(SUPABASE_URL + "/storage/v1/object/sponsor-logos/" + filename, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
        body: file
      }).then(function(storageRes) {
        if (!storageRes.ok) {
          return storageRes.json().then(function(err) {
            alert("Logo upload failed: " + (err.message || err.error || storageRes.status));
            setLogoUploading(false);
          });
        }
        var url = SUPABASE_URL + "/storage/v1/object/public/sponsor-logos/" + filename;
        return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsors") + "?id=eq." + selected.id, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ logo_url: url })
        }).then(function(patchRes) {
          if (!patchRes.ok) {
            return patchRes.json().then(function(err) {
              alert("Failed to save logo URL: " + (err.message || err.hint || patchRes.status) + '\n\nMake sure you have run: ALTER TABLE "Sponsors" ADD COLUMN IF NOT EXISTS logo_url TEXT;');
              setLogoUploading(false);
            });
          }
          var updated = Object.assign({}, selected, { logo_url: url });
          setSelected(updated);
          clearCache("Sponsors");
          setSponsors(function(prev) {
            return prev.map(function(s) {
              return s.id === selected.id ? updated : s;
            });
          });
          setLogoUploading(false);
          e.target.value = "";
        });
      }).catch(function(err) {
        alert("Upload error: " + err.message);
        setLogoUploading(false);
      });
    }
    function submitAck(e) {
      e.preventDefault();
      if (!ackForm.date) return;
      setAckSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor Acknowledgments"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ sponsor_id: selected.id, date: ackForm.date, method: ackForm.method || null, notes: ackForm.notes || null })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setAckSaving(false);
        if (Array.isArray(rows) && rows[0]) setAcks(function(prev) {
          return [rows[0]].concat(prev);
        });
        setAckForm({ date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), method: "", notes: "" });
      }).catch(function() {
        setAckSaving(false);
      });
    }
    function deleteAck(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Sponsor Acknowledgments") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        setAcks(function(prev) {
          return prev.filter(function(a) {
            return a.id !== id;
          });
        });
      });
    }
    function InfoRow({ label, value, link }) {
      if (!value) return null;
      return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, marginBottom: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 120, fontSize: 12, color: "#777", flexShrink: 0, paddingTop: 1 } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#2a2a2a", flex: 1, lineHeight: 1.5 } }, link ? /* @__PURE__ */ React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer", style: { color: gold, textDecoration: "none" } }, value) : value));
    }
    var inpStyle = { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 12, background: "#fff", boxSizing: "border-box" };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 } }, /* @__PURE__ */ React.createElement(StatCard, { label: "Total Sponsors", value: sponsors === null ? "..." : sponsors.length }), /* @__PURE__ */ React.createElement(StatCard, { label: "Total In-Kind", value: allInKind.length === 0 && sponsors !== null ? "$0" : "$" + allInKind.reduce(function(s, e) {
      return s + (parseFloat(e.value) || 0);
    }, 0).toLocaleString() }), /* @__PURE__ */ React.createElement(StatCard, { label: "Tiered Sponsors", value: sponsors === null ? "..." : sponsors.filter(function(s) {
      return getTier(sponsorInKindTotal(s.id));
    }).length })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: selected && !isMobile ? "240px 1fr" : "1fr", gap: 16 } }, /* @__PURE__ */ React.createElement("div", null, sponsors === null && /* @__PURE__ */ React.createElement("div", { style: { color: "#aaa", fontSize: 13, padding: 20, textAlign: "center" } }, "Loading\u2026"), sponsors !== null && sponsors.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "#aaa", fontSize: 13, padding: 20, textAlign: "center" } }, "No sponsors yet."), sponsors !== null && sponsors.map(function(s) {
      var isSelected = selected && selected.id === s.id;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: s.id,
          onClick: function() {
            selectSponsor(isSelected ? null : s);
          },
          style: { background: isSelected ? "#faf5ee" : "#fff", border: "0.5px solid " + (isSelected ? gold : "#e8e0d5"), borderRadius: 10, padding: "14px 18px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 14 },
          onMouseEnter: function(e) {
            if (!isSelected) e.currentTarget.style.background = "#fdfaf6";
          },
          onMouseLeave: function(e) {
            if (!isSelected) e.currentTarget.style.background = isSelected ? "#faf5ee" : "#fff";
          }
        },
        s.logo_url ? /* @__PURE__ */ React.createElement("img", { src: s.logo_url, alt: s["Business Name"], onError: function(e) {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextSibling.style.display = "flex";
        }, style: { width: 44, height: 44, objectFit: "contain", borderRadius: 6, flexShrink: 0, border: "0.5px solid #e8e0d5" } }) : null,
        /* @__PURE__ */ React.createElement("div", { style: { width: 44, height: 44, borderRadius: 6, background: "#f0ece6", display: s.logo_url ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: gold, flexShrink: 0 } }, (s["Business Name"] || "?")[0]),
        /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#2a2a2a", marginBottom: 3 } }, s["Business Name"]), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } }, s["Main Contact"] && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#666" } }, s["Main Contact"]), s["Area Supported"] && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#aaa" } }, s["Area Supported"]))),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 } }, s["Fair Market Value"] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: gold } }, s["Fair Market Value"]), (function() {
          var tier = getTier(sponsorInKindTotal(s.id));
          return tier ? /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: "1px solid " + tier.border, borderRadius: 20, padding: "1px 8px" } }, tier.name) : null;
        })())
      );
    })), selected && /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, padding: "20px 22px", alignSelf: "start", position: "sticky", top: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#2a2a2a", lineHeight: 1.3, flex: 1, paddingRight: 8 } }, selected["Business Name"]), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setSelected(null);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb", lineHeight: 1, flexShrink: 0 } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600, marginBottom: 8 } }, "Logo"), selected.logo_url ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("img", { src: selected.logo_url, alt: "logo", onError: function(e) {
      e.currentTarget.style.display = "none";
      e.currentTarget.nextSibling.style.display = "block";
    }, style: { maxHeight: 60, maxWidth: 160, objectFit: "contain", border: "0.5px solid #e8e0d5", borderRadius: 6, padding: 4 } }), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      logoInputRef.current.click();
    }, disabled: logoUploading, style: { fontSize: 11, color: gold, background: "none", border: "0.5px solid " + gold, borderRadius: 6, padding: "4px 10px", cursor: "pointer" } }, logoUploading ? "Uploading\u2026" : "Replace")) : /* @__PURE__ */ React.createElement("button", { onClick: function() {
      logoInputRef.current.click();
    }, disabled: logoUploading, style: { fontSize: 12, color: gold, background: "#faf8f5", border: "0.5px dashed " + gold, borderRadius: 8, padding: "10px 16px", cursor: "pointer", width: "100%" } }, logoUploading ? "Uploading\u2026" : "+ Upload Logo"), /* @__PURE__ */ React.createElement("input", { ref: logoInputRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: handleLogoUpload })), /* @__PURE__ */ React.createElement(InfoRow, { label: "Main Contact", value: selected["Main Contact"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Donation", value: selected["Donation"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Fair Market Value", value: selected["Fair Market Value"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Area Supported", value: selected["Area Supported"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "NSH Contact", value: selected["NSH Contact"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Phone", value: selected["Phone Number"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Email", value: selected["Email Address"], link: "mailto:" + selected["Email Address"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Mailing Address", value: selected["Mailing Address"] }), /* @__PURE__ */ React.createElement(InfoRow, { label: "Date Received", value: selected["Date Recieved"] }), selected["Notes"] && /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 8, padding: "10px 14px", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 } }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", lineHeight: 1.6 } }, selected["Notes"])), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid #f0ece6", paddingTop: 16, marginTop: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600, marginBottom: 12 } }, "In-Kind Contributions"), (function() {
      var total = inkind.reduce(function(s, e) {
        return s + (parseFloat(e.value) || 0);
      }, 0);
      var tier = getTier(total);
      return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: tier ? 10 : 0 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "$", total.toLocaleString()), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#aaa" } }, "total in-kind value"), tier && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: tier.color, background: tier.bg, border: "1px solid " + tier.border, borderRadius: 20, padding: "2px 10px" } }, tier.name)), tier && /* @__PURE__ */ React.createElement("div", { style: { background: tier.bg, border: "1px solid " + tier.border, borderRadius: 8, padding: "10px 14px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: tier.color, marginBottom: 6 } }, tier.name, " Benefits \xB7 ", tier.range), tier.benefits.map(function(b, i) {
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { fontSize: 11, color: tier.color, opacity: 0.85, marginBottom: 3, paddingLeft: b.endsWith(":") ? 0 : 8 } }, b.endsWith(":") ? b : "\u2022 " + b);
      })));
    })(), /* @__PURE__ */ React.createElement("form", { onSubmit: submitInKind, style: { background: "#faf8f5", borderRadius: 8, padding: "12px 14px", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Scope of Work *"), /* @__PURE__ */ React.createElement("textarea", { value: inkindForm.description, onChange: function(e) {
      setInkindForm(function(f) {
        return Object.assign({}, f, { description: e.target.value });
      });
    }, rows: 2, style: Object.assign({}, inpStyle, { resize: "vertical" }), placeholder: "Describe the in-kind work or service\u2026", required: true })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Date *"), /* @__PURE__ */ React.createElement("input", { type: "date", value: inkindForm.date, onChange: function(e) {
      setInkindForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: inpStyle, required: true })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Ballpark Value ($) *"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "1", value: inkindForm.value, onChange: function(e) {
      setInkindForm(function(f) {
        return Object.assign({}, f, { value: e.target.value });
      });
    }, style: inpStyle, placeholder: "e.g. 1500", required: true }))), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: inkindSaving || !inkindForm.description || !inkindForm.date || !inkindForm.value, style: { background: gold, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: inkindSaving || !inkindForm.description || !inkindForm.date || !inkindForm.value ? 0.6 : 1, width: "100%" } }, inkindSaving ? "Saving\u2026" : "Add In-Kind Entry")), inkind.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#ccc", fontStyle: "italic" } }, "No in-kind entries yet.") : inkind.map(function(e) {
      return /* @__PURE__ */ React.createElement("div", { key: e.id, style: { padding: "8px 0", borderBottom: "0.5px solid #f5f0ea", display: "flex", gap: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 2 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a" } }, "$", (parseFloat(e.value) || 0).toLocaleString()), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#aaa" } }, e.date)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", lineHeight: 1.5 } }, e.description)), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        deleteInKind(e.id);
      }, style: { background: "none", border: "none", color: "#ddd", fontSize: 14, cursor: "pointer", flexShrink: 0, padding: "2px 4px" } }, "\xD7"));
    })), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid #f0ece6", paddingTop: 16, marginTop: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#aaa", fontWeight: 600, marginBottom: 12 } }, "Acknowledgment Log"), /* @__PURE__ */ React.createElement("form", { onSubmit: submitAck, style: { background: "#faf8f5", borderRadius: 8, padding: "12px 14px", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Date"), /* @__PURE__ */ React.createElement("input", { type: "date", value: ackForm.date, onChange: function(e) {
      setAckForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: inpStyle, required: true })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Method"), /* @__PURE__ */ React.createElement("input", { value: ackForm.method, onChange: function(e) {
      setAckForm(function(f) {
        return Object.assign({}, f, { method: e.target.value });
      });
    }, style: inpStyle, placeholder: "Letter, email, call\u2026" }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { value: ackForm.notes, onChange: function(e) {
      setAckForm(function(f) {
        return Object.assign({}, f, { notes: e.target.value });
      });
    }, rows: 2, style: Object.assign({}, inpStyle, { resize: "vertical" }), placeholder: "Details\u2026" })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: ackSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: ackSaving ? 0.7 : 1, width: "100%" } }, ackSaving ? "Saving\u2026" : "Log Acknowledgment")), acks.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#ccc", fontStyle: "italic" } }, "No acknowledgments logged yet.") : acks.map(function(a) {
      return /* @__PURE__ */ React.createElement("div", { key: a.id, style: { padding: "8px 0", borderBottom: "0.5px solid #f5f0ea", display: "flex", gap: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 2 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a" } }, a.date), a.method && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: gold, background: "#faf5ee", borderRadius: 20, padding: "1px 8px" } }, a.method)), a.notes && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#666", lineHeight: 1.5 } }, a.notes)), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        deleteAck(a.id);
      }, style: { background: "none", border: "none", color: "#ddd", fontSize: 14, cursor: "pointer", flexShrink: 0, padding: "2px 4px" } }, "\xD7"));
    })))));
  }
  function ReviewsView() {
    var { useState: useState2, useEffect: useEffect2 } = React;
    var year = (/* @__PURE__ */ new Date()).getFullYear();
    var quarters = ["Q1", "Q2", "Q3", "Q4"];
    var [submitted, setSubmitted] = useState2(null);
    var [reviewed, setReviewed] = useState2({});
    var [activeCell, setActiveCell] = useState2(null);
    var emptyCcForm = { status: "On track", discussion_focus: "", potential_actions: "", escalation: "None", escalation_other: "", priority_confirmation: "Approved", review_date: "" };
    var [ccForm, setCcForm] = useState2(emptyCcForm);
    var [ccSaving, setCcSaving] = useState2(false);
    var [printQ, setPrintQ] = useState2(null);
    var [printing, setPrinting] = useState2(false);
    function doPrint(quarter) {
      setPrinting(true);
      var headers = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
      Promise.all([
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarter Goals") + "?quarter=eq." + encodeURIComponent(quarter) + "&year=eq." + year + "&select=*", { headers }).then(function(r) {
          return r.json();
        }),
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarterly Updates") + "?quarter=eq." + encodeURIComponent(quarter) + "&year=eq." + year + "&select=*&order=date_submitted.desc", { headers }).then(function(r) {
          return r.json();
        })
      ]).then(function(results) {
        var goals = Array.isArray(results[0]) ? results[0] : [];
        var updates = Array.isArray(results[1]) ? results[1] : [];
        var goalsMap = {};
        goals.forEach(function(g) {
          goalsMap[g.area] = g;
        });
        var updatesMap = {};
        updates.forEach(function(u) {
          if (!updatesMap[u.area]) updatesMap[u.area] = u;
        });
        var line = '<hr style="border:none;border-top:1px solid #ccc;margin:14px 0">';
        var label = function(t) {
          return '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;margin-bottom:6px;margin-top:16px">' + t + "</div>";
        };
        var field = function(val, lines) {
          lines = lines || 1;
          if (val) return '<div style="font-size:13px;color:#222;line-height:1.6;margin-bottom:4px">' + val.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") + "</div>";
          if (lines === 1) return '<div style="border-bottom:1px solid #bbb;height:22px;margin-bottom:8px"></div>';
          var out = "";
          for (var i = 0; i < lines; i++) out += '<div style="border-bottom:1px solid #bbb;height:22px;margin-bottom:8px"></div>';
          return out;
        };
        var radio = function(opts, checked) {
          return '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px">' + opts.map(function(o) {
            var on = checked === o;
            return '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#333"><span style="width:13px;height:13px;border-radius:50%;border:1.5px solid #888;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + (on ? '<span style="width:7px;height:7px;border-radius:50%;background:#888;display:block"></span>' : "") + "</span>" + o + "</label>";
          }).join("") + "</div>";
        };
        var checkboxList = function(opts, checked) {
          var arr = Array.isArray(checked) ? checked : [];
          return '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:8px">' + opts.map(function(o) {
            var on = arr.indexOf(o) !== -1;
            return '<label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#333"><span style="width:14px;height:14px;border:1.5px solid ' + (on ? "#2a2a2a" : "#888") + ';border-radius:2px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#2a2a2a;line-height:1">' + (on ? "&#10003;" : "&nbsp;") + "</span>" + o + "</label>";
          }).join("") + "</div>";
        };
        var pages = OPERATIONAL_AREAS.map(function(area, idx) {
          var g = goalsMap[area] || {};
          var u = updatesMap[area];
          var pageBreak = idx > 0 ? "page-break-before:always;" : "";
          var html = '<div style="' + pageBreak + 'padding:32px 40px;font-family:Georgia,serif;max-width:700px;margin:0 auto">';
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">';
          html += '<div style="font-size:22px;font-weight:700;color:#2a2a2a">' + area + "</div>";
          html += '<div style="font-size:13px;color:#888">' + quarter + " " + year + "</div>";
          html += "</div>" + line;
          html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Quarterly Goals</div>';
          if (g.primary_focus || !u) {
            html += label("Primary Focus") + field(g.primary_focus, 1);
          }
          ["1", "2", "3"].forEach(function(n) {
            var gval = g["goal_" + n];
            var st = g["goal_" + n + "_status"];
            var sm = g["goal_" + n + "_summary"];
            html += label("Goal " + n);
            html += '<div style="margin-bottom:4px">' + field(gval, 1) + "</div>";
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
            html += "<div>" + label("Status") + field(st, 1) + "</div>";
            html += "<div>" + label("Summary") + field(sm, 1) + "</div>";
            html += "</div>";
          });
          html += line;
          html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Quarterly Reflection</div>';
          if (u) {
            html += label("What Went Well") + field(u.what_went_well || u.successes, 2);
            html += label("Challenges") + checkboxList(["Capacity or volunteer limitations", "Budget or funding constraints", "Scheduling or timing issues", "Cross-area coordination gaps", "External factors", "Other"], u.challenges);
            if (u.challenges_details) html += '<div style="font-size:12px;color:#555;margin-bottom:8px;margin-top:2px">' + u.challenges_details.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</div>";
            html += label("Support Needed") + checkboxList(["Staff or volunteer help", "Marketing or communications", "Board guidance or decision", "Funding or fundraising support", "Facilities or logistics", "Other"], u.support_needed);
            if (u.support_details) html += '<div style="font-size:12px;color:#555;margin-bottom:8px;margin-top:2px">' + u.support_details.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</div>";
            html += label("Other Notes") + field(u.other_notes, 2);
            html += label("Next Quarter Focus") + field(u.next_focus, 2);
            if (u.date_submitted) html += '<div style="font-size:11px;color:#aaa;margin-top:8px">Submitted ' + u.date_submitted + "</div>";
          } else {
            html += label("What Went Well") + field(null, 3);
            html += label("Challenges") + checkboxList(["Capacity or volunteer limitations", "Budget or funding constraints", "Scheduling or timing issues", "Cross-area coordination gaps", "External factors", "Other"], []);
            html += label("Support Needed") + checkboxList(["Staff or volunteer help", "Marketing or communications", "Board guidance or decision", "Funding or fundraising support", "Facilities or logistics", "Other"], []);
            html += label("Other Notes") + field(null, 2);
            html += label("Next Quarter Focus") + field(null, 2);
          }
          html += line;
          html += '<div style="font-size:14px;font-weight:700;color:#2a2a2a;margin-bottom:2px">Co-Champion Review</div>';
          html += label("Review Status");
          html += radio(["On track", "Minor adjustments needed", "Off track - intervention required"], null);
          html += label("Discussion Focus") + '<div style="font-size:11px;color:#aaa;margin-bottom:6px">What should the board focus on during discussion regarding this area?</div>' + field(null, 3);
          html += label("Potential Actions") + '<div style="font-size:11px;color:#aaa;margin-bottom:6px">Are there actions the board may want to consider?</div>' + field(null, 3);
          html += label("Escalation");
          html += radio(["None", "Requires budget review", "Requires policy clarification", "Other"], null);
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:12px;color:#555">If Other:</span>' + field(null, 1) + "</div>";
          html += label("Priority Confirmation (Next Quarter)");
          html += radio(["Approved", "Adjusted", "Replaced"], null);
          html += label("Review Completed") + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:#555">Date:</span><div style="border-bottom:1px solid #bbb;width:160px;height:22px"></div></div>';
          html += "</div>";
          return html;
        });
        var doc = "<!DOCTYPE html><html><head><title>NSH " + quarter + " " + year + " Review Packet</title><style>@media print{body{margin:0}}</style></head><body>" + pages.join("") + "</body></html>";
        var w = window.open("", "_blank");
        w.document.write(doc);
        w.document.close();
        w.focus();
        setTimeout(function() {
          w.print();
        }, 400);
        setPrinting(false);
        setPrintQ(null);
      });
    }
    function loadData() {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Quarterly Updates") + "?year=eq." + year + "&select=area,quarter,support_needed&order=date_submitted.desc", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        var s = {};
        if (Array.isArray(rows)) rows.forEach(function(r) {
          if (!s[r.area + ":" + r.quarter]) s[r.area + ":" + r.quarter] = r;
        });
        setSubmitted(s);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews") + "?year=eq." + year + "&select=*", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        var rv = {};
        if (Array.isArray(rows)) rows.forEach(function(r) {
          rv[r.area + ":" + r.quarter] = r;
        });
        setReviewed(rv);
      });
    }
    useEffect2(function() {
      loadData();
    }, []);
    function openCell(area, quarter) {
      var key = area + ":" + quarter;
      var existing = reviewed[key];
      setCcForm(existing ? Object.assign({}, emptyCcForm, existing) : emptyCcForm);
      setActiveCell({ area, quarter });
    }
    function submitReview(e) {
      e.preventDefault();
      setCcSaving(true);
      var key = activeCell.area + ":" + activeCell.quarter;
      var existing = reviewed[key];
      var payload = { area: activeCell.area, quarter: activeCell.quarter, year, status: ccForm.status, discussion_focus: ccForm.discussion_focus || null, potential_actions: ccForm.potential_actions || null, escalation: ccForm.escalation, escalation_other: ccForm.escalation === "Other" ? ccForm.escalation_other || null : null, priority_confirmation: ccForm.priority_confirmation, review_date: ccForm.review_date || null };
      var req = existing ? fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews") + "?id=eq." + existing.id, { method: "PATCH", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) }) : fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Co-Champion Reviews"), { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
      req.then(function(r) {
        return r.json();
      }).then(function(rows) {
        var saved = rows && rows[0] ? rows[0] : Object.assign({ id: existing && existing.id }, payload);
        setReviewed(function(prev) {
          var next = Object.assign({}, prev);
          next[key] = saved;
          return next;
        });
        setCcSaving(false);
        setActiveCell(null);
      });
    }
    var statusColors2 = { "On track": { bg: "#e8f5e9", color: "#2e7d32" }, "Minor adjustments needed": { bg: "#fff3e0", color: "#e65100" }, "Off track - intervention required": { bg: "#ffebee", color: "#c62828" } };
    var ccInp = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
    var ccLbl = { fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4, display: "block" };
    var ccGrp = { marginBottom: 14 };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "0.5px solid #e8e0d5", marginBottom: 24, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 20px", borderBottom: "0.5px solid #f0ece6", background: "#fdfcfb", display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", fontWeight: 600 } }, "Quarterly Updates \u2014 ", year), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setPrintQ("Q1");
    }, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: gold, background: "none", border: "0.5px solid " + gold, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 500 } }, /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "6 9 6 2 18 2 18 9" }), /* @__PURE__ */ React.createElement("path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }), /* @__PURE__ */ React.createElement("rect", { x: "6", y: "14", width: "12", height: "8" })), "Print Packet")), /* @__PURE__ */ React.createElement("div", { className: "nsh-reviews-scroll", style: { padding: "0 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 400 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "160px repeat(4, 1fr)", borderBottom: "0.5px solid #f0ece6", padding: "10px 0" } }, /* @__PURE__ */ React.createElement("div", null), quarters.map(function(q) {
      return /* @__PURE__ */ React.createElement("div", { key: q, style: { textAlign: "center", fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 } }, q);
    })), submitted === null ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 0", color: "#bbb", fontSize: 13, textAlign: "center" } }, "Loading\u2026") : OPERATIONAL_AREAS.map(function(area) {
      return /* @__PURE__ */ React.createElement("div", { key: area, style: { display: "grid", gridTemplateColumns: "160px repeat(4, 1fr)", borderBottom: "0.5px solid #f9f6f2", padding: "12px 0", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: "#2a2a2a" } }, area), quarters.map(function(q) {
        var key = area + ":" + q;
        var submission = submitted && submitted[key];
        var hasReflection = !!submission;
        var hasReview = reviewed[key];
        var needsSupport = submission && Array.isArray(submission.support_needed) && submission.support_needed.length > 0;
        return /* @__PURE__ */ React.createElement("div", { key: q, style: { display: "flex", justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" } }, hasReview ? /* @__PURE__ */ React.createElement("button", { onClick: function() {
          openCell(area, q);
        }, title: "Review submitted \u2014 click to edit", style: { background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: gold, stroke: gold, strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }))) : hasReflection ? /* @__PURE__ */ React.createElement("button", { onClick: function() {
          openCell(area, q);
        }, title: "Reflection received \u2014 click to add review", style: { background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "#2e7d32", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "20 6 9 17 4 12" })))) : /* @__PURE__ */ React.createElement("div", { title: "Not yet submitted", style: { width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #e0d8cc", background: "#faf8f5" } }), needsSupport && /* @__PURE__ */ React.createElement("div", { title: "Needs support: " + submission.support_needed.join(", "), style: { position: "absolute", top: -4, right: -6, width: 10, height: 10, borderRadius: "50%", background: "#ef4444", border: "1.5px solid #fff", flexShrink: 0 } })));
      }));
    })))), printQ && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setPrintQ(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 14, padding: 28, maxWidth: 340, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a", marginBottom: 6, fontFamily: "'Cardo', serif" } }, "Print Review Packet"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginBottom: 20 } }, "Select a quarter to print goals, reflections, and blank co-champion review forms for all areas."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 } }, ["Q1", "Q2", "Q3", "Q4"].map(function(q) {
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: q,
          onClick: function() {
            setPrintQ(q);
          },
          style: { padding: "12px", borderRadius: 9, border: "0.5px solid " + (printQ === q ? gold : "#e0d8cc"), background: printQ === q ? "#fef9f0" : "#faf8f5", color: printQ === q ? gold : "#555", fontSize: 14, fontWeight: printQ === q ? 700 : 400, cursor: "pointer", transition: "all 0.1s" }
        },
        q
      );
    })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      doPrint(printQ);
    }, disabled: printing, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: printing ? 0.7 : 1 } }, printing ? "Preparing\u2026" : "Print " + printQ + " Packet"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setPrintQ(null);
    }, style: { padding: "10px 16px", background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer" } }, "Cancel")))), activeCell && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setActiveCell(null);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, padding: 28, maxWidth: 500, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, activeCell.area), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 } }, activeCell.quarter, " ", year, " \u2014 Co-Champion Review")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setActiveCell(null);
    }, style: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb" } }, "\xD7")), /* @__PURE__ */ React.createElement("form", { onSubmit: submitReview }, /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Review Status"), ["On track", "Minor adjustments needed", "Off track - intervention required"].map(function(opt) {
      return /* @__PURE__ */ React.createElement("label", { key: opt, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer", fontSize: 13, color: "#2a2a2a" } }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "cc_status", value: opt, checked: ccForm.status === opt, onChange: function() {
        setCcForm(function(f) {
          return Object.assign({}, f, { status: opt });
        });
      }, style: { accentColor: gold } }), opt);
    })), /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Discussion Focus"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", marginBottom: 6 } }, "What should the board focus on during discussion regarding this area?"), /* @__PURE__ */ React.createElement("textarea", { value: ccForm.discussion_focus, onChange: function(e) {
      setCcForm(function(f) {
        return Object.assign({}, f, { discussion_focus: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, ccInp, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Potential Actions"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#bbb", marginBottom: 6 } }, "Are there actions the board may want to consider?"), /* @__PURE__ */ React.createElement("textarea", { value: ccForm.potential_actions, onChange: function(e) {
      setCcForm(function(f) {
        return Object.assign({}, f, { potential_actions: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, ccInp, { resize: "vertical" }) })), /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Escalation"), ["None", "Requires budget review", "Requires policy clarification", "Other"].map(function(opt) {
      return /* @__PURE__ */ React.createElement("label", { key: opt, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer", fontSize: 13, color: "#2a2a2a" } }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "cc_escalation", value: opt, checked: ccForm.escalation === opt, onChange: function() {
        setCcForm(function(f) {
          return Object.assign({}, f, { escalation: opt });
        });
      }, style: { accentColor: gold } }), opt);
    }), ccForm.escalation === "Other" && /* @__PURE__ */ React.createElement("input", { value: ccForm.escalation_other, onChange: function(e) {
      setCcForm(function(f) {
        return Object.assign({}, f, { escalation_other: e.target.value });
      });
    }, style: Object.assign({}, ccInp, { marginTop: 4 }), placeholder: "Describe escalation\u2026" })), /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Priority Confirmation (Next Quarter)"), ["Approved", "Adjusted", "Replaced"].map(function(opt) {
      return /* @__PURE__ */ React.createElement("label", { key: opt, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer", fontSize: 13, color: "#2a2a2a" } }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "cc_priority", value: opt, checked: ccForm.priority_confirmation === opt, onChange: function() {
        setCcForm(function(f) {
          return Object.assign({}, f, { priority_confirmation: opt });
        });
      }, style: { accentColor: gold } }), opt);
    })), /* @__PURE__ */ React.createElement("div", { style: ccGrp }, /* @__PURE__ */ React.createElement("span", { style: ccLbl }, "Review Completed"), /* @__PURE__ */ React.createElement("input", { type: "date", value: ccForm.review_date, onChange: function(e) {
      setCcForm(function(f) {
        return Object.assign({}, f, { review_date: e.target.value });
      });
    }, style: ccInp })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: ccSaving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: ccSaving ? 0.7 : 1 } }, ccSaving ? "Saving\u2026" : "Submit Review"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setActiveCell(null);
    }, style: { padding: "10px 16px", background: "#f5f0ea", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer" } }, "Cancel"))))));
  }
  function FinancialsView() {
    var { useState: useState2, useEffect: useEffect2, useRef } = React;
    var [items, setItems] = useState2([]);
    var [loading, setLoading] = useState2(true);
    var [markingId, setMarkingId] = useState2(null);
    var RENTAL_NAMES = ["Yoga with Teena Bates", "Mahjong Group", "Donation Box", "Book Sales", "Other"];
    var PAYMENT_TYPES = ["Cash", "Card", "Check"];
    var emptyRentalForm = { name: "Yoga with Teena Bates", custom_name: "", amount: "", date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), payment_type: "Cash" };
    var [rentals, setRentals] = useState2([]);
    var [rentalsLoading, setRentalsLoading] = useState2(true);
    var [rentalForm, setRentalForm] = useState2(emptyRentalForm);
    var [rentalSaving, setRentalSaving] = useState2(false);
    var [showRentalForm, setShowRentalForm] = useState2(false);
    var [cashLog, setCashLog] = useState2([]);
    var [cashLoading, setCashLoading] = useState2(true);
    var emptyCashForm = { description: "", amount: "", date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), direction: "Out" };
    var [cashForm, setCashForm] = useState2(emptyCashForm);
    var [showCashForm, setShowCashForm] = useState2(false);
    var [cashSaving, setCashSaving] = useState2(false);
    var [resources, setResources] = useState2([]);
    var [resourcesLoading, setResourcesLoading] = useState2(true);
    var [showAddResource, setShowAddResource] = useState2(false);
    var [resourceType, setResourceType] = useState2("link");
    var [resourceTitle, setResourceTitle] = useState2("");
    var [resourceUrl, setResourceUrl] = useState2("");
    var [resourceSaving, setResourceSaving] = useState2(false);
    var resourceFileRef = useRef(null);
    function loadReimbursements() {
      setLoading(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?needs_reimbursement=eq.true&select=*&order=date.desc,id.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setItems(Array.isArray(rows) ? rows : []);
        setLoading(false);
      });
    }
    function loadRentals() {
      setRentalsLoading(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Creative Rentals") + "?select=*&order=date.desc,id.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setRentals(Array.isArray(rows) ? rows : []);
        setRentalsLoading(false);
      });
    }
    useEffect2(function() {
      loadReimbursements();
      loadRentals();
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Cash Log") + "?select=*&order=date.desc,id.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setCashLog(rows);
        setCashLoading(false);
      }).catch(function() {
        setCashLoading(false);
      });
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Resources") + "?area=eq.Financials&select=*&order=created_at.asc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) setResources(rows);
        setResourcesLoading(false);
      }).catch(function() {
        setResourcesLoading(false);
      });
    }, []);
    function markReimbursed(id) {
      setMarkingId(id);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + id, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ needs_reimbursement: false })
      }).then(function() {
        clearCache("Op Budget");
        setMarkingId(null);
        setItems(function(prev) {
          return prev.filter(function(b) {
            return b.id !== id;
          });
        });
      });
    }
    function submitRental(e) {
      e.preventDefault();
      var finalName = rentalForm.name === "Other" ? rentalForm.custom_name : rentalForm.name;
      if (!finalName || !rentalForm.amount || !rentalForm.date) return;
      setRentalSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Creative Rentals"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ name: finalName, amount: parseFloat(rentalForm.amount), date: rentalForm.date, payment_type: rentalForm.payment_type })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        var newRow = rows && rows[0] ? rows[0] : { name: finalName, amount: parseFloat(rentalForm.amount), date: rentalForm.date, payment_type: rentalForm.payment_type };
        setRentals(function(prev) {
          return [newRow].concat(prev);
        });
        setRentalForm(emptyRentalForm);
        setShowRentalForm(false);
        setRentalSaving(false);
      }).catch(function() {
        setRentalSaving(false);
      });
    }
    function submitCash(e) {
      e.preventDefault();
      if (!cashForm.description || !cashForm.amount || !cashForm.date) return;
      setCashSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Cash Log"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ description: cashForm.description, amount: parseFloat(cashForm.amount), date: cashForm.date, direction: cashForm.direction })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        var newRow = rows && rows[0] ? rows[0] : { description: cashForm.description, amount: parseFloat(cashForm.amount), date: cashForm.date, direction: cashForm.direction };
        setCashLog(function(p) {
          return [newRow].concat(p);
        });
        setCashForm(emptyCashForm);
        setShowCashForm(false);
        setCashSaving(false);
      }).catch(function() {
        setCashSaving(false);
      });
    }
    function deleteCash(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Cash Log") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        setCashLog(function(p) {
          return p.filter(function(c) {
            return c.id !== id;
          });
        });
      });
    }
    function fmt(n) {
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var reimTotal = items.reduce(function(s, b) {
      return s + (parseFloat(b.amount) || 0);
    }, 0);
    var rentTotal = rentals.reduce(function(s, r) {
      return s + (parseFloat(r.amount) || 0);
    }, 0);
    var byArea = {};
    items.forEach(function(b) {
      var a = b.area || "Unknown";
      if (!byArea[a]) byArea[a] = [];
      byArea[a].push(b);
    });
    var inpSt = { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, background: "#fff", boxSizing: "border-box" };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "0.5px solid #e8e0d5", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "Pending Reimbursements"), !loading && items.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#b45309", fontWeight: 600, marginTop: 2 } }, fmt(reimTotal), " total \xB7 ", items.length, " item", items.length !== 1 ? "s" : ""))), loading ? /* @__PURE__ */ React.createElement("div", { style: { padding: "24px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "Loading\u2026") : items.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "24px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No pending reimbursements.") : Object.keys(byArea).sort().map(function(area) {
      var areaItems = byArea[area];
      var areaTotal = areaItems.reduce(function(s, b) {
        return s + (parseFloat(b.amount) || 0);
      }, 0);
      return /* @__PURE__ */ React.createElement("div", { key: area }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 18px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a" } }, area), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#b45309" } }, fmt(areaTotal))), areaItems.map(function(b) {
        var isMarking = markingId === b.id;
        return /* @__PURE__ */ React.createElement("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "0.5px solid #f9f6f2" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a" } }, b.description || "\u2014"), b.volunteer_name && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#555", fontWeight: 500, marginTop: 2 } }, b.volunteer_name, b.volunteer_address ? " \xB7 " + b.volunteer_address : ""), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2 } }, b.date || "")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#2a2a2a", flexShrink: 0 } }, fmt(parseFloat(b.amount) || 0)), b.receipt_url && /* @__PURE__ */ React.createElement("a", { href: b.receipt_url, target: "_blank", title: "View receipt", style: { color: gold, textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }))), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 5, cursor: isMarking ? "default" : "pointer", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: false, disabled: isMarking, onChange: function() {
          markReimbursed(b.id);
        }, style: { accentColor: "#059669", width: 14, height: 14 } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#059669", fontWeight: 500 } }, isMarking ? "\u2026" : "Reimbursed")));
      }));
    })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "0.5px solid #e8e0d5", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "Earnings"), !rentalsLoading && rentals.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#059669", fontWeight: 600, marginTop: 2 } }, fmt(rentTotal), " total \xB7 ", rentals.length, " entr", rentals.length !== 1 ? "ies" : "y")), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowRentalForm(function(v) {
        return !v;
      });
    }, style: { fontSize: 12, background: showRentalForm ? "#f5f0ea" : gold, color: showRentalForm ? "#666" : "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 500 } }, showRentalForm ? "Cancel" : "+ Log Earning")), showRentalForm && /* @__PURE__ */ React.createElement("form", { onSubmit: submitRental, style: { padding: "16px 18px", borderBottom: "0.5px solid #f0ece6", background: "#fefcf8" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Rental Name"), /* @__PURE__ */ React.createElement("select", { name: "name", value: rentalForm.name, onChange: function(e) {
      setRentalForm(function(f) {
        return Object.assign({}, f, { name: e.target.value, custom_name: "" });
      });
    }, style: inpSt }, RENTAL_NAMES.map(function(n) {
      return /* @__PURE__ */ React.createElement("option", { key: n, value: n }, n);
    }))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Payment Type"), /* @__PURE__ */ React.createElement("select", { name: "payment_type", value: rentalForm.payment_type, onChange: function(e) {
      setRentalForm(function(f) {
        return Object.assign({}, f, { payment_type: e.target.value });
      });
    }, style: inpSt }, PAYMENT_TYPES.map(function(p) {
      return /* @__PURE__ */ React.createElement("option", { key: p, value: p }, p);
    })))), rentalForm.name === "Other" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Specify Name"), /* @__PURE__ */ React.createElement("input", { required: true, name: "custom_name", value: rentalForm.custom_name, onChange: function(e) {
      setRentalForm(function(f) {
        return Object.assign({}, f, { custom_name: e.target.value });
      });
    }, placeholder: "Enter rental name", style: inpSt })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Amount"), /* @__PURE__ */ React.createElement("input", { required: true, name: "amount", type: "number", step: "0.01", min: "0", value: rentalForm.amount, onChange: function(e) {
      setRentalForm(function(f) {
        return Object.assign({}, f, { amount: e.target.value });
      });
    }, placeholder: "0.00", style: inpSt })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Date"), /* @__PURE__ */ React.createElement("input", { required: true, name: "date", type: "date", value: rentalForm.date, onChange: function(e) {
      setRentalForm(function(f) {
        return Object.assign({}, f, { date: e.target.value });
      });
    }, style: inpSt }))), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: rentalSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: rentalSaving ? 0.7 : 1 } }, rentalSaving ? "Saving\u2026" : "Save Earning")), rentalsLoading ? /* @__PURE__ */ React.createElement("div", { style: { padding: "24px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "Loading\u2026") : rentals.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "24px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No earnings logged yet.") : rentals.map(function(r) {
      return /* @__PURE__ */ React.createElement("div", { key: r.id || r.date + r.name, style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "0.5px solid #f9f6f2" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a", fontWeight: 500 } }, r.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2 } }, r.date, r.payment_type ? " \xB7 " + r.payment_type : "")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#059669", flexShrink: 0 } }, fmt(parseFloat(r.amount) || 0)));
    })), (function() {
      var cashIn = cashLog.filter(function(c) {
        return c.direction === "In";
      }).reduce(function(s, c) {
        return s + (parseFloat(c.amount) || 0);
      }, 0);
      var cashOut = cashLog.filter(function(c) {
        return c.direction === "Out";
      }).reduce(function(s, c) {
        return s + (parseFloat(c.amount) || 0);
      }, 0);
      return /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "0.5px solid #e8e0d5", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "Expenditures"), !cashLoading && cashLog.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginTop: 2 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#c62828", fontWeight: 600 } }, "\u2193 ", fmt(cashOut)))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setShowCashForm(function(v) {
          return !v;
        });
      }, style: { fontSize: 12, background: showCashForm ? "#f5f0ea" : gold, color: showCashForm ? "#666" : "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 500 } }, showCashForm ? "Cancel" : "+ Log Cash")), showCashForm && /* @__PURE__ */ React.createElement("form", { onSubmit: submitCash, style: { padding: "14px 18px", borderBottom: "0.5px solid #f0ece6", background: "#fefcf8" } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Description *"), /* @__PURE__ */ React.createElement("input", { required: true, value: cashForm.description, onChange: function(e) {
        setCashForm(function(f) {
          return Object.assign({}, f, { description: e.target.value });
        });
      }, placeholder: "What is this for?", style: inpSt })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Amount *"), /* @__PURE__ */ React.createElement("input", { required: true, type: "number", step: "0.01", min: "0", value: cashForm.amount, onChange: function(e) {
        setCashForm(function(f) {
          return Object.assign({}, f, { amount: e.target.value });
        });
      }, placeholder: "0.00", style: inpSt })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Date *"), /* @__PURE__ */ React.createElement("input", { required: true, type: "date", value: cashForm.date, onChange: function(e) {
        setCashForm(function(f) {
          return Object.assign({}, f, { date: e.target.value });
        });
      }, style: inpSt })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 } }, "Direction"), /* @__PURE__ */ React.createElement("select", { value: cashForm.direction, onChange: function(e) {
        setCashForm(function(f) {
          return Object.assign({}, f, { direction: e.target.value });
        });
      }, style: inpSt }, /* @__PURE__ */ React.createElement("option", { value: "Out" }, "Cash Out"), /* @__PURE__ */ React.createElement("option", { value: "In" }, "Cash In")))), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: cashSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: cashSaving ? 0.7 : 1 } }, cashSaving ? "Saving\u2026" : "Save")), cashLoading ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "Loading\u2026") : cashLog.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No cash entries yet.") : cashLog.map(function(c) {
        var isIn = c.direction === "In";
        return /* @__PURE__ */ React.createElement("div", { key: c.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "0.5px solid #f9f6f2" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", background: isIn ? "#ecfdf5" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: isIn ? "#059669" : "#c62828" } }, isIn ? "\u2191" : "\u2193"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a" } }, c.description), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2 } }, c.date)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: isIn ? "#059669" : "#c62828", flexShrink: 0 } }, isIn ? "+" : "-", fmt(parseFloat(c.amount) || 0)), /* @__PURE__ */ React.createElement("button", { onClick: function() {
          deleteCash(c.id);
        }, style: { background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 14, padding: "2px 4px", flexShrink: 0 } }, "\xD7"));
      }));
    })()), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "0.5px solid #e8e0d5", overflow: "hidden", gridColumn: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid #f0ece6", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "Resources")), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px" } }, resourcesLoading ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#ccc" } }, "Loading\u2026") : resources.length === 0 && !showAddResource ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#aaa", fontStyle: "italic" } }, "No resources yet.") : null, resources.map(function(r) {
      return /* @__PURE__ */ React.createElement(
        "a",
        {
          key: r.id,
          href: r.url,
          target: "_blank",
          rel: "noopener noreferrer",
          style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 4, background: "#faf8f5", textDecoration: "none", cursor: "pointer" },
          onMouseEnter: function(e) {
            e.currentTarget.style.background = "#f5f0e8";
          },
          onMouseLeave: function(e) {
            e.currentTarget.style.background = "#faf8f5";
          }
        },
        /* @__PURE__ */ React.createElement("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: gold, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }), /* @__PURE__ */ React.createElement("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "14", x2: "21", y2: "3" })),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 500, color: gold, flex: 1 } }, r.title)
      );
    }), showAddResource ? /* @__PURE__ */ React.createElement("div", { style: { background: "#faf8f5", borderRadius: 8, padding: "12px 14px", marginTop: 8, border: "0.5px solid #e8e0d5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, ["link", "file"].map(function(t) {
      return /* @__PURE__ */ React.createElement("button", { key: t, onClick: function() {
        setResourceType(t);
      }, style: { fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "0.5px solid " + (resourceType === t ? gold : "#e0d8cc"), background: resourceType === t ? gold : "#fff", color: resourceType === t ? "#fff" : "#888", cursor: "pointer", fontWeight: resourceType === t ? 600 : 400 } }, t === "link" ? "Link" : "Upload File");
    })), /* @__PURE__ */ React.createElement("input", { value: resourceTitle, onChange: function(e) {
      setResourceTitle(e.target.value);
    }, placeholder: "Title", style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: "border-box" } }), resourceType === "link" ? /* @__PURE__ */ React.createElement("input", { value: resourceUrl, onChange: function(e) {
      setResourceUrl(e.target.value);
    }, placeholder: "https://\u2026", style: { width: "100%", padding: "7px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 12, marginBottom: 8, boxSizing: "border-box" } }) : /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: function() {
      resourceFileRef.current.click();
    }, style: { fontSize: 12, color: gold, background: "#fff", border: "0.5px dashed " + gold, borderRadius: 7, padding: "7px 14px", cursor: "pointer", width: "100%" } }, resourceUrl ? "\u2713 " + resourceUrl.split("/").pop().slice(0, 30) : "Choose file\u2026"), /* @__PURE__ */ React.createElement("input", { ref: resourceFileRef, type: "file", style: { display: "none" }, onChange: function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!resourceTitle) setResourceTitle(file.name.replace(/\.[^.]+$/, ""));
      setResourceUrl("__file__:" + file.name);
    } })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { disabled: resourceSaving, onClick: function() {
      if (!resourceTitle) return;
      setResourceSaving(true);
      function saveRecord(url) {
        fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Resources"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ area: "Financials", title: resourceTitle, url })
        }).then(function(r) {
          return r.json();
        }).then(function(rows) {
          clearCache("Op Resources");
          setResourceSaving(false);
          if (rows && rows[0]) setResources(function(prev) {
            return prev.concat([rows[0]]);
          });
          setResourceTitle("");
          setResourceUrl("");
          setShowAddResource(false);
        });
      }
      if (resourceType === "link") {
        saveRecord(resourceUrl);
      } else {
        var file = resourceFileRef.current && resourceFileRef.current.files[0];
        if (!file) {
          setResourceSaving(false);
          return;
        }
        var ext = file.name.split(".").pop();
        var filename = "financials-" + Date.now() + "." + ext;
        fetch(SUPABASE_URL + "/storage/v1/object/area-resources/" + filename, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
          body: file
        }).then(function() {
          saveRecord(SUPABASE_URL + "/storage/v1/object/public/area-resources/" + filename);
        }).catch(function() {
          setResourceSaving(false);
        });
      }
    }, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: resourceSaving ? 0.7 : 1 } }, resourceSaving ? "Saving\u2026" : "Add"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAddResource(false);
      setResourceTitle("");
      setResourceUrl("");
    }, style: { padding: "7px 12px", background: "#f0ece6", border: "none", borderRadius: 7, fontSize: 12, color: "#666", cursor: "pointer" } }, "Cancel"))) : /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAddResource(true);
      setResourceType("link");
    }, style: { width: "100%", marginTop: 4, padding: "8px 12px", background: "none", border: "none", fontSize: 12, color: gold, fontWeight: 500, cursor: "pointer", textAlign: "right", display: "block" } }, "Add Resource \u2192")))));
  }
  function IdeaForm({ formData, setFormData, onSubmit, onCancel, submitLabel, isSaving }) {
    var inpSt = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
    var lb = { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 };
    var STATUS_OPTIONS = ["Exploring", "Active", "On Hold", "Declined", "Completed"];
    return /* @__PURE__ */ React.createElement("form", { onSubmit }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Title *"), /* @__PURE__ */ React.createElement("input", { required: true, value: formData.title, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { title: e.target.value });
      });
    }, style: inpSt, placeholder: "Name of idea or initiative" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Status"), /* @__PURE__ */ React.createElement("select", { value: formData.status, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { status: e.target.value });
      });
    }, style: inpSt }, STATUS_OPTIONS.map(function(s) {
      return /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s);
    })))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: formData.status === "Active" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Submitted By"), /* @__PURE__ */ React.createElement("input", { value: formData.submitted_by, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { submitted_by: e.target.value });
      });
    }, style: inpSt, placeholder: "Person's name" })), formData.status === "Active" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Total Budget ($)"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", min: "0", value: formData.budget || "", onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { budget: e.target.value });
      });
    }, style: inpSt, placeholder: "0.00" }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Notes \u2014 why it matters, context, ideas"), /* @__PURE__ */ React.createElement("textarea", { value: formData.notes, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { notes: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpSt, { resize: "vertical" }), placeholder: "Why this matters, background context, related ideas\u2026" })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#b45309", fontWeight: 600, display: "block", marginBottom: 4 } }, "Blockers \u2014 what's in the way"), /* @__PURE__ */ React.createElement("textarea", { value: formData.blockers, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { blockers: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpSt, { resize: "vertical" }), placeholder: "Obstacles, constraints, risks\u2026" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, color: "#1565c0", fontWeight: 600, display: "block", marginBottom: 4 } }, "Gaps \u2014 what's missing"), /* @__PURE__ */ React.createElement("textarea", { value: formData.gaps, onChange: function(e) {
      setFormData(function(f) {
        return Object.assign({}, f, { gaps: e.target.value });
      });
    }, rows: 3, style: Object.assign({}, inpSt, { resize: "vertical" }), placeholder: "Resources, knowledge, support needed\u2026" }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: isSaving, style: { flex: 1, background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: isSaving ? 0.7 : 1 } }, isSaving ? "Saving\u2026" : submitLabel), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onCancel, style: { padding: "9px 18px", background: "#f0ece6", border: "none", borderRadius: 8, fontSize: 13, color: "#666", cursor: "pointer" } }, "Cancel")));
  }
  function IdeasView() {
    var { useState: useState2, useEffect: useEffect2, useRef } = React;
    var isMobile = React.useContext(MobileCtx);
    var today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    var STATUS_OPTIONS = ["Exploring", "Active", "On Hold", "Declined", "Completed"];
    var STATUS_COLORS = {
      "Exploring": { bg: "#e3f2fd", color: "#1565c0" },
      "Active": { bg: "#e8f5e9", color: "#2e7d32" },
      "On Hold": { bg: "#fff8e1", color: "#f57f17" },
      "Declined": { bg: "#fce4ec", color: "#c62828" },
      "Completed": { bg: "#f3e5f5", color: "#6a1b9a" }
    };
    var [ideas, setIdeas] = useState2([]);
    var [loading, setLoading] = useState2(true);
    var [selected, setSelected] = useState2(null);
    var [mainTab, setMainTab] = useState2("initiatives");
    var [filterStatus, setFilterStatus] = useState2("All");
    var [showAdd, setShowAdd] = useState2(false);
    var [editing, setEditing] = useState2(false);
    var emptyForm = { title: "", status: "Exploring", submitted_by: "", notes: "", blockers: "", gaps: "", budget: "" };
    var [form, setForm] = useState2(emptyForm);
    var [editForm, setEditForm] = useState2({});
    var [saving, setSaving] = useState2(false);
    var [editSaving, setEditSaving] = useState2(false);
    var [budgetItems, setBudgetItems] = useState2([]);
    var [budgetLoading, setBudgetLoading] = useState2(false);
    var emptyBF = { description: "", amount: "", date: today, expense_type: "Purchase" };
    var [budgetForm, setBudgetForm] = useState2(emptyBF);
    var [showBudgetForm, setShowBudgetForm] = useState2(false);
    var [budgetSaving, setBudgetSaving] = useState2(false);
    var receiptRef = useRef(null);
    var inpSt = { width: "100%", padding: "8px 10px", border: "0.5px solid #e0d8cc", borderRadius: 7, fontSize: 13, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
    var lb = { fontSize: 11, color: "#888", fontWeight: 500, display: "block", marginBottom: 4 };
    useEffect2(function() {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Ideas") + "?select=*&order=created_at.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) {
          setIdeas(rows);
        } else {
          alert("Ideas table error: " + JSON.stringify(rows));
        }
        setLoading(false);
      }).catch(function() {
        setLoading(false);
      });
    }, []);
    useEffect2(function() {
      if (!selected || selected.status !== "Active") {
        setBudgetItems([]);
        return;
      }
      setBudgetLoading(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?area=eq." + encodeURIComponent(selected.title) + "&select=*&order=date.desc,id.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        setBudgetItems(Array.isArray(rows) ? rows : []);
        setBudgetLoading(false);
      }).catch(function() {
        setBudgetLoading(false);
      });
    }, [selected]);
    function loadIdeas(thenFn) {
      return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Ideas") + "?select=*&order=created_at.desc", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (Array.isArray(rows)) {
          setIdeas(rows);
          if (thenFn) thenFn(rows);
        }
      });
    }
    function addIdea(e) {
      e.preventDefault();
      if (!form.title) return;
      setSaving(true);
      var payload = { title: form.title, status: form.status, submitted_by: form.submitted_by || null, notes: form.notes || null, blockers: form.blockers || null, gaps: form.gaps || null, budget: form.budget ? parseFloat(form.budget) : null };
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Ideas"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }).then(function(r) {
        if (!r.ok) {
          return r.json().then(function(e2) {
            alert("Error: " + (e2.message || JSON.stringify(e2)));
            setSaving(false);
          });
        }
        return r.json().then(function(rows) {
          setSaving(false);
          setForm(emptyForm);
          setShowAdd(false);
          var newStatus = payload.status;
          setMainTab(["Active", "On Hold", "Completed", "Declined"].includes(newStatus) ? "initiatives" : "ideas");
          setFilterStatus("All");
          loadIdeas(function(allRows) {
            var match = allRows.find(function(x) {
              return rows && rows[0] ? x.id === rows[0].id : x.title === payload.title;
            });
            if (match) setSelected(match);
          });
        });
      }).catch(function(err) {
        setSaving(false);
        alert("Network error: " + err);
      });
    }
    function saveEdit() {
      if (!selected) return;
      setEditSaving(true);
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Ideas") + "?id=eq." + selected.id, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      }).then(function() {
        var updated = Object.assign({}, selected, editForm);
        setIdeas(function(p) {
          return p.map(function(i) {
            return i.id === selected.id ? updated : i;
          });
        });
        setSelected(updated);
        setEditing(false);
        setEditSaving(false);
        var newStatus = editForm.status;
        setMainTab(["Active", "On Hold", "Completed", "Declined"].includes(newStatus) ? "initiatives" : "ideas");
        setFilterStatus("All");
      }).catch(function() {
        setEditSaving(false);
      });
    }
    function submitBudget(e) {
      e.preventDefault();
      if (!budgetForm.description || !budgetForm.amount || !budgetForm.date || !selected) return;
      setBudgetSaving(true);
      var isInKind = budgetForm.expense_type === "In-Kind";
      var needsReimb = budgetForm.expense_type === "Reimbursement";
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget"), {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ area: selected.title, description: budgetForm.description, amount: parseFloat(budgetForm.amount), date: budgetForm.date, type: isInKind ? "In-Kind" : "Purchase", needs_reimbursement: needsReimb })
      }).then(function(r) {
        return r.json();
      }).then(function(rows) {
        if (rows && rows.message) {
          alert("Budget error: " + rows.message);
          setBudgetSaving(false);
          return;
        }
        var newRow = rows && rows[0] ? rows[0] : {};
        var file = receiptRef.current && receiptRef.current.files[0];
        function finish(row) {
          setBudgetItems(function(p) {
            return [row].concat(p);
          });
          setBudgetForm(emptyBF);
          setShowBudgetForm(false);
          setBudgetSaving(false);
          if (receiptRef.current) receiptRef.current.value = "";
        }
        if (file && newRow.id) {
          var ext = file.name.split(".").pop();
          var fn = "idea-" + newRow.id + "-" + Date.now() + "." + ext;
          fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + fn, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": file.type },
            body: file
          }).then(function() {
            var url = SUPABASE_URL + "/storage/v1/object/public/receipts/" + fn;
            fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + newRow.id, {
              method: "PATCH",
              headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ receipt_url: url })
            }).then(function() {
              finish(Object.assign({}, newRow, { receipt_url: url }));
            });
          }).catch(function() {
            finish(newRow);
          });
        } else {
          finish(newRow);
        }
      }).catch(function(err) {
        alert("Budget error: " + err);
        setBudgetSaving(false);
      });
    }
    function deleteBudgetItem(id) {
      fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent("Op Budget") + "?id=eq." + id, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      }).then(function() {
        setBudgetItems(function(p) {
          return p.filter(function(b) {
            return b.id !== id;
          });
        });
      });
    }
    function fmtMoney(n) {
      return "$" + parseFloat(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var INITIATIVES_STATUSES = ["Active", "On Hold", "Completed", "Declined"];
    var IDEA_STATUSES = ["Exploring"];
    var tabStatuses = mainTab === "initiatives" ? INITIATIVES_STATUSES : IDEA_STATUSES;
    var filtered = ideas.filter(function(i) {
      if (!tabStatuses.includes(i.status)) return false;
      return filterStatus === "All" || i.status === filterStatus;
    });
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif" } }, "Ideas & Initiatives"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setShowAdd(true);
    }, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, "+ New Idea")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #e8e0d5" } }, [{ id: "initiatives", label: "Active Initiatives" }, { id: "ideas", label: "Idea Stage" }].map(function(t) {
      var isOn = mainTab === t.id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t.id,
          onClick: function() {
            setMainTab(t.id);
            setFilterStatus("All");
            setSelected(null);
          },
          style: { padding: "8px 20px", fontSize: 13, fontWeight: isOn ? 700 : 400, color: isOn ? gold : "#aaa", background: "none", border: "none", borderBottom: "2px solid " + (isOn ? gold : "transparent"), cursor: "pointer", marginBottom: -1 }
        },
        t.label
      );
    })), mainTab === "initiatives" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } }, ["All", "Active", "On Hold", "Completed"].map(function(s) {
      var sc = STATUS_COLORS[s] || { bg: "#f5f0ea", color: "#888" };
      var isOn = filterStatus === s;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: s,
          onClick: function() {
            setFilterStatus(s);
            setSelected(null);
          },
          style: { fontSize: 11, fontWeight: isOn ? 700 : 400, padding: "3px 12px", borderRadius: 20, border: "0.5px solid " + (isOn ? sc.color : "#e0d8cc"), background: isOn ? sc.bg : "#fff", color: isOn ? sc.color : "#999", cursor: "pointer" }
        },
        s
      );
    })), loading ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 } }, "Loading\u2026") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: selected && !isMobile ? "240px 1fr" : "1fr", gap: 16, alignItems: "start" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderBottom: "0.5px solid #f0ece6", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 } }, filtered.length, " idea", filtered.length !== 1 ? "s" : "")), filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 14px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No ideas yet.") : filtered.map(function(idea) {
      var sc = STATUS_COLORS[idea.status] || { bg: "#f5f5f5", color: "#888" };
      var isSel = selected && selected.id === idea.id;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: idea.id,
          onClick: function() {
            setSelected(isSel ? null : idea);
            setEditing(false);
          },
          style: { padding: "10px 14px", borderBottom: "0.5px solid #f5f1eb", cursor: "pointer", background: isSel ? sc.bg : "#fff", borderLeft: "3px solid " + (isSel ? sc.color : "transparent"), transition: "all 0.12s" },
          onMouseEnter: function(e) {
            if (!isSel) e.currentTarget.style.background = "#faf8f5";
          },
          onMouseLeave: function(e) {
            if (!isSel) e.currentTarget.style.background = "#fff";
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#2a2a2a", marginBottom: 4 } }, idea.title),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, border: "0.5px solid " + sc.color + "44", borderRadius: 10, padding: "1px 7px" } }, idea.status), idea.submitted_by && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#aaa" } }, idea.submitted_by))
      );
    })), selected && (function() {
      var sc = STATUS_COLORS[selected.status] || { bg: "#f5f5f5", color: "#888" };
      var budgetTotal = budgetItems.reduce(function(s, b) {
        return s + (parseFloat(b.amount) || 0);
      }, 0);
      return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { background: sc.bg, padding: "16px 20px", borderBottom: "0.5px solid " + sc.color + "33", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 700, color: "#2a2a2a", marginBottom: 6 } }, selected.title), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 700, background: "#fff", color: sc.color, border: "0.5px solid " + sc.color + "66", borderRadius: 10, padding: "2px 8px" } }, selected.status), selected.submitted_by && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#888" } }, "by ", selected.submitted_by))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 } }, selected.status === "Active" && selected.budget && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: budgetTotal > parseFloat(selected.budget) ? "#c62828" : "#2e7d32" } }, fmtMoney(budgetTotal), " / ", fmtMoney(parseFloat(selected.budget))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#aaa", marginTop: 1 } }, "spent / budget")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: function() {
            setEditing(true);
            setEditForm({ title: selected.title, status: selected.status, submitted_by: selected.submitted_by || "", notes: selected.notes || "", blockers: selected.blockers || "", gaps: selected.gaps || "", budget: selected.budget || "" });
          },
          style: { background: "#fff", border: "0.5px solid " + sc.color + "66", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: sc.color, cursor: "pointer", fontWeight: 500 }
        },
        "Edit"
      ))), /* @__PURE__ */ React.createElement("div", { style: { padding: "16px 20px" } }, selected.notes && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#888", fontWeight: 600, marginBottom: 6 } }, "Notes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.7, whiteSpace: "pre-wrap" } }, selected.notes)), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } }, selected.blockers && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#b45309", fontWeight: 600, marginBottom: 6 } }, "Blockers"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.7, whiteSpace: "pre-wrap" } }, selected.blockers)), selected.gaps && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#1565c0", fontWeight: 600, marginBottom: 6 } }, "Gaps"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.7, whiteSpace: "pre-wrap" } }, selected.gaps))))), selected.status === "Active" && /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 12, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 18px", borderBottom: "0.5px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcfb" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#2a2a2a" } }, "Active Initiatives"), !budgetLoading && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, marginTop: 2 } }, selected.budget ? /* @__PURE__ */ React.createElement("span", { style: { color: budgetTotal > parseFloat(selected.budget) ? "#c62828" : "#2e7d32", fontWeight: 600 } }, fmtMoney(budgetTotal), " of ", fmtMoney(parseFloat(selected.budget)), " spent") : budgetItems.length > 0 ? /* @__PURE__ */ React.createElement("span", { style: { color: "#888" } }, fmtMoney(budgetTotal), " \xB7 ", budgetItems.length, " item", budgetItems.length !== 1 ? "s" : "") : null)), /* @__PURE__ */ React.createElement("button", { onClick: function() {
        setShowBudgetForm(function(v) {
          return !v;
        });
      }, style: { fontSize: 12, background: showBudgetForm ? "#f5f0ea" : gold, color: showBudgetForm ? "#666" : "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 500 } }, showBudgetForm ? "Cancel" : "+ Log Expense")), showBudgetForm && /* @__PURE__ */ React.createElement("form", { onSubmit: submitBudget, style: { padding: "14px 18px", borderBottom: "0.5px solid #f0ece6", background: "#fefcf8" } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: lb }, "Description *"), /* @__PURE__ */ React.createElement("input", { required: true, value: budgetForm.description, onChange: function(e) {
        setBudgetForm(function(f) {
          return Object.assign({}, f, { description: e.target.value });
        });
      }, placeholder: "What was purchased or contributed", style: inpSt })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Amount *"), /* @__PURE__ */ React.createElement("input", { required: true, type: "number", step: "0.01", min: "0", value: budgetForm.amount, onChange: function(e) {
        setBudgetForm(function(f) {
          return Object.assign({}, f, { amount: e.target.value });
        });
      }, placeholder: "0.00", style: inpSt })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Date *"), /* @__PURE__ */ React.createElement("input", { required: true, type: "date", value: budgetForm.date, onChange: function(e) {
        setBudgetForm(function(f) {
          return Object.assign({}, f, { date: e.target.value });
        });
      }, style: inpSt })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: lb }, "Type"), /* @__PURE__ */ React.createElement("select", { value: budgetForm.expense_type, onChange: function(e) {
        setBudgetForm(function(f) {
          return Object.assign({}, f, { expense_type: e.target.value });
        });
      }, style: inpSt }, /* @__PURE__ */ React.createElement("option", { value: "Purchase" }, "Purchase"), /* @__PURE__ */ React.createElement("option", { value: "Reimbursement" }, "Reimbursement"), /* @__PURE__ */ React.createElement("option", { value: "In-Kind" }, "In-Kind")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: gold, fontWeight: 500 } }, /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" })), "Attach receipt", /* @__PURE__ */ React.createElement("input", { ref: receiptRef, type: "file", accept: "image/*,.pdf", style: { display: "none" } })), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: budgetSaving, style: { background: gold, color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: budgetSaving ? 0.7 : 1 } }, budgetSaving ? "Saving\u2026" : "Save"))), budgetLoading ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "Loading\u2026") : budgetItems.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", fontSize: 12, color: "#ccc", textAlign: "center" } }, "No expenses logged yet.") : budgetItems.map(function(b) {
        return /* @__PURE__ */ React.createElement("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "0.5px solid #f9f6f2" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2a2a2a" } }, b.description), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#aaa", marginTop: 2 } }, b.date)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: b.type === "In-Kind" ? "#2e7d32" : b.needs_reimbursement ? "#b45309" : "#2a2a2a", flexShrink: 0 } }, fmtMoney(b.amount)), b.type === "In-Kind" && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, background: "#e8f5e9", color: "#2e7d32", padding: "2px 6px", borderRadius: 10, fontWeight: 600, flexShrink: 0 } }, "In-Kind"), b.needs_reimbursement && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 10, fontWeight: 600, flexShrink: 0 } }, "$ Reimb."), b.receipt_url && /* @__PURE__ */ React.createElement("a", { href: b.receipt_url, target: "_blank", rel: "noopener noreferrer", title: "View attachment", style: { color: gold, textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }))), /* @__PURE__ */ React.createElement("button", { onClick: function() {
          deleteBudgetItem(b.id);
        }, style: { background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 14, padding: "2px 4px", flexShrink: 0 } }, "\xD7"));
      })));
    })()), editing && selected && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setEditing(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2e3, padding: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, maxWidth: 540, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto", padding: 28 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a" } }, "Edit Idea"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setEditing(false);
    }, style: { background: "#f0ece6", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "\u2715 Close")), /* @__PURE__ */ React.createElement(IdeaForm, { formData: editForm, setFormData: setEditForm, onSubmit: function(e) {
      e.preventDefault();
      saveEdit();
    }, onCancel: function() {
      setEditing(false);
    }, submitLabel: "Save Changes", isSaving: editSaving }))), showAdd && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setShowAdd(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2e3, padding: 24 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { background: "#fff", borderRadius: 16, maxWidth: 540, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto", padding: 28 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#2a2a2a" } }, "New Idea"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: function() {
      setShowAdd(false);
    }, style: { background: "#f0ece6", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 } }, "\u2715 Close")), /* @__PURE__ */ React.createElement(IdeaForm, { formData: form, setFormData: setForm, onSubmit: addIdea, onCancel: function() {
      setShowAdd(false);
    }, submitLabel: "Add Idea", isSaving: saving }))));
  }
  function DonorsGate({ onUnlock }) {
    var { useState: useState2 } = React;
    var [val, setVal] = useState2("");
    var [err, setErr] = useState2(false);
    function attempt(e) {
      e.preventDefault();
      if (val === DONORS_PASSWORD) {
        onUnlock();
      } else {
        setErr(true);
        setVal("");
      }
    }
    return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#fff", border: "0.5px solid #e8e0d5", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Cardo', serif", marginBottom: 6 } }, "Donations"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#aaa", marginBottom: 28 } }, "Enter password to continue"), /* @__PURE__ */ React.createElement("form", { onSubmit: attempt }, /* @__PURE__ */ React.createElement(
      "input",
      {
        autoFocus: true,
        type: "password",
        value: val,
        onChange: function(e) {
          setVal(e.target.value);
          setErr(false);
        },
        placeholder: "Password",
        style: { width: "100%", padding: "10px 14px", border: "0.5px solid " + (err ? "#e05050" : "#e0d8cc"), borderRadius: 8, fontSize: 14, boxSizing: "border-box", marginBottom: err ? 6 : 16, outline: "none", textAlign: "center", letterSpacing: 2 }
      }
    ), err && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#e05050", marginBottom: 12 } }, "Incorrect password"), /* @__PURE__ */ React.createElement("button", { type: "submit", style: { width: "100%", padding: "10px", background: "#b5a185", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" } }, "Unlock"))));
  }
  var views = {
    home: HomeView,
    events: EventsView,
    quarterly: QuarterlyView,
    volunteers: VolunteersView,
    donors: DonorsView,
    marketing: MarketingView,
    board: BoardView,
    sponsors: SponsorsView,
    strategy: StrategyView,
    ideas: IdeasView,
    operational: OperationalView,
    financials: FinancialsView,
    reviews: ReviewsView
  };
  var OPERATIONAL_AREAS = ["Construction", "Grounds", "Interiors", "Docents", "Fundraising", "Events", "Marketing", "Venue"];
  var AREA_DEFAULTS = {
    "Construction": { lead: "Rick Panos", budget: 12e3, pic: "https://drive.google.com/file/d/1hbFJxUUQEsuhoWnTDeARg6peSHCpiBFH/view?usp=drive_link" },
    "Grounds": { lead: "Paula Campbell", budget: 14e3, pic: "https://drive.google.com/file/d/17J0cF_okHkAs_HCRjuYm0TnpM0v8Ek5-/view?usp=sharing" },
    "Interiors": { lead: "Bec Freeman", budget: 2500, pic: "https://drive.google.com/file/d/1PsjDfGQLqDF9BVc5wuBd-Qx9D5E0Hvf4/view?usp=drive_link" },
    "Docents": { lead: "Rich Hill", budget: 1e3, pic: "https://drive.google.com/file/d/1gBzqnzekKkTLn8mnn2mxt-PqAeeMZSJs/view?usp=drive_link" },
    "Fundraising": { lead: "Kaelen Jennings", budget: null, pic: "" },
    "Events": { lead: "Barb Kusha", budget: 7500, pic: "" },
    "Marketing": { lead: "Haley Wright", budget: 1e3, pic: "https://drive.google.com/file/d/17Tse_3jiKZwmkVTTKMtt64zDghfZ8WrV/view?usp=drive_link" },
    "Venue": { lead: "Staff", budget: null, pic: "" }
  };
  function Dashboard() {
    const [active, setActive] = useState("home");
    const [opOpen, setOpOpen] = useState(false);
    const [opArea, setOpArea] = useState(null);
    const [quarterlyArea, setQuarterlyArea] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [donorsUnlocked, setDonorsUnlocked] = useState(() => sessionStorage.getItem("nsh_donors") === "1");
    const View = views[active];
    const mod = modules.find((m) => m.id === active);
    React.useEffect(function() {
      var fn = function() {
        setIsMobile(window.innerWidth < 768);
      };
      window.addEventListener("resize", fn);
      return function() {
        window.removeEventListener("resize", fn);
      };
    }, []);
    return /* @__PURE__ */ React.createElement(MobileCtx.Provider, { value: isMobile }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", minHeight: "100vh", background: cream, fontFamily: "system-ui, sans-serif" } }, /* @__PURE__ */ React.createElement("style", null, ".nsh-sidebar::-webkit-scrollbar { display: none; } .nsh-reviews-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }"), /* @__PURE__ */ React.createElement("div", { style: { display: isMobile ? "none" : "flex", position: "sticky", top: 0, height: "100vh", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "nsh-sidebar", style: { width: 220, background: "#2a2a2e", display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", scrollbarWidth: "none" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 20px 14px", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("img", { src: "assets/logo.png", alt: "North Star House", style: { width: 195, display: "block" } })), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "0 0 8px" } }), /* @__PURE__ */ React.createElement("nav", { style: { flex: 1, padding: "0 8px" } }, modules.filter((m) => !m.hidden).map((m) => /* @__PURE__ */ React.createElement("button", { key: m.id, onClick: () => {
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
    }), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "10px 16px 8px" } }), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setActive("financials");
        },
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "9px 16px",
          background: active === "financials" ? "rgba(181,161,133,0.15)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: active === "financials" ? "#b5a185" : "rgba(255,255,255,0.45)",
          fontSize: 13,
          fontWeight: active === "financials" ? 600 : 400,
          transition: "all 0.15s"
        }
      },
      "Financials"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: function() {
          setActive("reviews");
        },
        style: {
          display: "block",
          width: "100%",
          padding: "9px 16px",
          background: active === "reviews" ? "rgba(181,161,133,0.15)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: active === "reviews" ? "#b5a185" : "rgba(255,255,255,0.45)",
          fontSize: 13,
          fontWeight: active === "reviews" ? 600 : 400,
          transition: "all 0.15s"
        }
      },
      "Reviews"
    )))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } }, isMobile && mobileMenuOpen && /* @__PURE__ */ React.createElement("div", { onClick: function() {
      setMobileMenuOpen(false);
    }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 } }, /* @__PURE__ */ React.createElement("div", { onClick: function(e) {
      e.stopPropagation();
    }, style: { position: "absolute", top: 0, left: 0, bottom: 0, width: 260, background: "#2a2a2e", overflowY: "auto", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(255,255,255,0.08)" } }, /* @__PURE__ */ React.createElement("img", { src: "assets/logo.png", alt: "NSH", style: { height: 32 } }), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setMobileMenuOpen(false);
    }, style: { background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", lineHeight: 1 } }, "\xD7")), /* @__PURE__ */ React.createElement("nav", { style: { flex: 1, padding: "8px 8px" } }, modules.filter(function(m) {
      return !m.hidden;
    }).map(function(m) {
      return /* @__PURE__ */ React.createElement("button", { key: m.id, onClick: function() {
        setActive(m.id);
        setOpOpen(false);
        setMobileMenuOpen(false);
      }, style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "11px 12px",
        background: active === m.id ? "rgba(181,161,133,0.15)" : "transparent",
        border: "none",
        borderRadius: 7,
        cursor: "pointer",
        textAlign: "left",
        color: active === m.id ? "#f0ebe3" : "rgba(255,255,255,0.5)",
        fontSize: 13,
        fontWeight: active === m.id ? 600 : 400,
        marginBottom: 2
      } }, /* @__PURE__ */ React.createElement(NavIcon, { id: m.id, active: active === m.id }), m.label);
    })), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 8px 20px", borderTop: "0.5px solid rgba(255,255,255,0.08)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", padding: "0 8px", marginBottom: 8 } }, "Operational Areas"), OPERATIONAL_AREAS.map(function(area) {
      return /* @__PURE__ */ React.createElement("button", { key: area, onClick: function() {
        setOpArea(area);
        setActive("operational");
        setMobileMenuOpen(false);
      }, style: {
        display: "block",
        width: "100%",
        padding: "9px 12px",
        background: opArea === area && active === "operational" ? "rgba(181,161,133,0.15)" : "transparent",
        border: "none",
        borderRadius: 7,
        cursor: "pointer",
        textAlign: "left",
        color: opArea === area && active === "operational" ? "#b5a185" : "rgba(255,255,255,0.45)",
        fontSize: 13,
        fontWeight: opArea === area && active === "operational" ? 600 : 400,
        marginBottom: 2
      } }, area);
    }), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "0.5px solid rgba(255,255,255,0.08)", margin: "8px 4px" } }), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setActive("financials");
      setMobileMenuOpen(false);
    }, style: { display: "block", width: "100%", padding: "9px 12px", background: active === "financials" ? "rgba(181,161,133,0.15)" : "transparent", border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left", color: active === "financials" ? "#b5a185" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: active === "financials" ? 600 : 400, marginBottom: 2 } }, "Financials"), /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setActive("reviews");
      setMobileMenuOpen(false);
    }, style: { display: "block", width: "100%", padding: "9px 12px", background: active === "reviews" ? "rgba(181,161,133,0.15)" : "transparent", border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left", color: active === "reviews" ? "#b5a185" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: active === "reviews" ? 600 : 400, marginBottom: 2 } }, "Reviews")))), /* @__PURE__ */ React.createElement("div", { style: { background: "#fdfcfb", padding: isMobile ? "12px 16px 10px" : "24px 32px 18px", borderBottom: "3px solid rgba(136,108,68,0.35)", position: "sticky", top: 0, zIndex: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 } }, isMobile && /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setMobileMenuOpen(true);
    }, style: { background: "none", border: "none", cursor: "pointer", padding: 4, color: "#888", flexShrink: 0, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "12", x2: "21", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "18", x2: "21", y2: "18" }))), /* @__PURE__ */ React.createElement("div", { style: { width: 38, height: 38, borderRadius: 9, background: "rgba(136,108,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(NavIcon, { id: active, active: true })), /* @__PURE__ */ React.createElement("h1", { style: { margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 700, color: gold, fontFamily: "'Cardo', serif", textShadow: "1px 2px 0px rgba(136,108,68,0.2)" } }, active === "financials" ? "Financials" : active === "reviews" ? "Reviews" : mod && mod.label), active === "operational" && opArea && /* @__PURE__ */ React.createElement("button", { onClick: function() {
      setQuarterlyArea(opArea);
      setActive("quarterly");
    }, style: { marginLeft: "auto", background: "transparent", color: gold, border: "1.5px solid " + gold, borderRadius: 9, padding: isMobile ? "7px 12px" : "9px 20px", fontSize: isMobile ? 11 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" } }, isMobile ? "Quarterly \u2197" : "Submit Quarterly Update"))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, padding: isMobile ? "16px 14px" : "28px 32px", paddingBottom: isMobile ? 20 : void 0 } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 900 } }, active === "donors" && !donorsUnlocked ? /* @__PURE__ */ React.createElement(DonorsGate, { onUnlock: function() {
      sessionStorage.setItem("nsh_donors", "1");
      setDonorsUnlocked(true);
    } }) : /* @__PURE__ */ React.createElement(View, { navigate: setActive, opArea, navigateOp: function(a) {
      setOpArea(a);
      setActive("operational");
    }, quarterlyArea, navigateToQuarterly: function(a) {
      setQuarterlyArea(a);
      setActive("quarterly");
    } }))))));
  }
  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(Dashboard));
})();
