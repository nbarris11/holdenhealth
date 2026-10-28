# Member renewal — September 13, 2026

User approved a manual “Join the next 6-week session” portal renewal option, with saved contact details, same-account membership history, payment choice and registration status.

Added /portal/renew, linked from Today, Account & support, completed-session next steps, and public registration. Lists only published, enrolling sessions starting after today in Detroit. Defaults to the earliest offered session without an existing invited/active/completed enrollment; members can explicitly select another offered session to review its status. Empty state when no session is open. Dates and plan prices precede the form. No auto-renewal or automatic charges.

Shared registration form accepts saved name/email/phone/weekly plan and a server action. Email is read-only for renewal and overwritten with the verified account email on submission. Existing payment choices, $4 online fee, safety/policies, capacity locks, server prices and per-session intake review remain. New invitation claiming already attaches a new session to an existing matching auth account; prior memberships and progress are not overwritten.

Private order/request/invitation reads are scoped to verified email and selected session. Paid/enrolled, processing, reserved checkout and offline request states hide the payment form. Reserved Stripe checkout can be resumed by its authenticated owner; only a Stripe-confirmed expired checkout is marked expired, with a reserved-status condition. Processing and paid orders are never cleared by this recovery action. Card cancellation and payment errors retain the renewal session; offline success returns to its renewal status. No schema migrations, member edits, real emails or real payments performed in this release.

The August 21 nbarris11@gmail.com order previously observed in payment_processing remains untouched. Its Stripe status still needs independent verification before resolving it. This feature prevents another renewal payment while that status remains.

Validation: all 64 existing tests passed, plus six new renewal tests covering next-session selection, status gating, verified account binding, duplicate/unoffered-session rejection, owned checkout recovery, privileged-query scoping, and SSR saved form fields. ESLint, local production build/TypeScript passed. Synthetic source-rendered browser fixture at 390×844 had no horizontal overflow; screenshot reviewed. This is not an authenticated live member walkthrough or a completed renewal/payment test. No physical iPhone verification. Temporary preview server stopped.

Deployment and live verification follow.

Deployed via root npm run deploy:portal: dpl_7WhNE1J443H8cH8oh78dZ3hMUKnr READY at https://portal.holden.health. Vercel production build/TypeScript passed. Live browser retained an existing authenticated session: October correctly displayed payment processing without a duplicate payment form; selecting December navigated to its separate session and showed the mini-session details/contact path. December has no two-/three-day checkout prices and therefore does not offer self-service checkout. No new login, form submission, payment, email, member or pricing change performed. This live status/session-selection check supplements the synthetic form layout check above; a full paid renewal remains untested.
