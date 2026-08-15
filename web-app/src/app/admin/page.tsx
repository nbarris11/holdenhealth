import {
  approveRegistrationRequest, createAnnouncement, createResource, declineRegistrationRequest, deleteAnnouncement, deleteResource, inviteMember,
  respondToCheckIn, signOut, updateEnrollmentAndPayment, updateSessionDetails,
} from "@/app/actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Profile = { id: string; full_name: string; phone: string | null };
type Enrollment = { id: string; member_id: string; status: string; returning_member: boolean; created_at: string };
type Payment = { enrollment_id: string; status: string; method: string | null; amount_cents: number; received_on: string | null; internal_note: string | null };
type Meeting = { id: string; starts_at: string; title: string; cancelled: boolean };
type CheckIn = { id: string; enrollment_id: string; week_number: number; went_well: string; did_not_go_well: string; upcoming_goal: string; support_needed: string; submitted_at: string; reviewed_at: string | null; coach_response: string | null };

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

export default async function AdminPage() {
  await verifyAdmin();
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("*").order("starts_on", { ascending: false }).limit(1).maybeSingle();

  if (!session) return <main className="app-shell"><section className="panel"><h1>No session found.</h1></section></main>;

  const [{ data: enrollments }, { data: meetings }, { data: attendance }, { data: announcements }, { data: resources }, { data: checkIns }, { data: invitations }, { data: registrationRequests }] = await Promise.all([
    supabase.from("enrollments").select("id,member_id,status,returning_member,created_at").eq("session_id", session.id).order("created_at"),
    supabase.from("class_meetings").select("id,starts_at,title,cancelled").eq("session_id", session.id).order("starts_at"),
    supabase.from("attendance_selections").select("meeting_id,attended"),
    supabase.from("announcements").select("id,title,body,published_at,created_at").eq("session_id", session.id).order("created_at", { ascending: false }),
    supabase.from("resources").select("id,title,description,url,published,sort_order").eq("session_id", session.id).order("sort_order"),
    supabase.from("check_ins").select("id,enrollment_id,week_number,went_well,did_not_go_well,upcoming_goal,support_needed,submitted_at,reviewed_at,coach_response").order("submitted_at", { ascending: false }),
    supabase.from("member_invitations").select("id,email,full_name,claimed_at,created_at").eq("session_id", session.id).order("created_at", { ascending: false }),
    supabase.from("registration_requests").select("id,full_name,email,phone,returning_member,attendance_interest,note,status,created_at").eq("session_id", session.id).order("created_at", { ascending: false }),
  ]);

  const typedEnrollments = (enrollments ?? []) as Enrollment[];
  const memberIds = typedEnrollments.map((row) => row.member_id);
  const enrollmentIds = typedEnrollments.map((row) => row.id);
  const [{ data: profiles }, { data: payments }] = await Promise.all([
    memberIds.length ? supabase.from("profiles").select("id,full_name,phone").in("id", memberIds) : { data: [] },
    enrollmentIds.length ? supabase.from("payment_records").select("enrollment_id,status,method,amount_cents,received_on,internal_note").in("enrollment_id", enrollmentIds) : { data: [] },
  ]);

  const profileMap = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const paymentMap = new Map(((payments ?? []) as Payment[]).map((payment) => [payment.enrollment_id, payment]));
  const enrollmentMap = new Map(typedEnrollments.map((enrollment) => [enrollment.id, enrollment]));
  const paidCount = ((payments ?? []) as Payment[]).filter((payment) => payment.status === "paid").length;
  const openCheckIns = ((checkIns ?? []) as CheckIn[]).filter((checkIn) => !checkIn.reviewed_at);
  const pendingRequests = (registrationRequests ?? []).filter((request) => request.status === "pending");
  const selectedCounts = new Map<string, number>();
  (attendance ?? []).forEach((selection) => selectedCounts.set(selection.meeting_id, (selectedCounts.get(selection.meeting_id) ?? 0) + 1));

  return (
    <main className="app-shell admin-shell">
      <header className="app-header"><div><span className="eyebrow">Holden Health admin</span><h1>Focus on You.</h1><p className="lede">Run the session without juggling texts, notes, and spreadsheets.</p></div><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
      <nav className="section-nav" aria-label="Admin sections"><a href="#today">Today</a><a href="#approvals">Approvals</a><a href="#members">Members</a><a href="#check-ins">Check-ins</a><a href="#content">Content</a><a href="#session">Session setup</a></nav>

      <section id="today" className="stat-grid">
        <article className="panel stat-card"><span>Enrolled</span><strong>{typedEnrollments.filter((row) => ["invited", "active"].includes(row.status)).length}</strong><small>of {session.capacity} places</small></article>
        <article className="panel stat-card"><span>Paid</span><strong>{paidCount}</strong><small>{typedEnrollments.length - paidCount} to follow up</small></article>
        <article className="panel stat-card"><span>Needs attention</span><strong>{openCheckIns.length + pendingRequests.length}</strong><small>{pendingRequests.length} approval{pendingRequests.length === 1 ? "" : "s"} · {openCheckIns.length} check-in{openCheckIns.length === 1 ? "" : "s"}</small></article>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Attendance outlook</span><h2>Know who plans to show up.</h2></div><p>Member selections help with room and equipment setup. They are flexible, not strict reservations.</p></div>
        <div className="admin-meeting-grid">{((meetings ?? []) as Meeting[]).map((meeting) => <article className="panel mini-meeting" key={meeting.id}><span>{dateTimeFormatter.format(new Date(meeting.starts_at))}</span><strong>{meeting.cancelled ? "Cancelled" : `${selectedCounts.get(meeting.id) ?? 0} planning to attend`}</strong></article>)}</div>
      </section>

      <section id="approvals" className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Pending registration approvals</span><h2>Meet the person before the portal opens.</h2></div><p>Approve after the fit conversation. Approval creates their account connection, enrolls them, and sends the secure portal link.</p></div>
        <div className="approval-grid">{pendingRequests.length ? pendingRequests.map((request) => <article className="panel approval-card" key={request.id}><div className="roster-heading"><div><h3>{request.full_name}</h3><p>{request.email} · {request.phone}</p></div><span className="status-pill warning">Pending</span></div><p><strong>Class interest:</strong> {(request.attendance_interest as string[]).join(", ")}</p>{request.note ? <div className="soft-note">{request.note}</div> : null}<div className="button-row"><form action={approveRegistrationRequest}><input type="hidden" name="requestId" value={request.id} /><button className="button primary" type="submit">Approve and invite</button></form><form action={declineRegistrationRequest}><input type="hidden" name="requestId" value={request.id} /><button className="button secondary" type="submit">Decline</button></form></div></article>) : <section className="panel empty-inline"><h3>No requests waiting.</h3><p>New session requests will appear here and notify Kelsey by email.</p></section>}</div>
      </section>

      <section id="members" className="section-block split-layout admin-split">
        <div className="panel">
          <span className="eyebrow">Add a confirmed signup</span><h2>Create their portal access.</h2><p>Save the registration and send a secure sign-in email in one step.</p>
          <form className="stack-form" action={inviteMember}>
            <input type="hidden" name="sessionId" value={session.id} />
            <div className="field-grid"><label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" required /></label></div>
            <div className="field-grid"><label>Phone<input name="phone" type="tel" /></label><label>Enrollment<select name="enrollmentStatus" defaultValue="active"><option value="invited">Invited</option><option value="active">Active</option><option value="prospect">Prospect</option></select></label></div>
            <div className="field-grid"><label>Payment status<select name="paymentStatus" defaultValue="pending"><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option><option value="credited">Credited</option></select></label><label>Method<select name="paymentMethod" defaultValue=""><option value="">Not recorded</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="check">Check</option><option value="other">Other</option></select></label></div>
            <div className="field-grid"><label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={(session.new_member_price_cents / 100).toFixed(0)} required /></label><label className="check-label"><input name="returningMember" type="checkbox" /> Returning member</label></div>
            <button className="button primary" type="submit">Add member and send invite</button>
          </form>
        </div>
        <div className="panel"><span className="eyebrow">Portal invitations</span><h2>Account status.</h2><div className="simple-list">{(invitations ?? []).length ? (invitations ?? []).map((invitation) => <div key={invitation.id}><strong>{invitation.full_name}</strong><span>{invitation.email}</span><em className={invitation.claimed_at ? "success-text" : "muted-text"}>{invitation.claimed_at ? "Account connected" : "Email sent · awaiting sign-in"}</em></div>) : <p>No invitations yet.</p>}</div></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Roster and payment tracking</span><h2>One place for each member.</h2></div><p>Update access and payment status without changing bank details or storing sensitive payment information.</p></div>
        <div className="roster-grid">{typedEnrollments.map((enrollment) => { const profile = profileMap.get(enrollment.member_id); const payment = paymentMap.get(enrollment.id); return <article className="panel roster-card" key={enrollment.id}><div className="roster-heading"><div><h3>{profile?.full_name || "Member"}</h3><p>{profile?.phone || "No phone saved"}</p></div><span className={`status-pill ${payment?.status === "paid" ? "success" : "warning"}`}>{payment?.status ?? "payment pending"}</span></div><form className="stack-form compact-form" action={updateEnrollmentAndPayment}><input type="hidden" name="enrollmentId" value={enrollment.id} /><div className="field-grid"><label>Enrollment<select name="enrollmentStatus" defaultValue={enrollment.status}><option value="prospect">Prospect</option><option value="invited">Invited</option><option value="active">Active</option><option value="completed">Completed</option><option value="withdrawn">Withdrawn</option></select></label><label>Payment<select name="paymentStatus" defaultValue={payment?.status ?? "pending"}><option value="pending">Pending</option><option value="paid">Paid</option><option value="credited">Credited</option><option value="refunded">Refunded</option><option value="waived">Waived</option></select></label></div><div className="field-grid"><label>Method<select name="paymentMethod" defaultValue={payment?.method ?? ""}><option value="">Not recorded</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="check">Check</option><option value="other">Other</option></select></label><label>Amount<input name="amount" type="number" step="0.01" min="0" defaultValue={((payment?.amount_cents ?? session.new_member_price_cents) / 100).toFixed(2)} /></label></div><div className="field-grid"><label>Received on<input name="receivedOn" type="date" defaultValue={payment?.received_on ?? ""} /></label><label className="check-label"><input name="returningMember" type="checkbox" defaultChecked={enrollment.returning_member} /> Returning member</label></div><label>Internal note<input name="internalNote" defaultValue={payment?.internal_note ?? ""} /></label><button className="button secondary" type="submit">Save member</button></form></article>; })}</div>
      </section>

      <section id="check-ins" className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Weekly coaching loop</span><h2>Review the whole story.</h2></div><p>Members see your response in their portal as soon as you save it.</p></div>
        <div className="checkin-admin-list">{((checkIns ?? []) as CheckIn[]).length ? ((checkIns ?? []) as CheckIn[]).map((checkIn) => { const enrollment = enrollmentMap.get(checkIn.enrollment_id); const profile = enrollment ? profileMap.get(enrollment.member_id) : null; return <article className="panel" key={checkIn.id}><div className="roster-heading"><div><span className="eyebrow">{profile?.full_name || "Member"} · Week {checkIn.week_number}</span><h3>{checkIn.upcoming_goal}</h3></div><span className={`status-pill ${checkIn.reviewed_at ? "success" : "warning"}`}>{checkIn.reviewed_at ? "Reviewed" : "Needs response"}</span></div><dl className="answer-grid"><div><dt>What went well</dt><dd>{checkIn.went_well}</dd></div><div><dt>What did not</dt><dd>{checkIn.did_not_go_well}</dd></div><div><dt>Support requested</dt><dd>{checkIn.support_needed}</dd></div></dl><form className="stack-form" action={respondToCheckIn}><input type="hidden" name="checkInId" value={checkIn.id} /><label>Your response<textarea name="coachResponse" defaultValue={checkIn.coach_response ?? ""} required /></label><button className="button primary" type="submit">Save response</button></form></article>; }) : <section className="panel empty-inline"><h3>No check-ins yet.</h3><p>Member submissions will collect here for review.</p></section>}</div>
      </section>

      <section id="content" className="section-block split-layout admin-split">
        <div className="panel"><span className="eyebrow">Announcements</span><h2>Post a session update.</h2><form className="stack-form" action={createAnnouncement}><input type="hidden" name="sessionId" value={session.id} /><label>Title<input name="title" required /></label><label>Message<textarea name="body" required /></label><label className="check-label"><input name="published" type="checkbox" defaultChecked /> Publish now</label><button className="button primary" type="submit">Post announcement</button></form><div className="content-admin-list">{(announcements ?? []).map((item) => <div key={item.id}><div><strong>{item.title}</strong><span>{item.published_at ? "Published" : "Draft"}</span></div><form action={deleteAnnouncement}><input type="hidden" name="id" value={item.id} /><button className="text-button danger" type="submit">Remove</button></form></div>)}</div></div>
        <div className="panel"><span className="eyebrow">Member resources</span><h2>Add an approved link.</h2><form className="stack-form" action={createResource}><input type="hidden" name="sessionId" value={session.id} /><label>Title<input name="title" required /></label><label>Description<textarea name="description" /></label><label>Full URL<input name="url" type="url" placeholder="https://" required /></label><div className="field-grid"><label>Order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label><label className="check-label"><input name="published" type="checkbox" defaultChecked /> Publish now</label></div><button className="button primary" type="submit">Add resource</button></form><div className="content-admin-list">{(resources ?? []).map((item) => <div key={item.id}><div><strong>{item.title}</strong><span>{item.published ? "Published" : "Draft"}</span></div><form action={deleteResource}><input type="hidden" name="id" value={item.id} /><button className="text-button danger" type="submit">Remove</button></form></div>)}</div></div>
      </section>

      <section id="session" className="section-block panel">
        <span className="eyebrow">Session setup</span><h2>Update the member-facing details.</h2><form className="stack-form wide-form" action={updateSessionDetails}><input type="hidden" name="sessionId" value={session.id} /><label>Session name<input name="name" defaultValue={session.name} required /></label><label>Description<textarea name="description" defaultValue={session.description ?? ""} required /></label><div className="field-grid three"><label>Status<select name="status" defaultValue={session.status}><option value="draft">Draft</option><option value="enrolling">Enrolling</option><option value="full">Full</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Capacity<input name="capacity" type="number" min="1" max="100" defaultValue={session.capacity} /></label><label className="check-label"><input name="published" type="checkbox" defaultChecked={session.published} /> Published</label></div><div className="field-grid"><label>New member price<input name="newMemberPrice" type="number" min="0" step="0.01" defaultValue={(session.new_member_price_cents / 100).toFixed(2)} /></label><label>Returning price<input name="returningMemberPrice" type="number" min="0" step="0.01" defaultValue={((session.returning_member_price_cents ?? 0) / 100).toFixed(2)} /></label></div><button className="button primary" type="submit">Save session details</button></form>
      </section>
    </main>
  );
}
