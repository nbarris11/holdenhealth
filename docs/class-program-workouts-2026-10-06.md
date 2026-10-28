# Class program at-home workouts — October 6, 2026

## Status

**Deployed to production.** Portal deployment `dpl_ANamUeMhmi5ZXTqS4Z9U3QshSdhe` is READY at https://portal.holden.health (deployment URL: https://holdenhealth-portal-e8tljuwbz-holden-health.vercel.app). Production build passed. No public-site deployment was needed.

Deployed from the repository root using `npm run deploy:portal` with the isolated Holden Health CLI configuration. Portal project remains `prj_LzxwoIclyvUBY8h7ngTGtXxQImaH`, team `team_46Yzfi7HIFgzLAbu1VvGJyWV`, Root Directory `web-app`.

### Vercel setup verified October 6

Followed https://vercel.com/get-started.md. Global CLI updated to 62.5.0. Holden Health credentials are saved outside the repository at `/Users/barris/.config/vercel-holden-health` (directory mode 700, files 600). Explicit `vercel whoami --global-config /Users/barris/.config/vercel-holden-health` returns `keholde-1435`. The new CLI did not select this config using the environment variable alone, so direct CLI calls must pass `--global-config` explicitly. The portal deployment script already forwards that argument from `VERCEL_GLOBAL_CONFIG`:

```bash
cd /Users/barris/Desktop/holden-health-site
VERCEL_GLOBAL_CONFIG=/Users/barris/.config/vercel-holden-health npm run deploy:portal
```

The user-scoped Vercel plugin is installed and enabled. Its managed MCP connection is authenticated to Holden Health: `search_vercel_documentation` and `list_teams` both succeeded. No duplicate MCP connection or skills were installed, and no reload was needed. The existing separate `vercel-teeahead` entry at `https://mcp.vercel.com` in `/Users/barris/.codex/config.toml` was preserved. Plugin permissions were not broadened; retain human confirmation for MCP mutations per the setup guide.

## Delivered

- Each class program in Programs has an At-home workouts button. Editor route: `/admin/programs/[programId]/workouts`.
- October program: `e513111f-17b2-4f2d-bc4d-18593c448378`, Focus on You: First 6-Week Session, October 13–November 21. December program also has its own editor.
- Reuses the existing three-step workout builder, exercises, timer presets, shared library/templates, drafts, release dates, archive/restore and admin preview. New saves redirect to the saved draft with a visible confirmation.
- Workouts are attached directly to a class session. Members use their existing enrollment; no free-challenge signup is required. Released class workouts appear in Today and Workouts, with program filters and a link from Classes.
- Completed and partial sessions use the existing player, snapshots and duplicate protection. Counts feed Today and progress stories. The program editor shows the latest 100 check-ins with names, completion state, effort and notes.

## Database

Applied additive migration `20261006221121_class_program_workouts.sql` to Supabase `urxxiohatmvqbgrzqibq`.

Existing `challenge_workouts` now accepts exactly one of `challenge_id` or `session_id`. Existing `challenge_workout_logs` accepts exactly one of `participant_id` or `enrollment_id`. Existing free-challenge rows and behavior are retained. Indexes cover class program scheduling and enrollment history. Saved workouts cannot move between programs. Class release dates must fit program dates.

Database access requires an eligible enrollment and a published, available parent program. Draft, archived, future and unrelated workouts remain private. Withdrawn members lose workout access but keep their own recorded history. Completed members may revisit released plans but cannot create new check-ins. Class logging requires an invited/active enrollment during the program dates. Database triggers own the log timestamp, revision, title and snapshot.

The schema change is compatible with the previous application and the new production release.

## Verification

- All 170 portal tests passed, including five new tests for class/free scope, date validation, draft/publish behavior, admin authorization and editor invalidation. The new-save redirect adjustment also passed the five affected tests afterward.
- ESLint, TypeScript and final local production build passed.
- Rollback-only SQL test in `supabase/tests/class_program_workouts.sql` verified admin creation/preview, member read/write denial, hidden drafts/future releases, class and member isolation, snapshot integrity, withdrawn/completed behavior, parent visibility, invalid dates and parent reassignment rejection.
- Authenticated Chromium walkthrough against the local production build and live database: saved a draft with a movement; previewed it; scheduled tomorrow and confirmed member denial; changed release to today; confirmed unrelated-member denial; opened the workout from member Workouts and Today; completed it and saved a note; verified weekly count, progress story and coach check-in. A second draft verified visible save confirmation and automatic opening of the saved workout.
- At 390px, 320px and 1440px, the admin editor had no horizontal document overflow. Inspected phone screenshots, workout preview and member player. Verified real October/December program buttons and the empty October editor without saving any real program content.
- Security advisors reported the existing service-table, admin RPC and leaked-password-protection findings. Performance advisors also noted the expected new, not-yet-used enrollment index. No new security issue was reported for this feature.
- Local server emitted an `after()` error about missing Supabase server credentials for background instrumentation. Workout saves and verification passed; background instrumentation was not verified in this local environment.

## Cleanup and limits

Three synthetic identities, one synthetic class program, two synthetic workouts and the synthetic completion were used. All three accounts were signed out globally before exact-ID cleanup. Database verification found zero leftover users, profiles, programs or workouts. Temporary QA credentials/scripts/virtual environment were removed; the local server stopped. Holden Health CLI authentication is now retained in the private configuration directory documented above.

No real member, class workout, enrollment, payment or email was changed. The live editor route returns the expected 307 redirect to admin login when unauthenticated. No physical iPhone/Safari test or authenticated live deployed UI verification has been completed. Screenshots are in `docs/class-workouts/`.
