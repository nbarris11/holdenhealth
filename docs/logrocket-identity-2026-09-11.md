# LogRocket account labels — September 11, 2026

## Follow-up: automatic identification for all members (deployed)

The user requested automatic identification for anyone creating an account. Local code now allows only account ID, email, available auth metadata name, and internalTeam status into LogRocket identify calls. Team name overrides remain. Initial claims and subsequent sign-in/auth updates are covered, repeated identical calls are suppressed, and newer auth events take precedence over a stale initial claims response. No database changes or real-member testing occurred.

Mocked SDK/auth checks passed for new/returning members, team labels, absent/malformed names, OAuth names, email updates, duplicate events, sign-out, stale claims, auth errors, and excluding unrelated metadata. ESLint and the local production build passed.

The first production deployment attempt was rejected by automatic approval review because exporting every member's private name/email to LogRocket needed specific authorization. The user subsequently explicitly approved: "that is fine, their name and email can be shared with logrocket". This integration labels sessions and does not send messages to members.

Released via root `npm run deploy:portal`: `dpl_9gxyu9RTte6hM7ydhKEiGEXt7PCe`, READY at https://portal.holden.health. Vercel production build passed. Live demo HTTP 200 and deployed JavaScript verified the email/name allowlist, team trait, and both initial-claims and auth-event identification paths. The deployment error-log query returned no logs. The first script assertion incorrectly expected an unminified variable name; corrected inspection confirmed the actual minified implementation. No live new-member account was created, and dashboard appearance was not independently verified. Labels begin at authenticated visits, not merely when an unused account record is created.

## Released team labels

User requested that LogRocket recognize Neil and Kelsey. Read-only Supabase verification matched the existing portal accounts to nbarris11@gmail.com and keholde@gmail.com; both profile names were blank.

Updated `web-app/src/instrumentation-client.ts` to add `name` and `internalTeam: true` traits for exactly those two verified, immutable account IDs. Labels are Neil Barris and Kelsey Holden. These labels are analytics only and must never be used for authorization. Other members remain ID-only. No emails, member profiles, or health data were added to tracking; masking, disabled network/console recording, authentication, and database records are unchanged.

Verification: mocked SDK/auth execution confirmed both named identities on initial claims and sign-in events, ID-only ordinary members, and no identify call for anonymous/sign-out events. ESLint and local production build passed. Production deployment `dpl_DxJp7McTFUgNTZDVjGrX8rdRZoYX` READY at https://portal.holden.health via root `npm run deploy:portal`. Live demo returned HTTP 200, rendered in Chrome, and deployed scripts contained both ID/name mappings and the internalTeam trait. Deployment error-log query returned no logs; this is a limited observation, not proof of error-free runtime behavior.

Each account receives its label on its next authenticated page load or auth event. Kelsey's actual browser session and the LogRocket dashboard were not verified; do not claim both labels were observed inside the dashboard. Earlier in the task, the live SDK and collection request returned HTTP 200 for this project's ingestion endpoint.
