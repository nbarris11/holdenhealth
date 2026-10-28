"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth";
import { captureServerEvent } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import { STORY_COOKIE, validStoryId, type StoryState } from "@/lib/progress-story";

async function saveEntry(table: "member_story_goals" | "member_story_wins", field: "goal" | "body", max: number, form: FormData): Promise<StoryState> {
  const auth = await verifySession();
  if ((await cookies()).has("holden_admin_enrollment_preview")) return { message: "Exit member preview before saving a personal story." };
  const value = String(form.get(field) ?? "").trim();
  const id = String(form.get("id") ?? "");
  if (!validStoryId(id) || value.length < 3 || value.length > max) return { message: `Please write between 3 and ${max} characters.` };
  const db = await createClient();
  // The form's stable ID makes a retried submission harmless.
  const { error } = await db.from(table).upsert({ id, member_id: auth.userId, [field]: value }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { message: "That didn’t save. Your words are still here; please try again." };
  await captureServerEvent(auth.userId, "story_entry_saved", {
    character_count: value.length,
    entry_type: field === "goal" ? "goal" : "win",
  });
  if (field === "goal") (await cookies()).delete(STORY_COOKIE);
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/stories", "layout");
  return { ok: true, message: field === "goal" ? "Your goal is saved. This is what you’re working toward." : "Your win is saved in your story." };
}
export async function saveStoryGoal(_state: StoryState, form: FormData) { return saveEntry("member_story_goals", "goal", 600, form); }
export async function saveStoryWin(_state: StoryState, form: FormData) { return saveEntry("member_story_wins", "body", 1200, form); }
export async function removeStoryWin(_state: StoryState, form: FormData): Promise<StoryState> {
  const auth = await verifySession();
  if ((await cookies()).has("holden_admin_enrollment_preview")) return { message: "Exit preview before making changes." };
  const id = String(form.get("id") ?? "");
  if (!validStoryId(id)) return { message: "This win could not be found." };
  const db = await createClient();
  const { error } = await db.from("member_story_wins").delete().eq("id", id).eq("member_id", auth.userId);
  if (error) return { message: "That didn’t save. Please try again." };
  revalidatePath("/portal", "layout");
  revalidatePath("/admin/stories", "layout");
  return { ok: true, message: "Win removed." };
}
