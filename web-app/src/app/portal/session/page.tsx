import { setAttendanceSelection, signOut } from "@/app/actions";
import { stopMemberPreview } from "@/app/admin/preview-actions";
import { verifySession } from "@/lib/auth";
import { SIX_WEEK_CHECK_IN_URL } from "@/lib/check-in";
import { createClient } from "@/lib/supabase/server";
import { weeklyScheduleLabel, weeklyScheduleSlots } from "@/lib/class-schedule";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { memberEnrollments } from "@/lib/member-enrollments";
import { chooseEnrollment, sessionPhase, sessionWeek, sundayFor, classVisible, ARRIVAL_DIRECTIONS } from "@/lib/member-session";
import { detroitToday } from "@/lib/challenge";

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

type Announcement = { id: string; title: string; body: string; published_at: string };
type Resource = { id: string; title: string; description: string | null; url: string };
type ClassMeeting = { id: string; title: string; notes: string | null; starts_at: string; ends_at: string; cancelled: boolean; is_zoom: boolean };
type AttendanceSelection = { meeting_id: string };
type ClassZoomMeeting = { meeting_id: string; join_url: string };

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const classTimeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
const classDetailDateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Detroit" });
const classMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/Detroit" });
const calendarDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function detroitDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Detroit" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function SessionPage({ searchParams }: { searchParams: Promise<{ enrollment?: string }> }) {
  const auth = await verifySession();
  const supabase = await createClient();
  const params = await searchParams, today = detroitToday(), now = new Date().getTime();
  const { data: adminRole, error: roleError } = await supabase.from("staff_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
  if (roleError) throw new Error("Your account access could not be checked.");
  const requestedEnrollmentId = adminRole ? (await cookies()).get("holden_admin_enrollment_preview")?.value : null;
  const isMemberPreview = Boolean(adminRole && requestedEnrollmentId);
  const enrollmentRows = await memberEnrollments();
  const previewResult = requestedEnrollmentId ? await supabase.from("enrollments")
    .select("id,member_id,status,session_id,returning_member,weekly_commitment,risk_agreement_required,sessions(id,name,description,starts_on,ends_on,address_line,city,state)")
    .eq("id", requestedEnrollmentId).maybeSingle() : { data: null, error: null };
  if (previewResult.error) throw new Error("Member preview could not be loaded.");
  const enrollment = requestedEnrollmentId ? previewResult.data : chooseEnrollment(enrollmentRows, today, params.enrollment);
  const effectiveUserId = enrollment?.member_id ?? auth.userId;
  const { data: personalTraining, error: trainingError } = await supabase.from("coaching_relationships").select("id,status,primary_goal").eq("member_id", effectiveUserId).in("status", ["invited", "active", "paused"]).maybeSingle();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name,phone").eq("id", effectiveUserId).maybeSingle();
  if (trainingError || profileError) throw new Error("Your member information could not be loaded.");
  const program = enrollment?.sessions as unknown as SessionSummary | null;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  if (!enrollment || !program) {
    if (!personalTraining && !adminRole) {
      const { data: challengeMembership } = await supabase.from("challenge_participants").select("challenge_id").eq("user_id", auth.userId).order("joined_on", { ascending: false }).limit(1).maybeSingle();
      if (challengeMembership) redirect(`/challenge?id=${challengeMembership.challenge_id}`);
    }
    if (personalTraining && !adminRole) redirect("/portal/training");
    return (
      <main className="app-shell">
        <header className="app-header"><div><span className="eyebrow">Holden Health member portal</span><h1>Hi, {firstName}.</h1></div><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
        {adminRole ? <section className="panel empty-state admin-redirect-card"><span className="eyebrow">Administrator account</span><h2>{requestedEnrollmentId ? "That member preview could not be loaded." : "You’re signed in with admin access."}</h2><p>{requestedEnrollmentId ? "Return to the member list and try opening the member again." : "Choose a person from the admin member list to preview their portal."}</p><div className="button-row"><Link className="button primary" href="/admin/people">Open People</Link><a className="button secondary" href="/admin/settings">Open Settings</a></div></section> : <section className="panel empty-state"><span className="eyebrow">Account ready</span><h2>Your session will appear after your registration is approved.</h2><p><Link href="/challenge">Join or return to the free habit challenge</Link></p><p>If you have already paid or spoken with Kelsey, she may still be finishing the setup.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com">Contact Holden Health</a></section>}
      </main>
    );
  }

  const sessionResults = await Promise.all([
    supabase.from("class_meetings").select("id,title,notes,starts_at,ends_at,cancelled,is_zoom").eq("session_id", enrollment.session_id).order("starts_at"),
    supabase.from("announcements").select("id,title,body,published_at").or(`session_id.is.null,session_id.eq.${enrollment.session_id}`).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }),
    supabase.from("resources").select("id,title,description,url").eq("session_id", enrollment.session_id).eq("published", true).order("sort_order"),
    supabase.from("payment_records").select("status,method,amount_cents,received_on").eq("enrollment_id", enrollment.id).maybeSingle(),
    supabase.from("member_intakes").select("submitted_at,reviewed_at,health_review_required").eq("enrollment_id", enrollment.id).maybeSingle(),
    supabase.from("risk_agreements").select("signed_at").eq("enrollment_id", enrollment.id).maybeSingle(),
    supabase.from("attendance_selections").select("meeting_id").eq("enrollment_id", enrollment.id),
  ]);

  if (sessionResults.some(result => result.error)) throw new Error("Your session details could not be loaded. Please try again.");
  const [{ data: meetings }, { data: announcements }, { data: resources }, { data: payment }, { data: intake }, { data: agreement }, { data: attendanceSelections }] = sessionResults;
  const publishedResources = (resources ?? []) as Resource[];
  const phase = sessionPhase(program, today);
  const weekNumber = sessionWeek(program.starts_on, today);
  const dueDate = sundayFor(phase === "upcoming" ? program.starts_on : today);
  const paid = ["paid", "waived", "credited"].includes(payment?.status ?? "");
  const ready = Boolean(intake?.reviewed_at && paid && enrollment.status === "active" && (!enrollment.risk_agreement_required || agreement));
  const sessionHref = `/portal/session?enrollment=${enrollment.id}`;
  const paymentLabel = payment?.status === "paid" ? "Paid" : payment?.status === "waived" ? "Waived" : payment?.status === "credited" ? "Credited" : "Payment pending";
  const typedMeetings = (meetings ?? []) as ClassMeeting[];
  const upcomingMeetings = typedMeetings.filter((meeting) => classVisible(meeting, now));
  const selectedMeetingIds = new Set(((attendanceSelections ?? []) as AttendanceSelection[]).map((selection) => selection.meeting_id));
  const selectedZoomMeetingIds = upcomingMeetings.filter((meeting) => meeting.is_zoom && selectedMeetingIds.has(meeting.id)).map((meeting) => meeting.id);
  const { data: classZoomMeetings, error: zoomError } = selectedZoomMeetingIds.length
    ? await supabase.from("class_zoom_meetings").select("meeting_id,join_url").in("meeting_id", selectedZoomMeetingIds)
    : { data: [], error: null };
  if (zoomError) throw new Error("Class links could not be loaded. Please try again.");
  const zoomLinkMap = new Map(((classZoomMeetings ?? []) as ClassZoomMeeting[]).map((meeting) => [meeting.meeting_id, meeting.join_url]));
  const scheduleLabel = weeklyScheduleLabel(weeklyScheduleSlots(typedMeetings.filter(meeting => !meeting.cancelled)));

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><span className="eyebrow">Holden Health member portal</span><h1>Hi, {firstName}.</h1></div>
        {isMemberPreview ? <form action={stopMemberPreview}><button className="button secondary" type="submit">Return to admin</button></form> : <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>}
      </header>

      {isMemberPreview ? <aside className="preview-banner"><strong>Admin preview: viewing the portal as {profile?.full_name || "this member"}.</strong><span>This view is read-only.</span></aside> : null}

      {!isMemberPreview && enrollmentRows.length > 1 && <nav className="member-programs" aria-label="Your class sessions">{enrollmentRows.map(row => <Link className="member-pill" aria-current={row.id === enrollment.id ? "page" : undefined} key={row.id} href={`/portal/session?enrollment=${row.id}`}>{row.sessions?.name}</Link>)}</nav>}
      {phase !== "finished" && !intake && !isMemberPreview ? <section className="panel onboarding-callout"><div><span className="eyebrow">One step before you begin</span><h2>Complete your private new member intake.</h2><p>Kelsey will review your goals and health information before you participate.</p></div><Link className="button primary" href={`/portal/intake?enrollment=${enrollment.id}`}>Start my intake</Link></section> : intake && enrollment.risk_agreement_required && !agreement ? <section className="panel onboarding-callout"><div><span className="eyebrow">One step before you begin</span><h2>Sign your Assumption of Risk.</h2><p>Your intake is saved. Review the class agreement before participating.</p></div>{!isMemberPreview && <Link className="button primary" href={`/portal/intake?enrollment=${enrollment.id}`}>Review agreement</Link>}</section> : intake && !intake.reviewed_at ? <section className="panel onboarding-callout"><div><span className="eyebrow">Intake received</span><h2>Kelsey is reviewing your answers.</h2><p>{intake.health_review_required ? "Kelsey may reach out privately about one or more health answers before activation." : "Kelsey will confirm when you’re ready to participate."}</p></div><span className="status-pill warning">Review pending</span></section> : intake?.reviewed_at ? <section className="panel onboarding-callout complete"><div><span className="eyebrow">Onboarding complete</span><h2>Your intake has been reviewed.</h2><p>Your ongoing weekly check-ins will appear below while the session is active.</p></div><span className="status-pill success">Intake reviewed</span></section> : null}

      <nav className="section-nav" aria-label="Member sections">
        <a href="#overview">Overview</a><Link href={`/portal/habits?enrollment=${enrollment.id}`}>Weekly habits</Link><a href="#class-calendar">Class calendar</a>{personalTraining ? <Link href="/portal/training">Personal training</Link> : null}<a href="#check-in">Check-in</a>{publishedResources.length > 0 ? <a href="#resources">Resources</a> : null}<a href="#details">Session details</a>
      </nav>

      {personalTraining ? <section className="panel personal-training-callout"><div><span className="eyebrow">Your one-to-one plan</span><h2>{personalTraining.primary_goal || "Personal training that works around your real week."}</h2><p>Open your next workout, choose the version that fits today, plan your week with Kelsey, and see Kelsey&apos;s feedback.</p></div><Link className="button primary" href="/portal/training">Open personal training</Link></section> : null}

      <section id="overview" className="member-hero panel">
        <div><span className="eyebrow">{isMemberPreview ? "Member session preview" : phase === "upcoming" ? `Starts ${dateFormatter.format(new Date(`${program.starts_on}T12:00:00Z`))}` : phase === "finished" ? "Session complete" : `Your current session · Week ${weekNumber}`}</span><h2>{program.name}</h2><p>{program.description}</p><div className="meta-row"><span>{dateFormatter.format(new Date(`${program.starts_on}T12:00:00Z`))}–{dateFormatter.format(new Date(`${program.ends_on}T12:00:00Z`))}</span><span>{program.address_line}, {program.city}, {program.state}</span></div></div>
        <aside><span className={`status-pill ${paid ? "success" : "warning"}`}>{paymentLabel}</span><strong>{phase === "finished" ? "Session complete" : ready ? "Ready to participate" : "Your place is reserved"}</strong>{enrollment.weekly_commitment ? <p>{enrollment.weekly_commitment} coached days each week.</p> : null}<p><b>Weekly class times:</b> {scheduleLabel}</p><p>{payment?.status === "waived" ? "Payment waived." : payment?.status === "credited" ? "Payment credited." : payment?.amount_cents ? `$${(payment.amount_cents / 100).toFixed(0)} recorded${payment.method ? ` via ${payment.method}` : ""}.` : "Payment has not been recorded yet."}</p></aside>
      </section>

      <section className="panel onboarding-callout">
        <div><span className="eyebrow">{program.name} · Weekly habits</span><h2>Keep small promises.</h2><p>Choose three habits for your program, check them off each day, and see your weekly progress.</p>{phase === "upcoming" && <p>You can choose your habits now. Daily tracking opens {dateFormatter.format(new Date(`${program.starts_on}T12:00:00Z`))}.</p>}</div>
        <Link className="button primary" href={`/portal/habits?enrollment=${enrollment.id}`}>{isMemberPreview ? "Preview weekly habits →" : phase === "upcoming" ? "Choose my weekly habits →" : phase === "finished" ? "View my habit progress →" : "Check off this week’s habits →"}</Link>
      </section>

      {!paid && phase !== "finished" && <section className="panel"><h2>Your payment arrangement</h2><p>Arrange Venmo, cash, or check with Kelsey before your first class. Only online Stripe payments include the $4 processing fee. Your reserved place and payment status are shown separately.</p><a href="mailto:HoldenHealth.Coaching@gmail.com?subject=My%20session%20payment">Confirm payment details with Kelsey →</a></section>}
      <section id="class-calendar" className="section-block member-class-calendar">
        <div className="section-heading"><div><span className="eyebrow">Class calendar</span><h2>{phase === "finished" ? "Class calendar" : "Your upcoming classes"}</h2></div><p>Open a class for details or your Zoom link. Changing your class selection here is enough to let Kelsey know when you switch days or Saturday times.</p></div>
        {upcomingMeetings.length ? <div className="member-calendar-months">
          {[...upcomingMeetings.reduce((months, meeting) => {
            const monthKey = detroitDateKey(meeting.starts_at).slice(0, 7);
            months.set(monthKey, [...(months.get(monthKey) ?? []), meeting]);
            return months;
          }, new Map<string, ClassMeeting[]>())].map(([monthKey, monthMeetings]) => {
            const [year, monthNumber] = monthKey.split("-").map(Number);
            const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
            const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
            const meetingsByDay = new Map<number, ClassMeeting[]>();
            monthMeetings.forEach((meeting) => {
              const day = Number(detroitDateKey(meeting.starts_at).slice(-2));
              meetingsByDay.set(day, [...(meetingsByDay.get(day) ?? []), meeting]);
            });

            return <section className="panel member-calendar-month" key={monthKey}>
              <div className="member-calendar-month-heading">
                <h3>{classMonthFormatter.format(new Date(`${monthKey}-15T12:00:00Z`))}</h3>
                <span>{monthMeetings.length} class{monthMeetings.length === 1 ? "" : "es"}</span>
              </div>
              <div className="member-calendar-grid" role="grid" aria-label={`${classMonthFormatter.format(new Date(`${monthKey}-15T12:00:00Z`))} class calendar`}>
                {calendarDayNames.map((day) => <span className="member-calendar-weekday" role="columnheader" key={day}>{day}</span>)}
                {Array.from({ length: firstDay }, (_, index) => <span className="member-calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
                {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                  const dayMeetings = meetingsByDay.get(day) ?? [];
                  return <div className={`member-calendar-day ${dayMeetings.length ? "has-classes" : ""}`} role="gridcell" key={day}>
                    <div className="member-calendar-date"><strong>{day}</strong><span>{calendarDayNames[new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay()]}</span></div>
                    {dayMeetings.map((meeting) => {
                      const selected = selectedMeetingIds.has(meeting.id);
                      const zoomLink = zoomLinkMap.get(meeting.id);
                      const detailText = meeting.cancelled ? "Class canceled. Kelsey will provide an at-home workout. Contact her if you haven’t received it." : meeting.notes || (meeting.is_zoom ? "Sign up to receive the private Zoom link for this class." : "Equipment is provided. Come ready to move and bring a water bottle.");
                      return <details className={`member-calendar-event ${meeting.cancelled ? "cancelled" : ""} ${meeting.is_zoom ? "zoom" : "in-person"} ${selected ? "selected" : ""}`} key={meeting.id}>
                        <summary>
                          <div className="member-calendar-event-heading">
                            <time dateTime={meeting.starts_at}>{classTimeFormatter.format(new Date(meeting.starts_at))}</time>
                            <span>{meeting.cancelled ? "CANCELED" : meeting.is_zoom ? "ZOOM" : "IN PERSON"}</span>
                          </div>
                          <h4>{meeting.title}</h4>
                          <p>{detailText}</p>
                          <div className="member-calendar-event-footer">
                            {meeting.cancelled ? <strong>Class canceled</strong> : selected ? <strong className="class-selected-status">✓ Signed up</strong> : <span>View details</span>}
                            <b aria-hidden="true">⌄</b>
                          </div>
                        </summary>
                        <div className="member-calendar-event-details">
                          <dl>
                            <div><dt>Date</dt><dd>{classDetailDateFormatter.format(new Date(meeting.starts_at))}</dd></div>
                            <div><dt>Time</dt><dd>{classTimeFormatter.format(new Date(meeting.starts_at))}</dd></div>
                            <div><dt>Location</dt><dd>{meeting.is_zoom ? "Online · Zoom" : `${program.address_line}, ${program.city}, ${program.state}`}</dd></div>
                          </dl>
                          <p>{detailText}</p>
                          {!meeting.cancelled && meeting.is_zoom && selected && zoomLink ? <a className="member-calendar-zoom-link" href={zoomLink} target="_blank" rel="noreferrer">Join Zoom class ↗</a> : null}
                          {!meeting.cancelled && meeting.is_zoom && selected && !zoomLink && <p role="status">Your place is saved. The Zoom link is not available yet. Check this class again before it starts, or <a href="mailto:HoldenHealth.Coaching@gmail.com?subject=My%20class%20Zoom%20link">ask Kelsey for the link</a>.</p>}
                          {!meeting.is_zoom && !meeting.cancelled && <p>{ARRIVAL_DIRECTIONS}</p>}
                          {!isMemberPreview && !meeting.cancelled && Date.parse(meeting.starts_at) > now && enrollment.status === "active" ? <form className="member-calendar-booking" action={setAttendanceSelection}>
                            <input type="hidden" name="enrollmentId" value={enrollment.id} />
                            <input type="hidden" name="returnTo" value={sessionHref} />
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="selected" value={selected ? "false" : "true"} />
                            <button type="submit">{selected ? "Cancel this class booking" : "Save my class spot"}</button>
                          </form> : null}
                        </div>
                      </details>;
                    })}
                  </div>;
                })}
              </div>
            </section>;
          })}
        </div> : <section className="panel empty-inline"><h3>{phase === "finished" ? "This session has ended." : "No upcoming classes posted yet."}</h3><p>{phase === "finished" ? "Your recorded attendance remains in your progress story." : "Kelsey will add the next class dates here."}</p></section>}
      </section>

      <div className="dashboard-grid summary-grid">
        <section className="panel"><span className="eyebrow">Session enrollment</span><h2>Your session place</h2><p>{program.name}. There are no drop-ins at this time. Contact Kelsey about joining after a session starts.</p></section>
        <section className="panel"><span className="eyebrow">Latest update</span>{(announcements as Announcement[] | null)?.[0] ? <><h2>{(announcements as Announcement[])[0].title}</h2><p>{(announcements as Announcement[])[0].body}</p></> : <><h2>You’re all caught up.</h2><p>Session announcements will appear here.</p></>}</section>
        <section className="panel accent-panel"><span className="eyebrow">Need Kelsey?</span><h2>Questions count.</h2><p>Reach out between check-ins when you need clarification or support.</p><a className="text-link" href="mailto:HoldenHealth.Coaching@gmail.com">Email Holden Health →</a></section>
      </div>

      <section id="check-in" className="section-block split-layout">
        <div className="panel">
          <span className="eyebrow">{phase === "current" ? `Week ${weekNumber} check-in` : phase === "upcoming" ? "Your first weekly check-in" : "Session reflections"}</span>
          <h2>Take a few honest minutes.</h2>
          <p>Reflect on your goal, share what worked, and choose one small action for the week ahead. If you haven’t received your Goal-to-Action sheet, ask Kelsey for a copy.</p>
          {phase === "current" && (ready || isMemberPreview) ? <a className="button primary" href={SIX_WEEK_CHECK_IN_URL} target="_blank" rel="noreferrer">Open my weekly check-in ↗</a> : <><p>{phase === "upcoming" ? `Your first check-in is due ${dateFormatter.format(new Date(`${dueDate}T12:00:00Z`))}. It opens after your session begins and your participation is confirmed.` : phase === "finished" ? "Weekly check-ins for this session have finished. You can keep saving personal wins in Progress." : "Your weekly check-in opens when Kelsey confirms your intake, payment, and participation."}</p></>}
          <p><Link className="text-link" href={`/portal/habits?enrollment=${enrollment.id}`}>{isMemberPreview ? "Preview weekly habits →" : "Track my weekly habits →"}</Link></p>
        </div>
        <aside className="panel compact-history"><span className="eyebrow">{phase === "finished" ? "Keep your story going" : phase === "upcoming" ? "During your session" : `Due ${dateFormatter.format(new Date(`${dueDate}T12:00:00Z`))}`}</span><h2>Your answers go to Kelsey.</h2><p>During your session, complete this once each week. The check-in opens in Google Forms and Kelsey reviews those answers separately. They do not automatically appear in your portal history; you can save a personal win in Progress too.</p><div className="soft-note">If you’re subscribed to member emails, you’ll also receive a Sunday reminder while your session is running.</div></aside>
      </section>

      {publishedResources.length > 0 ? <section id="resources" className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Member resources</span><h2>Useful, not overwhelming.</h2></div><p>Kelsey’s approved session, nutrition, habit, and recovery guidance.</p></div>
        <div className="resource-grid">{publishedResources.map((resource) => <a className="resource-card" href={resource.url} target="_blank" rel="noreferrer" key={resource.id}><span>Open resource ↗</span><h3>{resource.title}</h3><p>{resource.description ?? "View this Holden Health resource."}</p></a>)}</div>
      </section> : null}

      <section id="details" className="section-block details-grid">
        <div className="panel"><span className="eyebrow">What to expect</span><h2>Total-body conditioning.</h2><p>We may use dumbbells, stability balls, medicine balls, cardio machines, resistance bands, body weight, and fitness machines. All equipment is provided.</p></div>
        <div className="panel"><span className="eyebrow">What to bring</span><h2>Come ready to move.</h2><ul className="plain-list"><li>Comfortable workout clothes</li><li>Supportive athletic shoes</li><li>Water bottle</li><li>Your real energy level. No performance required</li></ul></div>
        <div className="panel"><span className="eyebrow">Attendance policy</span><h2>Your days can change.</h2><p>Update your class selection here when you need to change days or switch your Saturday time. That is enough to notify Kelsey; no separate text or email is required. You can make up a missed class at another scheduled time within the same session; makeups do not carry into a future session. Missed classes are not refundable after the program starts. If serious illness or injury affects participation, contact Kelsey to discuss your situation.</p></div>
        <div className="panel"><span className="eyebrow">Finding the gym</span><h2>Arriving at Burroughs</h2><p>{ARRIVAL_DIRECTIONS}</p></div>
        <div className="panel"><span className="eyebrow">Between classes</span><h2>At-home workouts</h2><p>Your program’s workouts appear here as Kelsey releases them.</p><Link className="button primary" href={`/portal/workouts?program=${program.id}`}>Open at-home workouts →</Link></div>
        <div className="panel"><span className="eyebrow">Cancellation</span><h2>If plans change</h2><p>Cancel before your program starts for a refund. If Kelsey must cancel a class in an emergency, she will provide an at-home workout instead. Canceling a single class booking here does not cancel your program enrollment.</p><a href="mailto:HoldenHealth.Coaching@gmail.com?subject=My%20program%20enrollment">Contact Kelsey about your enrollment →</a></div>
      </section>
    </main>
  );
}
