# Holden Health Workout App Audit

## Recommendation

Holden Health needs a connected workout experience, not another pass at the marketing website and not simply more written workouts. The strongest lesson from Twenty Minute Marriage is its interaction sequence: identify today's action, inspect the workout, prepare, start, and return to visible progress. Holden currently distributes those responsibilities across a group-session portal, a habit challenge, a separate personal-training page, and a standalone timer.

Build a common member workout experience around **Today → Workout → Session → Completion → Progress**. Keep Holden's coaching voice, beginner adaptations, class scheduling, and personal-training options. Adapt the reference's task hierarchy and interaction patterns, not its branding, exercise programming, copy, or streak rules.

The existing implementation is not empty. Authentication, challenge enrollment, date-based publishing, saved habits, class details, a configurable timer, personal-training completion logs, and coach feedback are useful foundations. The next investment should join those foundations into one comprehensible product rather than rebuild everything or add a second timer.

## Scope and confidence

This audit covers the publicly accessible, logged-out workout app at Twenty Minute Marriage and the Holden implementation available on September 9, 2026. It includes both publicly linked workouts, the library and equipment controls, timer setup and start/pause/end behavior, streaks, Community, Nutrition, and the account entry screens encountered along the way. Marketing-site comparison is intentionally excluded. No reference account was created and no reference login was attempted.

Evidence is distinguished throughout:

- **Observed:** directly inspected through the live interface, including mobile screenshots.
- **Code-confirmed:** found in Holden's local implementation; not automatically a claim that every possible production state was exercised.
- **Recommendation:** proposed product behavior, not something the reference necessarily implements.
- **Not verified:** reference signed-in persistence, member-only screens, its admin workflow, and successful embedded video playback.

“Every page” here means every workout-related page discovered through the public navigation and the two linked workout records. It does not mean unknown private routes or unlisted workouts. The reference calls itself a prototype. Its public claims should not be mistaken for tested production completeness.[^1]

## Public app inventory

| Surface | Observed behavior | What it contributes |
|---|---|---|
| Today `/` | Featured workout, duration/format/equipment summary, readiness indicator, progress strip, library entry | A clear daily starting point |
| Workouts `/#finder` | Focus filters, equipment configuration, owned weights and units, workout cards, explicit empty-filter state | Discovery based on practical constraints |
| Day 2 `/workout/TT-0038` | Structured exercise/repetition list, format explanation, scaling and technique sections, demo, workout-start flow | Preparation and execution on one page |
| Day 1 `/workout/TT-0036` | Different exercise list, some inline movement expansion, demo, shared timer controls | A reusable detail template rather than one-off content |
| Streak `/streak` | Activity logging options, planned rest days, grace passes, badges, leaderboard preview, local-device notice | A reason to return beyond reading content |
| Community `/community` | No current challenge; an empty-state message | A reserved destination, not a demonstrated active community |
| Nutrition `/nutrition` | Four-question assessment entry and expandable educational rules | Another action-oriented app section; clinical accuracy was not assessed |
| Members/login/signup/recovery | Sign-in gates and account forms; signup mentions community name, email preference, and risk terms | Entry requirements only; excluded from the main redesign scope |

Sources: direct interface observations on the linked reference pages.[^1][^2][^3][^4][^5][^6][^7]

## Why the reference feels like a workout app

### A daily action takes precedence

The home screen makes the current workout the principal task. It tells someone what the workout is and what it requires before asking them to navigate a collection. The library is available, but choosing from scratch is not the only starting point. Progress and workout discovery are close to that daily action.[^1]

The transferable principle is **reduce the decisions before starting**. Holden's member should not need to work out whether their next action lives in the group portal, a challenge, or personal training. The home screen should resolve that for them without obscuring their other services.

### The detail page is part of doing the workout

The reference separates summary, equipment, instructions, exercise rows, explanations, and modifications. This allows a person to scan the round while expanding help only when needed. Starting a session is an explicit action rather than merely opening an unrelated utility.[^2][^3]

