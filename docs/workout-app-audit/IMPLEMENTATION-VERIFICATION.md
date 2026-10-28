# Connected workout app — release verification

September 9, 2026. Production: https://portal.holden.health

## What shipped

- Member navigation: Today, Workouts, Progress, More. Habits have their own screen. Existing enrolled challenge links lead into Today.
- Dedicated workout details and guided sessions: warm-up/main work/cool-down, dose, instructions, easier options, optional demonstration links, pause/resume, and device-local paused recovery after reload.
- Self-paced elapsed clock when no coach timer is set; explicit coach presets are respected. Finishing a timer never silently records a workout.
- Completed/partial check-ins, optional effort and note, durable server-side history, weekly totals, and Kelsey’s participant/session reports.
- Kelsey can author/reorder structured steps, preview draft/scheduled sessions without recording progress, and archive/restore challenges or workouts. Restore stays unpublished. Archive keeps history.
- Personal training remains intact: the next personal workout is linked from Today, its completion contributes to the weekly overview, and the existing Plan A/B/C, logs, feedback, and Reset remain available. It has not been rewritten into the challenge session player.
- Existing class calendar/details, intake, payment display, resources, and check-ins retained under `/portal/session`. Mutation invalidation includes the whole member layout.
- Habit saves disable only the affected checkbox and retain responsive feedback.

## Verification evidence

| Boundary | Result |
| --- | --- |
| Build/type check/lint | Local production build and TypeScript check passed; ESLint passed. Final Vercel production build also passed. |
| Unit tests | 14 tests passed: dates, eligibility, timer modes/boundaries, pause math, step validation, safe links, self-paced fallback, and recovery-key isolation. |
| Member session | Existing test member signed in through normal email-link flow. Local UI opened a two-step test workout, moved to step 2, paused at 6 seconds, reloaded, and restored paused at step 2/6 seconds. |
| Completed save | Member UI saved one completed TEST session. Progress showed 1 completed workout; Kelsey’s live report and database showed the same 6-second record and test note. |
| Production partial save | In-app test member saved a 5-second partial TEST session on production. Progress showed both records but still only 1 completed workout. Admin report showed 1 complete + 1 partial, with the matching notes. No actual exercise was performed. |
| Habit save | Unchecking a test habit left a different habit enabled while saving. Saved state was shown; the original checkmark was restored. Admin report returned to 1/1 complete days for this test member. A second rapid browser action hit an automation deadline; it was not counted as an app failure or a passed concurrency test. |
| Mobile | Inspected 390×844 Progress screenshot; document width was 390px, with no horizontal overflow. Inspected desktop Today and workout detail screenshots. Temporary viewport override reset. |
| Admin editor | Used production UI to add and save six steps to the existing real beginner workout and set its level to Beginner. Written plan, demonstration references, equipment, duration, and scheduled release date preserved. |
| Read-only preview | Admin preview showed the scheduled real workout and six steps. Its session check-in save control was disabled. A member requesting the same URL with `preview=1` received 404. |
| Archive/restore | Final production inline confirmation archived the TEST challenge; the publish checkbox refreshed unchecked. Restore returned it as an unpublished draft. It was archived again for cleanup. Its TEST workout was also archived. |
| Member reflection | Archived challenge disappeared from member selection/library. Saved completed and partial history remained available. |
| Calendar regression smoke check | Existing test member’s December calendar loaded at its new route; opening December 5 displayed date, time, location, notes, and Save my spot. No booking was changed. |
| Database access | Transactional authenticated-role tests passed: scheduled workout hidden; own available workout readable; own session insert allowed; cross-member insert denied; unrelated member unable to read private log; server replaced forged title/date with authoritative snapshot/date; unpublished parent hid workouts while retaining own history. Test SQL changes rolled back. |
| Runtime logs | No error-level entries returned by the deployment log scans. The captured browser error entries referenced Chrome-extension URLs. Local development output also contained an initial login hydration warning and a destination-stream-closed message during reload testing; these were not reproduced in the production smoke checks. This is a bounded smoke check, not a guarantee of all future runtime behavior. |

## Content and cleanup

The real challenge remains published for September 21–October 11. **“Start here: Gentle strength & movement” remains scheduled for September 21**, with six guided steps and no forced interval timer. It is not prematurely unlocked for members.

The active TEST challenge and its TEST workout are archived and recoverable. Two clearly labeled TEST session records remain in the existing test member account to demonstrate preserved history. The other earlier TEST challenge remains an unpublished draft. No real member history or enrollment was deleted.

## Deployment

- Final deployment: `dpl_Ah71C7D3rPxg4YLzRe1aemmbjyVo`
- Status: READY, production, Next.js 16.3.1.
- URL: https://holdenhealth-portal-aw7qgpka8-holden-health.vercel.app
- Production alias: https://portal.holden.health
- Deployed from repository root using `npm run deploy:portal`. Public website and Vercel Root Directory settings unchanged.
- Additive database migration: `supabase/migrations/20260909133656_connected_workout_app.sql`. Filename aligned with the migration version assigned by Supabase.
- No Git commit: this workspace is not a Git repository.

## Remaining scope and follow-up

This release implements the connected challenge-workout experience; it does not claim full feature parity with the reference app. A larger workout catalog, original exercise demonstration videos, richer personal-training session playback, and broader device/accessibility tests are follow-up work. Payments, email delivery campaigns, and the entire personal-training workflow were not re-tested end to end in this release.

The Supabase advisor returned no finding for the new workout-log table/functions. Existing advisories remain outside this change: [admin RPC executability](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and [checkout table RLS without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Review these separately without weakening the existing private-table access model.

The Next.js/React skills informed server-side ownership checks, cached per-request member reads, parallel independent queries, and small interactive client components. The Supabase skill informed additive migrations, row-level security, and authoritative saved snapshots. Existing hosting was preserved rather than migrating platforms.
