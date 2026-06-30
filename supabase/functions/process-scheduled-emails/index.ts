const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const headers = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

Deno.serve(async () => {
  const now = new Date().toISOString();

  // Fetch all pending emails whose send_at has passed
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scheduled_volunteer_emails?status=eq.pending&send_at=lte.${encodeURIComponent(now)}&select=*`,
    { headers: headers() },
  );
  const emails: any[] = await res.json();

  if (!Array.isArray(emails) || emails.length === 0) {
    return new Response(JSON.stringify({ processed: 0, failed: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  let processed = 0;
  let failed = 0;

  for (const email of emails) {
    // Mark as processing immediately to prevent double-send if function runs again
    await fetch(`${SUPABASE_URL}/rest/v1/scheduled_volunteer_emails?id=eq.${email.id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'processing' }),
    });

    try {
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ to: email.recipients, subject: email.subject, body: email.body }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${sendRes.status}`);
      }

      // Mark sent
      await fetch(`${SUPABASE_URL}/rest/v1/scheduled_volunteer_emails?id=eq.${email.id}`, {
        method: 'PATCH',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
      });

      // Log to volunteer_email_logs so it shows in the Recent Sends sidebar
      await fetch(`${SUPABASE_URL}/rest/v1/volunteer_email_logs`, {
        method: 'POST',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          sent_at: new Date().toISOString(),
          team_tag: email.team_tag,
          recipient_count: email.recipient_count,
          subject: email.subject,
        }),
      });

      processed++;
    } catch (err: any) {
      await fetch(`${SUPABASE_URL}/rest/v1/scheduled_volunteer_emails?id=eq.${email.id}`, {
        method: 'PATCH',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'failed', error: err.message }),
      });
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
