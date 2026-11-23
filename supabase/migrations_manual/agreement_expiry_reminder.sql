-- Two days before a pending rental agreement's signing deadline, email each client who has not signed yet (once).
-- The pipeline job (process-venue-pipeline, hourly) sends it; expiry_reminder_sent_at makes sure nobody gets it twice.
-- The wording is an editable email template (Venue Rentals > email templates), key: agreement_expiry_reminder. Safe to re-run.
alter table public.venue_agreement_versions add column if not exists expiry_reminder_sent_at timestamptz;

insert into public.venue_email_templates (key, subject, body, html_body)
select 'agreement_expiry_reminder',
  'Reminder: please sign your agreement by {{expires_short}}',
  E'Hi {{name}},\n\nA quick reminder: your North Star House rental agreement is still waiting for your signature. Your date is on a soft hold until {{expires}}. If the agreement is not signed by then, the hold is released and the date becomes available to others.\n\nTo sign, open your event page and enter your venue code ({{venue_code}}):\n{{event_page_link}}\n\nYou will receive a verification code at this email address when you are ready to sign.\n\nIf you have any questions or need more time, just reply to this email and we will help.\n\nNorth Star House',
  $html$<h1 style="margin:0 0 16px;font-family:'Cardo',Georgia,'Times New Roman',serif;font-size:22px;color:#2a2a2a;">Your agreement is waiting for your signature</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444;">Hi {{name}},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#444;">A quick reminder: your rental agreement is still waiting for your signature. Your date is on a soft hold until <strong>{{expires}}</strong>. If the agreement is not signed by then, the hold is released and the date becomes available to others.</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#444;">To sign, open your event page and enter your venue code, which is your event date:</p>
<p style="margin:0 0 20px;text-align:center;"><span style="display:inline-block;background:#f7f3ec;border:1px solid #e0d8cc;border-radius:8px;padding:12px 24px;font-family:'Cardo',Georgia,serif;font-size:22px;letter-spacing:2px;color:#2a2a2a;">{{venue_code}}</span></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
  <tr>
    <td><a href="{{event_page_link}}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Open My Event Page</a></td>
  </tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.6;color:#777;text-align:center;">Questions, or need a little more time? Just reply to this email and we will help.</p>$html$
where not exists (select 1 from public.venue_email_templates where key = 'agreement_expiry_reminder');
