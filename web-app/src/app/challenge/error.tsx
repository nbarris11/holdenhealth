"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="panel">
        <h1>We couldn’t load your challenge.</h1>
        <p>Your saved progress has not been removed. Please try again.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
