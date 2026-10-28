"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/auth";
import { isUuid, validDate } from "@/lib/challenge";
import { createClient } from "@/lib/supabase/server";

export async function saveTrainingSessionPlan(formData: FormData): Promise<{ error?: string; redirect?: string }> {
  const admin = await verifyAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const id = String(formData.get("planId") ?? "");
  const sessionDate = String(formData.get("sessionDate") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const plan = String(formData.get("plan") ?? "").trim();
  if (!isUuid(memberId) || !isUuid(relationshipId) || (id && !isUuid(id))) return { error: "Refresh the page and try again." };
  if (!validDate(sessionDate))
    return { error: "Choose a valid session date." };
  if (!title || title.length > 140 || !plan || plan.length > 15000)
    return { error: "Add a title and workout plan. Keep the title under 140 characters and the plan under 15,000." };

  const db = await createClient();
  const { data: relationship, error: relationshipError } = await db.from("coaching_relationships")
    .select("id,status").eq("id", relationshipId).eq("member_id", memberId).maybeSingle();
  if (relationshipError || !relationship || relationship.status === "withdrawn")
    return { error: "This training plan is no longer available to edit." };

  const values = { session_date: sessionDate, title, plan, member_visible: formData.get("memberVisible") === "yes" };
  const result = id
    ? await db.from("personal_training_session_plans").update(values).eq("id", id).eq("relationship_id", relationshipId).select("id").maybeSingle()
    : await db.from("personal_training_session_plans").insert({ ...values, relationship_id: relationshipId, created_by: admin.userId }).select("id").maybeSingle();
  if (result.error || !result.data) return { error: "The session plan did not save. Please try again." };

  revalidatePath(`/admin/training/${memberId}`);
  revalidatePath("/portal/training");
  return { redirect: `/admin/training/${memberId}?message=session-plan-saved#session-plans` };
}
