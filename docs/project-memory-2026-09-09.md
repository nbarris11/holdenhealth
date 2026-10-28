# Project memory — September 9, 2026

## October 27: Featured program preview click repaired

Final follow-up: user video IMG_9713 showed the scroll-to-form interaction remained confusing. Replaced the scroll with a modal promotion editor over the preview. Portal `dpl_97K1ijxy6Yy4xLvvzaT37n3BxcT6` READY. Authenticated live Chrome clicks on the December headline and button both opened the dialog; typing, close/reopen draft retention, and restoring original text passed. No publication was submitted. Lint and local webpack build passed (local Turbopack persistence was corrupt); production Turbopack build passed. Screenshot: /tmp/holden-promotion-editor-fixed.png.


Kelsey reported that clicking the December promotion in Content → Edit your website did nothing. The homepage and Coaching page featured-program blocks were deliberately excluded from ordinary text selection because their copy is generated from program settings, but the preview offered no route to those settings. Clicking either featured block now scrolls to and focuses the existing **Feature a program on the website** form. Customer-facing links and program data are unchanged. Public website `dpl_AZBhxP86X2wFEdcd3srVEYQ4XkJM` and portal `dpl_9NdgP1FVoKdX3S79TtPDhtv6ZR9k` are READY. Local browser regression passed the featured click and 24-page editor inventory; site checks, portal lint, TypeScript, and builds passed. The live script matches local byte-for-byte and the authenticated portal has the new form target. A physical click in Kelsey's browser remains unverified; she may need to refresh the editor tab to load both releases.

Kelsey's follow-up video showed the click route reaching the form, but exposed that its generic starter headline differed from the promotion shown on Coaching. Until a featured program is explicitly published through the form, the live site uses each page's saved promotion copy. The form now starts with the selected page's saved words and switches to the clicked page's words when no edit is in progress. It explains that publishing applies those words to both Home and Coaching. Portal `dpl_9GV7gftber8rPbx9FWHDH8yTMRqZ` is READY. Clean build, lint, TypeScript, site checks passed; authenticated live browser confirmed Coaching and Home form values each match their respective preview copy. No content was published or changed in the database.

## October 22: Empty member Resources hidden

The class member portal now omits its Resources tab and section when the selected program has no published resources. Kelsey can still add/remove links in Admin Content; publishing one reveals Resources for that program automatically. Portal `dpl_3JRVN6SwSCN4f27pmDPUy92U2xHT` READY at https://portal.holden.health. Changed-file lint and local/production Next builds passed. No authenticated member page was opened for live visual verification; no resource records changed.

## October 22: Self-service class programs deployed

Kelsey can now create private class-program drafts, review schedule/prices, publish for registration, and choose website feature copy in the secure portal. Portal `dpl_FF1CmeC8R3BmyZXCKFqQEkedCGN6` and public site `dpl_985AcfR6Hx7XRct1MiNrt2WpLgqF` are READY; two additive migrations applied. Local tests/builds and live read-only page/API checks passed. Vercel CLI required device sign-in before the site deployment. No November/Christmas drop-ins were added. See [release and verification limits](self-service-programs-2026-10-22.md).

## October 21: December mini session signup published

December 1–19 mini session is now prominent on the homepage and group fitness page with a direct signup link. Portal supports its nine-class package at $139 new / $99 returning, including Stripe checkout and Venmo/cash/check reservation, while October signup remains available. Admin Program details now shows package price labels rather than weekly-plan labels for December. Additive migration `20261021181312_december_mini_registration.sql` applied. Website `dpl_HkNQWM2f42Xoz5tHUSwKNAhj3Nxs` and final portal `dpl_2P2oZLWSoHq8MBzHMiM3wzMGV14e` are READY. All 194 portal tests, site checks, lint/build, rollback-only database pricing/access checks, and live read-only phone-size page checks passed. No real signup or payment submitted. See [release and verification limits](december-mini-signup-2026-10-21.md).

## October 14: in-person personal-training session plans

Added dated coached session workout plans to every personal-training client workspace, including online, in-person and hybrid, with editable title, full workout text and an explicit member-visibility checkbox. The user selected both coach and member visibility, so the new-plan form defaults to visible; the database default remains private for writes outside the form. Visible plans appear in the member's personal-training page. This is separate from the structured at-home workout builder and appointments; no existing workouts or appointments changed. Migration `20261014140943_personal_training_session_plans` applied with staff write/member-visible read policies. Final portal `dpl_2TRraYybGnLFxXpkiizecFJxZSCi` READY at https://portal.holden.health. Existing 191 tests, lint, TypeScript, local and production builds passed. No Google Doc was imported or real client data changed. No authenticated browser save/readback completed for the new forms.

## October 14: personal-training exercise weight tracking

Personal-training members can optionally enter one working weight (lb) and rep count per main-work exercise at the workout check-in. The player shows the last recorded entry for matching exercise names and keeps unsaved entries with the paused session on the device. Kelsey sees entries in Recent workout check-ins and dated Strength progression in the private workout workspace. Existing workout logs remain readable; the new `exercise_loads` JSONB column defaults to an empty array. Migration `20261014135336_exercise_load_tracking` applied. Portal `dpl_GkrfH3X6pFPGWk1Eaerg6bNDAqXc` READY at https://portal.holden.health. All 191 tests, lint, TypeScript, local and Vercel production builds passed. No real member workout was saved for verification; the live check covered the schema column and READY deployment, so a member/coach use-through is still useful.

## October 14: PT withdrawal and both-portal verification

Kelsey can withdraw a personal-training client from the coaching workspace. Withdrawal removes current PT listing and future appointments while preserving history, bills and any class enrollment. The member loses new PT workout/habit actions but can read saved history. The coach snapshot now counts structured workouts. Portal `dpl_E4zFsa1TAWx5WmjVDxLvSgtK3yTy` READY; 189 tests, lint, TypeScript, builds and synthetic live admin/member walkthroughs passed. One active class enrollment continued working after PT withdrawal. All synthetic accounts/data removed; no real client was changed. See [release and verification](pt-withdrawal-2026-10-14.md).

## October 13: coaching requests implemented

Late-join requests with coach-entered manual-payment pricing, private structured PT workouts using the group builder, three weekly PT habits, current-week habit edits/history, and an Activity inbox with opt-in email alerts are live. Portal `dpl_2wjXMtvnRiSTEnkuQT8tN7VR2MPR` READY. Three migrations applied. All 185 tests, lint, TypeScript and production builds passed; synthetic member/coach browser flows and one provider-accepted test notification passed. Temporary accounts/data removed after global sign-out; real members and retained demos untouched. Kelsey must opt into email alerts in Activity. Custom prorated Stripe checkout and phone push are not included. See [release, usage and verification limits](coaching-updates-2026-10-13.md).

## October 8 follow-up: Weekly habits on admin Programs

Kelsey still could not find habits from her admin Programs screenshot. Added Weekly habits beside At-home workouts on each program card and a program habit overview with eligible members, current-week habit counts, empty states and direct read-only tracker previews. All 178 tests, changed-source lint, local/production builds passed. Portal `dpl_FTDL5LGL97LTwoJGdv8ncxKdntst` READY. Live browser verified Programs → Weekly habits → selected member tracker; 390px overview passed. Browser needed fresh navigation after initial stale reload; direct overview link works. No member data changes. See [follow-up record](class-habit-discovery-2026-10-08.md).

## October 8: class habit discovery and admin preview fixed