Holden's current challenge workout is principally a disclosure containing a long text block, a timer button, and external links. The content may be useful, but it does not provide the same structured exercise experience. Adding more paragraphs cannot solve the missing hierarchy.

### Mobile controls remain reachable

The sampled 390-pixel layout has a persistent bottom navigation, compact card summaries, and an accessible workout-start action. Workout instructions remain in a single-column reading flow. The sampled home and Day 2 pages did not horizontally overflow the viewport.

This is a mobile-web design observation, not proof of a native app, offline support, background timer reliability, or installability. There is also a caution in the screenshot: the fixed workout-start area competes with the bottom navigation. Holden should provide deliberate spacing for fixed controls and device safe areas rather than reproduce that arrangement literally.

### Supporting features reinforce returning

The streak page allows multiple kinds of activity and explains planned rest and exceptional missed-day protection. It distinguishes device-local demo state from signed-in functionality. Badges and a leaderboard preview are visible, but the signed-in social experience was not tested.[^4]

For Holden, the lesson is visible continuity and acknowledgement—not mandatory daily workouts or a leaderboard. Kelsey's coaching product can emphasize weekly consistency, recovery, and adaptations without making a beginner feel that one missed day erases progress.

## Interaction findings and limitations

| Check | Result | Interpretation |
|---|---|---|
| Open both listed workouts | Confirmed | Both use a common detail and start structure |
| Expand format/scaling guidance | Confirmed | Help is available without leaving the workout |
| Open equipment and load controls | Confirmed | Members can describe their available kit |
| Select Core filter | Empty state displayed | The shell is broader than the currently visible content |
| Begin workout | Timer setup opens | There is a clear transition from reading to timing |
| Start, pause, end timer | Confirmed in logged-out view | Basic clock controls were usable; ending returned to the start action |
| Timer modes | AMRAP, EMOM, For time, Tabata controls observed | Not all modes were timed through a full session |
| Log workout on Streak | Isolated demo changed from six to seven days, showed a logged state and badge, and survived reload | Confirms local progress feedback, not cross-device persistence or automatic logging from the timer |
| Open embedded demo | Embed loads a YouTube verification gate | Actual playback was not verified; do not describe this as a successful video test |
| Community | Empty state | No posting, moderation, or active challenge experience verified |
| Cross-device progress | Not tested | Requires account access, deliberately outside scope |

The reference's default equipment setup displayed two workout cards. Its descriptive copy mentions a larger library. The audit does not resolve whether that discrepancy reflects filtering, unpublished content, or stale copy. It is not evidence that the product has only two workouts in its database.[^1]

The logged-out streak also showed different values in an existing browsing session and a fresh isolated browser. Demo progress must not be presented as real engagement or evidence of server persistence. No production-readiness claims should be based on that counter alone.[^4]

The isolated completion test used a fresh browser context and was discarded when that browser closed. It did not change a real member account or the existing reference tab's local progress.

## Holden: what is actually missing

### 1. The member experience is split into separate products

**Observed and code-confirmed.** The group portal emphasizes intake, enrollment, payments, classes, check-ins and resources. The challenge page emphasizes three habits and a 21-day calendar. Personal training has a more task-oriented next-workout section and completion/history concepts, but those live on another route and depend on a coaching relationship.[^8][^9][^10]

This split explains much of the perceived difference. A new challenge participant is not getting the fuller personal-training experience. The solution is a shared member shell and workout surfaces with permissions controlling the content—not identical access for all members.

### 2. Challenge workouts are documents rather than structured sessions

**Code-confirmed.** The challenge workout model has a title, minutes, an equipment string, a plan string, demonstration links, a publication date, and an optional timer configuration. It does not currently model ordered exercise blocks with repetitions, duration, easier variations, or movement-specific coaching cues.[^9][^11]

A structured model would let the member see the current exercise, open its demo, and choose an easier version without hunting through paragraphs. A plain written plan should remain available as a compatibility fallback during migration.

### 3. Timer completion is not workout completion

**Code-confirmed and consistent with earlier live tests.** The challenge timer takes a title and preset, maintains timing state, and displays an end state. It receives no workout identifier or completion callback. There is no challenge-workout completion form or completion log in that rendering path. Finishing a timer therefore does not create a durable record that a particular workout was completed.[^9][^12]

