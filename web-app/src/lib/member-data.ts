import "server-only";
import { cache } from "react";
import { verifySession } from "./auth";
import { createClient } from "./supabase/server";
import {
  detroitToday,
  type Challenge,
  type Participant,
  type Workout,
  type Checkmark,
} from "./challenge";
import type { WorkoutLog } from "./workout-app";

export const memberData = cache(async (requested?: string, requestedProgram?: string) => {
  const auth = await verifySession();
  const db = await createClient();
  const today = detroitToday();
  const results = await Promise.all([
    db.from("profiles").select("full_name,phone").eq("id", auth.userId).maybeSingle(),
    db.from("challenge_participants").select("*").eq("user_id", auth.userId),
    db
      .from("habit_challenges")
      .select("*")
      .eq("published", true)
      .eq("archived", false)
      .order("starts_on"),
    db
      .from("coaching_relationships")
      .select("id,primary_goal,status")
      .eq("member_id", auth.userId)
      .in("status", ["invited", "active", "paused"])
      .maybeSingle(),
    db
      .from("enrollments")
      .select("id,session_id,status,sessions(id,name,starts_on,ends_on,published,status)")
      .eq("member_id", auth.userId),
  ]);
  if (results.some((r) => r.error))
    throw new Error(
      "Your member information could not be loaded. Please try again.",
    );
  const [profile, participants, challenges, training, enrollments] = results;
  const memberships = participants.data as Participant[];
  const available = challenges.data as Challenge[];
  const joined = available.filter((c) =>
    memberships.some((p) => p.challenge_id === c.id),
  );
  const challenge =
    joined.find((c) => c.id === requested) ??
    joined.find((c) => c.starts_on <= today && c.ends_on >= today) ??
    joined.find((c) => c.starts_on > today) ??
    joined.at(-1);
  const participant = memberships.find((p) => p.challenge_id === challenge?.id);
  const classEnrollments = (enrollments.data ?? []).filter(e => ["invited", "active", "completed"].includes(e.status));
  const classPrograms = classEnrollments.flatMap(e => {
    const s = e.sessions as unknown as { id: string; name: string; starts_on: string; ends_on: string; published: boolean; status: string } | null;
    return s?.published && !["draft", "cancelled"].includes(s.status) ? [s] : [];
  }).sort((a, b) => Number(a.ends_on < today) - Number(b.ends_on < today) || a.starts_on.localeCompare(b.starts_on));
  const [classWorkouts, classLogs] = await Promise.all([
    classPrograms.length ? db.from("challenge_workouts").select("*").in("session_id", classPrograms.map(p => p.id))
      .eq("published", true).eq("archived", false).lte("publish_on", today).order("publish_on", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    enrollments.data?.length ? db.from("challenge_workout_logs").select("id,participant_id,enrollment_id,workout_id,status,elapsed_seconds,effort,note,performed_on,completed_at,workout_title,workout_revision")
      .in("enrollment_id", enrollments.data.map(e => e.id)).order("completed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  const [workouts, marks] =
    participant && challenge
      ? await Promise.all([
          db
            .from("challenge_workouts")
            .select("*")
            .eq("challenge_id", challenge.id)
            .eq("published", true)
            .eq("archived", false)
            .lte("publish_on", today)
            .order("publish_on", { ascending: false }),
          db
            .from("challenge_checkmarks")
            .select("*")
            .eq("participant_id", participant.id),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  // History remains available even after Kelsey archives the parent challenge.
  const logs = memberships.length
    ? await db
        .from("challenge_workout_logs")
        .select(
          "id,participant_id,workout_id,status,elapsed_seconds,effort,note,performed_on,completed_at,workout_title,workout_revision",
        )
        .in(
          "participant_id",
          memberships.map((p) => p.id),
        )
        .order("completed_at", { ascending: false })
    : { data: [], error: null };
  if ([workouts, marks, logs, classWorkouts, classLogs].some((r) => r.error))
    throw new Error(
      "Your saved progress could not be loaded. Please try again.",
    );
  const [personalWorkouts, structuredLogs] = training.data ? await Promise.all([
    db.from("challenge_workouts").select("*").eq("relationship_id", training.data.id).eq("published", true).eq("archived", false).lte("publish_on", today).order("publish_on", {ascending: false}),
    db.from("challenge_workout_logs").select("*").eq("relationship_id", training.data.id).order("completed_at", {ascending: false}),
  ]) : [{data: [], error: null}, {data: [], error: null}];
  if (personalWorkouts.error || structuredLogs.error) throw new Error("Your personal workouts could not be loaded.");
  const [personal, personalLogs] = training.data
    ? await Promise.all([
        db
          .from("scheduled_workouts")
          .select(
            "id,title,scheduled_for,focus,recommended_option,workout_options(estimated_minutes,option_code)",
          )
          .eq("relationship_id", training.data.id)
          .eq("status", "scheduled")
          .order("scheduled_for")
          .limit(1)
          .maybeSingle(),
        db
          .from("workout_logs")
          .select(
            "id,completed_at,option_code,personal_win,completion_note,effort,scheduled_workouts(title)",
          )
          .eq("member_id", auth.userId)
          .order("completed_at", { ascending: false }),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
      ];
  if (personal.error || personalLogs.error)
    throw new Error("Your personal training progress could not be loaded.");
  return {
    nextTraining: training.data?.status === "active" && !personalWorkouts.data?.length ? personal.data : null,
    trainingLogs: personalLogs.data || [],
    userId: auth.userId,
    email: auth.email,
    phone: profile.data?.phone || "",
    today,
    firstName:
      profile.data?.full_name?.trim().split(/\s+/)[0] ||
      participant?.display_name.split(" ")[0] ||
      "there",
    challenge,
    participant,
    joined,
    available,
    training: training.data,
    hasClasses: Boolean(classEnrollments.length),
    classPrograms,
    workouts: (requestedProgram
      ? (classWorkouts.data ?? []).filter(w => w.session_id === requestedProgram)
      : requested && joined.some(c => c.id === requested)
        ? workouts.data ?? []
        : [...(personalWorkouts.data ?? []), ...(classWorkouts.data ?? []), ...(workouts.data ?? [])]) as Workout[],
    marks: marks.data as Checkmark[],
    logs: [...(structuredLogs.data ?? []), ...(logs.data ?? []), ...(classLogs.data ?? [])].sort((a, b) => b.completed_at.localeCompare(a.completed_at)) as WorkoutLog[],
  };
});
