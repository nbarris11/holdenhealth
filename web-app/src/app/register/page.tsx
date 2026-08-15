import Link from "next/link";
import { submitRegistrationRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type RegisterPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id,name,description,starts_on,ends_on,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents,status").eq("published", true).in("status", ["enrolling", "active"]).order("starts_on").limit(1).maybeSingle();
  const hasWeeklyPlans = Boolean(session?.two_day_price_cents && session?.three_day_price_cents);

  return (
    <main className="auth-shell register-shell">
      <section className="auth-card register-card">
        <Link className="wordmark" href="/">Holden Health</Link>
        {sent ? <><span className="eyebrow">Request received</span><h1>You’re on Kelsey’s list.</h1><p className="lede">Kelsey will reach out to make sure the session fits what you need. After approval, you’ll receive a secure link to your member portal.</p><div className="button-row"><Link className="button secondary" href="https://holden.health">Return to Holden Health</Link></div></> : session ? <>
          <span className="eyebrow">Request a place</span><h1>Start with a real conversation.</h1><p className="lede">Tell Kelsey which session you’re interested in. This is a request, not a charge or automatic enrollment.</p>
          <div className="registration-session"><strong>{session.name}</strong><span>{hasWeeklyPlans ? `2 days/week $${(session.two_day_price_cents! / 100).toFixed(0)} · 3 days/week $${(session.three_day_price_cents! / 100).toFixed(0)}` : `New members $${(session.new_member_price_cents / 100).toFixed(0)} · Returning members $${((session.returning_member_price_cents ?? session.new_member_price_cents) / 100).toFixed(0)}`}</span><p>{session.description}</p></div>
          <form className="stack-form" action={submitRegistrationRequest}>
            <input type="hidden" name="sessionId" value={session.id} />
            <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <div className="field-grid"><label>Full name<input name="fullName" autoComplete="name" required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label>
            {hasWeeklyPlans ? <fieldset><legend>Choose your weekly commitment</legend><label className="check-label"><input name="weeklyCommitment" value="2" type="radio" required /> 2 days each week · ${(session.two_day_price_cents! / 100).toFixed(0)}</label><label className="check-label"><input name="weeklyCommitment" value="3" type="radio" required /> 3 days each week · ${(session.three_day_price_cents! / 100).toFixed(0)}</label></fieldset> : <><input type="hidden" name="weeklyCommitment" value="3" /><label className="check-label"><input name="returningMember" type="checkbox" /> I’ve completed a Holden Health paid session before</label></>}
            <fieldset><legend>Which class times could work for you?</legend><label className="check-label"><input name="attendance" value="Tuesday 6:00 AM" type="checkbox" /> Tuesday at 6:00 AM</label><label className="check-label"><input name="attendance" value="Wednesday 7:00 PM" type="checkbox" /> Wednesday at 7:00 PM</label><label className="check-label"><input name="attendance" value="Saturday 9:00 AM" type="checkbox" /> Saturday at 9:00 AM</label></fieldset>
            <label>Anything Kelsey should know before reaching out?<textarea name="note" /></label>
            <button className="button primary" type="submit">Send my session request</button>
          </form>
          <p className="fine-print">Already approved? <Link href="/login">Sign in to your member portal</Link>.</p>
        </> : <><span className="eyebrow">Session registration</span><h1>The next session is being prepared.</h1><p className="lede">Email Holden Health and Kelsey will let you know when registration opens.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com">Email Holden Health</a></>}
      </section>
    </main>
  );
}
