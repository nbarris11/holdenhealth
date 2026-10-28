import { approveRegistrationRequest, declineRegistrationRequest, markWebsiteInquiryHandled } from "@/app/actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PERSONAL_TRAINING_PROGRAM } from "@/lib/people";

import PeopleDirectory from "./directory";
import ProgramSelect from "./program-select";
import PrivateSignups from "./private-signups";

type Profile = { id: string; full_name: string; phone: string | null };
type Contact = { user_id: string; email: string };
type Program = { id: string; name: string; new_member_price_cents: number; two_day_price_cents: number | null; starts_on: string; status: string };
type Enrollment = { id: string; member_id: string; status: string; returning_member: boolean; weekly_commitment: number | null; created_at: string };
type Payment = { enrollment_id: string; status: string };
type Intake = { enrollment_id: string; submitted_at: string; reviewed_at: string | null; health_review_required: boolean };
type WebsiteInquiry = { id: string; form_name: string; full_name: string; email: string; phone: string | null; topic: string | null; message: string | null; created_at: string };
type PeoplePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function friendlyStatus(status: string) {
  return ({ active: "Active", invited: "Invite sent", prospect: "Interested", completed: "Completed", withdrawn: "Past member", pending: "Payment needed", paid: "Paid", waived: "No payment needed", credited: "Credited", refunded: "Refunded" } as Record<string, string>)[status] ?? status;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  await verifyAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: sessionData } = await supabase.from("sessions").select("id,name,new_member_price_cents,two_day_price_cents,starts_on,status").order("starts_on", { ascending: true });
  const sessions = (sessionData ?? []) as Program[];
  const requestedProgramId = typeof params.program === "string" ? params.program : "";
  const personalTraining = requestedProgramId === PERSONAL_TRAINING_PROGRAM || sessions.length === 0;
  const session = sessions.find((item) => item.id === requestedProgramId) ?? sessions.find(item => ["enrolling", "active"].includes(item.status)) ?? sessions[0];
  const query = typeof params.q === "string" ? params.q : "";
  const programOptions = [{ id: PERSONAL_TRAINING_PROGRAM, name: "Personal Training" }, ...sessions.map(({ id, name }) => ({ id, name }))];
  if (personalTraining) return <main className="app-shell admin-shell workspace-page people-page">
    <header className="workspace-page-header"><div><span className="eyebrow">Personal Training</span><h1>People</h1><p>Your personal-training clients and their coaching records.</p></div><Link className="button primary" href="/admin/people/add?program=personal-training">Add someone</Link></header>
    <form className="panel stack-form" action="/admin/people">
      {query ? <input type="hidden" name="q" value={query} /> : null}
      <ProgramSelect programs={programOptions} selected={PERSONAL_TRAINING_PROGRAM} />
      <div><button className="button secondary" type="submit">View program</button></div>
    </form>
    <PeopleDirectory query={query} program={PERSONAL_TRAINING_PROGRAM} showEveryone={params.people === "all"} />
  </main>;

  const [{ data: enrollmentData }, { data: requestData }, { data: inquiryData }] = await Promise.all([
    supabase.from("enrollments").select("id,member_id,status,returning_member,weekly_commitment,created_at").eq("session_id", session.id).order("created_at", { ascending: false }),
    supabase.from("registration_requests").select("id,full_name,email,phone,returning_member,weekly_commitment,attendance_interest,note,status,created_at,approved_amount_cents,setup_email_sent_at").eq("session_id", session.id).order("created_at", { ascending: false }),
    supabase.from("website_inquiries").select("id,form_name,full_name,email,phone,topic,message,created_at").eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const memberIds = enrollments.map((row) => row.member_id);
  const enrollmentIds = enrollments.map((row) => row.id);
  const [{ data: profiles }, { data: contacts }, { data: payments }, { data: intakeData }] = await Promise.all([
    memberIds.length ? supabase.from("profiles").select("id,full_name,phone").in("id", memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("member_contacts").select("user_id,email").in("user_id", memberIds) : Promise.resolve({ data: [] }),
    enrollmentIds.length ? supabase.from("payment_records").select("enrollment_id,status").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [] }),
    enrollmentIds.length ? supabase.from("member_intakes").select("enrollment_id,submitted_at,reviewed_at,health_review_required").in("enrollment_id", enrollmentIds).order("submitted_at") : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map(((profiles ?? []) as Profile[]).map((row) => [row.id, row]));
  const contactMap = new Map(((contacts ?? []) as Contact[]).map((row) => [row.user_id, row]));
  const paymentMap = new Map(((payments ?? []) as Payment[]).map((row) => [row.enrollment_id, row]));
  const enrollmentMap = new Map(enrollments.map((row) => [row.id, row]));
  const pendingRequests = (requestData ?? []).filter((row) => row.status === "pending");
  const pendingInquiries = (inquiryData ?? []) as WebsiteInquiry[];
  const intakes = (intakeData ?? []) as Intake[];
  const pendingIntakes = intakes.filter((row) => !row.reviewed_at);
  const submittedIntakeIds = new Set(intakes.map((row) => row.enrollment_id));
  const currentMembers = enrollments.filter((row) => new Set(["active", "invited", "prospect"]).has(row.status));
  const pastMembers = enrollments.filter((row) => new Set(["completed", "withdrawn"]).has(row.status));

  return <main className="app-shell admin-shell workspace-page people-page">
    <header className="workspace-page-header"><div><span className="eyebrow">{session.name}</span><h1>People</h1><p>Challenge participants, members, and their program records, all in one place.</p></div><Link className="button primary" href="/admin/people/add">Add someone</Link></header>
    <form className="panel stack-form" action="/admin/people">
      {query ? <input type="hidden" name="q" value={query} /> : null}
      <ProgramSelect programs={programOptions} selected={session.id} />
      <div><button className="button secondary" type="submit">View program</button></div>
    </form>
    <PeopleDirectory query={query} program={session.id} showEveryone={params.people === "all"} />
    {(pendingInquiries.length || pendingRequests.length || pendingIntakes.length) ? <section className="people-attention panel"><div><span className="eyebrow">Needs attention</span><h2>{pendingInquiries.length + pendingRequests.length + pendingIntakes.length} coaching task{pendingInquiries.length + pendingRequests.length + pendingIntakes.length === 1 ? "" : "s"}</h2></div><div><a href="#inquiries"><strong>{pendingInquiries.length}</strong><span>website inquir{pendingInquiries.length === 1 ? "y" : "ies"}</span></a><a href="#intakes"><strong>{pendingIntakes.length}</strong><span>intake{pendingIntakes.length === 1 ? "" : "s"} to review</span></a><a href="#requests"><strong>{pendingRequests.length}</strong><span>new request{pendingRequests.length === 1 ? "" : "s"}</span></a></div></section> : null}

    <nav className="page-tabs" aria-label="People sections"><a href="#members">Current members</a><a href="#inquiries">Inquiries {pendingInquiries.length ? <b>{pendingInquiries.length}</b> : null}</a><a href="#intakes">Intakes {pendingIntakes.length ? <b>{pendingIntakes.length}</b> : null}</a><a href="#requests">Requests {pendingRequests.length ? <b>{pendingRequests.length}</b> : null}</a><a href="#past-members">Past members</a></nav>

    <section id="members" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Current program</span><h2>Current members</h2></div><p>Select someone to see payment, intake, and their member portal.</p></div><div className="panel member-list redesigned-member-list">{currentMembers.length ? currentMembers.map((enrollment) => { const profile = profileMap.get(enrollment.member_id); const contact = contactMap.get(enrollment.member_id); const payment = paymentMap.get(enrollment.id); const needsPayment = !new Set(["paid", "waived", "credited"]).has(payment?.status ?? "pending"); const needsIntakeReview = pendingIntakes.some((row) => row.enrollment_id === enrollment.id); const needsIntakeSubmission = new Set(["active", "invited"]).has(enrollment.status) && !submittedIntakeIds.has(enrollment.id); return <Link className="member-list-row" href={`/admin/members/${enrollment.id}`} key={enrollment.id}><div className="member-list-person"><strong>{profile?.full_name || "Member"}</strong><span>{contact?.email || profile?.phone || "No contact saved"}</span></div><div className="member-list-meta"><span>{enrollment.weekly_commitment ? `${enrollment.weekly_commitment} classes/week` : "Plan not set"}</span><span className={`status-pill ${enrollment.status === "active" ? "success" : "neutral"}`}>{friendlyStatus(enrollment.status)}</span>{needsPayment ? <span className="status-pill warning">Payment needed</span> : <span className="status-pill success">Paid</span>}{needsIntakeSubmission ? <span className="status-pill warning">Intake not submitted</span> : null}{needsIntakeReview ? <span className="status-pill warning">Intake ready</span> : null}<b aria-hidden="true">›</b></div></Link>; }) : <div className="compact-empty"><h3>No current members yet.</h3><p>Add someone or approve a registration request to begin.</p></div>}</div></section>

    <section id="inquiries" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Website leads</span><h2>New website inquiries</h2></div><p>Contact messages and free-call requests appear here until you mark them handled.</p></div><div className="approval-grid">{pendingInquiries.length ? pendingInquiries.map((inquiry) => <article className="panel approval-card inquiry-card" key={inquiry.id}><div className="roster-heading"><div><span className="eyebrow">{inquiry.form_name === "consultation-request" ? "Free-call request" : "Contact form"}</span><h3>{inquiry.full_name}</h3><p><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.phone ? <> · <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a></> : null}</p></div><span className="status-pill warning">Reply needed</span></div>{inquiry.topic ? <dl className="request-summary"><div><dt>Interested in</dt><dd>{inquiry.topic}</dd></div><div><dt>Received</dt><dd>{new Date(inquiry.created_at).toLocaleString("en-US")}</dd></div></dl> : null}{inquiry.message ? <div className="soft-note">{inquiry.message}</div> : null}<div className="button-row"><a className="button primary" href={`mailto:${inquiry.email}`}>Reply by email</a><form action={markWebsiteInquiryHandled}><input type="hidden" name="inquiryId" value={inquiry.id} /><button className="button secondary" type="submit">Mark handled</button></form></div></article>) : <div className="panel calm-empty compact"><span className="calm-check">✓</span><div><h3>No website inquiries waiting</h3><p>New contact and free-call forms will appear here.</p></div></div>}</div></section>

    <section id="intakes" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">New member setup</span><h2>Intakes ready for review</h2></div><p>Open each member record to review their private answers and activate their enrollment.</p></div><div className="panel member-list redesigned-member-list">{pendingIntakes.length ? pendingIntakes.map((intake) => { const enrollment = enrollmentMap.get(intake.enrollment_id); const profile = enrollment ? profileMap.get(enrollment.member_id) : null; return <Link className="member-list-row" href={`/admin/members/${intake.enrollment_id}`} key={intake.enrollment_id}><div className="member-list-person"><strong>{profile?.full_name || "Member"}</strong><span>Submitted {new Date(intake.submitted_at).toLocaleString("en-US")}</span></div><div className="member-list-meta">{intake.health_review_required ? <span className="status-pill warning">Health follow-up</span> : <span className="status-pill neutral">No health flag</span>}<span className="status-pill warning">Review needed</span><b aria-hidden="true">›</b></div></Link>; }) : <div className="compact-empty"><h3>No intakes waiting</h3><p>New submissions will appear here and notify you by email.</p></div>}</div></section>

    <PrivateSignups sessionId={session.id} message={typeof params.privateMessage === "string" ? params.privateMessage : undefined} />


    {params.approval && <p className="notice" role="status">{params.approval === "saved" ? "Approved. The member’s setup email includes the agreed price." : params.approval === "email-failed" ? "Approval saved, but the email failed. Retry sending below." : "Approval could not be saved. Check available places, the price, and whether this person already has a membership."}</p>}
    {(requestData ?? []).filter(r => r.status === "approved" && r.approved_amount_cents !== null && !r.setup_email_sent_at).map(r => <form className="panel" key={r.id} action={approveRegistrationRequest}><p>{r.full_name} · approval saved, email needs sending.</p><input type="hidden" name="requestId" value={r.id}/><input type="hidden" name="programId" value={session.id}/><input type="hidden" name="amount" value={(r.approved_amount_cents / 100).toFixed(2)}/><button className="button secondary">Retry setup email</button></form>)}
    <section id="requests" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">New interest</span><h2>Registration requests</h2></div><p>Approve after you have spoken with them and confirmed the program is a good fit.</p></div><div className="approval-grid">{pendingRequests.length ? pendingRequests.map((request) => <article className="panel approval-card" key={request.id}><div className="roster-heading"><div><h3>{request.full_name}</h3><p>{request.email} · {request.phone}</p></div><span className="status-pill warning">Waiting for you</span></div><dl className="request-summary"><div><dt>Interested in</dt><dd>{session.two_day_price_cents == null ? `All three weekly classes · ${request.returning_member ? "returning" : "new"} member` : `${request.weekly_commitment} classes per week`}</dd></div><div><dt>Preferred times</dt><dd>{(request.attendance_interest as string[]).join(", ")}</dd></div></dl>{request.note ? <div className="soft-note">{request.note}</div> : null}<div className="button-row"><form className="stack-form" action={approveRegistrationRequest}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="programId" value={session.id}/><label>Agreed program price ($)<input name="amount" type="number" min="0" max="10000" step="0.01" required placeholder="Enter the agreed price" /></label><p>Confirm space and price with the member. Payment by Venmo, cash, or check stays pending until recorded.</p><button className="button primary" type="submit">Approve and send setup email</button></form><form action={declineRegistrationRequest}><input type="hidden" name="requestId" value={request.id} /><button className="button secondary" type="submit">Decline request</button></form></div></article>) : <div className="panel calm-empty compact"><span className="calm-check">✓</span><div><h3>No requests waiting</h3><p>New requests will appear here and notify you by email.</p></div></div>}</div></section>


    {pastMembers.length ? <section id="past-members" className="workspace-section"><details className="panel past-members"><summary>{pastMembers.length} past member{pastMembers.length === 1 ? "" : "s"}</summary><div className="member-list">{pastMembers.map((enrollment) => { const profile = profileMap.get(enrollment.member_id); return <Link className="member-list-row" href={`/admin/members/${enrollment.id}`} key={enrollment.id}><div className="member-list-person"><strong>{profile?.full_name || "Member"}</strong><span>{friendlyStatus(enrollment.status)}</span></div><b aria-hidden="true">›</b></Link>; })}</div></details></section> : null}
  </main>;
}
