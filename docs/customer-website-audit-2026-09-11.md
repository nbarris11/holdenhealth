# Holden Health customer website audit

Audited September 11, 2026. Perspective: a prospective customer deciding whether to trust Kelsey, which program to choose, what it costs, and how to start.

## Overall recommendation

Fix the offer, schedule, and enrollment inconsistencies before launch. The site has a warm, credible foundation: real photos, a clear coaching philosophy, useful free resources, and functioning email delivery. The main problem is that different pages describe different versions of the business. A customer can move from current group classes and four-week online training into older monthly coaching, combined coaching, or a “coming soon” bootcamp.

This was an audit, not an implementation pass. No website code was changed or deployed. Findings below distinguish observed failures, clarity improvements, and business facts requiring Kelsey’s confirmation.

## Fix before launch

### 1. Publish one authoritative class schedule

**Observed:** The homepage’s loaded schedule includes Tuesday 6 AM, Wednesday 7 PM, and Saturday 7:30 AM and 9 AM. The coaching and registration pages describe Saturday 9 AM. Sales copy gives October 14–November 21, while the public calendar/drop-in flow includes Tuesday October 13. Both November 7 Saturday entries are labeled Zoom, despite the in-person positioning.

**Customer impact:** I cannot confidently decide whether the dates, times, location, and two/three-class choices fit my week. The two Saturday times may be alternatives, but the site does not explain that.

**Recommendation:** Confirm the facts, then use the same schedule for the homepage, coaching page, registration summary, and calendar. State whether customers choose two or three classes per week, whether Saturday times are alternatives, and whether any class is remote. Show session dates and the location immediately above enrollment fields. The current homepage consumes managed schedule data while other descriptions are hardcoded, creating drift.

