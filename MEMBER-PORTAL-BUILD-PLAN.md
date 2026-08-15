# Holden Health member and admin portal plan

> **Revised direction - August 15, 2026:** Discovery confirmed that Kelsey's current business is based on six-week group sessions, not ongoing individualized online personal training. The full portal below is a future roadmap. The correct first product is the smaller **6-Week Session Hub** defined in `SIX-WEEK-SESSION-HUB-PLAN.md`. Do not begin the full workout-programming system until Kelsey is actively delivering individualized programs and has a real workflow to model.

## Recommendation

Build a custom web application in phases, but do not try to recreate every feature in Trainerize, TrueCoach, or a native fitness app in version one.

Keep the current public website online while the new application is built and tested. The finished system should use one codebase with three clearly separated areas:

- Public website: marketing pages, resources, Wednesday Reset, SEO content.
- Member portal: paid plan, assigned workouts, check-ins, progress, resources, and billing access.
- Admin portal: members, programs, assignments, content, media, and account status.

The recommended technical foundation is Next.js on Netlify, Supabase for authentication/database/file storage, and Stripe for subscriptions.

## Why this approach

The current site is plain HTML, CSS, and JavaScript. It has no database, user accounts, server-side authorization, or payment lifecycle. Adding private member information directly to the current files would be fragile and unsafe.

A Next.js application lets us preserve the visual design while adding protected server functionality. Netlify supports the current Next.js App Router. Supabase provides authentication, Postgres, storage, and row-level access policies. Stripe handles card data, recurring billing, invoices, and the customer billing portal.

Kelsey should get a structured content editor, not a free-form page builder. She can safely change approved fields such as headlines, descriptions, prices, calls to action, photos, resource content, and coach biographies without accidentally breaking layouts or SEO.

## Product roles

### Visitor

- Browse the public site.
- Complete the Wednesday Reset and program quiz.
- Request a consultation.
- Purchase or request a coaching plan.
- Sign in after receiving an invitation or completing payment.

### Member

- Sign in with email magic link or password.
- See current coaching plan and subscription status.
- See today's task and the current week's schedule.
- Open assigned workouts with exercises, sets, reps, rest, notes, and demonstration media.
- Record completion, weight or resistance, repetitions, effort, and private notes.
- Complete weekly check-ins and assigned habits.
- Review recent progress and Kelsey's feedback.
- Open assigned guides and resources.
- Update account details and open Stripe's hosted billing portal.

### Kelsey / administrator

- Invite, activate, pause, or archive members.
- See each member's plan, activity, check-ins, and subscription status.
- Create reusable program and workout templates.
- Copy a week, adjust an exercise, and assign a program to one or more members.
- Add exercise instructions, coaching cues, and video links.
- Review workout logs and respond to weekly check-ins.
- Assign habits and resources.
- Edit selected website text and images through structured forms.
- Preview website changes before publishing.
- See a history of important administrative changes.

## Version-one scope

### Include

1. Authentication and roles
   - Invite-only member creation at first.
   - Member and administrator roles.
   - Password reset and email verification.
   - Mandatory multi-factor authentication for Kelsey's admin account.

2. Member dashboard
   - Welcome, current plan, subscription status, next workout, current habit, latest coach note, and check-in due date.
   - Responsive web experience that can be saved to a phone's home screen.

3. Workout delivery
   - Exercise library.
   - Reusable workout templates.
   - Multi-week programs.
   - Member-specific assignments and overrides.
   - Completion, load, repetitions, effort, and notes.

4. Check-ins and habits
   - Configurable weekly check-in questions.
   - Simple habit assignments and daily completion.
   - Coach review status and feedback.

5. Billing
   - Stripe Checkout for new subscriptions.
   - Webhooks that synchronize active, past-due, paused, and cancelled status.
   - Stripe Customer Portal for invoices, payment methods, and cancellation.
   - Access rules based on the synchronized subscription record, not on a browser redirect.

6. Website content management
   - Structured page sections stored in the database.
   - Media library for public images.
   - Draft, preview, and publish states.
   - SEO title, description, social image, and canonical controls.
   - Revalidation after publishing so public pages update without a manual deploy.

7. Operational basics
   - Transactional email for invitations, password recovery, and check-in reminders.
   - Error monitoring, database backups, audit events, and basic product analytics.

### Do not include in version one

- Native iPhone or Android apps.
- Apple Health, Garmin, Fitbit, or wearable integrations.
- Real-time chat or video calls.
- Calorie, macro, or meal-database tracking.
- Public community feeds, challenges, or leaderboards.
- AI-generated workout or nutrition prescriptions.
- A free-form drag-and-drop website builder.
- Medical records, diagnosis, or therapeutic nutrition workflows.
- Household or family accounts.

These can be reconsidered after real members use the portal and Kelsey can identify where it saves or costs her time.

## Recommended architecture

### Application

- Next.js App Router with TypeScript.
- Existing Holden Health design migrated into reusable components.
- Public routes for marketing; protected `/member` and `/admin` routes.
- A server-only data access layer that performs authorization for every sensitive read and write.

### Backend

- Supabase Auth for member sessions.
- Supabase Postgres for application data.
- Supabase Storage with separate public and private buckets.
- Row Level Security on every member-facing table and private storage object.
- Background or server functions for Stripe webhooks, email, and scheduled reminders.

### Payments

- Stripe Checkout and recurring subscriptions.
- Stripe Customer Portal instead of building custom card and invoice screens.
- Verified, idempotent webhooks as the source of truth for subscription status.
- No card numbers stored by Holden Health.

### Hosting

- Continue using Netlify.
- Keep the current static production deployment until the replacement passes launch review.
- Use a private preview URL and a separate staging database during development.

## Core data model

