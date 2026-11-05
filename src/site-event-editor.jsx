// Admin > New Event: add an event to the website. Events live in public.site_events (the website reads published ones live).
// Writes go through the site-events-admin edge function, which checks the Portal sign-in. New events save as a draft
// (not on the website) until Publish is pressed.
import React from 'react';
import { MediaPicker } from './media-library.jsx';
const GOLD = '#886c44';
const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
const label = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#888', marginBottom: 14 };
const card = { background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 12, padding: '18px 20px', marginBottom: 16 };
const heading = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 };

const blank = () => ({
  id: '', slug: '', title: '', short_description: '', description: '', image_url: '', image_alt: '',
  date: '', start_time: '18:00', end_time: '', date_tbd: false,
  location_name: 'North Star House', location_address: '12075 Auburn Rd, Grass Valley, CA 95949, USA',
  registration_type: 'NONE', ticket_tiers: [{ name: 'General Admission', price: '', limit: '' }], ticket_limit_per_order: '20',
});

export function NewSiteEventPage({ navigate, supabaseUrl, supabaseKey }) {
  const [f, setF] = React.useState(blank);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [picker, setPicker] = React.useState(false);
  // The web address follows the title until the team types their own.
  const [slugTouched, setSlugTouched] = React.useState(false);
  const slugify = (v) => String(v || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const [events, setEvents] = React.useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const setTier = (i, k, v) => setF((o) => ({ ...o, ticket_tiers: o.ticket_tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const call = (body) => fetch(supabaseUrl + '/functions/v1/site-events-admin', {
    method: 'POST', headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok || j.error) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; }));

  const loadEvents = React.useCallback(() => { call({ action: 'list' }).then((j) => setEvents(j.events || [])).catch(() => setEvents([])); }, []);
  React.useEffect(() => { loadEvents(); }, [loadEvents]);

  function save(status) {
    if (busy) return;
    if (status === 'published' && !window.confirm('Publish this event? It goes on the website right away.')) return;
    setBusy(true); setMsg(null);
    call({ action: 'save', event: { ...f, status } })
      .then((j) => {
        set('id', j.event.id);
        setMsg({ ok: true, text: status === 'published' ? 'Published. It is on the website' + (j.refreshed ? '.' : ' (the site can take a few minutes to show it).') : 'Saved as a draft. It is not on the website yet.' });
        loadEvents();
      })
      .catch((e) => setMsg({ ok: false, text: e.message }))
      .finally(() => setBusy(false));
  }

  const ticketed = f.registration_type === 'TICKETING';
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Add an event to the website. It saves as a draft first, so nothing is public until you press Publish. When an event ends it comes off the website by itself.</div>

      <div style={card}>
        <div style={heading}>The event</div>
        <label style={label}>Title *<input style={input} value={f.title} onChange={(e) => { const v = e.target.value; setF((o) => ({ ...o, title: v, slug: slugTouched ? o.slug : slugify(v) })); }} placeholder="e.g. Holiday Open House" /></label>
        <label style={label}>Web address (the last part of the event's link)<input style={input} value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} placeholder="holiday-open-house" /><span style={{ fontSize: 11, color: '#aaa' }}>Letters, numbers and dashes only. It fills in from the title unless you type your own.{f.id ? ' Changing it after the event is published breaks links people already have.' : ''}</span></label>
        <label style={label}>Short description (shown in lists and when shared)<input style={input} maxLength={300} value={f.short_description} onChange={(e) => set('short_description', e.target.value)} placeholder="One or two sentences" /></label>
        <label style={label}>Full description<textarea style={{ ...input, minHeight: 130, resize: 'vertical' }} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={'Write it like an email. A blank line starts a new paragraph.\nStart a line with "- " to make a bullet list.'} /></label>
        <div style={{ ...label, marginBottom: 0 }}>Photo
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {f.image_url ? <img src={f.image_url} alt="" style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 8, border: '0.5px solid #e0d8cc' }} /> : <img src="assets/event-placeholder.png" alt="" style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 8, border: '0.5px solid #e0d8cc', opacity: 0.85 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setPicker(true)} style={{ background: '#fff', color: GOLD, border: '1px solid ' + GOLD, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{f.image_url ? 'Change photo' : 'Choose a photo'}</button>
                {!f.image_url && <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>No photo? The website shows "More information to come".</span>}
                {f.image_url && <button type="button" onClick={() => { set('image_url', ''); set('image_alt', ''); }} style={{ background: 'none', color: '#888', border: 'none', fontSize: 13, cursor: 'pointer' }}>Remove</button>}
              </div>
              <input style={input} value={f.image_alt} onChange={(e) => set('image_alt', e.target.value)} placeholder="Describe the photo (for screen readers)" />
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={heading}>When and where</div>
        <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8, color: '#555', fontSize: 13 }}><input type="checkbox" checked={f.date_tbd} onChange={(e) => set('date_tbd', e.target.checked)} /> Date to be announced</label>
        {!f.date_tbd && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ ...label, flex: '1 1 150px' }}>Date<input type="date" style={input} value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label style={{ ...label, flex: '1 1 120px' }}>Starts (Pacific time)<input type="time" style={input} value={f.start_time} onChange={(e) => set('start_time', e.target.value)} /></label>
            <label style={{ ...label, flex: '1 1 120px' }}>Ends (optional)<input type="time" style={input} value={f.end_time} onChange={(e) => set('end_time', e.target.value)} /></label>
          </div>
        )}
        <label style={label}>Location<input style={input} value={f.location_name} onChange={(e) => set('location_name', e.target.value)} /></label>
        <label style={{ ...label, marginBottom: 0 }}>Address<input style={input} value={f.location_address} onChange={(e) => set('location_address', e.target.value)} /></label>
      </div>

      <div style={card}>
        <div style={heading}>Tickets</div>
        <label style={label}>Does this event sell tickets?
          <select style={input} value={f.registration_type} onChange={(e) => set('registration_type', e.target.value)}>
            <option value="NONE">No, just list the event</option>
            <option value="TICKETING">Yes, sell tickets online</option>
          </select>
        </label>
        {ticketed && (
          <div>
            {f.ticket_tiers.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label style={{ ...label, flex: '2 1 160px', marginBottom: 0 }}>Ticket name<input style={input} value={t.name} onChange={(e) => setTier(i, 'name', e.target.value)} /></label>
                <label style={{ ...label, flex: '1 1 90px', marginBottom: 0 }}>Price ($)<input style={input} inputMode="decimal" value={t.price} onChange={(e) => setTier(i, 'price', e.target.value)} placeholder="0 = free" /></label>
                <label style={{ ...label, flex: '1 1 90px', marginBottom: 0 }}>Max per order<input style={input} inputMode="numeric" value={t.limit} onChange={(e) => setTier(i, 'limit', e.target.value)} placeholder="50" /></label>
                {f.ticket_tiers.length > 1 && <button type="button" onClick={() => set('ticket_tiers', f.ticket_tiers.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#b3402a', fontSize: 18, cursor: 'pointer', paddingBottom: 6 }}>×</button>}
              </div>
            ))}
            <button type="button" onClick={() => set('ticket_tiers', [...f.ticket_tiers, { name: '', price: '', limit: '' }])} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 4 }}>+ Add another ticket type</button>
          </div>
        )}
      </div>

      {msg && <div style={{ fontSize: 13, marginBottom: 12, color: msg.ok ? '#2e7d32' : '#b3402a' }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <button type="button" disabled={busy} onClick={() => save('draft')} style={{ background: '#fff', color: GOLD, border: '1px solid ' + GOLD, borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save as draft'}</button>
        <button type="button" disabled={busy} onClick={() => save('published')} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Publish to website</button>
        {f.id && <button type="button" onClick={() => { setF(blank()); setSlugTouched(false); setMsg(null); }} style={{ background: 'none', color: '#888', border: 'none', fontSize: 14, cursor: 'pointer' }}>Start another event</button>}
      </div>

      <div style={heading}>Events on the website</div>
      <div style={{ ...card, padding: 0 }}>
        {events === null && <div style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Loading…</div>}
        {events && !events.length && <div style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No events yet.</div>}
        {(events || []).map((ev, i) => (
          <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '11px 16px', borderTop: i ? '0.5px solid #f0ebe0' : 'none', fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#2a2a2a' }}>{ev.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{ev.date_tbd ? 'Date to be announced' : ev.start_at ? new Date(ev.start_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : 'No date'}</div>
            </div>
            <span style={{ alignSelf: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 9px', borderRadius: 20, color: ev.status === 'published' ? '#2e7d32' : '#6b7280', background: ev.status === 'published' ? '#e8f5e9' : '#f3f4f6' }}>{ev.status === 'published' ? 'Published' : ev.status === 'archived' ? 'Ended' : 'Draft'}</span>
          </div>
        ))}
      </div>

      {picker && <MediaPicker supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} onPick={(img) => { set('image_url', img.url); if (img.alt && !f.image_alt) set('image_alt', img.alt); setPicker(false); }} onClose={() => setPicker(false)} />}
    </div>
  );
}