Added prominent program-specific Weekly habits navigation and Keep small promises card above the class calendar, clearer Today buttons, pre-start date guidance, and read-only admin habit preview tied to the selected enrollment. Admins without preview now see People guidance. No migrations or member data changes. 174-test suite plus an additional checkbox read-only test passed; lint/TypeScript/local and production builds passed. Portal `dpl_JAAr3rZ6u7y2AuxwXhkU2MgQXhEc` READY. Live admin browser verified program-to-tracker navigation, disabled preview controls, exit behavior, and desktop/390/320px layouts. Live member saves and physical phone testing remain unverified. See [release details](class-habit-discovery-2026-10-08.md).

## October 6: class at-home workout editor deployed; Vercel setup verified

User could only find the free-challenge editor and requested a fix. Added program-specific At-home workouts editors, scheduled/draft publication, existing builder/player/templates, enrollment-based access, member Today/Workouts links, progress counts and coach check-ins. Additive migration `20261006221121_class_program_workouts.sql` is applied. 170 tests, final lint/TypeScript/build, rollback access checks and an authenticated synthetic coach/member browser flow passed; mobile layouts checked. All temporary users/program/workouts/logs were removed after global sign-out. Portal deployment `dpl_ANamUeMhmi5ZXTqS4Z9U3QshSdhe` is READY at https://portal.holden.health; production build and live unauthenticated editor redirect passed. CLI 62.5.0 uses Holden Health account `keholde-1435` with explicit `--global-config /Users/barris/.config/vercel-holden-health`; the root portal script forwards that option from `VERCEL_GLOBAL_CONFIG`. Vercel plugin MCP documentation search and Holden Health team access both passed. No duplicate connection or reload needed. See [implementation, release steps and verification limits](class-program-workouts-2026-10-06.md). No real program workouts were written.

## October 1: lead conversation confirmations

An admin-only Leads page now saves Instagram/website/referral prospects and sends a phone or in-person conversation confirmation with an Eastern-time calendar attachment. No account or Zoom meeting is created. Additive Supabase migrations are applied. All 165 portal tests, lint, TypeScript, and local/production builds passed. Portal `dpl_XUsjQmeYAcJkTSvxWEqrWJC2jBZi` is READY at https://portal.holden.health. A disposable fake lead was saved through the live form, persisted after reload, and matched the database; its test email was provider-accepted. The exact record was removed, leaving zero leads. No real prospect was contacted; no phone-size or inbox delivery test was done. See [lead release record](lead-conversation-confirmations-2026-10-01.md).

## October 1: completed group signup tracking

The portal now sends `group_signup_completed` to PostHog after a successful offline reservation or completed Stripe checkout. `completion_status` distinguishes `reserved`, `processing`, and `paid`; `payment_status` remains separate. Stable event UUIDs prevent webhook retries and later ACH success from counting the same signup twice. No submitted identity or health text is sent as event properties. Deployed portal `dpl_PKNvGWWq1fTrynCFaxWDeztAyDM1` READY at https://portal.holden.health. All 162 portal tests, lint, local/production builds and TypeScript passed. Live registration/login returned 200; no real signup or payment was submitted, so live event ingestion remains unverified until the next genuine completion. See [release details](group-signup-tracking-2026-10-01.md).

## October 1: six-week class habit tracker

Class members can set three weekly habits, check days, review automatic success counts, and keep or add habits in later weeks. Kelsey sees counts in People; the existing Sunday Google Form reflection remains separate. Private migration applied; rollback-only member isolation checks, 158 tests, lint, TypeScript and production build passed. Final portal `dpl_K6sEZHdi9nvePjo63dsYdZghcBNc` READY at https://portal.holden.health. No real member habit data was changed, and no authenticated browser save or physical-phone check was done. See [release details](class-weekly-habits-2026-10-01.md).

## October 1: signup times and withdrawn program counts

Published Class times near the top of People person details and member records, displaying saved registration/paid signup preferences even after approval; individual calendar selections are secondary. Standard group preferences still do not automatically assign calendar attendance. Program people now excludes withdrawn enrollments from its list and count, retaining Everyone/Past members history. No member data or calendar behavior changed. Targeted tests, lint, TypeScript and clean production build passed. Portal `dpl_CebGo3wnfvpvFGRkUK8xVKJLzxkw` READY at https://portal.holden.health. Live login/unauthenticated redirect checked; no authenticated live preferences/count verification. See [release and limits](admin-class-times-2026-10-01.md).

## September 28: individual email history in Analytics

Analytics now shows searchable recipient/subject/status/time history from Resend, including existing personal-training emails. Live search confirmed Tracy’s two delivered emails. No emails resent or database changes. 150 tests, TypeScript, changed-source lint, clean production build passed. Portal `dpl_eKuBDc9QVMBemySvh18VX2pKzUHV` READY. See [release and scan limits](email-history-analytics-2026-09-28.md).

## September 28: monthly personal training bills

Manual monthly billing is live: admin creates/sends bills from each personal-training workspace; members pay one-time through existing Stripe checkout. The $4 fee appears only at checkout. Admin can record offline payments or void unpaid bills after checkout reconciliation. Migration applied; portal `dpl_GvckwFZrnuecZwR8uXCRFfyWMw9Q` READY. 147 tests, TypeScript, changed-source lint, clean production build, rollback-only permissions/state tests, and live disposable admin/member walkthrough passed. Provider test-sink email and live checkout verified; no card charged. QA accounts signed out globally and removed with their bills. Read [release and verification limits](monthly-personal-training-billing-2026-09-28.md).

## September 28: complete personal intake and risk agreements

The personal training intake now matches the supplied ten-section Google Doc. Separate signed risk agreements are in place for personal training and future group class enrollments; existing class enrollments remain exempt. Client wording and acknowledgments are saved with each signature, and Kelsey can countersign. A disposable member and coach browser walkthrough covered both intake/signature paths, admin review, payment guard, and member readiness, then removed all test records. Read [the release and verification record](personal-training-and-class-risk-agreements-2026-09-28.md).

## September 28: personal training intake and appointments

Personal-training setup now sends a dedicated private intake link; existing clients can be emailed the link from Kelsey's training workspace. In-person and Hybrid clients can see individual confirmed appointments entered by Kelsey. No existing client was emailed and no appointment was scheduled during the release. Two additive migrations and portal `dpl_CYq9sSU5rxKBECxQ9yXHzTMRcfG2` are live. Read [the release and verification limits](personal-training-intake-appointments-2026-09-28.md).

## September 23: automatic program review emails

User requested automatic review requests after program end, after initially approving a manual button. Added daily morning cron and admin recipient/email preview at `/admin/communications/reviews`, linked from Email and Programs. Opt-outs/test accounts excluded; per-program member/email reservations block duplicates across automatic/manual/concurrent sends; uncertain delivery cannot blindly retry. First due October 5 for current challenge. Two additive migrations applied. Portal dpl_3J8XJWg5VuwQLzLfdpzacNVEE8zQ READY via root script. 128 tests, TypeScript, clean changed-source lint, production build, rollback-only permissions/duplicate tests passed. Authenticated live page showed 9 challenge recipients; 390/320px checks passed. Vercel confirms enabled daily cron; sensitive CRON_SECRET prevented authenticated live HTTP dry-run, while synthetic cron tests and unauthorized 401 check passed. No emails sent, zero test records retained. See [release and limits](program-review-requests-2026-09-23.md).


## September 23: Google business profile links

Added the user-verified https://share.google/EOKYvkNJMEZN22Cta profile as “Find us on Google” in all 26 public HTML footers and as a contact-method card on Contact. Existing styles, no dependencies or portal changes. Website checks passed (22 sitemap pages, 11 tests). Deployed with root npm run deploy:site using existing isolated Holden Health CLI config; dpl_3vzLf7cBtEaioxCu447JBsAkGBD6 READY. Live Contact browser verified both links and desktop card layout. No physical-phone testing or runtime log audit. Profile showed no reviews during verification; no rating claims added.


