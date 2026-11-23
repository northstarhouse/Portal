// Admin > "Volunteer Hours": every volunteer's hours for a year, from the kiosk (check-in / check-out pairs) and the missed
// hours volunteers log themselves. Read-only. Click a name to see their individual shifts.
const VH_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', VH_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const VH_H = { apikey: VH_KEY, Authorization: 'Bearer ' + VH_KEY };
const vhGet = path => fetch(VH_URL + '/rest/v1/' + path, { headers: VH_H }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error((d && d.message) || 'Request failed'); return d; });
const GOLD = '#886c44';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const keyOf = n => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
const hrs = n => (Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const when = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const clock = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

async function loadLogs(year) {
  const pageSize = 1000, out = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await vhGet('kiosk_logs?type=eq.volunteer&timestamp=gte.' + year + '-01-01T00:00:00.000Z&timestamp=lt.' + (year + 1) + '-01-01T00:00:00.000Z&order=name.asc,timestamp.asc&select=timestamp,name,action,duty&limit=' + pageSize + '&offset=' + offset);
    if (!Array.isArray(page)) break;
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

// Pair every check-in with the next check-out for the same person (the same rule the Overview totals use).
function buildPeople(logs, teams) {
  const byName = {};
  logs.forEach(l => { const n = String(l.name || '').trim(); if (!n) return; (byName[n] = byName[n] || []).push(l); });
  return Object.keys(byName).map(name => {
    const list = byName[name], shifts = [], months = Array(12).fill(0);
    for (let i = 0; i < list.length; i++) {
      if (list[i].action !== 'check-in') continue;
      let out = null;
      for (let j = i + 1; j < list.length; j++) { if (list[j].action === 'check-out') { out = list[j]; break; } if (list[j].action === 'check-in') break; }
      if (!out) continue;
      const a = new Date(list[i].timestamp), b = new Date(out.timestamp), h = (b - a) / 3600000;
      if (h <= 0 || h > 24) continue;
      shifts.push({ start: a, end: b, hours: h, duty: list[i].duty || '' });
      months[a.getMonth()] += h;
    }
    const total = months.reduce((s, x) => s + x, 0);
    return { name, team: teams[keyOf(name)] || '', shifts: shifts.reverse(), months, total, count: shifts.length, last: shifts.length ? shifts[0].start : null };
  }).filter(p => p.count > 0);
}

export function VolunteerHoursView() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const [people, setPeople] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [q, setQ] = React.useState('');
  const [board, setBoard] = React.useState(false);
  const [sort, setSort] = React.useState('total');
  const [open, setOpen] = React.useState('');
  const [teams, setTeams] = React.useState(null);

  React.useEffect(() => {
    let off = false;
    vhGet('2026%20Volunteers?select=' + encodeURIComponent('First Name,Last Name,Team') + '&limit=2000')
      .then(rows => { if (off) return; const m = {}; (Array.isArray(rows) ? rows : []).forEach(r => { m[keyOf((r['First Name'] || '') + ' ' + (r['Last Name'] || ''))] = r.Team || ''; }); setTeams(m); })
      .catch(() => { if (!off) setTeams({}); });
    return () => { off = true; };
  }, []);
  React.useEffect(() => {
    if (teams === null) return;
    let off = false;
    setPeople(null); setErr('');
    loadLogs(year).then(logs => { if (!off) setPeople(buildPeople(logs, teams)); }).catch(e => { if (!off) { setErr('Could not load volunteer hours: ' + e.message); setPeople([]); } });
    return () => { off = true; };
  }, [year, teams]);

  const all = people || [];
  const shown = all
    .filter(p => (!board || /board/i.test(p.team)) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? ((b.last || 0) - (a.last || 0)) : b.total - a.total);
  const totalHours = shown.reduce((s, p) => s + p.total, 0), totalShifts = shown.reduce((s, p) => s + p.count, 0);
  const monthTotals = MONTHS.map((_, i) => shown.reduce((s, p) => s + p.months[i], 0));
  const [view, setView] = React.useState('month');
  // Per month: hours, shifts and how many different volunteers came in.
  const byMonth = MONTHS.map((label, i) => {
    const who = shown.filter(p => p.months[i] > 0);
    return { label, hours: monthTotals[i], volunteers: who.length, shifts: who.reduce((s, p) => s + p.shifts.filter(x => x.start.getMonth() === i).length, 0) };
  });
  const maxMonth = Math.max(1, ...byMonth.map(m => m.hours));

  function download() {
    const X = window.XLSX; if (!X) { alert('The spreadsheet tool has not loaded. Please refresh and try again.'); return; }
    const aoa = [['Volunteer', 'Team', ...MONTHS, 'Total hours', 'Shifts']].concat(shown.map(p => [p.name, p.team, ...p.months.map(m => Math.round(m * 10) / 10), Math.round(p.total * 10) / 10, p.count]));
    const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [24, 18, ...MONTHS.map(() => 6), 12, 8].map(w => ({ wch: w }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Volunteer hours ' + year); X.writeFile(wb, 'NSH-volunteer-hours-' + year + '.xlsx');
  }

  const th = { textAlign: 'right', padding: '8px 8px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a7e6b', borderBottom: '1px solid #e6dfd3', whiteSpace: 'nowrap' };
  const td = { padding: '9px 8px', borderBottom: '1px solid #f0ebe2', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' };
  const pill = on => ({ border: '1px solid ' + (on ? GOLD : '#d8cdb8'), background: on ? GOLD : '#fff', color: on ? '#fff' : '#6b5d4a', borderRadius: 16, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' });
  const stat = (label, value) => <div style={{ background: '#fff', border: '1px solid #e6dfd3', borderRadius: 10, padding: '10px 16px', minWidth: 110 }}><div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{value}</div><div style={{ fontSize: 11, color: '#8a7e6b', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div></div>;

  return <div style={{ padding: '4px 0 40px', maxWidth: 1180 }}>
    <p style={{ margin: '0 0 14px', color: '#6b5d4a', fontSize: 13.5 }}>Hours logged at the kiosk, plus missed hours volunteers add themselves. Each check-in is paired with the next check-out. Click a name to see their shifts.</p>
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button type="button" style={pill(view === 'month')} onClick={() => setView('month')}>By month</button>
      <button type="button" style={pill(view === 'volunteer')} onClick={() => setView('volunteer')}>By volunteer</button>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ border: '1px solid #d8cdb8', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
        {Array.from({ length: thisYear - 2023 + 1 }, (_, i) => thisYear - i).map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a name" style={{ border: '1px solid #d8cdb8', borderRadius: 8, padding: '8px 12px', fontSize: 13, minWidth: 200, fontFamily: 'inherit' }} />
      <button type="button" style={pill(!board)} onClick={() => setBoard(false)}>Everyone</button>
      <button type="button" style={pill(board)} onClick={() => setBoard(true)}>Board members</button>
      <span style={{ flex: 1 }} />
      <select value={sort} onChange={e => setSort(e.target.value)} style={{ border: '1px solid #d8cdb8', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
        <option value="total">Most hours first</option><option value="name">Name A to Z</option><option value="recent">Most recent shift</option>
      </select>
      <button type="button" onClick={download} disabled={!shown.length} style={{ border: '1px solid ' + GOLD, background: '#fff', color: GOLD, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Download (.xlsx)</button>
    </div>
    {people !== null && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      {stat('Hours', hrs(totalHours))}{stat('Volunteers', shown.length)}{stat('Shifts', totalShifts)}
    </div>}
    {err && <div role="alert" style={{ color: '#b3261e', marginBottom: 10 }}>{err}</div>}
    {people === null ? <div role="status" style={{ color: '#8a7e6b' }}>Loading volunteer hours…</div> : shown.length === 0 ? <div style={{ color: '#8a7e6b' }}>No hours found.</div> : view === 'month' ? <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e6dfd3', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, textAlign: 'left' }}>Month</th><th style={{ ...th, textAlign: 'left', width: '40%' }} /><th style={{ ...th, color: GOLD }}>Hours</th><th style={th}>Volunteers</th><th style={th}>Shifts</th></tr></thead>
        <tbody>
          {byMonth.map(m => <tr key={m.label}>
            <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{m.label} {year}</td>
            <td style={{ ...td, textAlign: 'left' }}><div style={{ height: 8, background: '#f3eee4', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: (m.hours / maxMonth * 100) + '%', background: GOLD, borderRadius: 4 }} /></div></td>
            <td style={{ ...td, fontWeight: 700, color: m.hours ? GOLD : '#d4cbb8' }}>{m.hours ? hrs(m.hours) : '·'}</td>
            <td style={{ ...td, color: m.volunteers ? '#33302b' : '#d4cbb8' }}>{m.volunteers || '·'}</td>
            <td style={{ ...td, color: m.shifts ? '#33302b' : '#d4cbb8' }}>{m.shifts || '·'}</td>
          </tr>)}
          <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>Year total</td><td style={{ ...td, borderBottom: 'none' }} /><td style={{ ...td, fontWeight: 700, color: GOLD, borderBottom: 'none' }}>{hrs(totalHours)}</td><td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{shown.length}</td><td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{totalShifts}</td></tr>
        </tbody>
      </table>
    </div> : <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e6dfd3', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left' }}>Volunteer</th>
          {MONTHS.map(m => <th key={m} style={th}>{m}</th>)}
          <th style={{ ...th, color: GOLD }}>Total</th><th style={th}>Shifts</th>
        </tr></thead>
        <tbody>
          {shown.map(p => <React.Fragment key={p.name}>
            <tr onClick={() => setOpen(open === p.name ? '' : p.name)} style={{ cursor: 'pointer', background: open === p.name ? '#fbf8f2' : 'transparent' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{open === p.name ? '▾' : '▸'} {p.name}{p.team && <div style={{ fontWeight: 400, fontSize: 11, color: '#8a7e6b', marginLeft: 14 }}>{p.team}</div>}</td>
              {p.months.map((m, i) => <td key={i} style={{ ...td, color: m ? '#33302b' : '#d4cbb8' }}>{m ? hrs(m) : '·'}</td>)}
              <td style={{ ...td, fontWeight: 700, color: GOLD }}>{hrs(p.total)}</td>
              <td style={td}>{p.count}</td>
            </tr>
            {open === p.name && <tr><td colSpan={15} style={{ padding: '4px 14px 14px 30px', background: '#fbf8f2', borderBottom: '1px solid #f0ebe2' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}><tbody>
                {p.shifts.map((s, i) => <tr key={i}>
                  <td style={{ padding: '3px 18px 3px 0', color: '#33302b' }}>{when(s.start)}</td>
                  <td style={{ padding: '3px 18px 3px 0', color: '#6b5d4a' }}>{clock(s.start)} – {clock(s.end)}</td>
                  <td style={{ padding: '3px 18px 3px 0', fontWeight: 600 }}>{hrs(s.hours)} hr</td>
                  <td style={{ padding: '3px 0', color: '#8a7e6b' }}>{s.duty}</td>
                </tr>)}
              </tbody></table>
            </td></tr>}
          </React.Fragment>)}
          <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>All shown</td>{monthTotals.map((m, i) => <td key={i} style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{m ? hrs(m) : '·'}</td>)}<td style={{ ...td, fontWeight: 700, color: GOLD, borderBottom: 'none' }}>{hrs(totalHours)}</td><td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{totalShifts}</td></tr>
        </tbody>
      </table>
    </div>}
  </div>;
}
