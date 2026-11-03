-- The email sent after a tour no longer includes the Client Guidebook: it is just the pre-booking form (plus the availability calendar).
update public.venue_email_templates
set body = replace(body,
      $a$Attached, you'll find our Client Guidebook that your Venue Coordinator reviewed with you, along with a Contact Sheet to complete if you'd like to move forward with booking: {{prebooking_link}}$a$,
      $b$If you'd like to move forward with booking, please complete our pre-booking form: {{prebooking_link}}$b$),
    html_body = regexp_replace(
      replace(html_body,
        $a$Attached, you'll find our Client Guidebook that your Venue Coordinator reviewed with you, along with a Contact Sheet to complete if you'd like to move forward with booking.$a$,
        $b$If you'd like to move forward with booking, please complete our pre-booking form.$b$),
      '<td style="padding:0 8px 0 0;"><a href="\{\{guidebook_link\}\}"[^>]*>View Guidebook</a></td>', '', 'g')
where key = 'toured_docs';
