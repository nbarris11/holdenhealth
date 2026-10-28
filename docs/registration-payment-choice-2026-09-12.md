# Single registration form — September 12, 2026

User requested the change after reviewing a recording where the visitor began the bank-payment form before completing an offline reservation.

Replaced duplicate ACH/offline forms with one shared client form. Explicit payment choice: Venmo, bank payment (ACH, when available), cash, check. Shared contact/plan/attendance fields survive payment-method changes. Total updates with the existing $4 ACH-only fee; submit label and policy/safety requirements follow the selected method. Offline wording states reservation/payment pending and Kelsey follow-up; no claim of an immediate Venmo charge. Existing #enroll and #offline targets remain usable. Consultation link retained.

New server dispatcher allowlists the four methods and delegates the original FormData to the existing handlers. Existing availability, capacity, duplicate prevention, Stripe checkout, offline reservation, emails and success pages retained. No dependencies, database changes, prices or live member/payment edits.

Validation: 57 existing tests passed; added payment-routing test passed, including unknown/missing-method rejection with no handler called. Final lint and production build/TypeScript passed. Local browser verified one form, $249 offline total, contact/plan retention when changing methods, unavailable-bank fallback, and 320px layout without overflow. Local Stripe configuration does not enable ACH in production mode; live ACH UI checked after deployment separately below. No actual reservation or payment submitted, no emails sent, no physical-phone claim.

Initial deployment dpl_5EkEGB41dZ4BbVTHyCjr1ETkAhJv READY. Live browser confirmed ACH $253 and Venmo $249 for three days; name and selected plan retained; ACH safety fields removed when switching to Venmo; one form and no 320px horizontal overflow. Follow-up fixes existing label CSS overriding the HTML hidden attribute on the optional note field: explicit display:none when ACH is selected, preserving its draft when switching back. Final deployment recorded below.

Final portal deployment: dpl_BiWXTWaHWxHLyP9zxwdxQfQwLYuF READY at https://portal.holden.health via root npm run deploy:portal. Final Vercel build/TypeScript and lint passed. Reloaded live page and verified hydrated Venmo/ACH switching and hidden ACH note field. Two-day offline total $199 also verified; no browser error logs captured. No public-site deployment. Total automated tests: 58 (57 existing plus new routing test).
