-- Paid booking, contract still missing a signature: the date is secured, so this replaces the "hold is expiring" warning.
-- Sent once by process-venue-pipeline (step 8d). Editable under Venue Rentals > email templates, key: agreement_signature_reminder.
insert into public.venue_email_templates (key, subject, body, html_body)
select 'agreement_signature_reminder',
  'Your date is secured',
  E'Hi {{name}},\n\nYour wedding date at North Star House is confirmed, and your deposit has been received. Thank you!\n\nWe''re just waiting on one more signature to complete your contract. When you have a moment, you can sign here (your venue code is {{venue_code}}):\n{{event_page_link}}\n\nWarmly,\nNorth Star House',
  $html$<h1 style="margin:0 0 16px;font-family:'Cardo',Georgia,'Times New Roman',serif;font-size:22px;color:#2a2a2a;">Your date is secured</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444;">Hi {{name}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444;">Your wedding date at North Star House is confirmed, and your deposit has been received. Thank you!</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#444;">We're just waiting on one more signature to complete your contract. When you have a moment, you can sign on your event page with your venue code:</p>
<p style="margin:0 0 20px;text-align:center;"><span style="display:inline-block;background:#f7f3ec;border:1px solid #e0d8cc;border-radius:8px;padding:12px 24px;font-family:'Cardo',Georgia,serif;font-size:22px;letter-spacing:2px;color:#2a2a2a;">{{venue_code}}</span></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;"><tr><td><a href="{{event_page_link}}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Sign My Agreement</a></td></tr></table>
<p style="margin:0;font-size:15px;line-height:1.65;color:#444;">Warmly,<br>North Star House</p>$html$
where not exists (select 1 from public.venue_email_templates where key = 'agreement_signature_reminder');
