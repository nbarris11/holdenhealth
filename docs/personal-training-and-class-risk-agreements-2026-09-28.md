# Personal training intake and risk agreements — September 28, 2026

## Shipped

- Replaced the short personal training intake with all ten sections, options, questions, welcome text, and client acknowledgment supplied by Neil from Kelsey's Google Doc. Answers and signatures are saved privately and displayed in Kelsey's training workspace.
- Added the supplied personal training Assumption of Risk as a separate signed step after the intake. It keeps the $100/session and 24-hour cancellation wording. Kelsey can view the accepted text and countersign it in the member's training workspace. Intake review requires the client agreement.
- Added a separate group class Assumption of Risk after the class intake. It carries the same risk and release concepts with class-specific program, payment, cancellation, and attendance terms. New group enrollments require it before Kelsey can activate the enrollment; enrollments that existed at migration time remain exempt. The member portal shows the pending signature and does not claim the member is ready until it is saved.
- Each signature record retains the document version, exact displayed wording, six accepted acknowledgments, client typed signature, date, server timestamp, and optional Holden Health representative signature. Signed data is protected by row-level security.
- A phone-sized browser test surfaced a misleading zero-dollar payment message. Waived and credited payments now display their actual status.

## Deployment and verification

Migration `20260928173025_risk_agreements_for_training_and_classes.sql` applied to the Holden Health Supabase project. The default for new enrollments is `risk_agreement_required = true`; a query after migration found zero existing enrollments flagged. Final portal deployment `dpl_HqFV426W8WT1iwSqK4SmeTT99VZi` is READY at https://portal.holden.health. It includes the payment-label correction. The public website was not redeployed.

TypeScript, ESLint, 139 portal tests including focused intake/waiver tests, and a local production build passed. The browser walkthrough used one disposable synthetic member and real database writes. On a 390px viewport, the member completed the full personal intake, signed the personal agreement, completed the class intake, and signed the separate class agreement. The group form did not show the personal $100 or 24-hour terms. Kelsey's personal workspace displayed the intake and agreement, saved the representative signature, and marked the intake reviewed. The live class admin workspace displayed the class signature and saved the representative signature. Activation correctly refused a missing payment record. A zero-dollar TEST waiver allowed review and activation; the live member session then showed “Ready to participate.” Browser scripts reported no page errors for the completed member flow and live class countersign. The synthetic auth user, staff role, relationship, enrollment, payment record, both intakes, and both agreements were deleted; a verification query returned zero records for the test account. The local server had outbound email disabled for form submissions; activation on production may have sent one approval email to Neil's disposable plus-address. No payment was collected.

## Next use

Kelsey should send the intake link from the existing Hybrid client's training workspace if that client has not received it. Future personal training clients get the link in their setup email. New class members complete the class intake, then the class agreement; Kelsey sees the signature before activation and can countersign from the member workspace. In-person dates still need to be added individually after they are confirmed.
