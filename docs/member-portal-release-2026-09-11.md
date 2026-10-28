# Member portal audit fixes — September 11, 2026

Deployed at the user's request: “fix it and deploy please.” This release follows the [member portal audit](member-portal-audit-2026-09-11.md).

## Shipped

- Group members now see their class onboarding next step on Today and a Classes navigation tab. Session selection prefers the current program, then the next upcoming program, and supports choosing another owned enrollment.
- Intake fits narrow mobile screens, preserves entered answers on validation/server errors, identifies missing conditional answers, collects a phone number when phone/text is selected, prevents duplicate submission, and warns before leaving unsaved answers. It does not store health answers in browser storage. Reviewed and awaiting-review states are distinct.
- Classes distinguish reserved, intake pending, payment pending, ready, upcoming, and finished states. Pre-start programs show their start date and first Sunday check-in date. Classes remain visible through their end plus a short grace period. Canceled classes explain the at-home replacement policy; missing Zoom links explain that details are pending.
- Arrival, makeup communication, payment, cancellation, and emergency policies now match the supplied business answers. Weekly Google Form answers are explicitly separate from portal history. The unavailable Goal-to-Action sheet leads members to Kelsey rather than promising a download.
- Progress program switching stays on Progress; support, story, account, and login links preserve the relevant selected context. Account shows contact information and a clear update/support path. Future habits explain their opening date.
- Finish early defaults to a partial workout. Workout cards count steps rather than implying every step is an exercise. Existing workout programming and timer functionality are preserved.
- Personal training clarifies plan/review dates versus appointments, provides scheduling/rescheduling contact guidance and in-person pricing/location, and prevents paused/invited plans from offering active coaching actions. Failed saves retain notes. Deferred workouts remain readable.
- Week reset allows zero sessions and atomically records the reset and updates unfinished workouts, including overdue ones. Retries are idempotent; future-week workouts are untouched. The interface explains that setting workouts aside does not automatically reschedule them.

## Deployment

- Portal: https://portal.holden.health
- Deployment: `dpl_Bi6K1U2bjXp7Js46vMxndzgwjVPM`, READY and production-aliased.
- Built and deployed from the repository root using `npm run deploy:portal`.
- Applied `supabase/migrations/20260911150145_member_week_reset_atomic.sql` to the existing Supabase project. The reset function is security-invoker, available only to service_role, and checks the member's active coaching relationship.
- Public website was not redeployed. No real member health declarations, payments, bookings, attendance, or progress were submitted during this fix pass. Two authorized sign-in test emails went to the retained `+membertest` alias.

## Verification

- All 33 portal tests, ESLint, TypeScript, and local/production builds passed.
- Local authenticated group-member checks confirmed Today onboarding, intake/enrollment links, start-date and check-in timing, and class policies. Intake and Classes fit at 320px; intake also fit at 390px. All five navigation tabs fit at 320px.
- Native intake validation retained the entered test contact value; it was cleared without submitting an intake. Unit tests cover conditional health, Other, and preferred-contact validation.
- Transactional database tests ran with rollback before and after migration: zero-day reset, overdue inclusion, future-week preservation, duplicate retry, wrong-member rejection, paused relationship rejection, and denied anonymous/member direct execution all passed.
- Local workout Start → Finish early selected the partial option without saving a session.
- Live authenticated Today, Progress, challenge switching, and Account/support rendered correctly. Switching programs stayed on Progress, and Account retained the chosen challenge.
- The first live Today load showed the generic error boundary; a full refresh recovered and subsequent navigation passed. This was observed around deployment, but its cause was not established. Do not claim it was definitively a deployment-only issue.
- Vercel connector runtime-log access returned 403. CLI historical queries exited successfully but returned no entries, so this does not establish error-free production runtime logs.
- Supabase security advisor reported existing findings; no new reset-function warning was reported.

## Remaining Kelsey inputs

1. Supply the November 7 9 AM Zoom link and confirm the 7:30 AM room. The portal handles a pending link, but the actual missing link is still missing. Adding a link does not automatically email existing registrants; share the final details with members.
2. Supply the final Goal-to-Action sheet and how members should complete it. The portal currently directs members to ask Kelsey.
3. Confirm whether class changes require separate contact and the preferred channel, plus where personal/virtual appointments are communicated and the expected ongoing coaching response time. Current copy asks members to communicate with Kelsey and does not invent a response-time promise.
4. Confirm the implemented zero-session reset policy: workouts are set aside, remain readable, and need Kelsey to reassign if they should return to the schedule.

## Limits

No real payment, class reservation/cancellation, signed intake/email completion, or personal-plan browser mutation was performed. Personal reset was tested directly in database transactions; the local app lacks its service-role key. No physical iPhone/Safari, screen reader, or audible sound check was performed. The production group-member intake walkthrough was verified on the local production build against the existing test enrollment, rather than repeated with another production sign-in email. The live smoke test used the retained challenge account. Full end-to-end lifecycle testing remains broader than this release's focused verification.


## Follow-up: Kelsey's coaching answers

Kelsey confirmed two separate November 7 classes; the actual Zoom links and final Goal-to-Action sheet remain outstanding. Updating a class selection in the portal is sufficient notification. Personal/virtual appointment days and times are determined during consultation and details are sent by email or text. Ongoing coaching response time is two hours.

For personal/virtual training, the intended flow is a Saturday or Sunday conversation about the coming week plus the weekly check-in form. Members should flag a busy week in advance so Kelsey can customize shorter workouts. Replaced the member-facing Wednesday Reset form with this coaching/contact guidance and updated personal-training links and class-notification copy. Existing reset history/backend and workout records are preserved; this change does not automatically alter any plan. The personal-training check-in URL has not been confirmed, so the interface directs members to the form Kelsey sends rather than reusing the group form without confirmation.

Verification: all 33 portal tests and lint passed. Production build/deployment result is recorded in project memory. No emails, member submissions, or database changes were made in this follow-up. No authenticated populated personal-training browser walkthrough was performed for this copy/form-removal change.
