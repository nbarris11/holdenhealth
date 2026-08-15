import Link from "next/link";
import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const sent = typeof params.sent === "string" ? params.sent : "";
  const next = typeof params.next === "string" ? params.next : "/portal";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/">Holden Health</Link>
        <span className="eyebrow">Member sign-in</span>
        <h1>Your session, all in one place.</h1>
        <p className="lede">Use the email Kelsey invited. We’ll send a secure sign-in link—no password to remember.</p>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        {sent ? <p className="notice success">Check {sent} for your sign-in link.</p> : null}
        <form action={requestMagicLink} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <button className="button primary" type="submit">Email me a sign-in link</button>
        </form>
        <p className="fine-print">Interested in a session? <Link href="/register">Request a place</Link>. Already spoke with Kelsey? <a href="mailto:HoldenHealth.Coaching@gmail.com">Contact Holden Health</a>.</p>
      </section>
    </main>
  );
}
