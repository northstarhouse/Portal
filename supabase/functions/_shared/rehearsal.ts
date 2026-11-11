// Wedding rehearsal offer: shared by rehearsal-offers (the daily automation that emails the offer) and client-pay (the
// client page's "Add Rehearsal to My Wedding"). Both use the same availability check, price lookup and charge, so the
// offer and the confirmation can never disagree.

type Rest = (path: string, init?: RequestInit) => Promise<any>;

export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
// Same day, three calendar months earlier (June 20 -> March 20). Month ends clamp (May 31 -> Feb 28/29).
export function monthsBefore(date: string, months: number) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return ymd(target);
}
export const pacificToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const longDate = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const money = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });

// A confirmed wedding: a submitted pre-booking form, a wedding, not archived.
export const isConfirmedWedding = (inq: any) => !!inq.prebooking_form_response_id && /wedding/i.test(inq.event_type || '') && !/archive|cancel/i.test(inq.status || '');

// The current Rehearsal price, duration and terms from Venue Rentals > Tools > Policies & Resources (pricing entry with
// rental type "Rehearsal", approved, for the rehearsal's year). Nothing is sent if there is no usable price.
export async function rehearsalPricing(rest: Rest, year: number) {
  const rows = await rest(`venue_resources?kind=eq.pricing&status=eq.approved&category=ilike.rehearsal&year=eq.${year}&select=id,title,data&limit=1`).catch(() => []);
  const d = rows?.[0]?.data || {};
  const m = String(d.base_price || '').replace(/,/g, '').match(/^\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
  if (!m) return null;
  const cents = Math.round(parseFloat(m[1]) * 100);
  if (!(cents > 0)) return null;
  return { cents, duration: String(d.included_hours || '').trim(), terms: [d.conditions, d.fees].filter(Boolean).join('\n').trim(), resource_id: rows[0].id };
}

// ICS dates: "20270519" (all day) or "20270519T200000Z" (timed, UTC -> the venue's day).
function icsDay(v: string) {
  const raw = String(v || '').replace(/[^0-9TZ]/g, '');
  if (raw.length === 8) return raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
  const iso = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8) + 'T' + raw.slice(9, 11) + ':' + raw.slice(11, 13) + ':00' + (raw.endsWith('Z') ? 'Z' : '');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Is the venue free on this date for a rehearsal? Anything that might be using the day blocks it: a booked event, a
// confirmed rehearsal, any venue calendar entry (weddings, rehearsals, soft holds, closures, other events), or a public
// website event. Tours and walk-throughs don't block a rental. If the calendar copy is stale, availability is uncertain
// and the answer is no.
export async function rehearsalDateAvailable(rest: Rest, date: string, opts: { ignoreRehearsalId?: string } = {}) {
  const booked = await rest(`venue_inquiries?select=id,event_type,status&event_date=eq.${date}&prebooking_form_response_id=not.is.null`);
  if ((booked || []).some((b: any) => !/archive|cancel/i.test(b.status || ''))) return { ok: false, reason: 'Another booking is on this date' };
  const reh = await rest(`venue_rehearsals?select=id&rehearsal_date=eq.${date}&status=eq.confirmed`);
  if ((reh || []).some((x: any) => x.id !== opts.ignoreRehearsalId)) return { ok: false, reason: 'A rehearsal is already confirmed on this date' };
  const pub = await rest(`site_events?select=id&status=eq.published&start_at=gte.${date}T00:00:00-08:00&start_at=lt.${addDays(date, 1)}T00:00:00-08:00`).catch(() => []);
  if ((pub || []).length) return { ok: false, reason: 'A public event is on this date' };
  const cache = await rest('calendar_events_cache?select=events,updated_at&id=eq.1').catch(() => []);
  const row = cache?.[0];
  if (!row || !Array.isArray(row.events)) return { ok: false, reason: 'Venue calendar unavailable' };
  if (row.updated_at && Date.now() - new Date(row.updated_at).getTime() > 48 * 3600 * 1000) return { ok: false, reason: 'Venue calendar not recently synced' };
  for (const e of row.events) {
    if (/cancel/i.test(e.STATUS || '')) continue;
    if (/\btour|walk.?through|docent/i.test(e.SUMMARY || '')) continue;
    const start = icsDay(e.DTSTART), endRaw = e.DTEND ? icsDay(e.DTEND) : null;
    if (!start) continue;
    // all-day DTEND is exclusive; a timed event covers the days from its start to its end
    const allDay = String(e.DTSTART || '').replace(/[^0-9T]/g, '').length === 8;
    const end = endRaw ? (allDay ? addDays(endRaw, -1) : endRaw) : start;
    if (date >= start && date <= end) return { ok: false, reason: 'On the venue calendar: ' + String(e.SUMMARY || 'an event').replace(/\\,/g, ',') };
  }
  return { ok: true, reason: '' };
}

// The couple's first names and email addresses, from the pre-booking form (or the imported HoneyBook contacts).
export async function coupleOf(rest: Rest, inq: any) {
  const rows = await rest(`nsh_form_responses?select=answers&id=eq.${inq.prebooking_form_response_id}`).catch(() => []);
  const a = rows?.[0]?.answers || {};
  const hbClients = (a.__honeybook?.contacts || []).filter((c: any) => c.kind === 'client');
  const full = [a['7fnabd0i'], a['7leui2ic']].filter(Boolean).length ? [a['7fnabd0i'], a['7leui2ic']].filter(Boolean)
    : hbClients.length ? hbClients.map((c: any) => c.full_name) : String(inq.name || '').split(/\s*(?:&|\band\b)\s*/i);
  const firsts = full.map((n: string) => String(n || '').trim().split(/\s+/)[0]).filter(Boolean).slice(0, 2);
  const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
  const emails = Array.from(new Set([a.c9u1sxb4, a.pt4mail1, ...hbClients.map((c: any) => c.email), inq.email]
    .map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL.test(e))));
  return { firsts, emails, answers: a };
}

