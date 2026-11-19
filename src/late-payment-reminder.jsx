// Past-due payment: email the couple a late payment reminder with a link to their client portal and their venue code.
// Sent by hand from the payment's step on the client timeline (nothing sends automatically). Sent from venue@ in the
// house style and filed in the client's messages, which is also how "last reminder sent" is shown.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
const PORTAL = 'https://venue.northstarhouse.org/';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const SUBJECT = 'Payment reminder from North Star House';
const esc = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = cents => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };

function reminderHtml(first, amt, due, code) {
  const p = t => '<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#444;">' + t + '</p>';
  return '<div style="background:#f7f3ec;padding:32px 16px;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d5;border-radius:14px;overflow:hidden;">' +
    '<div style="height:14px;background:#886c44;"></div><div style="padding:32px 36px;">' +
    '<h1 style="margin:0 0 16px;font-family:Cardo,Georgia,serif;font-size:22px;font-weight:700;color:#2a2a2a;">Payment reminder</h1>' +
    p('Hi ' + esc(first) + ',') +
    p('A quick reminder that your North Star House payment of <strong>' + esc(amt) + '</strong> was due on <strong>' + esc(due) + '</strong>. When you have a moment, please use the link below to make your payment.') +
    '<div style="text-align:center;margin:4px 0 14px;"><a href="' + PORTAL + '" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Pay your invoice on your client portal</a></div>' +
    (code ? '<p style="margin:0 0 6px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#888;">Your venue code (your event date):</p>' +
      '<p style="margin:0 0 22px;text-align:center;"><span style="display:inline-block;background:#f7f3ec;border:1px solid #e0d8cc;border-radius:8px;padding:10px 22px;font-family:Cardo,Georgia,serif;font-size:20px;letter-spacing:2px;color:#2a2a2a;">' + esc(code) + '</span></p>' : '') +
    p('If you have any questions or need help accessing your invoice, just reply to this email and we’ll be happy to help.') +
    '<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#444;">Thanks,<br>The North Star House Venue Team</p>' +
    '</div></div></div>';
}

export function LatePaymentReminderButton({ client, payment }) {
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState(null); // { at, by } of the latest reminder for this payment
  const to = [...new Set([client.email, ...(client.contacts || []).map(c => c.email)].map(e => String(e || '').trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  const names = (client.contacts || []).map(c => String(c.full_name || '').trim().split(/\s+/)[0]).filter(Boolean);
  const first = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : (names[0] || String(client.name || '').trim().split(/\s+/)[0] || 'there');
  const m = String(client.eventDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const code = m ? MONTHS[+m[2] - 1] + '-' + m[3] + '-' + m[1] : '';
  const amt = money(payment.cents || 0), due = longDate(payment.due);
  const tag = 'Late payment reminder: ' + payment.label + ' (' + due + ')';
  React.useEffect(() => {
    fetch(SB_URL + '/rest/v1/venue_messages?select=handled_at,handled_by&event_uid=eq.' + encodeURIComponent('client:' + client.id) + '&subject=eq.' + encodeURIComponent(tag) + '&order=handled_at.desc&limit=1', { headers: HDR })
      .then(r => r.ok ? r.json() : []).then(rows => { if (rows && rows[0]) setLast({ at: rows[0].handled_at, by: rows[0].handled_by }); }).catch(() => {});
  }, [client.id, tag]);
  async function send() {
    if (!to.length) { alert('This client has no email address on file.'); return; }
    if (!window.confirm('Email a late payment reminder for ' + payment.label + ' (' + amt + ', due ' + due + ') to ' + to.join(' and ') + '?')) return;
    setBusy(true);
    try {
      const by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(r => r.ok ? r.json() : '').catch(() => '');
      const text = 'Hi ' + first + ',\n\nA quick reminder that your North Star House payment of ' + amt + ' was due on ' + due + '. When you have a moment, please use the link below to make your payment.\n\nPay your invoice on your client portal: ' + PORTAL + (code ? '\nYour venue code: ' + code : '') + '\n\nIf you have any questions or need help accessing your invoice, just reply to this email and we’ll be happy to help.\n\nThanks,\nThe North Star House Venue Team';
      const r = await fetch(SB_URL + '/functions/v1/send-email', { method: 'POST', headers: HDR, body: JSON.stringify({ to: to.length === 1 ? to[0] : to, subject: SUBJECT, body: text, html: reminderHtml(first, amt, due, code), sender: 'Venue Team', fromEmail: 'venue@northstarhouse.org' }) });
      if (!r.ok) throw new Error('The email could not be sent. Please try again.');
      const stamp = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/venue_messages', { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: 'client:' + client.id, event_title: client.name, subject: tag, body: text, from_name: 'Venue Team', from_email: 'venue@northstarhouse.org', direction: 'outgoing', handled_at: stamp, handled_by: by || null }) }).catch(() => {});
      setLast({ at: stamp, by: by || null });
    } catch (e) { alert(e.message || 'Could not send.'); }
    setBusy(false);
  }
  return <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <button type="button" disabled={busy} onClick={send} style={{ background: '#b3402a', color: '#fff', border: 0, borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 12, opacity: busy ? .6 : 1 }}>{busy ? 'Sending…' : last ? 'Send another reminder' : 'Send late payment reminder'}</button>
    {last && <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>✓ Reminder sent {new Date(last.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{last.by ? ' by ' + last.by : ''}</span>}
  </div>;
}
