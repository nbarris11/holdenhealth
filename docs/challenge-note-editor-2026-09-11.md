# Challenge note editor — September 11, 2026

The user relayed Kelsey's difficulty finding free-program wording in Challenges and authorized a fix. Her subsequent screenshot identified the “A note from Kelsey” box. This already reads `habit_challenges.welcome`, which was editable under the mismatched label “Welcome & announcement.” The screenshot narrowed the fix to discovery of that existing field; no new content schema was needed.

Changes:

- Challenges has separate “Edit program information” and “Edit workouts” jump links.
- The settings panel is named “Edit program information.”
- The existing welcome field is labeled “A note from Kelsey,” with instructions explaining its location and the Save challenge button.
- Admins see an “Edit this note” link beside the note on the signup page and participant preview. It selects the corresponding challenge and jumps to the field.

The note text, save action, validation, permissions, workout editing, and database are unchanged. The separate “A little support at home” copy below the note is still static; this release does not claim to make all challenge-page wording editable.

Verification: portal ESLint and production build/TypeScript passed. No new automated tests were added for this label/link-only change. No authenticated browser save or physical-phone test was performed, and no member data or real note content was changed during verification.

Deployment: required root `npm run deploy:portal` completed. Portal `dpl_FT3HP1NvGVA4Ay32QAUFHmJNnqV7` is READY at https://portal.holden.health. Live public challenge returned HTTP 200 with the note present and admin edit links hidden for visitors; the Challenges editor redirected anonymous visitors to admin login. Public website unchanged.