// Add the rehearsal to the wedding's invoice as its own labeled payment. Clients on the Portal's payment schedule get a
// schedule row; clients whose invoice came from HoneyBook get an extra charge on their record, which the client page and
// the staff Clients view add to that schedule. Due 30 days before the wedding (or now, if that has passed).
export async function addRehearsalCharge(rest: Rest, inq: any, rehearsal: { date: string; cents: number; id: string }) {
  const label = 'Wedding rehearsal (' + longDate(rehearsal.date) + ')';
  const due = (() => { const d = addDays(inq.event_date, -30); const t = pacificToday(); return d < t ? t : d; })();
  const sched = await rest(`venue_payment_schedule?select=id,sequence,kind&inquiry_id=eq.${inq.id}`);
  if ((sched || []).length) {
    const seq = Math.max(...sched.map((r: any) => r.sequence || 0)) + 1;
    const made = await rest('venue_payment_schedule', { method: 'POST', body: JSON.stringify({ inquiry_id: inq.id, kind: 'rehearsal', sequence: seq, label, amount_cents: rehearsal.cents, amount_paid_cents: 0, due_date: due, status: 'due', non_refundable: false, applies_to_rental: false }) });
    return 'schedule:' + (made?.[0]?.id || seq);
  }
  const rows = await rest(`nsh_form_responses?select=answers&id=eq.${inq.prebooking_form_response_id}`);
  const a = rows?.[0]?.answers || {};
  const list: any[] = Array.isArray(a.__venue_checklist?.extra_charges) ? a.__venue_checklist.extra_charges : [];
  const id = 'rehearsal-' + rehearsal.id;
  if (!list.some((c) => c.id === id)) {
    const answers = { ...a, __venue_checklist: { ...a.__venue_checklist, extra_charges: [...list, { id, label, cents: rehearsal.cents, due, added_at: new Date().toISOString() }] } };
    await rest(`nsh_form_responses?id=eq.${inq.prebooking_form_response_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ answers }) });
  }
  return 'extra:' + id;
}

const GOLD = '#886c44';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
// Same branded look as the client page's other emails.
export function brandedEmail(title: string, paragraphsHtml: string, button?: { text: string; url: string }) {
  return `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:6px;background:${GOLD};"></div><div style="padding:40px 36px;text-align:center;">`
    + `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:${GOLD};font-weight:bold;margin-bottom:14px;">North Star House</div>`
    + `<h1 style="margin:0 0 24px;font-size:28px;font-weight:400;color:#2a2420;">${esc(title)}</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>`
    + `<div style="text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#444;line-height:1.65;">${paragraphsHtml}</div>`
    + (button ? `<div style="margin-top:28px;"><a href="${button.url}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:15px 30px;">${esc(button.text)}</a></div>` : '')
    + `</div></div></div>`;
}
export { esc };