This is a central product gap. Habit completion, class attendance, and workout completion are different events. They can inform one progress view, but must not be silently treated as interchangeable.

### 4. The default clock can contradict the workout

**Code-confirmed.** Without a valid preset, the timer defaults to 20 seconds work, 10 seconds rest, eight rounds: four minutes. It does not derive its format from the written workout or estimated duration. The newly added ten-minute gentle workout currently has no suggested timer preset.[^12][^13]

That is not a timer arithmetic bug. It is a missing connection between programming and execution. The safest default for a self-paced beginner plan is an optional elapsed-time display or no required clock, with the prescribed repetitions and rest guidance visible. A circuit timer should be used only when the workout actually calls for one.

### 5. Published and available now are different states

**Observed and code-confirmed.** The gentle workout is saved as **Scheduled** for September 21. Challenge queries require both a published flag and a release date no later than today. The admin participant-preview query applies that same release filter.[^9]

This means a successful publish action can still leave the member library empty. The present empty-state wording does not distinguish “nothing has been prepared” from “your first workout unlocks September 21.” The earlier confusion is understandable even when the filtering is technically correct.

### 6. Habit saving blocks neighboring inputs

**Observed and code-confirmed.** A single pending transition disables every goal checkbox and the day selector. Rapid consecutive taps can be ignored while the prior save is pending.[^14]

Use per-item saving state or a small reliable update queue, show the intended state immediately, and restore it with a clear error if saving fails. Preserve server validation and prevent out-of-order writes. This is a usability fix, not a reason to weaken date or ownership restrictions.

### 7. Publishing tools do not yet manage a workout product

**Observed.** Kelsey can enter text, links, dates and timer settings, and can publish/unpublish. The tested challenge UI has no archive/delete action, no clearly distinct future-date workout preview, and no structured movement editor. Participant reports focus on completed habit days rather than challenge-workout attempts.

A richer member player depends on a manageable content workflow. Otherwise the complexity moves from the member to Kelsey and becomes hard to maintain.

## Existing capabilities worth preserving

The personal-training page already contains unusually relevant Holden-specific features: full/shorter/keep-the-promise plans, a recommended option, energy and effort feedback, completion notes, personal wins, workout history, coach responses, and a reset of the remaining week. These are code-confirmed capabilities, not a statement that they were all retested live during this reference audit.[^10]

These are stronger differentiators than copying the reference's exact streak system. Preserve them and make the same workout-detail/player components usable from both challenge and personal-training contexts. Keep their access rights and logging rules explicit.

Also retain the existing timer engine's wall-clock calculation, pause behavior, audio controls and wake-lock handling. Improve its connection to the workout and saved session; do not replace it simply to achieve a new appearance.[^12][^13]

## Recommended member app

### Navigation and daily hierarchy

Use four persistent primary destinations: **Today, Workouts, Progress, More**. More can hold classes, resources, account and support. A challenge should be a program context within the app, not a separate visual universe. Classes can be promoted on Today when one is next; they should not disappear from an in-person member's experience.

Today should answer one question first: “What is my next useful action?” A compact greeting is followed by the appropriate workout or recovery card, duration and equipment, and one clear action. Today's habits and weekly progress follow. Kelsey's note is secondary. Enrollment paperwork belongs in a contextual banner when needed, and commercial upgrade messaging should not compete with an active workout.

Proposed member journey:

`Today → Workout details → Start session → Exercise / timer view → Confirm completion → Updated progress`

A direct Workouts route should also support discovery and replay. Preserve browser Back behavior and deep links so members can reopen a specific workout rather than depend on a long-page scroll position.

### Workout detail

Provide a consistent summary: title, level, expected time, equipment, plan version and Kelsey's short note. Separate warm-up, main work and cool-down. Each movement should have a clear quantity, concise instruction, optional demo, and an easier alternative where appropriate. Keep modifications adjacent to the movement they modify.

