# Public app demo — September 9, 2026

Shareable entry: https://portal.holden.health/demo
Direct workout: https://portal.holden.health/demo/workout

## Implementation

- Public `/demo` routes for Today, Workouts, the actual guided workout player, Habits, and Progress. No sign-in, shared password, test identity, or database write.
- Synthetic Avery persona and clearly labeled sample content. Canonical 20-minute workout copied from `docs/workouts/20-minute-strength.json` into the deployable app. This copy must be updated explicitly if the canonical workout changes.
- Existing member player defaults to its unchanged authenticated save action. Demo mode selects a separate browser-only save function and demo navigation, with practice-only labels. Existing server-side authentication and database protections are unchanged.
- Versioned local browser storage holds demo goals, wins, habit checkmarks, and up to 100 practice check-ins. Each browser has independent data. Reset clears demo activity and demo workout recovery only. Blocked storage falls back to memory for the current page session; it cannot persist across reloads in that case.
- No account creation, email, payment, real-member reads, or coaching publication. The demo does not exercise those workflows. Goal/habit/progress pages are representative demo screens; the workout player is shared with the real member app.
- Search engines instructed not to index. Anyone with the public link can view the sample workout. Member/admin routes remain protected.

## Verification

- 26 existing portal tests passed, plus two new tests for local-only saves, retry deduplication, partial-session exclusion, corrupt storage fallback, blocked storage, and preserving real-member recovery on reset.
- ESLint and local production build passed; TypeScript passed.
- Anonymous local production browser: Today → workout → start → finish early → completed practice save → Progress. Check-in appeared with expected count and synthetic note. Goal edit and habit checkbox persisted across navigation/full reload. Reset cleared demo sessions.
- Phone widths 390×844 and 320×568 had no horizontal overflow on Today; Progress checked at 390px. Mobile Today screenshot included. No browser errors reported during this walkthrough. Physical iPhone/Safari and sound output were not retested.
- Anonymous member Today and admin Stories both returned 307 sign-in redirects.

## Deployment

Portal `dpl_A6nBQ6hds6hqhouvyV5hKWd7GRgW` READY, https://portal.holden.health. Root `npm run deploy:portal` used; Vercel production build passed. Public site unchanged. No database migration or production member records changed.

Live checks: all five demo destinations returned HTTP 200 without credentials. Member Today redirected to `/login`; admin Stories redirected to `/admin/login`. A fresh anonymous production browser rendered the demo workout and Start workout control at 320px. Local browser-only save walkthrough is recorded above; no production database writes were performed.
