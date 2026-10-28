"use server";
import {queueCoachActivityDelivery} from "@/lib/coach-activity";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin, verifySession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { prepareMemberPortalLink, sendTransactionalEmail } from "@/lib/email";
import { detroitToday } from "@/lib/challenge";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_CODES = new Set(["A", "B", "C"]);

function textField(formData: FormData, name: string, maxLength = 3000) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function requiredText(formData: FormData, name: string, maxLength = 3000) {
  const value = textField(formData, name, maxLength);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function uuidField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!UUID_PATTERN.test(value)) throw new Error("Invalid record reference.");
  return value;
}

function boundedInteger(formData: FormData, name: string, min: number, max: number) {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`);
  return value;
}

function dateField(formData: FormData, name: string) {
  const value = requiredText(formData, name, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())) {
    throw new Error("Choose a valid date.");
  }
  return value;
}

function revalidateTraining(memberId?: string) {
  revalidatePath("/portal", "layout");
  revalidatePath("/portal/training");
  revalidatePath("/admin");
  revalidatePath("/admin/people");
  if (memberId) revalidatePath(`/admin/training/${memberId}`);
}

export async function withdrawPersonalTraining(formData: FormData): Promise<{ error?: string; success?: string }> {
  await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const relationshipId = uuidField(formData, "relationshipId");
  if (formData.get("confirmWithdrawal") !== "yes") return { error: "Confirm the withdrawal before continuing." };
  const db = await createClient();
  const { error } = await db.rpc("withdraw_personal_training", { p_member_id: memberId, p_relationship_id: relationshipId });
  if (error) return { error: "Personal training could not be withdrawn. Refresh the page and try again." };
  revalidateTraining(memberId);
  revalidatePath("/admin/training");
  revalidatePath(`/admin/people/${memberId}`);
  return { success: "Personal training withdrawn. Review any outstanding bills below." };
}

export async function addPersonalTrainingClient(formData: FormData) {
  const admin = await verifyAdmin();
  const fullName = requiredText(formData, "fullName", 140);
  const email = requiredText(formData, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const phone = textField(formData, "phone", 40);
  const serviceMode = textField(formData, "serviceMode", 20);
  if (!new Set(["online", "in_person", "hybrid"]).has(serviceMode)) throw new Error("Choose a valid coaching format.");
  const primaryGoal = textField(formData, "primaryGoal", 700);
  const portal = await prepareMemberPortalLink(email, fullName, undefined, "/portal/training/intake");
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id,full_name,phone").eq("id", portal.userId).single();
  if (profileError || !profile) throw new Error("The account was created, but its profile could not be loaded. Please try again.");
  const { error: updateError } = await supabase.from("profiles").update({
    full_name: profile.full_name || fullName,
    phone: profile.phone || phone || null,
  }).eq("id", portal.userId);
  if (updateError) throw new Error("The client profile could not be saved. Please try again.");
  const { data: existing, error: existingError } = await supabase.from("coaching_relationships")
    .select("id,status").eq("member_id", portal.userId).maybeSingle();
  if (existingError) throw new Error("The coaching record could not be checked. Please try again.");
  if (existing && existing.status !== "active") throw new Error("This client already has a coaching record. Open it to review the current status before sending a new welcome email.");
  if (!existing) {
    const { error } = await supabase.from("coaching_relationships").insert({
      member_id: portal.userId,
      coach_id: admin.userId,
      service_mode: serviceMode,
      status: "active",
      primary_goal: primaryGoal || null,
      starts_on: detroitToday(),
    });
    if (error && error.code !== "23505") throw new Error("The coaching record could not be saved. Please try again.");
  }
  const sent = await sendTransactionalEmail(email, "Your Holden Health personal training portal is ready", {
    firstName: fullName.split(/\s+/)[0],
    preheader: "Your personal training portal is ready.",
    heading: "Welcome to personal training.",
    body: "Kelsey has set up your Holden Health personal training portal. Use the private button below to complete your confidential personal training intake. Kelsey will review it before you begin. Your plan, workouts, and in-person appointments will appear in your portal as she adds them.\n\nThis link works only once and should not be forwarded. If it expires, you can request a fresh sign-in link from the portal.",
    ctaLabel: "Complete my private intake",
    ctaUrl: portal.url,
  });
  if (!sent) throw new Error("The client was saved, but the setup email could not be sent. Submit the form again to retry.");
  revalidateTraining(portal.userId);
  revalidatePath("/admin/training");
  redirect(`/admin/training/${portal.userId}?message=client-added`);
}

export async function emailTrainingIntakeLink(formData: FormData) {
  await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const db = await createClient();
  const [{ data: relationship }, { data: profile }, { data: contact }] = await Promise.all([
    db.from("coaching_relationships").select("id,status").eq("member_id", memberId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", memberId).maybeSingle(),
    db.from("member_contacts").select("email").eq("user_id", memberId).maybeSingle(),
  ]);
  if (!relationship || !["invited", "active"].includes(relationship.status) || !contact?.email) {
    throw new Error("This client does not have an active personal-training record and email address.");
  }
  const { data: intake } = await db.from("personal_training_intakes").select("relationship_id")
    .eq("relationship_id", relationship.id).maybeSingle();
  if (intake) throw new Error("This client has already submitted the intake.");
  const name = profile?.full_name || "there";
  const portal = await prepareMemberPortalLink(contact.email, name, undefined, "/portal/training/intake");
  if (portal.userId !== memberId) throw new Error("The saved email belongs to another portal account. Update the client's contact before sending the intake link.");
  const sent = await sendTransactionalEmail(contact.email, "Complete your private Holden Health training intake", {
    firstName: name.split(/\s+/)[0],
    preheader: "Your private personal training intake is ready.",
    heading: "Let's get your training started.",
    body: "Please complete your confidential personal training intake so Kelsey can plan your sessions and workouts. You can also find it any time in your member portal. The sign-in button below works once; if it expires, request a fresh link from the portal.",
    ctaLabel: "Complete my private intake", ctaUrl: portal.url,
  });
  if (!sent) throw new Error("The intake email could not be sent. Please try again.");
  redirect(`/admin/training/${memberId}?message=intake-email-sent#intake`);
}

