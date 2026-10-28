# People directory — September 12, 2026

User reported challenge participants did not appear in admin People and authorized the proposed directory/person-record fix.

## Change

- People now starts with a searchable all-account directory, independent of the selected class session and available even without a current class program.
- One entry and stable `/admin/people/[personId]` URL per existing profile/account ID. Joins across multiple challenges, class enrollments, and coaching relationships appear on that record. Same-name accounts are not merged.
- Challenge display name fills the blank profile-name case; saved profile names remain authoritative. Directory includes email/phone search, challenge titles/join dates, relationship badges, and the existing explicit `is_test` flag. Name text alone does not classify someone as a test.
- Person record shows contact details, habits, weekly workout target, eligible/completed habit days, completed versus partial workout totals, and links to challenge/class/coaching records.
- Challenge roster names now link to People records. Successful joins invalidate admin People and Challenges caches.
- Existing class administration, invitations, inquiries, payments, and intake/check-in tools remain below the directory. Corrected the existing Open People anchor in member session to Next Link, required by lint after adding the nested People route.
- No schema migration, new person rows, membership changes, emails, payments, or data cleanup. Existing and future completed challenge joins are included through existing records. Merely requesting a sign-in email can create an account-only directory entry; Free Challenge is shown only after a participant record exists.

## Verification

- Live read-only aggregate: 3 challenge participants / 3 distinct people; zero missing profiles or contact records.
- Read-only authenticated database role checks: admin sees 3 challenge participants and 4 contacts; ordinary participant sees zero contact-directory rows, zero other profiles, and zero other participants. Existing RLS policies preserved; server loader and routes require verifyAdmin.
- All 50 portal tests passed, including four new regressions for no-class inclusion, stable identity across multiple programs, name precedence/identity separation, and eligible habit totals.
- Local production build/TypeScript and full ESLint passed.
- Browser fixtures render the actual directory and detail server components with synthetic records and source CSS. Narrow 320px directory/detail, 390px detail, and 1440px directory checks had no horizontal overflow; inspected phone screenshots and corrected name/contact spacing. Fixture checks do not represent a physical phone or authenticated production session.

## Deployment

Portal deployed from the workspace root with `npm run deploy:portal`: `dpl_6c8GvUhcHunzbNkRugGaxiCTW8s4`, READY and aliased to https://portal.holden.health. Public website unchanged.

Authenticated production browser verified Everyone contains four accounts including all three challenge participants; a dual class/challenge account appears once. Opened an existing challenge-only person record and confirmed contact details, saved habits, join date, weekly target and pre-start 0/0 eligible-day totals. Submitted a name search and confirmed exactly the matching participant remained. No record mutations or messages. Anonymous HTTP requests to directory and person route return 307 to admin login. No physical-phone test or new signup/email was performed.
