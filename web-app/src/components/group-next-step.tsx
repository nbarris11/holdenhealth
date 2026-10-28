import Link from "next/link";
import { memberEnrollments } from "@/lib/member-enrollments";
import { chooseEnrollment, sessionPhase } from "@/lib/member-session";
import { dateLabel, detroitToday } from "@/lib/challenge";
import { createClient } from "@/lib/supabase/server";

export default async function GroupNextStep() {
  const today = detroitToday(), enrollment = chooseEnrollment(await memberEnrollments(), today);
  if (!enrollment?.sessions) return null;
  const program = enrollment.sessions, phase = sessionPhase(program, today), db = await createClient();
  const [intake, payment, meeting, agreement] = await Promise.all([
    db.from("member_intakes").select("reviewed_at").eq("enrollment_id", enrollment.id).maybeSingle(),
    db.from("payment_records").select("status").eq("enrollment_id", enrollment.id).maybeSingle(),
    db.from("class_meetings").select("title,starts_at,is_zoom").eq("session_id", enrollment.session_id).eq("cancelled", false).gte("ends_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
    enrollment.risk_agreement_required ? db.from("risk_agreements").select("id").eq("enrollment_id", enrollment.id).maybeSingle() : Promise.resolve({ data: { id: "legacy" }, error: null }),
  ]);
  if ([intake, payment, meeting, agreement].some(result => result.error)) throw new Error("Your next class step could not be loaded.");
  const paid = ["paid", "waived", "credited"].includes(payment.data?.status ?? "");
  const ready = Boolean(intake.data?.reviewed_at && agreement.data && paid && enrollment.status === "active");
  return <section className="member-card group-next-step">
    <span className="member-kicker">Your classes · {phase === "upcoming" ? `Starts ${dateLabel(program.starts_on)}` : phase === "finished" ? "Session complete" : "Current session"}</span>
    <h2>{program.name}</h2>
    {phase === "finished" ? <p>View your session details and keep building your progress story.</p> : <>
      <p>{!intake.data ? "Your place is reserved. Complete your private intake so Kelsey can review it before you participate." : !agreement.data ? "Your intake is in. Read and sign the class Assumption of Risk before Kelsey activates your enrollment." : !intake.data.reviewed_at ? "Your intake and agreement are with Kelsey for review. She’ll contact you if she needs anything else." : ready ? "Your intake, agreement, and payment are confirmed. You’re ready for your session." : "Your intake is reviewed. Kelsey will confirm your payment arrangement and participation status."}</p>
      {!paid && <p>Payment is pending. You can arrange Venmo, cash, or check with Kelsey before your first class.</p>}
      {meeting.data && <p><strong>Next scheduled class:</strong> {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" }).format(new Date(meeting.data.starts_at))} · {meeting.data.is_zoom ? "Zoom" : "At Burroughs"}. Check the calendar to see your selected classes.</p>}
    </>}
    <div className="member-actions">
      {phase === "finished" && <Link className="member-button" href="/portal/renew">Join the next session</Link>}
      {phase !== "finished" && !intake.data && <Link className="member-button" href={`/portal/intake?enrollment=${enrollment.id}`}>Complete my intake</Link>}
      {phase !== "finished" && intake.data && !agreement.data && <Link className="member-button" href={`/portal/intake?enrollment=${enrollment.id}`}>Sign class agreement</Link>}
      <Link className="member-button secondary" href={`/portal/session?enrollment=${enrollment.id}`}>Classes & membership →</Link>
    </div>
  </section>;
}
