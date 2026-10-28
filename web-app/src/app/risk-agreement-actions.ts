"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin, verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email";
import { riskAgreement, validateRiskAgreement, type RiskContext } from "@/lib/risk-agreement";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type RiskSubmitResult = { error?: string; field?: string; redirect?: string };

export async function submitRiskAgreement(form: FormData): Promise<RiskSubmitResult> {
  const auth = await verifySession();
  const context = String(form.get("context") ?? "") as RiskContext;
  const subjectId = String(form.get("subjectId") ?? "");
  if (!["personal_training", "group_class"].includes(context) || !UUID.test(subjectId)) return { error: "This agreement link is not valid." };
  const parsed = validateRiskAgreement(form, context);
  if (parsed.error || !parsed.values || !parsed.acknowledgments) return { error: parsed.error || "Please complete the agreement.", field: parsed.field };
  const db = await createClient();
  const personal = context === "personal_training";
  if (personal) {
    const [{ data: relationship }, { data: intake }] = await Promise.all([
      db.from("coaching_relationships").select("id").eq("id", subjectId).eq("member_id", auth.userId).in("status", ["invited", "active"]).maybeSingle(),
      db.from("personal_training_intakes").select("relationship_id").eq("relationship_id", subjectId).eq("member_id", auth.userId).maybeSingle(),
    ]);
    if (!relationship || !intake) return { error: "Complete your personal training intake before signing this agreement." };
  } else {
    const [{ data: enrollment }, { data: intake }] = await Promise.all([
      db.from("enrollments").select("id").eq("id", subjectId).eq("member_id", auth.userId).eq("risk_agreement_required", true).in("status", ["invited", "active"]).maybeSingle(),
      db.from("member_intakes").select("enrollment_id").eq("enrollment_id", subjectId).eq("member_id", auth.userId).maybeSingle(),
    ]);
    if (!enrollment || !intake) return { error: "Complete your class intake before signing this agreement." };
  }
  const content = riskAgreement(context);
  const { error } = await db.from("risk_agreements").insert({
    member_id: auth.userId,
    context,
    relationship_id: personal ? subjectId : null,
    enrollment_id: personal ? null : subjectId,
    document_version: content.version,
    document_text: content.documentText,
    client_name: parsed.values.clientName,
    phone: parsed.values.phone,
    email: parsed.values.email,
    emergency_contact: parsed.values.emergencyContact,
    emergency_contact_phone: parsed.values.emergencyContactPhone,
    preferred_communication: parsed.values.preferredCommunication,
    acknowledgments: parsed.acknowledgments,
    printed_name: parsed.values.printedName,
    signature: parsed.values.signature,
    signed_on: parsed.values.signedOn,
  });
  const returnPath = personal ? "/portal/training/intake" : `/portal/intake?enrollment=${subjectId}`;
  if (error?.code === "23505") return { redirect: returnPath };
  if (error) return { error: "Your agreement could not be saved. Your answers are still here; please try again." };

  await sendTransactionalEmail("holdenhealth.coaching@gmail.com", `${personal ? "Personal training" : "Class"} agreement signed by ${parsed.values.printedName}`, {
    firstName: "Kelsey", preheader: "A signed agreement is ready in the secure portal.",
    heading: "Agreement signed.",
    body: `${parsed.values.printedName} signed the ${personal ? "personal training" : "group class"} risk agreement. Review it in the secure portal. No private health answers are included in this email.`,
    ctaLabel: "Review agreement", ctaUrl: personal ? `https://portal.holden.health/admin/training/${auth.userId}` : `https://portal.holden.health/admin/members/${subjectId}`,
  }, { idempotencyKey: `risk-agreement-signed-${context}-${subjectId}` }).catch(() => false);
  revalidatePath("/portal", "layout");
  revalidatePath(returnPath.split("?")[0]);
  revalidatePath(personal ? `/admin/training/${auth.userId}` : `/admin/members/${subjectId}`);
  return { redirect: returnPath };
}

export async function countersignRiskAgreement(form: FormData) {
  await verifyAdmin();
  const agreementId = String(form.get("agreementId") ?? "");
  const context = String(form.get("context") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const representativeName = String(form.get("representativeName") ?? "").trim().slice(0, 140);
  const signedOn = String(form.get("representativeSignedOn") ?? "");
  if (!UUID.test(agreementId) || !UUID.test(subjectId) || !["personal_training", "group_class"].includes(context) || representativeName.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(signedOn)) throw new Error("Complete the representative name and date.");
  const db = await createClient();
  const { data: agreement, error: lookupError } = await db.from("risk_agreements").select("id,relationship_id,enrollment_id,representative_signed_at").eq("id", agreementId).maybeSingle();
  if (lookupError || !agreement || agreement.representative_signed_at || (context === "personal_training" ? agreement.relationship_id !== subjectId : agreement.enrollment_id !== subjectId)) throw new Error("The agreement could not be countersigned.");
  const { error } = await db.from("risk_agreements").update({ representative_name: representativeName, representative_signed_on: signedOn, representative_signed_at: new Date().toISOString() }).eq("id", agreementId).is("representative_signed_at", null);
  if (error) throw new Error("The representative signature could not be saved.");
  const destination = context === "personal_training" ? `/admin/training/${String(form.get("memberId") ?? "")}` : `/admin/members/${subjectId}`;
  revalidatePath(destination);
  redirect(`${destination}?message=agreement-countersigned#agreement`);
}
