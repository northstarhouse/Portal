// GENERATED from volunteerhub/src/pages/RsvpPanel.jsx by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.
import { useState, useEffect } from 'react';
import { fetchRsvpForms, fetchRsvpResponses, fetchEventCardMeta, saveEventCardMeta } from '../lib/db.js';

// RSVP setup for an event: mark it as an RSVP event (no ticket sales), tie it to one specific RSVP form, and read that
// form's responses right here. Used on the Events Committee page and on Event Overviews (Hub and Portal).
const DECLINED = /can'?t|cannot|not attending|decline|\bno\b/i;
// "Attending" = 1 person, "Attending +1" = 2, a decline = 0.
const heads = (r) => (DECLINED.test(r.response || '') ? 0 : /\+\s*1|plus/i.test(r.response || '') ? 2 : 1);
const FORM_BASE = 'https://northstarhouse.github.io/NSH-forms/';

export default function RsvpPanel({ eventName, onSaved }) {
  const [meta, setMeta] = useState(null);       // { rsvp_only, rsvp_event_id }
  const [forms, setForms] = useState([]);
  const [responses, setResponses] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let live = true;
    setMeta(null); setResponses(null);
    Promise.all([fetchEventCardMeta(eventName), fetchRsvpForms()]).then(([m, f]) => {
      if (!live) return;
      setMeta({ rsvp_only: !!m?.rsvp_only, rsvp_event_id: m?.rsvp_event_id || null });
      setForms(f);
    }).catch(() => { if (live) setMeta({ rsvp_only: false, rsvp_event_id: null }); });
    return () => { live = false; };
  }, [eventName]);

  useEffect(() => {
    if (!meta?.rsvp_only || !meta.rsvp_event_id) { setResponses(null); return; }
    let live = true;
    fetchRsvpResponses(meta.rsvp_event_id).then(r => { if (live) setResponses(r); }).catch(() => { if (live) setResponses([]); });
    return () => { live = false; };
  }, [meta?.rsvp_only, meta?.rsvp_event_id]);

  async function save(patch) {
    const before = meta;
    setMeta({ ...meta, ...patch }); setSaving(true);
    try { await saveEventCardMeta(eventName, patch); onSaved && onSaved(patch); }
    catch { setMeta(before); alert('Could not save. Please try again.'); }
    setSaving(false);
  }

  if (!meta) return <div style={{ fontSize: 12, color: 'var(--muted, #888)', margin: '14px 0' }}>Loading RSVP settings…</div>;

  const linked = forms.find(f => f.id === meta.rsvp_event_id) || null;
  const norm = (t) => String(t || '').trim().toLowerCase();
  const suggestion = !linked ? forms.find(f => norm(f.title) === norm(eventName)) : null;
  const tally = {};
  (responses || []).forEach(r => { tally[r.response] = (tally[r.response] || 0) + 1; });
  const attending = (responses || []).reduce((n, r) => n + heads(r), 0);
  const gold = '#886c44';

  return (
    <div style={{ border: '0.5px dashed #d8cdb9', borderRadius: 10, background: '#faf8f4', padding: '12px 14px', margin: '14px 0' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={meta.rsvp_only} disabled={saving} onChange={e => save({ rsvp_only: e.target.checked })} style={{ accentColor: gold, width: 15, height: 15 }} />
        RSVP event (no ticket sales)
      </label>

      {meta.rsvp_only && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>RSVP form for this event</div>
          <select value={meta.rsvp_event_id || ''} disabled={saving} onChange={e => save({ rsvp_event_id: e.target.value || null })}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0d8cc', borderRadius: 8, fontSize: 13, background: '#fff' }}>
            <option value="">Not linked to a form yet</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title}{f.date ? ' · ' + new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</option>)}
          </select>
          {suggestion && (
            <button type="button" onClick={() => save({ rsvp_event_id: suggestion.id })} disabled={saving}
              style={{ marginTop: 8, background: '#fff', border: '1px solid ' + gold, color: gold, borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Link “{suggestion.title}” (same name)
            </button>
          )}
          {forms.length === 0 && <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>No RSVP forms exist yet. Create one in the Form Builder (Events, RSVP Event).</div>}

          {linked && (
            <div style={{ marginTop: 14 }}>
              {responses === null ? <div style={{ fontSize: 12, color: '#999' }}>Loading responses…</div> : (
                <>
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div><div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{attending}</div><div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 }}>Attending</div></div>
                    <div><div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{responses.length}</div><div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 }}>Responses</div></div>
                    {Object.keys(tally).map(k => (
                      <div key={k}><div style={{ fontFamily: "'Cardo', Georgia, serif", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{tally[k]}</div><div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{k}</div></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {responses.length > 0 && <button type="button" onClick={() => setShowList(s => !s)} style={{ background: 'none', border: 'none', color: gold, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{showList ? 'Hide' : 'Show'} who responded</button>}
                    {linked.slug && <a href={FORM_BASE + '?e=' + encodeURIComponent(linked.slug)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: gold, textDecoration: 'none', fontWeight: 600 }}>Open the RSVP form ↗</a>}
                  </div>
                  {showList && (
                    <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
                      {responses.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '0.5px solid #eee4d6', fontSize: 13 }}>
                          <span>{r.name}</span>
                          <span style={{ color: DECLINED.test(r.response || '') ? '#a04545' : '#4a5d3a', fontWeight: 600 }}>{r.response}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {responses.length === 0 && <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>No RSVPs yet.</div>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
