// Email history for clients booked in the Portal (new clients): every email the Portal knows was sent to or received from
// the client, newest first. Older HoneyBook clients keep their imported "Original forms, documents & email history" instead.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }); };

const HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
const esc = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NL1 = String.fromCharCode(10), NL2 = NL1 + NL1, NLRE = /(?:\r?\n){2,}/;
const isMail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// A short email to everyone on the client (each contact and the main address), sent from venue@ and filed in their history.
export function ComposeToAll({ client }) {
  const onSent = row => { try { window.dispatchEvent(new CustomEvent('nsh-client-email-sent', { detail: { clientId: client.id, row } })); } catch (_e) { /* history refreshes next time it opens */ } };
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const to = [...new Set([client.email, ...(client.contacts || []).map(c => c.email)].map(e => String(e || '').trim().toLowerCase().replace(/[,()"]/g, '')).filter(isMail))];
  const names = [...new Set((client.contacts || []).map(c => String(c.full_name || '').trim().split(/\s+/)[0]).filter(Boolean))];
  const first = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : (names[0] || 'there');
  const BS = String.fromCharCode(92);
  const GREET = new RegExp('^(hi|hello|hey|dear)' + BS + 'b[^' + String.fromCharCode(10) + ']*' + String.fromCharCode(10) + '+', 'i');
  const cleanText = () => cleanText().replace(GREET, '').trim();
  async function send() {
    if (!to.length) { alert('This client has no email address on file.'); return; }
    if (!subject.trim() || !cleanText()) { alert('Please add a subject and a message.'); return; }
    if (!window.confirm('Send this email to ' + to.join(' and ') + '?')) return;
    setBusy(true);
    try {
      const by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(r => r.ok ? r.json() : '').catch(() => '');
      const plain = 'Hi ' + first + ',' + NL2 + cleanText() + NL2 + 'Warmly,' + NL1 + (by || 'The North Star House Team') + NL1 + 'North Star House';
      const p = t => '<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">' + t + '</p>';
      const html = '<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:#886c44;"></div><div style="padding:40px;text-align:center;">'
        + '<h1 style="margin:0 0 24px;font-size:26px;font-weight:400;color:#2a2420;">' + esc(subject.trim()) + '</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>'
        + p('Hi ' + esc(first) + ',') + cleanText().split(NLRE).map(x => p(esc(x).split(NL1).join('<br>'))).join('')
        + '<p style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;text-align:left;">Warmly,<br>' + esc(by || 'The North Star House Team') + '<br>North Star House</p>'
        + '<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p></div></div></div>';
      const r = await fetch(SB_URL + '/functions/v1/send-email', { method: 'POST', headers: HDR, body: JSON.stringify({ to: to.length === 1 ? to[0] : to, subject: subject.trim(), body: plain, html, sender: by || 'North Star House', fromEmail: 'venue@northstarhouse.org' }) });
      if (!r.ok) throw new Error('The email could not be sent. Please try again.');
      const stamp = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/venue_messages', { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: 'client:' + client.id, event_title: client.name, subject: subject.trim(), body: plain, from_name: by || 'North Star House', from_email: 'venue@northstarhouse.org', direction: 'outgoing', handled_at: stamp, handled_by: by || null }) }).catch(() => {});
      onSent({ at: stamp, what: subject.trim(), who: 'Sent to ' + to.join(', '), body: plain });
      setSubject(''); setText(''); setOpen(false);
    } catch (e) { alert(e.message || 'Could not send.'); }
    setBusy(false);
  }
  const box = { width: '100%', boxSizing: 'border-box', border: '1px solid #e0d8cc', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 };
  return <>
    <button type="button" onClick={() => setOpen(true)} title="Email everyone on this client" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', color: '#886c44', border: '0.5px solid #886c44', borderRadius: 8, padding: '7px 14px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Send email</button>
    {open && <div onClick={() => { if (!busy) setOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,15,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', textAlign: 'left' }}>
        <div style={{ background: '#faf6ef', border: '1px solid #e8e0d5', borderRadius: 8, padding: 12 }}>
        <div className="vc-muted" style={{ marginBottom: 8 }}>To everyone on the list: <b>{to.join(', ') || 'no email on file'}</b>. Sent from venue@northstarhouse.org; replies come back to the venue inbox.</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={box} />
        <div style={{ fontSize: 13, color: '#555', background: '#efe8da', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>Added automatically: <b>Hi {first},</b> at the top. Do not type the greeting yourself.</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Write only the message itself." style={{ ...box, resize: 'vertical' }} />
        <div style={{ fontSize: 13, color: '#555', background: '#efe8da', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>Added automatically: <b>Warmly,</b> your name, North Star House. Do not type a sign-off yourself.</div>
        <button type="button" disabled={busy} onClick={send} style={{ background: '#886c44', color: '#fff', border: 0, borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 12, opacity: busy ? .6 : 1 }}>{busy ? 'Sending…' : 'Send to everyone'}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} style={{ marginLeft: 8, background: 'none', border: '1px solid #e0d8cc', borderRadius: 7, padding: '7px 14px', fontSize: 12, color: '#886c44' }}>Cancel</button>
      </div>
      </div>
    </div>}
  </>;
}

export function EmailHistory({ client, api, messages, guideSentAt, onHandleMessage }) {
  const [extra, setExtra] = React.useState([]);
  React.useEffect(() => {
    const on = e => { if (e.detail && e.detail.clientId === client.id) setExtra(x => [e.detail.row, ...x]); };
    window.addEventListener('nsh-client-email-sent', on);
    return () => window.removeEventListener('nsh-client-email-sent', on);
  }, [client.id]);
  return <div><EmailList client={client} api={api} messages={messages} guideSentAt={guideSentAt} onHandleMessage={onHandleMessage} extra={extra} /></div>;
}

function EmailList({ client, api, messages, guideSentAt, onHandleMessage, extra }) {
  const [rows0, setRows] = React.useState(null);
  const rows = rows0 === null ? null : [...extra, ...rows0].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  // Replying to a client's message from right here: sent from venue@ (replies come back to the venue inbox), filed in their history,
  // and the original message is marked handled by the person who replied. Same as the Messages tab.
  const [replyFor, setReplyFor] = React.useState(null), [replyText, setReplyText] = React.useState(''), [replySending, setReplySending] = React.useState(false);
  const detailsRefs = React.useRef({}), boxRefs = React.useRef({});
  const startReply = r => { setReplyFor(r.id); };
  // Opening the reply area (from the Reply button or the NEEDS REPLY badge) opens the message, scrolls to the box and puts the cursor in it.
  React.useEffect(() => {
    if (replyFor == null) return;
    const d = detailsRefs.current[replyFor]; if (d) d.open = true;
    const b = boxRefs.current[replyFor];
    if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); const ta = b.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); }
  }, [replyFor]);
  async function sendReply(r) {
    const text = replyText.trim();
    if (!text) { alert('Write a reply first.'); return; }
    setReplySending(true);
    try {
      let by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(x => x.ok ? x.json() : '').catch(() => '');
      by = String(by || '').trim();
      if (!by) { by = String(window.prompt('Your name, for the signature on the reply?') || '').trim(); if (!by) { setReplySending(false); return; } }
      const subject = /^re:/i.test(r.msgSubject || '') ? r.msgSubject : 'Re: ' + (r.msgSubject || 'Your message to North Star House');
      const plain = text + '\n\n' + by + '\nNorth Star House';
      const p = t => '<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">' + t + '</p>';
      const html = text.split(new RegExp('(?:\\r?\\n){2,}')).map(x => p(esc(x).split(String.fromCharCode(10)).join('<br>'))).join('') + p(esc(by) + '<br>North Star House');
      const res = await fetch(SB_URL + '/functions/v1/send-email', { method: 'POST', headers: HDR, body: JSON.stringify({ to: r.fromEmail, subject, body: plain, html, sender: by, fromEmail: 'venue@northstarhouse.org' }) });
      if (!res.ok) throw new Error('The email could not be sent. Please try again.');
      const stamp = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/venue_messages', { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: r.eventUid || ('client:' + client.id), event_title: r.eventTitle || client.name, subject: 'Reply from ' + by, body: text, from_name: by, from_email: 'venue@northstarhouse.org', direction: 'outgoing', handled_at: stamp, handled_by: by }) }).catch(() => {});
      if (onHandleMessage && r.unhandled) { try { await onHandleMessage(r.id, by); } catch (_e) { /* the reply is sent and filed either way */ } }
      try { window.dispatchEvent(new CustomEvent('nsh-client-email-sent', { detail: { clientId: client.id, row: { at: stamp, what: 'Reply from ' + by, who: 'Sent to ' + r.fromEmail, body: text } } })); } catch (_e) { /* shows up when the history reloads */ }
      setReplyFor(null); setReplyText('');
    } catch (e) { alert(e.message || 'Could not send the reply.'); }
    setReplySending(false);
  }
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
      if (client.portalEmail && client.portalEmail.sent_at) out.push({ at: client.portalEmail.sent_at, what: 'Client portal access and venue code', who: (client.portalEmail.to || []).join(', ') || client.email || '' });
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
      (messages || []).forEach(m => out.push({ at: m.created_at, what: m.direction === 'outgoing' ? (m.subject && !/^Reply from/i.test(m.subject) ? m.subject : 'Reply from ' + (m.from_name || 'the team')) : 'Message from ' + (m.from_name || 'the client'), who: m.direction === 'outgoing' ? 'Sent to the client' : (m.from_email || ''), incoming: m.direction !== 'outgoing', fromName: m.from_name, fromEmail: m.from_email, msgSubject: m.subject, eventUid: m.event_uid, eventTitle: m.event_title, body: m.body, id: m.id, unhandled: m.direction !== 'outgoing' && !m.handled_at, handledBy: m.handled_by, note: m.handled_note }));
      out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setRows(out);
    });
    return () => { off = true; };
  }, [client.id, (messages || []).map(m => m.id + (m.handled_at || '')).join(), guideSentAt]);
  if (rows === null) return <p className="vc-muted" style={{ margin: 0 }}>Loading…</p>;
  if (!rows.length) return <p className="vc-muted" style={{ margin: 0 }}>No emails recorded yet.</p>;
  return <div><div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#777', marginBottom: 8 }}><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#c9ad7a', marginRight: 5, verticalAlign: 'middle' }}/>From North Star House</span><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8fae8f', marginRight: 5, verticalAlign: 'middle' }}/>From the client</span></div>{rows.map((r, i) => <details key={i} ref={el => { if (el && r.id != null) detailsRefs.current[r.id] = el; }} style={{ borderLeft: '3px solid ' + (r.incoming ? '#8fae8f' : '#c9ad7a'), background: r.incoming ? '#f3f7f2' : '#faf6ef', borderRadius: 6, padding: '8px 12px', marginTop: i ? 6 : 0 }} open={!!r.unhandled}>
    <summary style={{ display: 'flex', gap: 10, alignItems: 'baseline', cursor: r.body ? 'pointer' : 'default', listStyle: 'none', padding: 0, color: 'inherit', fontStyle: 'normal' }}>
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 700, color: r.failed ? '#a64f3c' : r.incoming ? '#4f6b52' : '#886c44' }}>{r.what}{r.failed ? ' (not delivered)' : ''}</b>{r.who ? <span className="vc-muted"> · {r.who}</span> : null}{r.unhandled ? <span role="button" title="Click to reply" onClick={e => { if (!r.fromEmail) return; e.preventDefault(); e.stopPropagation(); startReply(r); }} style={{ marginLeft: 8, background: '#c0392b', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10.5, fontWeight: 700, cursor: r.fromEmail ? 'pointer' : 'default' }}>NEEDS REPLY</span> : r.incoming && r.handledBy ? <span className="vc-muted"> · handled by {r.handledBy}</span> : null}</span>
      <span className="vc-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{when(r.at)}</span>
    </summary>
    {r.body && <div className="vc-note-box" style={{ background: '#fff' }}>{r.body}</div>}{r.note && <div className="vc-muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}><strong>Notes:</strong> {r.note}</div>}{r.incoming && <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{r.fromEmail && <button type="button" onClick={() => startReply(r)} style={{ border: '1px solid #e0d8cc', borderRadius: 6, padding: '5px 10px', background: '#fff', color: '#886c44', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Reply</button>}{r.unhandled && onHandleMessage && <button type="button" onClick={() => { const who = window.prompt('Handled by (Jen, Derek or Haley)?'); if (who && /^(jen|derek|haley)$/i.test(who.trim())) onHandleMessage(r.id, who.trim().charAt(0).toUpperCase() + who.trim().slice(1).toLowerCase()); else if (who) alert('Please enter Jen, Derek or Haley.'); }} style={{ border: '1px solid #e0d8cc', borderRadius: 6, padding: '5px 10px', background: '#fff', color: '#886c44', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Mark handled</button>}</div>}{replyFor === r.id && <div ref={el => { if (el) boxRefs.current[r.id] = el; }} style={{ marginTop: 10, background: '#fff', border: '1px solid #e0d8cc', borderRadius: 8, padding: 12 }}><div className="vc-muted" style={{ marginBottom: 6 }}>Reply to <b>{r.fromName || r.fromEmail}</b> ({r.fromEmail}). Sent from venue@northstarhouse.org; their answer comes back to the venue inbox. Write your own greeting, none is added.</div><textarea rows={5} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your reply…" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0d8cc', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, resize: 'vertical' }} /><button type="button" disabled={replySending} onClick={() => sendReply(r)} style={{ background: '#886c44', color: '#fff', border: 0, borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 12, opacity: replySending ? .6 : 1, cursor: 'pointer' }}>{replySending ? 'Sending…' : 'Send reply'}</button><button type="button" disabled={replySending} onClick={() => { setReplyFor(null); setReplyText(''); }} style={{ marginLeft: 8, background: 'none', border: '1px solid #e0d8cc', borderRadius: 7, padding: '7px 14px', fontSize: 12, color: '#886c44', cursor: 'pointer' }}>Cancel</button></div>}
  </details>)}</div>;
}
