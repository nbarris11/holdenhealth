# Class habit discovery and admin preview — October 8, 2026

The public website promises daily habit checkoffs, but the class page emphasized the separate free challenge and buried its own habit link below the calendar. Admin preview also omitted the link and the habit page loaded the administrator's own enrollments, so it could show an irrelevant challenge signup prompt.

## Changes

- Class page navigation now links directly to the selected enrollment's Weekly habits.
- A Keep small promises card above the calendar links to habit setup, daily tracking, or completed progress according to the program dates.
- Today uses an explicit Check off my weekly habits button.
- Habits honors the existing admin preview cookie only after checking the signed-in user's admin role. It uses the same session-scoped database client and existing row policies.
- Preview shows the selected member's weekly habits read-only, with disabled setup/checkmark controls, Return to admin, and a link back to the class program. Existing server actions still reject writes with a preview cookie.
- Admins without a valid preview see People guidance. Before program start, members are told they can choose habits now and daily checkboxes open on the start date.

No dependencies, migrations, real member habit changes, or public website edits.

## Verification

All 174 portal tests passed; an additional saved-checkbox read-only test also passed afterward (175 total tests). Coverage includes preview authorization and enrollment isolation. Changed-file ESLint, TypeScript, and local production build passed. React review checked server-side authorization, disabled preview controls, and reuse of existing styles.

## Released and checked live

Final portal deployment `dpl_JAAr3rZ6u7y2AuxwXhkU2MgQXhEc` is READY at https://portal.holden.health. Production build passed. Deployed from the root with `VERCEL_GLOBAL_CONFIG=/Users/barris/.config/vercel-holden-health npm run deploy:portal`. The first attempt returned Not authorized; confirming the CLI identity refreshed its credentials, and the retry succeeded. Project and team were verified; Root Directory remains web-app.

Live authenticated admin browser verified the new program card and Weekly habits navigation, preserved enrollment in the link, loaded the selected member's tracker, displayed disabled setup fields, and returned to admin. Direct admin Habits afterward showed People guidance instead of challenge signup. Desktop, 390px and 320px views checked; no horizontal overflow in the habit page, and no overflow on the program page at 390px. Phone preview banner corrected and verified in the final deployment. Preview cookie cleared by Return to admin and browser viewport reset.

Screenshots are in `docs/habit-discovery/`. No member data was changed. The live member save/checkoff flow was not exercised, and there was no physical-phone test. Existing save actions were unchanged; automated tests cover member versus preview control states. Initial release error-log query returned no matching logs in the preceding 15 minutes; this is a limited observation, not comprehensive monitoring.

## Follow-up: Kelsey's Programs screen

Kelsey supplied a screenshot of `/admin/training`: the class program card had no habit entry point. Added Weekly habits beside At-home workouts and a dedicated `/admin/programs/[programId]/habits` overview showing that program's eligible members, current-week habits/counts, clear not-yet-chosen states, and direct read-only tracker previews. The existing preview action accepts only the fixed `view=habits` option for the new destination; its default route is unchanged.

The overview requires verified admin access, scopes enrollment queries to the selected program, excludes withdrawn/prospect enrollments, and reads existing habit tables using existing access policies. No migration, member habit edits, or new dependencies. All 178 tests, changed-source ESLint, and local production build passed. New tests cover admin denial, program isolation, withdrawn exclusion, preview destination form, and empty programs. Portal deployment `dpl_FTDL5LGL97LTwoJGdv8ncxKdntst` is READY at https://portal.holden.health; production build passed. Live admin browser verified Weekly habits beside At-home workouts on Programs, seven October members on the overview, and direct selected-member read-only tracker preview. Overview fits 390px without horizontal overflow. Preview exited and viewport reset. Initial browser reload retained the old Programs document; fresh navigation with `?updated=habits` displayed the new version. Screenshot: `docs/habit-discovery/admin-programs.jpg`. No member saves or physical-phone check performed.
