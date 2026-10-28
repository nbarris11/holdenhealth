# Privacy updates — September 11, 2026

User authorized implementing the privacy-review recommendations. Changes published using the required workspace-root deployment scripts.

## Changes

- Expanded privacy policy to cover website, portal, demo, sensitive intake/coaching information, provider access (including Google Forms and optional WhatsApp), retention criteria, device storage, and manual copy/correction/deletion requests.
- Disclosed historical LogRocket identification and recordings; disabled all new portal LogRocket initialization and events. SDK dependencies remain installed but are not imported by runtime source. No replacement replay tool or cookie banner was introduced. Session replay troubleshooting is no longer available in the new build. Previously opened pages may still run an older build until refreshed or closed.
- Allowed Privacy, Terms, and Health disclaimer through the preview-password gate. Sales pages remain private.
- Added shared legal links across portal routes, collection notices to login/group registration/online training/challenge signup, contact and booking notices, an intake privacy explanation separate from the exercise acknowledgment, and Account & support data-request guidance.
- Added basic portal/demo account-use terms and updated the terms revision date. Existing exercise acknowledgment, payment/attendance policies, signatures, authorization, and database records remain unchanged.
- Added [internal data-request and incident procedure](privacy-data-operations-2026-09-11.md). No automated purge, deletion/export endpoint, new consent record, or legal waiver was created.

## Deployment

- Portal: `dpl_7LRfda5W8fxvkgEMdy76PqrUSh1r`, READY, https://portal.holden.health. Deployment URL: https://holdenhealth-portal-jq7gq577k-holden-health.vercel.app.
- Website: `dpl_BPgcH22b2zyrGMeeMySzheunFmmV`, READY, https://holden.health. Deployment URL: https://holdenhealth-e8u4a0pe5-holden-health.vercel.app.
- Used root `npm run deploy:portal` and `npm run deploy:site`; neither Vercel Root Directory changed. Initial sandbox runs could not reach external DNS; network-enabled reruns completed. Connector deployment-list access returned 403, so CLI release results and public HTTP were used.

## Verification

- 12 website tests passed, including legal access with missing/password preview configuration and continued denial of other/private-lookalike paths.
- 20-page website SEO/link checks passed.
- All 33 existing portal tests passed; portal lint, production build/TypeScript, and Vercel production builds passed.
- No LogRocket imports remain in portal runtime source. Scanned all 32 local built browser JS chunks for the old app ID, SDK initialization marker, and known ingestion markers; none found.
- Anonymous live HTTP returned 200 and expected new text for Privacy, Terms, Health disclaimer, portal login, registration, online training, and demo. Homepage continued to render the preview gate.
- Scanned 10 browser chunks referenced by the checked live portal pages for replay identifiers; none found. This is source/bundle verification, not an instrumented browser network recording.
- No new authenticated member browser walkthrough or visual/mobile inspection performed. Account & support and intake changes were compile/source checked. No user forms submitted, payments made, member data accessed/deleted/exported, external messages sent, or vendor settings changed.
- Source backup at `/tmp/holden-before-privacy-20260911.tar.gz`; challenge form backup at `/tmp/holden-challenge-forms-before-privacy.tsx`. These are temporary backups, not durable version control.

## Outstanding business/vendor/legal work

Kelsey/account owner needs to review/delete historical LogRocket data as appropriate, inventory vendor retention and external-form access, approve a record-specific retention schedule, and obtain qualified advice on the service/participation agreement and applicable privacy/health-data rules. No assertion of HIPAA compliance, completed legal review, vendor-data cleanup, or full security audit is made.