export async function addTrainingAppointment(formData: FormData) {
  await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const sessionDate = dateField(formData, "sessionDate");
  const sessionTime = requiredText(formData, "sessionTime", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sessionTime)) throw new Error("Choose a valid Eastern time.");
  const durationMinutes = boundedInteger(formData, "durationMinutes", 15, 240);
  const db = await createClient();
  const { data: relationship, error: lookupError } = await db.from("coaching_relationships")
    .select("id,service_mode,status").eq("member_id", memberId).maybeSingle();
  if (lookupError || !relationship || relationship.status !== "active" || relationship.service_mode === "online") {
    throw new Error("An active in-person or hybrid coaching record is required.");
  }
  const { error } = await db.from("personal_training_appointments").insert({
    relationship_id: relationship.id, session_date: sessionDate, session_time: sessionTime,
    duration_minutes: durationMinutes, location_note: textField(formData, "locationNote", 300) || null,
  });
  if (error) throw new Error(error.code === "23505" ? "This appointment is already on the schedule." : "The appointment could not be saved.");
  revalidateTraining(memberId);
  redirect(`/admin/training/${memberId}?message=appointment-added#appointments`);
}

export async function removeTrainingAppointment(formData: FormData) {
  await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const appointmentId = uuidField(formData, "appointmentId");
  const db = await createClient();
  const { data: relationship } = await db.from("coaching_relationships").select("id").eq("member_id", memberId).maybeSingle();
  if (!relationship) throw new Error("This coaching record could not be found.");
  const { error } = await db.from("personal_training_appointments").delete()
    .eq("id", appointmentId).eq("relationship_id", relationship.id);
  if (error) throw new Error("The appointment could not be removed.");
  revalidateTraining(memberId);
  redirect(`/admin/training/${memberId}?message=appointment-removed#appointments`);
}

