// Email history for clients booked in the Portal (new clients): every email the Portal knows was sent to or received from
// the client, newest first. Older HoneyBook clients keep their imported "Original forms, documents & email history" instead.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }); };

export function EmailHistory({ client, api, messages, guideSentAt, onHandleMessage }) {
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
      (messages || []).forEach(m => out.push({ at: m.created_at, what: m.direction === 'outgoing' ? (m.subject && !/^Reply from/i.test(m.subject) ? m.subject : 'Reply from ' + (m.from_name || 'the team')) : 'Message from ' + (m.from_name || 'the client'), who: m.direction === 'outgoing' ? 'Sent to the client' : (m.from_email || ''), incoming: m.direction !== 'outgoing', body: m.body, id: m.id, unhandled: m.direction !== 'outgoing' && !m.handled_at, handledBy: m.handled_by, note: m.handled_note }));
      out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setRows(out);
    });
    return () => { off = true; };
  }, [client.id, (messages || []).map(m => m.id + (m.handled_at || '')).join(), guideSentAt]);
  if (rows === null) return <p className="vc-muted" style={{ margin: 0 }}>Loading…</p>;
  if (!rows.length) return <p className="vc-muted" style={{ margin: 0 }}>No emails recorded yet.</p>;
  return <div><div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#777', marginBottom: 8 }}><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#c9ad7a', marginRight: 5, verticalAlign: 'middle' }}/>From North Star House</span><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8fae8f', marginRight: 5, verticalAlign: 'middle' }}/>From the client</span></div>{rows.map((r, i) => <details key={i} style={{ borderLeft: '3px solid ' + (r.incoming ? '#8fae8f' : '#c9ad7a'), background: r.incoming ? '#f3f7f2' : '#faf6ef', borderRadius: 6, padding: '8px 12px', marginTop: i ? 6 : 0 }} open={!!r.unhandled}>
    <summary style={{ display: 'flex', gap: 10, alignItems: 'baseline', cursor: r.body ? 'pointer' : 'default', listStyle: 'none', padding: 0, color: 'inherit', fontStyle: 'normal' }}>
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 700, color: r.failed ? '#a64f3c' : r.incoming ? '#4f6b52' : '#886c44' }}>{r.what}{r.failed ? ' (not delivered)' : ''}</b>{r.who ? <span className="vc-muted"> · {r.who}</span> : null}{r.unhandled ? <span style={{ marginLeft: 8, background: '#c0392b', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10.5, fontWeight: 700 }}>NEEDS REPLY</span> : r.incoming && r.handledBy ? <span className="vc-muted"> · handled by {r.handledBy}</span> : null}</span>
      <span className="vc-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{when(r.at)}</span>
    </summary>
    {r.body && <div className="vc-note-box" style={{ background: '#fff' }}>{r.body}</div>}{r.note && <div className="vc-muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}><strong>Notes:</strong> {r.note}</div>}{r.unhandled && onHandleMessage && <button type="button" onClick={() => { const who = window.prompt('Handled by (Jen, Derek or Haley)?'); if (who && /^(jen|derek|haley)$/i.test(who.trim())) onHandleMessage(r.id, who.trim().charAt(0).toUpperCase() + who.trim().slice(1).toLowerCase()); else if (who) alert('Please enter Jen, Derek or Haley.'); }} style={{ marginTop: 8, border: '1px solid #e0d8cc', borderRadius: 6, padding: '5px 10px', background: '#fff', color: '#886c44', fontSize: 11, fontWeight: 600 }}>Mark handled</button>}
  </details>)}</div>;
}
