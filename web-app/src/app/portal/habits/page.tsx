import { memberData } from "@/lib/member-data";
import Tracker from "@/app/challenge/tracker";
import Link from "next/link";
import { memberEnrollments } from "@/lib/member-enrollments";
import { chooseEnrollment, type GroupProgram } from "@/lib/member-session";
import { verifySession } from "@/lib/auth";
import { cookies } from "next/headers";
import { stopMemberPreview } from "@/app/admin/preview-actions";
import { createClient } from "@/lib/supabase/server";
import { currentHabitWeek, type HabitMark, type HabitWeek } from "@/lib/class-habits";
import ClassTracker from "./class-tracker";
import PersonalHabits from "@/components/personal-habits";
import { commentRows } from "@/lib/habit-comments";
import "@/app/challenge/style.css";
export default async function Habits({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; enrollment?: string }>;
}) {
  const params = await searchParams;
  const [d, enrollments] = await Promise.all([memberData(params.challenge), memberEnrollments()]);
  const db = await createClient();
  const auth = await verifySession();
  const { data: adminRole, error: roleError } = await db.from("staff_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
  if (roleError) throw new Error("Your account access could not be checked.");
  const previewId = adminRole ? (await cookies()).get("holden_admin_enrollment_preview")?.value : undefined;
  const isPreview = Boolean(previewId);
  const previewResult = previewId ? await db.from("enrollments").select("id,member_id,sessions(id,name,description,starts_on,ends_on,address_line,city,state)").eq("id", previewId).maybeSingle() : { data: null, error: null };
  if (previewResult.error) throw new Error("Member preview could not be loaded.");
  const enrollment = isPreview ? previewResult.data : chooseEnrollment(enrollments, d.today, params.enrollment);
  const session = enrollment?.sessions as unknown as GroupProgram | null;
  const weeksResult = enrollment ? await db.from("class_habit_weeks").select("id,enrollment_id,week_number,habits,version").eq("enrollment_id", enrollment.id).order("week_number") : { data: [], error: null };
  if (weeksResult.error) throw new Error("Your class habits could not be loaded.");
  const weeks = (weeksResult.data ?? []) as HabitWeek[];
  const marksResult = weeks.length ? await db.from("class_habit_marks").select("week_id,day,habit_index").in("week_id", weeks.map(week => week.id)) : { data: [], error: null };
  if (marksResult.error) throw new Error("Your saved habit days could not be loaded.");
  const revisionResult = weeks.length ? await db.from("habit_week_revisions").select("*").in("week_id", weeks.map(w => w.id)).order("created_at", {ascending: false}) : {data: [], error: null};
  if (revisionResult.error) throw new Error("Habit history could not be loaded.");
  const comments = commentRows(weeks.length ? await db.from("habit_comments").select("*").in("week_id", weeks.map(w => w.id)).order("created_at") : { data: [], error: null });
  const ownerId = isPreview ? (previewResult.data as { member_id?: string } | null)?.member_id ?? "" : auth.userId;
  return (
    <main className="member-page member-habits">
      <span className="member-kicker">Small things, every day</span>
      <h1>Your habits</h1>
      {isPreview && <aside className="preview-banner"><strong>Admin preview · this member’s class habits</strong><span>Read-only checkmarks · you can comment on any day’s habit.</span><form action={stopMemberPreview}><button className="member-button secondary">Return to admin</button></form></aside>}
      {enrollment && <p><Link className="member-text-link" href={`/portal/session?enrollment=${enrollment.id}`}>Class calendar & details →</Link></p>}
      {!isPreview && enrollments.length > 1 && <nav className="member-actions" aria-label="Choose class session">{enrollments.map(row => <Link key={row.id} className={`member-button ${row.id === enrollment?.id ? "" : "secondary"}`} href={`/portal/habits?enrollment=${row.id}`}>{row.sessions?.name || "Class session"}</Link>)}</nav>}
      {enrollment && session && <ClassTracker key={`${enrollment.id}-${currentHabitWeek(session.starts_on, session.ends_on, d.today)}`} readOnly={isPreview} enrollmentId={enrollment.id} sessionName={session.name} startsOn={session.starts_on} endsOn={session.ends_on} today={d.today} weekNumber={currentHabitWeek(session.starts_on, session.ends_on, d.today)} weeks={weeks} revisions={revisionResult.data ?? []} marks={(marksResult.data ?? []) as HabitMark[]} comments={comments} commenter={isPreview ? "coach" : "member"} ownerId={ownerId} />}
      {adminRole && !enrollment && <section className="member-card"><h2>{isPreview ? "That member preview is unavailable." : "Preview a member’s weekly habits"}</h2><p>Open a class member in People and choose their member portal preview. Then open Weekly habits in their program.</p><Link className="member-button" href="/admin/people">Open People →</Link></section>}
      {!isPreview && d.training && <><h2>Personal training habits</h2><PersonalHabits memberId={auth.userId} commenter="member" /></>}
      {!isPreview && d.challenge && d.participant ? (
        <><h2>Free challenge habits</h2>
        <Tracker
          challenge={d.challenge}
          participant={d.participant}
          marks={d.marks}
          today={d.today}
        /></>
      ) : !enrollment && !adminRole && !d.training ? (
        <div className="member-card">
          <p>Join a challenge to choose your three habits.</p>
          <Link className="member-button" href="/challenge">
            Explore the challenge
          </Link>
        </div>
      ) : null}
    </main>
  );
}