export async function reviewTrainingIntake(formData: FormData) {
  const admin = await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const db = await createClient();
  const { data: relationship } = await db.from("coaching_relationships").select("id").eq("member_id", memberId).maybeSingle();
  if (!relationship) throw new Error("This coaching record could not be found.");
  const { data: agreement, error: agreementError } = await db.from("risk_agreements").select("id").eq("relationship_id", relationship.id).maybeSingle();
  if (agreementError || !agreement) throw new Error("The personal training Assumption of Risk must be signed before marking the intake reviewed.");
  const { data, error } = await db.from("personal_training_intakes").update({ reviewed_at: new Date().toISOString(), reviewed_by: admin.userId })
    .eq("relationship_id", relationship.id).is("reviewed_at", null).select("relationship_id").maybeSingle();
  if (error || !data) throw new Error("The intake could not be marked reviewed.");
  revalidateTraining(memberId);
  redirect(`/admin/training/${memberId}?message=intake-reviewed#intake`);
}

export async function enablePersonalTraining(formData: FormData) {
  const admin = await verifyAdmin();
  const memberId = uuidField(formData, "memberId");
  const serviceMode = textField(formData, "serviceMode", 20);
  if (!new Set(["online", "in_person", "hybrid"]).has(serviceMode)) throw new Error("Choose a valid coaching format.");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", memberId).maybeSingle();
  if (!profile) throw new Error("That member could not be found.");
  const { error } = await supabase.from("coaching_relationships").upsert({
    member_id: memberId,
    coach_id: admin.userId,
    service_mode: serviceMode,
    status: "active",
    primary_goal: requiredText(formData, "primaryGoal", 700),
    available_equipment: textField(formData, "availableEquipment", 700) || null,
    starts_on: dateField(formData, "startsOn"),
    next_review_on: textField(formData, "nextReviewOn", 10) || null,
  }, { onConflict: "member_id" });
  if (error) throw new Error("Personal training could not be activated.");
  revalidateTraining(memberId);
  redirect(`/admin/training/${memberId}`);
}

export async function createPersonalWorkout(formData: FormData) {
  const admin = await verifyAdmin();
  const relationshipId = uuidField(formData, "relationshipId");
  const supabase = await createClient();
  const { data: relationship } = await supabase.from("coaching_relationships").select("id,member_id").eq("id", relationshipId).eq("status", "active").maybeSingle();
  if (!relationship) throw new Error("That personal-training relationship is not active.");

  const { data: workout, error: workoutError } = await supabase.from("scheduled_workouts").insert({
    relationship_id: relationshipId,
    scheduled_for: dateField(formData, "scheduledFor"),
    title: requiredText(formData, "title", 140),
    focus: textField(formData, "focus", 500) || null,
    coach_note: textField(formData, "coachNote", 1200) || null,
    created_by: admin.userId,
  }).select("id").single();
  if (workoutError || !workout) throw new Error("The workout could not be created.");

  const options = (["A", "B", "C"] as const).map((code) => ({
    workout_id: workout.id,
    option_code: code,
    label: requiredText(formData, `label${code}`, 100),
    estimated_minutes: boundedInteger(formData, `minutes${code}`, 5, 180),
    plan: requiredText(formData, `plan${code}`, 6000),
  }));
  const { error: optionsError } = await supabase.from("workout_options").insert(options);
  if (optionsError) {
    await supabase.from("scheduled_workouts").delete().eq("id", workout.id);
    throw new Error("The workout versions could not be saved.");
  }
  revalidateTraining(relationship.member_id);
  redirect(`/admin/training/${relationship.member_id}?message=workout-created`);
}

