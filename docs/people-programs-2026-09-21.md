# People filtering and Programs navigation — September 21, 2026

## Changes

- People directory now filters by the selected class session using enrollment session IDs. Count reflects search results; empty programs show an explicit empty state. Past/invited/prospect records stay visible within their own program.
- Changing the class selector submits the GET form automatically. The fallback View program button remains. Search retains program/view, Clear retains scope, Show everyone exposes the full directory, and a new program selection returns to program scope.
- Programs (/admin/training, retaining existing navigation/routes) now lists class programs with dates, status, customer visibility, and People/Schedule/Program details links. Challenge management and personal-training clients have separate sections. Personal-training member selection opens the full directory.
- Settings honors the requested program and links its schedule correctly. People/Schedule selectors include all saved sessions, retaining the existing default preference for enrolling/active sessions. This keeps full, draft and past program links from silently opening another session.
- No database, memberships, prices, payments, email, or program configuration changed.

## Verification

- 115 automated tests passed, including actual rendered directory with synthetic people, switching programs, empty/search/all states, immediate selector submission, class-program links and selecting December settings.
- TypeScript passed. Changed-source ESLint passed with the existing clean dependency installation at /tmp/holden-challenge-clean-check (workspace dependency issues documented in earlier releases).
- Clean Vercel production build and TypeScript passed. Portal deployment dpl_2WfoGSt36KSEjpkTgQZPb54N6i6H is live at https://portal.holden.health, via the root npm run deploy:portal script and existing isolated Holden Health CLI config.
- Authenticated live browser verified December has 0 enrolled people, changing the selector automatically shows October’s 3 people, and Show everyone exposes all 15. Programs shows both class sessions with separate personal-training and challenge sections. December Program details opened the correct name/record. Desktop layout visually inspected. No settings saved, payments submitted, emails sent, or member records changed. Physical-phone/mobile layout testing was not performed.
