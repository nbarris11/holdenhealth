"use server";
import { challengePageContentKey, parseChallengePageCopy } from "@/lib/challenge-page-copy";
import { validTimer, type TimerConfig } from "@/lib/workout-timer";
import { validSteps } from "@/lib/workout-app";
import { workoutScope } from "@/lib/workout-program";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  challengeDays,
  isUuid,
  validDate,
  safeHttps,
  type FormResult,
  type GoalOption,
} from "@/lib/challenge";
const field = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();
export async function saveChallenge(
  _: FormResult,
  data: FormData,
): Promise<FormResult> {
  await verifyAdmin();
  const db = await createClient();
  const id = field(data, "id");
  const title = field(data, "title");
  const start = field(data, "starts_on");
  const welcome = field(data, "welcome");
  const community = field(data, "community_url");
  if (id && !isUuid(id)) return { error: "Invalid challenge." };
  if (
    !title ||
    title.length > 120 ||
    !validDate(start) ||
    welcome.length > 10000
  )
    return {
      error:
        "Enter a title, valid start date, and welcome message under 10,000 characters.",
    };
  if (
    community &&
    !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9/?=&_-]+$/.test(community)
  )
    return {
      error:
        "Use the full WhatsApp group invite link, starting with https://chat.whatsapp.com/.",
    };
  const options: GoalOption[] = field(data, "goal_options")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [category, ...label] = line.split("|");
      return { category: category.trim(), label: label.join("|").trim() };
    });
  if (
    options.length < 3 ||
    options.length > 100 ||
    options.some(
      (g) =>
        !g.category ||
        g.category.length > 80 ||
        !g.label ||
        g.label.length > 140,
    ) ||
    new Set(options.map((g) => g.label.toLowerCase())).size !== options.length
  )
    return {
      error:
        "Add at least three different goals, one per line: Category | Habit. Keep habits under 140 characters.",
    };
  // Preserve existing schedules when saving copy; new challenges run for 14 days.
  let duration = 14;
  if (id) {
    const { data: existing, error } = await db.from("habit_challenges")
      .select("starts_on,ends_on").eq("id", id).single();
    if (error || !existing) return { error: "Challenge could not be loaded. Please try again." };
    duration = challengeDays(existing);
  }
  const payload = {
    archived: false,
    title,
    starts_on: start,
    ends_on: addDays(start, duration - 1),
    welcome,
    community_url: community,
    goal_options: options,
    published: data.has("published"),
    signup_open: data.has("signup_open"),
  };
  const result = id
    ? await db
        .from("habit_challenges")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single()
    : await db.from("habit_challenges").insert(payload).select("id").single();
  if (result.error)
    return {
      error: result.error.message.includes("Dates cannot change")
        ? "Dates are locked because people have joined. Create a new challenge instead."
        : "Changes did not save. Please try again.",
    };
  revalidatePath("/admin/challenges");
  revalidatePath("/admin/training", "layout");
  revalidatePath("/challenge");
  revalidatePath("/portal", "layout");
  if (!id) redirect(`/admin/challenges?id=${result.data.id}`);
  return { success: "Challenge settings saved." };
}
export async function saveWorkout(
  _: FormResult,
  data: FormData,
): Promise<FormResult> {
  await verifyAdmin();
  const db = await createClient();
  const id = field(data, "id");
  const challengeId = field(data, "challenge_id");
  const sessionId = field(data, "session_id");
  const relationshipId = field(data, "relationship_id");
  const scope = workoutScope(challengeId, sessionId, relationshipId);
  const title = field(data, "title");
  const minutes = Number(data.get("minutes"));
  const date = field(data, "publish_on");
  const plan = field(data, "plan");
  const equipment = field(data, "equipment");
  if (
    (id && !isUuid(id)) ||
    !scope ||
    !title ||
    title.length > 120 ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 180 ||
    !validDate(date) ||
    !plan ||
    plan.length > 20000 ||
    equipment.length > 200
  )
    return {
      error:
        "Check the title, duration (1–180 minutes), date, equipment, and written plan.",
    };
  const { data: challenge } = await db
    .from(scope.table)
    .select(relationshipId ? "starts_on,status" : "starts_on,ends_on")
    .eq("id", scope.id)
    .maybeSingle();
  const dates = challenge as unknown as { starts_on: string; ends_on?: string; status?: string } | null;
  if (relationshipId && dates?.status === "withdrawn")
    return { error: "This client has withdrawn from personal training." };
  if (!dates || date < dates.starts_on || (dates.ends_on && date > dates.ends_on))
    return { error: "Choose a release date within the program." };
  const exercises = field(data, "exercises")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [label, ...url] = line.split("|");
      return { label: label.trim(), url: url.join("|").trim() };
    });
  if (
    exercises.length > 50 ||
    exercises.some(
      (e) =>
        !e.label ||
        e.label.length > 140 ||
        e.url.length > 2000 ||
        !safeHttps(e.url),
    )
  )
    return {
      error:
        "Use one demonstration per line: Exercise name | https://link. Up to 50 links.",
    };
  let timerConfig: TimerConfig | null = null;
  const timerInput = field(data, "timer_config");
  if (timerInput) {
    try {
      const parsed: unknown = JSON.parse(timerInput);
      if (!validTimer(parsed))
        return {
          error:
            "Check the timer settings. Use whole numbers and a total time under three hours.",
        };
      timerConfig = parsed;
    } catch {
      return {
        error: "Invalid timer settings. Please review the timer fields.",
      };
    }
  }
  let steps: unknown;
  try {
    steps = JSON.parse(field(data, "steps") || "[]");
  } catch {
    return { error: "Please check the workout steps." };
  }
  const level = field(data, "level") || "All levels";
  const focus = field(data, "focus") || "Full body";
  if (
    !validSteps(steps) ||
    !["Beginner", "All levels", "Intermediate"].includes(level) ||
    focus.length > 80
  )
    return {
      error:
        "Check the steps, level, and focus. Demonstration links must start with https://.",
    };
  const payload = {
    steps,
    level,
    focus,
    archived: false,
    timer_config: timerConfig,
    challenge_id: challengeId || null,
    session_id: sessionId || null,
    relationship_id: relationshipId || null,
    title,
    minutes,
    equipment,
    plan,
    exercises,
    publish_on: date,
    published: data.has("published"),
  };
  const result = id
    ? await db
        .from("challenge_workouts")
        .update(payload)
        .eq("id", id)
        .eq(scope.column, scope.id)
        .select("id")
        .single()
    : await db.from("challenge_workouts").insert(payload).select("id").single();
  if (result.error)
    return { error: "The workout did not save. Please try again." };
  revalidatePath("/admin/programs/[programId]/workouts", "page");
  revalidatePath("/admin/challenges");
  revalidatePath("/admin/training", "layout");
  revalidatePath("/challenge");
  revalidatePath("/portal", "layout");
  if (relationshipId && !id) redirect(`/admin/training/workouts/${relationshipId}?saved=${result.data.id}#workout-${result.data.id}`);
  if (sessionId && !id) redirect(`/admin/programs/${sessionId}/workouts?saved=${result.data.id}#workout-${result.data.id}`);
  return { success: "Workout saved." };
}

