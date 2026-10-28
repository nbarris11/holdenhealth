# Portal and Website Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give members a three-tab portal (Workouts, Habits, Messages) with coach comments on habit days, drop the Sunday survey, let Kelsey repeat a workout on a new date, and cut the public site down to Coaching (3 pages) + About Me.

**Architecture:** Portal changes live in the Next.js app `web-app/` (App Router, Supabase with RLS, server actions). One additive Supabase migration adds `habit_comments`. Website changes are static HTML plus `site.js`, with menu/header defaults in `web-app/src/lib/website-pages.ts` and `website-header.ts` (served to the site by `/api/site-content`).

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase Postgres + RLS, plain HTML/CSS/JS site, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-28-portal-and-site-simplification-design.md`

## Global Constraints

- Work on branch `portal-site-simplification`; never commit straight to `main` (push to `main` deploys both Vercel projects to production).
- Never edit Finder/iCloud duplicates (`* 2.*`); they are git-ignored.
- One Supabase project (`urxxiohatmvqbgrzqibq`) serves previews and production. The migration must be purely additive and is applied to production (after telling Neil) before any code using it merges.
- Stored website content (`site_content` header/CTA values) is changed only after the HTML ships (Task 9).
- Group Fitness wording, verbatim: "4–6 week sessions offered throughout the year. Reach out today to find out which session is currently running!"
- No rates or session dates on the public website.
- Existing data is never deleted: `check_ins`, habit weeks/marks/revisions, workouts and logs stay.
- Tests: portal `cd web-app && node --test tests/<file>.test.mjs`; site `npm run check:site` (repo root); SQL tests run as one script via Supabase `execute_sql` and must end in `rollback` with a `PASS` line; portal build `cd web-app && npm run build`.

## Review Focus

1. A member edits a week's habits after Kelsey commented on habit #2 — the comment must still show the habit text it was about (snapshot `habit_text`), not whatever is now in slot #2. Test in Task 1.
2. A member tries to start a thread, or reads/replies on another member's habit week — must be refused by RLS. Test in Task 1.
3. A free-challenge-only member (no paid chat access) opens the portal — nav must not show a Messages tab that dead-ends, and Workouts must still render. Test in Task 4.
4. Old links (`/portal/today`, `/resources.html`, `/nutrition-coaching`, `/index.html#the-app`, Google results for blog articles) must land somewhere real, never 404. Test in Tasks 4 and 8.
5. Repeating a workout must not change the original or its logs, and must not carry the original's date (Kelsey must choose one). Test in Task 6.

---

### Task 1: `habit_comments` table, policies and coach activity (migration)

**Files:**
- Create: `supabase/migrations/20261028150000_habit_comments.sql`
- Test: `supabase/tests/habit_comments.sql`

**Interfaces:**
- Produces table `public.habit_comments(id uuid pk, week_id uuid → class_habit_weeks on delete cascade, day date, habit_index smallint, habit_text text, author_id uuid → profiles default auth.uid(), body text check 1–1000 chars after trim, member_read_at timestamptz null, created_at timestamptz default now())`, index on `(week_id, day, habit_index, created_at)`.
- Produces `private.habit_week_member(p_week_id uuid) returns uuid` — owner via `enrollments.member_id` or `coaching_relationships.member_id`.
- Produces RPC `public.mark_habit_comments_read(p_week_id uuid) returns void` — sets `member_read_at = now()` on unread rows of that week not authored by the caller, only when the caller owns the week.
- Produces coach activity kind `'habit_comment_reply'` (href: PT → `/admin/training/<member>/habits`; group → `/admin/programs/<session_id>/habits`). No `coach_activity_deliveries` rows are created for it (no email).

- [ ] **Step 1: Write the failing SQL test** `supabase/tests/habit_comments.sql`, in the style of `supabase/tests/habit_challenge_rls.sql` (begin; fixture users/session/enrollment/relationship/habit weeks; `set local role authenticated` + `request.jwt.claim.sub`; `do $$ … raise exception … $$`; `rollback`; `select 'PASS: …'`). Assertions:
  - admin inserts a comment on (week A, day d, habit_index 1) → row exists with `habit_text` = week A's `habits[2]` even if the client sent a different `habit_text`.
  - owner member reads it; a different member sees 0 rows.
  - owner member inserts a reply on the same (week, day, index) → succeeds; owner member inserting on a (day, index) with no admin comment → `insufficient_privilege` / check failure.
  - other member inserting on week A → refused.
  - `day` outside week A's dates or `habit_index >= cardinality(habits)` → raises.
  - member updates week A's habits (slot 2 changes) → earlier comment still has the old `habit_text`.
  - `mark_habit_comments_read(weekA)` as owner sets `member_read_at` on the admin comment only; as another member changes nothing.
  - member reply creates one `coach_activity` row of kind `habit_comment_reply` and zero `coach_activity_deliveries` rows.
  - anon has no access.
