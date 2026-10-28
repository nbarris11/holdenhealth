"use server";
import {queueCoachActivityDelivery} from "@/lib/coach-activity";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { detroitToday, isUuid, validDate } from "@/lib/challenge";
import { cleanHabits, weekDates } from "@/lib/class-habits";

async function memberEnrollment(enrollmentId: string, relationshipId = "") {
  const auth = await verifySession();
  if ((await cookies()).has("holden_admin_enrollment_preview") || (relationshipId ? !isUuid(relationshipId) : !isUuid(enrollmentId))) return null;
  const db = await createClient();
  if (relationshipId) {
    const {data, error} = await db.from("coaching_relationships").select("id,status,starts_on").eq("id", relationshipId).eq("member_id", auth.userId).eq("status", "active").maybeSingle();
    if (error || !data) return null;
    return {db, enrollment: data, session: {starts_on: data.starts_on, ends_on: "9999-12-31"}};
  }
  const { data, error } = await db.from("enrollments")
    .select("id,status,sessions(starts_on,ends_on)")
    .eq("id", enrollmentId).eq("member_id", auth.userId).in("status", ["invited", "active", "completed"]).maybeSingle();
  if (error || !data?.sessions) return null;
  return { db, enrollment: data, session: data.sessions as unknown as { starts_on: string; ends_on: string } };
}

export async function saveHabitWeek(form: FormData) {
  const enrollmentId = String(form.get("enrollmentId") ?? "");
  const relationshipId = String(form.get("relationshipId") ?? "");
  const weekId = String(form.get("weekId") ?? "");
  const version = Number(form.get("version"));
  const weekNumber = Number(form.get("weekNumber"));
  const habits = cleanHabits(form.getAll("habit"));
  const context = await memberEnrollment(enrollmentId, relationshipId);
  if (!context || !habits || (relationshipId && habits.length !== 3) || (!relationshipId && weekNumber > 6)) return { error: "Choose 3 to 6 different habits, each under 100 characters." };
  const dates = weekDates(context.session.starts_on, context.session.ends_on, weekNumber);
  const today = detroitToday();
  if (!dates || today > context.session.ends_on || (weekNumber > 1 && today < dates.start))
    return { error: "That week is not open yet." };
  if (weekId && (!isUuid(weekId) || !Number.isInteger(version) || version < 1 || today > dates.end)) return {error: "Only the current week can be edited. Reload and try again."};
  const owner = relationshipId ? {relationship_id: relationshipId} : {enrollment_id: enrollmentId};
  const result = weekId
    ? await context.db.from("class_habit_weeks").update({habits}).eq("id", weekId).eq("version", version).eq("week_number", weekNumber).match(owner).select("id").maybeSingle()
    : await context.db.from("class_habit_weeks").insert({...owner, week_number: weekNumber, habits}).select("id").single();
  const {error} = result;
  if (!error && !result.data) return {error: "These habits changed in another window. Reload before editing."};
  if (error) return { error: error.code === "23505" ? "This week is already set up. Reload to see it." : "Your habits did not save. Please try again." };
  queueCoachActivityDelivery();
  revalidatePath("/portal/habits");
  revalidatePath("/portal/today");
  return { success: "Your habits are ready for this week." };
}

export async function setHabitMark(input: { weekId: string; day: string; habitIndex: number; checked: boolean; version?: number }) {
  if (!isUuid(input.weekId) || !validDate(input.day) || !Number.isInteger(input.habitIndex) || typeof input.checked !== "boolean")
    return { error: "That habit could not be found." };
  await verifySession();
  if ((await cookies()).has("holden_admin_enrollment_preview")) return { error: "Exit member preview before saving." };
  const db = await createClient();
  const {data: week, error} = await db.from("class_habit_weeks").select("id,version,habits,enrollment_id,relationship_id,week_number").eq("id", input.weekId).maybeSingle();
  if (error || !week) return {error: "That habit week could not be found."};
  const context = await memberEnrollment(week.enrollment_id || "", week.relationship_id || "");
  const dates = context && weekDates(context.session.starts_on, context.session.ends_on, week.week_number);
  if (!context || context.enrollment.status !== "active" || !dates || input.day < dates.start || input.day > dates.end || input.day > detroitToday() || input.habitIndex < 0 || input.habitIndex >= week.habits.length) return {error: "Choose an eligible day in your active program."};
  const result = await db.rpc("set_weekly_habit_mark", {p_week_id: week.id, p_version: input.version ?? 1, p_day: input.day, p_index: input.habitIndex, p_checked: input.checked});
  if (result.error) return { error: "That checkmark did not save. Please try again." };
  queueCoachActivityDelivery();
  revalidatePath("/portal/habits");
  revalidatePath("/portal/today");
  return { success: "Progress saved." };
}
