import { setAttendanceSelection, signOut, submitWeeklyCheckIn } from "@/app/actions";
import { stopMemberPreview } from "@/app/admin/preview-actions";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

type SessionSummary = {
  id: string;
  name: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  address_line: string;
  city: string;
  state: string;
};

type Meeting = { id: string; starts_at: string; ends_at: string; title: string; notes: string | null; cancelled: boolean };
type Announcement = { id: string; title: string; body: string; published_at: string };
type Resource = { id: string; title: string; description: string | null; url: string };
type CheckIn = { id: string; week_number: number; went_well: string; did_not_go_well: string; upcoming_goal: string; support_needed: string; submitted_at: string; reviewed_at: string | null; coach_response: string | null };

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function currentWeek(startsOn: string, endsOn: string) {
  const now = new Date();
  const start = new Date(`${startsOn}T12:00:00Z`);
  const end = new Date(`${endsOn}T12:00:00Z`);
  if (now < start) return 1;
  const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 86400000) / 604800000));
  return Math.min(totalWeeks, Math.max(1, Math.floor((now.getTime() - start.getTime()) / 604800000) + 1));
}

export default async function PortalPage() {
  const auth = await verifySession();
  const supabase = await createClient();
  const { data: adminRole } = await supabase.from("staff_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
  const requestedMemberId = adminRole ? (await cookies()).get("holden_admin_member_preview")?.value : null;
  const effectiveUserId = requestedMemberId ?? auth.userId;
  const isMemberPreview = Boolean(adminRole && requestedMemberId);
  const [{ data: profile }, { data: enrollmentRows }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", effectiveUserId).maybeSingle(),
    supabase.from("enrollments").select("id,status,session_id,returning_member,weekly_commitment,sessions(id,name,description,starts_on,ends_on,address_line,city,state)").eq("member_id", effectiveUserId).in("status", ["invited", "active", "completed"]).order("created_at", { ascending: false }).limit(1),
  ]);

  const enrollment = enrollmentRows?.[0];
  const program = enrollment?.sessions as unknown as SessionSummary | null;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  if (!enrollment || !program) {
    return (
      <main className="app-shell">
        <header className="app-header"><div><span className="eyebrow">Holden Health member portal</span><h1>Hi, {firstName}.</h1></div><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
        <section className="panel empty-state"><span className="eyebrow">Account ready</span><h2>Your session will appear after your registration is approved.</h2><p>If you have already paid or spoken with Kelsey, she may still be finishing the setup.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com">Contact Holden Health</a></section>
      </main>
    );
  }

  const [{ data: meetings }, { data: selections }, { data: announcements }, { data: resources }, { data: checkIns }, { data: payment }] = await Promise.all([
    supabase.from("class_meetings").select("id,starts_at,ends_at,title,notes,cancelled").eq("session_id", enrollment.session_id).order("starts_at"),
    supabase.from("attendance_selections").select("meeting_id,attended").eq("enrollment_id", enrollment.id),
    supabase.from("announcements").select("id,title,body,published_at").eq("session_id", enrollment.session_id).not("published_at", "is", null).order("published_at", { ascending: false }),
    supabase.from("resources").select("id,title,description,url").eq("session_id", enrollment.session_id).eq("published", true).order("sort_order"),
    supabase.from("check_ins").select("id,week_number,went_well,did_not_go_well,upcoming_goal,support_needed,submitted_at,reviewed_at,coach_response").eq("enrollment_id", enrollment.id).order("week_number", { ascending: false }),
    supabase.from("payment_records").select("status,method,amount_cents,received_on").eq("enrollment_id", enrollment.id).maybeSingle(),
  ]);

  const typedMeetings = (meetings ?? []) as Meeting[];
  const selectedMeetingIds = new Set((selections ?? []).map((selection) => selection.meeting_id));
  const nextMeeting = typedMeetings.find((meeting) => !meeting.cancelled && new Date(meeting.starts_at) >= new Date());
  const weekNumber = currentWeek(program.starts_on, program.ends_on);
  const typedCheckIns = (checkIns ?? []) as CheckIn[];
  const currentCheckIn = typedCheckIns.find((checkIn) => checkIn.week_number === weekNumber);
  const paymentLabel = payment?.status === "paid" ? "Paid" : payment?.status === "waived" ? "Waived" : payment?.status === "credited" ? "Credited" : "Payment pending";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><span className="eyebrow">Holden Health member portal</span><h1>Hi, {firstName}.</h1></div>
        {isMemberPreview ? <form action={stopMemberPreview}><button className="button secondary" type="submit">Return to admin</button></form> : <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>}
      </header>

      {isMemberPreview ? <aside className="preview-banner"><strong>Admin preview: viewing the portal as {profile?.full_name || "this member"}.</strong><span>This view is read-only.</span></aside> : null}

      <nav className="section-nav" aria-label="Member sections">
        <a href="#overview">Overview</a><a href="#schedule">Schedule</a><a href="#check-in">Check-in</a><a href="#resources">Resources</a><a href="#details">Session details</a>
      </nav>

      <section id="overview" className="member-hero panel">
        <div><span className="eyebrow">Your current session · Week {weekNumber}</span><h2>{program.name}</h2><p>{program.description}</p><div className="meta-row"><span>{dateFormatter.format(new Date(`${program.starts_on}T12:00:00Z`))}–{dateFormatter.format(new Date(`${program.ends_on}T12:00:00Z`))}</span><span>{program.address_line}, {program.city}, {program.state}</span></div></div>
        <aside><span className={`status-pill ${payment?.status === "paid" ? "success" : "warning"}`}>{paymentLabel}</span><strong>{enrollment.status === "active" ? "You’re enrolled" : "Invitation accepted"}</strong>{enrollment.weekly_commitment ? <p>{enrollment.weekly_commitment} coached days each week.</p> : null}<p>{payment?.amount_cents ? `$${(payment.amount_cents / 100).toFixed(0)} recorded${payment.method ? ` via ${payment.method}` : ""}.` : "Kelsey will update your payment status here."}</p></aside>
      </section>

      <div className="dashboard-grid summary-grid">
        <section className="panel"><span className="eyebrow">Up next</span><h2>{nextMeeting ? dateTimeFormatter.format(new Date(nextMeeting.starts_at)) : "Schedule complete"}</h2><p>{nextMeeting?.title ?? "Your current class calendar is complete."}</p></section>
        <section className="panel"><span className="eyebrow">Latest update</span>{(announcements as Announcement[] | null)?.[0] ? <><h2>{(announcements as Announcement[])[0].title}</h2><p>{(announcements as Announcement[])[0].body}</p></> : <><h2>You’re all caught up.</h2><p>Session announcements will appear here.</p></>}</section>
        <section className="panel accent-panel"><span className="eyebrow">Need Kelsey?</span><h2>Questions count.</h2><p>Reach out between check-ins when you need clarification or support.</p><a className="text-link" href="mailto:HoldenHealth.Coaching@gmail.com">Email Holden Health →</a></section>
      </div>

      <section id="schedule" className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Your class plan</span><h2>Choose the days you expect to attend.</h2></div><p>You can switch days when life changes. Your choices help Kelsey prepare the room; they are not strict reservations.</p></div>
        <div className="meeting-list">
          {typedMeetings.map((meeting) => {
            const selected = selectedMeetingIds.has(meeting.id);
            return <article className={`meeting-row ${selected ? "selected" : ""} ${meeting.cancelled ? "cancelled" : ""}`} key={meeting.id}>
              <div><strong>{dateTimeFormatter.format(new Date(meeting.starts_at))}</strong><span>{meeting.cancelled ? "Cancelled" : meeting.title}</span></div>
              {!meeting.cancelled && enrollment.status === "active" && !isMemberPreview ? <form action={setAttendanceSelection}><input type="hidden" name="enrollmentId" value={enrollment.id} /><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="selected" value={selected ? "false" : "true"} /><button className={`choice-button ${selected ? "chosen" : ""}`} type="submit">{selected ? "✓ Planning to attend" : "+ Add to my week"}</button></form> : isMemberPreview && selected ? <span className="status-pill success">Planning to attend</span> : null}
            </article>;
          })}
        </div>
      </section>

      <section id="check-in" className="section-block split-layout">
        <div className="panel">
          <span className="eyebrow">Week {weekNumber} check-in</span>
          {currentCheckIn ? <><h2>Submitted—thank you.</h2><p>Kelsey {currentCheckIn.reviewed_at ? "has reviewed" : "will review"} your answers.</p>{currentCheckIn.coach_response ? <div className="coach-note"><strong>A note back</strong><p>{currentCheckIn.coach_response}</p></div> : <div className="soft-note">Kelsey’s response will appear here.</div>}</> : enrollment.status === "active" && !isMemberPreview ? <><h2>Take five honest minutes.</h2><form className="stack-form" action={submitWeeklyCheckIn}><input type="hidden" name="enrollmentId" value={enrollment.id} /><input type="hidden" name="weekNumber" value={weekNumber} /><label>What went well for you this week?<textarea name="wentWell" required /></label><label>What did not go well?<textarea name="didNotGoWell" required /></label><label>What is your main goal for the upcoming week?<textarea name="upcomingGoal" required /></label><label>What do you need more from me to be successful this week?<textarea name="supportNeeded" required /></label><button className="button primary" type="submit">Send my check-in</button></form></> : isMemberPreview ? <><h2>No check-in for this week yet.</h2><p>The member will see the four-question form here.</p></> : <><h2>Your check-in opens when enrollment is active.</h2><p>Kelsey will activate it after registration is complete.</p></>}
        </div>
        <aside className="panel compact-history"><span className="eyebrow">Check-in history</span><h2>Your coaching thread.</h2>{typedCheckIns.length ? typedCheckIns.map((checkIn) => <details key={checkIn.id}><summary>Week {checkIn.week_number} · {checkIn.reviewed_at ? "Reviewed" : "Awaiting response"}</summary><p><strong>What worked:</strong> {checkIn.went_well}</p><p><strong>Next goal:</strong> {checkIn.upcoming_goal}</p>{checkIn.coach_response ? <p><strong>Kelsey:</strong> {checkIn.coach_response}</p> : null}</details>) : <p>Your submitted check-ins will stay here so you can look back at what changed.</p>}</aside>
      </section>

      <section id="resources" className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Member resources</span><h2>Useful, not overwhelming.</h2></div><p>Kelsey’s approved session, nutrition, habit, and recovery guidance.</p></div>
        <div className="resource-grid">{(resources as Resource[] | null)?.length ? (resources as Resource[]).map((resource) => <a className="resource-card" href={resource.url} target="_blank" rel="noreferrer" key={resource.id}><span>Open resource ↗</span><h3>{resource.title}</h3><p>{resource.description ?? "View this Holden Health resource."}</p></a>) : <section className="panel empty-inline"><h3>Resources are being prepared.</h3><p>Kelsey can publish guides here from her admin dashboard.</p></section>}</div>
      </section>

      <section id="details" className="section-block details-grid">
        <div className="panel"><span className="eyebrow">What to expect</span><h2>Total-body conditioning.</h2><p>We may use dumbbells, stability balls, medicine balls, cardio machines, resistance bands, body weight, and fitness machines. All equipment is provided.</p></div>
        <div className="panel"><span className="eyebrow">What to bring</span><h2>Come ready to move.</h2><ul className="plain-list"><li>Comfortable workout clothes</li><li>Supportive athletic shoes</li><li>Water bottle</li><li>Your real energy level—no performance required</li></ul></div>
        <div className="panel"><span className="eyebrow">Attendance policy</span><h2>Your days can change.</h2><p>Missed classes are not refundable. You may attend another available class during the same session, but make-ups do not carry into a future session.</p></div>
      </section>
    </main>
  );
}
