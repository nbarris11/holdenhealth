# Member portal audit — September 11, 2026

**Follow-up:** Fixes were implemented and deployed later the same day. See the [release record](member-portal-release-2026-09-11.md) for what shipped, verification limits, and outstanding Kelsey inputs. The original findings below remain as dated audit evidence.

## Assessment

The daily workout and habit experience is usable and encouraging. The weaker part is the journey around it: understanding enrollment, completing intake, finding classes, knowing what is due, and getting help. I recommend fixing the onboarding, mobile intake, calendar/Zoom, and intake validation issues before treating the portal as launch-ready.

This is an audit, not a release. No application code, production configuration, program data, health answers, payments, attendance selections, or real member progress was changed. One clearly labeled partial workout was saved in the browser-only demo. Sign-out and an authorized sign-in email request were tested separately from the user's Chrome member session.

## Coverage and evidence

Evidence labels below distinguish **Live** browser observations, **Data** read-only production queries, and **Code** inspected implementation. Code findings describe reachable behavior, not a claim that every state was reproduced with a live account.

| Area | Coverage |
| --- | --- |
| Today | Live challenge member and enrolled group member; active and upcoming challenge states; underlying data selection reviewed |
| Workouts | Live library, short-workout filter, challenge switching; workout availability and save implementation reviewed |
| Workout player | Shared real player exercised in public demo: resume, next movement, optional rest, pause, reload recovery, continue, finish early, partial save, progress destination |
| Habits | Live future-day disabled state, active challenge rendering; saving, rollback messaging, and eligible-day implementation reviewed |
| Progress | Live totals, empty history, goal/win forms, challenge switch; aggregation and story forms reviewed |
| More/account | Live challenge-only and group-enrolled navigation; support address and sign-out reviewed |
| Classes & membership | Live enrolled test member's December session, intake-needed/payment-pending state, calendar, expanded event, resources, policies, weekly check-in; October/November class setup checked in data |
| Intake | Full live form read; 390px layout measured; server validation and post-submit states inspected; no health declaration/signature submitted |
| Personal training | Live no-plan state; assigned-plan, completion, paused relationship, reset, feedback, and metrics reviewed in code |
| Weekly check-in | Linked Google Form opened and all questions reviewed; not submitted |
| Login | Sign-out and protected-route redirect exercised; fresh email delivered to approved test address and its link successfully opened Today; see final verification note |
| Mobile | Real Progress and demo Progress at 320 CSS px; Habits at 468px; enrolled calendar and intake at 390px; screenshots reviewed and document width measured |

Existing TEST program titles, announcements, and test member records are deliberate retained fixtures. They are not counted as customer-content leaks. Chrome and the in-app browser had different existing test accounts; their different names and history are not evidence of cross-account leakage.

## Fix before launch

### 1. Required onboarding is missing from Today

**High · Live + Code**

The group member's Today screen promotes a challenge workout and progress goal, but does not mention the incomplete intake, payment state, group session name/start date, or next class. The intake prompt is only on Classes & membership. The class link is below the other dashboard cards, under From Kelsey, or behind More.

A person who paid for classes can reasonably assume the prominent workout is their required next step and miss onboarding entirely.

**Recommendation:** Put a compact, personalized next-step card near the top of Today: complete intake, review pending, payment arrangement, then next class once ready. Give group members a prominent Classes destination. Keep the challenge experience for challenge-only members.

Evidence: `web-app/src/app/portal/today/page.tsx`, `more/page.tsx`, `session/page.tsx:114`, `web-app/src/lib/member-data.ts`.

### 2. Intake overflows a phone screen

**High · Live + Code**

At 390 CSS px, the intake document measures **667px wide**. Its invisible rating radio inputs inherit a 100% width while absolutely positioned. Several extend beyond the viewport even though the visible rating labels fit. This creates horizontal scrolling during a long form.

**Recommendation:** Contain the hidden radio inputs within their labels using an appropriate visually hidden technique; preserve keyboard focus and the existing visible selected/focus styles. Recheck all four rating groups at 320/390px and on a physical phone.

Evidence: `web-app/src/app/globals.css:156`, `:415`, `:416`. Live DOM showed `fitnessRating` inputs with `position:absolute`, `opacity:0`, width 390px and right edges up to 667.4px.

### 3. Intake validation can discard a long form

**High · Code; form structure confirmed live**

