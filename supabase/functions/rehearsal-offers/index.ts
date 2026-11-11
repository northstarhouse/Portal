// Automated wedding rehearsal offer (runs daily from cron; see migrations_manual/venue_rehearsals.sql).
// Three calendar months before each confirmed wedding, it checks whether the day before is free. If it is, and a current
// Rehearsal price is set in Policies & Resources, the couple gets the offer email and their client page shows
// "Add Rehearsal to My Wedding". Weddings only. One offer per wedding, never repeated.
// If the date is not free (or availability is uncertain), nothing is sent; it is checked again each day for a few days in
// case a soft hold is released. A 3-day window covers a missed daily run without emailing every wedding at once.
//
// POST {} (cron)  ·  POST { dry_run: true } lists what would happen without sending or saving anything.
import { addDays, monthsBefore, pacificToday, longDate, money, isConfirmedWedding, rehearsalPricing, rehearsalDateAvailable, coupleOf, brandedEmail, esc } from '../_shared/rehearsal.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PAGE_URL = 'https://venue.northstarhouse.org/';
const WINDOW_DAYS = 3;

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });
  const t = await r.text(); const d = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error((d && (d.message || d.error)) || `Request failed (${r.status})`);
  return d;
}
const log = (action: string, description: string, detail: Record<string, unknown>) => rest('activity_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ action, tag: 'Venue', description, detail }) }).catch(() => {});

// The email, as given by the venue team.
function offerEmail(firsts: string[], date: string, duration: string, cents: number) {
  const hi = firsts.length ? firsts.join(' & ') : 'there';
  const text = `Hi ${hi}!

Your wedding at North Star House is getting closer, and we wanted to let you know that the day before your wedding, ${longDate(date)}, is currently available for a rehearsal!

If you'd like a little extra time at the venue to walk through your ceremony, setup tables & chairs the day before your wedding, or host a rehearsal dinner, you can add this in your client portal.

Rehearsal Details
Date: ${longDate(date)}
Rental duration: ${duration}
Price: ${money(cents)}

Interested? Simply log in to your client portal (${PAGE_URL}) and select Add Rehearsal to My Wedding to request the additional rental.

The North Star House Team`;
  const html = brandedEmail('Your Wedding Rehearsal at North Star House',
    `<p style="margin:0 0 16px;">Hi ${esc(hi)}!</p>`
    + `<p style="margin:0 0 16px;">Your wedding at North Star House is getting closer, and we wanted to let you know that the day before your wedding, <b>${esc(longDate(date))}</b>, is currently available for a rehearsal!</p>`
    + `<p style="margin:0 0 20px;">If you'd like a little extra time at the venue to walk through your ceremony, setup tables &amp; chairs the day before your wedding, or host a rehearsal dinner, you can add this in your client portal.</p>`
    + `<div style="background:#f6f1e7;border-left:3px solid #886c44;padding:14px 18px;margin:0 0 20px;"><div style="font-family:Georgia,serif;font-size:17px;color:#2a2420;margin-bottom:8px;">Rehearsal Details</div>`
    + `<div>Date: <b>${esc(longDate(date))}</b></div><div>Rental duration: <b>${esc(duration)}</b></div><div>Price: <b>${esc(money(cents))}</b></div></div>`
    + `<p style="margin:0 0 16px;">Interested? Simply log in to your client portal and select <b>Add Rehearsal to My Wedding</b> to request the additional rental.</p>`
    + `<p style="margin:0;">The North Star House Team</p>`,
    { text: 'Go to My Client Portal', url: PAGE_URL });
  return { text, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const dry = !!body.dry_run;
  const today = pacificToday();
  const out: any[] = [];
  try {
    // weddings whose offer day (3 calendar months before) was within the last few days
    const upcoming = await rest(`venue_inquiries?select=id,name,email,status,event_type,event_date,prebooking_form_response_id&event_date=gte.${today}&event_date=lte.${addDays(today, 100)}&prebooking_form_response_id=not.is.null`);
    for (const inq of upcoming || []) {
      if (!isConfirmedWedding(inq)) continue;
      const offerDay = monthsBefore(inq.event_date, 3);
      if (!(today >= offerDay && today <= addDays(offerDay, WINDOW_DAYS))) continue;
      const rehearsalDate = addDays(inq.event_date, -1);
      const existing = (await rest(`venue_rehearsals?select=*&inquiry_id=eq.${inq.id}`))?.[0];
      if (existing && existing.status !== 'unavailable') { out.push({ wedding: inq.name, skipped: 'already ' + existing.status }); continue; }

      const pricing = await rehearsalPricing(rest, Number(rehearsalDate.slice(0, 4)));
      if (!pricing) { out.push({ wedding: inq.name, skipped: 'no Rehearsal price set for ' + rehearsalDate.slice(0, 4) + ' in Policies & Resources' }); if (!dry && !existing) await log('rehearsal_offer_skipped', `Rehearsal offer for ${inq.name} not sent: no Rehearsal price set in Policies & Resources`, { inquiry_id: inq.id, rehearsal_date: rehearsalDate }); continue; }

      const avail = await rehearsalDateAvailable(rest, rehearsalDate);
      if (!avail.ok) {
        out.push({ wedding: inq.name, rehearsal_date: rehearsalDate, not_available: avail.reason });
        if (!dry) {
          const row = { inquiry_id: inq.id, wedding_date: inq.event_date, rehearsal_date: rehearsalDate, status: 'unavailable', reason: avail.reason, updated_at: new Date().toISOString() };
          if (existing) await rest(`venue_rehearsals?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify(row) });
          else { await rest('venue_rehearsals', { method: 'POST', body: JSON.stringify(row) }); await log('rehearsal_offer_skipped', `Rehearsal offer for ${inq.name} not sent: ${longDate(rehearsalDate)} is not available (${avail.reason})`, { inquiry_id: inq.id, rehearsal_date: rehearsalDate, reason: avail.reason }); }
        }
        continue;
      }

      const couple = await coupleOf(rest, inq);
      if (!couple.emails.length) { out.push({ wedding: inq.name, skipped: 'no email address' }); continue; }
      const duration = pricing.duration || 'See your client portal';
      out.push({ wedding: inq.name, rehearsal_date: rehearsalDate, send_to: couple.emails, price: money(pricing.cents), duration });
      if (dry) continue;

      // record the offer first (one per wedding), then send
      const row = { inquiry_id: inq.id, wedding_date: inq.event_date, rehearsal_date: rehearsalDate, status: 'offered', reason: null, price_cents: pricing.cents, duration, terms: pricing.terms || null, offered_at: new Date().toISOString(), offer_sent_to: couple.emails, updated_at: new Date().toISOString() };
      if (existing) await rest(`venue_rehearsals?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify(row) });
      else await rest('venue_rehearsals', { method: 'POST', body: JSON.stringify(row) });
      const mail = offerEmail(couple.firsts, rehearsalDate, duration, pricing.cents);
      const r = await fetch(`${URL_}/functions/v1/send-email`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: couple.emails, subject: 'Your Wedding Rehearsal at North Star House', body: mail.text, html: mail.html, fromEmail: 'venue@northstarhouse.org' }) });
      await log(r.ok ? 'rehearsal_offer_sent' : 'rehearsal_offer_failed', r.ok ? `Rehearsal offer sent to ${inq.name} for ${longDate(rehearsalDate)}` : `Rehearsal offer to ${inq.name} could NOT be emailed`, { inquiry_id: inq.id, rehearsal_date: rehearsalDate, to: couple.emails });
    }
    return json({ ok: true, today, dry_run: dry, results: out });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
