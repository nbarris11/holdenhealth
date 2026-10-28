import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";

type CompletePageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutCompletePage({ searchParams }: CompletePageProps) {
  const { session_id: sessionId } = await searchParams;
  let paymentStatus: "paid" | "processing" | "unknown" = "unknown";

  if (sessionId?.startsWith("cs_")) {
    try {
      const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
      paymentStatus = checkout.payment_status === "paid" ? "paid" : checkout.status === "complete" ? "processing" : "unknown";
    } catch {
      paymentStatus = "unknown";
    }
  }

  return <main className="auth-shell">
    <section className="auth-card checkout-complete-card">
      <BrandLogo className="wordmark" href="/" />
      {paymentStatus === "paid" ? <><span className="eyebrow">Payment received</span><h1>You’re ready for the next step.</h1><p className="lede">Your secure member-portal and intake link is on its way by email.</p></> : paymentStatus === "processing" ? <><span className="eyebrow">Bank payment submitted</span><h1>Your enrollment is processing.</h1><p className="lede">ACH payments usually take up to four business days. Your place is held while Stripe confirms the transfer. We’ll email your secure portal and intake link as soon as payment succeeds.</p></> : <><span className="eyebrow">Enrollment status</span><h1>We’re checking your payment.</h1><p className="lede">If you completed the Stripe payment screen, you’ll receive an email when payment is confirmed. Contact Kelsey if you are unsure whether it went through.</p></>}
      <div className="soft-note"><strong>What happens next?</strong><p>Once payment clears, complete your confidential new-member intake in the portal. Kelsey will review it before activating your program access.</p></div>
      <div className="button-row"><Link className="button secondary" href="https://holden.health">Return to Holden Health</Link><Link className="button secondary" href="https://holden.health/book.html">Contact Kelsey</Link></div>
    </section>
  </main>;
}
