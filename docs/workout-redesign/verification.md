# Workout redesign — September 9, 2026

The user supplied an iPhone photo and asked for a more polished, intuitive, responsive workout app. The photo showed nested notices and large instruction cards pushing workout controls below the fold.

## Delivered

- New workout library cards with duration, level, movement count, and a clear opening action. Filters collapse when unused.
- The challenge picker on Workouts now stays within Workouts instead of navigating to Today.
- Cleaner preparation screen with a start panel, compact movement lineup, expandable equipment and coaching notes.
- Focused active player: compact back navigation, dark timer panel, one movement, visible progress, expandable easier option, demonstration link when available, and next movement context.
- Active sessions hide the general app navigation. Sticky pause and next/finish controls occupy the bottom of the player. An explicit Back to workouts link remains available; recovery restores the same step paused.
- Clear completion/partial choices, optional effort and note, and a focused success screen with Progress and Today links.
- Original workout content, timer configuration, database policies, save validation, stable session IDs, and member isolation preserved. No dependencies or database schema changes.

## Verification

- ESLint passed; all 20 existing portal tests passed.
- Local production build and final Vercel production build passed, including TypeScript.
- Browser inspection at 390×844 and 320×568: no horizontal overflow; active controls remain at the viewport bottom. Smaller phones scroll longer instructions above the controls.
- Desktop player inspected at 1440×960.
- Browser tested start, pause, movement navigation through all six steps, reload/recovery to the same step paused, early finish, final finish, and check-in.
- Local production build against live data: saved one partial session with effort 3 and a note, plus one completed session. Confirmed the exact rows in the database and partial-session history in member Progress.
- Final deployed portal: signed in the disposable member, started the player, measured 390px document width, hidden general navigation, and controls ending at the 844px viewport boundary. Saved a third, clearly labeled partial session and inspected the final success screen.
- No browser runtime or console errors returned during these checks. This is browser evidence, not a production runtime-log audit.
- Phone checks used a resized Chromium browser, not a physical iPhone/Safari. The user’s supplied iPhone photo was inspected before implementation.

## Deployment

Portal READY: `dpl_FGNtHZacKbFM1zYX7YmsJgLevaBo`.

https://portal.holden.health

Deployed with `npm run deploy:portal` from the workspace root. The public site was not redeployed and the hosting architecture was preserved.

## Cleanup and retained data

One disposable DEMO Workout Design QA identity was created, using an invalid email address, is_test=true and email_opt_in=false, and joined to the existing active test challenge. Its three test logs, participant record, profile, contact, auth identity, and sessions were deleted after verification. Temporary credentials were removed and local servers stopped. No email was sent.

The five earlier Story Pilot demo accounts and the user’s enabled test workout remain available. No workout was completed on the user’s own account.

## Screenshots

- [Mobile player](mobile-player.png)
- [Desktop player](desktop-player.png)
- [Mobile library](mobile-library.png)
- [Mobile success](mobile-saved.png)