export async function setArchived(
  _: FormResult,
  data: FormData,
): Promise<FormResult> {
  await verifyAdmin();
  const id = field(data, "id"),
    kind = field(data, "kind"),
    archived = field(data, "archived") === "true";
  if (!isUuid(id) || !["challenge", "workout"].includes(kind))
    return { error: "Invalid item." };
  const db = await createClient();
  const { error } = await db
    .from(kind === "challenge" ? "habit_challenges" : "challenge_workouts")
    .update({
      archived,
      published: false,
      ...(kind === "challenge" ? { signup_open: false } : {}),
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: "That change did not save. Please try again." };
  revalidatePath("/admin/programs/[programId]/workouts", "page");
  revalidatePath("/admin/challenges");
  revalidatePath("/admin/training", "layout");
  revalidatePath("/challenge");
  revalidatePath("/portal", "layout");
  return {
    success: archived
      ? "Archived. Hidden from members; saved history is kept."
      : "Restored as a draft. Review and publish when ready.",
  };
}

export async function saveChallengePageCopy(_: FormResult, data: FormData): Promise<FormResult> {
  const admin = await verifyAdmin();
  const parsed = parseChallengePageCopy(data);
  if (parsed.error) return { error: parsed.error };
  const db = await createClient();
  const { data: saved, error } = await db.from("site_content").upsert({
    content_key: challengePageContentKey,
    value: parsed.value,
    published: true,
    published_at: new Date().toISOString(),
    updated_by: admin.userId,
  }, { onConflict: "content_key" }).select("content_key").single();
  if (error || !saved) return { error: "Page wording did not save. Your edits are still here; please try again." };
  revalidatePath("/challenge");
  revalidatePath("/admin/challenges");
  revalidatePath("/admin/training", "layout");
  return { success: "Page wording saved and published. Refresh the challenge page to see your changes." };
}
