"use client";
export default function StoriesError({ reset }: { reset: () => void }) {
  return <main className="app-shell admin-shell workspace-page"><section className="panel"><h1>Stories couldn’t load just now.</h1><p>Your saved goals and recaps are still there. Please try again.</p><button className="button primary" onClick={reset}>Try again</button></section></main>;
}
