import { createClassMeeting, updateClassMeeting, updateDropInBookingStatus } from "@/app/actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pendingPrivateClassRoster } from "@/lib/private-class-confirmation";

type ClassesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Meeting = { id: string; title: string; notes: string | null; starts_at: string; ends_at: string; cancelled: boolean; is_zoom: boolean; drop_in_enabled: boolean; drop_in_capacity: number; zoom_ready?: boolean };
type Booking = { id: string; meeting_id: string; full_name: string; email: string; phone: string; note: string | null; status: string; created_at: string; zoom_link_sent_at: string | null };
type ClassZoomMeeting = { meeting_id: string };
type AttendanceSelection = { meeting_id: string; enrollment_id: string };
type RosterPerson = { name: string; email: string | null; status?: string };

const messages: Record<string, { tone: "success" | "error"; text: string }> = {
  created: { tone: "success", text: "Class added to the schedule." }, updated: { tone: "success", text: "Class changes saved." }, "series-updated": { tone: "success", text: "Every future class on that weekday was updated." },
  "create-failed": { tone: "error", text: "The class could not be added." }, "update-failed": { tone: "error", text: "The class changes did not save." }, "series-update-failed": { tone: "error", text: "This class saved, but some future matching classes did not update." },
  "zoom-create-failed": { tone: "error", text: "The Zoom class could not be connected. Check the Zoom connection and try saving again." },
  "booking-updated": { tone: "success", text: "Drop-in request updated." }, "booking-update-failed": { tone: "error", text: "The drop-in request did not update." },
  "booking-email-failed": { tone: "error", text: "The spot was confirmed, but the Zoom email did not send. Save the confirmed decision again to retry." },
};
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/Detroit" });
const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
const dateTimeLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

function detroitParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function ClassEditor({ meeting, members, dropIns }: { meeting: Meeting; members: RosterPerson[]; dropIns: RosterPerson[] }) {
  const start = detroitParts(meeting.starts_at);
  const duration = Math.round((new Date(meeting.ends_at).getTime() - new Date(meeting.starts_at).getTime()) / 60000);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Detroit" }).format(new Date(meeting.starts_at));
  return <details className={`panel upcoming-class-card ${meeting.cancelled ? "cancelled" : ""}`} id={`class-${meeting.id}`}>
    <summary>
      <div className="class-date-block">
        <time>{dateTimeLabel.format(new Date(meeting.starts_at))}</time>
        <strong>{meeting.title}</strong>
        {meeting.is_zoom ? <span className="zoom-badge">ZOOM CLASS</span> : null}
        <span className="class-attendance-link">{meeting.cancelled ? "Cancelled" : `${members.length} member${members.length === 1 ? "" : "s"} planning to attend`}{dropIns.length ? ` · ${dropIns.length} drop-in${dropIns.length === 1 ? "" : "s"}` : ""}{!meeting.cancelled && (members.length || dropIns.length) ? <u>View names</u> : null}</span>
      </div>
      <div><span className={`status-pill ${meeting.cancelled ? "warning" : "success"}`}>{meeting.cancelled ? "Cancelled" : "Scheduled"}</span><b className="details-chevron" aria-hidden="true">⌄</b></div>
    </summary>
    <div className="class-editor-body">
      <section className="class-roster" aria-label={`${meeting.title} roster`}><div><span className="eyebrow">Class roster</span><h3>{members.length + dropIns.length} people planning to attend</h3></div><div className="class-roster-columns"><div><h4>Members ({members.length})</h4>{members.length ? <ul>{members.map((person) => <li key={`${meeting.id}-${person.email ?? person.name}`}><strong>{person.name}</strong>{person.email ? <span>{person.email}</span> : null}{person.status ? <span>{person.status}</span> : null}</li>)}</ul> : <p>No members have selected this class yet.</p>}</div><div><h4>Drop-ins ({dropIns.length})</h4>{dropIns.length ? <ul>{dropIns.map((person) => <li key={`${meeting.id}-${person.email ?? person.name}`}><strong>{person.name}</strong><span>{person.status === "confirmed" ? "Confirmed" : "Waiting for confirmation"}{person.email ? ` · ${person.email}` : ""}</span></li>)}</ul> : <p>No active drop-in requests for this class.</p>}</div></div></section>
      <p>Change this class below. Member and public calendars update when you save.</p>
      {meeting.is_zoom ? <p className={`zoom-room-status ${meeting.zoom_ready ? "ready" : "waiting"}`}><strong>{meeting.zoom_ready ? "Zoom link ready" : "Zoom link not created yet"}</strong><span>{meeting.zoom_ready ? "Everyone who signs up for this date gets this class’s same private link. A different date has a different link." : "Save this class to create its private Zoom link."}</span></p> : null}
      <form className="stack-form" action={updateClassMeeting}>
        <input type="hidden" name="meetingId" value={meeting.id} />
        <div className="field-grid three"><label>Date<input name="date" type="date" defaultValue={start.date} required /></label><label>Start time<input name="time" type="time" defaultValue={start.time} required /></label><label>Length<select name="durationMinutes" defaultValue={duration}><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option></select></label></div>
        <label className="check-label series-update-option"><input name="applyToSeries" type="checkbox" /> Use this time and length for every future {weekday} class</label>
        <div className="field-grid"><label>Class name<input name="title" defaultValue={meeting.title} required /></label><label>Drop-in capacity<input name="dropInCapacity" type="number" min="0" max="50" defaultValue={meeting.drop_in_capacity} required /></label></div>
        <label>Member-facing note<input name="notes" defaultValue={meeting.notes ?? ""} /></label>
        <div className="field-grid">
          <label className="check-label zoom-option"><input name="isZoom" type="checkbox" defaultChecked={meeting.is_zoom} /> <span><strong>This is a Zoom class</strong><small>Create one private link for this date and share it with everyone who signs up.</small></span></label>
          <label className="check-label"><input name="dropInEnabled" type="checkbox" defaultChecked={meeting.drop_in_enabled} /> Offer this class on the public drop-in calendar</label>
          <label className="check-label danger-check"><input name="cancelled" type="checkbox" defaultChecked={meeting.cancelled} /> This class is cancelled</label>
        </div>
        <button className="button primary" type="submit">Save class</button>
      </form>
    </div>
  </details>;
}

