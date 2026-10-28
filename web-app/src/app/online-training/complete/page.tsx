import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";

type CompletePageProps = { searchParams: Promise<{ session_id?: string }> };

export default async function OnlineTrainingCompletePage({ searchParams }: CompletePageProps) {
  const { session_id: sessionId } = await searchParams;
  let paymentReceived = false;

  if (sessionId?.startsWith("cs_")) {
    try {
      const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
      paymentReceived = checkout.payment_status === "paid"
        && checkout.currency === "usd"
        && checkout.amount_total === 20_300
        && checkout.metadata?.purchase_type === "online_personal_training";
    } catch {
      paymentReceived = false;
    }
  }

  return <main className="auth-shell">
    <section className="auth-card checkout-complete-card">
      <BrandLogo className="wordmark" href="/" />
      {paymentReceived ? <><span className="eyebrow">Payment received</span><h1>You’re officially on your way.</h1><p className="lede">Your $203 payment is confirmed, including the $4 online payment fee. Kelsey will email you with your intake and the next steps for your personalized plan.</p></> : <><span className="eyebrow">Payment status</span><h1>We’re checking your payment.</h1><p className="lede">If you completed Stripe checkout, watch your email for confirmation. Contact Kelsey if you’re unsure whether it went through.</p></>}
      <div className="soft-note"><strong>What happens next?</strong><p>Kelsey will learn about your goals, schedule, available equipment, and current fitness level before building your four-week program.</p></div>
      <div className="button-row"><Link className="button secondary" href="https://holden.health">Return to Holden Health</Link><Link className="button secondary" href="https://holden.health/book.html">Contact Kelsey</Link></div>
    </section>
  </main>;
}
