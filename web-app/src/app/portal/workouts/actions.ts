"use server";
import {queueCoachActivityDelivery} from "@/lib/coach-activity";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { detroitToday, isUuid, type FormResult } from "@/lib/challenge";
import { mondayOf } from "@/lib/workout-app";
import { captureServerEvent } from "@/lib/posthog-server";
import { validExerciseLoads, type ExerciseLoad } from "@/lib/exercise-loads";
import { validSteps } from "@/lib/workout-app";
import { revalidatePath } from "next/cache";
export async function saveSession(input: {
  id: string;
  workoutId: string;
  revision: number;
  status: "completed" | "partial";
  seconds: number;
  effort: number | null;
  note: string;
  exerciseLoads?: ExerciseLoad[];
}): Promise<FormResult & { weeklyCompleted?: number }> {
  const auth = await verifySession();
  if (
    !isUuid(input.id) ||
    !isUuid(input.workoutId) ||
    !["completed", "partial"].includes(input.status) ||
    !Number.isInteger(input.seconds) ||
    input.seconds < 0 ||
    input.seconds > 10800 ||
    typeof input.note !== "string" ||
    input.note.length > 2000 ||
    (input.effort !== null &&
      (!Number.isInteger(input.effort) ||
        input.effort < 1 ||
        input.effort > 10))
  )
    return { error: "Please check your session details." };
  const db = await createClient();
  async function membership(workout: { challenge_id: string | null; session_id: string | null; relationship_id?: string | null }) {
    if (workout.relationship_id) {
      const { data } = await db.from("coaching_relationships").select("id").eq("id", workout.relationship_id).eq("member_id", auth.userId).eq("status", "active").maybeSingle();
      return data ? { id: data.id, column: "relationship_id" as const } : null;
    }
    if (workout.session_id) {
      const { data } = await db.from("enrollments").select("id").eq("session_id", workout.session_id).eq("member_id", auth.userId).in("status", ["invited", "active", "completed"]).maybeSingle();
      return data ? { id: data.id, column: "enrollment_id" as const } : null;
    }
    const { data } = await db.from("challenge_participants").select("id").eq("challenge_id", workout.challenge_id).eq("user_id", auth.userId).maybeSingle();
    return data ? { id: data.id, column: "participant_id" as const } : null;
  }
  const { data: existing } = await db
    .from("challenge_workout_logs")
    .select("id,workout_id")
    .eq("id", input.id)
    .maybeSingle();
  async function success() {
    const { data: workout } = await db
      .from("challenge_workouts")
      .select("challenge_id,session_id,relationship_id")
      .eq("id", input.workoutId)
      .maybeSingle();
    if (!workout) return { success: "Your session is saved." };
    const participant = await membership(workout);
    if (!participant) return { success: "Your session is saved." };
    const today = detroitToday();
    const { count, error } = await db
      .from("challenge_workout_logs")
      .select("id", { count: "exact", head: true })
      .eq(participant.column, participant.id)
      .eq("status", "completed")
      .gte("performed_on", mondayOf(today))
      .lte("performed_on", today);
    return {
      success: "Your session is saved.",
      ...(!error && count !== null ? { weeklyCompleted: count } : {}),
    };
  }
  if (existing)
    return existing.workout_id === input.workoutId
      ? success()
      : { error: "Please start a new session." };
  const { data: w } = await db
    .from("challenge_workouts")
    .select("challenge_id,session_id,relationship_id,published,archived,publish_on,revision,steps")
    .eq("id", input.workoutId)
    .maybeSingle();
  if (!w || !w.published || w.archived || w.publish_on > detroitToday())
    return {
      error:
        "This workout is no longer available. Your session is kept on this device; contact Kelsey for help.",
    };
  if (w.revision !== input.revision)
    return {
      error:
        "Kelsey updated this workout during your session. Please contact her before starting the updated version. Your session is still on this device.",
    };
  const loads = input.exerciseLoads ?? [];
  if (!validSteps(w.steps) || !validExerciseLoads(loads, w.steps) || (!w.relationship_id && loads.length))
    return { error: "Please check the weights and reps you entered." };
  const p = await membership(w);
  if (!p) return { error: "You need to be enrolled in this program to save a workout." };
  const { error } = await db.from("challenge_workout_logs").insert({
    id: input.id,
    [p.column]: p.id,
    workout_id: input.workoutId,
    status: input.status,
    elapsed_seconds: input.seconds,
    effort: input.effort,
    note: input.note.trim(),
    exercise_loads: loads,
  });
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("challenge_workout_logs")
        .select("workout_id")
        .eq("id", input.id)
        .eq(p.column, p.id)
        .maybeSingle();
      if (retry?.workout_id === input.workoutId) return success();
    }
    return {
      error:
        "Your session did not save. Check your connection and that the program is still active, then retry. Your session stays on this device.",
    };
  }
  queueCoachActivityDelivery();
  await captureServerEvent(auth.userId, "workout_session_saved", {
    elapsed_seconds: input.seconds,
    status: input.status,
  });
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/challenges");
  revalidatePath("/admin/programs/[programId]/workouts", "page");
  return success();
}
