import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateLabel, detroitToday, isUuid } from "@/lib/challenge";
import { currentHabitWeek, habitCounts, weekDates, type HabitWeek, type HabitMark } from "@/lib/class-habits";
import { startMemberPreview } from "@/app/admin/preview-actions";

type Enrollment = { id: string; profiles: { full_name: string | null } | null };

export default async function ProgramHabits({ params }: { params: Promise<{ programId: string }> }) {
  await verifyAdmin();
  const { programId } = await params;
  if (!isUuid(programId)) notFound();
  const db = await createClient();
  const [programResult, enrollmentResult] = await Promise.all([
    db.from("sessions").select("id,name,starts_on,ends_on").eq("id", programId).maybeSingle(),
    db.from("enrollments").select("id,profiles(full_name)").eq("session_id", programId).in("status", ["invited", "active", "completed"]),
  ]);
  if (programResult.error || enrollmentResult.error) throw new Error("Program habits could not be loaded. Please try again.");
  const program = programResult.data;
  if (!program) notFound();
  const enrollments = ((enrollmentResult.data ?? []) as unknown as Enrollment[]).sort((a, b) => (a.profiles?.full_name || "Member").localeCompare(b.profiles?.full_name || "Member"));
  const today = detroitToday();
  const weekNumber = currentHabitWeek(program.starts_on, program.ends_on, today);
  const dates = weekDates(program.starts_on, program.ends_on, weekNumber);
  if (!dates) throw new Error("This program’s habit dates could not be loaded.");
  const weeksResult = enrollments.length ? await db.from("class_habit_weeks").select("id,enrollment_id,week_number,habits").in("enrollment_id", enrollments.map(e => e.id)).eq("week_number", weekNumber) : { data: [], error: null };
  if (weeksResult.error) throw new Error("Members’ weekly habits could not be loaded.");
  const weeks = (weeksResult.data ?? []) as HabitWeek[];
  const marksResult = weeks.length ? await db.from("class_habit_marks").select("week_id,day,habit_index").in("week_id", weeks.map(w => w.id)) : { data: [], error: null };
  if (marksResult.error) throw new Error("Members’ habit progress could not be loaded.");
  const marks = (marksResult.data ?? []) as HabitMark[];
  const through = today < dates.end ? today : dates.end;

  return <main className="app-shell admin-shell workspace-page">
    <header className="workspace-page-header">
      <Link href="/admin/training">← All programs</Link>
      <span className="eyebrow">{program.name}</span>
      <h1>Weekly habits</h1>
      <p>See the small promises members are working on and follow their progress here.</p>
    </header>
    <section className="panel">
      <h2>Keep small promises.</h2>
      <p>Members choose three habits in their class portal, check them off each day, and review their progress each week. Use View habit tracker below to see a member’s screen.</p>
      <p>{today < program.starts_on ? `Members can choose their habits now. Daily checkoffs open ${dateLabel(program.starts_on)}.` : today > program.ends_on ? "This program has finished. Members’ saved progress remains available." : "Daily checkoffs are open for active members."}</p>
      <p>Tracker previews are read-only. Members save their own habits and checkmarks.</p>
    </section>
    <section className="workspace-section">
      <div className="section-heading"><div><span className="eyebrow">{today > program.ends_on ? "Final week" : `Week ${weekNumber}`} · {dateLabel(dates.start)}–{dateLabel(dates.end)}</span><h2>Member habits · {enrollments.length}</h2></div></div>
      <div className="program-client-grid">{enrollments.map(enrollment => {
        const week = weeks.find(w => w.enrollment_id === enrollment.id);
        const counts = week ? habitCounts(week, marks, dates.start, through) : null;
        return <article className="panel" key={enrollment.id}>
          <h3>{enrollment.profiles?.full_name || "Member"}</h3>
          {week && counts ? <><p>{counts.days ? `${counts.fullDays} of ${counts.days} days with every habit checked this week.` : "Habits chosen. Daily tracking has not started yet."}</p><ul>{week.habits.map((habit, index) => <li key={index}>{habit}{counts.days > 0 ? ` · ${counts.perHabit[index]} of ${counts.days} days` : ""}</li>)}</ul></> : <p>No habits chosen for this week yet.</p>}
          <form action={startMemberPreview}>
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <input type="hidden" name="view" value="habits" />
            <button className="button primary" type="submit">View habit tracker</button>
          </form>
        </article>;
      })}</div>
      {!enrollments.length && <div className="panel calm-empty"><h3>No members enrolled yet.</h3><p>Members will appear here once they’re enrolled in this program.</p><Link className="button secondary" href={`/admin/people?program=${programId}`}>View program people</Link></div>}
    </section>
  </main>;
}