Required checkbox groups do not identify that at least one selection is required in browser validation. “Other” explanations and Yes health explanations are required by the server but are not conditionally required in the form. Failure redirects to a fresh `/portal/intake?error=...` page, without carrying the entered answers forward or identifying the exact field.

A member could complete the seven sections, miss one conditional answer, and have to start over. There is also no save-and-return feature.

**Recommendation:** Preserve answers through validation errors, show errors beside the relevant questions, label required groups, and validate conditional explanations before submission. Use secure server-side drafts if adding save-and-return; do not put health drafts in ordinary browser local storage.

Evidence: `web-app/src/app/portal/intake/page.tsx`, `actions.ts` (`intakeError`, selected-group checks, health-detail and Other validation).

### 4. Class and Zoom access disappears once class starts

**High · Code**

The calendar only renders meetings whose start time is greater than or equal to the current time. Zoom links are fetched only for those upcoming meetings. On a fresh load after 9:00, a member joining a 9:00 Zoom class a few minutes late loses that class and its join button.

Canceled classes are also removed entirely, without a canceled label or replacement workout on the calendar. That can leave members wondering where their booking went.

**Recommendation:** Keep ongoing classes visible through their end time, with a short grace period if appropriate. Show canceled classes with a clear explanation and the emergency at-home workout. Separate registration cutoffs from access to details and already-booked Zoom links.

Evidence: `web-app/src/app/portal/session/page.tsx:96–98`; attendance action in `web-app/src/app/actions.ts:124`.

### 5. November 7 at 9 AM has no Zoom link

**High before that class · Data + Code**

Production has two November 7 Zoom classes. The 7:30 AM meeting has a link on a Zoom domain; the **9 AM meeting has no link**. This does not establish whether the 7:30 link is the final intended meeting.

The UI has no useful “link coming soon” explanation for a signed-up member without a link. If a link is added after someone signed up, the current attendance action does not automatically notify all existing registrants; its email runs when a new selection is created with a link already present.

**Recommendation:** Populate the intended links, show a clear pending state, and ensure existing registrants receive the link when it becomes available. Verify both Saturday times before November 7.

Evidence: read-only join of `class_meetings` and `class_zoom_meetings`; `session/page.tsx`; `actions.ts:141–152`. Private meeting URLs are deliberately not copied into this report.

### 6. Future sessions already say Week 1 and Due Sunday

**Medium · Live + Code**

On September 11, the enrolled December test member sees “Your current session · Week 1,” “Week 1 check-in,” “Due Sunday,” and an enabled weekly check-in link. The program actually begins December 1. The same code applies to an October enrollment. Finished sessions are similarly clamped to their final week instead of receiving a finished state.

**Recommendation:** Use “Starts December 1” before a session, current week only during its dates, and a completed-session state afterward. Show the first actual check-in due date. The Sunday email job already checks session dates; bring the page into agreement.

Evidence: `session/page.tsx:40`, check-in section; `web-app/src/app/api/cron/sunday-check-in/route.ts`.

### 7. Enrollment and readiness messages conflict

**Medium · Live + Code**

The existing enrolled test account simultaneously shows “Complete your intake…before activating your enrollment,” “Payment pending,” “You’re enrolled,” “Your place is confirmed,” and class selection controls. The test record is already active; this is not proof that new signups universally bypass review. It does demonstrate that the UI cannot clearly communicate this state.

**Recommendation:** Distinguish **place reserved**, **payment pending/recorded**, **intake needed/under review**, and **ready to participate**. Reserving with cash or Venmo is already an approved business rule and should not be blocked by new wording. Verify activation gates independently using a new disposable enrollment before the next release.

## Navigation, content, and coaching improvements

### 8. Progress challenge picker goes to the wrong page

**Medium · Live + Code**

On Progress, selecting The 21-day habit challenge takes the member to Today. The picker defaults to `/portal/today`; Progress does not supply its own destination. Confirmed by clicking it.

**Fix:** Preserve `/portal/progress` when changing challenge. Clarify that workout history is across challenges while the habits total is for the selected challenge.

Evidence: `web-app/src/app/portal/progress/page.tsx:28`, `web-app/src/components/member-shared.tsx`.

### 9. Policies and arrival instructions are incomplete inside the portal

**Medium · Live + Code + Data**

- Membership still says “Drop-in classes are booked separately,” contrary to the confirmed no-drop-ins policy.
- The attendance section omits telling Kelsey about makeups/Saturday changes, cancellation refunds before the start, and emergency at-home substitutions.
- Venue address is present, but the clock/entrance/hallway instructions supplied by Kelsey are absent from the member page and current class notes.
- Payment pending gives no practical next step for Venmo/cash/check, agreed amount, or payment deadline.

