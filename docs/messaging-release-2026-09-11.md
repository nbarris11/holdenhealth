# Member messaging — September 11, 2026

## Delivered

- Member `/portal/communicate` and coach `/admin/communicate` inboxes. Member top bar and Account & support link to Communicate; coach navigation preserves Email separately.
- One room per class program (`sessions`) or habit challenge. Rooms follow program names automatically. Class access requires active/completed enrollment; withdrawn/invited-only members cannot read. Challenge access requires participation. Ended/cancelled programs are read-only; a full program remains writable for active members. Personal-training members use private coaching messages.
- Private conversations are scoped to the member and authorized admin coaching accounts. No member-to-member DMs. Coach search can start a private thread; a member can start their own thread with Kelsey.
- Text up to 4,000 characters; sender identity and timestamps set by the database. Twenty messages per minute per sender. Retry UUID prevents duplicate sends. Messages refresh every five seconds while the open page is visible, not via WebSockets. Inbox refreshes every 15 seconds; member header unread count every 30 seconds.
- Fifty-message history pages, pinned messages, unread counts, per-conversation muting, coach removal (replaces text), and close/reopen controls. Members retain draft text in component memory on send failure; no message text is cached in browser storage.
- Optional Web Push with a manifest, standalone mode and `/chat-sw.js`. Notification previews contain no sender, program, or message text. Tapping opens the conversation behind authentication. Subscriptions are device-specific, stored server-side, and disconnected on app sign-out using an HTTP-only device cookie.
- `web-push@3.6.7` and `@types/web-push@3.6.4` added. App-specific VAPID keys configured in the existing verified Holden Health Vercel portal project; the private key stays server-side.
- Durable push jobs drain after sending and inbox reads. Failed attempts retry after five minutes on subsequent app activity, up to five attempts. This is best-effort delivery, not a scheduled continuous worker. Browser/OS settings also affect delivery. Expired endpoints are removed. Real device delivery is not yet verified.

## Membership benefit copy

Homepage enrollment/app benefits, group fitness pricing and a new Included with your membership section, online training package/support benefits, nutrition-program benefits, group registration, and online checkout now describe included messaging. Group copy mentions a shared program chat across class times; individual training copy emphasizes private messages to Kelsey. Existing editor auto-detection remains intact. No managed-content records were overwritten.

## Database and security

Applied migrations (local filenames match remote history):

- `20260911182003_member_messaging.sql`
- `20260911182908_chat_program_status.sql`

Five new tables: conversations, messages, preferences, push subscriptions, and push jobs. RLS and explicit grants protect exposed tables. Sender/timestamp/rate-limit checks run in private triggers; private access helpers check authenticated identity and enrollment. Public inbox RPC is SECURITY INVOKER. Push tables intentionally have no client grants or policies: only server credentials access them. Endpoint validation restricts push destinations to supported browser providers and rejects private-network/attacker URLs. API writes require same-origin requests and verified authentication.

Advisor reports expected informational notices for the two server-only push tables. Other warnings predate this change. Dependency audit identified pre-existing Next.js 16.3.1 and Sharp advisories; no advisory was reported for the new push dependency. Framework/security patch upgrades are a follow-up, not silently bundled into this release.

## Verification

- 35 portal unit tests passed, including endpoint/identifier validation; ESLint and production build/TypeScript passed.
- Website SEO checker passed for 20 pages and all 12 website tests passed at the messaging-copy check. The separate live-launch task owns any subsequent website changes/checks.
- `supabase/tests/member-messaging.sql` passed transactionally: own reads/writes, cross-member and anonymous denial, sender/time spoofing rejection, private coach reply, moderation, preferences/read-cursor clamping, closed/ended room protection, and withdrawn membership denial. Test rows rolled back.
- Built portal tested locally through authenticated HTTP using three disposable accounts and one program. Passed group/private send, coach reply, retry deduplication, cross-member denial, unread/read state, mute preservation, pin/remove/close, CSRF and anonymous denial, rendered member/admin pages, manifest and service-worker delivery. Push dispatch was explicitly disabled. Local server credentials were unavailable, so the test pre-created the private room and did not exercise the service-credential-dependent start-conversation or subscription registration endpoints. Those paths remain a verification limit.
- All synthetic accounts, sessions, messages and program removed and exact IDs verified absent. No fixture retained for review. Early synthetic auth setup failures were fixture issues (missing identity/timestamps), resolved before the passing walkthrough. No email or real-member message sent.
- No visual browser walkthrough, physical iPhone/Android push-delivery test, or end-to-end notification subscription test is claimed. Phone CSS includes a wrapping header and one-conversation mobile view; physical-device verification remains needed.

## Deployment coordination

Messaging portal deployment `dpl_5No5bagfADSVtPre9moD1VC5r5Mi` reached READY. The live-launch task subsequently deployed the shared portal source as `dpl_AdziBWMucDiXpy2LNdUfeymJeFUj` and owns the final alias consolidation. Messaging website deployment `dpl_7y9mDVeBWdgCrRHnWAESwxa6uLbm` reached READY; the live-launch task is consolidating the final website deployment. See `docs/live-launch-2026-09-11.md` for the latest launch state. Preserve the removal of preview gating and retirement of `/demo`; do not restore demos or retained test accounts.

Only the prescribed root deploy scripts were used. Vercel project Root Directories were not changed.

## Follow-up: live/browser testing and phone fixes

User explicitly requested testing. Completed September 11.

- Production API walkthrough passed, now including member and coach start-conversation endpoints, group/private send/reply, duplicate retry, cross-member isolation, unread/read state, mute preservation, moderation, CSRF and anonymous denial.
- Browser testing found the bottom navigation covered Send at 390×844. Fixed with a full-screen mobile conversation, Back button, safe-area padding, and VisualViewport height/offset handling for keyboard space.
- Fixed scrolling after React commits messages: initial load and sends now show the latest message, while earlier-history loading preserves position.
- Moved notification permission before asynchronous worker registration to preserve Safari's direct-user-interaction requirement.
- Final portal deployment `dpl_9EdEHytwho3WJvCQcjmA8LTktSoV` READY at https://portal.holden.health, via required root script. Website launch changes preserved; no website deployment this turn.
- Two isolated authenticated browsers exchanged a private message and reply through actual UI buttons. Final refresh showed newest message with scroll gap 0. At 390×844 and 320×568 there was no horizontal overflow and Send was hit-test reachable. A 390×400 viewport also kept Send reachable; this simulates keyboard space, not a physical keyboard.
- Offline send retained the draft; restoring connectivity and sending saved exactly one message and cleared the draft.
- Notification-denied state showed instructions. Enable/disable used browser test doubles for permission/subscription generation against the real production registration/removal API and actual service worker. Enable showed on, disable showed off, and database check confirmed test subscription removal. Recorded call order: permission before register. Actual Apple/Google delivery is NOT verified; automated browser native permission remained denied.
- 35 unit tests, ESLint, TypeScript and local/production builds passed. Final member/coach browser error checks returned no uncaught page errors.
- Temporary sessions revoked; three test users, their messages/conversations, test program and notification subscription removed. Exact-ID checks returned zero. A real coach added short testing messages in the temporary rooms during verification; those disappeared with the test rooms. Real program conversations, welcome message and closed/open choices were preserved.
- Screenshots: `docs/messaging-verification/phone-390-final.png` and `phone-320-final.png`. Temporary auth files and setup helper deleted; isolated browsers closed.

Remaining: physical iPhone/Android notification delivery and returning from a locked/background phone need a device test.
