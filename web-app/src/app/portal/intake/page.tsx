import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import IntakeForm from "./intake-form";
import { memberEnrollments } from "@/lib/member-enrollments";
import { chooseEnrollment } from "@/lib/member-session";
import { detroitToday } from "@/lib/challenge";
import RiskAgreementForm from "@/components/risk-agreement-form";

type IntakePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const errorMessages: Record<string, string> = {
  required: "Please complete every required question before submitting.",
  enrollment: "We could not find an eligible enrollment for this account.",
  acknowledgment: "Please accept the health and exercise acknowledgment.",
  "health-detail": "Please explain each health question answered Yes.",
  age: "Direct enrollment is currently available to adults age 18 or older.",
  "already-submitted": "This intake has already been submitted.",
  save: "We could not save your intake. Please try again.",
};

function Checkboxes({ name, options }: { name: string; options: string[] }) {
  return <><p className="fine-print">Required · choose at least one.</p><div className="intake-choice-grid">{options.map((option) => <label className="check-label choice-card" key={option}><input name={name} value={option} type="checkbox" /> {option}</label>)}</div></>;
}

function RadioChoices({ name, options }: { name: string; options: string[] }) {
  return <div className="intake-choice-grid">{options.map((option) => <label className="check-label choice-card" key={option}><input name={name} value={option} type="radio" required /> {option}</label>)}</div>;
}

function Rating({ name, low, high }: { name: string; low: string; high: string }) {
  return <div className="rating-wrap"><div className="rating-scale">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <label key={value}><input name={name} value={value} type="radio" required /><span>{value}</span></label>)}</div><div className="rating-labels"><span>{low}</span><span>{high}</span></div></div>;
}

