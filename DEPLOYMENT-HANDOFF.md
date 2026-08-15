# GitHub and Vercel deployment state

## Live projects

- Public website: <https://holdenhealth-tau.vercel.app/> (`holdenhealth`)
- Secure portal: <https://portal.holden.health/> (`holdenhealth-portal`)
- GitHub repository: <https://github.com/nbarris11/holdenhealth>
- Portal Git root directory: `web-app`

The projects are intentionally separate. Do not change the public project's root directory to `web-app`.

## What to send next

Do not send passwords, private keys, recovery codes, or database credentials.

Send or confirm:

1. The GitHub repository URL, or the GitHub account/organization where a new private repository should be created.
2. Whether this existing folder should become the repository root. Recommended: yes.
3. The Vercel team/account name that should own the project.
4. Kelsey's preferred administrator email address.
5. The final production domain, if already purchased.
6. The site's five-digit ZIP code for the full Plymouth address.

## Recommended repository setup

- Use one private GitHub repository for the public site, portal application, and Supabase migrations.
- Protect the main branch once deployment is working.
- Use Vercel preview deployments for every non-main branch.
- Keep the current Netlify site live until the Vercel build passes production checks.

## Environment variables needed in Vercel

The exact values will be added directly to Vercel, not committed to GitHub:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Additional protected server variables will be added only if a later feature requires them. No Supabase secret key is needed in the browser.

## Authentication configuration

Supabase Auth uses `https://portal.holden.health/` as its Site URL and allows `https://portal.holden.health/**` as a redirect. Kelsey and Neil are verified and have database-backed administrator roles.

Remaining work:

1. Complete live magic-link sign-in and sign-out testing.
2. Enroll administrator MFA before member data is added.
3. Configure branded authentication email delivery with custom SMTP before launch.

## Launch rule

Do not point the production domain at Vercel until:

- public pages and SEO URLs are verified;
- member and administrator permissions are tested with separate accounts;
- invitation, sign-in, sign-out, and recovery work on mobile;
- the static Netlify deployment remains available as a rollback option.
