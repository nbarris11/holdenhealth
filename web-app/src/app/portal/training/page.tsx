import PersonalWorkoutList from "@/components/personal-workout-list";
import MemberActionForm from "@/components/member-action-form";
import { detroitToday } from "@/lib/challenge";
import { ARRIVAL_DIRECTIONS } from "@/lib/member-session";
import { signOut } from "@/app/actions";
import { stopMemberPreview } from "@/app/admin/preview-actions";
import { completePersonalWorkout } from "@/app/training-actions";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";

type TrainingPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type WorkoutOption = { id: string; option_code: "A" | "B" | "C"; label: string; estimated_minutes: number; plan: string };
type Workout = { id: string; scheduled_for: string; title: string; focus: string | null; coach_note: string | null; recommended_option: "A" | "B" | "C"; status: "scheduled" | "completed" | "deferred"; deferred_reason: string | null; workout_options: WorkoutOption[] };
type Feedback = { response: string; created_at: string };
type Log = { id: string; workout_id: string; option_code: string; energy_before: number; effort: number; completion_note: string | null; personal_win: string | null; completed_at: string; workout_feedback: Feedback | null; scheduled_workouts: { title: string; scheduled_for: string } | null };
type Appointment = { id: string; session_date: string; session_time: string; duration_minutes: number; location_note: string | null };
type SessionPlan = { id: string; session_date: string; title: string; plan: string };

const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function optionName(code: string) {
  return code === "A" ? "Full plan" : code === "B" ? "Shorter plan" : "Keep-the-promise plan";
}

