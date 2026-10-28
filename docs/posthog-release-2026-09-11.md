# PostHog and LogRocket — September 11, 2026

## Authorized scope

User requested PostHog Self-driving setup, complete LogRocket removal, replay only if free, and PostHog MCP for Codex. Explicitly approved saving GitHub access to `nbarris11/holdenhealth`. This supersedes the historical no-replay decision, while preserving privacy protections.

## Shipped behavior

- Removed LogRocket packages, component, remaining event usages, and release environment configuration. Historical LogRocket vendor records were not deleted.
- PostHog project 605056 (Holden Health / Default project), US region. Production portal only; static marketing pages do not initialize replay.
- Replay masks all text, inputs, and element attributes; blocks images, media, canvas, and embedded content. Console/network bodies/headers and raw error capture are disabled. Network callback discards requests/URLs. No automatic pageviews, autocapture, or member identity calls. Browser IDs use session storage. The user subsequently approved linking signed-in recordings to account IDs and saved names (see follow-up below). Surveys and support conversations disabled in client.
- Server operational events use hashed IDs and an explicit property allowlist. Submitted messages, health text, names/emails and raw exceptions are excluded. Capture occurs after responses, with failures swallowed so provider outages do not break member actions.
- Public privacy policy documents PostHog and retains historical LogRocket disclosure. Production PostHog ingestion configuration uploaded to portal Vercel environment; local example has blank token.
- Account billing UI confirmed free plan, 5,000 web recordings/month, 30-day replay retention. No card or paid upgrade added. Free plan stops at limits; current pricing: https://posthog.com/pricing . Self-driving has a separate free allowance of three PRs; paid PRs are $15 each after upgrading.

## Connections

Existing GitHub PostHog app installation 123678240 now includes `nbarris11/holdenhealth`, preserving existing `nbarris11/mittenmakes-site`. Connected to Default project. Local workspace is not a Git checkout. Remote HEAD at inspection: `214f91cc23e7a07023b6cffd55bed0ea580f1ee4`; remote portal source is substantially behind local deployment. Do not assume generated fixes target current code until repository is deliberately synchronized. No source push or merge performed.

Codex global MCP `posthog` installed at `https://mcp.posthog.com/mcp` using bundled Codex CLI and OAuth successfully authenticated. Tools may require a fresh task/app reload to appear. The PostHog MCP wizard lacked a Codex option, so it was canceled without installing other editor integrations.

## Verification

42 existing portal tests and three new meaningful PostHog privacy/failure-isolation tests passed. Lint/build passed; website checks passed. Live portal scripts contained PostHog privacy settings and no LogRocket; public policy update confirmed live.

Synthetic registration interaction (no submission/payment) produced replay `01a091fe-5ffb-707b-9366-8abb8264361b`. Inspected processed player DOM: page text, links, name and email input values were masked with asterisks. No real member saves or payment flows retested. Brief login navigation redirected through existing authentication and was closed; no member data mutation.

Wizard initially generated broader capture defaults and later re-enabled raw browser errors during Self-driving setup. Restored `capture_exceptions: false`; regression tests passed. Preserve the hardened source over generic wizard reports/defaults.

Dashboard: https://us.posthog.com/project/605056/dashboard/2088008
Replay: https://us.posthog.com/project/605056/replay/home
Wizard notebook: https://us.posthog.com/project/605056/notebooks/MnOEUhTg

Public deployment: `dpl_6A4MTvxeVdvoaZnCQGkHuYwPudrZ`, READY at https://holden.health . Final portal deployment and Self-driving outcome recorded below after completion.

## Named member replay follow-up

User explicitly requested and approved member identification. Root client observer verifies the signed-in user through Supabase `getUser`, selects only their own `profiles.full_name` under existing RLS, and identifies `member:<account-id>` with the `name` property. Name refreshed on navigation, auth changes and window focus. No email or health content is passed. Prior named identity resets before switching accounts or after signed-out verification. Stale asynchronous profile results are discarded. `person_profiles: identified_only` permits named profiles; replay masks remain unchanged. Public policy updated accordingly. Historical anonymous recordings are not guaranteed to link retroactively. Server counters remain pseudonymous.

46 portal tests including identity update/account-switch/logout regression coverage passed (45 suite tests plus final new identity test), lint and production build passed. Nine website tests and SEO checks passed. No database schema or real member profile changes.

Self-driving configured three scouts (general, product analytics, revenue), with 100 runs/day early-access allowance. Optional issue integrations and custom scouts skipped. Replay Vision scanners were not created because the wizard lacked required briefs. Wizard report generated, then wizard stopped to prevent repeated re-enabling of raw error capture; final source keeps it disabled. Its generic claims about browser errors/anonymous identity are superseded by this release record. GitHub sync remains outstanding.

## Final deployments and live checks

Portal `dpl_AW2baNzeowH3RQxewcEW5usJrCwm` READY at https://portal.holden.health . Website `dpl_HHz3rK7KGm1EYYUx8RiTQ3WyvG6G` READY at https://holden.health . Both deployed through required root npm scripts. Live bundles confirmed member identification, identified-only profiles, replay masking, raw errors disabled and no LogRocket; named-replay policy verified live. Signed-in Account & support loaded without mutation. PostHog dashboard session had signed out, so a named profile was not verified in its UI; previous masked replay playback was verified before the name change. No fresh signup, live sign-out, payment or member-save test performed.

## Public website replay enabled

