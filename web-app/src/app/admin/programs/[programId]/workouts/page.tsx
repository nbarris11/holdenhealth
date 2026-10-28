import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateLabel, detroitToday, isUuid, type Workout } from "@/lib/challenge";
import { cleanLibraryContent } from "@/lib/workout-library";
import WorkoutBuilder from "@/app/admin/challenges/workout-builder";
import { ArchiveForm } from "@/app/admin/challenges/forms";
import { LibraryPicker } from "@/app/admin/challenges/library-controls";
import "@/app/challenge/style.css";

export default async function ProgramWorkouts({ params, searchParams }: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ template?: string; saved?: string }>;
}) {
  await verifyAdmin();
  const { programId } = await params;
  const { template: templateId, saved } = await searchParams;
  if (!isUuid(programId)) notFound();
  const db = await createClient();
  const [programResult, workoutResult, logResult, enrollmentResult, templateResult] = await Promise.all([
    db.from("sessions").select("id,name,starts_on,ends_on,published,status").eq("id", programId).maybeSingle(),
    db.from("challenge_workouts").select("*").eq("session_id", programId).order("publish_on"),
    db.from("challenge_workout_logs").select("id,enrollment_id,status,elapsed_seconds,effort,note,completed_at,workout_title,enrollments!inner(session_id)").eq("enrollments.session_id", programId).order("completed_at", { ascending: false }).limit(100),
    db.from("enrollments").select("id,profiles(full_name)").eq("session_id", programId),
    templateId && isUuid(templateId) ? db.from("workout_library").select("content").eq("id", templateId).eq("kind", "workout").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if ([programResult, workoutResult, logResult, enrollmentResult, templateResult].some(r => r.error)) throw new Error("Program workouts could not be loaded. Please try again.");
  const program = programResult.data;
  if (!program) notFound();
  const scope = { ...program, title: program.name };
  const workouts = (workoutResult.data ?? []) as Workout[];
  const template = templateResult.data ? cleanLibraryContent("workout", templateResult.data.content)?.template : undefined;
  const names = new Map((enrollmentResult.data ?? []).map(e => [e.id, (e.profiles as unknown as { full_name: string } | null)?.full_name || "Member"]));
  return <main className="app-shell workspace-page challenge-shell">
    <header className="workspace-page-header">
      <Link href="/admin/training">← All programs</Link>
      <span className="eyebrow">{program.name}</span>
      <h1>At-home workouts</h1>
      <p>{dateLabel(program.starts_on)}–{dateLabel(program.ends_on)} · Write workouts once for everyone enrolled in this program.</p>
      <p>Save drafts now. Published workouts appear in members’ Workouts on their release date.</p>
      {(!program.published || ["draft", "cancelled"].includes(program.status)) && <p className="soft-note">This program is hidden or inactive. Its workouts will stay hidden from members until the program is available.</p>}
      <div className="button-row"><a className="button primary" href="#new-workout">+ Add a workout</a><Link className="button secondary" href={`/admin/people?program=${programId}`}>View people</Link></div>
    </header>
    <section className="panel">
      <h2>Workout plans</h2>
      {workouts.some(w => w.id === saved) && <p className="notice success" role="status">Workout saved.</p>}
      <LibraryPicker kind="workout" sessionId={programId} />
      {!workouts.length && <p>No workouts yet. Add your first workout below or start from a saved template.</p>}
      {workouts.map(w => <details className="challenge-editor" key={w.id} id={`workout-${w.id}`} open={saved === w.id}>
        <summary>{w.title} · {dateLabel(w.publish_on)} · {w.archived ? "Archived" : !w.published ? "Draft" : w.publish_on > detroitToday() ? "Scheduled" : "Published"}</summary>
        <WorkoutBuilder key={`${w.id}-${Boolean(w.archived)}`} challenge={scope} workout={w} classProgram />
        <div className="button-row"><Link className="button secondary" href={`/portal/workouts/${w.id}?preview=1`}>Preview workout &amp; session</Link></div>
        <ArchiveForm id={w.id} kind="workout" archived={Boolean(w.archived)} />
      </details>)}
      {templateId && !template && <p role="alert">That template could not be loaded. Choose another from the library.</p>}
      <details className="challenge-editor" id="new-workout" open={!workouts.length || Boolean(template)}>
        <summary>{template ? `New draft from ${template.title}` : "+ Add a workout"}</summary>
        <WorkoutBuilder key={`${programId}-${templateId || "new"}`} challenge={scope} template={template} classProgram />
      </details>
    </section>
    <section className="panel">
      <h2>Recent workout check-ins</h2>
      <p>Members’ latest 100 completed and partial sessions appear here.</p>
      {(logResult.data ?? []).map(log => <article className="soft-note" key={log.id}>
        <strong>{names.get(log.enrollment_id) || "Member"} · {log.workout_title}</strong>
        <p>{new Date(log.completed_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" })} · {log.status === "completed" ? "Completed" : "Partial"} · {Math.round(log.elapsed_seconds / 60)} minutes{log.effort ? ` · Effort ${log.effort}/10` : ""}</p>
        {log.note && <p>{log.note}</p>}
      </article>)}
      {!logResult.data?.length && <p>No workout check-ins yet.</p>}
    </section>
  </main>;
}