function Calendar({ meetings }: { meetings: Meeting[] }) {
  const monthGroups = new Map<string, Meeting[]>();
  meetings.forEach((meeting) => { const key = detroitParts(meeting.starts_at).date.slice(0, 7); monthGroups.set(key, [...(monthGroups.get(key) ?? []), meeting]); });
  return <div className="calendar-months">{[...monthGroups.entries()].map(([month, monthMeetings]) => { const [year, monthNumber] = month.split("-").map(Number); const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay(); const meetingsByDay = new Map<number, Meeting[]>(); monthMeetings.forEach((meeting) => { const day = Number(detroitParts(meeting.starts_at).date.slice(-2)); meetingsByDay.set(day, [...(meetingsByDay.get(day) ?? []), meeting]); }); return <section className="calendar-month" key={month}><h3>{monthTitle.format(new Date(`${month}-15T12:00:00Z`))}</h3><div className="calendar-grid">{dayNames.map((day) => <span className="calendar-day-name" key={day}>{day}</span>)}{Array.from({ length: firstDay }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <div className="calendar-day" key={day}><b>{day}</b>{(meetingsByDay.get(day) ?? []).map((meeting) => <a className={`calendar-event ${meeting.cancelled ? "cancelled" : ""}`} href={`#class-${meeting.id}`} key={meeting.id}>{meeting.is_zoom ? <b className="zoom-badge compact">ZOOM</b> : null}<strong>{timeLabel.format(new Date(meeting.starts_at))}</strong><span>{meeting.title}</span></a>)}</div>)}</div></section>; })}</div>;
}

