import RegistrationForm from "./registration-form";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { registrationClassTimes } from "@/lib/registration-schedule";

type RegisterPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const reserved = sent && params.reserved === "1";
  const venmoReservation = reserved && params.paymentMethod === "venmo";
  const checkoutCancelled = params.checkout === "cancelled";
  const checkoutError = typeof params.checkoutError === "string" ? params.checkoutError : "";
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const { data: sessions } = await supabase.from("sessions").select("id,name,description,starts_on,ends_on,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents,status").eq("published", true).in("status", ["enrolling", "active"]).gte("ends_on", today).order("starts_on");
  const requestedSession = typeof params.session === "string" ? params.session : "";
  const session = sessions?.find((item) => item.id === requestedSession) ?? sessions?.[0];
  const { data: classMeetings } = session ? await supabase.from("class_meetings").select("starts_at,cancelled").eq("session_id", session.id).order("starts_at") : { data: [] };
  const classTimes = registrationClassTimes(classMeetings ?? []);
  const includedClassCount = (classMeetings ?? []).filter(meeting => !meeting.cancelled).length;
  const hasWeeklyPlans = Boolean(session?.two_day_price_cents && session?.three_day_price_cents);
  const isMiniSession = Boolean(session && !hasWeeklyPlans);
  const zoomNoteMatch = session?.description?.match(/^(.*?)\s+\(?((?:November 7 classes are on Zoom)\.)\)?\s*$/i);
  const signupDescription = zoomNoteMatch ? zoomNoteMatch[1] : session?.description;
  const zoomNote = zoomNoteMatch?.[2];

  const onlineEnrollmentAvailable = Boolean(session && session.starts_on > today && session.status === "enrolling" && isStripeConfigured());
  const checkoutMessages: Record<string, string> = {
    payment: "Choose Card / Apple Pay, Venmo, bank payment, cash, or check.",
    details: "Please check your name, email, and phone number.",
    plan: "Choose a two-day or three-day plan.",
    attendance: "Choose at least one class time that could work for you.",
    policies: "Please accept the enrollment and payment policies before continuing.",
    full: "This session is currently full. Talk with Kelsey about the waitlist or next session.",
    "in-progress": "An enrollment is already in progress for that email address. Check your email or contact Kelsey for help.",
    unavailable: "Online payment is temporarily unavailable. You can still send Kelsey a request below.",
  };

  return (
    <main className="auth-shell register-shell">
      <section className="auth-card register-card">
        <BrandLogo className="wordmark" href="https://holden.health" />
        {sent ? <><span className="eyebrow">{reserved ? "Reservation received" : "Request received"}</span><h1>{reserved ? "Your place is reserved." : "You’re on Kelsey’s list."}</h1><p className="lede">{reserved ? "Payment is still pending. Please pay before your first class. Kelsey will follow up with payment and intake details. There is no $4 online fee for Venmo, cash, or check." : "Kelsey will reach out to discuss the session. After approval, you’ll receive a secure link to your member portal."}</p>{venmoReservation && <div className="soft-note"><h2>Pay with Venmo</h2><p>Send your program payment to <strong>@holdenhealthllc</strong>. Include the name you registered with in the payment note so Kelsey can match it to your reservation.</p><p>Your reservation will stay marked unpaid until Kelsey confirms your payment.</p><a className="button primary" href="https://venmo.com/u/holdenhealthllc" target="_blank" rel="noopener noreferrer">Open Venmo</a></div>}<div className="button-row"><Link className="button secondary" href="https://holden.health">Return to Holden Health</Link></div></> : session ? <>
          <span className="eyebrow">Choose how to start</span><h1>{session.starts_on <= today ? "Ask to join the remaining classes." : `Join ${session.name}.`}</h1><p className="lede">{session.starts_on <= today ? "Kelsey will check availability and confirm your prorated price before you pay." : onlineEnrollmentAvailable ? "Fill out your details once, then pay by card, Apple Pay, or bank transfer, or reserve your place to pay by Venmo, cash, or check." : "Fill out your details once to reserve your place. You can pay Kelsey by Venmo, cash, or check before the first class."}</p>
          {sessions && sessions.length > 1 ? <nav className="button-row" aria-label="Choose a group session">{sessions.map((item) => <Link key={item.id} className={`button ${item.id === session.id ? "primary" : "secondary"}`} href={`/register?session=${encodeURIComponent(item.id)}`}>{item.name.replace("Focus on You: ", "")}</Link>)}</nav> : null}
          <div className="registration-session"><strong>{session.name}</strong><span>{session.starts_on <= today ? "Prorated price confirmed by Kelsey" : hasWeeklyPlans ? `2 days/week $${(session.two_day_price_cents! / 100).toFixed(0)} · 3 days/week $${(session.three_day_price_cents! / 100).toFixed(0)}` : `All classes package · New members $${(session.new_member_price_cents / 100).toFixed(0)} · Returning members $${((session.returning_member_price_cents ?? session.new_member_price_cents) / 100).toFixed(0)}`}</span><p>{signupDescription}</p>{zoomNote ? <p className="signup-schedule-note">({zoomNote})</p> : null}<p>{new Intl.DateTimeFormat("en-US", {month:"long",day:"numeric",timeZone:"UTC"}).format(new Date(`${session.starts_on}T12:00:00Z`))}–{new Intl.DateTimeFormat("en-US", {month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${session.ends_on}T12:00:00Z`))}</p><p>{classTimes.length ? classTimes.join(" · ") : "Class times will be posted soon."}</p><p>Burroughs · 41100 Plymouth Rd, Ste. B1-162, Plymouth, MI. Park near the south-facing clock, enter those doors, walk straight, then turn left. The gym is on your left. <a href="https://holden.health/coaching.html#location">Directions</a></p></div>
          <p className="soft-note"><strong>Every membership includes full access to the Holden Health app at no extra cost.</strong> Keep your workouts, habit check-ins, and progress together, with private messages to Kelsey and a group chat for everyone in your program.</p>
          <p>Already have an account? <Link href="/portal/renew">Renew or check your registration in the member portal.</Link></p>
          <p>Have questions before joining? <a href="https://holden.health/book.html">Talk with Kelsey first.</a></p>
          {checkoutCancelled ? <p className="notice">You returned from checkout. If you did not finish paying, you can try again below.</p> : null}
          {checkoutError ? <p className="notice error" role="alert">{checkoutMessages[checkoutError] ?? checkoutMessages.unavailable}</p> : null}
          <section className="enrollment-section" id="enroll">
            <h2>{session.starts_on <= today ? "Request to join" : "Choose your payment method and plan."}</h2>
            <RegistrationForm sessionId={session.id} twoDayPriceCents={session.two_day_price_cents} threeDayPriceCents={session.three_day_price_cents} newMemberPriceCents={session.new_member_price_cents} returningMemberPriceCents={session.returning_member_price_cents} onlineEnrollmentAvailable={onlineEnrollmentAvailable} lateJoin={session.starts_on <= today} miniSession={isMiniSession} classTimes={classTimes} includedClassCount={includedClassCount} />
          </section>
          <div className="soft-note"><strong>Flexible attendance and clear policies</strong><p>{isMiniSession ? `Your package covers all ${includedClassCount} scheduled classes. If you miss one, there are no makeups outside this program’s dates.` : "Switch class times or make up a missed class within this session; just tell Kelsey."} Cancel before the program starts for your money back. Missed classes after the start are not refundable; serious illness or injury can be discussed individually. If Kelsey cancels in an emergency, she will provide an at-home workout.</p><a href="https://holden.health/coaching.html#policies">Full policies</a></div><p className="fine-print">Already approved? <Link href="/login">Sign in to your member portal</Link>.</p>
        </> : <><span className="eyebrow">Session registration</span><h1>The next session is being prepared.</h1><p className="lede">Email Holden Health and Kelsey will let you know when registration opens.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com">Email Holden Health</a></>}
      </section>
    </main>
  );
}
