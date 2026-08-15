"use server";

import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdmin, verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENROLLMENT_STATUSES = new Set(["prospect", "invited", "active", "completed", "withdrawn"]);
const PAYMENT_STATUSES = new Set(["pending", "paid", "credited", "refunded", "waived"]);
const PAYMENT_METHODS = new Set(["venmo", "zelle", "check", "other"]);
const SESSION_STATUSES = new Set(["draft", "enrolling", "full", "active", "completed", "cancelled"]);

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

function dollarsToCents(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) throw new Error("Enter a valid amount.");
  return Math.round(amount * 100);
}

function weeklyCommitmentField(formData: FormData, required = false) {
  const value = Number(formData.get("weeklyCommitment"));
  if (value === 2 || value === 3) return value;
  if (required) throw new Error("Choose a two-day or three-day weekly commitment.");
  return null;
}

function revalidateHub() {
  revalidatePath("/portal");
  revalidatePath("/admin");
}

function publicAuthClient() {
  return createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

async function sendMagicLink(email: string, fullName: string) {
  const origin = (await headers()).get("origin") ?? "https://portal.holden.health";
  const { error } = await publicAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm?next=%2Fportal`, data: { full_name: fullName } },
  });
  if (error) throw new Error("The signup was saved, but the sign-in email could not be sent.");
}

async function sendTransactionalEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Holden Health <members@mail.holden.health>", to: [to], subject, html }),
  });
  return response.ok;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function setAttendanceSelection(formData: FormData) {
  const session = await verifySession();
  const enrollmentId = uuidField(formData, "enrollmentId");
  const meetingId = uuidField(formData, "meetingId");
  const selected = formData.get("selected") === "true";
  const supabase = await createClient();
  const { data: enrollment } = await supabase.from("enrollments").select("id,session_id,status").eq("id", enrollmentId).eq("member_id", session.userId).eq("status", "active").maybeSingle();
  if (!enrollment) throw new Error("This enrollment is not active.");
  const { data: meeting } = await supabase.from("class_meetings").select("id").eq("id", meetingId).eq("session_id", enrollment.session_id).maybeSingle();
  if (!meeting) throw new Error("That class is not part of your session.");

  const result = selected
    ? await supabase.from("attendance_selections").upsert({ enrollment_id: enrollmentId, meeting_id: meetingId }, { onConflict: "enrollment_id,meeting_id" })
    : await supabase.from("attendance_selections").delete().eq("enrollment_id", enrollmentId).eq("meeting_id", meetingId);
  if (result.error) throw new Error("We could not update that class choice.");
  revalidateHub();
}

export async function submitWeeklyCheckIn(formData: FormData) {
  const session = await verifySession();
  const enrollmentId = uuidField(formData, "enrollmentId");
  const weekNumber = Math.max(1, Math.min(12, Number(formData.get("weekNumber")) || 1));
  const supabase = await createClient();
  const { data: enrollment } = await supabase.from("enrollments").select("id").eq("id", enrollmentId).eq("member_id", session.userId).eq("status", "active").maybeSingle();
  if (!enrollment) throw new Error("This enrollment is not active.");
  const { error } = await supabase.from("check_ins").insert({
    enrollment_id: enrollmentId,
    week_number: weekNumber,
    went_well: requiredText(formData, "wentWell", 2500),
    did_not_go_well: requiredText(formData, "didNotGoWell", 2500),
    upcoming_goal: requiredText(formData, "upcomingGoal", 2500),
    support_needed: requiredText(formData, "supportNeeded", 2500),
  });
  if (error) throw new Error(error.code === "23505" ? "This week's check-in was already submitted." : "We could not save your check-in.");
  revalidateHub();
}

export async function inviteMember(formData: FormData) {
  const admin = await verifyAdmin();
  const sessionId = uuidField(formData, "sessionId");
  const email = requiredText(formData, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const enrollmentStatus = textField(formData, "enrollmentStatus", 20) || "invited";
  const paymentStatus = textField(formData, "paymentStatus", 20) || "pending";
  const paymentMethod = textField(formData, "paymentMethod", 20);
  if (!ENROLLMENT_STATUSES.has(enrollmentStatus) || !PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Invalid signup status.");
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) throw new Error("Invalid payment method.");

  const supabase = await createClient();
  const { error: invitationError } = await supabase.from("member_invitations").upsert({
    email,
    full_name: requiredText(formData, "fullName", 140),
    phone: textField(formData, "phone", 40) || null,
    session_id: sessionId,
    enrollment_status: enrollmentStatus,
    weekly_commitment: weeklyCommitmentField(formData),
    returning_member: formData.get("returningMember") === "on",
    payment_status: paymentStatus,
    payment_method: paymentMethod || null,
    amount_cents: dollarsToCents(requiredText(formData, "amount", 12)),
    invited_by: admin.userId,
  }, { onConflict: "session_id,email" });
  if (invitationError) throw new Error("We could not create that member invitation.");

  await sendMagicLink(email, requiredText(formData, "fullName", 140));
  revalidateHub();
}

export async function submitRegistrationRequest(formData: FormData) {
  if (textField(formData, "website", 200)) redirect("/register?sent=1");
  const fullName = requiredText(formData, "fullName", 140);
  const email = requiredText(formData, "email", 254).toLowerCase();
  const phone = requiredText(formData, "phone", 40);
  const sessionId = uuidField(formData, "sessionId");
  const weeklyCommitment = weeklyCommitmentField(formData, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const allowedDays = new Set(["Tuesday 6:00 AM", "Wednesday 7:00 PM", "Saturday 9:00 AM"]);
  const attendanceInterest = formData.getAll("attendance").map(String).filter((day) => allowedDays.has(day));
  if (!attendanceInterest.length) throw new Error("Choose at least one class time.");

  const { error } = await publicAuthClient().from("registration_requests").insert({
    session_id: sessionId,
    full_name: fullName,
    email,
    phone,
    weekly_commitment: weeklyCommitment,
    returning_member: formData.get("returningMember") === "on",
    attendance_interest: attendanceInterest,
    note: textField(formData, "note", 1000) || null,
  });
  if (error) throw new Error("We could not submit your registration request.");

  await Promise.all([
    sendTransactionalEmail(
      "holdenhealth.coaching@gmail.com",
      `New session request from ${fullName}`,
      `<h2>New Focus on You registration request</h2><p><strong>${fullName}</strong> (${email}, ${phone}) asked to join.</p><p>Weekly commitment: ${weeklyCommitment} days.</p><p>Preferred times: ${attendanceInterest.join(", ")}.</p><p><a href="https://portal.holden.health/admin#approvals">Review this request</a></p>`,
    ),
    sendTransactionalEmail(
      email,
      "We received your Holden Health session request",
      `<h2>Thanks, ${fullName.split(/\s+/)[0]}.</h2><p>Your Focus on You session request is with Holden Health. Kelsey will connect with you to make sure the session is a good fit and confirm payment before activating your member portal.</p>`,
    ),
  ]);
  redirect("/register?sent=1");
}

export async function approveRegistrationRequest(formData: FormData) {
  const admin = await verifyAdmin();
  const requestId = uuidField(formData, "requestId");
  const supabase = await createClient();
  const { data: request } = await supabase.from("registration_requests").select("id,session_id,full_name,email,phone,returning_member,weekly_commitment,status,sessions(new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents)").eq("id", requestId).eq("status", "pending").maybeSingle();
  if (!request) throw new Error("This registration request is no longer pending.");
  const prices = request.sessions as unknown as { new_member_price_cents: number; returning_member_price_cents: number | null; two_day_price_cents: number | null; three_day_price_cents: number | null };
  const amountCents = request.weekly_commitment === 3
    ? (prices.three_day_price_cents ?? prices.returning_member_price_cents ?? prices.new_member_price_cents)
    : request.weekly_commitment === 2
      ? (prices.two_day_price_cents ?? prices.new_member_price_cents)
      : request.returning_member ? (prices.returning_member_price_cents ?? prices.new_member_price_cents) : prices.new_member_price_cents;
  const { error: invitationError } = await supabase.from("member_invitations").upsert({
    email: request.email,
    full_name: request.full_name,
    phone: request.phone,
    session_id: request.session_id,
    enrollment_status: "active",
    weekly_commitment: request.weekly_commitment,
    returning_member: request.returning_member,
    payment_status: "pending",
    payment_method: null,
    amount_cents: amountCents,
    invited_by: admin.userId,
  }, { onConflict: "session_id,email" });
  if (invitationError) throw new Error("We could not approve this registration.");
  await sendMagicLink(request.email, request.full_name);
  const { error: updateError } = await supabase.from("registration_requests").update({ status: "approved", reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq("id", requestId);
  if (updateError) throw new Error("The member was invited, but the approval status did not update.");
  revalidateHub();
}

export async function declineRegistrationRequest(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("registration_requests").update({ status: "declined", reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq("id", uuidField(formData, "requestId")).eq("status", "pending");
  if (error) throw new Error("We could not update this request.");
  revalidateHub();
}

export async function updateSessionDetails(formData: FormData) {
  await verifyAdmin();
  const sessionId = uuidField(formData, "sessionId");
  const status = textField(formData, "status", 20);
  if (!SESSION_STATUSES.has(status)) throw new Error("Invalid session status.");
  const capacity = Number(formData.get("capacity"));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error("Capacity must be between 1 and 100.");
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").update({
    name: requiredText(formData, "name", 140),
    description: requiredText(formData, "description", 1200),
    capacity,
    status,
    new_member_price_cents: dollarsToCents(requiredText(formData, "twoDayPrice", 12)),
    returning_member_price_cents: dollarsToCents(requiredText(formData, "threeDayPrice", 12)),
    two_day_price_cents: dollarsToCents(requiredText(formData, "twoDayPrice", 12)),
    three_day_price_cents: dollarsToCents(requiredText(formData, "threeDayPrice", 12)),
    published: formData.get("published") === "on",
  }).eq("id", sessionId);
  if (error) throw new Error("We could not update the session.");
  revalidateHub();
}

export async function createAnnouncement(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    session_id: uuidField(formData, "sessionId"),
    title: requiredText(formData, "title", 140),
    body: requiredText(formData, "body", 1600),
    published_at: formData.get("published") === "on" ? new Date().toISOString() : null,
    created_by: admin.userId,
  });
  if (error) throw new Error("We could not create the announcement.");
  revalidateHub();
}

export async function deleteAnnouncement(formData: FormData) {
  await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", uuidField(formData, "id"));
  if (error) throw new Error("We could not remove the announcement.");
  revalidateHub();
}

export async function createResource(formData: FormData) {
  const admin = await verifyAdmin();
  const rawUrl = requiredText(formData, "url", 700);
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Enter a complete resource URL."); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Resource links must use HTTP or HTTPS.");
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    session_id: uuidField(formData, "sessionId"),
    title: requiredText(formData, "title", 140),
    description: textField(formData, "description", 600) || null,
    url: url.toString(),
    sort_order: Math.max(0, Math.min(1000, Number(formData.get("sortOrder")) || 0)),
    published: formData.get("published") === "on",
    created_by: admin.userId,
  });
  if (error) throw new Error("We could not add the resource.");
  revalidateHub();
}

export async function deleteResource(formData: FormData) {
  await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("resources").delete().eq("id", uuidField(formData, "id"));
  if (error) throw new Error("We could not remove the resource.");
  revalidateHub();
}

export async function updateEnrollmentAndPayment(formData: FormData) {
  const admin = await verifyAdmin();
  const enrollmentId = uuidField(formData, "enrollmentId");
  const enrollmentStatus = textField(formData, "enrollmentStatus", 20);
  const paymentStatus = textField(formData, "paymentStatus", 20);
  const paymentMethod = textField(formData, "paymentMethod", 20);
  if (!ENROLLMENT_STATUSES.has(enrollmentStatus) || !PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Invalid member status.");
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) throw new Error("Invalid payment method.");
  const supabase = await createClient();
  const { error: enrollmentError } = await supabase.from("enrollments").update({ status: enrollmentStatus, weekly_commitment: weeklyCommitmentField(formData), returning_member: formData.get("returningMember") === "on" }).eq("id", enrollmentId);
  if (enrollmentError) throw new Error("We could not update this member.");
  const { error: paymentError } = await supabase.from("payment_records").upsert({
    enrollment_id: enrollmentId,
    status: paymentStatus,
    method: paymentMethod || null,
    amount_cents: dollarsToCents(requiredText(formData, "amount", 12)),
    received_on: paymentStatus === "paid" ? (textField(formData, "receivedOn", 10) || new Date().toISOString().slice(0, 10)) : null,
    internal_note: textField(formData, "internalNote", 500) || null,
    recorded_by: admin.userId,
  }, { onConflict: "enrollment_id" });
  if (paymentError) throw new Error("We could not update payment status.");
  revalidateHub();
}

export async function respondToCheckIn(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("check_ins").update({
    coach_response: requiredText(formData, "coachResponse", 3000),
    reviewed_at: new Date().toISOString(),
    reviewed_by: admin.userId,
  }).eq("id", uuidField(formData, "checkInId"));
  if (error) throw new Error("We could not save the response.");
  revalidateHub();
}
