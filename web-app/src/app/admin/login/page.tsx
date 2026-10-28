import { adminReturnPath } from "@/lib/admin-return";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { adminSignIn, requestAdminPasswordReset } from "./actions";

type AdminLoginPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const next = adminReturnPath(params.next);
  const error = typeof params.error === "string" ? params.error : "";
  const reset = typeof params.reset === "string" ? params.reset : "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <BrandLogo className="wordmark" href="https://holden.health" />
        <span className="eyebrow">Private business workspace</span>
        <h1>Welcome, Kelsey.</h1>
        <p className="lede">Sign in to manage your members, classes, messages, and website.</p>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        {reset ? <p className="notice success">Check {reset} for the secure password setup link.</p> : null}
        <form action={adminSignIn} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          <button className="button primary" type="submit">Sign in</button>
        </form>
        <details className="reset-details">
          <summary>Forgot or need to set your password?</summary>
          <form action={requestAdminPasswordReset} className="auth-form">
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" required />
            <button className="button secondary" type="submit">Email my secure setup link</button>
          </form>
        </details>
        <p className="fine-print"><Link href="https://holden.health">← Back to the Holden Health website</Link></p>
      </section>
    </main>
  );
}
