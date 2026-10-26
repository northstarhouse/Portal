-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Wedding Day Questionnaire reminders: the first goes out 60 days before the
-- event (questionnaire_sent_at); if the questionnaire still hasn't been
-- submitted, a second goes out at 30 days (questionnaire_reminder_2_sent_at).

alter table public.venue_inquiries add column if not exists questionnaire_reminder_2_sent_at timestamptz;

insert into venue_email_templates (key, subject, body, html_body)
select 'questionnaire_reminder_30d',
 'Reminder: your wedding details are due, {{name}}',
 $b$Hi {{name}},

Your wedding is now about 30 days away, and we haven't received your Wedding Day Questionnaire yet. Please visit your event page and enter your venue code: {{venue_code}} (that's your wedding date).

On your event page you can:
1. Fill out our Wedding Day Questionnaire
2. Upload your $1M liability insurance certificate (due one month before your wedding)
3. Choose the wording for your wedding brick (3 lines, up to 20 characters each)

Your event page: {{event_page_link}}

If you've already finished everything, thank you, and please disregard this note.

The North Star House Venue Team$b$,
 $h$<h1 style="margin:0 0 16px;font-family:'Cardo',Georgia,'Times New Roman',serif;font-size:22px;color:#2a2a2a;">A friendly reminder</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444;">Hi {{name}},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#444;">Your wedding is now about 30 days away, and we haven't received your Wedding Day Questionnaire yet. Please visit your event page and enter your venue code, which is your wedding date:</p>
<p style="margin:0 0 20px;text-align:center;"><span style="display:inline-block;background:#f7f3ec;border:1px solid #e0d8cc;border-radius:8px;padding:12px 24px;font-family:'Cardo',Georgia,serif;font-size:22px;letter-spacing:2px;color:#2a2a2a;">{{venue_code}}</span></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#444;">On your event page you can:</p>
<ul style="margin:0 0 24px;padding-left:22px;font-size:15px;line-height:1.8;color:#444;">
  <li>Fill out our Wedding Day Questionnaire</li>
  <li>Upload your $1M liability insurance certificate (due one month before your wedding)</li>
  <li>Choose the wording for your wedding brick (3 lines, up to 20 characters each)</li>
</ul>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
  <tr>
    <td><a href="{{event_page_link}}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Go to Your Event Page</a></td>
  </tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.6;color:#777;text-align:center;">If you've already finished everything, thank you, and please disregard this note.</p>$h$
where not exists (select 1 from venue_email_templates where key = 'questionnaire_reminder_30d');
