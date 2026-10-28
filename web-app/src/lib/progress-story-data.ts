import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { verifyAdmin, verifySession } from "./auth";
import { createClient } from "./supabase/server";
import { shiftStoryDay, storyDay, storyMemberName, summarizeStory, validStoryId, type StoryActivity, type StoryGoal, type StoryWin, type StoryRecap } from "./progress-story";

// Paginate source activity so a busy group member never gets a silently capped total.
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error("Your progress story could not be loaded. Please try again.");
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

export const progressStoryData = cache(async (requestedMember?: string, periodEnd?: string) => {
  const auth = await verifySession();
  const memberId = requestedMember || auth.userId;
  if (!validStoryId(memberId)) notFound();
  if (memberId !== auth.userId) await verifyAdmin();
  const db = await createClient();
  const today = storyDay();
  const end = periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) && periodEnd <= today ? periodEnd : today;
  const start = shiftStoryDay(end, -41);
  const [profile, goals, wins, recaps, participants, enrollments, training, intake] = await Promise.all([
    db.from("profiles").select("id,full_name").eq("id", memberId).maybeSingle(),
    db.from("member_story_goals").select("id,goal,created_at").eq("member_id", memberId).order("created_at", { ascending: true }),
    db.from("member_story_wins").select("id,body,created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(50),
    db.from("member_story_recaps").select("id,member_id,body,goal_snapshot,period_start,period_end,summary,published_at,created_at,updated_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(30),
    db.from("challenge_participants").select("id,display_name,joined_on").eq("user_id", memberId).order("joined_on", { ascending: false }),
    db.from("enrollments").select("id").eq("member_id", memberId),
    db.from("coaching_relationships").select("id,primary_goal").eq("member_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("member_intakes").select("goals:responses->goals").eq("member_id", memberId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if ([profile, goals, wins, recaps, participants, enrollments, training, intake].some(r => r.error)) throw new Error("Your progress story could not be loaded. Please try again.");
  if (!profile.data) notFound();
  const participantIds = (participants.data ?? []).map(p => p.id);
  const enrollmentIds = (enrollments.data ?? []).map(e => e.id);
  const [challengeLogs, personalLogs, marks, attendance, checkIns, classWorkoutLogs, structuredPersonalLogs] = await Promise.all([
    participantIds.length ? allRows((from, to) => db.from("challenge_workout_logs").select("id,status,performed_on,workout_title").in("participant_id", participantIds).gte("performed_on", start).lte("performed_on", end).order("id").range(from, to)) : [],
    allRows((from, to) => db.from("workout_logs").select("id,personal_win,completed_at").eq("member_id", memberId).gte("completed_at", `${start}T00:00:00Z`).lt("completed_at", `${shiftStoryDay(end, 1)}T12:00:00Z`).order("id").range(from, to)),
    participantIds.length ? allRows((from, to) => db.from("challenge_checkmarks").select("participant_id,day,goal_index").in("participant_id", participantIds).eq("completed", true).gte("day", start).lte("day", end).order("participant_id").order("day").order("goal_index").range(from, to)) : [],
    enrollmentIds.length ? allRows((from, to) => db.from("attendance_selections").select("id,meeting_id,class_meetings!inner(starts_at,title)").in("enrollment_id", enrollmentIds).eq("attended", true).gte("class_meetings.starts_at", `${start}T00:00:00Z`).lt("class_meetings.starts_at", `${shiftStoryDay(end, 1)}T12:00:00Z`).order("id").range(from, to)) : [],
    enrollmentIds.length ? allRows((from, to) => db.from("check_ins").select("id,went_well,submitted_at").in("enrollment_id", enrollmentIds).gte("submitted_at", `${start}T00:00:00Z`).lt("submitted_at", `${shiftStoryDay(end, 1)}T12:00:00Z`).order("id").range(from, to)) : [],
    enrollmentIds.length ? allRows((from, to) => db.from("challenge_workout_logs").select("id,status,performed_on,workout_title").in("enrollment_id", enrollmentIds).gte("performed_on", start).lte("performed_on", end).order("id").range(from, to)) : [],
    training.data ? allRows((from,to)=>db.from("challenge_workout_logs").select("id,status,performed_on,workout_title").eq("relationship_id",training.data!.id).gte("performed_on",start).lte("performed_on",end).order("id").range(from,to)) : [],
  ]);
  const activities: StoryActivity[] = [
    ...structuredPersonalLogs.map(l => ({id: `pt-workout-${l.id}`, day:l.performed_on, kind:l.status === "completed" ? "workout" as const : "partial" as const, label:l.workout_title})),
    ...challengeLogs.map(l => ({ id: `challenge-${l.id}`, day: l.performed_on, kind: l.status === "completed" ? "workout" as const : "partial" as const, label: l.workout_title })),
    ...classWorkoutLogs.map(l => ({ id: `class-workout-${l.id}`, day: l.performed_on, kind: l.status === "completed" ? "workout" as const : "partial" as const, label: l.workout_title })),
    ...personalLogs.map(l => ({ id: `personal-${l.id}`, day: storyDay(l.completed_at), kind: "workout" as const, label: "Personal training workout" })),
    ...marks.map(m => ({ id: `habit-${m.participant_id}-${m.day}-${m.goal_index}`, day: m.day, kind: "habit" as const, label: "Made time for a habit" })),
    ...attendance.map(a => {
      const meeting = a.class_meetings as unknown as { starts_at: string; title: string };
      return { id: `class-${a.meeting_id}`, day: storyDay(meeting.starts_at), kind: "class" as const, label: meeting.title };
    }),
  ].filter(a => a.day >= start && a.day <= end);
  const reflections = [
    ...(wins.data as StoryWin[] ?? []).map(w => ({ id: w.id, body: w.body, day: storyDay(w.created_at), source: "Personal win", removable: true })),
    ...personalLogs.filter(l => l.personal_win?.trim()).map(l => ({ id: `personal-${l.id}`, body: l.personal_win, day: storyDay(l.completed_at), source: "Workout reflection", removable: false })),
    ...checkIns.filter(c => c.went_well?.trim()).map(c => ({ id: `checkin-${c.id}`, body: c.went_well, day: storyDay(c.submitted_at), source: "Weekly check-in", removable: false })),
  ].filter(w => w.day >= start && w.day <= end).sort((a, b) => b.day.localeCompare(a.day));
  const intakeGoals = intake.data?.goals as { primaryGoal?: string; sixWeekSuccess?: string } | null;
  return {
    memberId, name: storyMemberName(profile.data.full_name, participants.data?.[0]?.display_name), start, end,
    goals: (goals.data ?? []) as StoryGoal[],
    wins: (wins.data ?? []) as StoryWin[],
    recaps: (recaps.data ?? []) as StoryRecap[],
    suggestion: (intakeGoals?.sixWeekSuccess || intakeGoals?.primaryGoal || training.data?.primary_goal || "").slice(0, 600),
    activities: activities.sort((a, b) => b.day.localeCompare(a.day)), reflections,
    summary: summarizeStory(activities, start, end),
  };
});