**Fix:** Bring the already-approved information into Classes & membership and link to the complete policies. Use “Cancel this class booking” instead of “Cancel my spot” to distinguish a single class selection from withdrawing from the entire program. Clarify whether saving/canceling a class in the portal itself counts as communicating a schedule change.

### 10. The weekly check-in asks for a resource members cannot find here

**Medium · Live + Data**

The portal and Google Form refer to the Goal-to-Action sheet. There are **zero published member resource records**. The member sees “Resources are being prepared” and an unnecessary reference to Kelsey's admin dashboard.

**Fix:** Publish the actual sheet or explain that Kelsey supplies it separately and where to retrieve it. Remove the admin implementation detail from the empty state.

The Google Form opens successfully. Its title should be “Weekly Check-In” or “Weekly Check-Ins,” not “Weekly Check In's.” Its questions are relevant, but there are many prompts for a “five minutes” promise. Only email is visibly required; make the essential reflection questions required if empty check-ins would not help Kelsey.

### 11. Weekly check-in history is disconnected from the member story

**Medium · Code + Live linked form**

The live weekly action opens Google Forms. The progress story reads weekly reflections from Supabase `check_ins`; no Google Forms import/integration was found in this repository. The older internal submit action is not the linked member flow. The portal also does not show that this week's Google Form has been submitted.

**Recommendation:** Either integrate submission status/reflections, or clearly explain that the form is reviewed separately. Do not promise that Google Form answers will automatically populate the portal until that path exists. External automation outside this repository was not inspected.

### 12. Personal training reset behavior does not fully match its promise

**Medium · Code; not submitted against a real plan**

- The form allows one, two, or three days, but not zero/rest this week.
- “Move the rest” marks excess sessions deferred; it does not reschedule their dates. Deferred workout instructions disappear from the plan.
- Reset only processes scheduled workouts from today onward. An earlier unfinished workout can remain the next workout after a reset.
- The percentage includes future and deferred workouts in its denominator, so adjusting a plan can keep the displayed completion percentage low.
- Invited/paused relationships can see completion/reset controls, while the server requires an active relationship and throws an error.

**Recommendation:** Add an honest zero-day option, explain exactly what happens to adjusted sessions, handle overdue work deliberately, and align available actions with relationship status. Show “completed of currently planned” instead of counting all future/deferred work as unfinished obligations.

Evidence: `web-app/src/app/portal/training/page.tsx`, `web-app/src/app/training-actions.ts:152`, `web-app/src/lib/member-data.ts`.

### 13. Personal training lacks practical appointment details

**Medium · Code**

The personal page focuses on workout plans. Although the relationship has a service mode and review date, the member page does not display them or an appointment time, Zoom link, location/directions, rescheduling path, or payment summary. Its “Group portal” link actually returns to Today, including for online-only members.

**Recommendation:** Add the next coaching appointment and a clear support/scheduling route if the portal is intended to manage appointments. Otherwise say plainly where Kelsey coordinates them. Preserve the confirmed consultation-first, $100/60-minute in-person offer.

### 14. Account is mostly support links

**Low/medium · Live + Code**

“My account” opens More, which has no account email, phone update, profile editing, or email preferences. The live intake offers Text/Phone as contact methods even when the profile says Phone: Not provided, without a way to add it.

**Recommendation:** Display the signed-in email and a contact-details update route. At minimum provide clear instructions to correct details with Kelsey. Add a phone field when Text/Phone is selected in intake.

### 15. Returning members can lose access to earlier sessions

**Medium · Code, conditional scenario**

Classes & membership selects the most recently created eligible enrollment with `limit(1)` and offers no session picker. If someone buys December while still attending October, the later-created enrollment can replace the October calendar. An older completed session is not selectable either. Intake also selects the latest eligible enrollment.

**Recommendation:** Prefer the currently running session and provide a simple session picker, preserving the selected enrollment in intake links. The live test member reviewed here had only one eligible enrollment, so this multi-enrollment case was not reproduced in browser.

### 16. Smaller copy and feedback issues

**Live unless noted**