Offer “Start workout” as the principal action, with “Read full plan” as an alternative. Do not require someone to use a timer to complete a self-paced session. External demonstration links need a useful fallback and must not be the only source of instructions.

### Session and completion

The active session should retain the exercise context: current movement, quantity, relevant rest and access to the plan. Timed formats should start with coach-configured values. Self-paced formats should not acquire a Tabata routine by accident. Pause, resume and end controls must be large and unambiguous.

Ending a clock should not automatically assert that a workout was completed. Ask whether to save completion, save a partial session, or discard it. Keep optional feedback brief: effort, changes and a note for Kelsey. Save against the authenticated member and workout version, use an idempotent submission, and update Today and Progress after success.

Recover an in-progress session after a reload where practical. Clearly explain what persists and what does not. Do not claim background audio or screen-awake guarantees that the device cannot provide.

### Progress without punishment

Show completed workouts against the member's weekly intention, habit progress, and a simple activity history. Count a shorter approved plan as valid effort. Distinguish rest, not-yet-enrolled days, unavailable future workouts and missed opportunities. Keep workout counts separate from three-habit completion.

Start with private progress. Badges can come later. A public leaderboard is not required to make this feel like an app, and should require deliberate privacy and consent decisions.

## Recommended Kelsey workflow

Move toward **Draft → Preview → Scheduled/Available → Archived**. Unpublish remains useful, but archive should keep historical records and remove obsolete items from the active editing list. Permanent deletion should be narrowly available for unused mistakes and clearly explain any consequences.

Use a reusable workout library with ordered movement blocks, optional timer presets and a separate program assignment/release date. Provide duplication so Kelsey can adapt a previous plan quickly. Add a read-only preview that can explicitly show a selected date without modifying production dates or recording member activity.

Before publishing, validate required content, exercise quantities, expected duration, useful alternatives, demonstration links, and timer consistency. Make scheduled visibility unmistakable. An admin should be able to see why a specific member can or cannot access a workout.

At completion, Kelsey should see the workout, plan version, completion or partial status, member feedback and relevant date. Existing personal-training feedback concepts should be reused where appropriate rather than create a competing reporting system.

## Implementation order

| Priority | Deliverable | Reason and completion criterion |
|---|---|---|
| 1 | Shared mobile member shell and Today screen | A member immediately sees the correct next action; classes and other services remain reachable |
| 1 | Dedicated workout detail + workout-aware session | Both challenge and training entry points render structured instructions and use suitable timing |
| 1 | Durable workout completion and progress | Finish/reload/admin-report round trip works; duplicate submissions do not double count |
| 1 | Scheduled-content messaging and read-only preview | Members understand unlock dates; Kelsey can inspect future material without changing dates |
| 2 | Structured admin builder and safe archive | Kelsey can create, duplicate, preview, schedule and retire plans without code changes |
| 2 | Per-habit save behavior and session recovery | Rapid taps and interruptions do not lose intent or create misleading success states |
| 2 | Useful library filters | Start with duration, equipment and level; avoid decorative empty categories |
| 3 | Optional engagement features | Consider badges or community only after the workout loop and content supply are reliable |

This is not a recommendation to launch a native app or add a large dependency immediately. The desired experience is achievable in the existing web stack. Routing, content structure, state persistence and interaction design matter more than a framework change.

## Release acceptance tests

1. A challenge-only member, an in-person member and a personal-training member each land on a valid Today state and cannot see another member's protected content.
2. A published workout appears only for eligible members at the intended date boundary; a scheduled workout has an informative locked state where appropriate.
3. A draft/future preview works for Kelsey, writes no participation data and cannot be enabled by a member URL parameter.
4. A ten-minute self-paced plan does not start a four-minute interval routine by default.
5. Every exercise remains understandable if a video is blocked or unavailable.
6. Starting, pausing, closing, reopening, refreshing and backgrounding have explicit, tested effects on session state.
7. Completion is saved once and survives refresh; personal history and Kelsey's report agree.
8. Cancelled and partial attempts do not silently become full completions. A deliberate retry does not create an accidental duplicate.
9. A rapid sequence of habit taps retains all valid requested changes or explains a save failure.
10. At 390 pixels and narrower target phones, fixed navigation and workout controls do not cover actionable content, including with a keyboard or device safe area.
11. Archiving hides future discovery while preserving historical completion records according to a documented policy.
12. Rest days, pre-enrollment dates and program boundaries produce honest progress rather than punitive or inflated counters.

