# Privacy and data operations — September 11, 2026

Owner: Holden Health LLC / Kelsey. This is an internal operating guide, not a legal opinion or proof of compliance. No retention purge, member deletion, vendor setting change, or customer message was performed by this release.

## Implemented in this release

- Expanded the public privacy policy to cover website, portal, demo, intake health details, emergency contacts, activity, coach notes, provider processing, Google Forms, optional WhatsApp participation, historical LogRocket use, storage, and manual data requests.
- Privacy, Terms, and Health disclaimer bypass the website preview-password gate. Other sales pages remain gated. Portal legal links and collection notices provide access without requiring a website preview password.
- Added Account & support guidance for copies, corrections, and account/data deletion. These remain requests handled by a person; no automated deletion or export feature was added.
- Disabled all portal LogRocket initialization and event collection. The SDK is no longer imported by runtime source. Packages remain in the lockfile to avoid unrelated dependency changes. Existing event components are inert compatibility wrappers. This removes session replay diagnostics as well as account identification. Existing open tabs running an older build may continue using that build until refreshed or closed.
- Preserved existing exercise acknowledgments, signatures, access controls, payment logic, and service policies. Added basic account/demo use guidance to website terms; no new liability waiver was invented.

## Handling a privacy request

1. Kelsey receives the request at HoldenHealth.Coaching@gmail.com. Track request date, requested action, verification status, applicable deadline, record categories, and final outcome in a restricted business record. Avoid copying health answers into that log.
2. Verify account ownership before disclosing or changing data. Prefer a verified session or existing account-channel confirmation. Do not rely only on a supplied email address or request passwords, full payment credentials, or routine ID scans.
3. Identify relevant records: Supabase profile/auth, contacts and email preferences, enrollment/payment references, intake/signature, attendance, workout logs/feedback, habits/check-ins, goals/wins/recaps (including drafts/snapshots), Gmail correspondence, Google Forms and any linked Sheets, Resend, payment providers, and older LogRocket sessions. Check actual relationships before making changes; an auth-account deletion alone is not evidence all copies are gone.
4. For access, provide a securely delivered copy of the requester’s records, excluding other people’s information and considering applicable exceptions. Do not email raw health-data exports as an ordinary attachment.
5. For correction, reconcile source records and derived snapshots. Published recaps are currently immutable in normal app use; escalate necessary corrections to a developer rather than promising the member they can edit everything.
6. For deletion, check obligations and legitimate holds first. Explain any retained payment, tax, signature, dispute, or other records and the basis for retention. Do not silently cancel paid services; confirm the separate membership request. Arrange targeted deletion/anonymization and vendor requests, revoke sessions when closing an account, then verify outcomes without damaging other members’ records.
7. Explain backup limitations and provider retention honestly. If backups are restored, reapply recorded deletions before returning restored data to ordinary use. Confirm completion or the remaining exceptions to the member through a verified channel.
8. Handle marketing unsubscribe separately from account deletion. Preserve only the minimum suppression information needed to honor an opt-out.

Follow deadlines required for the person’s applicable jurisdiction; this guide does not choose a universal legal deadline.

## Decisions and external follow-up still required

- **Historical LogRocket data:** account owner should review actual retention and delete historical sessions/identity traits as appropriate, or request deletion from LogRocket. Disabling collection does not delete them. Confirm handling of old recordings and any downloaded copies. Do not re-enable replay without revisiting purpose, data minimization, consent requirements, and actual masking across member and admin screens.
- **Retention schedule:** Kelsey and an adviser should approve periods for unconverted inquiries, inactive accounts/coaching/health records, signed acknowledgments, financial records, technical logs, vendor backups, and privacy request records. Financial and liability-related obligations may differ. Inventory actual vendor settings before publishing specific periods. The public policy currently describes criteria and exceptions, not an unverified automatic purge schedule.
- **External check-ins:** verify Google Form/Sheet owners and editors, restrict response access, remove public response summaries or sharing, and record which system holds each program’s check-in. The personal-training check-in URL remains unconfirmed. Avoid health details in email/text and group chats where possible.
- **Access/security:** review staff and vendor access, MFA for business/admin accounts, backup restoration practices, and previously documented database advisor findings. Those findings and live account settings were not audited or changed here.
- **Legal/business review:** have qualified counsel review the service/participation agreement, exercise acknowledgment, privacy policy, applicable state consumer-health rules, HIPAA status if relevant business relationships exist, and FTC Health Breach Notification Rule applicability. Existing acknowledgments are not a newly reviewed liability waiver. No HIPAA-compliance claim is made.

## If a privacy incident is suspected

Restrict the affected access or collection, preserve minimal evidence securely, record when it was discovered, and involve the owner, relevant provider, and qualified privacy/legal support promptly. Determine whose information was affected and which notifications/deadlines apply; an unauthorized disclosure to a service provider may matter even without an external hack. Send notifications only after the facts and applicable requirements are assessed. Do not erase evidence or paste member health details into ordinary issue trackers.

References checked September 11, 2026:
- https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0
- https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html

## Validation and release

Published to both production sites. See [release record and validation](privacy-release-2026-09-11.md). This change does not represent an authenticated member-data export/deletion test, live vendor retention audit, security audit, or attorney review.
