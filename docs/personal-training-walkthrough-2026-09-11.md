# Personal-training live walkthrough — September 11, 2026

User requested the walkthrough after the portal audit fixes and coaching clarifications.

## Verified on production

Used the existing signed-in test account at the approved base email. Added one clearly labeled temporary online coaching relationship, one workout, and three sample options without altering any existing plan or account privileges. Today correctly prioritized the assigned personal workout. The member opened it, selected Plan B (10 minutes), entered synthetic notes and a win, and saved using the actual production server action. The database and refreshed UI both showed one completed Plan B workout, energy 3, effort 5, and the exact test notes. Completed-workout submission controls disappeared. Overall Progress counted the workout and included its win/reflection and training-progress link.

The training page fit at both 390px and 320px without document overflow. Its horizontally scrollable section navigation reached Weekly check-in. Weekend planning, shorter-workout guidance, appointment contact, and the two-hour coaching response text were present. The weekly form itself remains an external handoff: there is no confirmed personal-training form URL in the portal yet.

## Bug found and fixed

A sample feedback row was present in the database but invisible to the member. The unique workout_feedback.workout_log_id constraint makes this a one-to-one embedded response: the API returns an object/null, while the page incorrectly expected an array. Corrected the member feedback display, admin training response status/prefill, and admin pending-feedback count to use the object. After deployment and reload, the live member page displayed the sample response at 320px with no overflow.

The sample response was inserted directly as a clearly labeled test fixture, not authored by Kelsey or submitted through the coach UI. A transaction with another member's authenticated role confirmed zero visibility of this feedback. This is not a full security audit or a new coach-authoring UI test.

## Release and cleanup

Portal deployment `dpl_7ngomCirzzvJrju2CXGBVybvxet6` READY at https://portal.holden.health via the required root `npm run deploy:portal`. All 33 existing tests, lint, production compilation and TypeScript passed. The live feedback reproduction/retest is the regression evidence; the existing unit tests do not cover this embedded API response shape.

Removed the exact temporary relationship with its dependent sample workout, three options, one workout log, and one feedback row; verified all fixture counts are zero. Existing member account, challenge history, demo members, and other plans remain untouched. No email, payment, intake declaration, or real health information was submitted. No schema migration was needed. Browser viewport reset after testing.

## Limits and small observations

This pass reused the existing authenticated session; fresh sign-in delivery was tested earlier, not repeated. Actual weekly Google Form submission and personal-client intake remain untested without the shared document. No physical iPhone/Safari or audible sound test. Admin feedback changes were source/build checked; the member display was verified live. The current UI has minor wording inconsistencies: a blank profile name yields “Hi, there” while Today uses the challenge name, and the Progress link says “1 personal workouts completed.” Neither blocked the flow; no broader redesign was made during this walkthrough.
