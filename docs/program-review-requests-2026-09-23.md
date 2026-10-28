# Program review requests — September 23, 2026

## Delivered

User authorized adding the manual review-request feature, then requested automatic sending. Production portal deployment `dpl_3J8XJWg5VuwQLzLfdpzacNVEE8zQ` is READY at https://portal.holden.health. Used root `npm run deploy:portal` with the existing isolated Holden Health CLI login; no project Root Directory changes.

- New page `/admin/communications/reviews`, linked from Email and Programs.
- Daily cron `/api/cron/program-reviews` at 14:00 UTC (9 AM standard / 10 AM daylight time in Michigan). Vercel project API confirms it is enabled alongside the existing Sunday check-in cron.
- Sends after the final Michigan calendar day of a class session or published habit challenge. Draft/cancelled programs excluded. Seven-day catch-up window; programs ending before activation date 2026-09-23 are excluded from automatic backfill.
- Current first eligible date: October 5 for the challenge ending October 4. Class sessions: November 22 and December 20 based on saved dates.
- Reuses branded HTML/plaintext emails, real first name and unsubscribe link. Invites honest feedback, with no rating filter, incentive, or review gating. The verified share.google link opens the profile; email tells members to choose Write a review.
- Class recipients: active/completed enrollments in selected program. Challenge recipients: that challenge's signups. Email opt-out/test exclusions, normalized email deduplication, pagination, and a maximum batch of 100.
- Manual form shows names/emails and email copy, requires confirmation, and rechecks the recipient fingerprint before claiming sends. Server action verifies admin authorization and end date.
- Persisted unique program/member and program/email reservations prevent duplicates across manual requests, scheduled requests, repeated clicks and concurrent invocations. Known provider rejections remain retryable. Timeouts, 5xx, incomplete success responses and uncertain result writes stay blocked for manual delivery reconciliation; no blind retries. API 2xx acceptance is not a claim of inbox delivery.
- Automatic requests have null requested_by; manual requests retain the verified staff ID. The service client is used only behind CRON_SECRET verification.

## Migrations

Applied and local versions aligned:
- `20260923144237_program_review_requests.sql`
- `20260923144703_automatic_program_reviews.sql`

RLS enabled. Only admins can read/insert/update via authenticated role; anonymous privileges revoked; service role can create scheduled reservations. Existing tables, enrollments, workouts, and email preferences unchanged.

## Verification

- 128 portal tests passed, including 13 new tests for date boundaries, catch-up window, program isolation, pagination, recipient preferences, concurrent sends/retries, unknown delivery, authorization, confirmation, stale previews, cron authentication/dry-run, date override protection and email content.
- TypeScript and changed-source ESLint passed. ESLint used a clean temporary dependency install because existing local node_modules has package corruption.
- Clean Vercel production build and TypeScript passed.
- Transaction-rollback database tests passed for admin insert/update, unique duplicate prevention, member read/write isolation, service insert with null actor, and anonymous denial. All fixtures rolled back; final table count zero.
- Authenticated live browser verified new page, program selector, challenge's 9 eligible members, preview/link, and no send button before end date. Mobile 390px and 320px fit without horizontal overflow; not physical-phone testing.
- Vercel API confirmed daily cron registration and enabled state. Existing CRON_SECRET is a sensitive production variable; it cannot be pulled for authenticated HTTP testing. Unauthorized live cron requests returned 401. Authenticated production cron invocation / end-to-end provider sending was not tested. Synthetic cron dry-runs passed; no live provider delivery claimed.
- No review emails, test emails, or other member messages were sent. No program dates/statuses were modified.

## Operational limits

If a request stays “sending” or “delivery unconfirmed,” verify the recipient/date in Resend before changing the saved status. An accepted email must never be reset for retry. Automated catch-up stops after seven days; manual sending remains available after the end date. Each run is bounded to ten batches. The current audience is small; unusually large future programs may need an explicit queue.

Existing unrelated Supabase advisor notices remain: [admin SECURITY DEFINER RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [service tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No findings for the new table. No runtime-log audit.
