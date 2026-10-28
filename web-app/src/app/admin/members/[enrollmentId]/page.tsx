import Link from "next/link";
import { notFound } from "next/navigation";
import { refundOnlinePayment, respondToCheckIn, reviewMemberIntake, updateEnrollmentAndPayment } from "@/app/actions";
import { startMemberPreview } from "@/app/admin/preview-actions";
import { verifyAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import RiskAgreementAdmin, { type SavedRiskAgreement } from "@/components/risk-agreement-admin";
import AdminClassTimes from "@/components/admin-class-times";

type MemberPageProps = {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, { tone: "success" | "error"; text: string }> = {
  saved: { tone: "success", text: "Member changes saved." },
  "profile-save-failed": { tone: "error", text: "The member’s contact details did not save. Please try again." },
  "email-save-failed": { tone: "error", text: "That email could not be saved. It may already belong to another account." },
  "enrollment-save-failed": { tone: "error", text: "The enrollment change did not save. Please try again." },
  "payment-save-failed": { tone: "error", text: "The enrollment saved, but the payment details did not. Please try again." },
  "refund-requested": { tone: "success", text: "The full refund was submitted to Stripe and the member was emailed." },
  "refund-requested-email-failed": { tone: "success", text: "The full refund was submitted to Stripe. The member email could not be sent, so please let them know directly." },
  "refund-confirmation-required": { tone: "error", text: "Check the confirmation box before submitting a refund." },
  "refund-unavailable": { tone: "error", text: "No refundable online payment was found for this member." },
  "refund-already-requested": { tone: "error", text: "A refund has already been submitted for this payment." },
  "refund-failed": { tone: "error", text: "Stripe could not submit this refund. No refund was created; check the payment in Stripe and try again." },
  "refund-recording-failed": { tone: "error", text: "Stripe received the refund, but the portal could not finish saving it. Check Stripe before trying again." },
  "intake-reviewed": { tone: "success", text: "Intake reviewed and enrollment activated." },
  "intake-reviewed-email-failed": { tone: "success", text: "Intake reviewed and enrollment activated. The confirmation email could not be sent, so please let the member know directly." },
  "intake-missing": { tone: "error", text: "This member has not submitted an intake yet." },
  "agreement-required": { tone: "error", text: "The class Assumption of Risk must be signed before activation." },
  "agreement-countersigned": { tone: "success", text: "Representative signature saved." },
  "payment-required": { tone: "error", text: "Confirm payment before activating this enrollment." },
  "intake-review-failed": { tone: "error", text: "The intake review did not save. Please try again." },
};

const sectionLabels: Record<string, string> = {
  about: "About", goals: "Goals", startingPoint: "Starting point", nutritionLifestyle: "Nutrition and lifestyle",
  healthSafety: "Health and safety", coachingExperience: "Coaching experience", commitment: "Commitment",
};

function answerLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function AnswerValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <span>{value.length ? value.join(", ") : "Not selected"}</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span>{String(value || "Not provided")}</span>;
}

export default async function MemberPage({ params, searchParams }: MemberPageProps) {
  await verifyAdmin();
  const { enrollmentId } = await params;
  const query = await searchParams;
  const messageKey = typeof query.message === "string" ? query.message : "";
  const message = messages[messageKey];
  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id,member_id,session_id,status,returning_member,weekly_commitment,risk_agreement_required,sessions(name,new_member_price_cents,two_day_price_cents)")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) notFound();

  const [{ data: profile }, { data: contact }, { data: payment }, { data: intake }, { data: checkIns }, { data: personalTraining }, { data: agreement }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", enrollment.member_id).maybeSingle(),
    supabase.from("member_contacts").select("email").eq("user_id", enrollment.member_id).maybeSingle(),
    supabase.from("payment_records").select("status,method,amount_cents,received_on,internal_note").eq("enrollment_id", enrollment.id).maybeSingle(),
    supabase.from("member_intakes").select("responses,health_review_required,acknowledgment_version,signed_name,signed_at,submitted_at,reviewed_at").eq("enrollment_id", enrollment.id).maybeSingle(),
    supabase.from("check_ins").select("id,week_number,went_well,did_not_go_well,upcoming_goal,support_needed,submitted_at,reviewed_at,coach_response").eq("enrollment_id", enrollment.id).order("submitted_at", { ascending: false }),
    supabase.from("coaching_relationships").select("id,status").eq("member_id", enrollment.member_id).maybeSingle(),
    enrollment.risk_agreement_required ? supabase.from("risk_agreements").select("id,document_version,document_text,printed_name,signature,signed_on,signed_at,acknowledgments,representative_name,representative_signed_on,representative_signed_at").eq("enrollment_id", enrollment.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const session = enrollment.sessions as unknown as { name: string; new_member_price_cents: number; two_day_price_cents: number | null } | null;
  const fallbackAmount = session?.two_day_price_cents ?? session?.new_member_price_cents ?? 0;
  const serviceClient = createAdminClient();
  const { data: invitation } = await serviceClient
    .from("member_invitations")
    .select("id")
    .eq("session_id", enrollment.session_id)
    .eq("claimed_by", enrollment.member_id)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: onlinePayment } = invitation
    ? await serviceClient
      .from("checkout_orders")
      .select("id,amount_cents,paid_at,stripe_refund_id,refund_status,refund_amount_cents,refund_requested_at,refund_email_sent_at")
      .eq("member_invitation_id", invitation.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null };
  const {data:privateSignup}=onlinePayment && enrollment.weekly_commitment===1
    ? await serviceClient.from("private_signup_offers").select("attendance_time").eq("checkout_order_id",onlinePayment.id).maybeSingle()
    : {data:null};
  const onlineAmount = onlinePayment
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(onlinePayment.amount_cents / 100)
    : "";
  const refundStatus = onlinePayment?.refund_status?.replace("_", " ") ?? "pending";

  const paymentComplete = new Set(["paid", "waived", "credited"]).has(payment?.status ?? "pending");
  const openCheckIns = (checkIns ?? []).filter((checkIn) => !checkIn.reviewed_at);

  return <main className="app-shell admin-shell workspace-page member-admin-shell">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/people">← People</Link><span className="eyebrow">Member record</span><h1>{profile?.full_name || "Member"}</h1><p>{contact?.email || "No email saved"}{profile?.phone ? ` · ${profile.phone}` : ""}</p></div><div className="workspace-header-actions"><a className="button secondary" href="#member-details">Edit member details</a><Link className={personalTraining ? "button primary" : "button secondary"} href={`/admin/training/${enrollment.member_id}`}>{personalTraining ? "Open personal training" : "Add personal training"}</Link><form action={startMemberPreview}><input type="hidden" name="enrollmentId" value={enrollment.id} /><button className="button secondary" type="submit">View their portal</button></form></div></header>
    {message ? <p className={`notice ${message.tone}`} role="status">{message.text}</p> : null}
    <AdminClassTimes memberId={enrollment.member_id} enrollmentId={enrollment.id} />
    {privateSignup && <section className="panel"><h2>Confirmed class signup</h2><p>1 class per week · <strong>{privateSignup.attendance_time} Eastern</strong></p><p>{paymentComplete ? "Payment complete." : "Payment needs follow-up."} {intake?.reviewed_at ? "Intake reviewed." : "Intake review required before participation."}</p><Link className="text-link" href={`/admin/classes?program=${enrollment.session_id}`}>View class roster →</Link></section>}
    <section className="member-status-summary panel"><div><span className="eyebrow">At a glance</span><h2>{enrollment.status === "active" ? "Current member" : enrollment.status === "invited" ? "Setup email sent" : enrollment.status}</h2></div><dl><div><dt>Weekly plan</dt><dd>{enrollment.weekly_commitment ? `${enrollment.weekly_commitment} classes` : "Not set"}</dd></div><div><dt>Payment</dt><dd className={paymentComplete ? "success-text" : "warning-text"}>{paymentComplete ? (payment?.status === "paid" ? "Paid" : "Complete") : "Needs follow-up"}</dd></div><div><dt>Intake</dt><dd>{intake ? (intake.reviewed_at ? "Reviewed" : "Ready for review") : "Not submitted"}</dd></div>{enrollment.risk_agreement_required && <div><dt>Risk agreement</dt><dd>{agreement ? "Signed" : "Not signed"}</dd></div>}<div><dt>Check-ins</dt><dd>{openCheckIns.length ? `${openCheckIns.length} waiting` : "Caught up"}</dd></div></dl></section>
    <div className="member-admin-layout">
      <details className="panel member-edit-disclosure" id="member-details" open><summary><span><span className="eyebrow">Member details</span><strong>Contact, program, and payment</strong><small>Edit the member record below</small></span><b>⌄</b></summary><form className="stack-form" action={updateEnrollmentAndPayment}>
        <input type="hidden" name="enrollmentId" value={enrollment.id} />
        <div className="field-grid"><label>Full name<input name="fullName" defaultValue={profile?.full_name ?? ""} required /></label><label>Email<input name="email" type="email" defaultValue={contact?.email ?? ""} required /></label></div>
        <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ""} /></label>
        <div className="form-section-label"><span className="eyebrow">Program</span><strong>{session?.name || "Current program"}</strong></div>
        <div className="field-grid"><label>Enrollment<select name="enrollmentStatus" defaultValue={enrollment.status}><option value="prospect">Prospect</option><option value="invited">Invited</option><option value="active">Active</option><option value="completed">Completed</option><option value="withdrawn">Withdrawn</option></select></label><label>Weekly plan<select name="weeklyCommitment" defaultValue={enrollment.weekly_commitment?.toString() ?? "2"}><option value="1">1 day/week · private arrangement</option><option value="2">2 days/week</option><option value="3">3 days/week</option></select></label></div>
        <label className="check-label"><input name="returningMember" type="checkbox" defaultChecked={enrollment.returning_member} /> Returning member</label>
        <div className="form-section-label"><span className="eyebrow">Payment</span><strong>Payment record</strong></div>
        <div className="field-grid"><label>Payment<select name="paymentStatus" defaultValue={payment?.status ?? "pending"}><option value="pending">Pending</option><option value="paid">Paid</option><option value="credited">Credited</option><option value="refunded">Refunded</option><option value="waived">Waived</option></select></label><label>Method<select name="paymentMethod" defaultValue={payment?.method ?? ""}><option value="">Not recorded</option><option value="stripe_ach">Stripe ACH</option><option value="stripe_card">Stripe card / Apple Pay</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="check">Check</option><option value="other">Other</option></select></label></div>
        <div className="field-grid"><label>Amount<input name="amount" type="number" step="0.01" min="0" defaultValue={((payment?.amount_cents ?? fallbackAmount) / 100).toFixed(2)} required /></label><label>Received on<input name="receivedOn" type="date" defaultValue={payment?.received_on ?? ""} /></label></div>
        <label>Internal note<input name="internalNote" defaultValue={payment?.internal_note ?? ""} /></label>
        <button className="button primary" type="submit">Save member changes</button>
      </form>
      {onlinePayment ? <div className="online-refund-card">
        <div className="online-refund-heading"><div><span className="eyebrow">Stripe online payment</span><h3>{onlineAmount} paid online</h3></div>{onlinePayment.stripe_refund_id ? <span className={`status-pill ${refundStatus === "succeeded" ? "success" : "warning"}`}>{refundStatus}</span> : null}</div>
        {onlinePayment.stripe_refund_id ? <>
          <p>A full {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((onlinePayment.refund_amount_cents ?? onlinePayment.amount_cents) / 100)} refund was submitted{onlinePayment.refund_requested_at ? ` on ${new Date(onlinePayment.refund_requested_at).toLocaleDateString("en-US")}` : ""}. Stripe status: {refundStatus}.</p>
          <small>{onlinePayment.refund_email_sent_at ? "The member was emailed automatically." : "The refund is recorded in Stripe."}</small>
        </> : <form className="refund-form" action={refundOnlinePayment}>
          <input type="hidden" name="enrollmentId" value={enrollment.id} />
          <p>This returns the entire {onlineAmount} online payment to the member’s original bank account. It cannot be undone from this portal.</p>
          <label className="check-label"><input name="confirmRefund" type="checkbox" required /> I understand this submits a full refund.</label>
          <button className="button danger-button" type="submit">Refund {onlineAmount}</button>
        </form>}
      </div> : null}
      </details>
      <aside className="member-next-actions"><section className={`panel ${!paymentComplete ? "attention-card" : ""}`}><span className="eyebrow">Next step</span><h2>{!paymentComplete ? "Payment needs follow-up" : !intake ? "Waiting for intake" : enrollment.risk_agreement_required && !agreement ? "Waiting for risk agreement" : !intake.reviewed_at ? "Review their intake" : openCheckIns.length ? "Respond to their check-in" : "Everything is current"}</h2><p>{!paymentComplete ? "Open Program and payment to record it when received." : !intake ? "They will be prompted inside their member portal." : enrollment.risk_agreement_required && !agreement ? "The member signs the class agreement after the intake." : !intake.reviewed_at ? "Review the health and coaching details below." : openCheckIns.length ? "Your reply will appear in their portal." : "No action is needed for this member right now."}</p></section></aside>
    </div>
    <section className="panel intake-admin-card">
      <div className="section-heading"><div><span className="eyebrow">Private new member intake</span><h2>{intake ? (intake.reviewed_at ? "Reviewed" : "Ready for review") : "Not submitted yet"}</h2></div>{intake?.health_review_required ? <span className="status-pill warning">Health follow-up</span> : intake ? <span className="status-pill success">No health flag</span> : null}</div>
      {intake ? <>
        <p className="privacy-note"><strong>Private health information.</strong><span>Use these answers only to coach this member safely. Do not copy them into email.</span></p>
        <div className="intake-admin-sections">{Object.entries((intake.responses ?? {}) as Record<string, Record<string, unknown>>).map(([section, answers]) => <details key={section} open={section === "healthSafety"}><summary>{sectionLabels[section] ?? answerLabel(section)}</summary><dl>{Object.entries(answers).map(([label, value]) => <div key={label}><dt>{answerLabel(label)}</dt><dd><AnswerValue value={value} /></dd></div>)}</dl></details>)}</div>
        <div className="signature-record"><strong>Signed by {intake.signed_name}</strong><span>{new Date(intake.signed_at).toLocaleString("en-US")} · acknowledgment {intake.acknowledgment_version}</span></div>
        {intake.reviewed_at ? <p className="notice success">Reviewed {new Date(intake.reviewed_at).toLocaleString("en-US")}.</p> : <form action={reviewMemberIntake}><input type="hidden" name="enrollmentId" value={enrollment.id} /><button className="button primary" type="submit" disabled={Boolean(enrollment.risk_agreement_required && !agreement)}>Mark reviewed and activate enrollment</button><p className="payment-note">This button requires payment to be marked paid, waived, or credited{enrollment.risk_agreement_required ? " and a signed class risk agreement" : ""}.</p></form>}
      </> : <p>The member will be prompted to complete the intake from their portal.</p>}
    </section>
    {enrollment.risk_agreement_required && <RiskAgreementAdmin agreement={agreement as SavedRiskAgreement | null} context="group_class" subjectId={enrollment.id} memberId={enrollment.member_id} />}
    <section className="workspace-section member-checkins-section">
      <div className="section-heading"><div><span className="eyebrow">Weekly coaching</span><h2>Check-ins</h2></div><p>Keep this member’s coaching conversation together with their record.</p></div>
      <div className="member-checkin-history">{(checkIns ?? []).length ? (checkIns ?? []).map((checkIn) => <details className={`panel ${checkIn.reviewed_at ? "" : "needs-action"}`} open={!checkIn.reviewed_at} key={checkIn.id}><summary><span><strong>Week {checkIn.week_number}: {checkIn.upcoming_goal}</strong><small>{checkIn.reviewed_at ? "Responded" : "Waiting for your response"}</small></span><span className={`status-pill ${checkIn.reviewed_at ? "success" : "warning"}`}>{checkIn.reviewed_at ? "Complete" : "Reply needed"}</span></summary><dl className="answer-grid"><div><dt>What went well</dt><dd>{checkIn.went_well}</dd></div><div><dt>What was difficult</dt><dd>{checkIn.did_not_go_well}</dd></div><div><dt>Support requested</dt><dd>{checkIn.support_needed}</dd></div></dl><form className="stack-form" action={respondToCheckIn}><input type="hidden" name="checkInId" value={checkIn.id} /><label>Your response<textarea name="coachResponse" defaultValue={checkIn.coach_response ?? ""} required /></label><button className="button primary" type="submit">Save response</button></form></details>) : <div className="panel calm-empty compact"><p>No check-ins submitted yet.</p></div>}</div>
    </section>
  </main>;
}