**Evidence:** [Homepage](https://holden.health/), [group coaching](https://holden.health/coaching.html), portal `/register` and `/drop-in`.

### 2. Align the quiz, supporting pages, and navigation with the actual programs

**Observed:** The quiz offers fitness coaching at $199/month with “24/7” coach access, nutrition coaching at $199/month, and combined coaching at $299/month. Current online training is a four-week $199 program plus a $4 fee. The quiz calls bootcamp “coming soon” and sends visitors toward an interest list while group enrollment is already offered elsewhere. The combined-program details route lands on the group coaching page.

Older program names also remain on About, Contact, Book, Resources, Recipes, and some footers. Nutrition Coaching remains reachable through supporting navigation, but its pricing link leads to group-class pricing rather than nutrition pricing.

**Customer impact:** The quiz appears to recommend products that cannot be clearly purchased. Customers cannot tell whether nutrition is a separate service or included support.

**Recommendation:** Confirm the current offer list. Update or temporarily remove the quiz until its recommendations, prices, support promises, and destinations agree with the live products. Remove unsupported “24/7” access claims. Use the same names everywhere: proposed labels are “In-person group classes” and “Personal online training,” plus any genuinely available additional offer.

**Evidence:** [Quiz](https://holden.health/quiz.html), [online training](https://holden.health/fitness-coaching.html), [nutrition](https://holden.health/nutrition-coaching.html).

### 3. Make the purchase path match the page a customer is reading

**Observed:** The global “Join now” button goes to group registration even from the online-training and nutrition pages. The dedicated online-training CTA goes to the correct online enrollment page.

**Recommendation:** Use “Join group classes” for the group destination. On the online-training page, use “Start online training.” If a shared CTA must serve every page, send “Find your program” to a concise program comparison rather than directly into one program’s checkout.

### 4. Disclose the full price and link the policies customers must accept

**Observed:** Group sales prices are $199/$249, with a $4 fee introduced during registration, producing $203/$253 totals. Registration asks customers to accept published cancellation/attendance policies without a conveniently linked, complete policy at that decision point. The group page explains missed classes are nonrefundable and do not carry over, but that does not answer cancellation before the session, coach cancellation, illness, or inability to participate after intake. The general Terms page refers to separate service terms.

Online enrollment shows the $203 total. Group enrollment emphasizes bank payment, whereas online enrollment supports cards. This may be deliberate but needs clear expectations.

**Recommendation:** Show “$199 + $4 processing fee · $203 total” and the equivalent $253 total wherever the group price is presented. Link the actual applicable policy beside the acceptance checkbox. Explain when the four-week online period begins, what happens at the end, and whether renewal requires another purchase. Confirm the payment-method distinction. These are clarity findings, not a legal compliance determination.

### 5. Repair keyboard access in consultation booking

**Observed:** Goal and consultation-format choices are clickable `div` elements without keyboard focus or appropriate control semantics. Continue stays disabled until a selection is made, so a keyboard-only visitor cannot complete the first steps. Relevant markup is in `book.html` around lines 221–225 and 239–240.

**Recommendation:** Use real buttons or radio controls, with visible focus and an announced selected state. Verify the whole flow using only Tab, arrow keys where appropriate, Enter, and Space.

**Additional clarity:** The final Zoom action says “Request my free call,” although the flow is intended to book an available slot. Distinguish “Book my Zoom call” from the phone branch’s “Send my call request.” September 15 availability included 10:30 PM; confirm this is intentional.

### 6. Fix the narrow-screen homepage overflow

**Observed:** At a 320 CSS-pixel viewport the homepage had a 380-pixel document width. The long Wednesday Reset CTA extended to approximately x=380, and the hero CTA also exceeded the screen. The other 20 content pages passed this horizontal-overflow check. At 390 pixels, the public content pages fit.

**Recommendation:** Allow long mobile button text to wrap, keep buttons within their container, and check hero grid minimum widths. Shared `.btn` styling includes `white-space: nowrap`; the Reset CTA near `index.html:428` is a concrete reproduction point. Retest at 320 and 390 pixels.

### 7. Repair broken and misleading links

**Confirmed:** Eight pages link to `coaching.html#bootcamp`, but that fragment ID does not exist: About, Contact, Protein Habit, Quiz, Resources, All-or-Nothing, Book, and Recipes. These load a page but do not take the customer to the promised section. The Precision Nutrition `/all-about-eating-slowly` reference in Eating Out returns HTTP 404.

**Recommendation:** Replace the old bootcamp labels/destinations consistently with the actual program. Replace or remove the dead citation. Local file targets otherwise existed. Instagram, Facebook, and Venmo returned successful responses. Two MyPlate resources returned 403 to the automated request; that is an access limitation, not proof of broken customer links.

### 8. Update the privacy description to match the current website

**Observed:** The privacy page describes Netlify hosting/forms, while the current site uses Vercel and the portal backend for forms, database storage, and email delivery. The site also includes analytics, and the portal includes payment processing.

**Recommendation:** Have the privacy text describe the actual providers, data collected, and purposes in understandable language. Check the revision date and consistency with enrollment. This audit did not provide legal review.

## Improvements that would make the customer journey clearer

### Homepage and positioning

The real portrait and empathetic tone help establish trust. Bring the two paid choices, who each is for, price, and next step earlier in the page. The extended empathy/Wednesday material delays the practical answer for a visitor specifically looking for a trainer. At the tested desktop size the large hero heading pushed the main action below the first screen.

“Focus on You,” “Wednesday Plan,” “Wednesday Reset,” and “Wednesday Note” are individually understandable but collectively add naming overhead. Make the paid program names the primary navigation, and identify the others as free tools or email content.

Put the physical address/directions next to the group schedule and explain what a first class feels like: experience level, what to bring, and how Kelsey helps someone starting again. Add approved, authentic client proof when available; do not present demo member content as testimonials.

### About and Contact

About provides helpful personal background, photos, and credentials. Its “online coaching practice” framing underplays the current local classes, and older offer names need updating. Credentials were reviewed as website claims, not independently reverified with issuing bodies.

Contact should help visitors choose the correct program and explain what happens after sending a message. Clarify the service area: some copy says “anywhere,” while other language limits online services to the U.S. Publish only a response-time promise Kelsey can maintain.

The contact and phone-request handlers store the inquiry and notify Kelsey, but do not send the customer an acknowledgment email. Consider a brief receipt: “Thanks—your message is with Kelsey. She’ll reply by email within [approved response window].” The window needs confirmation before publication.

### Resources, recipes, and articles

The filters work and the articles generally support the practical, approachable positioning. Some details need reconciliation:

- A resource card promises five breakfasts in under ten minutes. Recipes contains three recipes, and egg muffins take approximately 30 minutes. Proposed replacement: **“Three easy high-protein recipes”**, with a short note about make-ahead options.
- Recalculate recipe protein estimates against the specified servings and ingredients. For example, the cottage-cheese toast estimate merits checking. No nutritional calculation was independently validated in this audit.
- The recipe artwork is broad brand imagery rather than photographs of the food. Actual recipe photographs would make the page more useful and credible.
- The older All-or-Nothing article says “You are not allowed to miss twice in a row” and “You are failing only when…” This conflicts with the rest of the site’s flexible, supportive approach. Its 40%/80% framing reads as a precise claim without an explained basis.
- Suggested replacement for the rigid rule: **“When you miss a workout, choose your next realistic opportunity to move. Rest, illness, and a busy week do not erase your progress.”**
- The 20-minute workout could link directly to a relevant app demonstration, making the program experience tangible.

### Wednesday Reset and Wednesday Note

The Reset’s tested recovery/no-time route produced a sensible low-pressure plan, and its print/save action generated a usable single-page print preview. The introduction promises three questions but the flow has four. Add Back so a mistaken answer does not require restarting. Replace phrases such as “clean handoff” with everyday language, for example “Make tomorrow a little easier.”

The newsletter invitation and landing page should agree about whether signing up delivers something immediately or subscribes to future notes. The welcome email delivered correctly, but the note downloads as a Word file. Offer a mobile-friendly web page or PDF as the main reading option and retain Word only if editing is useful.

The rendered Word file spills only Kelsey’s signature and brand line onto a nearly empty second page. Adjust spacing/image size so it fits cleanly or uses an intentional second-page layout. The five-habits artwork also dominates the top of the note, making it look initially like another habits guide. The separate three-page PDF guide is intact; purple table headers and some small labels could use stronger contrast/readability.

The newsletter welcome email has no visible unsubscribe/preferences link. Add an obvious unsubscribe route to subscription emails. Confirm that a weekly Wednesday cadence is the actual commitment. Standardize the differing taglines across the site, guide, and note when polishing these assets.

### Portal entry points and app preview

The homepage’s free-challenge link introduces email signup and a September 21 start. There is also a working demo, which is a more immediate way to show a prospective buyer the app. Proposed CTA: **“Try the app—no account needed.”** Keep the challenge as a separate invitation.

The static app preview looks somewhat interactive; make its click behavior or preview status obvious. Explain which app features accompany each program so customers do not assume all coaching services are included.

The public portal homepage emphasizes group sessions and drop-ins. An online-training prospect can lose context there, and its logo does not clearly return to the marketing website. Provide explicit routes back to program information and to online training.

Drop-in requests remain reachable through the portal even though their homepage promotion is hidden. The calendar/request flow does not clearly show a price before the request. Confirm whether drop-ins are currently offered and explain the price, availability confirmation, and payment step if they remain public.

## Page-by-page coverage

Every word of the following 21 public content pages was reviewed in the rendered site/source. Shared navigation and footers were checked across pages; not every repeated instance of an identical link was clicked individually.

| Page | Review result / main follow-up |
| --- | --- |
| Home `/` | Main paid CTAs reach correct program entries; reconcile schedule, improve offer hierarchy, fix 320px overflow. |
| `coaching.html` | Group offer understandable; reconcile dates/times, total fees, policies, and location visibility. |
| `fitness-coaching.html` | Dedicated online CTA correct; fix shared Join now destination and old monthly descriptions elsewhere. |
| `nutrition-coaching.html` | Clarify whether purchasable; pricing destination currently describes group classes. |
| `about.html` | Strong human background; update program framing and legacy footer destination. |
| `book.html` | Zoom and phone branches reach final details; blank validation works; keyboard choices block progress. |
| `contact.html` | Required-field validation works; refresh offers and explain response expectations. |
| `resources.html` | All five filters work; guide email works; reconcile recipe and newsletter promises. |
| `recipes.html` | Three recipes reviewed; card mismatch, estimates, imagery, legacy footer. |
| `quiz.html` | Two complete result routes and restart exercised; all result definitions read; outdated offer catalog. |
| `wednesday-reset.html` | Recovery/no-time route, restart, and print tested; four-question copy and Back improvement. |
| `wednesday-note.html` | Signup and welcome delivery work; improve download format and subscription expectations. |
| `20-minute-strength-workout.html` | Content reviewed; opportunity to connect to actual app experience. |
| `protein-habit.html` | Content reviewed; repair legacy footer fragment. |
| `get-back-on-track.html` | Supportive tone; content and destinations reviewed. |
| `beginners-guide-to-lifting.html` | Content and references reviewed; no blocker found in the tested reading path. |
| `eating-out-with-your-goals.html` | Content reviewed; confirmed dead Precision Nutrition link. |
| `blog-all-or-nothing.html` | Rewrite rigid/judgmental statements and unsupported numerical framing. |
| `privacy.html` | Update obsolete platform/data-handling description. |
| `terms.html` | General terms do not resolve purchase-specific cancellation questions. |
| `disclaimer.html` | Content reviewed; no claim of legal sufficiency. |

Also checked the 404 page and its working Back home action. Preview and custom-page template files were inventoried; they are not additional published customer content pages. The published navigation API listed six header pages and no additional custom pages.

## Functional verification and email results

| Flow/check | What was verified |
| --- | --- |
| Desktop/mobile navigation | Dropdown opens; mobile menu opens, expands Coaching, navigates to online training, and closes. |
| Group enrollment | Choices, request accordion, blank-field validation, visible totals and policy acceptance UI. Stopped before agreeing to terms or payment. |
| Online enrollment | Correct page and $203 total; payment entry context inspected. No purchase. |
| Consultation | Fitness → Zoom → September 15 → 9:30 AM → contact details; separate Not sure → Phone branch; blank submission errors. No appointment booked or inquiry sent. |
| Contact | Blank name/email/message validation. No valid inquiry submitted. |
| Resources | All, Nutrition, Training, Mindset, Recipes filters and guide validation. Featured cards remain separate from the filtered post grid. |
| Quiz | Complete fitness and group routes plus restart; other result logic read, not every answer combination exercised. |
| Reset | Recovery/no-time route, output, restart, and print preview; remaining logic read, not every combination exercised. |
| Goal landing pages | Family, confidence, return, and myself presets; group/personal switch and matching enrollment links. Browser preference was exercised, not a member record. |
| Portal entry | `/register`, `/online-training`, `/start`, `/challenge`, `/login`, portal home, `/drop-in`, and demo Today inspected. Not a full authenticated app audit. |
| Mobile | All 21 content pages at 390px and 320px; only homepage overflow at 320px. Portal entry pages checked at approximately 390 CSS pixels with browser zoom accounted for. |
| Local checks | `npm run check:site` passed: syntax, SEO checks for 18 sitemap pages, and 10 tests. File targets and fragment references inspected. |
| Anonymous access | Bare/www homepage presents intentional preview gate; robots disallows crawling. This is a launch setting, not an accidental failure. |

Authorized tests used **nbarris11@gmail.com**:

1. **5 Habits guide:** submitted around 8:39 AM; received “Your free Holden Health 5 Habits guide” from Kelsey at Holden Health. Opened the linked three-page PDF successfully. Reviewed all pages visually and as text.
2. **Wednesday Note:** submitted around 8:40 AM; received “Your Holden Health Backup Plan.” It appeared under existing Low-Priority/Newsletters labels, not a confirmed spam/delivery failure. Opened/downloaded the correct Word document and reviewed its text and two-page rendering.
3. **Sign-in:** requested around 8:40 AM; received “Your sign-in link.” Clicking it successfully opened Today for the existing test account. No new account was created. This verifies existing-account email login, not new paid-customer onboarding.

The guide and newsletter form handlers also have staff-notification behavior, but Kelsey’s inbox delivery was not inspected. The newsletter test may have created or refreshed this email’s subscription; it was not automatically unsubscribed afterward.

## Verification limits

No payment was made, live class booked, waiver accepted, valid consultation/contact inquiry submitted, or member workout changed. Paid checkout completion, payment webhooks, subsequent paid onboarding, and staff email receipt therefore remain unverified in this pass. Source review does not substitute for those end-to-end transactions.

This was not a full WCAG certification, security assessment, medical/nutrition validation, legal review, Lighthouse/Core Web Vitals measurement, or physical iPhone/Safari test. Current certifications and client results were not independently authenticated. Browser previews and HTTP checks were used for the live site; two externally restricted resource links remain inconclusive.

## Original questions for Kelsey (answered in part below)

1. **What is the final class schedule?** Is the first class October 13 or 14? Is Saturday 7:30 AM, 9 AM, or a choice? Are the November 7 classes really on Zoom? How do the two-/three-class plans work, and is the 25-person limit per class or for the whole session?
2. **What exactly are we selling at launch?** Group classes and four-week online training only, or also standalone nutrition and combined coaching? Please confirm each price, duration, and included support. Does “24/7 access” mean messaging at any time or an actual response promise?
3. **What are the enrollment rules?** Confirm the $4 fee, group bank-only payment, cancellation/refund rules, missed-class rules, and what happens if Kelsey cancels or intake shows the program is unsuitable. When does online training start, and how does renewal work?
4. **What should a new local customer know before joining?** Confirm the exact address, arrival/parking instructions, what to bring, beginner suitability, and any service-area restrictions for online clients.
5. **What should we promise after an inquiry?** Confirm response time, Zoom consultation length, and whether late-night availability such as 10:30 PM is intentional.
6. **Are drop-ins available at launch?** If so, what do they cost and when is a requested spot actually confirmed?
7. **What is the Wednesday email commitment?** Is it weekly, and should the first download be the Backup Plan note, the 5 Habits guide, or both? Can we publish approved client testimonials/photos to strengthen trust?

## Recommended order of work

Use the confirmed decisions below to update facts consistently across sales pages, quiz, footers, and enrollment. Resolve the remaining enrollment details before implementing assumptions about payments or personal training. Fix the confirmed keyboard, mobile, and link defects, then polish resources/downloads and update privacy details. Perform one authorized paid-onboarding test before removing the intentional preview gate.

## Confirmed business decisions — September 11 follow-up

These answers were supplied by the user after the audit. They supersede conflicting business assumptions above; the findings remain a record of what the site displayed during testing. This document update does not change the live website.

### Schedule and launch offers

- The six-week program starts **October 13, 2026**. Classes are Tuesday at **6 AM**, Wednesday at **7 PM**, and Saturday at **7:30 AM or 9 AM**.
- **November 7 is a Zoom class day** because Kelsey is out of town. Present this exception beside the normal in-person schedule.
- Launch offers are the six-week program, the **free 21-day habit challenge starting September 21**, online virtual training, and in-person personal training.
- Standalone nutrition and combined monthly coaching were not listed among the launch offers. Do not continue presenting those older products as confirmed offerings.

### Attendance and payment

- Customers may make up a missed class on a different day/time **within the same six-week session**.
- Missed classes are not refundable. Serious illness or injury can be discussed with Kelsey individually; do not promise a specific exception or refund outcome.
- Six-week session payments may be made online, by Venmo, or by cash/check **before the first class starts**.
- No drop-ins are currently offered. Someone joining after the session starts should contact Kelsey; she will check space and, if available, prorate the price.
- Customers choosing Venmo or cash may reserve a place before payment is received. Check remains an accepted payment method; reservation before check payment was not separately specified.
- The **$4 processing fee applies only to online payments through Stripe**. Do not add it to Venmo, cash, or check payments.

### Arrival instructions — ready for customer copy

“At Burroughs, look for parking near the clock on the south-facing side of the building. Enter through the doors by the clock, walk straight ahead, then turn left down the hallway. The gym is on your left.”

Keep the verified street address and a directions link alongside these instructions. Do not infer an address from the building name alone.

### Consultations

- Kelsey will respond to a consultation request **within 12 hours**.
- Consultations last **30–60 minutes**.
- Remove the previously observed **10:30 PM** availability. This answer does not establish that every 10:30 AM slot should be removed.

Suggested copy: “Request a free 30–60 minute consultation with Kelsey. She’ll respond within 12 hours to arrange the details.” Use separate wording for any flow that actually confirms a booked appointment immediately.

### Welcome email

The first email should welcome the subscriber and explain Holden Health. The Backup Plan note can accompany it. Do not treat the attachment alone as the welcome experience.

Draft subject: **Welcome to Holden Health — I’m glad you’re here**

Hi there,

I’m Kelsey, the coach behind Holden Health. I help people get stronger, build practical habits, and find a routine that fits their lives.

You can work with me through in-person group classes, personal training, or online training. If you’d like a place to start, our free 21-day habit challenge begins September 21.

You don’t need a perfect week to make progress. I’ve included “The Backup Plan Still Works,” a short note about finding a manageable next step when life gets busy.

[Read The Backup Plan Still Works]

If you’re unsure where to begin, reply and tell me what you’re looking for. I’ll help you find a good fit.

— Kelsey
Holden Health

Implementation notes: use a mobile-friendly reading link; ensure Reply-To reaches Kelsey; include an unsubscribe link for the email subscription. The date-specific challenge sentence needs removal or replacement once the invitation is no longer current. Weekly newsletter cadence was not explicitly settled by the supplied answer.

## Final follow-up decisions

The user supplied the following additional answers after the first clarification round. These supersede the earlier open questions and recommendations where they conflict.

### Personal training

- Start with a consultation.
- In-person sessions cost **$100 for 60 minutes** and take place at the same location as the six-week group classes.
- Use **“Book a free consultation”** as the personal-training CTA. Do not introduce direct personal-training checkout ahead of the consultation.
- The $100 hourly price is for in-person personal training; do not apply it to the separate online program without confirmation.

Customer-ready copy:

“Personal training starts with a free consultation so we can talk about your goals and find the right approach. In-person sessions are $100 for 60 minutes, at the same Burroughs location as our group classes.”

### Reservations and payment

“Reserve your place and pay online through Stripe, by Venmo, or with cash or check before your first class. A $4 processing fee applies only to online Stripe payments.”

Implementation detail: Venmo and cash reservations can hold a spot while payment is pending. Keep reservation status separate from paid status; do not mark an offline reservation as paid or imply that Stripe processed it. Check payment is accepted, but the user explicitly named Venmo and cash when confirming unpaid reservations.

### Switching times and making up classes

“You can switch between the Saturday 7:30 AM and 9 AM classes or make up a missed class at another scheduled time within the same six-week session. Just let Kelsey know when you plan to attend.”

Do not add an unconfirmed capacity restriction to the makeup policy. Communicating the change to Kelsey is the stated requirement.

### Cancellations

“If you cancel before the program starts, you’ll receive your money back. Once the session begins, missed classes are not refundable, but you can make them up within the same session. If a serious illness or injury prevents you from participating, contact Kelsey to discuss your situation. If Kelsey must cancel a class because of an emergency, she’ll provide an at-home workout instead.”

Do not promise a replacement in-person class for a coach cancellation. Before-start cancellations must not be described as nonrefundable. Ensure any eventual refund implementation matches the promised customer refund, including treatment of the online fee; the user did not separately define fee retention.

## Remaining implementation cautions

The main personal-training, payment, attendance, and cancellation questions are answered. Preserve the distinctions above when updating the site. Existing online-program price/support/renewal terms were not explicitly reconfirmed by these answers. Other minor facts still not supplied include equipment/what to bring, online service area, and a firm weekly newsletter promise. These do not hold up fixes to confirmed facts or broken interactions.