- [ ] **Step 2: Run it against the database before the migration exists** (Supabase `execute_sql`, project `urxxiohatmvqbgrzqibq`). Expected: error `relation "public.habit_comments" does not exist`.
- [ ] **Step 3: Write the migration.** Follow `20261001160712_class_weekly_habits.sql` patterns: `revoke all … from anon, authenticated`; `grant select, insert` to authenticated; policies using `(select private.is_admin())` and `private.habit_week_member(week_id) = (select auth.uid())`. A `before insert` trigger (security definer, `search_path=''`) validates day/index against the week using the same rules as `validate_class_habit_mark` (day inside the week and not in the future; `habit_index < cardinality(habits)`; handle both enrollment and relationship weeks as the 2026-10-13 version does) and overwrites `habit_text` with `habits[habit_index+1]` and `author_id` with `auth.uid()`. Replace the inline check constraint on `coach_activity.kind` (find its name in `pg_constraint`) with one that also allows `'habit_comment_reply'`; an `after insert` trigger records it when `author_id = habit_week_member(week_id)`, with `source_key = 'habit-comment:'||id`, honoring the test-member isolation from `20261013234610_isolate_test_activity_notifications.sql` by simply not creating deliveries.
- [ ] **Step 4: Tell Neil the migration is about to be applied to the live database (additive only), then apply it** with Supabase `apply_migration` (name `habit_comments`). Run `get_advisors` (security) and fix any new warning for these objects.
- [ ] **Step 5: Run the SQL test.** Expected: final row `PASS: habit comments …`.
- [ ] **Step 6: Commit** `supabase/migrations/20261028150000_habit_comments.sql supabase/tests/habit_comments.sql` — "feat(db): habit comments with member replies".

### Task 2: Habit comment helpers and server actions

**Files:**
- Create: `web-app/src/lib/habit-comments.ts`
- Create: `web-app/src/app/portal/habits/comment-actions.ts`
- Test: `web-app/tests/habit-comments.test.mjs`

**Interfaces:**
- Consumes: Task 1 table and RPC.
- Produces (in `lib/habit-comments.ts`):
  - `type HabitComment = { id: string; week_id: string; day: string; habit_index: number; habit_text: string; author_id: string; body: string; member_read_at: string | null; created_at: string }`
  - `threadKey(c: { week_id: string; day: string; habit_index: number }): string` → `` `${week_id}|${day}|${habit_index}` ``
  - `groupThreads(comments: HabitComment[]): Map<string, HabitComment[]>` — oldest first within a thread.
  - `unreadForMember(comments: HabitComment[], memberId: string): number` — authored by someone else and `member_read_at === null`.
  - `cleanCommentBody(raw: FormDataEntryValue | null): string | null` — trimmed, 1–1000 chars, else `null`.
- Produces (server actions in `comment-actions.ts`, `"use server"`): `addHabitComment(form: FormData): Promise<FormResult>` (fields `weekId`, `day`, `habitIndex`, `body`; validates with `isUuid`, `validDate` from `@/lib/challenge` and `cleanCommentBody`; inserts via `createClient()`; `revalidatePath("/portal/habits")`, `"/portal/training/habits"`, `"/admin/training"`) and `markHabitCommentsRead(weekId: string): Promise<void>` (calls the RPC).

