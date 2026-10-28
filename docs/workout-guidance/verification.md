# Workout guidance and timer sounds — September 9, 2026

Production portal deployment: `dpl_3rvneTrW339pTNLEwFohAMxycXfa`, READY, aliased to https://portal.holden.health. Deployed from repository root using `npm run deploy:portal`. No public-site deployment, dependency, migration, or workout-content schedule changes.

## Changes

- Personal Today greeting with the existing Kelsey portrait, actual member goal/recap card near the top, compact program details, existing workout/weekly progress/habit flows preserved.
- Original paired SVG movement illustrations for chair sit-to-stand, wall push-up, supported heel raise, seated march, goblet squat, dumbbell Romanian deadlift, one-arm dumbbell row, and suitcase carry. Explicit title matching avoids displaying a guide for unfamiliar variations. Original written instructions and easier options remain accessible. Row is explicitly bench-supported. Form reference links are in `web-app/src/lib/movement-guide.ts`.
- Circuit round labels distinguish two programmed strength rounds and the optional third round from the independent interval timer.
- Optional 30/60/90-second rests pause the workout clock. Rest pause/resume uses wall time, reload restores paused, and completion waits for explicit Continue on the same movement.
- Timer sounds are opt-in with a remembered per-member device preference. A tap unlocks Web Audio and previews a tone. Three gentle beeps at 3/2/1; a two-tone chime at timed phase/round transitions and completion. Stopwatch mode has no arbitrary countdown sounds. Muting closes audio immediately; no audio assets/dependencies. Background/locked-phone playback is not promised: keep the app visible and media volume on.
- Saved-session confirmation reads the member's actual completed count for this challenge in the current Detroit week; partial sessions are excluded. Existing idempotency and RLS remain.

## Verification

- ESLint, all 26 portal tests, and production build passed. Tests include countdown deduplication, pause suppression, finish-after-rest-stops, work-only interval transitions, movement title matching, circuit labeling, wall-time rest, and existing workout/time/progress cases.
- Disposable ordinary member, marked test and email-opted-out, authenticated via normal password login. No coach role or email sent.
- Browser walkthrough at 390×844 and 320×568: no horizontal overflow; movement illustrations, navigation, optional rest, pause/resume, reload recovery, same-step return, check-in during rest, partial and completed save. Desktop Today checked at 1440×1000.
- All eight diagrams visually inspected. Adjusted bench-supported row contact points before deployment. Sources guide the illustrations; Kelsey has not reviewed or approved them.
- Browser Web Audio instrumentation verified exactly three single 660 Hz countdown cues plus a 660/880 Hz finish chime. Work/rest transitions also verified; no new tones while muted. This verifies audio scheduling in Chromium, not physical speaker output or iPhone/Safari behavior.
- Partial save displayed zero completed workouts; subsequent completed save displayed one. Database read verified both statuses and elapsed durations. Live Today displayed the member's actual synthetic goal and one completed workout.

## Kelsey follow-up

Requested answers: rep-based/manual Next versus timed work/rest; preferred rest between exercises and rounds; her cue/easier option for each strength exercise; review of illustrations; Today priority (assigned workout, weekly plan, or time/energy choice); chest press on bench or floor. Chest press remains written guidance until the intended variation is confirmed. No fabricated coaching approvals or Kelsey videos.

Screenshots in this directory use only synthetic member data. Local screenshots supplement production Today/workout screenshots. Physical iPhone/Safari testing remains a useful follow-up.

Live 30-second rest produced the three countdown cues and two-note finish chime, then stayed at Rest complete. Continue returned to Goblet squat. Production save succeeded and displayed two completed workouts; database confirmed one partial and two completed QA logs. No browser errors were reported. The disposable QA member (`bc8a905e-eda8-43fd-8b11-1f90814b3cc4`), three logs, goal, participation, contacts/profile, sessions, and auth identity were removed after testing. Original five demo stories and the user's two enabled test workouts remain. Temporary browser/server processes were stopped and credential files removed.
