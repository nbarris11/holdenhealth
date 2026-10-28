# Private once-a-week signup — released September 15, 2026

## Shipped

User requested a private once-a-week signup with custom pricing and payment email, then explicitly requested payment/class confirmations to both Kelsey and the member and class assignments reflected in admin.

- People → Private once-a-week signups: choose member name/email, one weekly class time, custom whole-session price. Create, review, copy or email the private link. Links expire after 14 days and can be extended. Saving alone sends no email or reservation.
- The offer saves the actual future class IDs matching the chosen time in America/Detroit. No matching scheduled classes means creation is rejected. Private signup page lists these dates and Zoom indicators.
- Member supplies phone, safety and policy confirmations, then chooses card/Apple Pay or ACH. Saved server identity/price/classes control checkout, with the existing $4 online fee. This is a one-time program payment, not recurring billing.
- Verified payment triggers confirmation emails to the member and holdenhealth.coaching@gmail.com. For 1x signups these include payment amount, program dates, weekly time, individual class dates, location, Zoom notes and intake requirements. Member portal/intake link is sent separately. ACH successful-enrollment confirmation waits for clearance.
- Paid class assignments are synced into attendance_selections for the claimed enrollment. A paid offer appears on the admin roster even before account setup finishes. Retry-safe synchronization does not restore classes later deselected by the member. No payment or roster status is faked before payment.
- People shows paid class signup status; member detail shows agreed class and intake status; Schedule includes a program selector and the actual class roster. Paid enrollment remains invited until normal intake review permits participation.
- Admin add/edit member forms accept 1 class/week. Public signup and member self-service choices remain 2/3; public server validation also rejects 1x. Existing broader attendance-choice rules remain; this feature does not impose a new hard weekly booking restriction.

## Database and deployment

Applied `private_weekly_signups`, local migration `supabase/migrations/20260915210923_private_weekly_signups.sql`. Adds service-only RLS-protected offer table, expanded 1/2/3 record constraints and two service-only SECURITY INVOKER RPCs for reservation/class sync. Shared session lock and capacity checks; offer determines identity/price/classes; existing Stripe order uniqueness retained.

Supabase maintenance temporarily blocked application; verified table absent, then applied once after service returned. Pre- and post-migration rollback tests passed, including actual service_role execution, same-order retry, public/private capacity, paid/processing/expired rejection, public 1x rejection, permissions, paid attendance assignment and no reassignments on retry. No rollback fixtures retained.

Security advisor: new offer table has expected RLS-without-policy info because client grants are revoked and only service_role can access it. No new exposed-definer warning. Existing unrelated [admin RPC notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [service-only table notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password-protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain.

Portal deployed from root `npm run deploy:portal`, using isolated Holden Health Vercel login without changing default TeeAhead credentials or either Root Directory.

**Production:** `dpl_GkcCBPEJyrkqciHg5NvyTQ61P9eD`, READY at https://portal.holden.health. Public site did not need deployment.

## Authorized live test

User explicitly requested a $50 test to **nbarris11@gmail.com**, then confirmed Vercel login and reiterated both confirmation recipients.

Used the existing signed-in Chrome admin tab to create and email:

- Name: Neil Barris (test)
- Program: December Mini Session (`08a7d2af-b019-44a4-bf76-ffb357dce789`)
- Class: Saturday 9 AM Eastern, December 5/12/19
- Offer: `48f6ae80-39b8-424e-98e2-5347589e2f3c`
- Program price: $50; online total: **$54** (fee disclosed to user and shown on live page)
- Email sent: 2026-09-15 21:48:08 UTC. Live admin confirmed Payment link emailed; Gmail search confirmed delivery to nbarris11@gmail.com at 5:48 PM Eastern.

Live member page correctly displays program, amount, fee, total and three Saturday dates. **No checkout or payment submitted.** Final database check: checkout_order_id null. Keep the authorized test offer available for the user. It is a live payment link; it has not been marked paid and no enrollment was fabricated.

The older October payment_processing order for this email remains untouched. December was chosen to avoid interfering with it.

## Verification and limits

- **97 automated tests passed**; ESLint and local/production build/TypeScript passed.
- Tests cover saved pricing/identity, admin-only creation, consent validation, Stripe idempotency, duplicate/expiry/timeout handling, 1x card/ACH fulfillment, both confirmation recipients, class email content, DST matching and paid-only pre-account roster display.
- Source-rendered synthetic member/admin phone fixtures at 390px had no overflow; required member inputs block empty submission.
- Authenticated live admin creation/send and live member review passed. Gmail delivery observed. Live public registration has only 2-/3-day options.
- Paid confirmation and class assignment validated by mocked webhook tests and rolled-back database tests, **not an actual charged Stripe transaction**. No physical phone or Apple Wallet payment claimed. No real enrollment or existing member record altered by the test.

## Key files

- `web-app/src/app/admin/people/private-signups.tsx`, `private-signup-actions.ts`
- `web-app/src/app/register/private/{page.tsx,actions.ts,submit.tsx}`
- `web-app/src/lib/{private-signup.ts,private-class-times.ts,private-class-confirmation.ts}`
- Stripe webhook; admin People/member/Schedule pages; admin weekly plan parser; public form default handling
- `web-app/tests/private-signup.test.mjs`, `private-class-confirmation.test.mjs`, `card-checkout.test.mjs`
- `supabase/tests/private-signups.sql`
