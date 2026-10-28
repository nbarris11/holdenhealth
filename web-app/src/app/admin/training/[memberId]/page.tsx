import BillingActionForm from "@/components/billing-action-form";
import TrainingBillingAdmin from "@/components/training-billing-admin";
import { withdrawPersonalTraining, addTrainingAppointment, emailTrainingIntakeLink, enablePersonalTraining, removeTrainingAppointment, respondToWorkout, reviewTrainingIntake } from "@/app/training-actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { intakeFieldLabel, personalTrainingIntakeSections } from "@/lib/personal-training-intake";
import RiskAgreementAdmin, { type SavedRiskAgreement } from "@/components/risk-agreement-admin";
import TrainingSessionPlansAdmin from "@/components/training-session-plans-admin";
import { detroitToday } from "@/lib/challenge";

type PageProps = { params: Promise<{ memberId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type Option = { option_code: string; label: string; estimated_minutes: number; plan: string };
type Workout = { id: string; title: string; scheduled_for: string; status: string; recommended_option: string; workout_options: Option[] };
type CurrentWorkout = { id: string; title: string; publish_on: string; minutes: number };
type Feedback = { response: string };
type Log = { id: string; option_code: string; energy_before: number; effort: number; completion_note: string | null; personal_win: string | null; completed_at: string; scheduled_workouts: { title: string } | null; workout_feedback: Feedback | null };
type TrainingIntake = { responses: Record<string, Record<string, unknown>>; health_review_required: boolean; signed_name: string; submitted_at: string; reviewed_at: string | null };
type Appointment = { id: string; session_date: string; session_time: string; duration_minutes: number; location_note: string | null };

function futureDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function PersonalTrainingAdminPage({ params, searchParams }: PageProps) {
  await verifyAdmin();
  const { memberId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, { data: contact }, { data: relationship }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,phone").eq("id", memberId).maybeSingle(),
    supabase.from("member_contacts").select("email").eq("user_id", memberId).maybeSingle(),
    supabase.from("coaching_relationships").select("id,service_mode,status,primary_goal,available_equipment,starts_on,next_review_on").eq("member_id", memberId).maybeSingle(),
  ]);
  if (!profile) notFound();
  const notice = query.message === "client-added" ? "Personal-training client added and intake email sent." : query.message === "workout-created" ? "Workout published to the member portal." : query.message === "response-saved" ? "Your coaching response is now in the member's progress story." : query.message === "appointment-added" ? "Appointment added to the client's portal." : query.message === "appointment-removed" ? "Appointment removed." : query.message === "intake-reviewed" ? "Intake marked reviewed." : query.message === "intake-email-sent" ? "Private intake email sent." : query.message === "session-plan-saved" ? "In-person session plan saved." : "";

  if (!relationship) return <main className="app-shell admin-shell workspace-page training-admin-page">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/people">← People</Link><span className="eyebrow">Personal training</span><h1>{profile.full_name || "Member"}</h1><p>{contact?.email || "No email saved"}{profile.phone ? ` · ${profile.phone}` : ""}</p></div></header>
    <section className="panel training-activation-card"><div><span className="eyebrow">Start one-to-one coaching</span><h2>Set up the coaching relationship first.</h2><p>This does not change or remove any Focus on You group enrollment. The member can use both services from the same account.</p></div><form className="stack-form" action={enablePersonalTraining}><input type="hidden" name="memberId" value={memberId} /><div className="field-grid"><label>Coaching format<select name="serviceMode" defaultValue="online"><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label><label>Starts on<input type="date" name="startsOn" defaultValue={futureDate(0)} required /></label></div><label>Primary goal<textarea name="primaryGoal" placeholder="What this member is working toward and what success should feel like" required /></label><label>Available equipment<textarea name="availableEquipment" placeholder="Home dumbbells, resistance bands, full gym..." /></label><label>First plan review<input type="date" name="nextReviewOn" defaultValue={futureDate(28)} /></label><button className="button primary" type="submit">Activate personal training</button></form></section>
  </main>;

  const [{ data: workoutData }, { data: logData }, { data: resets }, intakeResult, appointmentResult, agreementResult, structuredLogs, currentWorkoutResult] = await Promise.all([
    supabase.from("scheduled_workouts").select("id,title,scheduled_for,status,recommended_option,workout_options(option_code,label,estimated_minutes,plan)").eq("relationship_id", relationship.id).order("scheduled_for", { ascending: false }),
    supabase.from("workout_logs").select("id,option_code,energy_before,effort,completion_note,personal_win,completed_at,scheduled_workouts(title),workout_feedback(response)").eq("member_id", memberId).order("completed_at", { ascending: false }),
    supabase.from("week_resets").select("id,reset_on,remaining_sessions,energy,member_note,created_at").eq("relationship_id", relationship.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("personal_training_intakes").select("responses,health_review_required,signed_name,submitted_at,reviewed_at").eq("relationship_id", relationship.id).maybeSingle(),
    supabase.from("personal_training_appointments").select("id,session_date,session_time,duration_minutes,location_note").eq("relationship_id", relationship.id).order("session_date").order("session_time"),
    supabase.from("risk_agreements").select("id,document_version,document_text,printed_name,signature,signed_on,signed_at,acknowledgments,representative_name,representative_signed_on,representative_signed_at").eq("relationship_id", relationship.id).maybeSingle(),
    supabase.from("challenge_workout_logs").select("workout_id", {count: "exact"}).eq("relationship_id", relationship.id).eq("status", "completed"),
    supabase.from("challenge_workouts").select("id,title,publish_on,minutes").eq("relationship_id", relationship.id).eq("published", true).eq("archived", false).order("publish_on", { ascending: true }),
  ]);
  if (intakeResult.error || appointmentResult.error || agreementResult.error || structuredLogs.error || currentWorkoutResult.error || workoutData === null || logData === null) throw new Error("Personal training setup could not be loaded.");
  const intake = intakeResult.data as TrainingIntake | null;
  const appointments = (appointmentResult.data ?? []) as Appointment[];
  const workouts = (workoutData ?? []) as unknown as Workout[];
  const currentWorkouts = (currentWorkoutResult.data ?? []) as CurrentWorkout[];
  const completedWorkoutIds = new Set((structuredLogs.data ?? []).map(log => log.workout_id));
  const today = detroitToday();
  const logs = (logData ?? []) as unknown as Log[];

  return <main className="app-shell admin-shell workspace-page training-admin-page">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/people">← People</Link><span className="eyebrow">Personal training workspace</span><h1>{profile.full_name || "Member"}</h1><p>{contact?.email || "No email saved"} · {relationship.service_mode.replace("_", " ")}</p></div><Link className="button secondary" href="/admin/people">Open member list</Link></header>
    {notice ? <p className="notice success" role="status">{notice}</p> : null}
    <section className="member-status-summary panel"><div><span className="eyebrow">Coaching snapshot</span><h2>{relationship.primary_goal || "Goal to discuss"}</h2></div><dl><div><dt>Status</dt><dd>{relationship.status}</dd></div><div><dt>Equipment</dt><dd>{relationship.available_equipment || "Not recorded"}</dd></div><div><dt>Next review</dt><dd>{relationship.next_review_on || "Not scheduled"}</dd></div><div><dt>Completed</dt><dd>{logs.length + (structuredLogs.count ?? 0)} workouts</dd></div></dl></section>

    <section className="panel" aria-label="Personal training membership">
      {relationship.status === "withdrawn" ? <><h2>Personal training withdrawn</h2><p>This client has been removed from the current PT lists. Their history is saved. Review any outstanding bills below.</p></> : <>
        <h2>Personal training membership</h2>
        <details><summary>Withdraw from personal training</summary>
          <p>Remove this client from current PT lists and cancel today’s and future PT appointments. Their history and any class enrollment stay saved. Existing bills are not refunded or voided; review them below.</p>
          <BillingActionForm action={withdrawPersonalTraining} confirm={`Withdraw ${profile.full_name || "this client"} from personal training and cancel today’s and future PT appointments?`}>
            <input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="relationshipId" value={relationship.id} />
            <label className="check-label"><input type="checkbox" name="confirmWithdrawal" value="yes" required />I confirm this client is leaving personal training.</label>
            <button className="button secondary" type="submit">Withdraw client</button>
          </BillingActionForm>
        </details>
      </>}
    </section>

    <section id="intake" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Private setup</span><h2>Personal training intake</h2></div><p>{intake ? intake.reviewed_at ? "Reviewed" : "Ready for review" : "Waiting for the client to submit"}</p></div>
      {intake ? <div className="panel intake-admin-card">{intake.health_review_required && <p className="notice warning">A health answer needs private follow-up before training.</p>}
        <p>Submitted by {intake.signed_name} on {new Date(intake.submitted_at).toLocaleDateString("en-US")}.</p>
        <div className="intake-admin-sections">{Object.entries(intake.responses).map(([section, answers]) => <details key={section} open={section === "healthInjuryHistory" || section === "healthSafety"}><summary>{personalTrainingIntakeSections.find(item => item.id === section)?.title || (section === "clientAcknowledgment" ? "CLIENT ACKNOWLEDGMENT" : section.replace(/([A-Z])/g, " $1"))}</summary><dl>{Object.entries(answers).map(([key, answer]) => <div key={key}><dt>{intakeFieldLabel(key)}</dt><dd>{Array.isArray(answer) ? answer.join(", ") || "—" : typeof answer === "boolean" ? answer ? "Yes" : "No" : String(answer || "—")}</dd></div>)}</dl></details>)}</div>
        {intake.reviewed_at ? <p className="notice success">Reviewed {new Date(intake.reviewed_at).toLocaleDateString("en-US")}.</p> : <form action={reviewTrainingIntake}><input type="hidden" name="memberId" value={memberId} /><button className="button primary" type="submit">Mark intake reviewed</button></form>}
      </div> : <div className="panel calm-empty"><p>The client can open the private intake from their portal. New clients receive the link in their setup email.</p>{contact?.email && relationship.status !== "withdrawn" && <form action={emailTrainingIntakeLink}><input type="hidden" name="memberId" value={memberId} /><button className="button secondary" type="submit">Email intake link</button></form>}</div>}
    </section>

    <TrainingBillingAdmin relationshipId={relationship.id} allowCreate={relationship.status !== "withdrawn"} />

    <RiskAgreementAdmin agreement={agreementResult.data as SavedRiskAgreement | null} context="personal_training" subjectId={relationship.id} memberId={memberId} />

    {relationship.service_mode !== "online" && <section id="appointments" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">In-person coaching</span><h2>Appointments</h2></div><p>Times are shown to the client in Eastern time. Add each visit as you confirm it.</p></div>
      {relationship.status === "active" && <div className="panel"><form className="stack-form" action={addTrainingAppointment}><input type="hidden" name="memberId" value={memberId} /><div className="field-grid"><label>Date<input type="date" name="sessionDate" required /></label><label>Time (Eastern)<input type="time" name="sessionTime" required /></label></div><div className="field-grid"><label>Length in minutes<input type="number" name="durationMinutes" min="15" max="240" defaultValue="60" required /></label><label>Location or arrival note<input name="locationNote" placeholder="Optional" maxLength={300} /></label></div><button className="button primary" type="submit">Add appointment</button></form></div>}
      <div className="admin-workout-grid">{appointments.length ? appointments.map(appointment => <article className="panel" key={appointment.id}><h3>{appointment.session_date} at {appointment.session_time.slice(0, 5)} Eastern</h3><p>{appointment.duration_minutes} minutes{appointment.location_note ? ` · ${appointment.location_note}` : ""}</p><form action={removeTrainingAppointment}><input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="appointmentId" value={appointment.id} /><button className="button secondary" type="submit">Remove appointment</button></form></article>) : <div className="panel calm-empty"><p>No in-person appointments saved yet.</p></div>}</div>
    </section>}

    <TrainingSessionPlansAdmin memberId={memberId} relationshipId={relationship.id} allowEdit={relationship.status !== "withdrawn"} />

    <section className="panel"><h2>Workouts and weekly habits</h2><p>{relationship.status === "withdrawn" ? "Review this client’s saved workouts, check-ins, and habits." : "Build one workout with exercises, reps, demonstration links, and a timer. Your client also has three habits each week."}</p><div className="button-row"><Link className="button primary" href={`/admin/training/workouts/${relationship.id}`}>{relationship.status === "withdrawn" ? "Workout history" : "Build workouts"}</Link><Link className="button secondary" href={`/admin/training/${memberId}/habits`}>Weekly habits</Link><Link className="button secondary" href={`/admin/training/workouts/${relationship.id}#check-ins`}>Workout check-ins</Link></div></section>

    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Current workout builder</span><h2>Upcoming and completed workouts</h2></div><p>Published workouts appear in the client’s portal on their release date.</p></div><div className="admin-workout-grid">{currentWorkouts.length ? currentWorkouts.map((workout) => { const completed = completedWorkoutIds.has(workout.id); const scheduled = workout.publish_on > today; return <article className="panel" key={workout.id}><div className="roster-heading"><div><span className="eyebrow">{workout.publish_on} · {workout.minutes} min</span><h3>{workout.title}</h3></div><span className={`status-pill ${completed ? "success" : scheduled ? "warning" : "neutral"}`}>{completed ? "Completed" : scheduled ? "Scheduled" : "Available"}</span></div><Link className="button secondary" href={`/admin/training/workouts/${relationship.id}#workout-${workout.id}`}>View or edit workout</Link></article>; }) : <div className="panel calm-empty"><p>No current workouts published yet. Open Build workouts to publish one.</p></div>}</div></section>

    {workouts.length > 0 && <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Earlier workout format</span><h2>Earlier three-plan workouts</h2></div><p>These written Plan A/B/C workouts are separate from the current workout builder.</p></div><div className="admin-workout-grid">{workouts.map((workout) => <article className="panel" key={workout.id}><div className="roster-heading"><div><span className="eyebrow">{workout.scheduled_for}</span><h3>{workout.title}</h3></div><span className={`status-pill ${workout.status === "completed" ? "success" : workout.status === "deferred" ? "neutral" : "warning"}`}>{workout.status === "deferred" ? "Adjusted" : workout.status}</span></div><p>Recommended: Plan {workout.recommended_option}</p><div className="mini-option-list">{workout.workout_options.sort((a, b) => a.option_code.localeCompare(b.option_code)).map((option) => <details key={option.option_code}><summary>Plan {option.option_code} · {option.label} · {option.estimated_minutes} min</summary><pre>{option.plan}</pre></details>)}</div></article>)}</div></section>}

    {logs.length > 0 && <section id="progress" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Progress and coaching</span><h2>Respond with the whole week in view.</h2></div><p>Plan choice is useful context, not a grade.</p></div><div className="member-checkin-history">{logs.length ? logs.map((log) => <details className={`panel ${log.workout_feedback ? "" : "needs-action"}`} open={!log.workout_feedback} key={log.id}><summary><span><strong>{log.scheduled_workouts?.title || "Completed workout"}</strong><small>Plan {log.option_code} · Energy {log.energy_before}/5 · Effort {log.effort}/10</small></span><span className={`status-pill ${log.workout_feedback ? "success" : "warning"}`}>{log.workout_feedback ? "Responded" : "Reply helpful"}</span></summary>{log.personal_win ? <p><strong>Member&apos;s win:</strong> {log.personal_win}</p> : null}{log.completion_note ? <div className="soft-note">{log.completion_note}</div> : null}<form className="stack-form" action={respondToWorkout}><input type="hidden" name="workoutLogId" value={log.id} /><input type="hidden" name="memberId" value={memberId} /><label>Your response<textarea name="response" defaultValue={log.workout_feedback?.response ?? ""} required /></label><button className="button primary" type="submit">Save coaching response</button></form></details>) : <div className="panel calm-empty"><p>Completed workouts and member notes will collect here.</p></div>}</div></section>}

    {(resets ?? []).length ? <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Wednesday Reset history</span><h2>How the plan adapted</h2></div></div><div className="reset-history-grid">{(resets ?? []).map((reset) => <article className="panel" key={reset.id}><strong>{reset.reset_on}</strong><p>{reset.remaining_sessions} workout day{reset.remaining_sessions === 1 ? "" : "s"} left · {reset.energy} energy</p>{reset.member_note ? <small>{reset.member_note}</small> : null}</article>)}</div></section> : null}
  </main>;
}
