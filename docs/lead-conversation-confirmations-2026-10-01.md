# Lead conversation confirmations — October 1, 2026

## Scope

Added an admin-only Leads page at `/admin/leads` for people met on Instagram, the website, by referral, or elsewhere. Kelsey can save a prospect's name, email, optional phone, date/time in Detroit time, length, phone or in-person format, email details, and a private note. Saving sends a personal confirmation with a calendar attachment. It does not create a member account, a Zoom meeting, or a public booking slot.

The page retains recent leads, shows confirmation status, and offers a retry when delivery was not confirmed. A unique email/time constraint and stable Resend idempotency key guard duplicate submissions. Leads are linked from the admin sidebar and Add someone page.

## Database and verification

Applied additive migrations `20261001230043_lead_call_confirmations.sql` and `20261001230227_index_lead_appointments.sql` to the existing Supabase project. `lead_appointments` has admin-only RLS; no lead rows were retained from testing. An anonymous read returned no data. A rollback-only synthetic lead was invisible to a non-admin. Security advisors reported no findings on the new table; its foreign-key index was added after the performance advisor flagged it.

All 165 portal tests, changed-source lint, TypeScript, and a clean production build passed. Tests cover time conversion, calendar details, admin authorization, reviewed inputs, email failure, and retry behavior. No real lead email was sent and no inbox delivery was verified.

## Deployment

The first root `npm run deploy:portal` attempt could not retrieve portal project settings because the default CLI account had no Holden Health team access. After the user signed in to the correct account through an isolated Vercel config, the required root command deployed portal `dpl_XUsjQmeYAcJkTSvxWEqrWJC2jBZi`, READY and aliased to https://portal.holden.health. Neither project was relinked and neither Root Directory changed. The temporary CLI credentials were removed afterward.

Live verification: unauthenticated `/admin/leads` redirects to staff login; the existing authenticated Chrome admin session rendered the Leads form, navigation link, and empty lead list. Desktop layout was visually inspected. A disposable `TEST Lead Save Check` with an `@example.invalid` address was submitted through the live form. The provider accepted the test message, the row appeared with `Email sent`, survived a full browser reload, and matched the database name, email, time, format, source, private note, and sent timestamp. The exact test row was deleted and a database query and browser reload confirmed zero remaining leads. No real prospect was contacted; inbox delivery, recipient reply, and phone-size layout were not verified.
