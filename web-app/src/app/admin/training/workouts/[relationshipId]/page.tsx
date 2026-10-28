import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateLabel, detroitToday, isUuid, type Workout } from "@/lib/challenge";
import { cleanLibraryContent, repeatTemplate } from "@/lib/workout-library";
import WorkoutBuilder from "@/app/admin/challenges/workout-builder";
import { LibraryPicker } from "@/app/admin/challenges/library-controls";
import { ArchiveForm } from "@/app/admin/challenges/forms";
import { displayExerciseLoad, type ExerciseLoad } from "@/lib/exercise-loads";

import "@/app/challenge/style.css";

export default async function PersonalWorkouts({ params, searchParams }: {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<{ template?: string; saved?: string; repeat?: string }>;
}) {
  await verifyAdmin();
  const { relationshipId } = await params;
  const { template: templateId, saved, repeat: repeatId } = await searchParams;
  if (!isUuid(relationshipId)) notFound();
  const db = await createClient();
  const [programResult, workoutResult, logResult, enrollmentResult, templateResult] = await Promise.all([
    db.from("coaching_relationships").select("id,member_id,starts_on,status,profiles!coaching_relationships_member_id_fkey(full_name)").eq("id", relationshipId).maybeSingle(),
    db.from("challenge_workouts").select("*").eq("relationship_id", relationshipId).order("publish_on"),
    db.from("challenge_workout_logs").select("id,status,elapsed_seconds,effort,note,completed_at,workout_title,exercise_loads").eq("relationship_id", relationshipId).order("completed_at", { ascending: false }).limit(500),
    Promise.resolve({data: [], error: null}),
    templateId && isUuid(templateId) ? db.from("workout_library").select("content").eq("id", templateId).eq("kind", "workout").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if ([programResult, workoutResult, logResult, enrollmentResult, templateResult].some(r => r.error)) throw new Error("Program workouts could not be loaded. Please try again.");
  const program = programResult.data;
  if (!program) notFound();
  const name = (program.profiles as unknown as { full_name: string } | null)?.full_name || "Personal training";
  const scope = { id: program.id, starts_on: program.starts_on, ends_on: "9999-12-31", title: name };
  const workouts = (workoutResult.data ?? []) as Workout[];
  const repeatSource = repeatId && isUuid(repeatId) ? workouts.find(w => w.id === repeatId) : undefined;
  const template = repeatSource ? repeatTemplate(repeatSource) : templateResult.data ? cleanLibraryContent("workout", templateResult.data.content)?.template : undefined;
  const progression = new Map<string, { title: string; entries: { date: string; load: ExerciseLoad }[] }>();
  for (const log of [...(logResult.data ?? [])].reverse()) {
    if (!Array.isArray(log.exercise_loads)) continue;
    for (const load of log.exercise_loads as ExerciseLoad[]) {
      const key = load.title.trim().toLocaleLowerCase();
      if (!key) continue;
      if (!progression.has(key)) progression.set(key, { title: load.title, entries: [] });
      progression.get(key)!.entries.push({ date: new Date(log.completed_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" }), load });
    }
  }
  return <main className="app-shell workspace-page challenge-shell">
    <header className="workspace-page-header">
      <Link href="/admin/training">← All programs</Link>
      <span className="eyebrow">{name}</span>
      <h1>At-home workouts</h1>
      <p>One workout at a time, assigned privately to this client.</p>
      {program.status !== "withdrawn" && <p>Save drafts now. Published workouts appear in members’ Workouts on their release date.</p>}
      {program.status !== "active" && <p className="soft-note">This client is not active. They cannot log new sessions until personal training is active.</p>}
      <div className="button-row">{program.status !== "withdrawn" && <a className="button primary" href="#new-workout">+ Add a workout</a>}<Link className="button secondary" href={`/admin/training/${program.member_id}`}>Client workspace</Link></div>
    </header>
    <section className="panel">
      <h2>Workout plans</h2>
      {program.status !== "withdrawn" && <LibraryPicker kind="workout" relationshipId={relationshipId}/>}
      {workouts.some(w => w.id === saved) && <p className="notice success" role="status">Workout saved.</p>}

      {!workouts.length && <p>{program.status === "withdrawn" ? "No workouts were saved for this client." : "No workouts yet. Add your first workout below or start from a saved template."}</p>}
      {workouts.map(w => <details className="challenge-editor" key={w.id} id={`workout-${w.id}`} open={saved === w.id}>
        <summary>{w.title} · {dateLabel(w.publish_on)} · {w.archived ? "Archived" : !w.published ? "Draft" : w.publish_on > detroitToday() ? "Scheduled" : "Published"}</summary>
        {program.status !== "withdrawn" && <WorkoutBuilder key={`${w.id}-${Boolean(w.archived)}`} challenge={scope} workout={w} personalProgram />}
        <div className="button-row"><Link className="button secondary" href={`/portal/workouts/${w.id}?preview=1`}>Preview workout &amp; session</Link>{program.status !== "withdrawn" && <Link className="button secondary" href={`?repeat=${w.id}#new-workout`}>Repeat on a new date</Link>}</div>
        {program.status !== "withdrawn" && <ArchiveForm id={w.id} kind="workout" archived={Boolean(w.archived)} />}
      </details>)}
      {templateId && !template && <p role="alert">That template could not be loaded. Choose another from the library.</p>}
      {program.status !== "withdrawn" && <details className="challenge-editor" id="new-workout" open={!workouts.length || Boolean(template)}>
        <summary>{repeatSource ? `Repeat of ${repeatSource.title}: choose a new date` : template ? `New draft from ${template.title}` : "+ Add a workout"}</summary>
        <WorkoutBuilder key={`${relationshipId}-${repeatSource?.id || templateId || "new"}`} challenge={scope} template={template} defaultPublished={repeatSource?.published ?? false} personalProgram />
      </details>}
    </section>
    <section className="panel" id="check-ins">
      <h2>Recent workout check-ins</h2>
      <p>Members’ latest 100 completed and partial sessions appear here.</p>
      {(logResult.data ?? []).slice(0, 100).map(log => <article className="soft-note" key={log.id}>
        <strong>{log.workout_title}</strong>
        <p>{new Date(log.completed_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" })} · {log.status === "completed" ? "Completed" : "Partial"} · {Math.round(log.elapsed_seconds / 60)} minutes{log.effort ? ` · Effort ${log.effort}/10` : ""}</p>
        {log.note && <p>{log.note}</p>}
        {Array.isArray(log.exercise_loads) && log.exercise_loads.length > 0 && <p>{(log.exercise_loads as ExerciseLoad[]).map(load => `${load.title}: ${displayExerciseLoad(load)}`).join(" · ")}</p>}
      </article>)}
      {!logResult.data?.length && <p>No workout check-ins yet.</p>}
    </section>
    <section className="panel" id="strength-progress">
      <h2>Strength progression</h2>
      <p>Weights and reps this client recorded in their last 500 workout check-ins.</p>
      {progression.size ? <div className="member-stack">{[...progression.values()].map(({ title, entries }) => <details className="soft-note" key={title}>
        <summary><strong>{title}</strong> · {displayExerciseLoad(entries[entries.length - 1].load)} latest</summary>
        <p>First recorded: {displayExerciseLoad(entries[0].load)} on {entries[0].date}</p>
        <ul>{entries.slice(-10).reverse().map((entry, index) => <li key={`${entry.date}-${index}`}>{entry.date}: {displayExerciseLoad(entry.load)}</li>)}</ul>
      </details>)}</div> : <p>No weights recorded yet. They’ll appear here after the client logs them in a workout check-in.</p>}
    </section>
  </main>;
}
