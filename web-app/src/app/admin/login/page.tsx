import Link from "next/link";
import { adminSignIn, requestAdminPasswordReset } from "./actions";

type AdminLoginPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const reset = typeof params.reset === "string" ? params.reset : "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="https://holden.health">Holden Health</Link>
        <span className="eyebrow">Private admin sign-in</span>
        <h1>Run Focus on You.</h1>
        <p className="lede">For Holden Health administrators only. Members use the regular member sign-in.</p>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        {reset ? <p className="notice success">Check {reset} for the secure password setup link.</p> : null}
        <form action={adminSignIn} className="auth-form">
          <label htmlFor="admin-email">Admin email</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          <button className="button primary" type="submit">Sign in to admin</button>
        </form>
        <details className="reset-details">
          <summary>Set or reset your admin password</summary>
          <form action={requestAdminPasswordReset} className="auth-form">
            <label htmlFor="reset-email">Admin email</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" required />
            <button className="button secondary" type="submit">Email my secure setup link</button>
          </form>
        </details>
        <p className="fine-print">Are you a member? <Link href="/login">Use member sign-in</Link>.</p>
      </section>
    </main>
  );
}
