"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePersonalTrainingIntake } from "@/lib/personal-training-intake";
import { sendTransactionalEmail } from "@/lib/email";

export type TrainingIntakeResult = { error?: string; redirect?: string };

export async function submitTrainingIntake(form: FormData): Promise<TrainingIntakeResult> {
  const session = await verifySession();
  const db = await createClient();
  const { data: relationship, error: relationshipError } = await db.from("coaching_relationships")
    .select("id,member_id,status").eq("member_id", session.userId).in("status", ["invited", "active"]).maybeSingle();
  if (relationshipError || !relationship) return { error: "Your personal training record could not be found. Contact Kelsey for help." };
  const parsed = parsePersonalTrainingIntake(form);
  if (parsed.error) return { error: parsed.error.message };
  const { error } = await db.from("personal_training_intakes").insert({
    relationship_id: relationship.id, member_id: session.userId,
    responses: parsed.responses,
    health_review_required: parsed.healthReviewRequired,
    acknowledgment_version: "2026-09-28-personal-training-client-intake-v2",
    signed_name: parsed.signedName,
    signed_at: new Date().toISOString(),
  });
  if (error?.code === "23505") return { redirect: "/portal/training/intake" };
  if (error) return { error: "Your intake could not be saved. Please try again." };

  // Email contains no health answers.
  await sendTransactionalEmail("holdenhealth.coaching@gmail.com", `Personal training intake from ${parsed.signedName}`, {
    firstName: "Kelsey", preheader: "A private intake is ready for review.",
    heading: "Personal training intake received.",
    body: `${parsed.signedName} completed the private personal training intake. ${parsed.healthReviewRequired ? "A health follow-up is flagged." : "No health follow-up was flagged."} Review the answers in the secure coaching workspace.`,
    ctaLabel: "Review intake", ctaUrl: `https://portal.holden.health/admin/training/${session.userId}`,
  }, { idempotencyKey: `personal-training-intake-${relationship.id}` }).catch(() => false);
  revalidatePath("/portal", "layout");
  revalidatePath("/portal/training");
  revalidatePath(`/admin/training/${session.userId}`);
  return { redirect: "/portal/training/intake" };
}