- [ ] **Step 1: Write failing tests** in `habit-comments.test.mjs` (import the `.ts` directly as `member-portal.test.mjs` does): `groupThreads` groups by key and sorts by `created_at`; `unreadForMember` counts only others' unread comments (own replies and read ones excluded); `cleanCommentBody` returns `null` for `""`, `"   "`, 1001 chars, `null`, and the trimmed string for `"  Nice work!  "`.
- [ ] **Step 2: Run** `cd web-app && node --test tests/habit-comments.test.mjs` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/habit-comments.ts` and `comment-actions.ts`. Errors returned to the UI use plain sentences like the existing habit actions ("Your comment could not be saved. Please try again.").
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** — "feat(portal): habit comment helpers and actions".

### Task 3: Comment threads in the habit tracker (member and coach)

**Files:**
- Create: `web-app/src/app/portal/habits/habit-comments.tsx` (client component)
- Modify: `web-app/src/app/portal/habits/class-tracker.tsx`
- Modify: `web-app/src/app/portal/habits/page.tsx`, `web-app/src/components/personal-habits.tsx`, `web-app/src/app/admin/training/[memberId]/habits/page.tsx`
- Modify: `web-app/src/app/portal/member.css` (marker + thread styles)

**Interfaces:**
- Consumes: Task 2 `HabitComment`, `groupThreads`, `threadKey`, `addHabitComment`, `markHabitCommentsRead`.
- Produces: `ClassTracker` gains props `comments?: HabitComment[]` and `commenter?: "member" | "coach" | null` (`null` = no commenting). `PersonalHabits` gains `commenter?: "member" | "coach"`.

- [ ] **Step 1: Load comments** wherever weeks are loaded (`portal/habits/page.tsx` and `personal-habits.tsx`): `db.from("habit_comments").select("*").in("week_id", weekIds).order("created_at")`, throwing a plain error on failure like the neighbouring queries.
- [ ] **Step 2: Render threads.** In `ClassTracker`, each habit row for the selected day shows a small marker when a thread exists (dot if any comment is unread for a member). Under the habit list, `HabitComments` shows each thread for the selected day: habit text (from `habit_text`), messages with author label ("Kelsey" for comments not by the week owner, "You" for the viewer's own), and a reply box. Coach view: every habit row on past/current days gets "Comment" to start a thread. Member view: reply box only on threads that exist. When the member opens a day with unread comments, call `markHabitCommentsRead(week.id)` once.
- [ ] **Step 3: Wire viewers.** `portal/habits/page.tsx`: `commenter = isPreview ? "coach" : "member"` (admin preview of a group member's tracker is where Kelsey comments on group habits; update the preview banner to "Read-only checkmarks · you can comment on any day's habit"). `personal-habits.tsx` passes `commenter` through; member pages use `"member"`, `admin/training/[memberId]/habits` uses `"coach"` (update its "Read-only coach view" line to say Kelsey can comment on any day's habit). Checkbox/edit controls stay read-only in coach views as today.
- [ ] **Step 4: Verify in the browser** (preview start `web-app` dev server; sign in with the test member/admin accounts in the project's seed/fixtures — never real accounts): as admin on a PT client's habits page, comment on yesterday's habit 1; as that member, see the marker and dot, open the day, reply; as admin, see the reply; in `/admin/activity` see "Replied to your habit comment". `npm run build` passes.
- [ ] **Step 5: Commit** — "feat(portal): comment threads on habit days".

### Task 4: Three-tab navigation landing on Workouts

**Files:**
- Modify: `web-app/src/components/member-nav.tsx`, `web-app/src/app/portal/layout.tsx`, `web-app/src/app/portal/page.tsx`, `web-app/src/app/portal/today/page.tsx`, `web-app/src/app/portal/workouts/page.tsx`, `web-app/src/app/portal/more/page.tsx`, `web-app/src/app/portal/habits/page.tsx`, `web-app/src/app/manifest.ts`
- Create: `web-app/src/components/member-alerts.tsx`
- Modify links to `/portal/today` in: `app/portal/communicate/page.tsx`, `app/portal/renew/page.tsx`, `app/portal/workouts/[id]/session.tsx`, `app/portal/habits/actions.ts`, `app/challenge/page.tsx`, `components/member-shared.tsx`
- Test: `web-app/tests/member-nav.test.mjs`

**Interfaces:**
- Consumes: Task 2 `unreadForMember`.
- Produces: `export function memberNavItems(opts: { canChat: boolean; habitUnread: number }): { href: string; label: "Workouts" | "Habits" | "Messages"; badge?: number }[]` in `member-nav.tsx` (pure, exported for the test); `MemberNav` props become `{ canChat: boolean; habitUnread: number }`. `MemberAlerts` (async server component, no props beyond `searchParams`-derived `challenge?: string`) renders announcements and the onboarding callouts currently on Today.

- [ ] **Step 1: Write failing test** `member-nav.test.mjs`: `memberNavItems({canChat:true,habitUnread:0})` → hrefs `["/portal/workouts","/portal/habits","/portal/communicate"]`, labels `["Workouts","Habits","Messages"]`; `{canChat:false,…}` → only Workouts and Habits; `{canChat:true,habitUnread:2}` → Habits item has `badge: 2`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement nav.** Replace `items`/`hasClasses` logic with `memberNavItems`; keep the challenge query-param passthrough and focus `router.refresh()`. Active state: Habits also active on `/portal/training/habits`. Layout computes `habitUnread` (member's weeks via enrollments + relationship → `habit_comments` → `unreadForMember`), passes `canChat`; remove `ChatNavLink` from the top bar (Messages is now a tab; keep its unread count by giving the Messages item the existing `/api/chat` unread badge — reuse `ChatNavLink`'s fetch logic, don't duplicate the endpoint). Top bar keeps "My account". `BrandLogo href="/portal/workouts"`.
- [ ] **Step 4: Landing + Today.** `/portal/page.tsx` redirects to `/portal/workouts` (admin preview cookie case unchanged). `/portal/today/page.tsx` becomes `redirect("/portal/workouts")` keeping `?challenge=`. Move announcements + PT intake/risk-agreement callouts + `GroupNextStep` + `StoryTodayCard` out of Today into `MemberAlerts`, rendered at the top of `/portal/workouts`. Point all listed `/portal/today` links at `/portal/workouts`; `manifest.ts` `start_url` → `/portal/workouts`.
- [ ] **Step 5: Habits tab shows everything.** `/portal/habits` renders `<PersonalHabits memberId commenter="member" />` inline (instead of the "Open my PT habits" link) when `d.training`; `/portal/training/habits` stays as a working page. Remove the "← Back to my class program" link's dependence on Today.
- [ ] **Step 6: My account page.** `/portal/more` list: Progress (`/portal/progress`), Class calendar (`/portal/session`, only when the member has enrollments — label "Class calendar & details"), Personal training (`/portal/training`, when PT), Renew, intake/billing links already present, contact details, sign out. Remove the Habits and Messaging entries (they are tabs now) and the word "check-ins".
- [ ] **Step 7: Run tests** `node --test tests/member-nav.test.mjs tests/member-portal.test.mjs tests/enrollment-routing.test.mjs` — PASS; `npm run build` — PASS. Browser check (test accounts): group member, PT member, free-challenge-only member each see the right tabs; `/portal/today` lands on Workouts; intake callout appears on Workouts for a member without intake.
- [ ] **Step 8: Commit** — "feat(portal): Workouts/Habits/Messages navigation".

### Task 5: Remove the Sunday survey and check-in prompts

**Files:**
- Modify: `web-app/src/app/portal/habits/class-tracker.tsx`, `web-app/src/app/portal/session/page.tsx`, `web-app/src/app/portal/training/page.tsx`, `web-app/vercel.json`, `web-app/src/app/admin/page.tsx`, `web-app/src/app/admin/reports/page.tsx`, `web-app/src/app/admin/people/page.tsx`
- Delete: `web-app/src/app/api/cron/sunday-check-in/route.ts`, `web-app/src/lib/check-in.ts`
- Test: `web-app/tests/no-check-in.test.mjs`

**Interfaces:** none produced.

- [ ] **Step 1: Write failing test** `no-check-in.test.mjs`: reads `vercel.json` and asserts no cron path contains `sunday-check-in`; walks `src/` (skipping `* 2.*`) and asserts no file contains `SIX_WEEK_CHECK_IN_URL`, `docs.google.com/forms`, `weekly-check-in`, or `id="check-in"`.
- [ ] **Step 2: Run** — Expected: FAIL listing current files.
- [ ] **Step 3: Remove member-facing pieces:** the check-in button in `class-tracker.tsx`; the `#check-in` section, its nav anchor and "Sunday reminder" note in `session/page.tsx` (also reword "Your ongoing weekly check-ins will appear below" in the onboarding callout); the `#weekly-check-in` section and its nav anchor in `training/page.tsx`; the cron entry and route; `lib/check-in.ts`.
- [ ] **Step 4: Admin side:** drop the unreviewed `check_ins` count/“Respond” card from `admin/page.tsx`, the weekly submitted/missing figures from `admin/reports/page.tsx`, and the "Check-ins waiting for a response" list in `admin/people/page.tsx`. Keep read-only display of past check-ins on `admin/members/[enrollmentId]` and in `lib/progress-story-data.ts`; keep `app/actions.ts` functions only if still referenced, otherwise delete them.
- [ ] **Step 5: Run** the test plus `node --test tests/people.test.mjs tests/people-directory.test.mjs tests/progress-story.test.mjs` — PASS; `npm run build` — PASS.
- [ ] **Step 6: Commit** — "feat(portal): remove Sunday survey and weekly check-ins".

