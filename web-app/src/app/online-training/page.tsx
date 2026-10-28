import PrivacyNotice from "@/components/privacy-notice";
import BrandLogo from "@/components/brand-logo";
import { startOnlineTrainingCheckout } from "@/app/online-training/checkout-action";
import { isStripeConfigured } from "@/lib/stripe";

type OnlineTrainingPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OnlineTrainingPage({ searchParams }: OnlineTrainingPageProps) {
  const params = await searchParams;
  const checkoutCancelled = params.checkout === "cancelled";
  const checkoutError = typeof params.checkoutError === "string" ? params.checkoutError : "";
  const checkoutMessages: Record<string, string> = {
    details: "Please check your name, email, and phone number.",
    safety: "Please confirm both safety items before continuing.",
    policies: "Please accept the coaching and payment terms before continuing.",
    unavailable: "Online payment is temporarily unavailable. Please contact Kelsey for help.",
  };

  return (
    <main className="auth-shell register-shell">
      <section className="auth-card register-card" id="checkout">
        <BrandLogo className="wordmark" href="https://holden.health" />
        <span className="eyebrow">Online personal training</span>
        <h1>Start your personalized four-week plan.</h1>
        <p className="lede">Start with a free consultation to agree on your plan, start date, and next steps. If you have already spoken with Kelsey, complete your payment below.</p>

        <p><a className="button primary" href="https://holden.health/book.html">Book a free consultation</a></p><div className="registration-session">
          <strong>Four weeks of one-to-one online coaching</strong>
          <span>$199 coaching + $4 online payment fee · $203 total</span>
          <p>Personalized workouts, weekly Zoom coaching, direct text support, adjustments, accountability, and progress tracking.</p>
        </div>

        <p className="soft-note"><strong>Full access to the Holden Health app is included with your membership at no extra cost.</strong> Your workout plan, habit check-ins, progress, and private messages to Kelsey stay together throughout your membership.</p>
        {checkoutCancelled ? <p className="notice">Checkout was cancelled. Your card was not charged.</p> : null}
        {checkoutError ? <p className="notice error" role="alert">{checkoutMessages[checkoutError] ?? checkoutMessages.unavailable}</p> : null}

        {isStripeConfigured() ? <form className="stack-form" action={startOnlineTrainingCheckout}>
          <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <div className="field-grid">
            <label>Full name<input name="fullName" autoComplete="name" required /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          </div>
          <label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label>
          <label className="check-label"><input name="consultationConfirmed" type="checkbox" required /> I have completed my consultation with Kelsey and agreed on my training plan.</label><fieldset>
            <legend>Quick safety check</legend>
            <p className="fieldset-note">If you cannot confirm either item, talk with Kelsey before paying.</p>
            <label className="check-label"><input name="adultConfirmed" type="checkbox" required /> I confirm that I am at least 18 years old.</label>
            <label className="check-label"><input name="exerciseClearanceConfirmed" type="checkbox" required /> A healthcare professional has not told me to avoid exercise or use precautions that I have not discussed with Kelsey.</label>
          </fieldset>
          <label className="check-label policy-check"><input name="policiesConfirmed" type="checkbox" required /> I understand the total charge is $203: $199 for four weeks of online personal training plus a $4 online payment fee. I agree to the <a href="https://holden.health/terms.html" target="_blank" rel="noreferrer">website terms</a> and <a href="https://holden.health/disclaimer.html" target="_blank" rel="noreferrer">health disclaimer</a>.</label>
          <PrivacyNotice />
          <button className="button primary" type="submit">Continue to secure payment · $203 total</button>
          <p className="payment-note">Stripe securely handles the card payment. Holden Health does not receive or store your card number.</p>
        </form> : <div className="soft-note"><strong>Online payment is temporarily unavailable.</strong><p>Please contact Kelsey and she’ll help you get started.</p></div>}

        <div className="button-row"><a className="button secondary" href="https://holden.health/book.html">Talk with Kelsey first</a><a className="button secondary" href="https://holden.health/fitness-coaching.html">Review the program</a></div>
      </section>
    </main>
  );
}
