import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ReportsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Program = { id: string; name: string; status: string; capacity: number; starts_on: string; ends_on: string };
type Enrollment = { id: string; status: string; returning_member: boolean; weekly_commitment: number | null };
type Payment = { enrollment_id: string; status: string; amount_cents: number; method: string | null };
type Request = { id: string; status: string };
type CheckIn = { enrollment_id: string; week_number: number; reviewed_at: string | null };
type Intake = { enrollment_id: string; reviewed_at: string | null };
type Meeting = { id: string; title: string; starts_at: string; cancelled: boolean; drop_in_capacity: number };
type Selection = { meeting_id: string };
type DropIn = { meeting_id: string; status: string };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" });
const classDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

function percent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "—";
}

function programWeek(program: Program) {
  const now = new Date();
  const start = new Date(`${program.starts_on}T12:00:00Z`);
  const end = new Date(`${program.ends_on}T12:00:00Z`);
  if (now < start) return 1;
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 86400000) / 604800000));
  return Math.min(weeks, Math.max(1, Math.floor((now.getTime() - start.getTime()) / 604800000) + 1));
}

function SummaryStat({ label, value, detail, attention = false }: { label: string; value: string | number; detail: string; attention?: boolean }) {
  return <div className={attention ? "report-stat attention" : "report-stat"}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function DataList({ rows }: { rows: { label: string; value: string | number; note?: string }[] }) {
  return <dl className="report-data-list">{rows.map((row) => <div key={row.label}><dt>{row.label}{row.note ? <small>{row.note}</small> : null}</dt><dd>{row.value}</dd></div>)}</dl>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: programData, error: programError } = await supabase
    .from("sessions")
    .select("id,name,status,capacity,starts_on,ends_on")
    .order("starts_on", { ascending: false });

  if (programError) throw new Error("The program list could not be loaded.");
  const programs = (programData ?? []) as Program[];
  if (!programs.length) return <main className="app-shell admin-shell workspace-page"><section className="panel calm-empty"><h1>No programs found.</h1><p>Create a program before opening reports.</p><Link href="/admin/settings">Open program settings</Link></section></main>;

  const requestedProgramId = typeof params.program === "string" ? params.program : "";
  const program = programs.find((item) => item.id === requestedProgramId)
    ?? programs.find((item) => new Set(["enrolling", "active"]).has(item.status))
    ?? programs[0];

  const [enrollmentResult, requestResult, meetingResult] = await Promise.all([
    supabase.from("enrollments").select("id,status,returning_member,weekly_commitment").eq("session_id", program.id),
    supabase.from("registration_requests").select("id,status").eq("session_id", program.id),
    supabase.from("class_meetings").select("id,title,starts_at,cancelled,drop_in_capacity").eq("session_id", program.id).order("starts_at"),
  ]);
  if (enrollmentResult.error || requestResult.error || meetingResult.error) throw new Error("The report data could not be loaded.");

  const enrollments = (enrollmentResult.data ?? []) as Enrollment[];
  const requests = (requestResult.data ?? []) as Request[];
  const meetings = (meetingResult.data ?? []) as Meeting[];
  const enrollmentIds = enrollments.map((row) => row.id);
  const meetingIds = meetings.map((row) => row.id);

  const [paymentResult, checkInResult, intakeResult, selectionResult, dropInResult] = await Promise.all([
    enrollmentIds.length ? supabase.from("payment_records").select("enrollment_id,status,amount_cents,method").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length ? supabase.from("check_ins").select("enrollment_id,week_number,reviewed_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length ? supabase.from("member_intakes").select("enrollment_id,reviewed_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
    meetingIds.length ? supabase.from("attendance_selections").select("meeting_id").in("meeting_id", meetingIds) : Promise.resolve({ data: [], error: null }),
    meetingIds.length ? supabase.from("drop_in_bookings").select("meeting_id,status").in("meeting_id", meetingIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentResult.error || checkInResult.error || intakeResult.error || selectionResult.error || dropInResult.error) throw new Error("Some report details could not be loaded.");

  const payments = (paymentResult.data ?? []) as Payment[];
  const checkIns = (checkInResult.data ?? []) as CheckIn[];
  const intakes = (intakeResult.data ?? []) as Intake[];
  const selections = (selectionResult.data ?? []) as Selection[];
  const dropIns = (dropInResult.data ?? []) as DropIn[];
  const currentEnrollments = enrollments.filter((row) => new Set(["invited", "active"]).has(row.status));
  const activeEnrollments = enrollments.filter((row) => row.status === "active");
  const currentEnrollmentIds = new Set(currentEnrollments.map((row) => row.id));
  const activeEnrollmentIds = new Set(activeEnrollments.map((row) => row.id));
  const paidPayments = payments.filter((row) => row.status === "paid");
  const pendingPayments = payments.filter((row) => row.status === "pending" && currentEnrollmentIds.has(row.enrollment_id));
  const revenue = paidPayments.reduce((sum, row) => sum + row.amount_cents, 0);
  const outstanding = pendingPayments.reduce((sum, row) => sum + row.amount_cents, 0);
  const returning = currentEnrollments.filter((row) => row.returning_member).length;
  const twoDay = currentEnrollments.filter((row) => row.weekly_commitment === 2).length;
  const threeDay = currentEnrollments.filter((row) => row.weekly_commitment === 3).length;
  const approvedRequests = requests.filter((row) => row.status === "approved").length;
  const pendingRequests = requests.filter((row) => row.status === "pending").length;
  const declinedRequests = requests.filter((row) => row.status === "declined").length;
  const weekNumber = programWeek(program);
  const submittedThisWeek = new Set(checkIns.filter((row) => row.week_number === weekNumber && activeEnrollmentIds.has(row.enrollment_id)).map((row) => row.enrollment_id)).size;
  const missingThisWeek = program.status === "active" ? Math.max(0, activeEnrollments.length - submittedThisWeek) : 0;
  const reviewedCheckIns = checkIns.filter((row) => row.reviewed_at).length;
  const currentIntakes = intakes.filter((row) => currentEnrollmentIds.has(row.enrollment_id));
  const reviewedIntakes = currentIntakes.filter((row) => row.reviewed_at).length;
  const intakesWaitingReview = currentIntakes.filter((row) => !row.reviewed_at).length;
  const missingIntakes = Math.max(0, currentEnrollments.length - currentIntakes.length);
  const activeMeetingCount = meetings.filter((row) => !row.cancelled).length;
  const activeMeetingIds = new Set(meetings.filter((row) => !row.cancelled).map((row) => row.id));
  const cancelledMeetingCount = meetings.length - activeMeetingCount;
  const confirmedDropIns = dropIns.filter((row) => row.status === "confirmed").length;
  const waitingDropIns = dropIns.filter((row) => row.status === "requested").length;
  const selectionCounts = selections.reduce((counts, row) => counts.set(row.meeting_id, (counts.get(row.meeting_id) ?? 0) + 1), new Map<string, number>());
  const dropInCounts = dropIns.filter((row) => new Set(["requested", "confirmed"]).has(row.status)).reduce((counts, row) => counts.set(row.meeting_id, (counts.get(row.meeting_id) ?? 0) + 1), new Map<string, number>());
  const demandRows = meetings.filter((row) => !row.cancelled).map((meeting) => ({ ...meeting, planned: selectionCounts.get(meeting.id) ?? 0, dropIns: dropInCounts.get(meeting.id) ?? 0 })).sort((a, b) => (b.planned + b.dropIns) - (a.planned + a.dropIns));
  const activeSelections = selections.filter((row) => activeMeetingIds.has(row.meeting_id)).length;
  const averagePlanned = activeMeetingCount ? activeSelections / activeMeetingCount : 0;
  const peopleHref = `/admin/people?program=${encodeURIComponent(program.id)}`;
  const attentionItems = [
    { count: pendingPayments.length, label: "payments need follow-up", detail: currency.format(outstanding / 100), href: `${peopleHref}#members` },
    { count: pendingRequests, label: "registration requests waiting", detail: "Review", href: `${peopleHref}#requests` },
    { count: intakesWaitingReview, label: `intake${intakesWaitingReview === 1 ? "" : "s"} waiting for review`, detail: "Review", href: `${peopleHref}#intakes` },
    { count: missingIntakes, label: `intake${missingIntakes === 1 ? "" : "s"} not submitted`, detail: "View members", href: `${peopleHref}#members` },
    { count: missingThisWeek, label: `week ${weekNumber} check-ins missing`, detail: "View members", href: `${peopleHref}#members` },
    { count: waitingDropIns, label: "drop-in requests waiting", detail: "Review", href: "/admin/classes#bookings" },
  ].filter((item) => item.count > 0);

  return <main className="app-shell admin-shell workspace-page reports-page">
    <header className="reports-toolbar"><div><h1>Reports</h1><p>{program.name} <span>·</span> {shortDate.format(new Date(`${program.starts_on}T12:00:00Z`))}–{shortDate.format(new Date(`${program.ends_on}T12:00:00Z`))} <span>·</span> {program.status}</p></div><form className="report-program-picker" method="get"><label htmlFor="report-program">Program</label><select id="report-program" name="program" defaultValue={program.id}>{programs.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="button secondary" type="submit">Apply</button></form></header>

    <nav className="reports-subnav" aria-label="Report sections"><a href="#overview">Summary</a><a href="#enrollment">Enrollment</a><a href="#engagement">Engagement</a><a href="#classes">Classes</a></nav>

    <section className="reports-attention" aria-labelledby="reports-attention-heading"><div className="reports-attention-title"><h2 id="reports-attention-heading">Needs attention</h2><span>{attentionItems.reduce((sum, item) => sum + item.count, 0)}</span></div>{attentionItems.length ? <div className="reports-attention-list">{attentionItems.map((item) => <Link href={item.href} key={item.label}><b>{item.count}</b><span>{item.label}</span><small>{item.detail} →</small></Link>)}</div> : <p className="reports-clear"><b>✓</b> Nothing needs follow-up right now.</p>}</section>

    <section id="overview" className="report-section"><div className="reports-section-header"><div><h2>Summary</h2><p>Current program totals</p></div><Link href={peopleHref}>View people →</Link></div><div className="report-stat-strip">
      <SummaryStat label="Collected" value={currency.format(revenue / 100)} detail={`${paidPayments.length} paid`} />
      <SummaryStat label="Outstanding" value={currency.format(outstanding / 100)} detail={`${pendingPayments.length} pending`} attention={pendingPayments.length > 0} />
      <SummaryStat label="Spots filled" value={`${currentEnrollments.length} / ${program.capacity}`} detail={`${Math.max(0, program.capacity - currentEnrollments.length)} available`} />
      <SummaryStat label="Returning" value={returning} detail={percent(returning, currentEnrollments.length)} />
      <SummaryStat label="Check-ins this week" value={`${submittedThisWeek} / ${activeEnrollments.length}`} detail={`${missingThisWeek} missing`} attention={missingThisWeek > 0} />
    </div></section>

    <div className="reports-grid">
      <section id="enrollment" className="report-section report-data-block"><div className="reports-section-header"><div><h2>Enrollment</h2><p>Requests and current members</p></div><Link href={`${peopleHref}#requests`}>Open requests →</Link></div><DataList rows={[
        { label: "Registration requests", value: requests.length },
        { label: "Approved", value: approvedRequests },
        { label: "Pending", value: pendingRequests },
        { label: "Declined", value: declinedRequests },
        { label: "Request conversion", value: percent(approvedRequests, requests.length), note: "Manual adds excluded" },
        { label: "2-class plan", value: twoDay },
        { label: "3-class plan", value: threeDay },
      ]} /></section>

      <section id="engagement" className="report-section report-data-block"><div className="reports-section-header"><div><h2>Engagement</h2><p>Member and coach follow-through</p></div><Link href={`${peopleHref}#check-ins`}>Open check-ins →</Link></div><DataList rows={[
        { label: `Week ${weekNumber} check-ins submitted`, value: `${submittedThisWeek} / ${activeEnrollments.length}` },
        { label: "Week check-ins missing", value: missingThisWeek },
        { label: "All check-ins reviewed", value: `${reviewedCheckIns} / ${checkIns.length}` },
        { label: "Current member intakes", value: currentIntakes.length },
        { label: "Intakes reviewed", value: reviewedIntakes },
        { label: "Intakes waiting for review", value: intakesWaitingReview },
        { label: "Intakes not submitted", value: missingIntakes },
      ]} /></section>
    </div>

    <section id="classes" className="report-section report-data-block report-classes"><div className="reports-section-header"><div><h2>Classes</h2><p>Planned attendance only—not confirmed arrivals</p></div><Link href="/admin/classes">Open schedule →</Link></div><div className="report-class-summary"><span><b>{averagePlanned.toFixed(1)}</b> average planned</span><span><b>{confirmedDropIns}</b> confirmed drop-ins</span><span><b>{activeMeetingCount}</b> scheduled</span><span><b>{cancelledMeetingCount}</b> cancelled</span></div>
      {demandRows.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Class</th><th>Date</th><th>Members planning</th><th>Drop-ins</th><th>Total interest</th></tr></thead><tbody>{demandRows.map((meeting) => <tr key={meeting.id}><td><strong>{meeting.title}</strong></td><td>{classDate.format(new Date(meeting.starts_at))}</td><td>{meeting.planned}</td><td>{meeting.dropIns}</td><td><strong>{meeting.planned + meeting.dropIns}</strong></td></tr>)}</tbody></table></div> : <p className="reports-empty">No classes are scheduled for this program.</p>}
    </section>
  </main>;
}
