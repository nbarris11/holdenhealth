"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import PrivacyNotice from "@/components/privacy-notice";
import { submitEnrollment } from "./enrollment-action";

type Props = { sessionId: string; twoDayPriceCents: number | null; threeDayPriceCents: number | null; newMemberPriceCents?: number; returningMemberPriceCents?: number | null; miniSession?: boolean; classTimes?: string[]; includedClassCount?: number; onlineEnrollmentAvailable: boolean; lateJoin?: boolean; action?: (formData: FormData) => Promise<void>; defaults?: {fullName: string; email: string; phone: string; weeklyCommitment: string}; lockEmail?: boolean };

function SubmitButton({ paymentMethod }: { paymentMethod: string }) {
  const { pending } = useFormStatus();
  return <button className="button primary" type="submit" disabled={pending || !paymentMethod}>{pending ? "Submitting…" : paymentMethod === "request" ? "Request to join" : paymentMethod === "ach" ? "Continue to secure bank payment" : paymentMethod === "card" ? "Continue to secure card / Apple Pay checkout" : paymentMethod ? "Reserve my place" : "Choose a payment method above"}</button>;
}

export default function RegistrationForm({ sessionId, twoDayPriceCents, threeDayPriceCents, newMemberPriceCents, returningMemberPriceCents, miniSession = false, classTimes = [], includedClassCount = 0, onlineEnrollmentAvailable, lateJoin = false, action = submitEnrollment, defaults, lockEmail = false }: Props) {
  const [paymentMethod, setPaymentMethod] = useState(lateJoin ? "request" : "");
  const [weeklyCommitment, setWeeklyCommitment] = useState(["2", "3"].includes(defaults?.weeklyCommitment ?? "") ? defaults!.weeklyCommitment : "");
  const [returningMember, setReturningMember] = useState(false);
  const [error, setError] = useState("");
  const isAch = paymentMethod === "ach";
  const isOnline = isAch || paymentMethod === "card";
  const hasWeeklyPlans = Boolean(twoDayPriceCents && threeDayPriceCents);
  return <form className="stack-form" action={action} onSubmit={(event) => {
    setError("");
    if (!new FormData(event.currentTarget).getAll("attendance").length) {
      event.preventDefault();
      setError("Choose at least one class time that could work for you.");
    }
  }}>
    <span id="offline" />
    {lateJoin ? <><input type="hidden" name="paymentMethod" value="request"/><p className="soft-note">Request to join the remaining classes. Kelsey will confirm space and your prorated price before you pay. Sending a request does not reserve a place.</p></> : <label>How would you like to pay?
      <select name="paymentMethod" required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
        <option value="">Choose a payment method</option>
        <option value="venmo">Venmo · no fee</option>
        {onlineEnrollmentAvailable && <option value="card">Card / Apple Pay · $4 fee</option>}
        {onlineEnrollmentAvailable && <option value="ach">Bank payment (ACH) · $4 fee</option>}
        <option value="cash">Cash · no fee</option>
        <option value="check">Check · no fee</option>
      </select>
    </label>}
    {!lateJoin && !onlineEnrollmentAvailable && <p className="soft-note">Online payment is unavailable right now. You can reserve a place with Venmo, cash, or check.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}

              <input type="hidden" name="sessionId" value={sessionId} />
              <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <div className="field-grid"><label>Full name<input name="fullName" defaultValue={defaults?.fullName} autoComplete="name" required /></label><label>Email<input name="email" type="email" defaultValue={defaults?.email} readOnly={lockEmail} autoComplete="email" required /></label></div>
              <label>Phone number<input name="phone" type="tel" defaultValue={defaults?.phone} autoComplete="tel" required /></label>
              {hasWeeklyPlans ? <fieldset><legend>Choose your weekly commitment</legend><label className="check-label"><input name="weeklyCommitment" onChange={() => setWeeklyCommitment("2")} value="2" defaultChecked={defaults?.weeklyCommitment === "2"} type="radio" required /> 2 days each week{!lateJoin && ` · $${(twoDayPriceCents! / 100).toFixed(0)}`}</label><label className="check-label"><input name="weeklyCommitment" onChange={() => setWeeklyCommitment("3")} value="3" defaultChecked={defaults?.weeklyCommitment === "3"} type="radio" required /> 3 days each week{!lateJoin && ` · $${(threeDayPriceCents! / 100).toFixed(0)}`}</label></fieldset> : <><input type="hidden" name="weeklyCommitment" value="3" /><p className="soft-note">One package includes all {includedClassCount} scheduled classes.</p><label className="check-label"><input name="returningMember" type="checkbox" checked={returningMember} onChange={(event) => setReturningMember(event.target.checked)} /> I’ve completed a Holden Health paid session before{!lateJoin && returningMemberPriceCents != null ? ` · $${(returningMemberPriceCents / 100).toFixed(0)} instead of $${((newMemberPriceCents ?? 0) / 100).toFixed(0)}` : ""}</label></>}
              <fieldset><legend>{miniSession ? "Which class times do you plan to attend?" : "Which class times could work for you?"}</legend>{classTimes.map(time => <label className="check-label" key={time}><input name="attendance" value={time} type="checkbox" /> {time}</label>)}{!classTimes.length ? <p>Class times are being prepared. Please check back soon.</p> : null}</fieldset>
              {isOnline ? <>
                <fieldset><legend>Quick safety check</legend><p className="fieldset-note">If you cannot confirm any item, talk with Kelsey before paying. You will complete the full confidential intake inside your member portal.</p><label className="check-label"><input name="adultConfirmed" type="checkbox" required /> I confirm that I am at least 18 years old.</label><label className="check-label"><input name="exerciseClearanceConfirmed" type="checkbox" required /> A healthcare professional has not told me to avoid exercise or use precautions that I have not discussed with Kelsey.</label></fieldset>
                <label className="check-label" key={paymentMethod}><input name="policiesConfirmed" type="checkbox" required /><span>I understand that a $4 online payment convenience fee will be added, {isAch ? "bank payment can take up to four business days, " : ""} my enrollment becomes active after payment and intake review, and the <a href="https://holden.health/coaching.html#policies" target="_blank" rel="noreferrer">cancellation and attendance policies</a> apply.</span></label>
              </> : paymentMethod && !lateJoin ? <>
                <p>Reserve your place now. Kelsey will follow up with payment and intake details. Payment is due before your first class; your reservation stays unpaid until Kelsey records it. No $4 online fee applies.</p>
                <label className="check-label" key={paymentMethod}><input name="policiesConfirmed" type="checkbox" required /><span>I agree to the <a href="https://holden.health/coaching.html#policies" target="_blank" rel="noreferrer">payment, cancellation, and attendance policies</a>.</span></label>
              </> : null}
              <label style={{ display: isOnline ? "none" : undefined }}>Anything Kelsey should know before reaching out? (optional)<textarea name="note" disabled={isOnline} /></label>
              <PrivacyNotice />
              <div aria-live="polite">{!lateJoin && (miniSession || weeklyCommitment) && <p className="soft-note"><strong>{paymentMethod ? "Total" : "Program price"}: ${(((miniSession ? returningMember ? returningMemberPriceCents ?? newMemberPriceCents ?? 0 : newMemberPriceCents ?? 0 : weeklyCommitment === "2" ? twoDayPriceCents! : threeDayPriceCents!) / 100) + (isOnline ? 4 : 0)).toFixed(0)}</strong>{isOnline ? " · Includes the $4 online-payment fee." : paymentMethod ? " · No online payment fee." : onlineEnrollmentAvailable ? " · Card and bank payments add a $4 fee." : " · No online payment fee."}</p>}</div>
              {classTimes.length ? <SubmitButton paymentMethod={paymentMethod} /> : null}
              {paymentMethod === "card" && <p className="payment-note">Stripe securely handles your payment. Apple Pay appears at checkout on eligible devices with Apple Wallet set up. You can also pay by credit or debit card.</p>}
              {isAch && <p className="payment-note">Stripe securely handles bank verification and ACH authorization. Holden Health never receives or stores your bank login or account number.</p>}
            
  </form>;
}
