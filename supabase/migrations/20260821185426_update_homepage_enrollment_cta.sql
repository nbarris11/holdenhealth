update public.website_content
set final_cta_label = 'Join the session',
    final_cta_url = 'https://portal.holden.health/register',
    updated_at = now()
where page_key = 'homepage';