export async function completePersonalWorkout(formData: FormData): Promise<{ error?: string; redirect?: string }> {
  try {
  const session = await verifySession();
  const workoutId = uuidField(formData, "workoutId");
  const optionCode = requiredText(formData, "optionCode", 1).toUpperCase();
  if (!OPTION_CODES.has(optionCode)) throw new Error("Choose a workout version.");
  const supabase = await createClient();
  const { data: workout } = await supabase.from("scheduled_workouts")
    .select("id,status,relationship_id,coaching_relationships!inner(member_id,status)")
    .eq("id", workoutId).eq("status", "scheduled").maybeSingle();
  const relationship = workout?.coaching_relationships as unknown as { member_id: string; status: string } | null;
  if (!workout || relationship?.member_id !== session.userId || relationship.status !== "active") throw new Error("That workout is not available.");
  const { data: option } = await supabase.from("workout_options").select("id").eq("workout_id", workoutId).eq("option_code", optionCode).maybeSingle();
  if (!option) throw new Error("That workout version is not available.");

  const adminClient = createAdminClient();
  const { data: log, error: logError } = await adminClient.from("workout_logs").insert({
    workout_id: workoutId,
    member_id: session.userId,
    option_code: optionCode,
    energy_before: boundedInteger(formData, "energyBefore", 1, 5),
    effort: boundedInteger(formData, "effort", 1, 10),
    completion_note: textField(formData, "completionNote", 2000) || null,
    personal_win: textField(formData, "personalWin", 600) || null,
  }).select("id").single();
  if (logError || !log) throw new Error(logError?.code === "23505" ? "This workout is already complete." : "Your workout could not be saved.");
  const { error: updateError } = await adminClient.from("scheduled_workouts").update({ status: "completed" }).eq("id", workoutId).eq("status", "scheduled");
  if (updateError) {
    await adminClient.from("workout_logs").delete().eq("id", log.id);
    throw new Error("Your workout could not be completed. Please try again.");
  }
  revalidateTraining(session.userId);
  queueCoachActivityDelivery();
  return { redirect: "/portal/training?message=workout-complete#progress" };
  } catch { return { error: "This workout could not be saved. Check that your plan is active and the workout is still scheduled, then retry or contact Kelsey." }; }
}

export async function resetPersonalWeek(formData: FormData): Promise<{ error?: string; redirect?: string }> {
  try {
    const session = await verifySession();
    const relationshipId = uuidField(formData, "relationshipId"), resetId = uuidField(formData, "resetId");
    const remainingSessions = boundedInteger(formData, "remainingSessions", 0, 3);
    const energy = requiredText(formData, "energy", 10);
    if (!["low", "steady", "good"].includes(energy)) return { error: "Choose your current energy." };
    const supabase = await createClient();
    const { data: relationship, error: lookupError } = await supabase.from("coaching_relationships").select("id").eq("id", relationshipId).eq("member_id", session.userId).eq("status", "active").maybeSingle();
    if (lookupError || !relationship) return { error: "Your personal plan is not active. Contact Kelsey before changing it." };
    const { error } = await createAdminClient().rpc("reset_member_week", {
      p_member_id: session.userId, p_relationship_id: relationshipId, p_reset_id: resetId,
      p_remaining: remainingSessions, p_energy: energy, p_note: textField(formData, "memberNote", 1000),
    });
    if (error) return { error: "Your reset was not saved. Your schedule has not been partly changed. Please retry or contact Kelsey." };
    revalidateTraining(session.userId);
    return { redirect: "/portal/training?message=week-reset#plan" };
  } catch { return { error: "Your reset could not be confirmed. Your answers are still here. Check your sign-in and try again." }; }
}

export async function respondToWorkout(formData: FormData) {
  const admin = await verifyAdmin();
  const workoutLogId = uuidField(formData, "workoutLogId");
  const memberId = uuidField(formData, "memberId");
  const supabase = await createClient();
  const { data: log } = await supabase.from("workout_logs").select("id,member_id").eq("id", workoutLogId).eq("member_id", memberId).maybeSingle();
  if (!log) throw new Error("That workout log could not be found.");
  const { error } = await supabase.from("workout_feedback").upsert({
    workout_log_id: workoutLogId,
    coach_id: admin.userId,
    response: requiredText(formData, "response", 3000),
  }, { onConflict: "workout_log_id" });
  if (error) throw new Error("The coaching response could not be saved.");
  revalidateTraining(memberId);
  redirect(`/admin/training/${memberId}?message=response-saved#progress`);
}
