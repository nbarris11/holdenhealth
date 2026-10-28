# Holden Health personal training portal roadmap

## Product direction

Expand the existing Holden Health portal into one coaching workspace that supports both:

- **Focus on You group sessions:** enrollment, class schedule, attendance, announcements, resources, and weekly check-ins.
- **Personal training:** an individual plan, workout logging, progress, coach feedback, and private communication.

Do not build a separate personal-training app and do not copy Trainer Studio screen for screen. The current portal already has secure accounts, member intake, payments, check-ins, resources, admin records, and member preview. The right move is to add an individualized coaching layer to that foundation.

The public website currently describes personal training as an online service. Before checkout or public pricing is added, confirm whether the actual offer is online, in-person, or hybrid.

## What to borrow from Trainer Studio

The attached member screenshots and Trainer Studio's public feature list point to five useful ideas:

1. A calendar-led home screen with the next workout and recent completion.
2. A clear weekly training plan with exercise instructions and video.
3. Simple progress tracking, including optional photos and measurements.
4. One private place for member-to-trainer communication.
5. An admin program builder that can reuse exercises, workouts, and complete weeks.

## How Holden Health should be better

Trainer Studio is a broad software product for many trainers. Holden Health can feel more useful by being narrower and more personal:

- Show the member's single best next action instead of a large empty dashboard.
- Support group sessions and personal training in the same account.
- Keep Kelsey's weekly check-in, response, workout history, and plan changes together.
- Let Kelsey assign a shorter backup workout for a busy or low-energy day.
- Explain why a workout changed, not just that it changed.
- Use supportive language and avoid shame-based streaks or red warning states.
- Keep nutrition lightweight at first: habits, resources, notes, and check-ins rather than calorie and macro tracking.
- Make the web experience excellent on a phone before considering native apps.

## Member experience

Use five simple destinations on desktop and mobile: **Today, Plan, Progress, Messages, Account**.

### Today

- Personal greeting and current coaching service.
- The next workout or next group class, depending on the member's service.
- One primary action: start workout, complete check-in, or confirm attendance.
- Latest note from Kelsey.
- This week's completion summary.
- A useful empty state that tells the member what happens next.

### Plan

- Week-by-week calendar combining assigned workouts and group classes.
- Workout detail with exercise, sets, reps or time, rest, coaching cues, and demonstration media.
- Target effort using plain language with an optional RPE scale.
- Exercise substitutions and a shorter backup version where Kelsey assigns one.
- Logging for weight or resistance, repetitions, effort, completion, and a private note.
- Read-only history after a workout is completed, with an explicit edit option.

### Progress

- Workout completion over the last 30 and 90 days.
- Personal bests and recent exercise history where load tracking applies.
- Weekly check-in history and Kelsey's responses.
- Optional member-selected measurements.
- Optional private progress photos displayed by date with side-by-side comparison.
- No public leaderboards and no comparison with other members.

### Messages

- One private conversation between the member and Kelsey.
- Text plus approved image, short video, and document attachments.
- A workout or check-in can be referenced inside a message so context is not lost.
- Email notification for a new message; the full private message stays inside the portal.
- Version one can refresh normally. Real-time presence, typing indicators, and read receipts are not required.

### Account

- Profile and contact details.
- Coaching service and account status.
- Notification preferences.
- Billing link when online personal-training payments are enabled.
- Privacy controls for photos and measurements.
- Sign out and account-support options.

## Admin experience

Keep the current left-side workspace and expand it to: **Today, People, Programs, Schedule, Messages, Reports, Content, Settings**.

### Today

- Check-ins awaiting a response.
- Workouts with a question or pain flag.
- Unread member messages.
- Personal-training plans that are ending soon or need a new week assigned.
- Registration, intake, and payment tasks already shown today.

### People

- Filter by group member, personal-training client, hybrid client, lead, or past client.
- Member record tabs: Overview, Plan, Progress, Check-ins, Messages, and Files.
- Keep intake, payment, enrollment status, and member-preview controls already built.
- Add a concise coaching snapshot: goal, equipment, limitations, current block, last workout, and next review date.

### Programs

- Exercise library with movement category, equipment, instructions, coaching cues, and media.
- Reusable workout templates.
- Multi-week program templates.
- Copy a workout or complete week.
- Assign a template to one member, then make member-specific changes without altering the original.
- Schedule, publish, revise, pause, and archive assignments.
- Maintain a change history so Kelsey can see what was changed and when.

### Messages

- Inbox ordered by messages needing a response.
- Member name, service, message preview, and last activity.
- Open the member record alongside the conversation.
- Use saved replies only for logistics; coaching responses should remain personal.

### Reports

- Active clients by service.
- Workout adherence and check-in completion.
- Members who may need outreach.
- Program completion and client retention.
- Avoid complicated business intelligence until Kelsey has enough personal-training clients to use it.

