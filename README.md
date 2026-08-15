# Holden Health

Holden Health has two production pieces:

- A static public website in the repository root, live at <https://holdenhealth-tau.vercel.app/>.
- A secure Next.js member/admin portal in `web-app/`, live at <https://holdenhealth-portal.vercel.app/>.

Supabase provides authentication and the protected application data. Vercel deploys the public site and portal as separate projects so portal work cannot replace the marketing site.

## Current project status

- Public marketing pages: working locally; some pages still need to be aligned with the confirmed Focus on You group-session offer before the next production upload.
- Portal prototype: retained locally at `/portal/index.html` and `/portal/admin.html` for reference only.
- Production application: deployed from `/web-app` with Next.js, TypeScript, Supabase SSR, protected member/admin routes, and magic-link authentication.
- Supabase project: connected and healthy.
- Database: core tables, row-level security, administrator/member policies, and indexes are applied.
- December 2026 mini session: seeded with all nine confirmed one-hour meetings.
- Authentication: production callback URLs are configured. Kelsey and Neil are verified administrators. A final live magic-link sign-in test and administrator MFA enrollment remain.
- GitHub: connected at `nbarris11/holdenhealth`.
- Vercel public project: `holdenhealth`, serving the static repository root.
- Vercel portal project: `holdenhealth-portal`, Git-connected with `web-app` as its root directory.

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

1. Test live magic-link sign-in and sign-out with both administrator accounts.
2. Require MFA for administrator access before member data is added.
3. Test a separate non-admin member account and confirm it cannot open `/admin`.
4. Finish the member check-in and attendance workflows.
5. Build Kelsey's roster, payments, announcements, and content controls.
6. Add a branded portal domain and custom SMTP before inviting paying members.
