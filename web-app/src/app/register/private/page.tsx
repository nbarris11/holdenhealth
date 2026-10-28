import { classConfirmationLine } from '@/lib/private-class-times';
import type { Metadata } from 'next';
import BrandLogo from '@/components/brand-logo';
import PrivacyNotice from '@/components/privacy-notice';
import { getPrivateSignup } from '@/lib/private-signup';
import { payPrivateSignup } from './actions';
import PrivateSubmit from './submit';
export const dynamic='force-dynamic';
export const metadata: Metadata={title:'Your private signup | Holden Health',robots:{index:false,follow:false},referrer:'no-referrer'};
const messages: Record<string,string>={unavailable:'We couldn’t open payment. Please try again or contact Kelsey. If you already submitted payment, please don’t pay again.',submitted:'Your payment has been submitted. We’re waiting for confirmation; please don’t pay again.',payment:'Choose card or bank payment.',details:'Please enter a valid phone number.',consent:'Please confirm the safety and payment policies before continuing.',full:'This program is currently full. Please contact Kelsey.', 'in-progress':'You already have a signup or payment in progress, or this offer is no longer available. Contact Kelsey before paying again.'};
export default async function PrivateSignupPage({searchParams}:{searchParams:Promise<{token?:string;message?:string}>}) {
  const {token='',message}=await searchParams;
  const data=await getPrivateSignup(token);
  const blocked=data?.order && ['paid','payment_processing'].includes(data.order.status);
  return <main className="auth-shell register-shell"><section className="auth-card register-card">
    <BrandLogo className="wordmark" href="https://holden.health"/>
    {!data ? <><h1>This signup link is unavailable.</h1><p>It may have expired. Contact Kelsey for help with your private signup.</p></> : <>
      <span className="eyebrow">Arranged with Kelsey</span><h1>Your once-a-week plan</h1>
      <p>Hi {data.offer.full_name.split(/\s+/)[0]}. Review your plan and complete your one-time session payment.</p>
      <div className="registration-session"><strong>{data.session.name}</strong><p>{data.session.starts_on}–{data.session.ends_on}</p><p><strong>1 class per week · {data.offer.attendance_time}</strong> (Eastern time)</p><p>Session price: ${(data.offer.amount_cents/100).toFixed(2)}<br/>Online payment fee: $4.00<br/><strong>Total: ${((data.offer.amount_cents+400)/100).toFixed(2)}</strong></p></div>
      <details className="soft-note"><summary>Your scheduled classes</summary><ul>{data.meetings.map(meeting=><li key={meeting.id}>{classConfirmationLine(meeting)}{meeting.cancelled ? " · Cancelled" : ""}</li>)}</ul><p>Contact Kelsey about any schedule changes or makeups.</p></details>
      <p>Full Holden Health app access is included. This payment covers this session only; there is no automatic renewal. Your place is confirmed after payment, with intake review before participation. Arrange any class changes or makeups with Kelsey.</p>
      {message && <p className="notice" role="status">{messages[message]??messages.unavailable}</p>}
      {blocked ? <div className="soft-note"><h2>{data.order!.status==='paid'?'Your payment is confirmed.':'Your payment is processing.'}</h2><p>Check your email for next steps. You don’t need to pay again.</p></div> : <form action={payPrivateSignup} className="stack-form">
        <input type="hidden" name="token" value={token}/>
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        {data.order?.status==='reserved' && data.order.stripe_checkout_session_id ? <><p>You have a checkout in progress. Continue to finish it. If it has expired, return here and choose your payment method again.</p><PrivateSubmit label="Continue my checkout"/></> : <>
        <p>Your signup and portal access will be sent to the email you arranged with Kelsey. Contact her before paying if that needs to change.</p>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" minLength={7} maxLength={40} required/></label>
        <label>Payment method<select name="paymentMethod" required defaultValue=""><option value="">Choose a payment method</option><option value="card">Card / Apple Pay</option><option value="ach">Bank payment (ACH)</option></select></label>
        <fieldset><legend>Quick safety check</legend><p>If you cannot confirm these, contact Kelsey before paying.</p><label className="check-label"><input type="checkbox" name="adultConfirmed" required/>I confirm that I am at least 18 years old.</label><label className="check-label"><input type="checkbox" name="exerciseClearanceConfirmed" required/>A healthcare professional has not told me to avoid exercise or use precautions that I have not discussed with Kelsey.</label></fieldset>
        <label className="check-label"><input type="checkbox" name="policiesConfirmed" required/><span>I accept the <a href="https://holden.health/coaching.html#policies" target="_blank" rel="noreferrer">cancellation and attendance policies</a>, the $4 online payment fee, and intake review before participation. I understand bank payments can take up to four business days.</span></label>
        <PrivacyNotice/><PrivateSubmit/><p className="payment-note">Stripe handles payment securely. Apple Pay appears on eligible devices.</p>
        </>}
      </form>}
    </>}
    <p><a href="mailto:holdenhealth.coaching@gmail.com">Questions or another payment method? Contact Kelsey.</a></p>
  </section></main>;
}
