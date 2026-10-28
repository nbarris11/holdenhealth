# Completed group signup tracking — October 1, 2026

Portal deployment `dpl_PKNvGWWq1fTrynCFaxWDeztAyDM1` is READY and aliased to https://portal.holden.health. Deployed from the workspace root with `npm run deploy:portal` using the existing isolated Holden Health Vercel CLI login. Neither Vercel Root Directory changed. The public website was not deployed.

`group_signup_completed` is emitted by the portal server only after a successful registration outcome:

- Venmo, cash, or check: the offline reservation database call succeeds. Properties include `completion_status=reserved` and `payment_status=pending`.
- Card or Apple Pay: Stripe reports checkout complete and paid. Properties include `completion_status=paid`.
- Bank transfer: Stripe reports checkout complete while payment is pending. Properties include `completion_status=processing`; the existing `payment_status_changed` event records later success or failure.

The event also includes the group offering and payment method; offline reservations include weekly commitment, while Stripe completions include the checkout amount. Personal training checkouts are excluded. Stable event UUIDs, derived from the session and event name, prevent repeated webhooks from inflating signup counts. Event properties never include name, email, phone, or intake text. This is a count of completed signup submissions, not a count of paid members. Consultation-only requests are excluded.

Verification: 162 portal tests passed, changed-source ESLint passed, clean local and Vercel production builds passed TypeScript. Tests cover successful and failed offline reservations, card completion, bank payment processing, stable retry IDs, and privacy. The live registration and login pages returned HTTP 200 after deployment. No real reservation, payment, or email was created during verification. PostHog will first show the new event after a genuine signup; live ingestion and full visitor-to-signup funnel attribution were not tested.
