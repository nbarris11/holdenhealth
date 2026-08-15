import Link from "next/link";
import { unsubscribeFromCommunications } from "./actions";

type UnsubscribePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const result = typeof params.result === "string" ? params.result : "";
  return <main className="auth-shell"><section className="auth-card"><Link className="wordmark" href="https://holden.health">Holden Health</Link>{result ? <><span className="eyebrow">Email preferences</span><h1>{result === "success" ? "You’re unsubscribed." : result === "already" ? "Your preference is already saved." : "That link is not valid."}</h1><p className="lede">{result === "success" ? "You will no longer receive member newsletters and portal communications. You can still contact Kelsey anytime." : "If you need help, email Holden Health directly."}</p><a className="button secondary" href="mailto:holdenhealth.coaching@gmail.com">Contact Holden Health</a></> : <><span className="eyebrow">Email preferences</span><h1>Stop member communications?</h1><p className="lede">This stops newsletters and portal updates from Holden Health. It does not cancel your session or membership.</p><form action={unsubscribeFromCommunications} className="auth-form"><input type="hidden" name="token" value={token} /><button className="button primary" type="submit">Yes, unsubscribe me</button></form><Link className="button secondary unsubscribe-cancel" href="https://holden.health">Keep my emails</Link></>}</section></main>;
}
