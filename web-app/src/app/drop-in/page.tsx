import Link from "next/link";
export default function DropInPage() {
  return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">Joining after the start?</span><h1>Talk with Kelsey about the remaining session.</h1><p className="lede">There are no drop-in classes currently. If the six-week session has already started, Kelsey will check for space and prorate the price if you can join.</p><div className="button-row"><a className="button primary" href="https://holden.health/contact.html">Ask about joining late</a><Link className="button secondary" href="https://holden.health/coaching.html">See the six-week program</Link></div></section></main>;
}
