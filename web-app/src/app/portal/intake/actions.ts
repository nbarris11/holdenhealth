"use server";

import { revalidatePath } from "next/cache";
import { intakeConditionalError, type IntakeResult } from "@/lib/intake-validation";
import { sendTransactionalEmail } from "@/lib/email";
import { captureServerEvent, captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACKNOWLEDGMENT_VERSION = "2026-08-21-v1";

const GOALS = new Set(["Get stronger", "Improve my fitness", "Lose body fat / change my body composition", "Improve my energy", "Improve my confidence", "Build healthier habits", "Get back into a consistent routine", "Improve mobility / movement", "Improve athletic performance", "Meet people and build community", "Other"]);
const NUTRITION_SUPPORT = new Set(["Meal planning", "Portion awareness", "Protein / balanced meals", "Snacking", "Eating out", "Hydration", "Consistency", "Nothing right now", "Other"]);
const COACHING_SUPPORT = new Set(["Accountability", "Motivation", "Exercise guidance", "Nutrition guidance", "Help creating healthy habits", "Someone to keep me on track", "Community / encouragement", "A combination of these"]);
const COMMITMENTS = new Set(["Attending my scheduled classes", "Moving outside of class", "Making small nutrition changes", "Prioritizing sleep/recovery", "Checking in with my coach", "Being patient with the process", "Supporting and encouraging other members"]);
const COMMUNICATION = new Set(["Text", "Email", "Phone"]);
const EXERCISE_CONSISTENCY = new Set(["Not currently exercising", "1 day/week", "2 days/week", "3–4 days/week", "5+ days/week"]);
const SLEEP = new Set(["Less than 5", "5–6", "7–8", "9+"]);

function text(formData: FormData, name: string, maxLength = 3000) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function requiredText(formData: FormData, name: string, maxLength = 3000) {
  const value = text(formData, name, maxLength);
  if (!value) intakeError("required", name);
  return value;
}

function selected(formData: FormData, name: string, allowed: Set<string>) {
  return formData.getAll(name).map(String).filter((value) => allowed.has(value));
}

function choice(formData: FormData, name: string, allowed: Set<string>) {
  const value = text(formData, name, 80);
  if (!allowed.has(value)) intakeError("required", name);
  return value;
}

function rating(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < 1 || value > 10) intakeError("required", name);
  return value;
}

function yesNo(formData: FormData, name: string) {
  const value = text(formData, name, 3);
  if (value !== "yes" && value !== "no") intakeError("required");
  return value === "yes";
}

class IntakeValidationError extends Error {
  constructor(public code: string, public field?: string) { super(code); }
}
function intakeError(code: string, field?: string): never { throw new IntakeValidationError(code, field); }
const messages: Record<string, string> = {
  required: "Please complete this required answer.", enrollment: "This enrollment is not available. Contact Kelsey if you need help.",
  acknowledgment: "Please accept the health and exercise acknowledgment.", "health-detail": "Please explain each health question answered Yes.",
  age: "Enter an age between 18 and 120.", save: "We could not save your intake. Please try again.",
};

