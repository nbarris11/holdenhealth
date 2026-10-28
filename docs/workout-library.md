# Reusable workout library

Kelsey's challenge workout builder can save exercises, selected groups of exercises, and complete workout templates. The library is shared across challenges and restricted to admins.

- Open a movement and choose **Save exercise to library**.
- To save a block, open each desired movement, check **Select for saved block**, then choose **Save selection to library** below the movement list. The block keeps workout order.
- Choose **Add from library** in the Exercises step to search and append saved movements. Use Move up / Move down to position them, then save the workout.
- Choose **Save workout as template** to capture current workout details, movements, demonstration links, and timer settings, including unsaved edits.
- Choose **Start from a template** above the challenge workouts. A separate tab opens a new draft. A release date is required; publication is unchecked.
- Remove a saved item through the library picker. Existing workouts retain their copies.

Database migration `20260909153509_workout_library.sql` has been applied to Holden Health. It introduces an admin-only table without changing existing workout records. Server actions validate all saved content. Templates exclude original IDs, challenge IDs, dates, publication state, and revision/history.

Validation: production build, TypeScript, ESLint, library unit tests, and transactional database checks for admin access and non-admin rejection. Production browser verification passed on September 9, 2026: saved and reloaded all three item types, inserted blocks and individual exercises, edited an independent copy, saved a private draft, and confirmed templates require a fresh release date with publishing off. Phone-width library controls were checked. Temporary test data was removed.

Deployed to https://portal.holden.health on September 9, 2026. Vercel deployment: `dpl_6Xm2xe8PwpfgEnNpv3GwbDY4PXtE` (READY). For future portal deployments, use the repository root:

```bash
cd /Users/barris/Desktop/holden-health-site
npm run deploy:portal
```

The browser console showed only unrelated Chrome extension errors during verification; no portal errors were observed.
