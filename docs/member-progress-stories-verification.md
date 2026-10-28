# Member progress stories — release verification

September 9, 2026

## Delivered

- Homepage goal choices link to `/start`, with group and personal-training first-week previews and existing enrollment links.
- A 30-day host-only cookie remembers an allowlisted goal preset in the same browser. The member confirms their own wording after signing in. Personal free text is not stored in the cookie or URL.
- Progress includes the current goal, preserved original goal, last six weeks of activity across programs, personal wins, existing workout/check-in reflections, and published coach recaps.
- Today includes a link to the personal story after the next-workout/week section. Intake completion links to the story goal form.
- Kelsey has a Member stories navigation item, member search, new-win indicators, context, a draft editor, preview, and explicit publication to the member's story.
- Recaps save goal and activity snapshots. Publication checks for changed evidence and stale draft versions. Published recaps are immutable in this first release.
- Written messages only; no voice uploads, automated outreach, AI-generated coaching, or new dependencies.

## Verification

| Check | Evidence |
| --- | --- |
| Unit tests | 20 portal tests passed, including new counting, date-boundary, empty-story, and preset checks. |
| Website | 10 site tests passed. SEO checker passed for 18 sitemap pages. |
| Build | ESLint, TypeScript, local production build, and both Vercel production builds passed. |
| Member forms | Disposable member saved a goal and win through local UI. Reload preserved both. Saving a revised goal retained the original. The website preset appeared in the member goal form. |
| Coach workflow | The disposable fixture temporarily exercised the coach role, saved a draft, opened the preview, and published a clearly labeled TEST recap. The role was then removed. |
| Member recap | The member-only fixture saw the published recap. A direct attempt to open `/admin/stories` redirected into the member portal. |
| Populated activity | Private synthetic records produced exactly 1 completed workout, 1 partial session, 1 confirmed class, and 1 habit day from 3 checked habits. A group check-in appeared with its source label. |
| Snapshot history | After adding that synthetic activity, the current story showed the new counts and the earlier published recap retained its original zero counts. |
| RLS | Transactional tests passed for own writes, cross-member read/write denial, original goal protection, hidden drafts, coach-only publication, published visibility, win deletion, anonymous denial, and database timestamps. Test identities rolled back. Repeatable SQL is in `supabase/tests/member-progress-stories.sql`. |
| Mobile | First-week and member progress screens inspected at 390×844. Document width was 390px, with no horizontal overflow. Temporary viewport override reset. |
| Browser errors | No error-level browser entries returned during the local recap verification. |
| Production | Authenticated HTTP checks passed for populated story, published recap, partial-session text, member denial from admin, anonymous login redirection, and public `/start`. Public preview also inspected in the browser. |
| Homepage | Live goal section inspected through the existing authenticated preview on `holden.health`. The website preview-password gate remains enabled. |
| Cleanup | Disposable member, temporary coach role, tokens/sessions, goals, win, recap, private test challenge/workouts, and private test group session removed. Database checks returned zero remaining test users/goals/wins/recaps. Temporary credential files and test servers removed/stopped. No real-member message was sent. |

## Deployment

- Portal: `dpl_GeQh18zhioxdvu88PTED7gppfNYo`, READY, `https://portal.holden.health`.
- Website: `dpl_7XqJkuFTptSkQwi8JsmMT3t4kwNq`, READY, `https://holden.health`.
- Used the required root commands: `npm run deploy:portal`, then `npm run deploy:site`.
- No Vercel Root Directory changes.
- Migration applied to the existing Holden Health project: `20260909164638_member_progress_stories.sql`. Local filename aligned with the version assigned by the migration API.

## Limits and next use

Pilot with five willing clients. Each saves a goal in Progress, then Kelsey writes a recap at a natural training-block review. Members appear in the story list after saving a goal. Earlier wins show the most recent 50, and recap reads are capped at the most recent 30 records. Longer-term pagination and voice recording are future improvements.

The Supabase advisor found no issue on the new tables or function. Existing findings remain for checkout-table policies, admin SECURITY DEFINER RPCs, and leaked-password protection; those were not changed. The Vercel connector's runtime-log query returned a permissions error, so it is not evidence of clean production logs. Production HTTP checks and deployment build results passed independently. Checkout, email campaigns, and the full existing training workflow were not re-tested end to end in this release.
