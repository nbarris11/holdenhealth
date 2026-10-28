# Coaching updates — October 13, 2026

## Released

Portal production deployment `dpl_2wjXMtvnRiSTEnkuQT8tN7VR2MPR` is READY at https://portal.holden.health (deployment: `holdenhealth-portal-3pqbpbtwf-holden-health.vercel.app`). Deployed from the repository root using `VERCEL_GLOBAL_CONFIG=/Users/barris/.config/vercel-holden-health npm run deploy:portal`. Public website unchanged. Vercel project/root-directory configuration unchanged.

- **Late joins:** published, unended six-week programs remain available at `/register` after starting. Late applicants request a place without being charged or reserving capacity. In People → Registration requests, Kelsey enters **Agreed program price ($)** and approves. The setup email includes this amount. Venmo, cash, or check payment remains pending until recorded; custom prorated Stripe checkout is not included. Approval atomically checks capacity and existing membership and preserves an already approved quote. Failed setup email has a retry control.
- **Activity:** `/admin/activity` shows habit choices/edits and completed workouts. Each coach can opt into either email category under Email notifications; both default off. Emails keep member details behind login. Trusted database triggers, per-recipient delivery records, leases and provider idempotency protect delivery. Actions schedule immediate processing; the daily 13:30 UTC cron provides a fallback. Delivery is not a phone push notification. Retries stop after 23 hours to stay within provider idempotency limits. Synthetic-member activity only appears to/sends email to test staff.
- **PT workouts:** open the client’s personal-training workspace → **Build workouts**. This reuses the group exercise builder/player, including exercise names, reps, links, timer and templates. One workout is sufficient. Existing legacy workouts remain readable; the three-version editor is no longer the default authoring interface. Private PT workouts appear in Today/Workouts and completed sessions count in Progress and coach check-ins.
- **PT habits:** members open Personal training → Weekly habits (`/portal/training/habits`) and select exactly three each week. Kelsey has a read-only Weekly habits link in the client workspace.
- **Habit edits:** class and PT members can edit the current week. Changed habits reset only their own current-week marks, unchanged habits keep marks, and previous definitions/checkmarks stay in saved history. Version checks prevent stale browser writes.

Existing member deactivation and individual communication functionality were not replaced. Anna/Tracey were not deactivated as part of this release; no real member records, workouts or habits were edited.

## Applied migrations

1. `20261013233335_coaching_workouts_habits_activity.sql`: private PT workout/habit ownership, revision history, activity/preferences/deliveries and priced registration approval.
2. `20261013234145_consolidate_coaching_access.sql`: consolidate additive RLS policies without changing their effective access.
3. `20261013234610_isolate_test_activity_notifications.sql`: prevent synthetic activity from appearing in real staff feeds or emailing real staff.

Migration filenames match remote history. Existing class workout and legacy PT data are preserved. Server-only delivery table intentionally has no client RLS policies; clients have no table grants.

## Verification

- All **185** Node tests pass, including PT owner scoping, late-request routing, and notification concurrency/idempotency/expired retry/disabled preference cases.
- Changed-source lint, TypeScript and production build passed; Vercel production build passed.
- Transactional rollback SQL checks passed for class/private workout visibility, drafts/future dates, cross-member writes, paused access, habits/marks/revisions/stale writes, event delivery counts, quote preservation and capacity enforcement. Additional migration plus coaching test script rerun passed before apply.
- Authenticated synthetic browser flow: coach creates/publishes structured PT workout; member completes it; completion appears in Progress and coach check-ins/activity; another member cannot open it. Three habits save and persist; editing preserves unchanged marks and records history.
- Production browser checks passed for coach preference save, PT workout display, habit edit/history and activity feed. One resulting alert was provider-accepted (`sent`, 2026-10-13 23:46:31 UTC) at a labeled Resend `delivered+...@resend.dev` test address. Zero deliveries to other staff were generated for that synthetic member. This does not verify a physical inbox or push notifications.
- 390px and 320px local browser layouts checked; screenshots in `docs/coaching-october-2026/`. No physical-phone/audio test.
- Late registration/approval validated by unit and rollback SQL checks and read-only registration rendering. No real late request, approval email, payment or Stripe transaction was submitted. These live flows remain unverified end to end.
- Security/performance advisors reviewed: new duplicated permissive policies resolved. Existing advisor findings were not broadly changed.

## Cleanup and next use

All three temporary accounts were globally signed out, then their exact synthetic accounts, staff role, relationship, workout/log, habits/history, activity/deliveries and preferences were removed. Production checks confirmed zero remaining synthetic account/relationship/workout/habit/activity records. Retained historical demo members were untouched. Temporary credentials and QA SQL files were removed; the local QA server was stopped.

Kelsey’s only setup step is enabling whichever email alerts she wants in Activity. A genuine late join still needs her price agreement, approval and manual payment recording. Current user request is complete; no additional feature work is pending for this release.
