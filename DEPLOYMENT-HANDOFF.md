# GitHub and Vercel handoff

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

## Authentication configuration after the first Vercel preview

Once Vercel gives us a preview and production URL:

1. Add the local, preview, and production callback URLs to Supabase Auth.
2. Configure the branded invitation and password-recovery emails.
3. Invite Kelsey's administrator account.
4. Assign the `admin` role server-side.
5. Enroll MFA before granting production admin access.

## Launch rule

Do not point the production domain at Vercel until:

- public pages and SEO URLs are verified;
- member and administrator permissions are tested with separate accounts;
- invitation, sign-in, sign-out, and recovery work on mobile;
- the static Netlify deployment remains available as a rollback option.
