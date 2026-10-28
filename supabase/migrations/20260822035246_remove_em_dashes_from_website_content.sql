update public.website_content
set hero_heading = 'Come get stronger with people who''ll be glad you showed up.',
    updated_at = now()
where page_key = 'homepage'
  and hero_heading = 'Come get stronger—with people who''ll be glad you showed up.';
