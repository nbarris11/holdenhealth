"use server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { progressStoryData } from "@/lib/progress-story-data";
import { validStoryId, type StoryState } from "@/lib/progress-story";

export async function saveStoryRecap(_state: StoryState, form: FormData): Promise<StoryState> {
  const auth = await verifyAdmin();
  const memberId = String(form.get("memberId") ?? ""), id = String(form.get("id") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const intent = String(form.get("intent") ?? "draft");
  if (!validStoryId(id) || !validStoryId(memberId) || body.length < 3 || body.length > 3000 || !["draft", "publish"].includes(intent)) return { message: "Choose a member and write a note between 3 and 3,000 characters." };
  const db = await createClient();
  const { data: existing, error: readError } = await db.from("member_story_recaps").select("id,member_id,published_at,period_end,updated_at").eq("id", id).maybeSingle();
  if (readError || (existing && existing.member_id !== memberId)) return { message: "This draft could not be loaded. Please refresh and try again." };
  if (existing?.published_at) return { ok: true, message: "This recap is already published." };
  const d = await progressStoryData(memberId, existing?.period_end);
  const goal = d.goals.at(-1);
  if (intent === "publish" && !goal) return { message: "Ask the member to save their personal goal before publishing a recap." };
  if (intent === "publish" && form.get("confirmed") !== "on") return { message: "Please review the member preview and confirm before publishing." };
  if (intent === "publish" && form.get("evidence") !== JSON.stringify({ goal: goal?.goal || "", summary: d.summary, start: d.start, end: d.end })) return { message: "The member’s goal or activity changed since this preview. Save your draft and reload to review the latest story before publishing." };
  const row = { id, member_id: memberId, author_id: auth.userId, body, goal_snapshot: goal?.goal || "", period_start: d.start, period_end: d.end, summary: d.summary, published_at: intent === "publish" ? new Date().toISOString() : null };
  // Compare the revision seen by the editor; a second open tab cannot overwrite it.
  const result = existing
    ? await db.from("member_story_recaps").update(row).eq("id", id).eq("member_id", memberId).is("published_at", null).eq("updated_at", String(form.get("version") ?? "")).select("id")
    : await db.from("member_story_recaps").insert(row).select("id");
  if (result.error || !result.data?.length) return { message: "This draft changed or could not be saved. Keep your text, refresh this page, and try again." };
  revalidatePath("/admin/stories", "layout");
  revalidatePath("/portal", "layout");
  return { ok: true, message: intent === "publish" ? "Published to this member’s progress story." : "Draft saved. Only you can see it." };
}
