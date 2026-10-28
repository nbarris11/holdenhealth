import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Meeting = { id: string; title: string; starts_at: string; cancelled: boolean };
type Enrollment = { id: string; member_id: string; status: string };

const classTime = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
});

export default async function AdminHomePage() {
  await verifyAdmin();
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id,name,capacity").in("status", ["enrolling", "active"]).order("starts_on").limit(1).maybeSingle();
  if (!session) return <main className="app-shell admin-shell workspace-page"><section className="panel calm-empty"><span className="eyebrow">Today</span><h1>No current program.</h1><p>Open Settings when you are ready to prepare the next Holden Health program.</p><Link className="button primary" href="/admin/settings">Open program settings</Link></section></main>;

  const [{ data: requests }, { data: inquiries }, { data: checkIns }, { data: dropIns }, { data: pendingIntakes }, { data: enrollmentData }, { data: meetingData }, { data: workoutLogs }] = await Promise.all([
    supabase.from("registration_requests").select("id").eq("session_id", session.id).eq("status", "pending"),
    supabase.from("website_inquiries").select("id").eq("status", "pending"),
    supabase.from("check_ins").select("id").is("reviewed_at", null),
    supabase.from("drop_in_bookings").select("id").eq("status", "requested"),
    supabase.from("member_intakes").select("enrollment_id").is("reviewed_at", null),
    supabase.from("enrollments").select("id,member_id,status").eq("session_id", session.id).in("status", ["invited", "active"]),
    supabase.from("class_meetings").select("id,title,starts_at,cancelled").eq("session_id", session.id).gte("starts_at", new Date().toISOString()).eq("cancelled", false).order("starts_at").limit(3),
    supabase.from("workout_logs").select("id,workout_feedback(id)").order("completed_at", { ascending: false }).limit(50),
  ]);
  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const enrollmentIds = enrollments.map((row) => row.id);
  const meetings = (meetingData ?? []) as Meeting[];
  const meetingIds = meetings.map((row) => row.id);
  const [{ data: payments }, { data: attendance }] = await Promise.all([
    enrollmentIds.length ? supabase.from("payment_records").select("enrollment_id,status").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [] }),
    meetingIds.length ? supabase.from("attendance_selections").select("meeting_id").in("meeting_id", meetingIds) : Promise.resolve({ data: [] }),
  ]);
  const paymentMap = new Map((payments ?? []).map((payment) => [payment.enrollment_id, payment.status]));
  const paymentNeeded = enrollments.filter((enrollment) => !new Set(["paid", "waived", "credited"]).has(paymentMap.get(enrollment.id) ?? "pending")).length;
  const attendanceCounts = new Map<string, number>();
  (attendance ?? []).forEach((selection) => attendanceCounts.set(selection.meeting_id, (attendanceCounts.get(selection.meeting_id) ?? 0) + 1));
  const peopleHref = `/admin/people?program=${encodeURIComponent(session.id)}`;
  const attentionItems = [
    { count: inquiries?.length ?? 0, label: "website inquiry", plural: "website inquiries", href: "/admin/people#inquiries", action: "Reply" },
    { count: requests?.length ?? 0, label: "registration request", plural: "registration requests", href: `${peopleHref}#requests`, action: "Review" },
    { count: pendingIntakes?.length ?? 0, label: "intake ready for review", plural: "intakes ready for review", href: "/admin/people#intakes", action: "Review" },
    { count: checkIns?.length ?? 0, label: "member check-in", plural: "member check-ins", href: "/admin/people#check-ins", action: "Respond" },
    { count: dropIns?.length ?? 0, label: "drop-in request", plural: "drop-in requests", href: "/admin/classes#bookings", action: "Confirm" },
    { count: paymentNeeded, label: "payment to follow up on", plural: "payments to follow up on", href: `${peopleHref}#members`, action: "View" },
    { count: (workoutLogs ?? []).filter((log) => !log.workout_feedback).length, label: "workout ready for feedback", plural: "workouts ready for feedback", href: "/admin/training", action: "Coach" },
  ].filter((item) => item.count > 0);

  return <main className="app-shell admin-shell workspace-page today-page">
    <header className="workspace-page-header"><div><span className="eyebrow">{session.name}</span><h1>Good morning, Kelsey.</h1><p>Here is what is happening with your business today.</p></div><div className="workspace-header-actions"><Link className="button primary" href={`/admin/people/add?program=${encodeURIComponent(session.id)}`}>Add someone</Link><Link className="button secondary" href="/admin/communications">Send an update</Link></div></header>
    <section className={`today-attention panel ${attentionItems.length ? "has-work" : "caught-up"}`}>
      <div className="today-attention-heading"><span className="eyebrow">Needs your attention</span><h2>{attentionItems.length ? `${attentionItems.reduce((sum, item) => sum + item.count, 0)} things to take care of` : "You’re caught up."}</h2><p>{attentionItems.length ? "Each item below leads straight to the next step." : meetings[0] ? `Your next class is ${classTime.format(new Date(meetings[0].starts_at))}.` : "There are no upcoming classes on the calendar."}</p></div>
      {attentionItems.length ? <div className="today-task-list">{attentionItems.map((item) => <Link href={item.href} key={item.href}><span className="task-count">{item.count}</span><span><strong>{item.count === 1 ? item.label : item.plural}</strong><small>{item.action} now</small></span><b aria-hidden="true">→</b></Link>)}</div> : <span className="caught-up-mark" aria-hidden="true">✓</span>}
    </section>
    <div className="today-main-grid">
      <section className="panel upcoming-card"><div className="card-heading-row"><div><span className="eyebrow">Coming up</span><h2>Your next classes</h2></div><Link className="text-link inline-link" href="/admin/classes">Full schedule →</Link></div>{meetings.length ? <div className="upcoming-list">{meetings.map((meeting) => <Link href={`/admin/classes#class-${meeting.id}`} key={meeting.id}><time>{classTime.format(new Date(meeting.starts_at))}</time><strong>{meeting.title}</strong><span>{attendanceCounts.get(meeting.id) ?? 0} planning to attend</span><b aria-hidden="true">›</b></Link>)}</div> : <div className="compact-empty"><p>No upcoming classes are scheduled.</p><Link href="/admin/classes">Add a class →</Link></div>}</section>
      <aside className="panel program-pulse"><span className="eyebrow">Current program</span><h2>{enrollments.length} of {session.capacity} spots filled</h2><div className="capacity-bar" aria-label={`${enrollments.length} of ${session.capacity} spots filled`}><span style={{ width: `${Math.min(100, (enrollments.length / session.capacity) * 100)}%` }} /></div><dl><div><dt>Active or invited</dt><dd>{enrollments.length}</dd></div><div><dt>Payment follow-up</dt><dd>{paymentNeeded}</dd></div></dl><Link className="button secondary" href={peopleHref}>Open people</Link></aside>
    </div>
    <section className="quick-action-strip" aria-label="Quick actions"><Link href={`/admin/people/add?program=${encodeURIComponent(session.id)}`}><span>＋</span><strong>Add someone</strong><small>Choose any program</small></Link><Link href="/admin/training"><span>ABC</span><strong>Build a workout</strong><small>Personal training plans</small></Link><Link href="/admin/communications"><span>↗</span><strong>Send an update</strong><small>Email your members</small></Link><Link href="/admin/classes#add-class"><span>□</span><strong>Add a class</strong><small>Update the schedule</small></Link></section>
  </main>;
}
