# Live launch — September 11, 2026

User requested removal of the preview screen and test information and production launch.

## Shipped

- Removed the public-site password gate and its environment-dependent launch switch. Public pages, robots.txt, and sitemap are accessible without cookies. Bare domain redirects to canonical www; custom-page rewrites and secure admin shortcut preserved. Old preview URLs redirect home; preview.html removed.
- Retired public /demo routes to /login; removed the sample demo UI and workout content. Shared workout-player support code and automated tests remain internal. Member authentication remains intact.
- Homepage and article demo links replaced with program/member links. Homepage sample workout wording replaced with general program wording, including published site_content overrides and website-editor defaults. Existing user-authored overrides elsewhere preserved.

## Database cleanup

Executed an exact-ID transaction after a successful rollback rehearsal. Verified identities by name/email and denied staff deletion. Removed nine retained synthetic accounts: Neil Test Member, Jamie/Alex/Taylor Demo Member, and the five DEMO Story Pilot accounts. Removed their cascaded enrollment/intake/payment fixtures and story records, three demo invitations, both TEST challenge programs, their five workouts and five logs, and the past Nick Barris Zoom Test consultation booking. Revoked test sessions before deleting accounts. Real account identities, both real class sessions, and the real September challenge and its seven workout records were preserved, including current published/draft/archive settings.

Concurrent Add in-app messaging task temporarily created three additional TEST Messaging accounts and one test program. Coordinated cleanup; final read returned no test profiles or sessions. That task owns messaging verification and may deploy separately.

### Deliberately retained live payment

Checkout order 079edad4-6272-4a88-901a-3fa584fff7d7 is named Test but linked to a live Stripe checkout, with database status payment_processing. Retained for reconciliation: do not assume a test label means a simulated payment. No payment was cancelled, refunded, or changed. Local Stripe configuration is test mode and cannot establish this live transaction's status. Confirm in the live Stripe dashboard before altering this record.

## Verification and deployment

- 8 website tests and SEO/link checks for 20 sitemap pages passed.
- 35 portal tests, ESLint, TypeScript and production build passed.
- Required root npm run deploy:site: dpl_A9ogRez6dip5nxA8jwjzPYiLBxWz READY at https://www.holden.health.
- Required root npm run deploy:portal: dpl_AdziBWMucDiXpy2LNdUfeymJeFUj READY at https://portal.holden.health.
- Anonymous live HTTP checks passed: homepage, canonical redirect preserving query, robots allowing crawling, sitemap, old preview redirect, demo and demo/workout redirects to login, protected member-workout redirect, registration and managed homepage content API.
- Live browser homepage rendered normal public content and revised app links, without a password screen.
- No real registration, email, payment, or member submission was made during launch checks. No physical-phone or complete checkout-flow test claimed. Runtime logs were not audited.
- Initial sandbox deployment attempts did not produce deployments; repeated with approved network access and verified READY CLI results above.
