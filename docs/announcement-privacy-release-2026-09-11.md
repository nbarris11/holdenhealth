# Announcement audiences and compact privacy — September 11, 2026

User requested fixing the oversized privacy section and announcements missing from member Today.

## Released behavior

- More: privacy information is preserved in a collapsed native details element labeled Privacy & data requests.
- Admin Content: explicit audience choice (all signed-in member accounts or a specific class session), visible audience labels, and Save audience for existing announcements. Works without an active class session. Resources retain existing session behavior.
- Today: authenticated RLS-scoped published announcements, newest first; earlier posts expandable; multiline bodies preserved. Classes also includes applicable global updates.
- Existing Test announcement remains assigned to Focus on You: First 6-Week Session. No post audience was broadened. To reach challenge/personal-only accounts, choose All signed-in members and Save audience.
- Migration 20260911181207_announcement_audiences.sql makes session_id nullable for explicit all-member audiences and revises SELECT RLS. Admin can see drafts; members cannot see drafts/future posts or other class audiences. Admin-only writes remain. Legacy open forms retain their sessionId audience.

## Deployment and verification

Portal production dpl_7SA8rHXXNoKCKYC7Kst1tuTB2KZm READY at https://portal.holden.health via root npm run deploy:portal. Public website unchanged.

33 tests, ESLint, local production build/TypeScript, and Vercel build passed. Transactional live SQL suite saved at supabase/tests/announcement-audiences.sql passed global/class visibility, draft/future exclusion, admin draft visibility, anonymous denial, and member write denial. Fixtures rolled back.

Live browser verified collapsed privacy and expansion, Today Test content with line breaks, and admin audience controls. Clicked Save audience with the original selection retained. Browser account has admin privileges and zero class enrollments: do not describe this as an ordinary-member browser test. Ordinary-member authorization was exercised via authenticated SQL roles. No new emails, announcements, real-member submissions, or audience expansion. No physical iPhone or phone-viewport test claimed.

Security advisor returned no announcement-specific finding. Existing unrelated notices remain: checkout_orders with RLS/no policies; three admin SECURITY DEFINER RPCs callable by authenticated; leaked-password protection disabled. This release does not audit or change those. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy , https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable , https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## User-requested follow-up test

Created a uniquely named hidden draft through the live admin form with All signed-in members selected and publication unchecked. Verified the persisted record had session_id NULL and published_at NULL. Changed its audience via the live Save audience form to December Mini Session and reloaded; correct new audience and Hidden draft label persisted. Ordinary-member SQL role suite reran successfully, including global/class audiences, draft/future restrictions, anonymous denial, and member insert/update/delete denial; fixtures rolled back.

Live Today displayed original Test with multiline body and excluded the new draft. Privacy was collapsed initially and expanded on click. At actual 391 CSS-pixel viewport width, Today and expanded privacy had scrollWidth 391 (no horizontal overflow). Original requested viewport translated to 520 CSS pixels because of browser zoom; adjusted dimensions and measured 391 explicitly. Restored viewport afterward. Browser is still an admin account; no physical iPhone test.

Attempt to run isolated ordinary-demo-member HTTP checks stopped before login because neither local nor pulled production configuration supplied a Supabase service/admin key. No credentials or privileges changed and no demo session was created. Ordinary-member verification remains live SQL-role tests, not a separate member browser login. Temporary environment/script removed. Hidden draft removed by exact ID; original Test and its class audience retained. No announcement or email broadcast.

## Privacy placement follow-up

At user request moved the collapsed privacy details to the bottom of Account & support, after Sign out. Lint and production build/TypeScript passed. Deployed via root npm run deploy:portal: dpl_6jpHoiLZKotSKbjMY4jQSznrGsty READY at https://portal.holden.health. Live browser reload verified final ordering and collapsed state. No additional announcement/database change. Current workspace also included other concurrent app additions; this entry claims only privacy placement verification.

Clarified current announcement flow: newly signed-in members can see all older published all-member announcements, and older class announcements if eligible for that class; no signup-date filter or automatic expiry. Newest appears on Today and older eligible posts are expandable.
