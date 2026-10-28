"use client";
export default function MemberError({ reset }: { reset: () => void }) {
  return (
    <main className="member-page">
      <section className="member-card">
        <h1>We couldn’t load that just now.</h1>
        <p>Your saved progress has not been removed. Please try again.</p>
        <button className="member-button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