## What not to copy

Do not copy the orange/black branding, typography treatment, exercise routines, distinctive phrasing, nutritional rules, or demo data. Nutrition advice and exercise suitability require their own professional review; the reference's presentation is not evidence that its prescriptions are appropriate for Holden members.

Do not copy empty categories or placeholders merely to achieve navigation parity. Do not use local demo streaks as the model for authenticated persistence. Do not prioritize a social feed before workout completion works reliably. Do not assume a timer and a plan on the same page already constitute a guided workout session.

The right adaptation is a daily-use product with Holden's own coaching logic: clear next steps, approachable movement instructions, flexible plans, reliable progress and useful communication with Kelsey.

## Evidence images

These are reference-app captures from an isolated logged-out browser. Streak values are demo state, not real member data. Fixed UI elements in full-page captures remain positioned relative to the capture viewport.

- [Today, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/today-mobile.png)
- [Day 2 workout, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/workout-day2-mobile.png)
- [Day 1 workout, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/workout-day1-mobile.png)
- [Streak, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/streak-mobile.png)
- [Community empty state, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/community-mobile.png)
- [Nutrition entry, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/nutrition-mobile.png)
- [Timer setup, mobile](/Users/barris/Desktop/holden-health-site/docs/workout-app-audit/timer-setup-mobile.png)

## Sources

All live pages were inspected on September 9, 2026. The reference app was inspected without login. Holden source files are local implementation evidence; earlier authenticated behavior is identified as such rather than attributed to the reference app.

[^1]: Twenty Minute Marriage, [Today and workout finder](https://www.twentyminutemarriage.com/), live public app.
[^2]: Twenty Minute Marriage, [Day 2 workout](https://www.twentyminutemarriage.com/workout/TT-0038), live public app.
[^3]: Twenty Minute Marriage, [Day 1 workout](https://www.twentyminutemarriage.com/workout/TT-0036), live public app. Embedded YouTube playback was blocked by a verification gate in the inspected browser.
[^4]: Twenty Minute Marriage, [Streak](https://www.twentyminutemarriage.com/streak), logged-out local-device interface.
[^5]: Twenty Minute Marriage, [Community](https://www.twentyminutemarriage.com/community), live empty state.
[^6]: Twenty Minute Marriage, [Nutrition](https://www.twentyminutemarriage.com/nutrition), interface only; medical/nutritional claims not validated.
[^7]: Twenty Minute Marriage, [Members](https://www.twentyminutemarriage.com/members), [Login](https://www.twentyminutemarriage.com/login), [Signup](https://www.twentyminutemarriage.com/signup), and [Recovery](https://www.twentyminutemarriage.com/forgot-password). Forms inspected, not submitted.
[^8]: Holden Health, [group member portal implementation](/Users/barris/Desktop/holden-health-site/web-app/src/app/portal/page.tsx).
[^9]: Holden Health, [challenge rendering and visibility rules](/Users/barris/Desktop/holden-health-site/web-app/src/app/challenge/page.tsx).
[^10]: Holden Health, [personal-training implementation](/Users/barris/Desktop/holden-health-site/web-app/src/app/portal/training/page.tsx).
[^11]: Holden Health, [challenge and workout data types](/Users/barris/Desktop/holden-health-site/web-app/src/lib/challenge.ts).
[^12]: Holden Health, [workout timer component](/Users/barris/Desktop/holden-health-site/web-app/src/components/workout-timer.tsx).
[^13]: Holden Health, [timer modes, defaults and timing logic](/Users/barris/Desktop/holden-health-site/web-app/src/lib/workout-timer.ts).
[^14]: Holden Health, [habit tracker saving and eligibility UI](/Users/barris/Desktop/holden-health-site/web-app/src/app/challenge/tracker.tsx).