## September 21: People filtering and Programs hub deployed

User reported unchanged People after selecting a class program and Programs showing only personal training. People now automatically switches program scope, filters/counts the directory, preserves search scope and offers Show everyone. Programs now lists class sessions with People/Schedule/Program details links, a challenges link, and separate personal-training clients. Settings honors the requested session; People/Schedule support all saved session statuses with the existing current-program default preference. No database/member/payment/email changes. 115 tests, TypeScript and changed-source lint passed; clean Vercel production build passed. Portal dpl_2WfoGSt36KSEjpkTgQZPb54N6i6H deployed via root script. Authenticated live browser verified December 0, October 3, Everyone 15, Programs cards and December details. Desktop layout checked; no mobile/physical-phone test or settings save. See [release record](people-programs-2026-09-21.md).


## September 21: free challenge email audience deployed

User requested emailing free challenge signups from the admin portal. Email now includes Free challenge participants with eligible count and expandable names/emails; no newsletter subscription or class enrollment required. Shared recipient loader preserves contact opt-out and test exclusions, paginates, deduplicates, and uses profile name then challenge display name. Renamed misleading Everyone option to Class members. Challenge/newsletter emails work without current class session and save null class session association. No automatic subscriptions, membership/access changes, or emails sent.

Migration `20260921134032_challenge_email_audience.sql` applied (campaign audience check only). Portal deployment `dpl_BeEv6jEPUsxRPLAWB2Q5Siqym88F` READY at https://portal.holden.health using root deploy script and existing isolated Holden Health CLI config. 109 tests passed, TypeScript passed, changed-source lint passed with fresh dependencies, clean Vercel production build passed. Existing local dependency corruption blocked regular lint; existing duplicate Turbopack cache file blocked local build. Authenticated live browser verified selected challenge audience (9) and all nine names/emails. Rollback-only authenticated admin campaign/delivery insert passed; ordinary member sees zero contact-directory rows. No actual provider send or physical-phone test performed. Existing unrelated security advisor findings remain: [admin RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [service-table RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No RLS changes. Audience covers all saved challenge signups, not a particular challenge; existing provider batch-size limitations remain.


## September 21: AMRAP workout navigation fix

Fixed the shared player ending after one pass through the exercises despite countdown time remaining. Countdown/AMRAP main movements now loop to the first main movement with “Repeat round” and a next-round preview; warm-up is excluded. At timer expiry, the next action from any main movement leads to cooldown or check-in. Existing early finish, paused rest, session recovery and other timer modes retained. No workout prescriptions, member records or database changes. All 103 automated tests and synthetic browser checks passed (three rounds, preserved clock, pause/rest/reload, mid-round expiry, 390/320px). No physical iPhone or live member-save test. Clean production build/TypeScript passed; portal `dpl_DPEmsY4X2qHn88KWiNrbMKspu4gR` READY at https://portal.holden.health via root deployment script. Local lint dependency errors remain; see [release record](amrap-repeat-2026-09-21.md).

## September 20: Android home-screen logo deployed

Added square 192/512 PNG icons, a padded 512 maskable icon and Next icon metadata using the existing Holden Health logo. Portal manifest now references the Android assets instead of the 132×128 Apple icon. Existing Apple icon retained. Portal deployment `dpl_GYLjnniC2Lm5bkLKF5DgL8YZkiL7` READY at https://portal.holden.health through root `npm run deploy:portal` with isolated Holden Health CLI login. All 98 tests passed in the implementation turn; Vercel clean production build and TypeScript passed. Live manifest, all four new icon URLs/bytes, and login metadata verified. Local lint/build attempts stalled or errored; no local lint pass claimed. No physical Android/Samsung Internet verification. Existing shortcuts should be removed and re-added to refresh the icon. Public website unchanged.

## September 15: private once-a-week signup, payment/class confirmations deployed

Private custom-price signup links now in People; coach chooses weekly time and amount, member confirms safety/policies and pays. Verified payment emails both member and Kelsey with class dates, syncs roster attendance, and sends member portal/intake link. Public plans stay 2/3. Migration applied; 97 tests, lint, local/production builds and rollback-only database tests passed. Portal dpl_GkcCBPEJyrkqciHg5NvyTQ61P9eD READY. Live admin/browser test created and emailed authorized $50 signup to nbarris11@gmail.com for December Saturdays 9 AM (Dec 5/12/19); Gmail delivery confirmed. $54 total includes existing fee. Offer 48f6ae80-39b8-424e-98e2-5347589e2f3c retained for user; **no payment/checkout submitted**, no enrollment fabricated. Older October processing order untouched. Read [release and limits](private-weekly-signups-2026-09-15.md).

## September 15: manual Zoom invites and one-off slot fix deployed

Manual name/email/date/Eastern-time booking now live in Zoom calls, with 60-minute private reservations, Zoom link and calendar emails to guest and Kelsey, overlap/duplicate protection, and per-recipient email retry. Also fixed silently skipped closed one-off slots; reopens them atomically with accurate duplicate/conflict messages and supports minute-level one-off times. Two additive migrations applied. Portal dpl_AA8KqXQPxVkk3DU85wmQnL3DwfLb READY via root deployment script after isolated Holden Health Vercel login; TeeAhead credentials unchanged. 84 tests, lint, local/production builds and rollback-only database checks passed. Live admin form, duplicate-submit outcome and public calendar verified. No real invitations, new bookings or emails sent. User's exact missing slot date/time remains unspecified. Read [release, limits and next steps](manual-zoom-invites-2026-09-15.md).


## September 14: follow-up challenge copy and email audit

User asked whether emails or other items needed adjustment. Found references missed in earlier sweep: static fallback navigation in 26 HTML pages plus consultation choice, nutrition page, and quiz challenge results. Updated and deployed website dpl_CN8neon7St4XitAA7XqUf3ZBX7dH READY. All 11 site tests and 22-page SEO checks passed; live quiz, book, nutrition, and about HTML verified free of 21-day wording. Full active source scan has no old challenge duration/end-date references. Saved site_content had no matching old challenge copy (the December three-week class description is unrelated and preserved).

Future Wednesday Note welcome email already says 14 days. Challenge enrollment invokes generic Supabase OTP sign-in, with no dedicated challenge welcome/drip email in app code. Sunday cron targets paid class enrollments, not habit challenges. No matching challenge campaign found in communication_campaigns. Did not inspect externally configured Supabase Auth email templates, Gmail, social posts, or external campaign scheduling. No emails sent; recommended a short September 21–October 4 update to current participants.


## September 14: 14-day challenge schedule

User requested changing the challenge header to 14 days, then shortening the actual schedule with the same start date. Current live challenge is The 14 Day Commitment! (c6894c9a-71e5-4d3a-a303-5afe2c7e2c8c), September 21–October 4 inclusive. All five signups retained; pre-change checks showed zero checkmarks/logs and all non-archived workouts scheduled September 21 or 28. No messages sent.

Applied migration 20260914151944_challenge_fourteen_day_support.sql: allow 14 or legacy 21 days; narrowly guarded, atomic correction of the upcoming challenge with the participant date-lock trigger restored. Trigger function/permissions unchanged. Admin saves preserve the existing duration; new challenges default to 14. Tracker calendar and day counts derive from saved dates. Updated remaining hardcoded public challenge labels/defaults and future welcome-email copy; saved user copy retained.