- Future challenge: Today says “0/3 today” and invites check-in even though tracking is disabled until September 21. Show “Tracking opens September 21.”
- Habits says “Choose a past day” before any challenge day has happened; change the instruction for the pre-start state.
- “Your weekly intention: 1 workouts” needs singular handling. Demo similarly says “1 partial sessions.”
- Finish early opens review with “I completed it” already selected. The member can change it and the partial save works, but defaulting this particular action to partial would better match its label.
- “13 movements” counts warmup, repeated rounds, optional-round block, and cooldown as steps; “13 steps” is more accurate.
- The no-personal-plan state claims the member's group-session portal is still available even for a challenge-only member.
- Several session/training data queries ignore errors and render an empty state. A failed request can look like missing membership, no workouts, or no classes. Distinguish load failure from a true empty result. **Code.**
- Protected-route login preserves the pathname but not the full selected challenge context in its `next` value. Returning from authentication can land on the default challenge. **Code.**
- More/topbar/story links do not consistently retain the selected challenge. Standardize context preservation where it matters.

## What worked well

- The visual hierarchy and controls in the workout player are clear; full-screen exercise mode avoids competing navigation.
- The 10-minute filter reduced the live library from two workouts to the matching short session.
- Upcoming challenge workouts are withheld with a September 21 release explanation.
- Future habit checkboxes are disabled and explain why.
- Rest pauses the workout clock; paused rest restored correctly after reload, with an unfinished-session message.
- A partial demo session saved, showed the correct success wording, and appeared in practice history as partial with the note and elapsed time. It did not inflate completed workouts.
- Goal/win forms explain their purpose and privacy. Progress separates completed workouts, attended classes, and habit days.
- The member calendar adapts to a readable mobile list. An expanded event showed date, time, address, and the booking control without horizontal overflow at 390px.
- Progress fit at 320px without document overflow.
- Sign-out returned to the login form. A protected portal route redirected to login after sign-out.
- The Google weekly check-in destination loads and contains relevant coaching questions.

## Questions to send Kelsey

These are the remaining operational choices; the interface bugs above do not need her approval to diagnose.

1. **November 7:** Are 7:30 and 9 AM both separate live Zoom sessions? Should they use the same meeting link, or different links? The 9 AM record currently has none.
2. **Class changes:** Does saving/canceling a class in the portal count as communicating a makeup/Saturday switch, or should members also text/email you? If separate contact is required, which channel should we show?
3. **Goal-to-Action sheet:** Can you provide the final member version, and is it completed with you first or independently? Should weekly Google Form answers remain separate or appear in the member's progress story?
4. **Personal training:** Where will members find their scheduled 60-minute appointment or virtual check-in, and how should they reschedule? What response time should existing members expect for workout feedback and support? The confirmed 12-hour promise was for consultation requests, not necessarily ongoing coaching.
5. **A week with no training:** Should the reset let members choose rest/zero sessions? Should removed sessions move to a later date, remain accessible as optional workouts, or wait for you to reassign them?

## Verification limits and next pass

**Fresh email verification:** Gmail received “Your sign-in link” from Holden Health (`members@mail.holden.health`) at **10:09 AM Detroit time** on September 11. Expanded and read the new message, then opened its observed sign-in URL in the separate in-app browser. It successfully authenticated the existing `nbarris11@gmail.com` test account and rendered Today. This was distinct from the older 8:40 AM message. The in-app browser had initially been signed in as the retained `+membertest` account used to inspect the enrolled December session; its final login test used the approved base address. The Chrome authentication session was not signed out. No sign-in tokens are recorded in this report.

Both temporary viewport overrides were reset after testing.

This audit does not certify every database mutation. No real class booking/cancellation, intake declaration, paid checkout, personal-plan reset, or real-member goal/habit/workout save was submitted. Demo persistence is browser-local and does not prove production save delivery. Personal-plan populated states were inspected in code; there was no active personal-training plan available in the tested browser accounts. No physical iPhone/Safari, audible sound output, screen-reader session, failure-injection test, or full security review was performed.

Some browser navigations briefly stayed on Loading until reloaded. Browser automation also had intermittent command timeouts; these observations were insufficient to separate tooling delay from a reproducible application defect. Do not label the whole portal unreliable from those observations alone.

After fixes, run a focused production-like pass with disposable accounts for: new group enrollment → intake error/retry → review/payment readiness → class selection/switch → Zoom shortly after start; personal training active/paused/reset/feedback; returning member with two enrollments; real goal/habit/workout save → reload → coach view. Verify email links using those test accounts without charging money or submitting health declarations for real members.
