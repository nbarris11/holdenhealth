# Manual Zoom invites — September 15, 2026

## Shipped to production

User requested a way for Kelsey to choose a time and email someone who contacts her outside signup, with both people receiving a Zoom invitation.

Added **Send a Zoom invite** on `/admin/consultations`: name, email, date, Eastern time; a 60-minute reservation, existing Zoom creation integration, separate emails to guest and `holdenhealth.coaching@gmail.com`, and the same `.ics` calendar attachment. No account/signup required. Existing public booking retains its flow; its calendar attachment builder is now shared.

- Server actions and database function require admin access.
- Atomic reservation uses the existing consultation conflict lock/trigger. Duplicate submissions and overlapping public/manual appointments are rejected before Zoom creation.
- Newly created manual times remain private, including after cancellation. Existing slots retain their active setting.
- The appointment remains saved on Zoom/email failure. Incomplete Zoom setup is visible with cancellation guidance. Email statuses show each recipient; Retry unsent invites skips confirmed sends and uses stable Resend idempotency keys.
- Dates round-trip through America/Detroit to reject invalid dates and nonexistent DST times.
- No dependency additions, member account changes, or test invitations sent.

## Database

Applied `20260915193447_manual_consultation_invites.sql` to `urxxiohatmvqbgrzqibq`. Additive booking source/sent timestamps and an admin-checked SECURITY INVOKER RPC; existing RLS and booking trigger preserved. Local filename aligned with actual remote migration history.

Rollback-only authenticated SQL tests passed: private reservation, duplicate request, manual/public overlap, rollback of a failed slot creation, email status update, cancellation privacy, reuse of a closed private slot, existing public slot behavior, non-admin rejection, anonymous execution denied. Zero test bookings left behind.

Security advisor reported no new consultation findings. Existing unrelated notices remain: [admin SECURITY DEFINER RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [service-only tables with RLS/no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verification

- 81 portal tests passed, including seven new manual-invite tests.
- ESLint and Next.js production build/TypeScript passed.
- Real page rendered with synthetic data for browser layout checks at 390px and 320px: no horizontal overflow; required email validation blocked malformed input. Partial-email status and retry button rendered.
- Existing authenticated production browser reaches the Zoom calls page; new UI is not deployed yet.
- External Zoom creation and Resend calls tested with doubles; no real meeting or email generated. Calendar attachment UTC start/end and join URL verified. No physical-phone or inbox-delivery claim.

## Deployment blocker / next action

`npm run deploy:portal` from the workspace root failed before creating a deployment: CLI currently signed into `teeaheadllc`, with only TeeAhead team access. Existing `.vercel/project.json` still correctly targets `holdenhealth-portal` / `team_46Yzfi7HIFgzLAbu1VvGJyWV`; do not relink or change Root Directory. The connected Vercel MCP does have Holden Health access, but the prescribed root deployment command needs CLI access.

Started isolated Vercel login using `--global-config /tmp/holden-health-vercel-login-20260915` to preserve the user's existing TeeAhead CLI credentials. User was asked to complete this login. On success use its token only in a child process environment to run the required root command; never print credentials. If the device code expired, restart isolated login. Then verify production READY and the authenticated Zoom form at mobile/desktop widths. Clear temporary login credentials after deployment.

## Follow-up: one-off slot did not appear

User reported Add one extra time seemed to succeed but did not appear publicly. Inspected live records: no slots had been created/updated since September 11. Exact attempted date/time requested and not yet supplied; do not claim the exact user attempt has been identified. Found and transactionally reproduced a real defect: the old upsert used ON CONFLICT DO NOTHING, so a previously closed time stayed closed while the UI reported success.

Added `publishSingleConsultationSlot` and admin-checked SECURITY INVOKER `publish_consultation_slot` RPC (migration `20260915200433_publish_single_consultation_slot.sql`, applied). Reopens closed times atomically, reports already-open times, blocks overlap with booked calls using the shared booking lock, and preserves private manual bookings. Existing single-slot action delegates to it. One-off times now accept arbitrary minutes and use validated Eastern-time conversion; weekly scheduling unchanged. Corrected misleading weekly example to match actual hourly generation.

84 portal tests pass; production build/TypeScript passed. Removed an unused preview-script import flagged by lint. Database rollback tests reproduced old false-success behavior and verified reopen, duplicate, new quarter-hour time, past-time rejection, conflicts/private booking protection, non-admin/anonymous rejection. No test records retained or emails sent. Live public availability endpoint responded HTTP 200, cache MISS, max-age=0; currently still running old portal build. Public API only shows the next 90 days, so confirm the user's intended date before claiming their particular slot is resolved.

Deployment still pending Holden Health CLI authentication. Original device login expired; a subsequent isolated login was started. Do not copy device codes from this dated record; check current login state or generate a fresh code. Existing TeeAhead CLI credentials unchanged.

## Production release completed

User completed Vercel sign-in and explicitly requested production deployment. Portal `dpl_AA8KqXQPxVkk3DU85wmQnL3DwfLb` is READY at https://portal.holden.health. Used root `npm run deploy:portal` with a temporary npx wrapper selecting the isolated Holden Health CLI config; original TeeAhead CLI credentials and both Vercel Root Directories unchanged. Public-site deployment not needed.

Production build/TypeScript passed. Authenticated browser verified the live manual-invite form and one-off form. Submitted the already-open September 16 9:30 AM time: correctly returned “That time is already open on the calendar. No duplicate was added.” Public API returned 186 slots, unchanged. Live public booking flow displayed September dates and September 16 times 9:30 AM through 3:30 PM. Admin desktop layout had no horizontal overflow. Prior 320/390px synthetic-render checks remain the mobile evidence. No new production appointment, invitation, or email was generated; no customer slot was inferred or changed without the user's missing date/time.

Temporary isolated CLI authentication and deploy wrapper removed after successful release. The next deploy should use the correct Holden Health login, not relink the project to TeeAhead.
