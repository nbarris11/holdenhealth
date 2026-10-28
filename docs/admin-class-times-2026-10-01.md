# Admin class times — October 1, 2026

Deployed October 1, 2026 after the user authorized publishing both changes.

Portal deployment `dpl_CebGo3wnfvpvFGRkUK8xVKJLzxkw` is READY and aliased to https://portal.holden.health. Published via the required root `npm run deploy:portal` command using the separately authorized Holden Health CLI login. Clean Vercel production build and TypeScript passed. Live admin login returns HTTP 200; unauthenticated People redirects to admin login with its return path. No authenticated live member-record or visual walkthrough was performed. The local-only descriptions below record the earlier implementation stage; both the class-times view and withdrawn-member count fix are now published.

The user could not find Ahmad's and Catherine's Saturday preferences. Inspection found that approved requests disappear from the People request section, regular member records omit registration preferences, and standard group signup preferences do not populate attendance selections. Members must separately use Save my class spot for individual dates. Private once-weekly paid signups have separate automatic roster synchronization. No live records for Ahmad or Catherine were read or verified during this work.

Added a shared Class times section near the top of People person details and class member records. It displays the latest pending/approved registration request and latest paid checkout preferences for that person and program. Both sources remain labeled if they differ. Current email and the same program's claimed invitation emails support changed contact addresses. Calendar selections are secondary, expandable, and show only future, non-cancelled classes within the enrollment's program. Empty calendar wording distinguishes separate selections from signup preferences.

The loader verifies admin access before service-role reads. Query errors produce a retry message rather than a false empty preference result. No migrations, member changes, attendance assignments, messages, or calendar removal were performed.

Verification: TypeScript, lint on the four changed source files, and 12 targeted tests passed. Tests cover authorization before privileged reads, person/program boundaries, original invitation emails, approved/paid preferences, conflicting source values, past/cancelled classes, and query failures. No authenticated live data or visual browser verification; no production deployment.

The user subsequently questioned whether the calendar is needed because nobody appears on it. Recommended using signup preferences in People as the starting point and retaining schedule information for dates, changes, and Zoom links. Removing member booking controls or automatically assigning recurring attendance has not been implemented or decided.

## Follow-up: withdrawn members in Program people

User reported Jessica already marked withdrawn but still included in the program count of five. Fixed `filterPeople` to exclude withdrawn enrollments from the selected class program's directory and count. All-program search and history remain available; no member record changed. Directory wording explains where withdrawn records can be found. Ten People unit/render tests passed, including withdrawn-only search exclusion, Everyone retention, and active enrollment in another program not restoring membership in the withdrawn program. Changed-source ESLint and TypeScript passed. This fix is local and not deployed; Jessica's live enrollment and resulting live count were not independently verified.