## Recommended data additions

Keep the current `profiles`, `sessions`, `enrollments`, `member_intakes`, `check_ins`, `resources`, payment, and communication tables. Add the following in additive migrations:

- `coaching_relationships`: member, coach, service type, start/end dates, status, and review date.
- `exercises`: instructions, cues, equipment, media path, and ownership.
- `workout_templates` and `workout_template_items`: reusable workout definitions.
- `program_templates`, `program_weeks`, and `program_days`: reusable program structure.
- `member_programs` and `scheduled_workouts`: the published plan for one member.
- `workout_logs` and `exercise_logs`: completion, load, reps, effort, and member notes.
- `progress_metrics` and `progress_entries`: opt-in measurements and trends.
- `progress_photos`: private storage path, capture date, pose label, and member ownership.
- `conversations`, `conversation_participants`, `messages`, and `message_attachments`: private coaching communication.
- `coach_notes`: admin-only notes that are never exposed to a member.

Group-session enrollments and personal-training relationships should remain separate concepts. A person may have either or both.

## Privacy and security requirements

- Row Level Security on every new member-facing table.
- A member may only access their own plan, logs, progress, photos, and conversations.
- Admin access must be checked on the server and in database policies.
- Progress photos, form-check videos, and message attachments must use private Supabase Storage buckets and short-lived signed URLs.
- Do not place health details or complete private messages in email notifications.
- Validate file type and size, remove unsafe filenames, and set a retention policy.
- Keep internal coach notes in a separate table with no member policy.
- Require administrator MFA before real personal-training data is stored.
- Collect only information Kelsey uses for coaching; avoid medical records and diagnostic language.

## Build sequence

### Phase 0: define the offer and prototype (about 1 week)

- Confirm online, in-person, or hybrid delivery.
- Confirm pricing, billing frequency, cancellation rules, coach response expectations, and client capacity.
- Collect one real four-week program, workout, exercise list, weekly adjustment, and client progress example.
- Approve clickable member and admin wireframes before database work.

### Phase 1: personal-training foundation (about 1-2 weeks)

- Add coaching relationships and service types.
- Update onboarding so a member can belong to a group session, personal training, or both.
- Add service filters and personal-training status to the admin People area.
- Change the member Today screen based on the member's active service.

### Phase 2: plans and workout logging (about 2-3 weeks)

- Build exercises, workouts, program templates, assignments, and scheduling.
- Build the member Plan calendar, workout detail, logging, and completion flow.
- Build admin copy-week, member override, publish, and change-history flows.

Gate: Kelsey can assign a real four-week plan to a pilot member, and the member can complete and log it from a phone without developer help.

### Phase 3: progress and coaching review (about 1-2 weeks)

- Add adherence, exercise history, personal bests, optional measurements, and private progress photos.
- Surface useful progress in the admin member record.
- Connect workout issues and weekly check-ins to Kelsey's Today queue.

### Phase 4: portal messaging (about 1-2 weeks)

- Add the member conversation, admin inbox, attachments, and email notifications.
- Link messages to workouts or check-ins when useful.
- Test file privacy, notification privacy, and response workflows.

### Phase 5: pilot and launch (about 2 weeks)

- Run the complete flow with 3-5 personal-training clients.
- Test mobile use, weak connections, permissions, photo privacy, account recovery, and program revisions.
- Measure whether the portal reduces Kelsey's administrative time before adding more features.

A focused first release is roughly **7-10 weeks** for one experienced full-time engineer, assuming quick content and workflow decisions. The existing portal foundation saves time, but the program builder and private media still require careful product and security work.

## Leave for later

- Native iPhone and Android apps.
- Wearable and Apple Health integrations.
- Live video calls.
- Food database, calorie targets, and automated macro plans.
- AI-generated programs or nutrition prescriptions.
- Community feeds, challenges, and leaderboards.
- Real-time presence and typing indicators.

## Decisions needed before implementation

1. Is personal training online, in person, or hybrid?
2. Is it sold monthly, in fixed-length blocks, or session by session?
3. How many personal-training clients will Kelsey coach at once?
4. Does every client receive individualized workouts, or will some receive check-ins only?
5. Which member inputs are required: loads, reps, effort, pain, measurements, photos, or only completion?
6. Does Kelsey have exercise demonstration videos she owns and is ready to upload?
7. Should members upload form-check videos in Messages or directly on a workout?
8. What response time should the public site promise for member messages?
9. Does nutrition support mean habits and feedback, or individualized meal/macronutrient planning?
10. What is the retention rule for progress photos and message attachments after coaching ends?

## Recommended first milestone

Build **Today + Plan + workout logging** for one pilot personal-training client, and the matching **People + Programs + assignment** admin flow. Keep existing group-session features working. Add progress photos and messaging only after that full coaching loop is comfortable for Kelsey and the pilot client.
