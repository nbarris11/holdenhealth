import Link from 'next/link';
import { renewalData } from '@/lib/renewal-data';
import { isStripeConfigured } from '@/lib/stripe';
import { dateLabel } from '@/lib/challenge';
import RegistrationForm from '@/app/register/registration-form';
import { submitRenewal, resumeRenewal } from './actions';

export default async function RenewPage({searchParams}:{searchParams:Promise<{session?:string;message?:string}>}) {
  const params = await searchParams;
  const d = await renewalData(params.session);
  const s = d.session;
  const messages: Record<string,string> = {
    confirming: 'Stripe has received this checkout. We’re waiting for payment confirmation. Please don’t pay again; contact Kelsey if this status doesn’t update.',
    full: 'This session is full. Contact Kelsey about the waitlist or choose another session.',
    details: 'Please check your name and phone number.',
    attendance: 'Choose at least one class time.',
    policies: 'Please accept the payment and attendance policies.',
    plan: 'Please choose a two-day or three-day plan.',
    payment: 'Please choose a payment method.',
    'in-progress': 'Your registration status is shown below. Please don’t submit another payment.',
    unavailable: 'We couldn’t continue checkout. Please try again or contact Kelsey.',
  };
  return <main className="member-page">
    <span className="member-kicker">Keep going with your group</span>
    <h1>Join your next group session</h1>
    <p>Your new session stays in this account, alongside your past workouts and progress. You choose when to renew; there are no automatic charges.</p>
    {d.sessions.length > 1 && <form className="stack-form" method="get"><label>Group session<select name="session" defaultValue={s?.id}>{d.sessions.map(p=><option key={p.id} value={p.id}>{p.name} · {dateLabel(p.starts_on)}–{dateLabel(p.ends_on)}</option>)}</select></label><button className="member-button secondary">View this session</button></form>}
    {!s ? <section className="member-card"><h2>The next session is being prepared.</h2><p>Come back when Kelsey opens registration for the next group.</p></section> : <section className="member-card">
      <h2>{s.name}</h2><p><strong>{dateLabel(s.starts_on)}–{dateLabel(s.ends_on)}</strong></p><p>{s.description}</p>
      {s.two_day_price_cents && s.three_day_price_cents ? <p>2 days/week · ${s.two_day_price_cents / 100} &nbsp; · &nbsp; 3 days/week · ${s.three_day_price_cents / 100}</p> : <p>All classes package · New members ${s.new_member_price_cents / 100} · Returning members ${(s.returning_member_price_cents ?? s.new_member_price_cents) / 100}</p>}
      {params.message && <p className="notice" role="status">{messages[params.message] ?? messages.unavailable}</p>}
      {d.status === 'registered' ? <><h3>You’re registered for this session.</h3><p>Your membership details show any remaining payment or intake steps.</p><Link className="member-button secondary" href={d.enrollments.find(e=>e.session_id===s.id)?.id ? `/portal/session?enrollment=${d.enrollments.find(e=>e.session_id===s.id)!.id}` : "/portal/session"}>View my memberships</Link></> :
       d.status === 'processing' ? <><h3>Your payment is processing.</h3><p>You’ve already submitted payment for this session. Please don’t pay again. We’ll email you when it’s confirmed. If this has taken more than four business days, contact Kelsey so she can check it.</p></> :
       d.status === 'checkout' ? <><h3>Finish your payment</h3><p>You started checkout for this session. Continue securely with Stripe. If checkout has expired, we’ll return you here to choose your payment method again.</p><form action={resumeRenewal}><input type="hidden" name="sessionId" value={s.id}/><button className="member-button">Continue checkout</button></form></> :
       d.status === 'offline' ? <><h3>{d.request?.payment_method ? "Your place is reserved." : "Your request is with Kelsey."}</h3><p>{d.request?.payment_method ? `You chose ${d.request.payment_method}. Payment stays pending until Kelsey confirms it.` : 'Kelsey is reviewing your request. You don’t need to submit another one.'}</p>{d.request?.payment_method==='venmo' && <p><a className="member-button" href="https://venmo.com/u/holdenhealthllc" target="_blank" rel="noopener noreferrer">Open Venmo</a> Include your registration name in the payment note.</p>}</> :
       <><p>Confirm your contact details, plan and preferred class times below. Complete the private intake for your new session after payment; Kelsey reviews it before participation.</p><RegistrationForm key={s.id} sessionId={s.id} twoDayPriceCents={s.two_day_price_cents} threeDayPriceCents={s.three_day_price_cents} newMemberPriceCents={s.new_member_price_cents} returningMemberPriceCents={s.returning_member_price_cents} miniSession={!s.two_day_price_cents && !s.three_day_price_cents} classTimes={d.classTimes} includedClassCount={d.includedClassCount} onlineEnrollmentAvailable={isStripeConfigured() && s.starts_on > new Intl.DateTimeFormat("en-CA", {timeZone:"America/Detroit"}).format(new Date())} lateJoin={s.starts_on <= new Intl.DateTimeFormat("en-CA", {timeZone:"America/Detroit"}).format(new Date())} action={submitRenewal} defaults={{fullName:d.profile?.full_name??'',email:d.auth.email,phone:d.profile?.phone??'',weeklyCommitment:String(d.enrollments[0]?.weekly_commitment??'')}} lockEmail /></>}
    </section>}
    <div className="member-actions"><Link className="member-button secondary" href="/portal/workouts">Back to my workouts</Link><a className="member-text-link" href="mailto:HoldenHealth.Coaching@gmail.com">Contact Kelsey</a></div>
  </main>;
}
