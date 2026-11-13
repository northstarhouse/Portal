// "Request more details": checks a client's pre-booking form for what's missing (full legal names, the second signer for
// weddings, a complete mailing address, etc.), lets staff adjust the note, and emails the client from venue@ in the
// house style. The email is filed in the client's messages so everyone can see it went out.
const SB_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co', SB_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const clean = v => String(v || '').trim();
const fullName = v => clean(v).split(/\s+/).filter(w => /[a-z]/i.test(w)).length >= 2;
const fullAddress = v => /\d{5}/.test(clean(v)) && clean(v).split(',').length >= 2;

export function missingPrebookingItems(client) {
  const a = client?.sub?.answers || {};
  const items = [];
  const isWedding = /wedding/i.test(client?.type || '') || 'c9u1sxb4' in a;
  if ('7fnabd0i' in a || 'c9u1sxb4' in a) {
    // Wedding pre-booking form: Primary Signer + Secondary Signer.
    if (!fullName(a['7fnabd0i'])) items.push({ id: 'p-name', text: 'The full legal name (first and last) of the Primary Signer' + (clean(a['7fnabd0i']) ? ' — we only have "' + clean(a['7fnabd0i']) + '"' : '') });
    if (!clean(a['163otrai'])) items.push({ id: 'p-phone', text: 'A phone number for the Primary Signer' });
    if (!fullAddress(a.ps4addr1)) items.push({ id: 'p-addr', text: 'A complete mailing address for the Primary Signer, including city, state and ZIP' + (clean(a.ps4addr1) ? ' — we have "' + clean(a.ps4addr1) + '"' : '') });
    if (isWedding) {
      if (!clean(a['7leui2ic'])) items.push({ id: 's-all', text: 'The Secondary Signer’s details: full legal name, their own email address (different from the Primary Signer’s), phone number and mailing address. For weddings, both members of the couple sign the agreement.' });
      else {
        if (!fullName(a['7leui2ic'])) items.push({ id: 's-name', text: 'The full legal name (first and last) of the Secondary Signer — we only have "' + clean(a['7leui2ic']) + '"' });
        const se = clean(a.pt4mail1).toLowerCase();
        if (!se) items.push({ id: 's-email', text: 'An email address for the Secondary Signer' });
        else if (se === clean(a.c9u1sxb4).toLowerCase()) items.push({ id: 's-email', text: 'A separate email address for the Secondary Signer (each signer gets their own signing link, so it must be different from the Primary Signer’s)' });
        if (!clean(a.pt4phon1)) items.push({ id: 's-phone', text: 'A phone number for the Secondary Signer' });
        if (!fullAddress(a.pt4addr1) && !fullAddress(a.ps4addr1)) items.push({ id: 's-addr', text: 'A mailing address for the Secondary Signer, including city, state and ZIP (it can be the same as the Primary Signer’s)' });
      }
    }
    if (!clean(a.sn9urgfr)) items.push({ id: 'date', text: 'Your confirmed event date' });
    if (!clean(a.max_guests)) items.push({ id: 'guests', text: 'Your maximum expected guest count' });
  } else if ('evp_name' in a || 'evp_email' in a) {
    // Events pre-booking form: one signer.
    if (!fullName(a.evp_name)) items.push({ id: 'p-name', text: 'The full legal name (first and last) of the person signing the agreement' + (clean(a.evp_name) ? ' — we only have "' + clean(a.evp_name) + '"' : '') });
    if (!clean(a.evp_phone)) items.push({ id: 'p-phone', text: 'A phone number for the person signing the agreement' });
    items.push({ id: 'p-addr', text: 'A mailing address for the person signing the agreement, including city, state and ZIP', optional: true });
    if (!clean(a.evp_date)) items.push({ id: 'date', text: 'Your confirmed event date' });
    if (!clean(a.max_guests)) items.push({ id: 'guests', text: 'Your maximum expected guest count' });
  }
  return items;
}