export async function submitMemberIntake(formData: FormData): Promise<IntakeResult> {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return { error: "Your sign-in expired. Sign in in another tab, then return here and retry." };
  const auth = { userId: claims.claims.sub, email: typeof claims.claims.email === "string" ? claims.claims.email : "" };
  try {
  const conditionalError = intakeConditionalError(formData);
  if (conditionalError) return conditionalError;
  const enrollmentId = text(formData, "enrollmentId", 40);
  if (!UUID_PATTERN.test(enrollmentId)) intakeError("enrollment");
  if (formData.get("acknowledgmentAccepted") !== "on") intakeError("acknowledgment");

  const { data: enrollment } = await supabase.from("enrollments")
    .select("id,member_id,status")
    .eq("id", enrollmentId)
    .eq("member_id", auth.userId)
    .in("status", ["invited", "active"])
    .maybeSingle();
  if (!enrollment) intakeError("enrollment");

  const injury = yesNo(formData, "injury");
  const medications = yesNo(formData, "medications");
  const precautions = yesNo(formData, "precautions");
  const injuryDetail = text(formData, "injuryDetail");
  const medicationDetail = text(formData, "medicationDetail");
  const precautionDetail = text(formData, "precautionDetail");
  if ((injury && !injuryDetail) || (medications && !medicationDetail) || (precautions && !precautionDetail)) intakeError("health-detail");

  const age = Number(formData.get("age"));
  if (!Number.isInteger(age) || age < 18 || age > 120) intakeError("age", "age");
  const goals = selected(formData, "goals", GOALS);
  const nutritionSupport = selected(formData, "nutritionSupport", NUTRITION_SUPPORT);
  const coachingSupport = selected(formData, "coachingSupport", COACHING_SUPPORT);
  const commitments = selected(formData, "commitments", COMMITMENTS);
  if (!goals.length || !nutritionSupport.length || !coachingSupport.length || !commitments.length) intakeError("required");

  const responses = {
    about: {
      preferredCommunication: choice(formData, "preferredCommunication", COMMUNICATION),
      contactPhone: text(formData, "contactPhone", 40),
      age,
      emergencyContact: requiredText(formData, "emergencyContact", 240),
    },
    goals: {
      selected: goals,
      other: goals.includes("Other") ? requiredText(formData, "goalOther", 500) : text(formData, "goalOther", 500),
      primaryGoal: requiredText(formData, "primaryGoal"),
      sixWeekSuccess: requiredText(formData, "sixWeekSuccess"),
    },
    startingPoint: {
      fitnessRating: rating(formData, "fitnessRating"),
      exerciseConsistency: choice(formData, "exerciseConsistency", EXERCISE_CONSISTENCY),
      currentExercise: requiredText(formData, "currentExercise"),
      consistencyBarriers: requiredText(formData, "consistencyBarriers"),
    },
    nutritionLifestyle: {
      eatingRating: rating(formData, "eatingRating"),
      support: nutritionSupport,
      other: nutritionSupport.includes("Other") ? requiredText(formData, "nutritionOther", 500) : text(formData, "nutritionOther", 500),
      sleep: choice(formData, "sleep", SLEEP),
      stressRating: rating(formData, "stressRating"),
      easierSelfCare: requiredText(formData, "easierSelfCare"),
    },
    healthSafety: {
      injury,
      injuryDetail,
      medications,
      medicationDetail,
      precautions,
      precautionDetail,
    },
    coachingExperience: {
      support: coachingSupport,
      coachNeeds: requiredText(formData, "coachNeeds"),
      dontWant: requiredText(formData, "dontWant"),
    },
    commitment: {
      readiness: rating(formData, "readiness"),
      selected: commitments,
      anythingElse: text(formData, "anythingElse"),
    },
  };

  const signedName = requiredText(formData, "signedName", 140);
  const healthReviewRequired = injury || medications || precautions;
  const { error } = await supabase.from("member_intakes").insert({
    enrollment_id: enrollment.id,
    member_id: auth.userId,
    responses,
    health_review_required: healthReviewRequired,
    acknowledgment_version: ACKNOWLEDGMENT_VERSION,
    signed_name: signedName,
    signed_at: new Date().toISOString(),
  });
  if (error?.code === "23505") return { redirect: `/portal/intake?enrollment=${enrollment.id}` };
  if (error) intakeError("save");

  await Promise.all([
    sendTransactionalEmail(
      "holdenhealth.coaching@gmail.com",
      `New member intake from ${signedName}`,
      {
        firstName: "Kelsey",
        preheader: `${signedName}'s secure intake is ready for review.`,
        heading: "A new member intake is ready.",
        body: `${signedName} completed the confidential Holden Health intake.\n\n${healthReviewRequired ? "A health follow-up is required before activation." : "No health follow-up was flagged."}\n\nFor privacy, no health answers are included in this email. Review everything inside the secure admin portal.`,
        ctaLabel: "Review the secure intake",
        ctaUrl: `https://portal.holden.health/admin/members/${enrollment.id}`,
      },
      { idempotencyKey: `intake-submitted-admin-${enrollment.id}` },
    ),
    auth.email
      ? sendTransactionalEmail(
        auth.email,
        "We received your Holden Health intake",
        {
          firstName: signedName.trim().split(/\s+/)[0] || "there",
          preheader: "Thank you for completing your confidential member intake.",
          heading: "Thank you. Your intake is in.",
          body: "Kelsey received your confidential intake and will review it before your enrollment is fully activated.\n\nYou do not need to send anything else right now. If Kelsey needs clarification, she will reach out privately. We will email you again when the review is complete.",
          ctaLabel: "Return to my portal",
          ctaUrl: "https://portal.holden.health/portal",
        },
        { idempotencyKey: `intake-submitted-member-${enrollment.id}` },
      )
      : Promise.resolve(false),
  ]);
  await captureServerEvent(auth.userId, "member_intake_submitted", {
    acknowledgment_version: ACKNOWLEDGMENT_VERSION,
  });
  revalidatePath("/portal", "layout");
  revalidatePath(`/admin/members/${enrollment.id}`);
  return { redirect: `/portal/intake?enrollment=${enrollment.id}` };
  } catch (error) {
    if (error instanceof IntakeValidationError) return { error: messages[error.code] || messages.save, field: error.field };
    await captureServerException(error, auth.userId);
    return { error: "We couldn’t confirm the save. Retry to check whether your intake was received." };
  }
}
