import Link from "next/link";
import { updateAdminPassword } from "../login/actions";
import { verifyAdmin } from "@/lib/auth";

type SetPasswordPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SetAdminPasswordPage({ searchParams }: SetPasswordPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="https://holden.health">Holden Health</Link>
        <span className="eyebrow">Admin security</span>
        <h1>Choose your admin password.</h1>
        <p className="lede">Use at least 12 characters and a password you do not use anywhere else.</p>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <form action={updateAdminPassword} className="auth-form">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required />
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} required />
          <button className="button primary" type="submit">Save password and open admin</button>
        </form>
      </section>
    </main>
  );
}
