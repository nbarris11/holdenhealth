import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <span className="eyebrow">Holden Health · Focus on You</span>
        <h1>A more personal way to stay connected between classes.</h1>
        <p className="lede">Your schedule, weekly check-ins, Kelsey’s notes, and session resources—without another complicated fitness app.</p>
        <div className="button-row">
          <Link className="button primary" href="/login">Member sign-in</Link>
          <Link className="button secondary" href="/admin">Kelsey’s dashboard</Link>
        </div>
        <p className="fine-print">This is the private application currently being prepared for Holden Health members.</p>
      </section>
    </main>
  );
}