### Task 6: Repeat a workout on a new date

**Files:**
- Modify: `web-app/src/lib/workout-library.ts`, `web-app/src/app/admin/challenges/workout-builder.tsx`, `web-app/src/app/admin/training/workouts/[relationshipId]/page.tsx`, `web-app/src/app/admin/programs/[programId]/workouts/page.tsx`
- Test: `web-app/tests/workout-library.test.mjs` (extend)

**Interfaces:**
- Produces: `repeatTemplate(workout: Workout): Template` in `lib/workout-library.ts` (copies `title, minutes, equipment, plan, exercises, level, focus, timer_config, steps` — deep-copied; `steps` defaults to `[]`). `WorkoutBuilder` gains optional prop `defaultPublished?: boolean` used for the publish checkbox when `template` is given.

- [ ] **Step 1: Write failing test:** `repeatTemplate` on a workout with `id`, `publish_on`, `published`, `revision` returns an object with none of those keys and equal `title/plan/exercises/steps/timer_config`; mutating the result's `exercises[0].label` leaves the source unchanged.
- [ ] **Step 2: Run** `node --test tests/workout-library.test.mjs` — FAIL.
- [ ] **Step 3: Implement** `repeatTemplate`; builder `defaultPublished` (checkbox `defaultChecked={workout?.published ?? defaultPublished ?? false}`).
- [ ] **Step 4: Pages.** Both workout pages accept `?repeat=<workoutId>` (validated with `isUuid`, must be a workout already loaded for this program). When present, the new-workout editor opens with `template={repeatTemplate(w)}`, `defaultPublished={w.published}`, summary "Repeat of {title} — choose a new date", and the release date empty (builder already leaves it blank for templates) so it must be chosen. Each workout's `<details>` gets a "Repeat on a new date" link to `?repeat=<id>#new-workout`. Saving uses the existing `saveWorkout` path, creating a new row.
- [ ] **Step 5: Run** test — PASS; `npm run build` — PASS. Browser: repeat a test client's workout to next week; original row and its logs unchanged; new row shows "Scheduled".
- [ ] **Step 6: Commit** — "feat(admin): repeat a workout on a new date".

