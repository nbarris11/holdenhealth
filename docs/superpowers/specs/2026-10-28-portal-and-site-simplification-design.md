# Portal and website simplification — design

Date: 2026-10-28 · Requested by Kelsey Holden (via Neil Barris)

## Why

Members (group fitness, personal training and online clients alike) told Kelsey the portal is hard to navigate. Kelsey wants members to land on three things: their workouts, their habits, and messages with her. Separately, the public website has grown more sections than Kelsey wants to maintain, and visitors get lost. Kelsey wants less to keep up to date and fewer places for people to wander.

Success: a member opens the portal and sees three tabs; Kelsey can react to habit check-offs and repeat a PT workout without retyping it; the website menu is Coaching (three pages) and About Me, and Kelsey never has to edit the website when a new group session starts.

Anti-goals: breaking anything currently live (Neil's explicit condition); losing member data (habit history, workout logs, intake, payments); dropping blog articles from Google.

## Where the code is

Live code: `~/Desktop/holden-health-site`, GitHub `nbarris11/holdenhealth`. Pushing to `main` deploys both Vercel projects to production (`holdenhealth` = static site at repo root; `holdenhealth-portal` = Next.js app in `web-app/`). Work on a branch; the branch push gives preview deploys for checking.

## Part 1 — Member portal

### 1a. Navigation: Workouts, Habits, Messages

- Bottom menu (`web-app/src/components/member-nav.tsx`) becomes three tabs for every member: **Workouts** (`/portal/workouts`), **Habits** (`/portal/habits`), **Messages** (`/portal/communicate`).
- A **"My account"** link at the top (the existing `MemberAccountLink`) leads to the current More page, which holds everything else: Progress, class calendar / session page, personal training page, intake, billing, renew, contact details, sign out.
- The extra "Classes" tab some group members get today is removed; the session page stays reachable from My account.
- `/portal` and post-login land on **Workouts** instead of `/portal/today` (Kelsey asked what it is today; our call, since workouts are the most-used thing). The admin "member preview" redirect to `/portal/session` stays as is.
- `/portal/today` is retired as a destination: redirect it to `/portal/workouts`. Anything on Today that a member must act on (onboarding callouts: complete intake, sign Assumption of Risk, "ready for your next group session") moves to the top of the Workouts page so it isn't lost.
- Habits tab must work for both group members (class habits) and PT/online clients (personal habits, today at `/portal/training/habits`). One tab; it shows whichever applies, or both if a member has both.
- Messages tab: today chat is gated by `chat_has_access`. Show the tab to anyone with access; builder decides the fallback for members without access (hide the tab, or show a short "message Kelsey" page) — keep it simple.

### 1b. Remove the Sunday survey and weekly check-in

Remove everywhere members see it, and stop the email:
- "Complete Kelsey's weekly check-in" button in `app/portal/habits/class-tracker.tsx`.
- Check-in section and nav anchor on `app/portal/session/page.tsx` (including the "Sunday reminder" note).
- "Weekly check-in" / "Plan your week with Kelsey" section and nav anchor on `app/portal/training/page.tsx` (Kelsey doesn't use it; she texts PT clients).
- Sunday cron: remove the `sunday-check-in` entry from `web-app/vercel.json` and its route `app/api/cron/sunday-check-in/`.
- `lib/check-in.ts` and the reference in `app/admin/people/page.tsx` — remove once unused.
- "check-ins" wording on the More page copy.
- Admin side (our call): anything that counts or chases check-ins — the dashboard "check-ins → Respond" count, Reports "Week N check-ins submitted/missing", People "Check-ins waiting for a response" — is removed or hidden so Kelsey isn't shown everyone as "missing." Past check-ins already saved stay visible read-only on member pages and in progress stories; the `check_ins` table and its data are kept.

### 1c. Habit comments (new)

Kelsey wants to comment on a **specific day of a specific habit**, and members can **reply**.

- Each comment thread is attached to one habit on one day of one habit-week (`class_habit_weeks` row + day + habit index). Applies to both group class habits and PT habits (both use `class_habit_weeks`; PT ones carry a relationship).
- Store the habit's text with the thread, because members can edit a week's habits and indexes can shift.
- Kelsey (staff/admin) can start a thread or reply; the member who owns the habit-week can reply. No one else can read them (RLS, matching existing habit table policies).
- Member side (Habits tab): a day/habit with a comment shows a small marker; tapping opens the thread with a reply box. The Habits tab shows an unread dot when Kelsey has left something new.
- Kelsey side: on the admin habit views (`admin/training/[memberId]/habits` and the program habits page `admin/programs/[programId]/habits`), each day/habit has a "comment" action and shows existing threads. Member replies should surface where Kelsey already looks for new activity (the coach activity feed / admin dashboard).
- Not in scope: email or push notifications for habit comments.

### 1d. Repeat a workout on a new date (PT)

- On Kelsey's PT workout page (`admin/training/workouts/[relationshipId]`), each workout gets **"Repeat on a new date"**: pick a date, it creates a copy (all exercises, timers, notes) with that `publish_on` date, published/scheduled the same way as the original. The original stays untouched, so the member's history and logs for it are preserved.
- Builder's call: if the group program workout editor shares the same component, offering the button there too is fine.

## Part 2 — Website

### 2a. Menu: Coaching and About Me only

Top menu becomes:
- **Coaching** ▸ Group Fitness (`coaching.html`), Personal Training (`personal-training.html`), Online Training (`fitness-coaching.html`)
- **About Me** (`about.html`)

Plus the existing free-call/contact button and member login. Removed from the menu: Free 14-Day Challenge, Resources, The App, the "extras" dropdown `site.js` builds, and the **"Join group classes" header button** (it goes straight to `/register`, which contradicts sign-up-by-link; our call). Header buttons can also be overridden by stored CMS header settings, so change both.

Note: the menu is partly driven by the portal's website content service (`/api/site-content?navigation=1`, edited in the admin Website editor; `site.js` builds the menu from it and falls back to the HTML links). Change both the stored navigation/page visibility and the fallback HTML in every page so they agree. The `personal-training` auto-append in `site.js` must keep working.

### 2b. Remove sections and pages

- **The App**: remove the `#the-app` section from the homepage and any links to it.
- **Resources page** (`resources.html`): remove from menu and footer; redirect `/resources.html` to the homepage (or Coaching).
- **Nutrition Coaching page**: remove; redirect `/nutrition-coaching(.html)` to `coaching.html`. Nutrition stays mentioned as part of Group Fitness and PT copy.
- **Free 14-Day Challenge**: remove links from the website. The portal's `/challenge` route stays in place (unlinked) unless the builder finds it's trivial and safe to retire; don't break existing participants.
- **Blog articles stay online** (Kelsey: keep them if they help Google): keep the article pages and their sitemap entries, just no menu link. Articles that link to Resources should link somewhere that still exists.
- **Other content pages** — quiz, Wednesday Reset, Wednesday Note, recipes, backup plan, and any custom pages Kelsey made in the editor (our call, same reasoning as the articles): stay online and in the sitemap with no menu link. The footer keeps a Wednesday Reset / Wednesday Note link since it's the email sign-up. Nothing gets deleted or redirected.
- Update `sitemap.xml`, `llms.txt`, internal links and the root `vercel.json` redirects to match. No 404s from old links.

### 2c. Group Fitness page: general wording, sign-up by link

- Replace specific current-session details and the direct "register for this session" links (e.g. `register?session=...`, `#next-session`) with general wording, along the lines of: "4–6 week sessions offered throughout the year. Reach out today to find out which session is currently running!"
- Remove the automatic "featured program" blocks (`[data-featured-program]` on `coaching.html` — `#next-session` and the mini-alert — and the session block on `index.html`), which inject current session dates, prices and a `register?session=` link (our call). Leave the `site.js` / `/api/site-content` / editor mechanism in place but unused; it does nothing without the HTML hooks. Also clear any stored `data-site-content` / `data-site-link` values (e.g. `primary_cta_url` → `/register`) that would re-point calls to action at sign-up.
- Primary call to action is to contact / book a call with Kelsey. Once someone wants to join, Kelsey sends them the portal's per-session sign-up link (`/register?session=<id>`), which shows the rate and takes payment. Rates live on the session in the portal, never on the website.
- Same idea for homepage calls to action that send visitors straight into the portal sign-up (`/start?goal=...`, `/register`): point them to contacting Kelsey instead. Builder's call whether the `/start` quiz flow stays reachable at all.
- Personal Training and Online Training pages: keep content; just make sure they fit the new menu and don't link to removed pages.

## Constraints

- Don't break live pages or member data. Use preview deploys on a branch to check before merging to `main`.
- Database changes go in new Supabase migrations in `supabase/migrations/`, following existing RLS patterns.
- Previews read the **live** database and live website content (there's one Supabase project; `site.js` always calls `portal.holden.health`). So: the habit-comments migration must be purely additive (new tables/policies only) and is applied to production before the code that uses it ships; changes to stored navigation, page visibility, header settings and CTA content in `site_content` are made at merge time, right after the HTML ships, not before. The builder applies both, after telling Neil (our call).
- Keep visual style consistent with what's there.
- Ignore the Finder/iCloud " 2" duplicate files; don't edit them.

## Left to the builder

Exact UI for comment markers and threads; data model details for habit comments; how unread state is tracked (reuse existing unread patterns if any); copy wording beyond what's quoted above; order of work.