export default async function TrainingPage({ searchParams }: TrainingPageProps) {
  const auth = await verifySession();
  const query = await searchParams;
  const supabase = await createClient();
  const { data: adminRole } = await supabase.from("staff_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
  const requestedEnrollmentId = adminRole ? (await cookies()).get("holden_admin_enrollment_preview")?.value : null;
  const { data: previewEnrollment } = requestedEnrollmentId ? await supabase.from("enrollments").select("member_id").eq("id", requestedEnrollmentId).maybeSingle() : { data: null };
  const effectiveUserId = previewEnrollment?.member_id ?? auth.userId;
  const isMemberPreview = Boolean(adminRole && previewEnrollment);
  const accountResults = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", effectiveUserId).maybeSingle(),
    supabase.from("coaching_relationships").select("id,service_mode,status,primary_goal,available_equipment,starts_on,next_review_on").eq("member_id", effectiveUserId).maybeSingle(),
  ]);
  if (accountResults.some(result => result.error)) throw new Error("Your coaching information could not be loaded.");
  const [{ data: profile }, { data: relationship }] = accountResults;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  if (!relationship) return <main className="app-shell training-shell">
    <header className="app-header"><div><span className="eyebrow">Holden Health personal training</span><h1>Hi, {firstName}.</h1></div>{isMemberPreview ? <form action={stopMemberPreview}><button className="button secondary" type="submit">Return to admin</button></form> : <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>}</header>
    <section className="panel empty-state"><span className="eyebrow">Personal training</span><h2>Your individual plan is not active yet.</h2><p>Kelsey will let you know when your first workout is ready. You can return to Today for your other programs or contact Kelsey for help.</p><Link className="button primary" href="/portal">Return to my portal</Link></section>
  </main>;

  const planResults = await Promise.all([
    supabase.from("scheduled_workouts").select("id,scheduled_for,title,focus,coach_note,recommended_option,status,deferred_reason,workout_options(id,option_code,label,estimated_minutes,plan)").eq("relationship_id", relationship.id).order("scheduled_for"),
    supabase.from("workout_logs").select("id,workout_id,option_code,energy_before,effort,completion_note,personal_win,completed_at,workout_feedback(response,created_at),scheduled_workouts(title,scheduled_for)").eq("member_id", effectiveUserId).order("completed_at", { ascending: false }),
    supabase.from("week_resets").select("id,reset_on,remaining_sessions,energy,created_at").eq("relationship_id", relationship.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("personal_training_intakes").select("submitted_at,reviewed_at").eq("relationship_id", relationship.id).maybeSingle(),
    supabase.from("risk_agreements").select("signed_at").eq("relationship_id", relationship.id).maybeSingle(),
    supabase.from("personal_training_appointments").select("id,session_date,session_time,duration_minutes,location_note").eq("relationship_id", relationship.id).order("session_date").order("session_time"),
    supabase.from("personal_training_session_plans").select("id,session_date,title,plan").eq("relationship_id", relationship.id).eq("member_visible", true).order("session_date", { ascending: false }),
  ]);
  if (planResults.some(result => result.error)) throw new Error("Your personal plan could not be loaded. Please try again.");
  const [{ data: workoutData }, { data: logData }, { data: resetData }, { data: intake }, { data: agreement }, { data: appointmentData }, { data: sessionPlanData }] = planResults;
  const appointments = (appointmentData ?? []) as Appointment[];
  const sessionPlans = (sessionPlanData ?? []) as SessionPlan[];
  const canChange = relationship.status === "active" && !isMemberPreview;
  const today = detroitToday();
  const workouts = (workoutData ?? []) as unknown as Workout[];
  const logs = (logData ?? []) as unknown as Log[];
  const upcoming = workouts.filter((workout) => workout.status === "scheduled");
  const nextWorkout = upcoming[0];
  const plannedToDate = workouts.filter(workout => workout.status === "completed" || (workout.status === "scheduled" && workout.scheduled_for <= today)).length;
  const message = query.message === "workout-complete" ? "Workout saved. That effort counts." : query.message === "week-reset" ? "Your weekly reset is saved. Workouts set aside remain available to read; Kelsey can help add them back when you’re ready." : "";

  return <main className="app-shell training-shell">
    <header className="app-header"><div><span className="eyebrow">Holden Health personal training</span><h1>Hi, {firstName}.</h1><p>Your plan can flex without disappearing.</p></div>{isMemberPreview ? <form action={stopMemberPreview}><button className="button secondary" type="submit">Return to admin</button></form> : <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>}</header>
    {isMemberPreview ? <aside className="preview-banner"><strong>Admin preview: this personal-training page is read-only.</strong></aside> : null}
    {message ? <p className="notice success" role="status">{message}</p> : null}
    <nav className="section-nav" aria-label="Personal training sections"><Link href="/portal">Today</Link><a href="#assigned-workouts">Workouts</a>{!isMemberPreview && <Link href="/portal/training/habits">Weekly habits</Link>}{relationship.service_mode !== "online" && <a href="#appointments">Appointments</a>}{sessionPlans.length > 0 && <a href="#session-plans">Session plans</a>}{workouts.length > 0 && <a href="#plan">Earlier plans</a>}<a href="#weekly-check-in">Weekly check-in</a><Link href="/portal/progress">Progress</Link>{!isMemberPreview && <Link href="/portal/training/billing">Billing</Link>}</nav>

    {relationship.status !== "active" && <section className="panel"><h2>{relationship.status === "paused" ? "Your personal plan is paused" : "Your personal plan is not active"}</h2><p>You can read your plan and saved progress. Contact Kelsey before resuming workouts or changing your week.</p><a href="mailto:HoldenHealth.Coaching@gmail.com">Contact Kelsey →</a></section>}
    <section className="panel"><h2>Your private setup</h2><p>{!intake ? "Complete your private intake so Kelsey can plan your training safely." : !agreement ? "Your intake was received. Please sign the Assumption of Risk before training." : intake.reviewed_at ? "Your intake and agreement are complete. Kelsey has reviewed your intake." : "Your intake and agreement are complete. Kelsey will review your answers before you begin."}</p><Link className="button secondary" href="/portal/training/intake">{!intake ? "Complete my intake" : !agreement ? "Sign Assumption of Risk" : "View setup status"}</Link></section>
    <section className="panel"><h2>Your coaching details</h2><p>Format: {relationship.service_mode === "online" ? "Online" : relationship.service_mode === "in_person" ? "In person" : "Online and in person"} · Starts {dateLabel.format(new Date(`${relationship.starts_on}T12:00:00Z`))}</p>{relationship.next_review_on && <p>Next plan review: {dateLabel.format(new Date(`${relationship.next_review_on}T12:00:00Z`))}. This is a plan review date, not a confirmed appointment time.</p>}<p>You and Kelsey will decide your training days and times during your consultation. She will send your appointment details and any virtual meeting link by email or text. Contact her to reschedule or confirm payment arrangements. Expect a response within 2 hours to your coaching questions.</p>{relationship.service_mode !== "online" && <p>In-person sessions: 60 minutes · $100 · 41100 Plymouth Rd, Suite B1-162, Plymouth, MI. {ARRIVAL_DIRECTIONS}</p>}<a href="mailto:HoldenHealth.Coaching@gmail.com?subject=My%20personal%20training%20appointment">Contact Kelsey about my appointment →</a></section>
    {relationship.service_mode !== "online" && <section id="appointments" className="panel"><h2>Your in-person appointments</h2><p>Times are Eastern. Contact Kelsey if a date or time needs to change.</p>{appointments.length ? <ul>{appointments.map(appointment => <li key={appointment.id}><strong>{dateLabel.format(new Date(`${appointment.session_date}T12:00:00Z`))} at {new Date(`2000-01-01T${appointment.session_time.slice(0, 5)}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</strong> · {appointment.duration_minutes} minutes{appointment.location_note ? ` · ${appointment.location_note}` : ""}</li>)}</ul> : <p>Kelsey has not added an appointment yet. She will confirm your in-person dates with you.</p>}</section>}
    {sessionPlans.length > 0 && <section id="session-plans" className="section-block"><div className="section-heading"><div><span className="eyebrow">Training together</span><h2>Your coached session plans</h2></div></div><div className="training-workout-list">{sessionPlans.map(plan => <article className="panel" key={plan.id}><span className="eyebrow">{dateLabel.format(new Date(`${plan.session_date}T12:00:00Z`))}</span><h3>{plan.title}</h3><div className="workout-plan-text">{plan.plan}</div></article>)}</div></section>}
    <PersonalWorkoutList relationshipId={relationship.id} preview={isMemberPreview}/>
    {workouts.length > 0 && <><section id="today" className="training-today panel">
      <div><span className="eyebrow">Your next best step</span>{nextWorkout ? <><h2>{nextWorkout.title}</h2><p>{nextWorkout.focus || "A workout chosen for your current plan."}</p><div className="meta-row"><span>{dateLabel.format(new Date(`${nextWorkout.scheduled_for}T12:00:00Z`))}</span><span>Plan {nextWorkout.recommended_option}: {optionName(nextWorkout.recommended_option)}</span></div><a className="button primary" href={`#workout-${nextWorkout.id}`}>Open my workout</a></> : <><h2>You are caught up.</h2><p>Kelsey will add your next workout here. Recovery is part of the plan too.</p></>}</div>
      <aside><span className="eyebrow">Your coaching focus</span><strong>{relationship.primary_goal || "Build a routine that works in real life."}</strong><p>{relationship.available_equipment ? `Available equipment: ${relationship.available_equipment}` : "Kelsey will shape each workout around what you have available."}</p>{resetData ? <small>Last reset: {dateLabel.format(new Date(`${resetData.reset_on}T12:00:00Z`))}</small> : null}</aside>
    </section>

    <section id="plan" className="section-block">
      <div className="section-heading"><div><span className="eyebrow">The Real-Week Plan</span><h2>Previously assigned plans</h2></div><p>Your earlier written plans remain available below.</p></div>
      <div className="training-workout-list">{workouts.length ? workouts.map((workout) => <article className={`panel training-workout ${workout.status}`} id={`workout-${workout.id}`} key={workout.id}>
        <header><div><span className="eyebrow">{dateLabel.format(new Date(`${workout.scheduled_for}T12:00:00Z`))}</span><h3>{workout.title}</h3><p>{workout.focus}</p></div><span className={`status-pill ${workout.status === "completed" ? "success" : workout.status === "deferred" ? "neutral" : "warning"}`}>{workout.status === "deferred" ? "Adjusted, not missed" : workout.status}</span></header>
        {workout.coach_note ? <div className="coach-note"><strong>A note from Kelsey</strong><p>{workout.coach_note}</p></div> : null}
        {workout.status === "deferred" && <div className="soft-note">{workout.deferred_reason}</div>}<div className="workout-option-grid">{workout.workout_options.sort((a, b) => a.option_code.localeCompare(b.option_code)).map((option) => <details className={option.option_code === workout.recommended_option ? "recommended" : ""} open={option.option_code === workout.recommended_option} key={option.id}><summary><span><b>Plan {option.option_code}</b><strong>{option.label}</strong></span><small>{option.estimated_minutes} min{option.option_code === workout.recommended_option ? " · Recommended today" : ""}</small></summary><div className="workout-plan-text">{option.plan}</div>{workout.status === "scheduled" && canChange ? <MemberActionForm className="workout-completion-form" action={completePersonalWorkout}><input type="hidden" name="workoutId" value={workout.id} /><input type="hidden" name="optionCode" value={option.option_code} /><div className="field-grid"><label>Energy before<select name="energyBefore" defaultValue="3" required><option value="1">1 · Very low</option><option value="2">2 · Low</option><option value="3">3 · Steady</option><option value="4">4 · Good</option><option value="5">5 · Strong</option></select></label><label>Effort<select name="effort" defaultValue="7" required>{[1,2,3,4,5,6,7,8,9,10].map((value) => <option value={value} key={value}>{value}{value === 5 ? " · Moderate" : value === 7 ? " · Challenging" : value === 10 ? " · Maximum" : ""}</option>)}</select></label></div><label>What did you do or adjust?<textarea name="completionNote" placeholder="Weights, reps, substitutions, or anything Kelsey should know" /></label><label>Your win today<input name="personalWin" placeholder="I started, I felt stronger, I used the backup plan..." /></label><button className="button primary" type="submit">Complete Plan {option.option_code}</button></MemberActionForm> : null}</details>)}</div>
      </article>) : <section className="panel calm-empty"><h3>Your first workout is being prepared.</h3><p>When Kelsey publishes it, all three versions will appear here.</p></section>}</div>
    </section>

    </>}
    <section id="weekly-check-in" className="section-block panel"><span className="eyebrow">Plan your week with Kelsey</span><h2>A busy week can still include movement.</h2><p>You and Kelsey will touch base on Saturday or Sunday to talk about the week ahead. Complete your weekly check-in form and let her know how much time you have, how you’re feeling, and anything that may affect your workouts.</p><p>If you know a busy week is coming, tell Kelsey ahead of time. She can customize shorter workouts to help you fit something in. If plans change during the week, reach out so you can adjust together.</p><p>Use the weekly check-in form Kelsey sends you. If you haven’t received it, ask her for the link.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com?subject=My%20weekly%20training%20check-in">Contact Kelsey about my week →</a></section>

    {workouts.length > 0 && <section id="progress" className="section-block">
      <div className="section-heading"><div><span className="eyebrow">Your progress story</span><h2>Evidence that you kept going.</h2></div><p>Progress includes adapting well, using a backup plan, and coming back after a difficult week.</p></div>
      <div className="progress-summary-grid"><article className="panel"><strong>{logs.length}</strong><span>earlier written workouts completed</span></article><article className="panel"><strong>{logs.length} / {plannedToDate}</strong><span>workouts planned through today completed · future and set-aside sessions excluded</span></article><article className="panel"><strong>{logs.filter((log) => log.option_code !== "A").length}</strong><span>smart adjustments used</span></article></div>
      <div className="progress-timeline">{logs.length ? logs.map((log) => <article className="panel" key={log.id}><div className="timeline-mark">✓</div><div><span className="eyebrow">{new Date(log.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Plan {log.option_code}</span><h3>{log.scheduled_workouts?.title || "Completed workout"}</h3>{log.personal_win ? <p><strong>Your win:</strong> {log.personal_win}</p> : null}{log.completion_note ? <p>{log.completion_note}</p> : null}<small>Energy {log.energy_before}/5 · Effort {log.effort}/10</small>{log.workout_feedback ? <div className="coach-note"><strong>Kelsey</strong><p>{log.workout_feedback.response}</p></div> : <div className="soft-note">Kelsey can review this from your coaching record.</div>}</div></article>) : <section className="panel calm-empty"><h3>Your story starts with the first completed workout.</h3><p>No before-and-after pressure. We will build a record of strength, consistency, and useful adjustments.</p></section>}</div>
    </section>}
  </main>;
}