function YesNo({ name }: { name: string }) {
  return <div className="inline-options"><label className="check-label"><input name={name} value="no" type="radio" required /> No</label><label className="check-label"><input name={name} value="yes" type="radio" required /> Yes</label></div>;
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const auth = await verifySession();
  const params = await searchParams;
  const supabase = await createClient();
  const enrollment = chooseEnrollment((await memberEnrollments()).filter(row => ["invited", "active"].includes(row.status)), detroitToday(), typeof params.enrollment === "string" ? params.enrollment : undefined);
  const results = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", auth.userId).maybeSingle(),
    enrollment ? supabase.from("member_intakes").select("submitted_at,reviewed_at,health_review_required,responses").eq("enrollment_id", enrollment.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    enrollment?.risk_agreement_required ? supabase.from("risk_agreements").select("id,signed_at").eq("enrollment_id", enrollment.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (results.some(result => result.error)) throw new Error("Your intake could not be loaded. Please try again.");
  const [{ data: profile }, { data: intake }, { data: agreement }] = results;
  const program = enrollment?.sessions as unknown as { name: string } | null;
  const submitted = Boolean(intake);
  const error = typeof params.error === "string" ? params.error : "";

  if (!enrollment) return <main className="auth-shell"><section className="auth-card"><BrandLogo className="wordmark" href="/portal" /><span className="eyebrow">New member intake</span><h1>Your enrollment isn’t ready yet.</h1><p className="lede">The intake opens after your enrollment and portal access are connected.</p><div className="button-row"><Link className="button secondary" href="/portal">Return to your portal</Link></div></section></main>;

  if (submitted && enrollment.risk_agreement_required && !agreement) {
    const about = (intake?.responses as Record<string, Record<string, string>> | null)?.about || {};
    return <main className="app-shell intake-shell"><header className="app-header"><div><span className="eyebrow">Step 2 of 2 · Class setup</span><h1>Assumption of Risk</h1><p className="lede">Your class intake was saved. Please read and sign the separate group class agreement before Kelsey activates your enrollment.</p></div></header><RiskAgreementForm context="group_class" subjectId={enrollment.id} defaults={{ clientName: profile?.full_name || "", phone: profile?.phone || about.contactPhone || "", email: auth.email || "", emergencyContact: about.emergencyContact || "", preferredCommunication: about.preferredCommunication || "" }} /></main>;
  }
  if (submitted) return <main className="auth-shell"><section className="auth-card"><BrandLogo className="wordmark" href="/portal" /><span className="eyebrow">Intake submitted</span><h1>Thank you for being honest.</h1><p className="lede">{intake?.reviewed_at ? "Kelsey has reviewed your intake. Check Classes & membership for your payment and participation status." : "Kelsey will review your answers before you participate. If she needs clarification, she’ll reach out privately."}</p>{intake?.health_review_required ? <div className="soft-note"><strong>A conversation is the next step.</strong><p>One or more health answers needs review before participation. This does not automatically prevent you from joining.</p></div> : null}{enrollment.risk_agreement_required && agreement && <p>Your class Assumption of Risk was signed and saved.</p>}<div className="button-row"><Link className="button primary" href="/portal/progress#story-goal">Start my progress story</Link><Link className="button secondary" href={`/portal/session${enrollment ? `?enrollment=${enrollment.id}` : ""}`}>Return to your portal</Link></div></section></main>;

  return <main className="app-shell intake-shell">
    <header className="app-header"><div><span className="eyebrow">Holden Health · New member intake</span><h1>Help Kelsey understand where you’re starting.</h1><p className="lede">There are no right or wrong answers. Be honest and realistic about where you are today.</p></div><Link className="button secondary" href={`/portal/session?enrollment=${enrollment.id}`}>Return to portal</Link></header>
    <div className="intake-progress" aria-label="Seven intake sections">{["About you", "Goals", "Starting point", "Lifestyle", "Health", "Coaching", "Commitment"].map((label, index) => <span key={label}><b>{index + 1}</b>{label}</span>)}</div>
    {error ? <p className="notice error" role="alert">{errorMessages[error] ?? errorMessages.save}</p> : null}
    <div className="privacy-note"><strong>Your answers are private.</strong><span>Kelsey and authorized Holden Health staff use these answers to coach you safely. Our service providers process the records to operate the portal. Read our <a href="https://holden.health/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a> for details about access, storage, and data requests.</span></div>
    <IntakeForm key={enrollment.id}>
      <input type="hidden" name="enrollmentId" value={enrollment.id} />

      <section className="panel intake-section"><span className="eyebrow">1 · About you</span><h2>Start with the basics.</h2><div className="profile-summary"><span><b>Name</b>{profile?.full_name || "Member"}</span><span><b>Email</b>{auth.email}</span><span><b>Phone</b>{profile?.phone || "Not provided"}</span></div><fieldset><legend>Preferred way to communicate</legend><div className="inline-options"><label className="check-label"><input name="preferredCommunication" value="Text" type="radio" required /> Text</label><label className="check-label"><input name="preferredCommunication" value="Email" type="radio" required /> Email</label><label className="check-label"><input name="preferredCommunication" value="Phone" type="radio" required /> Phone</label></div></fieldset><div className="field-grid"><label>Your phone number (required for Text or Phone)<input name="contactPhone" type="tel" autoComplete="tel" maxLength={40} defaultValue={profile?.phone || ""} /></label><label>Age<input name="age" type="number" min="18" max="120" required /></label><label>Emergency contact name and phone<input name="emergencyContact" required /></label></div></section>

      <section className="panel intake-section"><span className="eyebrow">2 · Your goals</span><h2>What brought you to Holden Health?</h2><fieldset><legend>Check all that apply</legend><Checkboxes name="goals" options={["Get stronger", "Improve my fitness", "Lose body fat / change my body composition", "Improve my energy", "Improve my confidence", "Build healthier habits", "Get back into a consistent routine", "Improve mobility / movement", "Improve athletic performance", "Meet people and build community", "Other"]} /></fieldset><label>If you chose Other, tell us more<input name="goalOther" /></label><label>What is the #1 thing you would most like to accomplish?<textarea name="primaryGoal" required /></label><label>Six weeks from now, what would make you say, “I’m really glad I did this”?<textarea name="sixWeekSuccess" required /></label></section>

      <section className="panel intake-section"><span className="eyebrow">3 · Your starting point</span><h2>What does movement look like today?</h2><fieldset><legend>How would you rate your current fitness level?</legend><Rating name="fitnessRating" low="Very low" high="Excellent" /></fieldset><fieldset><legend>How consistent are you currently with exercise?</legend><RadioChoices name="exerciseConsistency" options={["Not currently exercising", "1 day/week", "2 days/week", "3–4 days/week", "5+ days/week"]} /></fieldset><label>What types of exercise or movement do you currently do?<textarea name="currentExercise" required /></label><label>What has made it difficult to stay consistent in the past?<textarea name="consistencyBarriers" required /></label></section>

      <section className="panel intake-section"><span className="eyebrow">4 · Nutrition and lifestyle</span><h2>Support the whole week.</h2><fieldset><legend>How would you rate your current eating habits?</legend><Rating name="eatingRating" low="Need a lot of work" high="Feel great about them" /></fieldset><fieldset><legend>Is there anything about your nutrition you’d like support with?</legend><Checkboxes name="nutritionSupport" options={["Meal planning", "Portion awareness", "Protein / balanced meals", "Snacking", "Eating out", "Hydration", "Consistency", "Nothing right now", "Other"]} /></fieldset><label>If you chose Other, tell us more<input name="nutritionOther" /></label><fieldset><legend>On average, how many hours do you sleep per night?</legend><div className="inline-options"><label className="check-label"><input name="sleep" value="Less than 5" type="radio" required /> Less than 5</label><label className="check-label"><input name="sleep" value="5–6" type="radio" required /> 5–6</label><label className="check-label"><input name="sleep" value="7–8" type="radio" required /> 7–8</label><label className="check-label"><input name="sleep" value="9+" type="radio" required /> 9+</label></div></fieldset><fieldset><legend>How would you rate your current stress level?</legend><Rating name="stressRating" low="Very low" high="Very high" /></fieldset><label>What is one thing that would make taking care of yourself easier right now?<textarea name="easierSelfCare" required /></label></section>

      <section className="panel intake-section health-section"><span className="eyebrow">5 · Health and safety</span><h2>Help Kelsey coach you safely.</h2><p>Answering Yes does not automatically prevent participation. Kelsey may contact you for clarification or recommend speaking with your healthcare provider.</p><fieldset><legend>Do you currently have any injuries, pain, medical conditions, or physical limitations that could affect exercise?</legend><YesNo name="injury" /><label>If Yes, please explain<textarea name="injuryDetail" /></label></fieldset><fieldset><legend>Are you currently taking any medications that may affect exercise or nutrition?</legend><YesNo name="medications" /><label>If Yes, please list only what Kelsey needs to support you safely<textarea name="medicationDetail" /></label></fieldset><fieldset><legend>Has a healthcare professional told you not to exercise or that you need special precautions?</legend><YesNo name="precautions" /><label>If Yes, please explain<textarea name="precautionDetail" /></label></fieldset></section>

      <section className="panel intake-section"><span className="eyebrow">6 · Your coaching experience</span><h2>What kind of support works for you?</h2><fieldset><legend>What type of support would be most helpful?</legend><Checkboxes name="coachingSupport" options={["Accountability", "Motivation", "Exercise guidance", "Nutrition guidance", "Help creating healthy habits", "Someone to keep me on track", "Community / encouragement", "A combination of these"]} /></fieldset><label>What do you need from Kelsey as your coach?<textarea name="coachNeeds" required /></label><label>What is one thing you don’t want from a fitness program?<textarea name="dontWant" required /></label></section>

      <section className="panel intake-section"><span className="eyebrow">7 · Commitment</span><h2>Choose a realistic starting point.</h2><fieldset><legend>How ready are you to make changes right now?</legend><Rating name="readiness" low="Not ready" high="Very ready" /></fieldset><fieldset><legend>What are you willing to commit to during this program?</legend><Checkboxes name="commitments" options={["Attending my scheduled classes", "Moving outside of class", "Making small nutrition changes", "Prioritizing sleep/recovery", "Checking in with my coach", "Being patient with the process", "Supporting and encouraging other members"]} /></fieldset><label>Anything else you’d like Kelsey to know?<textarea name="anythingElse" /></label></section>

      <section className="panel intake-section acknowledgment-section"><span className="eyebrow">Health and exercise acknowledgment</span><h2>Review and sign.</h2><p>I understand that Holden Health provides general fitness and wellness coaching and that I am responsible for informing my coach of any health conditions, injuries, medications, or changes in my health that may affect my ability to exercise safely.</p><p>I understand that I should consult my healthcare provider when appropriate before beginning or modifying an exercise program.</p><label className="check-label policy-check"><input name="acknowledgmentAccepted" type="checkbox" required /> I have read and agree to the acknowledgment above, and I confirm that my answers are accurate to the best of my knowledge.</label><label>Type your full legal name as your signature<input name="signedName" autoComplete="name" required /></label><button className="button primary" type="submit">{enrollment.risk_agreement_required ? "Continue to Assumption of Risk" : "Submit my intake securely"}</button><p className="payment-note">Your signature confirms the acknowledgment above. Kelsey will review your intake before you participate.</p></section>
    </IntakeForm>
    <p className="fine-print">Program: {program?.name ?? "Holden Health session"}. Need help? <a href="mailto:HoldenHealth.Coaching@gmail.com">Email Kelsey</a>.</p>
  </main>;
}
