# Card / Apple Pay registration — September 13, 2026

User authorized adding Card / Apple Pay to group registration through existing Stripe Checkout.

Added a separate card choice beside ACH, Venmo, cash and check. Card and ACH both retain the $4 online payment fee, shared fields, safety/policy requirements, server-derived prices and existing reservation checks. Card selection creates a card-only hosted Stripe Checkout session (Apple Pay is a card wallet); ACH keeps bank-only checkout and processing guidance. Stripe decides wallet eligibility; an Apple Pay button is not promised on every device.

Renamed the shared checkout action to startStripeCheckout and allowlisted card/ach both there and in the form dispatcher. Paid Stripe webhooks record stripe_card for card-only sessions and retain stripe_ach for existing bank sessions. Admin payment editing recognizes stripe_card. Paid emails and unknown/cancelled payment screens use method-neutral wording. Existing immediate paid and asynchronous ACH handling retained.

Applied additive migration add_stripe_card_payment_method to Holden Health project urxxiohatmvqbgrzqibq; verified both stripe_card and stripe_ach casts. No existing payment/member records changed.

Validation: 60 existing tests passed, including updated routing test. Four added mocked server-action/webhook tests passed: card/ACH methods, server totals, safety checks, unknown-method rejection, correct payment recording, neutral paid emails, retry behavior and mismatched-amount rejection. ESLint and local production build/TypeScript passed. No actual payment, reservation, invitation or email submitted by these tests. No physical iPhone/Apple Wallet payment tested or Stripe dashboard wallet setting verified.

Deployment and live browser verification follow below.

Portal deployed successfully via root npm run deploy:portal, deployment Aeq48gnWzcyZuzDaxQzLwpRRcBT1, production https://portal.holden.health. Vercel production build/TypeScript passed. Live browser at 390×844 verified new Card / Apple Pay choice, two-day $203 total, safety/policy fields, wallet eligibility explanation, and no horizontal overflow (390px content width). Switching to ACH preserves plan/total and restores bank guidance; switching to Venmo shows $199, offline instructions and Reserve my place. No form submitted. Public website unchanged.