function esc(t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildHtml(first, intro, items, closing, by) {
  const p = t => '<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">' + esc(t).replace(/\n/g, '<br>') + '</p>';
  const list = items.length ? '<div style="margin:0 0 20px;padding:16px 20px;background:#f7f1e6;border-left:3px solid #886c44;text-align:left;">' +
    items.map(t => '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3a332c;line-height:1.55;margin:6px 0;">&#8226;&nbsp; ' + esc(t) + '</div>').join('') + '</div>' : '';
  return '<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;">' +
    '<div style="height:14px;background:#886c44;"></div><div style="padding:44px 40px 36px;text-align:center;">' +
    '<h1 style="margin:0 0 24px;font-size:28px;font-weight:400;color:#2a2420;">A Few More Details</h1>' +
    '<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>' +
    p('Hi ' + first + ',') + intro.split(/\n{2,}/).map(p).join('') + list + closing.split(/\n{2,}/).map(p).join('') +
    '<p style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;text-align:left;">Warmly,<br>' + esc(by || 'The North Star House Team') + '<br>North Star House</p>' +
    '<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Just reply to this email with the details.</i></p>' +
    '</div></div></div>';
}

const DEFAULT_INTRO = 'Thank you so much for sending in your pre-booking information form! Before we can prepare your official booking agreement, something is missing. We need everything below so the agreement is accurate and each signer receives their own link to sign:';
const DEFAULT_CLOSING = 'Our agreements are legal documents, so we need each signer’s full legal name exactly as it should appear on the contract.\n\nYou can simply reply to this email with the information. Once we have it, we’ll send your agreement right over so you can secure your date.';

export function RequestDetailsButton({ client }) {
  const found = React.useMemo(() => missingPrebookingItems(client), [client]);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(() => Object.fromEntries(found.map(i => [i.id, !i.optional])));
  const [extra, setExtra] = React.useState('');
  const [intro, setIntro] = React.useState(DEFAULT_INTRO);
  const [closing, setClosing] = React.useState(DEFAULT_CLOSING);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(null);
  const a = client?.sub?.answers || {};
  const to = clean(a.c9u1sxb4 || a.evp_email || client.email);
  const signerName = clean(a['7fnabd0i'] || a.evp_name || client.contacts?.[0]?.full_name || client.name);
  const first = signerName.split(/\s+/)[0] || 'there';
  const items = found.filter(i => checked[i.id]).map(i => i.text).concat(extra.split('\n').map(clean).filter(Boolean));

  async function send() {
    if (!to) { alert('This client has no email address on file.'); return; }
    if (!items.length) { alert('Choose at least one thing to ask for.'); return; }
    if (!confirm('Email ' + to + ' asking for ' + items.length + ' item' + (items.length === 1 ? '' : 's') + '?')) return;
    setBusy(true);
    try {
      const by = await fetch(SB_URL + '/rest/v1/rpc/app_session_name', { method: 'POST', headers: HDR, body: '{}' }).then(r => r.ok ? r.json() : '').catch(() => '');
      const text = 'Hi ' + first + ',\n\n' + intro + '\n\n' + items.map(t => '• ' + t).join('\n') + '\n\n' + closing + '\n\nWarmly,\n' + (by || 'The North Star House Team') + '\nNorth Star House';
      const r = await fetch(SB_URL + '/functions/v1/send-email', { method: 'POST', headers: HDR, body: JSON.stringify({ to, subject: 'A Few More Details for Your Booking Agreement', body: text, html: buildHtml(first, intro, items, closing, by), sender: by || 'North Star House', fromEmail: 'venue@northstarhouse.org' }) });
      if (!r.ok) throw new Error('The email could not be sent. Please try again.');
      const stamp = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/venue_messages', { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: 'client:' + client.id, event_title: client.name, subject: 'Requested more pre-booking details', body: text, from_name: by || 'North Star House', from_email: 'venue@northstarhouse.org', direction: 'outgoing', handled_at: stamp, handled_by: by || null }) }).catch(() => {});
      setSent({ at: stamp, by });
      setOpen(false);
    } catch (e) { alert(e.message || 'Could not send.'); }
    setBusy(false);
  }

  const btn = { background: '#886c44', color: '#fff', border: 0, borderRadius: 7, padding: '8px 14px', fontWeight: 600, fontSize: 13 };
  const ta = { width: '100%', boxSizing: 'border-box', border: '1px solid #ded7cb', borderRadius: 7, padding: '8px 10px', font: 'inherit', fontSize: 13, lineHeight: 1.5, background: '#fff' };
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eee7dd' }}>
      <div className="vc-modal-section-title" style={{ fontSize: 15 }}>
        Anything missing?
        {!open && <button type="button" style={btn} onClick={() => setOpen(true)}>Request more detailed information</button>}
      </div>
      {sent && <p style={{ margin: '0 0 8px', color: '#426b4a', fontSize: 13, fontWeight: 600 }}>✓ Request sent to {to}{sent.by ? ' by ' + sent.by : ''}. It's filed in this client's messages.</p>}
      {!open && (found.filter(i => !i.optional).length
        ? <div style={{ fontSize: 13, color: '#9a5d22' }}><b>Missing from the form:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{found.filter(i => !i.optional).map(i => <li key={i.id} style={{ margin: '3px 0' }}>{i.text}</li>)}</ul></div>
        : <p className="vc-muted" style={{ margin: 0 }}>Nothing obviously missing. You can still email the client if something needs clarifying.</p>)}
      {open && <div style={{ display: 'grid', gap: 12 }}>
        <div className="vc-muted">Emails <b>{to || 'no email on file'}</b> from venue@northstarhouse.org. Replies come back to the venue inbox.</div>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Opening<textarea rows={3} style={ta} value={intro} onChange={e => setIntro(e.target.value)} /></label>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>What we need</div>
          {found.length === 0 && <div className="vc-muted" style={{ marginBottom: 6 }}>Nothing found automatically. Add what you need below.</div>}
          {found.map(i => <label key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '5px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checked[i.id]} onChange={e => setChecked(c => ({ ...c, [i.id]: e.target.checked }))} style={{ marginTop: 3 }} />{i.text}</label>)}
          <textarea rows={2} style={{ ...ta, marginTop: 6 }} placeholder="Anything else to ask for (one per line)" value={extra} onChange={e => setExtra(e.target.value)} />
        </div>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Closing<textarea rows={4} style={ta} value={closing} onChange={e => setClosing(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={{ ...btn, opacity: busy ? .6 : 1 }} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send email'}</button>
          <button type="button" style={{ ...btn, background: 'transparent', color: '#886c44', border: '1px solid #886c44' }} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>}
    </div>
  );
}
