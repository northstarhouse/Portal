// Wedding brick: email the couple a reminder to choose their 3 brick lines on their event page. Sent from venue@ in the
// house style and filed in the client's messages.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
const EVENT_PAGE = 'https://venue.northstarhouse.org/';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const esc = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function brickHtml(first, code, by) {
  const p = t => '<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">' + t + '</p>';
  return '<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;">' +
    '<div style="height:14px;background:#886c44;"></div><div style="padding:44px 40px 36px;text-align:center;">' +
    '<h1 style="margin:0 0 24px;font-size:28px;font-weight:400;color:#2a2420;">Your Commemorative Brick</h1>' +
    '<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>' +
    p('Hi ' + esc(first) + ',') +
    p('A friendly reminder: every North Star House wedding includes a personalized commemorative brick, laid on the grounds as a lasting part of the estate. We haven’t received your wording yet.') +
    p('You can choose up to <b>3 lines of up to 20 characters each</b> (letters, numbers and spaces) on your event page' + (code ? ', using your venue code <b>' + esc(code) + '</b>' : '') + '.') +
    '<div style="margin:6px 0 26px;"><a href="' + EVENT_PAGE + '" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;padding:13px 30px;border-radius:4px;">Choose My Brick Wording</a></div>' +
    '<p style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;text-align:left;">Warmly,<br>' + esc(by || 'The North Star House Team') + '<br>North Star House</p>' +
    '<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p>' +
    '</div></div></div>';
}

export function BrickReminderButton({ client }) {
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(null);
  const to = [...new Set([client.email, ...(client.contacts || []).map(c => c.email)].map(e => String(e || '').trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  const names = (client.contacts || []).map(c => String(c.full_name || '').trim().split(/\s+/)[0]).filter(Boolean);
  const first = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : (names[0] || 'there');
  const m = String(client.eventDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const code = m ? MONTHS[+m[2] - 1] + '-' + m[3] + '-' + m[1] : '';
  async function send() {
    if (!to.length) { alert('This client has no email address on file.'); return; }
    if (!window.confirm('Email a brick wording reminder to ' + to.join(' and ') + '?')) return;
    setBusy(true);
    try {
      const by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(r => r.ok ? r.json() : '').catch(() => '');
      const text = 'Hi ' + first + ',\n\nA friendly reminder: every North Star House wedding includes a personalized commemorative brick, laid on the grounds as a lasting part of the estate. We haven’t received your wording yet.\n\nYou can choose up to 3 lines of up to 20 characters each on your event page: ' + EVENT_PAGE + (code ? ' (venue code ' + code + ')' : '') + '.\n\nWarmly,\n' + (by || 'The North Star House Team') + '\nNorth Star House';
      const r = await fetch(SB_URL + '/functions/v1/send-email', { method: 'POST', headers: HDR, body: JSON.stringify({ to: to.length === 1 ? to[0] : to, subject: 'Reminder: Choose Your Commemorative Brick Wording', body: text, html: brickHtml(first, code, by), sender: by || 'North Star House', fromEmail: 'venue@northstarhouse.org' }) });
      if (!r.ok) throw new Error('The email could not be sent. Please try again.');
      const stamp = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/venue_messages', { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: 'client:' + client.id, event_title: client.name, subject: 'Brick wording reminder', body: text, from_name: by || 'North Star House', from_email: 'venue@northstarhouse.org', direction: 'outgoing', handled_at: stamp, handled_by: by || null }) }).catch(() => {});
      setSent(by || 'you');
    } catch (e) { alert(e.message || 'Could not send.'); }
    setBusy(false);
  }
  return <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <button type="button" disabled={busy} onClick={send} style={{ background: '#886c44', color: '#fff', border: 0, borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 12, opacity: busy ? .6 : 1 }}>{busy ? 'Sending…' : 'Send reminder'}</button>
    {sent && <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>✓ Reminder sent to {to.join(' and ')}</span>}
  </div>;
}
