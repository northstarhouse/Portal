-- One-time: put Wild Birds Unlimited on the website's Sponsors page (its logo, website and overview are saved in the
-- Portal, but the Portal's automatic push to the website was being silently blocked; see
-- add_site_content_sponsors_portal_write.sql). Safe to run twice: it skips the sponsor if already listed.
update site_content
set content = jsonb_set(
  content, '{sponsors}',
  coalesce(content->'sponsors', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'slug', 'wild-birds-unlimited',
    'name', s."Business Name",
    'logo', s.logo_url,
    'website', s.website,
    'websiteLabel', regexp_replace(regexp_replace(s.website, '^https?://(www\.)?', ''), '/.*$', ''),
    'description', s.overview))),
  true)
from "Sponsors" s
where site_content.page_key = 'sponsors'
  and s."Business Name" = 'Wild Birds Unlimited'
  and not exists (select 1 from jsonb_array_elements(site_content.content->'sponsors') e where lower(e->>'name') = 'wild birds unlimited');
