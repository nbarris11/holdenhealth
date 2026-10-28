# Paid messaging access — September 11, 2026

User clarified messaging is for paying people and must not be included in the free 21-day challenge.

## Delivered

- Free challenges no longer create chat rooms. Existing challenge rooms/history remain stored but are inaccessible through member or coach messaging. No messages or member records deleted.
- Class access requires active/completed enrollment with a positive payment marked paid. This includes recorded offline payments. Pending, missing, refunded, waived, and credited payments do not qualify. Completed class history remains read-only under existing session rules.
- Active coach-managed personal training relationships qualify for private messaging. Invited, paused, and completed training relationships do not. Personal training has no separate payment ledger in the current schema; the coach-managed active relationship is its entitlement.
- Free challenge participation adds no messaging entitlement. A member with both paid access and a challenge retains paid-program/private messaging, with no challenge room.
- Database RLS controls message/history/preferences access; server API blocks free inbox/history/start/send/push registration and prevents coach-starting DMs for ineligible members. Device unsubscribe remains available.
- Header and Account & support hide Communicate for ineligible members; direct inbox navigation redirects to Today. Removed challenge WhatsApp promises/links and clarified included features.
- Push recipients are filtered by paid eligibility and by the specific class payment; challenge-room jobs are discarded without delivering notifications.

## Verification

35 existing portal tests plus 3 new API access tests passed. ESLint and production build/TypeScript passed. Transactional database tests passed after a rollback rehearsal and after applying final migrations: free-only denial, legacy free DM denial, paid-plus-challenge access, no automatic challenge room, direct service RPC denial, service recipient eligibility, active training access, paused training/refund revocation, member isolation, closed/ended room restrictions and anonymous denial. All fixtures rolled back; no real member messages or notifications sent.

Security advisor has no new warnings after moving the current-user privileged lookup to the private schema. Prior server-only-table notices, admin-function warnings, and disabled leaked-password protection remain. [Database advisor reference](https://supabase.com/docs/guides/database/database-linter) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Portal deployed using root npm run deploy:portal: dpl_AitkC8LX2HYV4HKjj2VQcMrKcDsh, READY at https://portal.holden.health. Live challenge HTTP 200 and unauthenticated chat HTTP 401 passed. No authenticated browser/physical-phone or notification-delivery test claimed. API tests use mocked service clients; database tests exercise actual authenticated/service roles.

Migrations: 20260911185429_paid_member_messaging.sql and 20260911185513_private_chat_access_check.sql. Local filenames match remote migration history. Public website unchanged.

## Operational note

At implementation there was one active class enrollment without a payment record. It does not qualify unless payment is recorded. No payment statuses changed. Kelsey should mark an offline payment paid after receiving it. Existing retained live Stripe processing order was not changed.