Portal dpl_5QQjCFoBN6at7EQ2N2gm1MRPV5fB and site dpl_2ovmTBzKQSqNfuChUhJjSu9QWX3c READY via root scripts. 71 portal tests plus three new settings tests, 11 site tests, 22-page SEO checks, lint and local/production builds passed. Actual tracker server rendering produced 14/21 buttons as appropriate. Database verification confirmed 14 days, five signups, enabled date lock; rollback-only check confirmed unchanged-date saves work and enrolled-date changes remain blocked. Live challenge HTTP shows Sep 21–Oct 4 and correct title/metadata; live homepage shows 14 days. No authenticated member-browser or physical-phone test performed.

Security advisors reported unrelated existing admin SECURITY DEFINER RPC warnings, service-only RLS-without-policy info, and disabled leaked-password protection. No challenge-table findings or auth/RLS changes in this release. References: [RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


## September 13: manual member renewal

Added /portal/renew with Today/Account links, future published/enrolling session selection, saved contact/plan defaults, verified email binding, existing payment choices and status/checkout recovery. Previous sessions/history retained; no automatic charges. 64 existing plus six new tests, lint, local/production builds passed. Portal dpl_7WhNE1J443H8cH8oh78dZ3hMUKnr READY. Live existing browser session showed October processing and separate December mini contact path; mini lacks weekly checkout prices. Synthetic 390px source-form layout passed. No real renewal/payment/email or member/schema changes. August 21 nbarris11 processing order left untouched pending Stripe verification. Read [release and limits](member-renewal-release-2026-09-13.md).

## September 13: Card / Apple Pay group registration

User authorized adding Card / Apple Pay through existing Stripe Checkout. New card choice uses the existing $4 online fee, server prices and enrollment checks; bank/offline methods retained. Paid webhooks/admin now support stripe_card through an additive enum migration; paid confirmation wording is neutral. Portal deployed via root script (Aeq48gnWzcyZuzDaxQzLwpRRcBT1). Local/production builds, lint, 60 existing tests plus four new payment tests passed. Live 390px form switching/totals passed; no actual checkout/payment/email or physical iPhone wallet test performed, and Stripe dashboard wallet setting not inspected. See [release and verification](apple-pay-release-2026-09-13.md).

## September 12: PostHog account names repaired

User requested named future recordings for account holders. Observer now falls back to challenge signup name, ignores empty names and refreshes visible sessions every minute. Existing matched PostHog names repaired; original recording verified as Ahmad Malik. Six targeted tests, lint/build passed. No account/database changes. See [PostHog release](posthog-release-2026-09-11.md) for deployment and limits.

## September 12: Venmo payment instructions

User supplied https://venmo.com/u/holdenhealthllc and authorized the proposed reservation confirmation/email instructions. Venmo reservation redirect now carries paymentMethod=venmo; confirmation conditionally shows @holdenhealthllc, Open Venmo link, name-in-payment-note guidance and pending-until-confirmed wording. Customer reservation email includes matching instructions and CTA only for Venmo. Cash/check unchanged. No payment status, database or fee changes. Portal dpl_EwwoU32qJsUEMkb1sNbNiHkZqZnR READY via root deploy script. Lint, local/production build and 58 existing tests passed; mocked actual reservation action checks passed for Venmo/cash/check email content and redirects. Live HTTP confirmation variants passed. No real reservation, email or payment sent; no Venmo app handoff or visual browser test claimed.

## September 12: one registration form for all payment methods

User requested simplifying enrollment after a replay showed bank-form entry before offline reservation. One shared form now offers Venmo, ACH, cash and check; entered details/plan persist when switching, ACH adds existing $4 fee, and safety/policy text and submit label match the method. Original server payment/reservation handlers retained. See [release and verification](registration-payment-choice-2026-09-12.md). No database/member/payment changes or test submissions.

## September 12: remove public website payment-fee notes

User requested removing repeated $4 payment-fee notes because customers see the fee at checkout. Removed mentions from homepage, group classes, online training, quiz results, and online-training comparison guide. Updated only the two matching published homepage copy fields in site_content; other saved edits preserved. Checkout disclosures, totals, payment logic, portal and emails unchanged. Website deployed via root npm run deploy:site: dpl_GC7f7K4aGKef9RwtF2BPaKgfgHhm READY. All 11 site tests and 22-page SEO checks passed. Five live HTML pages match local source and have no $4 notes; corresponding live managed-content responses have no $4 notes. No payment submitted or browser visual test performed.

## September 12: request notification program mismatch

Reproduced Today counting First 6-Week request while People defaulted to December. Aligned defaults, preserved program in dashboard and future review-email links, added People program selector/search context. Portal `dpl_CHT4r7bHeynAzTF1fv7WJwRzaKm8` READY. 57 tests, lint/build and authenticated live dashboard-to-request click passed. User also questioned Ahmad’s Free Challenge badge: read-only checks found a separate challenge participation with three habits alongside the pending class request; intent unverified, records unchanged. Read [release and limits](admin-request-navigation-2026-09-12.md).

## September 12: review email stays in admin login flow

Fixed non-admin browser sessions opening staff links being redirected to the member portal. Staff sign-in now explains account mismatch and preserves requested admin page after login. Existing admin authorization retained. Portal `dpl_C8oqqaDNjbAehwriLaYPaucs7gn5` READY. 55 tests, lint/build and live signed-out redirect/form checks passed. No roles, member data or emails changed; specific phone session not inspected. Read [release and verification limits](admin-review-login-2026-09-12.md).

## September 12: challenge participants in People

User authorized automatic inclusion of challenge participants in People. Added a searchable all-account directory and stable person pages combining challenge, class, and coaching records by account ID; existing class-management tools retained. Existing three participants already had profiles/contacts and now appear automatically; no database changes, backfill, payments, access changes, or emails. Person pages show contact, habits, join dates, eligible habit progress and separate completed/partial workout totals. Portal `dpl_6c8GvUhcHunzbNkRugGaxiCTW8s4` READY via root deploy script. All 50 tests, lint/build, database role access checks, phone-layout fixtures and authenticated live directory/search/detail checks passed. Read [release and limits](people-directory-2026-09-12.md).

## September 11: prominent mobile Communicate button

Follow-up: user requested “Messaging” or “Message”; selected Messaging and updated the member header button, Account & support entry, and member inbox heading. Existing URLs and coach heading retained. Build/TypeScript and lint passed again. Final portal deployment `dpl_FZ3ZnYrkuRiVhiVrRDcttz7YRyUP` READY at portal.holden.health.

User requested easier mobile placement. CSS-only update in `web-app/src/components/chat.css`: mobile header now has logo/account on row one and a full-width purple Communicate button on row two, minimum 48px high, retaining unread count and existing paid-access gating. Desktop navigation unchanged. Local build/TypeScript and lint passed; isolated browser header fixture at 320, 390, 760 and 1100px had no overflow or logo/account overlap. Fixture used source styles/representative markup, not an authenticated live member session or physical phone. Portal deployed with root script: `dpl_DaysynKQZ1QM3RuBd3NeYsxL9Mrj`, READY, aliased to portal.holden.health; live login HTTP 200. No database/member/message changes.

## September 11: Web Analytics pageview fix

Recordings were arriving but Web Analytics was zero because both SDK configs disabled pageviews/pageleave and removed URL/path properties. Enabled pageview history navigation and pageleave, preserving pathname/referrer/URL without query strings/fragments. Password-only replay unchanged. See [latest PostHog release details](posthog-release-2026-09-11.md).

## September 11: user requested password-only replay masking

Explicit user request: “i dont want anything masked except passwords.” Supersedes total masking below. Both site configs and PostHog project setting changed to reveal ordinary page text/images/form entries and hide passwords, including show-password fields. Policy now discloses potential member messages/health information in recordings. Read [latest PostHog release section](posthog-release-2026-09-11.md) for deployments and verification.

## September 11: public website replay added

User requested replay on holden.health after clarifying their visit was to the public website. Added anonymous, fully masked recording through shared site.js, excluding editor embeds and non-production hosts. Website dpl_F9eLg4muJd1GdPJYR9yT9j7xJXBy READY; policy updated; 11 website tests/SEO checks passed. See [PostHog release record](posthog-release-2026-09-11.md). Portal named replay unchanged.

## September 11: PostHog replay, member names, and LogRocket removal

User authorized removal of LogRocket, free PostHog replay, GitHub app access, Codex MCP, and later explicitly approved named member recordings. Portal now identifies verified signed-in accounts with account ID and saved name; private page text, inputs, attributes and media remain masked. Identity resets for sign-out/account switching. No email identification or raw error capture. Public policy updated. PostHog remains on free plan (5,000 web replays/month); MCP OAuth authenticated. Three Self-driving scouts configured; Replay Vision scanners not created. GitHub repository is behind local deployment and must be synchronized deliberately before reliable automatic fixes. Read [release, deployments and verification limits](posthog-release-2026-09-11.md). This supersedes historical anonymous-only replay notes and generic wizard reports.

## September 11: SEO service pages and Resources guides

User authorized and shipped improvements to Personal Training, Online Training, and Group Classes, plus two buyer guides under Resources. Both articles registered in the website editor and sitemap (22 URLs). Preserved current managed text and all 18 saved visual-override targets; no database edits or fabricated testimonials. Website dpl_2Xd9G429Ky96xxPPWc1idZadfeT9 and portal dpl_BnZfKUhhrCNKVV5KN2xmtAjTwGof READY. Nine website tests, 42 portal tests, lint/build, live source and editor API checks passed. No new visual/mobile browser test claimed. Read [release details](seo-content-release-2026-09-11.md). Google Business Profile and approved client proof remain next steps.

## September 11: remaining challenge page wording editable

User requested “A little support at home” and other free-challenge wording be editable. Added 39 shared page-copy fields grouped in Challenges, plus a prominent link from Content → Edit website. Uses existing published `site_content` key `challenge:page`; no migration or real copy/member changes. Program-specific name/note/dates/habits/workouts stay in their existing editors. Defaults preserve current text. Portal `dpl_FDm7iXthug7NgHkPkHG6sjFNqbox` READY via root deploy script. Lint/build, copy/save-action tests, transactional admin-write/public-read/non-admin-denial checks, and live public/access checks passed. No authenticated browser save or physical-phone testing. Read [release and scope](challenge-page-wording-2026-09-11.md).

## September 11: finding “A note from Kelsey” in Challenges

User's screenshot clarified that the free-program copy she wanted was the existing welcome note. Renamed its field from “Welcome & announcement” to “A note from Kelsey,” made “Edit program information” prominent and separate from workouts, and added admin-only direct edit links beside the note. Portal `dpl_FT3HP1NvGVA4Ay32QAUFHmJNnqV7` READY via root deploy script. Lint/build/TypeScript and live public/access checks passed; no authenticated browser save or physical-phone test. No note content or database changed. The support paragraph below remains static. See [release details](challenge-note-editor-2026-09-11.md).

## September 11: SEO launch follow-through

User authorized post-launch SEO setup. Public site deployment dpl_7Wz7MiFkfDwwhN4RFxdZBQA3bmL1 READY: permanent preview GET/HEAD redirects and homepage Search Console verification tag. Preserve the tag. Canonical URL-prefix property verified; sitemap submitted. Domain property remains unverified (no DNS changes). Live Google mobile and structured-data baselines recorded. Four-week SEO heartbeat scheduled. Read [execution record](seo-launch-2026-09-11.md) for exact indexing outcomes and remaining opportunities. Portal unchanged.

## September 11: messaging restricted to paid memberships

User clarified free 21-day challenge excludes messaging. Deployed portal `dpl_AitkC8LX2HYV4HKjj2VQcMrKcDsh`, READY. Challenge rooms disabled, free-only messaging/API/push access blocked, navigation and WhatsApp promises removed. Paid class enrollment (positive payment marked paid) or active coach-managed training required; dual challenge/paid members keep paid access. Two migrations applied; 38 tests, lint/build and transactional role-access tests passed. No real messages, notifications, or payment changes; no authenticated browser/physical-phone claim. Read [release and precise eligibility rules](messaging-paid-access-2026-09-11.md). This supersedes the earlier all-challenge messaging entitlement.

## September 11: challenge in Coaching navigation

Kelsey reported that the 21-day challenge was difficult to find and suggested Coaching. Added “Free 21-Day Challenge” linking to https://portal.holden.health/challenge in shared managed navigation and all 25 HTML header fallbacks; the existing mobile menu clones this navigation. Homepage entry retained. Published website using root `npm run deploy:site`: `dpl_6L1EwKGdP4kwxUknJPtCAu8U6erk`, READY. Nine website tests and SEO checks for 20 sitemap pages passed; checked exactly one fallback navigation link per page, live homepage/shared script content, and challenge HTTP 200. No browser interaction or physical-phone testing claimed. Portal and database unchanged.

## September 11: live public launch

User requested removal of preview/test information and launch. Public website password gate removed; demo routes retired to member login; nine retained synthetic accounts and two test challenges with fixtures removed after exact-ID rollback rehearsal. Both required production deploys READY: site dpl_A9ogRez6dip5nxA8jwjzPYiLBxWz; portal dpl_AdziBWMucDiXpy2LNdUfeymJeFUj. Website/portal tests, builds and live public access/redirect checks passed. **One Test-labeled live Stripe order remains payment_processing for reconciliation; do not delete as synthetic.** Concurrent messaging task cleaned its temporary fixtures; final test-profile/session checks empty. See [launch record and retained-payment details](live-launch-2026-09-11.md). This supersedes earlier instructions to retain demo users and keep website preview enabled.

## September 11: privacy placement follow-up

User requested moving privacy to the bottom. Collapsed details now follow Sign out on Account & support. Portal dpl_6jpHoiLZKotSKbjMY4jQSznrGsty READY; lint/build and live browser ordering passed. See [release details](announcement-privacy-release-2026-09-11.md).

## September 11: announcement audiences and compact privacy

User requested fixes. Portal deployed dpl_7SA8rHXXNoKCKYC7Kst1tuTB2KZm READY. More privacy details collapsed; admin explicit all-signed-in/class audience choice and audience updates; published announcements on Today. Existing Test remains class-specific; no broadening. Migration 20260911181207_announcement_audiences.sql applied with ordinary-member visibility/write-denial tests passed and rolled-back fixtures. All 33 tests, lint/build passed. Live browser checked privacy, Today Test and admin controls using an admin-privileged account; no ordinary-member browser or physical iPhone test claimed. See [release details](announcement-privacy-release-2026-09-11.md).

## September 11: iPhone home-screen logo

Added `web-app/src/app/apple-icon.png`, an unchanged copy of `assets/logo.png`, and root application/home-screen name `Holden Health`. Existing source logo is 132×128; no logo redesign. Portal deployment `dpl_EEQY6QAEBChaX83E5kmbpZwyTyuf` READY at https://portal.holden.health via root deploy script. Local production build/TypeScript and targeted ESLint passed; live login metadata and logo bytes verified. No physical iPhone test claimed. Existing shortcuts should be removed and added again through Safari to refresh the icon. Public website unchanged.

## September 11: universal website editor

After a linked FAQ paragraph could not be selected, the user explicitly requested production deployment and a general solution so ordinary website edits no longer need code changes. Added automatic mixed-text selection, a searchable All page content inventory, form placeholder/option editing, Explore mode for interactive states, dynamic-state-specific selectors, legacy override compatibility, more shared-header fields, and 404 page editing. Browser coverage passed across 24 pages / 1,646 text parts, plus preview/reset/link retention/dynamic state/placeholder checks. Website checks, portal lint/build, and 33 portal tests passed; phone widths checked. No real content publication or customer submissions during tests. Read [release and deployment evidence](website-editor-release-2026-09-11.md) before further editor changes. Preserve the automatic detection approach; do not return to individual markup patches. Save unpublished user changes before refreshing the editor.

## September 11: privacy disclosures and tracking changes deployed

User authorized privacy updates. Expanded policy for portal health/coaching data, providers, device storage, and manual data requests; legal pages now bypass the public-site preview gate. Added portal-wide legal links, form/intake notices, Account & support data guidance, and basic portal/demo terms. Disabled all new LogRocket initialization and event collection, including member identification; keep disabled unless explicitly reconsidered. Historical vendor records and older already-open tabs are not erased by this release. No database changes, data deletion, new waiver, or messages.

Portal `dpl_7LRfda5W8fxvkgEMdy76PqrUSh1r` and website `dpl_BPgcH22b2zyrGMeeMySzheunFmmV` are READY on their production domains. 33 portal tests, 12 website tests, SEO checks, lint/builds, anonymous live legal/form-page checks, and local/live browser-bundle scans passed. No authenticated/visual browser or vendor-retention audit claimed. Read [privacy release](privacy-release-2026-09-11.md) and [data operations/follow-up guide](privacy-data-operations-2026-09-11.md) for Kelsey's remaining vendor cleanup, retention schedule, external-form access, and legal-review decisions. Website sales pages remain behind preview access.

## September 11: live personal-training walkthrough and feedback fix

Completed a production member walkthrough using a disposable plan on the retained test account: assigned workout discovery, shorter option, actual save, reload, overall progress, and 390/320px layout passed. Found and fixed one-to-one workout feedback incorrectly treated as an array in member/admin displays. Confirmed feedback appears live after deployment `dpl_7ngomCirzzvJrju2CXGBVybvxet6`, READY at https://portal.holden.health. All 33 tests, lint, production build/TypeScript passed. Exact test relationship/workout/options/log/feedback removed and verified absent. No existing history or account privileges changed. Read [walkthrough evidence and limits](personal-training-walkthrough-2026-09-11.md). Actual external weekly form/personal intake still require the shared Google Doc; no new coach-authoring UI or fresh-login test claimed.

## September 11: coaching workflow clarification deployed

Kelsey confirmed weekend (Saturday/Sunday) client planning plus a weekly check-in form and customized shorter workouts for busy weeks. Replaced the personal-training Wednesday Reset form with coaching guidance/contact, updated associated links, added consult-decided appointments sent by email/text and a two-hour ongoing coaching response time, and confirmed portal class changes are sufficient notification. Existing reset backend/history retained; no plans or member data altered. Two separate November 7 classes confirmed, actual links and Goal-to-Action sheet still outstanding. Personal-training check-in URL unconfirmed; ask Kelsey rather than assume the group form. Deployment `dpl_GFP5vJPCi9Sdi3LYuZ39BhrtUD9A` READY at https://portal.holden.health, via root deploy script. All 33 tests, lint, and production build/TypeScript passed. No new authenticated populated-plan browser check. See the follow-up in [release record](member-portal-release-2026-09-11.md).

## September 11: member portal audit fixes deployed

User authorized fixing and deploying the member portal audit. Latest portal deployment `dpl_Bi6K1U2bjXp7Js46vMxndzgwjVPM` is READY at https://portal.holden.health. Read [the release record](member-portal-release-2026-09-11.md) before continuing. Group onboarding/Classes navigation, mobile intake validation and answer retention, session timing/readiness/policies, progress context, account support, partial-workout defaults, and personal-training/reset states were improved. Applied `20260911150145_member_week_reset_atomic.sql`; zero-session resets are atomic/idempotent and include overdue unfinished workouts. All 33 tests, lint, TypeScript, builds, and transactional reset tests passed. Focused local group-member and live challenge-member checks passed; an initial production load error recovered on refresh, and runtime logs could not conclusively establish its cause. No real member submissions were made. Actual Zoom link, Goal-to-Action sheet, and coaching/scheduling policy details still need Kelsey; see release for exact remaining inputs and verification limits. Public website unchanged.

## September 11: countdown minutes option

Added a Minutes/Seconds selector to the shared countdown settings (`web-app/src/components/timer-fields.tsx`), available in the workout timer and coach presets. Whole-minute durations initially display in minutes; switching units preserves the stored duration. Decimal minutes convert to the nearest second. Existing timer storage and countdown behavior remain unchanged. All 33 portal tests, lint, TypeScript, and local/production builds passed. No new browser interaction or physical-device verification claimed.

Deployed with the required root `npm run deploy:portal` after the user's explicit request. Portal deployment `dpl_6iPF63SAsZfx34867N25JCKgKFAd` READY and aliased to https://portal.holden.health; live login returned HTTP 200. Public website and database unchanged.

## Latest correction: remove encouragement

The user disliked the encouragement option and requested removal. Removed device-spoken encouragement, its toggle/replay, rotating written messages, supporting hook/helper, and styles. Timer, next-movement and save chimes remain. Lint and local/Vercel production builds passed. Portal deployment `dpl_9woJmPWuuCDZhfcJVJo7PVRneZWd` READY at https://portal.holden.health, superseding the release below. No data changes. Do not reintroduce encouragement without a new request.

## Latest request: fun workout sounds and encouragement

Added and deployed next-movement tones, a four-note completed-save chime, a gentler partial-save chime, rotating written encouragement, and separately opt-in device-spoken encouragement with replay. Existing timer sounds remain. Both preferences persist per member/device; voice defaults off. Shared member/public-demo player updated without database or dependency changes. All 28 existing tests, lint and production builds passed. Browser instrumentation verified completed-save audio/voice calls, silent muted partial save, retained preferences, correct count, and 320px layout. Actual speaker output/iPhone voice quality not tested.

Latest portal deployment: `dpl_BgYEZ6ihr2FN3SEcPq2tPHaBypnF`, READY at https://portal.holden.health, superseding deployments recorded below. Live demo start and controls verified. [Encouragement verification](workout-encouragement/verification.md). No member records or retained test workouts changed.

## Stopping point

The user accepted the current release and chose to stop after the five-member demo pilot. Do not resume implementation, outreach, or testing without a new request. This handoff records the work available in this conversation and the saved release documents; it is not an audit of unrelated work from other sessions.

## What shipped

- Public homepage life-goal choices lead to the portal first-week preview at `/start?goal=family|confidence|return|myself`. Visitors can explore group or personal training. An allowlisted preset is remembered in a host-only cookie for 30 days; members confirm their own goal after signing in.
- Member `/portal/progress` includes current and original goals, six weeks of recorded activity, personal wins, workout/check-in reflections, and published coach recaps. Today and intake completion link into the story.
- Kelsey’s `/admin/stories` supports member search, new-win indicators, member context, private recap drafts, preview, and explicit publication. Recaps preserve goal/activity snapshots. Publication checks stale draft versions and changed evidence. Published recaps are immutable in this release.
- Added `member_story_goals`, `member_story_wins`, and `member_story_recaps`, with member isolation and coach-only publication. Applied migration `20260909164638_member_progress_stories.sql` to Supabase project `urxxiohatmvqbgrzqibq`.
- This release uses written coach notes and existing recorded activity. No automatic outreach or AI coaching feature was added. Partial workouts remain separate and only confirmed attendance counts as a class.

## Deployment and implementation references

- Portal production deployment: `dpl_GeQh18zhioxdvu88PTED7gppfNYo`, READY, https://portal.holden.health.
- Website production deployment: `dpl_7XqJkuFTptSkQwi8JsmMT3t4kwNq`, READY, https://holden.health.
- Deploy only from the workspace root with `npm run deploy:portal` or `npm run deploy:site`. The portal Vercel Root Directory remains `web-app`.
- Main implementation: `web-app/src/lib/progress-story.ts`, `progress-story-data.ts`, `src/app/portal/progress`, `src/app/admin/stories`, and story components/styles under `src/components`.
- The public website preview-password gate remained enabled at stopping time.

## Verification and limits

The original release record reports 20 portal tests, 10 website tests, SEO checks, lint, TypeScript, production builds, database access-control tests, local UI saves/publication, populated synthetic activity counts, historical snapshot checks, and production HTTP checks passing. Earlier first-week and progress screens were inspected at 390×844 without horizontal overflow. That original disposable fixture was removed.

The later five-member pilot was a separate test. All five signed in independently, saved a goal and personal win through authenticated server actions against the local production build/live database, and received a clearly labeled sample recap. Draft visibility was checked for four ordinary members while the fifth temporarily tested the coach role. After removing that role, all five could read only their own published recap and their live production Progress pages displayed the expected goal and recap.

Do not describe the five-member pilot as a full visual mobile walkthrough: it used automated submissions and authenticated live-page reads. A complete visual mobile member journey remains a useful follow-up when requested. Checkout, email campaigns, and the entire pre-existing training workflow were not retested end to end. The release record also notes that production runtime-log access was denied; passing HTTP checks are not proof of clean runtime logs.

## Retained demo data

The user explicitly requested fake members instead of a real-client pilot. Avery, Morgan, Riley, Casey, and Jordan each have `(DEMO Story Pilot)` in their profile name, one sample goal, one sample win, and one published sample recap. These are new-member stories with zero recorded workouts/classes/habit days. Recaps explicitly state that they are testing samples and were not written by Kelsey.

All five use `@example.invalid`, are marked `is_test=true`, and have `email_opt_in=false`. No real members were contacted. Temporary staff access was removed, sessions revoked, and temporary credential files deleted. Retain these records for Kelsey’s review unless the user asks to remove them. Do not treat their sample notes as actual coaching or their data as real customer activity.

[Open retained demo stories](https://portal.holden.health/admin/stories?q=DEMO%20Story%20Pilot) with a staff login. Account IDs and individual links are in the demo pilot record below.

## Detailed records

- [Build plan](member-progress-stories-plan.md)
- [Release verification, deployment, and known limitations](member-progress-stories-verification.md)
- [Five-member demo pilot results and account links](progress-story-demo-pilot.md)
- [Unsent real-member invitation draft](progress-story-pilot-invitation.md)

The original plan and release verification proposed a real-client pilot; the user's later choice was the retained synthetic pilot described here. Kelsey has not authored the demo recaps herself. No new deployment was required for the five-member test or this documentation update.

## Later request: enable a workout for hands-on testing

After the stopping point, the user requested a workout to test as a member. On September 9, reactivated the existing `TEST — Active challenge verification` (`ddcaf297-b38f-497d-b3cf-e61f9917848f`), running September 8–28, by setting published=true and archived=false. Signups remain closed. Its existing participants are Neil’s account and TEST Member; no new enrollments were created.

Copied the existing gentle starter workout into that challenge as `TEST — Gentle strength & movement` (`cb7862d6-ed7e-481f-a31d-7f6e32c973e0`), published September 9, with the original six steps, notes, references, and timer settings. The original September 21 challenge/workout schedule remains unchanged. The two older archived placeholder workouts remain archived.

Opened the released copy in the user’s existing Chrome member session and confirmed the workout player, six steps, timer, and Finish & check in control rendered without a preview restriction. Database checks confirmed both enrolled accounts can log today. No completion was submitted on the user’s behalf. The player was running when inspected. No application deployment was needed. Retain this test challenge/workout while the user tests; archive when requested afterward.

[Open test workout](https://portal.holden.health/portal/workouts/cb7862d6-ed7e-481f-a31d-7f6e32c973e0).

## Later request: redesign the workout app

The user supplied an iPhone photo showing oversized nested panels and inaccessible controls and requested a more polished, intuitive, responsive member workout experience. Implemented and deployed a workout-library, preparation, active-player, check-in, and success-screen redesign. The active player uses a dark timer panel, a single movement surface, expandable guidance, and sticky controls; general navigation hides while a session is open, with explicit library navigation retained. Existing save and recovery mechanisms remain intact. Also fixed challenge-picker navigation on Workouts and display of literal newline escapes in coach notes.

Latest portal deployment: `dpl_FGNtHZacKbFM1zYX7YmsJgLevaBo`, READY at https://portal.holden.health. This supersedes the earlier portal deployment above. No public-site deployment or database migration was needed.

Read [workout redesign verification and screenshots](workout-redesign/verification.md). Phone-sized Chromium and desktop browser checks passed, including start, pause, six-step navigation, paused recovery after reload, partial/completed saves, Progress visibility, and a live production save. This work completes a browser walkthrough of the redesigned workout flow; it does not claim physical iPhone/Safari testing or a full five-member story mobile pilot. All 20 portal tests, lint, and production builds passed. The disposable QA account and its three test logs were removed; the user's enabled test workout and the five original demo stories remain.

## Later request: add the website’s 20-minute workout to the app

Imported the workout from the local source of https://holden.health/20-minute-strength-workout.html at the user's request. Saved canonical app content in `docs/workouts/20-minute-strength.json`. The app version preserves the 3-minute warm-up, 15-minute strength circuit, 2-minute reset, 8–12 controlled reps, five movement patterns, carry/core dose, home swaps, and coaching/safety guidance. Thirteen valid steps: warm-up, two five-movement rounds, an optional third-round block, and reset. Uses the existing self-paced elapsed clock (timer_config=null), not arbitrary work/rest intervals.

- Active test workout, available September 9: `3db9a214-5585-4f4e-be6c-d295925a982f` in `ddcaf297-b38f-497d-b3cf-e61f9917848f`.
- Official September 21 challenge copy: `81139b1a-ec22-4dce-874d-46419f9679d2`, scheduled September 21.
- Reusable admin workout template: `8a4399a5-3fbb-4678-9a48-170259a4e9c7`.

Validated all steps with the app validator and checked visibility and logging eligibility under the existing ordinary TEST Member’s authenticated database role. The test copy is available; the scheduled copy remains hidden until release. Opening a new browser session redirected to member sign-in, so no authenticated visual walkthrough of this particular workout is claimed. No workout completion or email was submitted, and no deployment was required for these content records.

## Later request: personal workout guidance and timer sounds

The user wanted a stronger app experience without Kelsey exercise clips and approved the illustrated/personal Today/rest direction. Mid-build they requested questions for Kelsey, then specifically asked for timer sounds. Implemented eight original SVG movement guides with retained instructions and easier options, circuit round labels, optional 30/60/90-second rests with paused recovery and explicit continuation, personal Today with Kelsey's existing portrait and the member's actual goal, and real weekly completion counts in the save confirmation.

Timer sounds are opt-in using the active player's Sound off/on button, with per-member device preference. Turning on previews a tone and unlocks browser audio. Beeps at 3/2/1 and a two-note chime at timed transitions/completion; pause/mute do not replay cues, and the self-paced workout clock has no arbitrary countdown. Keep the app open and media volume on. No promise of locked-phone/background playback.

Latest portal deployment is now `dpl_3rvneTrW339pTNLEwFohAMxycXfa`, READY at https://portal.holden.health, superseding prior portal deployments above. No public-site deployment, database migration, dependencies, or workout schedule changes. All 26 portal tests, ESLint, local/production builds passed. Phone-sized Chromium checked at 390×844 and 320×568, desktop Today at 1440×1000. This includes browser verification of the 20-minute workout added earlier. Audio scheduling verified with Web Audio instrumentation; no physical iPhone/Safari/speaker testing claimed.

Kelsey has not answered the questions or approved the diagrams. Important follow-ups: manual repetitions vs timed intervals; rest prescriptions; her cues/easier options; diagram review; preferred Today priority; chest press on bench or floor. Chest press remains written guidance because the intended variation is not confirmed. Reference links and details are in [guidance verification](workout-guidance/verification.md).

Final live walkthrough confirmed a full 30-second rest with countdown/finish cues, same-movement continuation, and a successful production session save. The synthetic completed count advanced correctly to two, excluding its partial session. Removed only the new DEMO Movement QA identity, its three logs and goal/enrollment, and revoked its sessions. Original five demo story accounts, Neil/TEST Member, both active test workouts, and September 21 releases remain intact. Temporary QA credentials and browser/server processes were cleared.

## Kelsey's answers received after the guidance release

The user relayed these direct answers from Kelsey:

- Prefer members following timed work/rest.
- Rest depends on the workout format: AMRAP uses rest as needed; interval/Tabata-style examples are 20 seconds work / 10 seconds rest or 40 seconds work / 20 seconds rest.
- Lead Today with the assigned workout.
- She is willing to review the illustrations. This is not an approval of the existing illustrations.
- Dumbbell chest press may use a bench or the floor; neither is the exclusive required variation.
- She asked which five exercises needed coaching cues. Clarified these are goblet squat, dumbbell chest press, dumbbell Romanian deadlift, one-arm dumbbell row, and suitcase carry from the website's 20-minute workout. Her cues/easier options remain outstanding.

Current-state check: Today already prioritizes an assigned personal-training workout when present, then an available challenge workout. Existing timer supports countdown, interval, EMOM, and stopwatch. The imported website workout still explicitly prescribes a 3-minute warm-up, a 15-minute rep-based circuit (8–12 reps), and a 2-minute reset, with a self-paced clock. Kelsey's general examples do not select a specific replacement prescription for that workout. Do not silently convert its 20-minute total to 20 minutes of AMRAP plus warm-up/cool-down, or choose 20/10 versus 40/20 without that programming decision. No code, live workout prescription, or deployment changed when recording these answers.


## Follow-up: workout structure accepted; exercise questions dropped

The user asked to ignore the exercise questions and relayed that the proposed workout structure works, with omitting warm-up/cooldown also acceptable. Chose to retain the existing 20-minute structure: 3-minute warm-up, 15-minute strength circuit with rest as needed, and 2-minute cooldown. This is already the canonical workout, so no content change or deployment was necessary. The existing self-paced clock and manual movement navigation remain; this reply does not select 20/10 or 40/20 intervals or implement automatic phase advancement. Do not continue asking for exercise cues/easier options. Illustration review is still separate and not yet completed.

## Later request: share the app without account creation

Added and deployed a public demo at https://portal.holden.health/demo, with direct workout link https://portal.holden.health/demo/workout. Synthetic Today, Workouts, Habits, and Progress screens let testers explore without signing up. Uses the real member workout player with a separate browser-only save branch, versioned local demo storage, local practice goals/wins/habits/check-ins, and Reset demo. Sample identity is Avery; it is not one of the retained authenticated demo accounts. No database changes, accounts, emails, or real-member access. Existing member/admin authentication remains in place.

Portal deployment `dpl_A6nBQ6hds6hqhouvyV5hKWd7GRgW`, READY, supersedes prior portal deployments. Deployed from workspace root with `npm run deploy:portal`. Public website unchanged. [Public demo verification](public-demo/verification.md) records checks and scope. The sample workout is a deliberate local copy of the canonical 20-minute JSON, so future workout content changes require syncing that copy. This is a public sample experience, not a test of registration, payments, email, or real coaching publication.

## Later request: clarify full app access with every membership

Added explicit full Holden Health app access at no extra cost to the homepage offer/app sections, group fitness pricing card, online training offer, nutrition benefits, group registration, and online training checkout. Standalone public-site benefit copy remains visible independently of managed text overrides. Copy-only changes; no access rules, prices, checkout behavior, or member records changed.

Website checks (18-page SEO and 10 tests), portal lint, and local/production builds passed. Published via the prescribed root scripts: website `dpl_F7ZWLH6DafFKbzAUL5oCG1n54Bur`, portal `dpl_EuX5owSiz9x6kvkG9aV79GGJ6oVz`, both READY. Website preview gate remains in place; no visual browser QA performed for this copy update.

## September 11: customer website audit fixes deployed

User requested a complete customer audit, supplied Kelsey's program/policy answers, then authorized implementation and production deployment. Read [customer audit release](customer-audit-release-2026-09-11.md) before further website work. October program begins October 13; Saturday 7:30 or 9; November 7 is Zoom. Personal training is consultation first, $100/60 minutes at Burroughs. Offline reservations hold a place with payment pending, $4 fee only for Stripe. No drop-ins; late joins are handled individually with prorating. Pre-start cancellation refunded; makeup within session by communicating with Kelsey; emergency coach cancellation gets at-home workout.

Latest website: `dpl_FZ8tYobcSbbf5QMUdVASfA7HyzKZ` READY. Portal: `dpl_8UoH1LuF6vcMqzqNyEgqXQRpceTb` READY. Preview gate remains enabled; email welcome note accessible without password. Two database migrations add offline reservation capacity handling and consultation overlap guard. Existing booking preserved; future unbooked consultation windows now 60 minutes. 11 website and 28 portal tests, lint/builds, live page checks, and Gmail welcome delivery passed. No payment or live reservation was submitted. Source, test limits, remaining editorial assets, and deployment details are in the release record.

## September 11: member messaging and membership benefits

Built and deployed Communicate: one group per class program/habit challenge plus private member-to-coach conversations, saved text, unread counts, muting, history, and coach moderation. Ended programs are read-only; enrollment controls access. Optional Web Push configured with generic private previews, device opt-in, and sign-out cleanup. Website membership benefits now mention messaging. Read [messaging release and verification limits](messaging-release-2026-09-11.md) before continuing. 35 portal tests, lint/build, database access-control tests, and a local authenticated HTTP walkthrough passed. All temporary users/messages/programs removed. Physical phone notification delivery and subscription/start endpoint integration remain unverified. Push retries depend on subsequent app activity. Coordinate with [live launch](live-launch-2026-09-11.md) for current deployments; preserve demo retirement and removal of old test data. No further test fixtures retained.

## September 11: live messaging test and phone fixes

Explicit user test request completed. Live API plus two authenticated browsers passed private/group messaging, new private-room creation, unread/mute state, moderation, duplicate prevention and access isolation. Fixed bottom navigation covering Send with a full-screen mobile conversation and keyboard viewport handling; fixed newest-message scrolling and Safari notification permission timing. Portal `dpl_9EdEHytwho3WJvCQcjmA8LTktSoV` READY. 390/320px and 390×400 keyboard-space simulation passed; offline draft saved once after reconnection. Notification on/off tested with browser doubles and live API; actual phone push delivery remains unverified. All temporary users/program/messages/subscription removed and zero leftovers verified. Read [follow-up evidence](messaging-release-2026-09-11.md). Preserve real coach welcome messages, program closed/open choices and launch/demo-retirement edits.