### Task 7: Website menu and header

**Files:**
- Modify: `site.js` (`applySiteNavigation`), `web-app/src/lib/website-pages.ts` (`defaultNavigationKeys`), `web-app/src/lib/website-header.ts`
- Modify: the static fallback `<nav class="nav-links">`, `.nav-cta` and `.mobile-menu` markup in every root `*.html` page (skip `* 2.*`)
- Test: `tests/website-header.test.cjs` (update), `tests/site-navigation.test.cjs` (new)

**Interfaces:** none produced.

- [ ] **Step 1: Write failing tests.** `site-navigation.test.cjs`: for every root `*.html` (excluding `* 2.*`, `404.html` allowed), the nav markup links only to `coaching.html`, `personal-training.html`, `fitness-coaching.html`, `about.html` (plus `book.html`/contact and portal login in `.nav-cta`), and contains none of `resources.html`, `#the-app`, `nutrition-coaching`, `/challenge`, `portal.holden.health/register`. Load `site.js` in `vm` with a minimal DOM stub (pattern from `tests/website-draft.test.cjs`) or assert on source: `applySiteNavigation` output has no "Free 14-Day Challenge", "The App", extras/Resources group. Update `website-header.test.cjs`: `join_visible` defaults to `false`; `app_visible` defaults to `false`.
- [ ] **Step 2: Run** `npm run check:site` — FAIL.
- [ ] **Step 3: Implement.** `site.js`: Coaching group = Group Fitness (`coaching`, label default "Group Fitness"), Personal Training, Online Training — in that order; no challenge entry; About link label default "About Me"; delete the extras/Resources group and The App link; drop the `join` CTA item entirely (keep Log in and Free call; keep the PT/online "Free consultation" variant on the Free call slot if it replaced join). `website-pages.ts`: `defaultNavigationKeys = ["homepage","coaching","training","about","contact"]`. `website-header.ts`: `join_visible` and `app_visible` default `false` (editor still shows the fields). Static fallback nav in all pages matches.
- [ ] **Step 4: Run** `npm run check:site` and `cd web-app && node --test tests/*.test.mjs` — PASS.
- [ ] **Step 5: Commit** — "feat(site): Coaching + About Me menu".