export default async function ClassesPage({ searchParams }: ClassesPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const message = messages[typeof params.message === "string" ? params.message : ""];
  const supabase = await createClient();
  const { data: programs } = await supabase.from("sessions").select("id,name,status").order("starts_on");
  const session = programs?.find(program=>program.id===params.program) ?? programs?.find(program => ["enrolling", "active"].includes(program.status)) ?? programs?.[0];
  if (!session) return <main className="app-shell admin-shell workspace-page"><section className="panel calm-empty"><h1>No current program.</h1><Link href="/admin/settings">Open program settings</Link></section></main>;
  const [{ data: meetingData }, { data: bookingData }, { data: attendanceData }, { data: zoomMeetingData }] = await Promise.all([
    supabase.from("class_meetings").select("id,title,notes,starts_at,ends_at,cancelled,is_zoom,drop_in_enabled,drop_in_capacity").eq("session_id", session.id).order("starts_at"),
    supabase.from("drop_in_bookings").select("id,meeting_id,full_name,email,phone,note,status,created_at,zoom_link_sent_at").order("created_at", { ascending: false }),
    supabase.from("attendance_selections").select("meeting_id,enrollment_id"),
    supabase.from("class_zoom_meetings").select("meeting_id"),
  ]);
  const zoomReadyIds = new Set(((zoomMeetingData ?? []) as ClassZoomMeeting[]).map((meeting) => meeting.meeting_id));
  const meetings = ((meetingData ?? []) as Meeting[]).map((meeting) => ({ ...meeting, zoom_ready: zoomReadyIds.has(meeting.id) }));
  const upcoming = meetings.filter((meeting) => new Date(meeting.starts_at) >= new Date());
  const bookings = (bookingData ?? []) as Booking[];
  const attendanceSelections = (attendanceData ?? []) as AttendanceSelection[];
  const attendanceEnrollmentIds = [...new Set(attendanceSelections.map((selection) => selection.enrollment_id))];
  const { data: rosterEnrollments } = attendanceEnrollmentIds.length ? await supabase.from("enrollments").select("id,member_id").eq("session_id", session.id).in("id", attendanceEnrollmentIds) : { data: [] };
  const rosterMemberIds = [...new Set((rosterEnrollments ?? []).map((enrollment) => enrollment.member_id))];
  const [{ data: rosterProfiles }, { data: rosterContacts }] = await Promise.all([
    rosterMemberIds.length ? supabase.from("profiles").select("id,full_name").in("id", rosterMemberIds) : Promise.resolve({ data: [] }),
    rosterMemberIds.length ? supabase.from("member_contacts").select("user_id,email").in("user_id", rosterMemberIds) : Promise.resolve({ data: [] }),
  ]);
  const rosterEnrollmentMap = new Map((rosterEnrollments ?? []).map((enrollment) => [enrollment.id, enrollment.member_id]));
  const rosterProfileMap = new Map((rosterProfiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const rosterContactMap = new Map((rosterContacts ?? []).map((contact) => [contact.user_id, contact.email]));
  const memberRosterMap = attendanceSelections.reduce((rosters, selection) => {
    const memberId = rosterEnrollmentMap.get(selection.enrollment_id);
    if (!memberId) return rosters;
    rosters.set(selection.meeting_id, [...(rosters.get(selection.meeting_id) ?? []), { name: rosterProfileMap.get(memberId) || "Member", email: rosterContactMap.get(memberId) ?? null }]);
    return rosters;
  }, new Map<string, RosterPerson[]>());
  const pendingPrivate = await pendingPrivateClassRoster(session.id);
  for (const signup of pendingPrivate) {
    for (const meetingId of signup.class_meeting_ids as string[]) {
      if (!meetings.some(meeting=>meeting.id===meetingId && !meeting.cancelled)) continue;
      const roster=memberRosterMap.get(meetingId)??[];
      if (!roster.some(person=>person.email?.toLowerCase()===signup.email.toLowerCase())) {
        roster.push({name:signup.full_name,email:signup.email,status:'Paid · intake/setup pending'});
        memberRosterMap.set(meetingId,roster);
      }
    }
  }
  const pendingBookings = bookings.filter((booking) => booking.status === "requested");
  const dropInRosterMap = bookings.filter((booking) => new Set(["requested", "confirmed"]).has(booking.status)).reduce((rosters, booking) => {
    rosters.set(booking.meeting_id, [...(rosters.get(booking.meeting_id) ?? []), { name: booking.full_name, email: booking.email, status: booking.status }]);
    return rosters;
  }, new Map<string, RosterPerson[]>());
  const meetingMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return <main className="app-shell admin-shell workspace-page schedule-page">
    <header className="workspace-page-header"><div><span className="eyebrow">{session.name}</span><h1>Schedule</h1><p>See what is coming up, manage one class at a time, and respond to drop-in requests.</p></div><div className="workspace-header-actions"><a className="button primary" href="#add-class">Add a class</a><Link className="button secondary" href="/drop-in">View public calendar ↗</Link></div></header>
    {programs && programs.length>1 && <form className="panel stack-form" action="/admin/classes"><label>Class program<select name="program" defaultValue={session.id}>{programs.map(program=><option value={program.id} key={program.id}>{program.name}</option>)}</select></label><button className="button secondary" type="submit">View program</button></form>}
    {message ? <p className={`notice ${message.tone}`} role="status">{message.text}</p> : null}
    {pendingBookings.length ? <section className="schedule-alert panel"><div><span className="eyebrow">Needs attention</span><h2>{pendingBookings.length} drop-in request{pendingBookings.length === 1 ? "" : "s"} waiting</h2><p>Confirm a spot after you connect with them and handle payment.</p></div><a className="button primary" href="#bookings">Review requests</a></section> : null}
    <nav className="page-tabs" aria-label="Schedule sections"><a href="#upcoming">Upcoming</a><a href="#bookings">Drop-ins {pendingBookings.length ? <b>{pendingBookings.length}</b> : null}</a><a href="#calendar">Calendar</a></nav>
    <section id="upcoming" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Next on the calendar</span><h2>Upcoming classes</h2></div><p>Select a class to see who is attending or change its settings.</p></div><div className="upcoming-class-list">{upcoming.length ? upcoming.slice(0, 8).map((meeting) => <ClassEditor meeting={meeting} members={memberRosterMap.get(meeting.id) ?? []} dropIns={dropInRosterMap.get(meeting.id) ?? []} key={meeting.id} />) : <div className="panel calm-empty compact"><h3>No upcoming classes</h3><p>Add the first class when your schedule is ready.</p></div>}{upcoming.length > 8 ? <details className="later-classes"><summary>Show {upcoming.length - 8} later classes</summary><div>{upcoming.slice(8).map((meeting) => <ClassEditor meeting={meeting} members={memberRosterMap.get(meeting.id) ?? []} dropIns={dropInRosterMap.get(meeting.id) ?? []} key={meeting.id} />)}</div></details> : null}</div></section>
    <details className="panel add-class-panel simplified" id="add-class">
      <summary><span><span className="eyebrow">Schedule</span><strong>Add a class</strong></span><b>＋</b></summary>
      <form className="stack-form class-form" action={createClassMeeting}>
        <input type="hidden" name="sessionId" value={session.id} />
        <div className="field-grid three"><label>Date<input name="date" type="date" required /></label><label>Start time<input name="time" type="time" required /></label><label>Length<select name="durationMinutes" defaultValue="60"><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option></select></label></div>
        <div className="field-grid"><label>Class name<input name="title" defaultValue="Total-body conditioning" required /></label><label>Drop-in capacity<input name="dropInCapacity" type="number" min="0" max="50" defaultValue="6" required /></label></div>
        <label>Member-facing note<input name="notes" placeholder="Optional" /></label>
        <div className="field-grid">
          <label className="check-label zoom-option"><input name="isZoom" type="checkbox" /> <span><strong>This is a Zoom class</strong><small>Create one private link for this date and share it with everyone who signs up.</small></span></label>
          <label className="check-label"><input name="dropInEnabled" type="checkbox" /> Offer this class on the public drop-in calendar</label>
        </div>
        <button className="button primary" type="submit">Add class</button>
      </form>
    </details>
    <section id="bookings" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Public drop-ins</span><h2>Drop-in requests</h2></div><p>New requests appear first. Older decisions stay below for reference.</p></div><div className="booking-list">{bookings.length ? bookings.map((booking) => <article className={`panel booking-row ${booking.status === "requested" ? "needs-action" : ""}`} key={booking.id}><div><span className="eyebrow">{meetingMap.get(booking.meeting_id) ? dateTimeLabel.format(new Date(meetingMap.get(booking.meeting_id)!.starts_at)) : "Class"}</span><h3>{booking.full_name}</h3><p>{booking.email} · {booking.phone}</p>{booking.zoom_link_sent_at ? <span className="status-pill success">Zoom link emailed</span> : null}{booking.note ? <p className="soft-note">{booking.note}</p> : null}</div><form className="booking-status-form" action={updateDropInBookingStatus}><input type="hidden" name="bookingId" value={booking.id} /><label>Decision<select name="status" defaultValue={booking.status}><option value="requested">Still waiting</option><option value="confirmed">Spot confirmed</option><option value="declined">Not available</option><option value="cancelled">Cancelled</option></select></label><button className="button secondary" type="submit">Save decision</button></form></article>) : <div className="panel calm-empty compact"><span className="calm-check">✓</span><div><h3>No drop-in requests</h3><p>New requests from the public calendar will appear here.</p></div></div>}</div></section>
    <section id="calendar" className="workspace-section"><details className="panel calendar-disclosure"><summary><span><span className="eyebrow">Month view</span><strong>Open the full calendar</strong></span><b>⌄</b></summary><Calendar meetings={meetings} /></details></section>
  </main>;
}
