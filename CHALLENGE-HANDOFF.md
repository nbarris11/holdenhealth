# 21-day habit challenge

## Implemented

- `/challenge`: public email signup/sign-in, then three suggested/custom goals and a weekly workout intention.
- Shared September 21–October 11, 2026 calendar; pre-enrollment allowed and late arrivals start on their join date.
- Account-based checkmarks, backfill from join date, no future checkmarks, and saved goal snapshots.
- `/admin/challenges`: create/edit challenges, edit categorized options and announcements, add WhatsApp invite, create/edit/unpublish/date-schedule workouts with individual demonstration links, and view participants.
- Read-only admin participant preview, with no fake workouts or member records.
- Six-week session and online-training links after the challenge; published workouts remain available afterward.
- Challenges navigation in admin; free challenge entry from portal home and member portal.

## Database

Applied `20260908022548_habit_challenge.sql` to Holden Health (`urxxiohatmvqbgrzqibq`). The seeded September challenge is **unpublished, signup closed**, with 21 suggested habits. No workouts have been seeded.

New challenge tables are separate from paid enrollments, intake, coaching, and payments. No service key is used in the challenge app. Row-level policies limit participants to their own enrollment/checkmarks; admin accounts manage content and read participation. Habit snapshots cannot be edited after joining. Dates lock once anyone joins.

## Verification

- `npm run lint` and `npm run build` in `web-app`.
- `node --experimental-strip-types --test web-app/tests/challenge.test.mjs` from repository root.
- `supabase/tests/habit_challenge_rls.sql`: transaction/rollback tests on the connected database covering anonymous access, cross-user reads/writes, paid-content isolation, late-join dates, future dates, publication timing, snapshot immutability, and checkmark undo. All test users and content rolled back.
- Supabase auth settings checked: email enabled, public signup enabled, email confirmation required.
- Database security advisor: no findings on the new challenge objects. Existing project notices remain unrelated to this change.

## Before launch

1. Kelsey reviews the challenge in admin and adds final welcome text, workout plans, exercise URLs, and WhatsApp invite. Water goal intentionally reads “Meet my daily water goal.”
2. Portal deployed successfully to https://portal.holden.health on September 7, 2026 (Detroit time). Deployment: dpl_Q1NWtu9mHZDznghaamPkmQQ5RFQG. Review /admin/challenges with an admin account.
3. Future portal deployments must use `npm run deploy:portal` from the repository root. Challenge remains unpublished with signup closed.
4. Check an actual email sign-in round trip on the deployed domain, including first-time signup and returning participant. No real email was sent during development. Supabase email templates/redirect allowlist must preserve `/auth/confirm` with its `next` destination; a same-browser cookie also preserves the challenge destination for older templates.
5. Open the challenge page and signup in admin when ready. Confirm the phone experience and verify a checkmark from another signed-in device.

The public website has not been changed. If promoting the challenge on its homepage is desired, add that CTA after the portal review. Follow the separate site deployment command for that change.

## Workout timers — September 8

- Every published challenge workout has a timer with work/rest (including Tabata), EMOM, countdown/AMRAP, and stopwatch/for-time modes.
- Admin can save an optional timer preset per workout and test it in the editor. Participants may adjust settings before starting.
- Pause/resume, reset, volume/mute, and optional screen wake lock. Closing pauses; navigating away ends the timer. Timers do not automatically mark habits complete.
- Work/rest includes the rest after the last round: 8 × (20 + 10) = 4 minutes. Follow the written plan for exercise changes; the timer does not infer movements from text.
- Clock anchors prevent accumulated callback drift. Background audio is not guaranteed; test cues on the actual phone while keeping the timer visible.
- `web-app/tests/workout-timer.test.mjs`: interval boundaries, zero rest, EMOM, count-up/down, pause/resume and background elapsed time, invalid settings.
- `supabase/tests/workout_timers.sql`: saved preset validation and removal, rolled back without leaving fixtures.
- Timer deployment READY: `dpl_GKJvGRtdDarm1QNv4cPTYyV5M69X`, aliased to https://portal.holden.health. Production build passed; challenge remains in draft. Device-level audio/wake-lock testing remains a launch check.