User explained their missing recording was a visit to holden.health and explicitly requested public website replay too. Added `posthog-public.js` through the shared `site.js`, using the existing public ingestion token/project. Production canonical hosts only; localhost, Vercel previews, and embedded/editor previews excluded. Anonymous session-storage identity, same total masking and no network/console/raw error capture. Public privacy disclosure updated. Public and portal anonymous identities are not explicitly stitched across origins.

Website deployment `dpl_F9eLg4muJd1GdPJYR9yT9j7xJXBy` READY via root deploy:site. Existing nine site tests/SEO checks and two new privacy/production-gating tests passed. Live browser confirmed SDK and recorder load and recording starts with text masking. Portal deployment unchanged.

Public live ingestion verification: browser SDK/recorder loaded, recording started, and both event `/i/v0/e/` and replay `/s/` POSTs returned HTTP 200. Automated Chromium was initially excluded by PostHog's bot check (`navigator.webdriver` / browser brands); test-only navigator markers were changed in the isolated verification browser to simulate a human visitor. Production bot filtering was not changed. Test session `01a0920f-6b61-7698-baf4-fefe519e8f66`. PostHog dashboard playback of this public session not checked because dashboard authentication remains unavailable. Verification browser closed.

## User-authorized password-only visibility

User explicitly requested nothing masked except passwords after viewing the fully masked recording. This supersedes all earlier total-masking requirements. Updated public and portal replay config: maskAllInputs false, maskTextSelector null, maskAllElementAttributes false, maskInputOptions password true. Blocking limited to password type/name/ID/autocomplete selectors, including show-password fields. Ordinary images/content/form entries now record. Console/network capture remains off. Privacy policy explicitly discloses that recordings may include member messages and health/coaching information. Project UI changed from Total privacy to Free love (mask only passwords) and save confirmed. Existing masked recordings cannot be unmasked.

Six targeted identity/replay tests, 11 website tests, SEO checks, portal lint/build passed. Final deployment and live verification below.

Password-only deployments: website `dpl_2qFJ5EhaPpyw67bBMTDhWxiLxVVw` and portal `dpl_5w5AWpFxxrVYJdyMTvFdSxd6FiRi` READY. Live portal bundles and policy verified. Project CDN config confirmed masking `{maskAllInputs:false}`. Isolated live public browser with synthetic DOM fixture used the loaded rrweb recorder and deployed config: ordinary text/input values present in snapshot; password and revealed-password values absent. Fixture removed and browser closed. No real member data altered; no new processed dashboard playback claimed.

## Web Analytics zero-count correction

User reported recordings existed while Web Analytics remained at zero. Root cause: both SDK initializations explicitly disabled pageview/pageleave events and denied URL/path properties. Enabled `capture_pageview: history_change` and pageleave on both sites; restored path/referrer/URL properties with before_send stripping query strings/fragments (including portal initial person URL properties). Password-only replay behavior unchanged. This supersedes earlier no-pageview setup notes. Six targeted tests, 11 site tests/SEO checks, portal lint/build passed. Dashboard confirmed correct project, Today, All domains, test filtering off and zero before deployment.

Web Analytics deployments: website `dpl_4NQZMC1REqSr1UsNUUw4j8EDTMKj` and portal `dpl_3g5EtJpsQqLsXTsxb9UrYUxApMDb` READY. Live public SDK verified history-change pageviews/pageleave enabled and URL cleanup strips synthetic token. Chrome homepage → About → Resources navigation generated test traffic; dashboard began showing one recently-online visitor and one session. Final displayed counts recorded below. No historic pageview backfill.

Confirmed in signed-in Web Analytics Live UI: two processed pageviews, top paths `/` and `/about.html`; live events then showed Pageview for `/resources.html` and Pageleave for `/about.html`, with clean full URLs. Verification succeeded end-to-end. Test site tab closed; user's PostHog tab left on Live.

## September 12: repair missing member names

User requested names on all future identified account recordings. Exact supplied session 01a0965d-2f15-7900-8460-a816d88d2688 was already linked to a verified member ID but its PostHog name property was empty. Database inspection showed some accounts store their name only in challenge_participants.display_name, while Ahmad now has profiles.full_name too. Existing observer was writing an empty name when profile was blank and only refreshing on route/auth/focus changes.

Observer now falls back from profiles.full_name to the account's latest challenge display_name using existing own-row access. Visible sessions refresh every 60 seconds so same-path signup/profile changes are picked up. Identity helper trims names and never sends empty names that overwrite existing known names. Account-switch/logout reset and stale response guards retained. No emails, additional identity fields, schema or account changes. Anonymous public website traffic remains anonymous unless already associated through existing identification; no cross-origin identity stitching added.

Updated PostHog name property on three exact account-matched existing persons using verified saved names; fourth already named. One account has no profile or challenge name and was left unidentified by name. The originally supplied recording now resolves to Ahmad Malik in session-recording-get. No guessed matching or manual identity merges.

Six targeted PostHog tests passed including blank-name protection, challenge fallback, same-path refresh, profile-name priority, account-switch/logout, privacy and analytics failure isolation. Lint and local production build/TypeScript passed. Transactional read under authenticated member role confirmed challenge name access; no database writes committed. No new real account signup or browser sign-in performed. Deployment below.

Portal dpl_DqXH6TvHY5DTJvFAbAJtRa1Xf5pa READY via root deploy script. Live login bundles verified updated identity fallback/visible-session refresh. API read confirmed Ahmad Malik, KEG and Neil Barris display labels. PostHog's property-set ingestion also changed those persons' latest geo-IP country from US to SE (connector-side enrichment); recording locations must be assessed from original session events, not that latest person property. No recording data was edited. No fresh authenticated browser sync claimed.
