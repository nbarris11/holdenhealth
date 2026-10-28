import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <header className="landing-brand">
          <BrandLogo />
          <span>Member portal</span>
        </header>
        <div className="landing-grid">
          <div className="landing-intro">
            <span className="eyebrow">Focus on you</span>
            <h1>Your session, all in one place.</h1>
            <p className="lede">Find your workouts, track your habits, and message Kelsey whenever you need her.</p>
            <div className="landing-actions">
              <Link className="button secondary" href="/challenge">Join the free 14-day habit challenge</Link>
              <Link className="button primary" href="/login">Sign in to your portal</Link>
              <p>Explore <a href="https://holden.health/#programs">all coaching options</a>. New to Holden Health? <Link href="/register">Request a session place</Link></p>
            </div>
          </div>
          <aside className="landing-details">
            <span className="eyebrow">Inside your portal</span>
            <h2>Simple support between classes.</h2>
            <ul>
              <li><span aria-hidden="true">01</span> Your class schedule</li>
              <li><span aria-hidden="true">02</span> Weekly habits</li>
              <li><span aria-hidden="true">03</span> Notes and resources</li>
            </ul>
            <Link className="landing-drop-in" href="/drop-in">Session already started? Ask about joining late <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
