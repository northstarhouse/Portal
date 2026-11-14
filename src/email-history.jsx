// Email history for clients booked in the Portal (new clients): every email the Portal knows was sent to or received from
// the client, newest first. Older HoneyBook clients keep their imported "Original forms, documents & email history" instead.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }); };

export function EmailHistory({ client, api, messages, guideSentAt }) {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => {
    let off = false;
    const H = { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } };
    Promise.all([
      api ? api('list', { response_id: client.id }).catch(() => []) : Promise.resolve([]),
      fetch(SB_URL + '/rest/v1/venue_inquiries?select=questionnaire_sent_at,questionnaire_reminder_2_sent_at,feedback_sent_at&prebooking_form_response_id=eq.' + encodeURIComponent(client.id), H).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([versions, inq]) => {
      if (off) return;
      const out = [];
      if (guideSentAt) out.push({ at: guideSentAt, what: 'Client Guide and Pre-Booking Form', who: client.email || '' });
      (Array.isArray(versions) ? versions : []).forEach(v => {
        const people = {}; (v.recipients || []).forEach(r => { people[r.id] = r; });
        (v.events || []).forEach(e => {
          if (e.action !== 'email_delivery' || !e.detail) return;
          const r = people[e.detail.signer_id] || {};
          const kind = r.role === 'venue' ? 'Countersignature request' : r.status === 'signed' && v.status === 'completed' ? 'Signed agreement copy' : 'Agreement signing link';
          out.push({ at: e.created_at, what: kind + (v.version > 1 ? ' (version ' + v.version + ')' : ''), who: [r.name, r.email].filter(Boolean).join(' · '), failed: e.detail.delivered === false });
        });
      });
      const q = inq && inq[0] || {};
      if (q.questionnaire_sent_at) out.push({ at: q.questionnaire_sent_at, what: 'Event questionnaire', who: client.email || '' });
      if (q.questionnaire_reminder_2_sent_at) out.push({ at: q.questionnaire_reminder_2_sent_at, what: 'Event questionnaire reminder', who: client.email || '' });
      if (q.feedback_sent_at) out.push({ at: q.feedback_sent_at, what: 'Post-event feedback request', who: client.email || '' });
      (messages || []).forEach(m => out.push({ at: m.created_at, what: m.direction === 'outgoing' ? (m.subject && !/^Reply from/i.test(m.subject) ? m.subject : 'Reply from ' + (m.from_name || 'the team')) : 'Message from ' + (m.from_name || 'the client'), who: m.direction === 'outgoing' ? 'Sent to the client' : (m.from_email || ''), incoming: m.direction !== 'outgoing', body: m.body }));
      out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setRows(out);
    });
    return () => { off = true; };
  }, [client.id, (messages || []).length, guideSentAt]);
  if (rows === null) return <p className="vc-muted" style={{ margin: 0 }}>Loading…</p>;
  if (!rows.length) return <p className="vc-muted" style={{ margin: 0 }}>No emails recorded yet.</p>;
  return <div>{rows.map((r, i) => <details key={i} style={{ borderTop: i ? '1px solid #f0ebe2' : 'none', padding: '7px 0' }} open={false}>
    <summary style={{ display: 'flex', gap: 10, alignItems: 'baseline', cursor: r.body ? 'pointer' : 'default', listStyle: 'none', padding: 0, color: 'inherit', fontStyle: 'normal' }}>
      <span style={{ fontSize: 15, width: 18, flexShrink: 0 }} aria-hidden="true">{r.incoming ? '↘' : '↗'}</span>
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, color: r.failed ? '#a64f3c' : '#2a2420' }}>{r.what}{r.failed ? ' (not delivered)' : ''}</b>{r.who ? <span className="vc-muted"> · {r.who}</span> : null}</span>
      <span className="vc-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{when(r.at)}</span>
    </summary>
    {r.body && <div className="vc-note-box" style={{ marginLeft: 28 }}>{r.body}</div>}
  </details>)}</div>;
}
