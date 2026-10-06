// Drives the wedding-inquiry pipeline: staged follow-up emails, tour
// confirmations/reminders, and post-tour docs. Invoked on a schedule by
// pg_cron (see supabase-venue-pipeline-cron.sql). Every step is guarded by
// a *_sent_at / status column so re-running this is always safe.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SCHEDULING_BASE_URL = 'https://northstarhouse.github.io/venue/';
const LOGO_URL = 'https://northstarhouse.github.io/venue/assets/logo.png';
const PREBOOKING_FORM_URL = 'https://northstarhouse.github.io/NSH-forms/?view=form&id=a3a383f7-e1db-4344-9dec-ea879ad3406d';
// TODO: replace with the real hosted Client Guidebook URL once provided.
const GUIDEBOOK_URL = 'https://northstarhouse.github.io/venue/';
const AVAILABILITY_CALENDAR_URL = 'https://northstarhouse.github.io/venue/?availability=1';
const QUESTIONNAIRE_FORM_URL = 'https://northstarhouse.github.io/NSH-forms/?view=form&id=e9be06b9-6788-41bc-a78a-28e02b8b749a';
const FEEDBACK_FORM_URL = 'https://northstarhouse.github.io/NSH-forms/?view=form&id=5ebe4961-d50e-47f1-9071-e81c2ada6233';
const TZ = 'America/Los_Angeles';

const headers = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let templateCache: Record<string, { subject: string; body: string; html_body: string }> | null = null;
async function getTemplates() {
  if (templateCache) return templateCache;
  const rows = await rest('venue_email_templates?select=key,subject,body,html_body');
  templateCache = {};
  for (const r of rows) templateCache[r.key] = { subject: r.subject, body: r.body, html_body: r.html_body || '' };
  return templateCache;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ });
}
function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

