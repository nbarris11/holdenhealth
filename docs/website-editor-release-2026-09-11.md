# Website content editor — September 11, 2026

User requested a general solution after a linked FAQ paragraph could not be selected, and explicitly requested production deployment. Future static content should be detected automatically, without individual HTML fixes.

## Changes

- Shared `site.js` automatically gives mixed-content text nodes editable inline surfaces, preserving embedded links, formatting, spacing, existing element types, and listeners. Uses a custom inline tag to avoid changing existing span/link `nth-of-type` selectors.
- Content inventory in the portal includes text, headings, footer copy, buttons, links, images, labels, option text, and input/textarea placeholders. Search can select content in hidden/closed sections. Custom sections keep their existing dedicated editor; the shared header retains its own controls.
- Explore mode allows reaching interactive steps/accordions. Mutating fetch requests and form submissions are blocked only inside editor previews; customer behavior outside previews is preserved. Same-site navigation retains editor mode; external links cannot leave the preview in Explore mode.
- New selectors include original-content fingerprints so different dynamically rendered steps at the same DOM location do not share edits. A MutationObserver discovers new content and reapplies corresponding saved overrides. Legacy selector lookup remains supported by the admin controls.
- Added placeholder support to the existing publication payload, expanded per-page override limits to 1,000 (500,000-character submitted JSON limit), added the missing 404 page to the editor, and cache-busted the shared script on public pages.
- Shared header fields now include brand name/tagline/logo URL/destination, personal-training link, all-resources label, and the consultation button used on training pages.

## Verification

- Browser regression harness at `tests/browser/website-editor.html` independently walks text nodes and clicks every inventoried item across **24 pages, 1,646 text parts**. Passed.
- Actual browser checks passed for new mixed text, retained link identity and whitespace, preview/reset, dynamic state isolation and reapplication, placeholder edit/reset, and rejection of preview POST requests. Transport is captured in an isolated same-origin local harness; production `site.js` is unchanged in that test.
- Customer coaching page fits at 390px and homepage at 320px, with no horizontal overflow. Coaching FAQ mobile screenshot visually reviewed.
- Website SEO validation (20 sitemap pages) and 12 tests, portal lint, TypeScript/production build, and 33 portal tests passed.
- No real customer forms, bookings, content publications, or member records were submitted during tests. No database migration or dependency added. No authenticated production content save is claimed. CSS-only decorative shapes and application/business logic remain code; this change makes customer-facing content editable, not arbitrary program behavior.

## Deployment

Public site deployed using root `npm run deploy:site`: `dpl_CbYKhdjGbAdqm4psjKZRqUD6KeAe`, READY, https://holden.health. Portal deployment recorded below after completion. Existing preview access protection retained. User must save any unpublished content before refreshing the editor.

Portal deployed using root `npm run deploy:portal`: `dpl_tcpPTk9QpKWS8GZddSSSUnGb4bT9`, READY, https://portal.holden.health. The live website script was downloaded and compared byte-for-byte with the tested local `site.js`; it matches.
