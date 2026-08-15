# Holden Health

Holden Health currently has two connected pieces:

- A static public website in the repository root.
- A clickable member/admin portal prototype in `portal/`.

The production application backend is being built with Supabase. The future authenticated application will use Next.js and deploy through Vercel after the GitHub repository and Vercel project are connected.

## Current project status

- Public marketing pages: working locally; some pages still need to be aligned with the confirmed Focus on You group-session offer before the next production upload.
- Portal prototype: working locally at `/portal/index.html` and `/portal/admin.html`.
- Production application: scaffolded and build-tested in `/web-app` with Next.js, TypeScript, Supabase SSR, protected member/admin routes, and magic-link authentication.
- Supabase project: connected and healthy.
- Database: core tables, row-level security, administrator/member policies, and indexes are applied.
- December 2026 mini session: seeded with all nine confirmed one-hour meetings.
- Authentication foundation: implemented; production callback URLs, Kelsey's administrator account, and end-to-end email testing remain.
- GitHub: connected at `nbarris11/holdenhealth`.
- Vercel: connected to the Holden Health team and currently serving the static site from the repository root.

## Important folders

| Path | Purpose |
| --- | --- |
| `/index.html` and other root HTML files | Current public website source |
| `/assets/` | Logo and approved Kelsey/community photography |
| `/portal/` | Clickable member and admin prototype; not the secure production portal |
| `/web-app/` | Secure Next.js member/admin application under active development |
| `/supabase/migrations/` | Versioned production database schema and seed data |
| `/dist/` | Static Netlify upload build; update only after the public pages are internally consistent |

## Supabase migrations

Apply migrations in filename order:

1. `202608150001_focus_on_you_foundation.sql`
2. `202608150002_harden_functions_and_policies.sql`
3. `202608150003_seed_december_class_meetings.sql`

These migrations have already been applied to the Holden Health Supabase project.

## Security rules

- Never commit a Supabase secret/service-role key, database password, or member information.
- The browser application may use only the Supabase project URL and publishable key.
- All member records remain protected by database Row Level Security.
- Kelsey's administrator role must be created through a server-only operation.
- Require MFA on Kelsey's administrator account before launch.

## Local static preview

From `/Users/barris/Desktop/holden-health-site`, run:

```bash
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

## Next implementation steps

1. Add the Supabase project URL and publishable key to the Vercel project environments.
2. Configure Supabase local, preview, and production Auth redirect URLs.
3. Invite Kelsey's administrator account and require MFA.
4. Test sign-in, sign-out, invitation, and recovery with separate member/admin accounts.
5. Finish the member check-in and attendance workflows.
6. Build Kelsey's roster, payments, announcements, and content controls.
7. Migrate the public site into `/web-app` before switching Vercel's root directory.