function escapeHtml(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// ── Branded HTML email shell ────────────────────────────────────────────────
function renderShell(innerHtml: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f7f3ec;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e0d5;">
          <tr><td style="background:#2a2a2e;padding:24px;text-align:center;">
            <img src="${LOGO_URL}" alt="North Star House" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
          </td></tr>
          <tr><td style="padding:32px 36px;font-family:Helvetica,Arial,sans-serif;">
            ${innerHtml}
          </td></tr>
          <tr><td style="background:#f7f3ec;padding:20px 36px;border-top:1px solid #e8e0d5;text-align:center;font-family:Helvetica,Arial,sans-serif;">
            <div style="font-size:11px;color:#999;">North Star House</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// ── Self-scheduling widget: clickable open tour times ───────────────────────
async function fetchOpenSlots(limit = 5) {
  const nowIso = new Date().toISOString();
  const rows = await rest(`venue_tour_availability?select=id,slot_start,venue_tour_hosts(name)&is_booked=eq.false&slot_start=gt.${encodeURIComponent(nowIso)}&order=slot_start.asc&limit=${limit}`);
  return (rows || []).map((r: any) => ({ id: r.id, slot_start: r.slot_start, hostName: r.venue_tour_hosts?.name }));
}

function renderSlotsWidget(inquiryId: number, slots: { id: number; slot_start: string; hostName?: string }[]) {
  const seeAllLink = `${SCHEDULING_BASE_URL}?schedule=${inquiryId}`;
  if (!slots.length) {
    return `<p style="font-size:13px;color:#999;">No open tour times right now — reply to this email and we'll find a time together.</p>`;
  }
  const rows = slots.map((s) => {
    const link = `${SCHEDULING_BASE_URL}?schedule=${inquiryId}&slot=${s.id}`;
    return `<tr><td style="padding:0 0 8px;">
      <a href="${link}" style="display:block;background:#f7f3ec;border:1px solid #e0d8cc;border-radius:10px;padding:12px 16px;text-decoration:none;">
        <span style="font-size:13px;font-weight:700;color:#2a2a2a;">${escapeHtml(fmtDate(s.slot_start))}</span><br/>
        <span style="font-size:12px;color:#666;">${escapeHtml(fmtTime(s.slot_start))} with ${escapeHtml(s.hostName || 'our team')}</span>
      </a>
    </td></tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <p style="margin:14px 0 0;text-align:center;"><a href="${seeAllLink}" style="font-size:12px;color:#886c44;">See all available times →</a></p>`;
}

async function sendEmail(to: string, subject: string, body: string, html?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ to, subject, body, ...(html ? { html } : {}), sender: 'Venue Team' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `send-email HTTP ${res.status}`);
  return data;
}

// Renders both the plain-text and HTML versions of a template. `textVars` are
// substituted as-is into the text body; `htmlVars` are substituted into the
// HTML body (caller is responsible for escaping any free-text values, e.g.
// inquiry name, before passing them here — links/dates built by us are safe raw).
async function sendTemplated(tpl: { subject: string; body: string; html_body: string }, to: string, textVars: Record<string, string>, htmlVars: Record<string, string>) {
  const subject = fillTemplate(tpl.subject, textVars);
  const body = fillTemplate(tpl.body, textVars);
  const html = tpl.html_body ? renderShell(fillTemplate(tpl.html_body, htmlVars)) : undefined;
  return sendEmail(to, subject, body, html);
}

Deno.serve(async (req) => {
  // ── On-demand action: coordinator clicked "Reviewed - Send Proposal" ──
  if (req.method === 'POST') {
    let body: any = {};
    try { body = await req.json(); } catch { /* no body / not JSON */ }
    if (body?.action === 'send_proposal' && body?.inquiryId) {
      try {
        const templates = await getTemplates();
        const rows = await rest(`venue_inquiries?select=*&id=eq.${body.inquiryId}`);
        const inq = rows?.[0];
        if (!inq) return new Response(JSON.stringify({ error: 'Inquiry not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        if (!inq.email) return new Response(JSON.stringify({ error: 'Inquiry has no email address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        await sendTemplated(templates.proposal_sent, inq.email,
          { name: inq.name },
          { name: escapeHtml(inq.name) });

        const nowIso = new Date().toISOString();
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Proposal Sent', proposal_sent_at: nowIso }) });

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const templates = await getTemplates();
  const result: Record<string, number> = { initial: 0, followUp48h: 0, finalFollowUp30d: 0, archived: 0, tourConfirmation: 0, reminder24h: 0, reminder1h: 0, touredDocs: 0, questionnaireReminder: 0, completed: 0, feedbackRequested: 0, feedbackArchived: 0, errors: 0 };

  // ── Step 1: New wedding inquiries -> send initial guide + scheduling widget ──
  try {
    const rows = await rest(`venue_inquiries?select=*&status=eq.New&email=not.is.null`);
    for (const inq of rows) {
      try {
        const link = `${SCHEDULING_BASE_URL}?schedule=${inq.id}`;
        const slots = await fetchOpenSlots();
        const widget = renderSlotsWidget(inq.id, slots);
        await sendTemplated(templates.initial_inquiry, inq.email,
          { name: inq.name, event_date: inq.event_date || '', scheduling_link: link },
          { name: escapeHtml(inq.name), event_date: escapeHtml(inq.event_date || ''), scheduling_link: link, slots_widget: widget });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Initial Inquiry Sent', initial_sent_at: nowIso }) });
        result.initial++;
      } catch (e) { console.error('initial_inquiry failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step1 query failed', e); }

  // ── Step 2: No tour booked 48h after initial send -> follow-up ──
  try {
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_inquiries?select=*&status=eq.${encodeURIComponent('Initial Inquiry Sent')}&initial_sent_at=lte.${encodeURIComponent(cutoff)}&email=not.is.null`);
    for (const inq of rows) {
      try {
        const link = `${SCHEDULING_BASE_URL}?schedule=${inq.id}`;
        const slots = await fetchOpenSlots();
        const widget = renderSlotsWidget(inq.id, slots);
        await sendTemplated(templates.follow_up_48h, inq.email,
          { name: inq.name, scheduling_link: link },
          { name: escapeHtml(inq.name), scheduling_link: link, slots_widget: widget });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Follow Up Sent', follow_up_sent_at: nowIso }) });
        result.followUp48h++;
      } catch (e) { console.error('follow_up_48h failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step2 query failed', e); }

  // ── Step 3: No tour scheduled within 30 days of inquiry -> final follow-up ──
  try {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const inList = encodeURIComponent('"Initial Inquiry Sent","Follow Up Sent"');
    const rows = await rest(`venue_inquiries?select=*&status=in.(${inList})&created_at=lte.${encodeURIComponent(cutoff)}&email=not.is.null`);
    for (const inq of rows) {
      try {
        const link = `${SCHEDULING_BASE_URL}?schedule=${inq.id}`;
        const slots = await fetchOpenSlots();
        const widget = renderSlotsWidget(inq.id, slots);
        await sendTemplated(templates.final_follow_up_30d, inq.email,
          { name: inq.name, scheduling_link: link },
          { name: escapeHtml(inq.name), scheduling_link: link, slots_widget: widget });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Final Follow Up Sent', final_follow_up_sent_at: nowIso }) });
        result.finalFollowUp30d++;
      } catch (e) { console.error('final_follow_up_30d failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step3 query failed', e); }

  // ── Step 4: Archive 5 days after final follow-up if still no tour ──
  try {
    const cutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_inquiries?select=id&status=eq.${encodeURIComponent('Final Follow Up Sent')}&final_follow_up_sent_at=lte.${encodeURIComponent(cutoff)}`);
    for (const inq of rows) {
      try {
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Archive' }) });
        result.archived++;
      } catch (e) { console.error('archive failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step4 query failed', e); }

  // ── Step 5: Newly booked tours -> confirmation email ──
  try {
    const rows = await rest(`venue_tours?select=*,venue_inquiries(id,name,email),venue_tour_hosts(name)&status=eq.Scheduled&confirmation_sent_at=is.null`);
    for (const tour of rows) {
      const inq = tour.venue_inquiries;
      if (!inq?.email) continue;
      try {
        const hostName = tour.venue_tour_hosts?.name || '';
        await sendTemplated(templates.tour_confirmation, inq.email,
          { name: inq.name, host_name: hostName, tour_date: fmtDate(tour.slot_start), tour_time: fmtTime(tour.slot_start) },
          { name: escapeHtml(inq.name), host_name: escapeHtml(hostName), tour_date: escapeHtml(fmtDate(tour.slot_start)), tour_time: escapeHtml(fmtTime(tour.slot_start)) });
        await rest(`venue_tours?id=eq.${tour.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ confirmation_sent_at: nowIso }) });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Tour Scheduled' }) });
        result.tourConfirmation++;
      } catch (e) { console.error('tour_confirmation failed for', tour.id, e); result.errors++; }
    }
  } catch (e) { console.error('step5 query failed', e); }

  // ── Step 6: 24h-before reminder ──
  try {
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_tours?select=*,venue_inquiries(id,name,email),venue_tour_hosts(name)&status=eq.Scheduled&reminder_24h_sent_at=is.null&slot_start=lte.${encodeURIComponent(in24h)}&slot_start=gt.${encodeURIComponent(nowIso)}`);
    for (const tour of rows) {
      const inq = tour.venue_inquiries;
      if (!inq?.email) continue;
      try {
        const hostName = tour.venue_tour_hosts?.name || '';
        await sendTemplated(templates.tour_reminder_24h, inq.email,
          { name: inq.name, host_name: hostName, tour_date: fmtDate(tour.slot_start), tour_time: fmtTime(tour.slot_start) },
          { name: escapeHtml(inq.name), host_name: escapeHtml(hostName), tour_date: escapeHtml(fmtDate(tour.slot_start)), tour_time: escapeHtml(fmtTime(tour.slot_start)) });
        await rest(`venue_tours?id=eq.${tour.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reminder_24h_sent_at: nowIso }) });
        result.reminder24h++;
      } catch (e) { console.error('reminder_24h failed for', tour.id, e); result.errors++; }
    }
  } catch (e) { console.error('step6 query failed', e); }

  // ── Step 7: 1h-before reminder ──
  try {
    const in1h = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_tours?select=*,venue_inquiries(id,name,email),venue_tour_hosts(name)&status=eq.Scheduled&reminder_1h_sent_at=is.null&slot_start=lte.${encodeURIComponent(in1h)}&slot_start=gt.${encodeURIComponent(nowIso)}`);
    for (const tour of rows) {
      const inq = tour.venue_inquiries;
      if (!inq?.email) continue;
      try {
        const hostName = tour.venue_tour_hosts?.name || '';
        await sendTemplated(templates.tour_reminder_1h, inq.email,
          { name: inq.name, host_name: hostName, tour_date: fmtDate(tour.slot_start), tour_time: fmtTime(tour.slot_start) },
          { name: escapeHtml(inq.name), host_name: escapeHtml(hostName), tour_date: escapeHtml(fmtDate(tour.slot_start)), tour_time: escapeHtml(fmtTime(tour.slot_start)) });
        await rest(`venue_tours?id=eq.${tour.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reminder_1h_sent_at: nowIso }) });
        result.reminder1h++;
      } catch (e) { console.error('reminder_1h failed for', tour.id, e); result.errors++; }
    }
  } catch (e) { console.error('step7 query failed', e); }

  // ── Step 8: 1h after tour start -> docs + pre-booking form, mark completed ──
  try {
    const oneHourAgoStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_tours?select=*,venue_inquiries(id,name,email),venue_tour_hosts(name)&status=eq.Scheduled&docs_sent_at=is.null&slot_start=lte.${encodeURIComponent(oneHourAgoStart)}`);
    for (const tour of rows) {
      const inq = tour.venue_inquiries;
      try {
        if (inq?.email) {
          const hostName = tour.venue_tour_hosts?.name || '';
          await sendTemplated(templates.toured_docs, inq.email,
            { name: inq.name, host_name: hostName, guidebook_link: GUIDEBOOK_URL, prebooking_link: PREBOOKING_FORM_URL, availability_calendar_link: AVAILABILITY_CALENDAR_URL },
            { name: escapeHtml(inq.name), host_name: escapeHtml(hostName), guidebook_link: GUIDEBOOK_URL, prebooking_link: PREBOOKING_FORM_URL, availability_calendar_link: AVAILABILITY_CALENDAR_URL });
        }
        await rest(`venue_tours?id=eq.${tour.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ docs_sent_at: nowIso, status: 'Completed' }) });
        if (inq?.id) await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Toured - Docs Sent' }) });
        result.touredDocs++;
      } catch (e) { console.error('toured_docs failed for', tour.id, e); result.errors++; }
    }
  } catch (e) { console.error('step8 query failed', e); }

  // ── Step 9: 30 days before event_date -> questionnaire + insurance reminder ──
  try {
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    const rows = await rest(`venue_inquiries?select=*&status=eq.Booked&questionnaire_sent_at=is.null&event_date=lte.${in30Days}&event_date=gte.${todayStr}&email=not.is.null`);
    for (const inq of rows) {
      try {
        const questionnaireLink = QUESTIONNAIRE_FORM_URL;
        const insuranceLink = `${SCHEDULING_BASE_URL}?insurance=${inq.id}`;
        await sendTemplated(templates.questionnaire_insurance_reminder, inq.email,
          { name: inq.name, questionnaire_link: questionnaireLink, insurance_link: insuranceLink },
          { name: escapeHtml(inq.name), questionnaire_link: questionnaireLink, insurance_link: insuranceLink });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Questionnaire Sent', questionnaire_sent_at: nowIso }) });
        result.questionnaireReminder++;
      } catch (e) { console.error('questionnaire_insurance_reminder failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step9 query failed', e); }

  // ── Step 10: project ends (day after event_date) -> Completed ──
  try {
    const todayStr = now.toISOString().slice(0, 10);
    const inList = encodeURIComponent('"New","Initial Inquiry Sent","Follow Up Sent","Final Follow Up Sent","Tour Scheduled","Toured - Docs Sent","Booking","Proposal Sent","Booked","Questionnaire Sent","Questionnaire Completed"');
    const rows = await rest(`venue_inquiries?select=id&status=in.(${inList})&event_date=lt.${todayStr}`);
    for (const inq of rows) {
      try {
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Completed', completed_at: nowIso }) });
        result.completed++;
      } catch (e) { console.error('mark-completed failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step10 query failed', e); }

  // ── Step 11: 7 days after Completed -> Final Feedback Questionnaire ──
  try {
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_inquiries?select=*&status=eq.Completed&completed_at=lte.${encodeURIComponent(cutoff)}&feedback_sent_at=is.null&email=not.is.null`);
    for (const inq of rows) {
      try {
        await sendTemplated(templates.final_feedback_request, inq.email,
          { name: inq.name, feedback_link: FEEDBACK_FORM_URL },
          { name: escapeHtml(inq.name), feedback_link: FEEDBACK_FORM_URL });
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Feedback Questionnaire Sent', feedback_sent_at: nowIso }) });
        result.feedbackRequested++;
      } catch (e) { console.error('final_feedback_request failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step11 query failed', e); }

  // ── Step 12: 30 days after feedback request, no response -> Archive ──
  try {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await rest(`venue_inquiries?select=id&status=eq.${encodeURIComponent('Feedback Questionnaire Sent')}&feedback_sent_at=lte.${encodeURIComponent(cutoff)}&feedback_form_response_id=is.null`);
    for (const inq of rows) {
      try {
        await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Archive' }) });
        result.feedbackArchived++;
      } catch (e) { console.error('feedback-archive failed for', inq.id, e); result.errors++; }
    }
  } catch (e) { console.error('step12 query failed', e); }

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
