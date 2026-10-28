# SEO content release — September 11, 2026

User authorized implementing the existing service-page improvements and Resources articles after discussing where they belong. Local and online acquisition retain equal priority.

## Changes

- Personal Training: explicit Plymouth service headline, beginner/returning-exerciser suitability, verified qualifications and existing portrait, consultation and appointment details, equipment/location guidance, FAQs, related services and consultation CTA. Added Service and BreadcrumbList JSON-LD.
- Online Training: explicit beginner/busy-schedule H1 with original managed headline retained as supporting copy; added how the coaching week works and clarified that weekly Zoom is a check-in, not live supervision of every workout. Added decision FAQs and link to comparison guide. Existing published user edits preserved.
- Group Classes: clarified class intent in H1, added one-to-one comparison FAQ/link, completed schema provider type/name. Existing sections, program dates, prices, policies and saved user edits preserved.
- Added first-personal-training-session.html and online-personal-trainer-vs-workout-app.html with existing article styling, organizational Holden Health attribution, unique metadata, Article/BreadcrumbList structured data, relevant service links and CTA. No invented Kelsey quotes, client stories, new exercise prescription or promised medical outcomes.
- Added both guides to Resources cards and CollectionPage schema, sitemap (now 22 URLs), site.js page map and portal website editor catalog. Existing automatic text detection retained; no per-element editor patch. Articles remain under Resources, not separate main-navigation items.
- Updated accurate lastmod for changed service/resource pages. No new dependency or database mutation. Existing Search Console verification tag retained.

## Verification

Nine website tests and 22-page source checks passed (unique titles/descriptions, matching canonical, one H1, JSON-LD syntax, image alt, local links). Portal lint, 42 tests, TypeScript and production build passed.

Compared all 18 currently published positional/ID visual-override targets on training and coaching pages against pre-edit source; matched target counts/text preserved. No published overrides changed or deleted. Resources cards verified within postGrid. Editor page registrations checked, and confirmed neither article enters default main navigation.

Live public source matches local bytes for all six changed/new HTML pages and site.js. All 22 sitemap URLs return 200 without header noindex. No browser visual/mobile interaction test, authenticated editor save, live Rich Results rerun, new PageSpeed measurement, runtime log audit, payment or customer form submission claimed. Existing responsive styles reused; portrait intrinsic dimensions verified from asset.

## Deployment

Website dpl_2Xd9G429Ky96xxPPWc1idZadfeT9 READY at https://www.holden.health, using root npm run deploy:site.

Portal dpl_BnZfKUhhrCNKVV5KN2xmtAjTwGof READY at https://portal.holden.health, using root npm run deploy:portal. Live site-content API returns both new editor page keys successfully; live navigation excludes both articles as intended.

## Remaining

Google Business Profile ownership/eligibility and real review/client-story work remain outstanding. No reviews or outreach sent. Existing Search Console sitemap submission/weekly launch monitor handles discovery; inclusion in sitemap is not confirmation the new articles are indexed. No repeated indexing requests for previously submitted service pages.
