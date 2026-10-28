"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, validDate, type FormResult } from "@/lib/challenge";
import { cleanCommentBody } from "@/lib/habit-comments";

// Who may comment (coach) or reply (member) is enforced by RLS on habit_comments.
export async function addHabitComment(form: FormData): Promise<FormResult> {
  await verifySession();
  const weekId = String(form.get("weekId") ?? "");
  const day = String(form.get("day") ?? "");
  const habitIndex = Number(form.get("habitIndex"));
  const body = cleanCommentBody(form.get("body"));
  const habitText = String(form.get("habitText") ?? "").slice(0, 100);
  if (!body) return { error: "Write a comment up to 1,000 characters." };
  if (!isUuid(weekId) || !validDate(day) || !Number.isInteger(habitIndex) || habitIndex < 0 || habitIndex > 5)
    return { error: "That habit could not be found. Reload and try again." };
  const { error } = await (await createClient()).from("habit_comments").insert({ week_id: weekId, day, habit_index: habitIndex, habit_text: habitText, body });
  if (error) return { error: "Your comment could not be saved. Please try again." };
  for (const path of ["/portal/habits", "/portal/training/habits", "/admin/training"]) revalidatePath(path, "layout");
  return { success: "Comment saved." };
}

export async function markHabitCommentsRead(weekId: string) {
  await verifySession();
  if (!isUuid(weekId)) return;
  await (await createClient()).rpc("mark_habit_comments_read", { p_week_id: weekId });
}