- `profiles`: member identity and basic preferences.
- `staff_roles`: administrative permissions; never editable by members.
- `coaching_products`: fitness, nutrition, combined, and future offerings.
- `subscriptions`: Stripe customer, product, subscription, and lifecycle status.
- `exercises`: name, instructions, cues, equipment, media, and movement category.
- `workout_templates` and `workout_template_items`: reusable workout definitions.
- `program_templates`, `program_weeks`, and `program_days`: reusable multi-week plans.
- `member_assignments`: a program assigned to a member with dates and overrides.
- `workout_sessions` and `exercise_logs`: actual member performance and notes.
- `habit_templates`, `habit_assignments`, and `habit_logs`: habit coaching.
- `check_in_templates`, `check_ins`, and `coach_feedback`: weekly coaching loop.
- `resources` and `member_resources`: guides and private files.
- `site_content`, `site_media`, and `content_versions`: editable public-site content.
- `audit_events`: important staff, billing, access, and publishing changes.

## Security rules

- A member can only read or update rows connected to their own user ID.
- A member cannot change their role, subscription status, assignment ownership, or coach feedback.
- Kelsey can access client records only through authenticated administrator actions.
- Admin authorization is checked on the server and in database policies; hiding a button is never treated as security.
- Private files use short-lived signed links and are never stored in public buckets.
- Stripe and Supabase secret keys exist only in server environment variables.
- Stripe webhook signatures are verified and repeated events are safe to process.
- Admin MFA is required before production launch.
- Database backups, recovery testing, rate limiting, input validation, and an access audit are launch requirements.
- Collect only the health information Kelsey truly needs. Avoid medical diagnoses and highly sensitive clinical data in version one.

HIPAA applicability depends on how Holden Health operates and who it works for; it should not be guessed from the fact that the product is fitness-related. If the portal will store protected health information or operate for a covered healthcare provider, obtain legal guidance before launch and use vendors/configurations that support the required agreements and controls.

## Build phases

### Phase 0 - workflow and product definition (about 1 week)

- Shadow how Kelsey currently onboards, bills, programs, checks in, and adjusts clients.
- Collect examples of a real plan, workout, check-in, habit, and coach response.
- Confirm the exact paid products and billing rules.
- Define the smallest useful member dashboard.
- Decide which public-site fields Kelsey actually needs to edit.
- Produce wireframes and acceptance criteria before writing backend code.

### Phase 1 - technical foundation and site migration (about 2 weeks)

- Create the Next.js application and reusable design system.
- Migrate the public site without changing URLs, metadata, redirects, or visual identity.
- Create staging and production environments.
- Add authentication, profiles, roles, server authorization, and database migrations.
- Add basic structured content editing and image storage.

Gate: public pages match the current site, SEO URLs are preserved, and unauthorized users cannot reach protected data.

### Phase 2 - coaching MVP (about 3-4 weeks)

- Build exercise library, workout templates, programs, and assignments.
- Build the member weekly view and workout logger.
- Build admin member detail, template creation, copy-week, and assignment flows.
- Add check-ins, habits, and coach feedback.

Gate: Kelsey can assign a real four-week program to a test member, and the member can complete it without developer assistance.

### Phase 3 - payments and onboarding (about 1-2 weeks)

- Configure Stripe products and test-mode prices.
- Add Checkout, Customer Portal, and verified webhook handling.
- Build invite, first-login, account recovery, subscription-state, and offboarding flows.
- Add transactional email.

Gate: test subscriptions correctly grant, restrict, pause, and restore access across every Stripe lifecycle tested.

### Phase 4 - content admin and operations (about 1-2 weeks)

- Finish structured editors for homepage, About, coaching, resources, prices, and SEO fields.
- Add draft preview, publish, version history, and image replacement.
- Add audit events, error monitoring, backups, analytics, and administrator documentation.

Gate: Kelsey can safely update a headline and image, preview them, publish them, and restore the prior version.

### Phase 5 - pilot and launch (about 2 weeks)

- Run the complete experience with Kelsey and 3-5 friendly pilot members.
- Test phones, tablets, desktops, weak connections, email delivery, password recovery, accessibility, billing failures, and permission boundaries.
- Fix onboarding and admin friction found during the pilot.
- Perform a security review and recovery drill.
- Move production traffic only after a rollback plan is ready.

## Realistic schedule

A focused MVP is roughly a 9-12 week build for one experienced full-time product engineer, assuming Kelsey can give fast feedback and provide real program content. A polished first release with substantial iteration is more realistically 12-16 weeks.

Native apps, wearables, advanced messaging, food databases, and complex automation would be separate later projects. Attempting all of them in the first release would likely double or triple the schedule.

## Decisions needed before implementation

1. Does Kelsey currently use Trainerize, TrueCoach, Everfit, or another coaching app? What works and what frustrates her?
2. Are accounts invite-only after a consultation, automatically created after payment, or both?
3. Are the current `$199 / $199 / $299` prices and quarterly discounts final?
4. What happens when payment is past due: immediate lockout, grace period, or view-only access?
5. What does Kelsey currently send each client every week?
6. Which member inputs are required: workout numbers, body measurements, photos, sleep, pain, nutrition, or only check-ins?
7. Does Kelsey own exercise demonstration videos, or should version one use written instructions and approved external links?
8. Which exact website fields should be editable, and which should remain developer-controlled for layout and safety?
9. Will anyone besides Kelsey need an admin or assistant role?

## Strong launch recommendation

Start with invite-only accounts and 3-5 existing clients. Do not publicly sell access until Kelsey has used the admin workflow for at least two complete coaching weeks. The portal succeeds only if it saves Kelsey time while making clients feel more supported; a larger feature list does not prove either outcome.
