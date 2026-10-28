# Holden Health member portal

Next.js portal for enrollment, ACH payment, secure member intake, check-ins, and administration.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase, Stripe, and Resend values.
2. Apply pending Supabase migrations.
3. Install dependencies and start the app:

```bash
cd /Users/barris/Desktop/holden-health-site/web-app
npm install
npm run dev
```

## Stripe ACH setup

- The Vercel Stripe integration initially creates a test sandbox. From the Stripe installation page, use **Install → Import Existing Stripe Account** to connect an activated live account.
- Enable ACH Direct Debit in the live Stripe Dashboard.
- Add a webhook endpoint at `https://portal.holden.health/api/webhooks/stripe`.
- Subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
- Save the webhook signing secret as `STRIPE_WEBHOOK_SECRET` in Vercel.
- Save the Stripe secret key as `STRIPE_SECRET_KEY` in Vercel.

## Supabase server access

Create a restricted server secret from Supabase project settings → API Keys → Secret keys, then store it in Vercel production as `SUPABASE_SECRET_KEY`. Never expose this value in a browser or with a `NEXT_PUBLIC_` prefix.

Online enrollment stays hidden until Stripe and the Supabase server secret are configured. The existing request form and free-call path remain available.

## Verification

```bash
cd /Users/barris/Desktop/holden-health-site/web-app
npm run lint
npm run build
```
