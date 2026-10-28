import WorkoutOverview from "@/components/workout-overview";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  detroitToday,
  isUuid,
  dateLabel,
  safeHttps,
  type Workout,
} from "@/lib/challenge";
import WorkoutSession from "./session";
import { workoutLibraryPath } from "@/lib/workout-program";
import { type ExerciseLoad } from "@/lib/exercise-loads";
export default async function WorkoutDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params,
    p = await searchParams;
  if (!isUuid(id)) notFound();
  const auth = await verifySession(),
    db = await createClient();
  const { data: role } =
    p.preview === "1"
      ? await db
          .from("staff_roles")
          .select("role")
          .eq("user_id", auth.userId)
          .eq("role", "admin")
          .maybeSingle()
      : { data: null };
  const preview = Boolean(role);
  const { data, error } = await db
    .from("challenge_workouts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Workout could not be loaded.");
  if (!data) notFound();
  const w = data as Workout;
  const [programResult, membershipResult] = await Promise.all([
    w.relationship_id ? db.from("coaching_relationships").select("starts_on,status,member_id").eq("id", w.relationship_id).maybeSingle() : w.session_id ? db.from("sessions").select("starts_on,ends_on,published,status").eq("id", w.session_id).maybeSingle() :
    db
      .from("habit_challenges")
      .select("*")
      .eq("id", w.challenge_id)
      .maybeSingle(),
    w.relationship_id ? db.from("coaching_relationships").select("id,status").eq("id", w.relationship_id).eq("member_id", auth.userId).maybeSingle() : w.session_id ? db.from("enrollments").select("id,status").eq("session_id", w.session_id).eq("member_id", auth.userId).in("status", ["invited", "active", "completed"]).maybeSingle() : db
      .from("challenge_participants")
      .select("id,joined_on")
      .eq("challenge_id", w.challenge_id)
      .eq("user_id", auth.userId)
      .maybeSingle(),
  ]);
  if (programResult.error || membershipResult.error) throw new Error("Workout access could not be checked. Please try again.");
  const rawProgram = programResult.data;
  const c = w.relationship_id && rawProgram ? { ...rawProgram, published: true, ends_on: "9999-12-31" } : rawProgram as { starts_on: string; ends_on: string; published: boolean; status?: string; archived?: boolean } | null;
  const member = membershipResult.data;
  const unavailable = c && ("status" in c ? ["draft", "cancelled", "invited"].includes(c.status || "") : c.archived);
  if (
    !c ||
    (!preview &&
      (!member ||
        !c.published ||
        unavailable ||
        !w.published ||
        w.archived ||
        w.publish_on > detroitToday()))
  )
    notFound();
  const canLog = Boolean(
    !preview &&
    member &&
    !("status" in member && (member.status === "completed" || (w.relationship_id && member.status !== "active"))) &&
    !("status" in c && c.status === "completed") &&
    detroitToday() >= c.starts_on &&
    detroitToday() <= c.ends_on,
  );
  const previousLoads: Record<string, { load: ExerciseLoad; performedOn: string }> = {};
  if (canLog && w.relationship_id) {
    const { data: history, error: historyError } = await db.from("challenge_workout_logs")
      .select("exercise_loads,performed_on")
      .eq("relationship_id", w.relationship_id)
      .order("completed_at", { ascending: false })
      .limit(200);
    if (historyError) throw new Error("Previous exercise weights could not be loaded.");
    for (const row of history ?? []) {
      if (!Array.isArray(row.exercise_loads)) continue;
      for (const load of row.exercise_loads as ExerciseLoad[]) {
        if (!load || typeof load.title !== "string" || typeof load.weightLbs !== "number") continue;
        const key = load.title.trim().toLocaleLowerCase();
        if (key && !previousLoads[key] && w.steps?.some((step) => step.section === "Main work" && step.title.trim().toLocaleLowerCase() === key))
          previousLoads[key] = { load, performedOn: row.performed_on };
      }
    }
  }
  return (
    <main className="member-page workout-detail">
      <Link
        className="member-detail-back"
        href={
          preview
            ? w.relationship_id ? `/admin/training/workouts/${w.relationship_id}` : w.session_id ? `/admin/programs/${w.session_id}/workouts` : `/admin/challenges?id=${w.challenge_id}`
            : workoutLibraryPath(w)
        }
      >
        ← {preview ? "Back to Kelsey’s workspace" : "All workouts"}
      </Link>
      {preview && (
        <aside className="member-preview">
          <strong>Read-only preview</strong>
          <p>
            {w.archived
              ? "Archived"
              : !w.published
                ? "Draft"
                : w.publish_on > detroitToday()
                  ? `Scheduled for ${dateLabel(w.publish_on)}`
                  : "Published"}
            . No workout or habit progress will be recorded.
          </p>
        </aside>
      )}
      <header className="workout-detail-header">
        <div className="workout-detail-eyebrow">
          <span>{w.level || "All levels"}</span>
          <span>{w.minutes} minutes</span>
          <span>{w.focus || "Full body"}</span>
        </div>
        <h1>{w.title}</h1>
        <details className="workout-equipment">
          <summary>
            What you’ll need <span aria-hidden="true">+</span>
          </summary>
          <p>
            {w.equipment ||
              "No equipment listed. Check the plan before starting."}
          </p>
        </details>
        <p className="workout-safety">
          Move comfortably. Take an easier option or stop if something hurts.
        </p>
      </header>
      <WorkoutSession
        workout={w}
        userId={auth.userId}
        canLog={canLog}
        preview={preview}
        previousLoads={previousLoads}
      />
      <WorkoutOverview workout={w} />
      {w.exercises.length > 0 && (
        <section className="workout-demonstrations">
          <h2>Demonstrations</h2>
          <div className="member-stack">
            {w.exercises
              .filter((e) => safeHttps(e.url))
              .map((e) => (
                <a
                  className="member-text-link"
                  key={e.url + e.label}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.label} ↗
                </a>
              ))}
          </div>
        </section>
      )}
      {!canLog && !preview && (
        <p className="member-notice">
          You can revisit the plan here. New sessions can only be saved during
          the program dates.
        </p>
      )}
    </main>
  );
}