### Task 8: Website pages — remove sections, generalize Group Fitness, redirects

**Files:**
- Modify: `index.html`, `coaching.html`, `fitness-coaching.html`, `personal-training.html`, `about.html`, article pages that link to Resources, `vercel.json` (root), `sitemap.xml`, `llms.txt`
- Delete: `resources.html`, `nutrition-coaching.html`
- Test: `tests/site-launch.test.cjs` (extend) or new `tests/site-simplification.test.cjs`

**Interfaces:** none produced.

- [ ] **Step 1: Write failing tests:** `index.html` has no `id="the-app"` and no `data-featured-program`; `coaching.html` has no `data-featured-program`, no `id="next-session"`, no `$` amounts, no `register?session=`, and contains the exact Group Fitness sentence from Global Constraints; no root page links to `resources.html`, `nutrition-coaching`, `#the-app`, `portal.holden.health/register`, or `portal.holden.health/start`; root `vercel.json` has permanent redirects `/resources.html`→`/`, `/resources`→`/`, `/nutrition-coaching.html`→`/coaching.html`, `/nutrition-coaching`→`/coaching.html`; `sitemap.xml` drops those two and keeps every article page; every internal `href` to a root `.html` file resolves to an existing file.
- [ ] **Step 2: Run** `npm run check:site` — FAIL.
- [ ] **Step 3: Implement.** Homepage: remove The App section and the featured session block; calls to action go to `book.html` (free call) or `coaching.html`. Group Fitness (`coaching.html`): general description of the program and 4–6 week sessions, the verbatim sentence, nutrition support mentioned as included, primary CTA "Reach out to Kelsey" → `contact.html`/`book.html`; remove featured-program blocks and session specifics. Add redirects (replace any existing redirect that points at the removed pages, e.g. `/nutrition-coaching`). Keep articles, quiz, Wednesday Reset/Note, recipes, backup plan pages; footer keeps a Wednesday Reset/Note link; re-point any article links to Resources at `/` or the most relevant coaching page. Update `llms.txt` page list. Leave `site.js` featured-program code in place (inert without hooks).
- [ ] **Step 4: Run** `npm run check:site` — PASS. Browser (static preview of repo root): homepage, Group Fitness, PT, Online, About render with the new menu on desktop and 375px mobile; no console errors.
- [ ] **Step 5: Commit** — "feat(site): remove Resources/App/Nutrition, general Group Fitness page".

### Task 9: Preview, ship, and align stored content

**Files:** none (deploy + data).

- [ ] **Step 1:** `git push -u origin portal-site-simplification`; wait for both Vercel preview deploys to be Ready (`vercel --global-config ~/.config/vercel-holden-health ls <project> --scope holden-health`).
- [ ] **Step 2:** On the previews, re-run the Task 3/4/6 browser checks with test accounts and the Task 8 page checks. Expected: all pass, no console errors.
- [ ] **Step 3:** Confirm the Task 1 migration is applied in production (`list_migrations` shows `habit_comments`).
- [ ] **Step 4:** Ask Neil to approve merging. On approval: merge to `main`, push, wait for both production deploys Ready.
- [ ] **Step 5:** Align stored website content: read `site_content` header settings and homepage/coaching content via `execute_sql`; set `join_visible=false`, `app_visible=false`, and clear any stored CTA values (e.g. `primary_cta_url`, `mini_*`) that point at `/register`, `/start`, `#the-app`, `resources.html` or `nutrition-coaching`. Show Neil the exact rows before writing.
- [ ] **Step 6:** Verify live: holden.health menu shows Coaching (Group Fitness, Personal Training, Online Training) + About Me; old URLs redirect; portal.holden.health/login → member lands on Workouts with three tabs; `curl` 200 on key pages.
