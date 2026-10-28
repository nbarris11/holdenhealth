# Admin review email login fix — September 12, 2026

User reported the registration notification’s Review the request button opened the member portal. The existing email correctly targets `/admin/people#requests`; `verifyAdmin` redirected authenticated accounts without an admin role to `/portal`. This code path explains the reported behavior, but the specific phone session/account was not inspected.

Changed that guard to show staff sign-in with a clear account mismatch explanation. Proxy forwards the requested path/query to the guard and preserves it for signed-out redirects. Admin sign-in carries a validated admin-only return destination through form submission, errors, and successful authentication. Existing staff-role enforcement remains; no account receives new permissions. Email links already sent remain valid. URL fragments are browser-side and are not included in the server request; the return page is preserved, but post-login scrolling to the request anchor is not guaranteed.

Verification: 55 portal tests passed, including five behavioral tests for role enforcement, wrong-password handling, destination preservation, spoofed return-header replacement, and unsafe return-URL rejection. ESLint and local production build/TypeScript passed. Tests use mocked auth clients, not Kelsey's session. No credentials, roles, member records, emails or payment records changed. No physical iPhone test performed.

Deployment: prescribed root `npm run deploy:portal`; completion and live checks recorded below.

Portal deployment `dpl_C8oqqaDNjbAehwriLaYPaucs7gn5` READY, aliased to https://portal.holden.health. Live anonymous review URL returned HTTP 307 to admin sign-in with original path/query preserved; sign-in returned HTTP 200 with matching hidden return field. Public website unchanged. No authenticated production walkthrough or runtime log scan claimed.
