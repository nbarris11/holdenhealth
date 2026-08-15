# Supabase setup

The first migration defines the Focus on You application tables, roles, and Row Level Security policies.

Do not paste project secret keys or the database password into chat or commit them to the repository. The web application will use the project URL and publishable key in its public environment. Any secret key will only be configured in a protected server environment.

Before production:

1. Apply and inspect the migration through the project-scoped Supabase connection.
2. Create Kelsey's Auth user through an invite flow.
3. Add Kelsey's user ID to `staff_roles` as `admin` through a server-only administrative operation.
4. Test every member and administrator policy with separate test accounts.
5. Configure exact local, preview, and production Auth redirect URLs.
6. Require MFA for Kelsey's administrator account.
