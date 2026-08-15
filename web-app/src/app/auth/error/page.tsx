import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">Sign-in link expired</span>
        <h1>Let’s get you a fresh link.</h1>
        <p className="lede">For your security, sign-in links only work once and expire after a short time.</p>
        <Link className="button primary" href="/login">Return to sign-in</Link>
      </section>
    </main>
  );
}
