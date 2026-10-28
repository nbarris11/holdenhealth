# AMRAP repeat fix — September 21, 2026

The screenshot showed “3 to 18 Reps Full Body AMRAP” at movement six with 19:37 remaining but a Finish & check in button. The shared player previously used only the end of the movement array to select check-in.

Countdown mode is the existing coach “AMRAP / Countdown” setting. It now repeats the main-work circuit while time remains. Repeat round shows the first main movement as next; the elapsed timer and session ID are preserved. At expiry, any main movement advances to the cooldown, if present, otherwise check-in. The handler rechecks current wall time on click. Warm-ups and cooldowns do not loop. Other timer modes remain sequential; early finish and optional paused rest remain unchanged.

Changed: shared session component, workout-app navigation helper and five regression tests. No new dependencies or database/content/member writes.

Verification: all 103 portal tests passed. A synthetic fixture bundled the actual session component, substituting only navigation/server-save boundaries. Chromium at 390×844 and 320×844 passed three circuit loops, unchanged timer, pause, 30-second rest, reload recovery, mid-round expiry and check-in navigation; no browser errors or horizontal overflow. No save was submitted. Physical iPhone/Safari and authenticated live member flow were not tested. Fixture/screenshots reside under /tmp/holden-amrap-preview.

Local lint failed inside installed Babel/semver dependencies; local full TypeScript processes stalled and were stopped. No local lint/full TypeScript pass claimed. Clean Vercel production build and full TypeScript checks passed. Portal deployed through root `npm run deploy:portal` with the isolated Holden Health login; deployment `dpl_DPEmsY4X2qHn88KWiNrbMKspu4gR` READY and aliased to https://portal.holden.health. Initial failed build caught fallback-step type widening, corrected with an explicit WorkoutStep[] annotation before the successful deployment. Public website unchanged.
