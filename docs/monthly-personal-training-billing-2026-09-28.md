# Monthly personal training billing — September 28, 2026

## Shipped

User approved monthly bills paid manually, a Send bill option in admin, and the existing $4 fee shown only at checkout. No subscriptions, automatic monthly charges, or automatic bill creation.

- Admin: People → client → personal training workspace → Monthly billing. Select month, amount, due date, and description; Create bill, then Send bill. Bill creation publishes it to the member portal but does not email automatically. Resend is deduplicated per bill/day.
- Members: Personal training → Billing, or the emailed link. Sign-in preserves the bill destination. The portal and bill email display the training amount only. Stripe Checkout displays the training amount, $4 online payment fee, and full total before payment.
- Admin can record cash/check/Venmo or void an unpaid bill. An open Stripe checkout is expired before the database allows either action. A checkout being prepared can temporarily block offline updates until resolved or expired.
- Stripe completion events match a saved checkout attempt and validate the exact amount/currency. Browser return URLs never mark a bill paid. Repeated requests reuse the same checkout/idempotency key. Paid records cannot be downgraded by stale events.
- Existing public $199 online-training and class checkout flows preserved.

## Deployment

- Portal: `dpl_GvckwFZrnuecZwR8uXCRFfyWMw9Q`, READY at https://portal.holden.health.
- Deployed with root `npm run deploy:portal`, isolated Holden Health Vercel login.
- Migration: `20260928190457_monthly_training_bills.sql`.
- Tables: `training_bills`, `training_bill_checkouts`. Authenticated members can read their own bills; admins can read all. Writes and checkout RPCs are service-only. No changes to current client billing records: zero bills remain after QA.

## Verification

- 147 automated tests passed, including new parser, checkout pricing/reuse, webhook routing, email contents, ownership, and offline-expiration checks. Existing class/online checkout regression tests passed.
- TypeScript and changed-source ESLint passed. Vercel clean production build passed.
- `supabase/tests/training-billing.sql` ran against production in a rollback-only transaction: duplicate month prevention, owner isolation, denied member writes/private RPC calls, exact amount matching, repeat reservation, active-checkout protection, paid-event idempotency, and stale-event protection.
- Live authenticated Chromium walkthrough with disposable admin/member accounts: create bill, send through Resend's official delivered+label@resend.dev test sink, member sees $200 with no fee language, live Stripe checkout shows $200+$4=$204, no card submitted, admin records cash after expiring checkout, member sees paid without another Pay button. 390px and 320px member layout checks passed. Saved screenshots in `monthly-billing-verification/`.
- Database confirmed email timestamp, cash-paid bill and expired checkout. Both QA accounts globally signed out before deletion. QA bills, attempts, relationship and temporary staff role removed. Final count: zero QA users and zero bills.

## Limits and operational notes

- No real card charge, bank payment, refund, or physical-phone test. Paid webhook behavior was exercised using simulated Stripe events and real rollback-only database transitions, not a real payment.
- Local Stripe key is test mode. A temporary checkout-expired event subscription change to the test webhook was reverted. Production webhook event settings could not be inspected with that key. Existing completed/async event integration is reused. The portal also retrieves current Stripe status on bill refresh, checkout start, send, and offline updates, so expiration does not depend on a new webhook subscription.
- An expired live checkout and the provider test email remain in Stripe/Resend audit history; no charge or customer email was sent.
- Refund management remains in Stripe via the admin payment link. This release does not synchronize refunds into the bill ledger.
- Security advisor: checkout-attempt table intentionally has RLS with no public policies and no authenticated grants; service role only. Existing admin SECURITY DEFINER and leaked-password-protection findings remain outside this change. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.
