# Customer website release — September 11, 2026

Implemented and deployed after the user supplied Kelsey's answers and explicitly requested all changes be pushed live. Business facts and original observations are in [the customer audit](customer-website-audit-2026-09-11.md).

## Production deployments

- Website: **READY**, `dpl_FZ8tYobcSbbf5QMUdVASfA7HyzKZ`, https://holden.health. This supersedes the earlier website deployments during this release.
- Portal: **READY**, `dpl_8UoH1LuF6vcMqzqNyEgqXQRpceTb`, https://portal.holden.health.
- Used the prescribed root `npm run deploy:site` and `npm run deploy:portal` commands. Neither project's Root Directory changed.
- The existing preview-password protection remains enabled. The welcome note and its public styles/scripts are accessible without a password, with noindex headers during preview; other sales pages remain protected. This is deployment of the updates, not activation of the separate public-launch flag.

## Delivered

- October 13–November 21 session dates in public HTML, metadata, managed content, and the live session record. Both Saturday times and the November 7 Zoom exception are visible.
- Personal-training page: consultation first, $100/60 minutes, Burroughs address and arrival instructions. Added to program discovery and navigation.
- Homepage presents group classes, in-person training, online training, and the September 21 free challenge early in the page.
- Quiz now recommends the four launch offers. Removed obsolete monthly nutrition/combined offers, “24/7” promises, and bootcamp interest-list recommendations. Nutrition page now explains habit support within available programs.
- Personal-training CTAs lead to a consultation. Existing online payment remains available after consultation, with a required consultation acknowledgment checked on the server.
- Group fees and payment choices are explicit. Enrollment shows $203/$253 online totals; offline payments do not add the $4 fee.
- Cash/Venmo/check reservation option uses a pending registration record, visible to Kelsey in the existing admin queue and email notification. Reservations count against session capacity and prevent duplicate offline/online signup for the same email. No Stripe order or paid status is created for an offline reservation. Kelsey still records payment and reviews intake through the existing workflow.
- Published makeup, Saturday-switching, pre-start refund, serious illness/injury, and emergency coach cancellation policies; linked at enrollment acceptance. Prorated late enrollment goes through Kelsey. Drop-in entry page now explains this, public drop-in submission is disabled, and future class records have drop-in booking disabled.
- Booking choices are keyboard-operable buttons with selected state. Consultation copy states 30–60 minutes and a 12-hour response for requests. Future unbooked availability reserves a full hour; removed the 10:30 PM slot and alternating starts that would overlap. Preserved the existing booked consultation. New database guard rejects overlapping bookings, and the availability API excludes overlapping ranges.
- Welcome email introduces Holden Health and links to a mobile-friendly Backup Plan page. Subscriber-specific unsubscribe link is included using the existing preferences system. Contact/consultation forms now attempt a customer acknowledgment after saving the inquiry.
- Corrected broken footer fragments, stale drop-in links, the dead eating-slowly reference, and the recipe-card promise. Removed unverified precise recipe protein totals instead of inventing replacements.
- Softer All-or-Nothing article language, Reset Back control, and corrected question count/awkward output wording. App demo is accessible directly from the website and the workout article.
- Homepage 320px overflow fixed; newsletter success hides the completed form. Privacy copy describes current hosting, forms, email, payment, analytics, and portal providers.

## Database changes and verification

Applied migrations (local filenames aligned to the actual remote versions):

- `20260911132613_customer_offline_reservations.sql`: payment method on pending registration requests, server-only reservation function, shared capacity counting, and restriction preventing anonymous direct inserts from claiming an offline hold.
- `20260911132651_consultation_booking_overlap_guard.sql`: private trigger function serializes booking conflict checks and rejects overlapping booked appointments.

[Release data updates](customer-audit-release-data.sql) record the targeted session, consultation availability, drop-in, and managed-content updates. No real member workout, demo-story record, or existing booked consultation was changed.

Transaction-rollback checks passed for a pending cash reservation, no generated Stripe order, duplicate offline rejection, duplicate online rejection, and no anonymous RPC execution. A second rollback-only test confirmed overlapping consultations are rejected. No test reservation or consultation remained afterward; these database tests sent no emails.

## Checks passed

- Website checks: 20 sitemap pages, local targets, canonical URLs, headings, JSON-LD, image alt attributes, and **11 tests**.
- Syntax checks for inline scripts across root HTML pages.
- Portal ESLint, TypeScript via production build, local production build, Vercel production build, and **28 existing tests**.
- Browser: homepage and personal-training page fit at 320 CSS pixels; booking progressed using keyboard controls; personal-training quiz route showed $100/60 minutes and correct destinations; enrollment fields and policy acceptance validate; offline form and registration page fit at 320 CSS pixels.
- Live registration renders the correct October 13 dates, both Saturday choices, online totals, policy links, and offline choices. Live group page agrees and contains no remaining drop-in purchase labels.
- Anonymous HTTP: welcome note and supporting stylesheet load successfully without a preview cookie; main site still shows intended preview gate. Portal registration and late-enrollment page return 200. Consultation API returns 60-minute availability.
- Approved email test to `nbarris11@gmail.com` delivered at approximately **9:35 AM Detroit time**: “Welcome to Holden Health — I’m glad you’re here.” Read in Gmail; introduction, program link, Backup Plan link, and unsubscribe link present. The subscription was not canceled. This test may also notify Kelsey through the pre-existing signup notification behavior.

## Limits and remaining editorial assets

No money was charged, live customer reservation submitted, policy accepted on the user's behalf, or new appointment booked. Paid checkout/webhook completion and new paid-member onboarding were not exercised end to end. The offline reservation database behavior was tested transactionally; the browser pass verified rendering and required-field validation rather than submitting a real hold.

The original editable Word attachment and PDF guide remain available. The primary welcome reading experience is now HTML; their optional visual refinements, new recipe photography, and approved customer testimonials were not fabricated. Online-program start/renewal details should be agreed during the required consultation; no unsupported business terms were invented.

Security advisor reported the previously documented checkout-table policy notice, three existing administrative function warnings, and disabled leaked-password protection; it did not identify a new warning for the added reservation function. References: [database linter](https://supabase.com/docs/guides/database/database-linter), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This is not a full security or legal review. Production runtime logs were not scanned, so successful builds/HTTP checks are not a claim of error-free runtime logs.

No new dependencies. Local pre-change source backup: `/tmp/holden-before-customer-fixes.tar.gz` (temporary, not a durable version-control backup). Website deployments exclude docs, tests, scripts, and database migrations as configured.
