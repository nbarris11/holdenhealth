# Personal training intake and in-person appointments — September 28, 2026

Kelsey’s Hybrid client setup previously sent only a portal sign-in link. The class intake was not available to a personal-training-only client. There was no saved appointment schedule for personal training.

## Shipped

- New personal-training clients receive an email linking directly to a private personal-training intake. The intake collects goal, recent exercise, availability, emergency contact, relevant health answers, and a signed acknowledgment. It is also linked from Today and Personal training.
- Kelsey can review the private answers and mark them reviewed in the client's `/admin/training/[memberId]` workspace. Notification email contains no health answers.
- Existing clients without an intake have an **Email intake link** button in that workspace. No existing member was emailed during this release.
- In-person and Hybrid records have an appointment form for individual Eastern dates, times, length, and optional location note. Kelsey can remove an appointment. Clients see the saved visits in their Personal training page. No appointment was added during this release; the two monthly dates must be confirmed by Kelsey.
- Class enrollment and the separate class intake are unchanged.

## Data and deployment

Migrations `20260928170046_personal_training_intake_and_appointments.sql` and `20260928170117_restrict_personal_training_tables.sql` applied to Holden Health Supabase. Both tables use RLS. Anonymous table grants were removed; member access is limited to their own intake/appointments; the coach controls appointment writes and intake review.

Portal `dpl_CYq9sSU5rxKBECxQ9yXHzTMRcfG2` was deployed from the repository root with `npm run deploy:portal` and is READY at https://portal.holden.health. Public website was not deployed.

Local TypeScript, changed-source ESLint, all 137 existing portal tests, local production build, and Vercel production build passed. Rollback-only database tests confirmed owner read/submit and other-member isolation; both new tables had zero rows afterward. Live unauthenticated intake, training, and admin routes redirected to the proper sign-in pages. No real intake submission, appointment save, email send, authenticated browser walkthrough, or physical-phone test was performed.

## Kelsey's next steps

1. Open the existing client's Personal training workspace and click **Email intake link** if they have not submitted it yet.
2. Add each confirmed in-person date and time in **Appointments**. Times are Eastern and appear in the client's portal.
3. Review their private intake before the first session and mark it reviewed.
