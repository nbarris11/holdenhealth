"use server";

import { publishSingleConsultationSlot } from "@/app/admin/consultations/availability-actions";

import { createClient as createIsolatedClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdmin, verifySession } from "@/lib/auth";
import { prepareMemberPortalLink, sendMemberPortalLink, sendTransactionalEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { captureServerEvent, distinctIdForValue } from "@/lib/posthog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createScheduledZoomMeeting } from "@/lib/zoom";
import { programMeetingDates, type ProgramFormat } from "@/lib/program-schedule";
import { registrationClassTimes } from "@/lib/registration-schedule";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENROLLMENT_STATUSES = new Set(["prospect", "invited", "active", "completed", "withdrawn"]);
const PAYMENT_STATUSES = new Set(["pending", "paid", "credited", "refunded", "waived"]);
const PAYMENT_METHODS = new Set(["venmo", "zelle", "check", "stripe_ach", "stripe_card", "other"]);
const SESSION_STATUSES = new Set(["draft", "enrolling", "full", "active", "completed", "cancelled"]);
const DROP_IN_STATUSES = new Set(["requested", "confirmed", "declined", "cancelled"]);

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

function weeklyCommitmentField(formData: FormData, required = false, allowPrivate = false) {
  const value = Number(formData.get("weeklyCommitment"));
  if (value === 2 || value === 3 || (allowPrivate && value === 1)) return value;
  if (required) throw new Error("Choose a two-day or three-day weekly commitment.");
  return null;
}

function detroitDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Choose a valid class date and time.");
  const guess = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) throw new Error("Choose a valid class date and time.");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(guess).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offset = representedAsUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function detroitDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function detroitWeekday(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long" }).format(new Date(value));
}

function classDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
  }).format(new Date(value));
}

async function ensureClassZoomMeeting(
  supabase: SupabaseClient,
  meetingId: string,
  title: string,
  startsAt: string,
  durationMinutes: number,
) {
  const { data: existing, error: lookupError } = await supabase
    .from("class_zoom_meetings")
    .select("meeting_id,join_url")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const zoomMeeting = await createScheduledZoomMeeting(title, startsAt, durationMinutes);
  const { data, error } = await supabase.from("class_zoom_meetings").insert({
    meeting_id: meetingId,
    zoom_meeting_id: zoomMeeting.zoomMeetingId,
    join_url: zoomMeeting.joinUrl,
  }).select("meeting_id,join_url").single();
  if (error || !data) throw error ?? new Error("The Zoom link could not be saved.");
  return data;
}

function revalidateHub() {
  revalidatePath("/portal", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/people");
  revalidatePath("/admin/content");
  revalidatePath("/admin/settings");
}

function publicAuthClient() {
  return createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

export async function signOut() {
  const supabase = await createClient();
  const deviceCookies = await cookies();
  const endpoint = deviceCookies.get("hh-chat-device")?.value;
  if (endpoint) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await createAdminClient().from("chat_push_subscriptions").delete().eq("user_id", data.user.id).eq("endpoint", endpoint);
      if (error) throw new Error("Could not disconnect this device's notifications. Please retry signing out.");
    }
    deviceCookies.delete("hh-chat-device");
  }
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
  const { data: meeting } = await supabase.from("class_meetings").select("id,title,starts_at,is_zoom,cancelled").eq("id", meetingId).eq("session_id", enrollment.session_id).maybeSingle();
  if (!meeting) throw new Error("That class is not part of your session.");
  if (meeting.cancelled || new Date(meeting.starts_at) < new Date()) throw new Error("That class is no longer available.");

  const { data: existingSelection } = await supabase.from("attendance_selections").select("id").eq("enrollment_id", enrollmentId).eq("meeting_id", meetingId).maybeSingle();
  const result = selected
    ? await supabase.from("attendance_selections").upsert({ enrollment_id: enrollmentId, meeting_id: meetingId }, { onConflict: "enrollment_id,meeting_id" }).select("id").single()
    : await supabase.from("attendance_selections").delete().eq("enrollment_id", enrollmentId).eq("meeting_id", meetingId);
  if (result.error) throw new Error("We could not update that class choice.");
  if (selected && !existingSelection && meeting.is_zoom && session.email) {
    const { data: zoomMeeting } = await supabase.from("class_zoom_meetings").select("join_url").eq("meeting_id", meetingId).maybeSingle();
    const selectionId = "data" in result ? result.data?.id : null;
    if (zoomMeeting?.join_url && selectionId) {
      await sendTransactionalEmail(session.email, `Your Zoom link for ${meeting.title}`, {
        firstName: "there",
        preheader: `Your private link for ${meeting.title} is ready.`,
        heading: "Your Zoom class is confirmed.",
        body: `You’re signed up for ${meeting.title} on ${classDateTimeLabel(meeting.starts_at)}. Everyone attending this class will use the same private Zoom link below.\n\nPlease keep the link private and join a few minutes early.`,
        ctaLabel: "Join Zoom class",
        ctaUrl: zoomMeeting.join_url,
      }, { idempotencyKey: `attendance-zoom-${selectionId}` });
    }
  }
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
    weekly_commitment: weeklyCommitmentField(formData, true, true),
    returning_member: formData.get("returningMember") === "on",
    payment_status: paymentStatus,
    payment_method: paymentMethod || null,
    amount_cents: dollarsToCents(requiredText(formData, "amount", 12)),
    invited_by: admin.userId,
  }, { onConflict: "session_id,email" });
  if (invitationError) throw new Error("We could not create that member invitation.");

  await sendMemberPortalLink(email, requiredText(formData, "fullName", 140));
  revalidateHub();
  if (formData.get("returnTo") === "add-person") {
    redirect(`/admin/people/add?program=${encodeURIComponent(sessionId)}&sent=1`);
  }
}

export async function submitRegistrationRequest(formData: FormData) {
  if (textField(formData, "website", 200)) redirect("/register?sent=1");
  const fullName = requiredText(formData, "fullName", 140);
  const email = requiredText(formData, "email", 254).toLowerCase();
  const phone = requiredText(formData, "phone", 40);
  const sessionId = uuidField(formData, "sessionId");
  const registrationPath = `/register?session=${encodeURIComponent(sessionId)}`;
  const weeklyCommitment = weeklyCommitmentField(formData, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  const paymentMethod = textField(formData, "paymentMethod", 20);
  const offline = ["venmo", "cash", "check"].includes(paymentMethod);
  if (paymentMethod && !offline && paymentMethod !== "request") redirect(`${registrationPath}&checkoutError=details#offline`);
  if (offline && formData.get("policiesConfirmed") !== "on") redirect(`${registrationPath}&checkoutError=policies#offline`);
  const { data: chosenSession, error: sessionError } = await createAdminClient().from("sessions").select("id,name,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents").eq("id", sessionId).maybeSingle();
  if (sessionError || !chosenSession) redirect(`${registrationPath}&checkoutError=unavailable#offline`);
  const { data: availableMeetings, error: meetingsError } = await createAdminClient().from("class_meetings").select("starts_at,cancelled").eq("session_id", sessionId);
  if (meetingsError) redirect(`${registrationPath}&checkoutError=unavailable#offline`);
  const allowedDays = new Set(registrationClassTimes(availableMeetings ?? []));
  const attendanceInterest = formData.getAll("attendance").map(String).filter(day => allowedDays.has(day));
  if (!attendanceInterest.length) redirect(`${registrationPath}&checkoutError=attendance#offline`);
  const miniSession = chosenSession.two_day_price_cents == null && chosenSession.three_day_price_cents == null;
  const returningMember = formData.get("returningMember") === "on";
  const miniPrice = (returningMember ? chosenSession.returning_member_price_cents ?? chosenSession.new_member_price_cents : chosenSession.new_member_price_cents) / 100;
  const details = {
    session_id: sessionId,
    full_name: fullName,
    email,
    phone,
    weekly_commitment: weeklyCommitment,
    returning_member: returningMember,
    attendance_interest: attendanceInterest,
    note: textField(formData, "note", 1000) || null,
  };
  const { error } = paymentMethod === "request"
    ? await createAdminClient().rpc("request_late_registration", {p_session_id: sessionId, p_full_name: fullName, p_email: email, p_phone: phone, p_weekly_commitment: weeklyCommitment, p_attendance_interest: attendanceInterest, p_note: details.note})
    : offline
    ? await createAdminClient().rpc(miniSession ? "reserve_mini_offline_registration" : "reserve_offline_registration", miniSession ? {
      p_session_id: sessionId, p_full_name: fullName, p_email: email, p_phone: phone,
      p_attendance_interest: attendanceInterest, p_returning_member: returningMember,
      p_payment_method: paymentMethod, p_note: details.note ?? "",
    } : {
      p_session_id: sessionId, p_full_name: fullName, p_email: email, p_phone: phone,
      p_weekly_commitment: weeklyCommitment, p_attendance_interest: attendanceInterest,
      p_payment_method: paymentMethod, p_note: `Reserved place · ${paymentMethod} · payment pending. ${details.note ?? ""}`,
    })
    : await publicAuthClient().from("registration_requests").insert(details);
  if (error) {
    const reason = error.message.toLowerCase();
    const code = reason.includes("full") ? "full" : reason.includes("in progress") ? "in-progress" : "unavailable";
    redirect(formData.get("renewal") === "on" ? `/portal/renew?session=${sessionId}&message=${code}` : `${registrationPath}&checkoutError=${code}#offline`);
  }

  if (offline) {
    await captureServerEvent(distinctIdForValue(email), "group_signup_completed", {
      offering: "group_enrollment",
      completion_status: "reserved",
      payment_status: "pending",
      payment_method: paymentMethod,
      weekly_commitment: weeklyCommitment,
    }, `offline:${sessionId}:${email}`);
  }

  await Promise.all([
    sendTransactionalEmail(
      "holdenhealth.coaching@gmail.com",
      `${offline ? "Offline reservation" : "Session request"} from ${fullName}`,
      {
        firstName: "Kelsey",
        preheader: `${fullName} is interested in joining Focus on You.`,
        heading: "Someone new wants to join the group.",
        body: `${fullName} sent a Focus on You session request.\n\nProgram: ${chosenSession.name}\nEmail: ${email}\nPhone: ${phone}\n${miniSession ? `Package: all scheduled classes · ${returningMember ? "returning" : "new"} member · $${miniPrice}` : `Weekly commitment: ${weeklyCommitment} days`}\nPreferred times: ${attendanceInterest.join(", ")}\n\nPayment choice: ${offline ? paymentMethod + " (reserved, payment pending)" : "Consultation/request only"}. Their details are waiting for your review in the admin portal.`,
        ctaLabel: "Review the request",
        ctaUrl: `https://portal.holden.health/admin/people?program=${encodeURIComponent(sessionId)}#requests`,
      },
    ),
    sendTransactionalEmail(
      email,
      offline ? "Your Holden Health place is reserved" : "Kelsey received your Holden Health request",
      {
        firstName: fullName.split(/\s+/)[0],
        preheader: "Kelsey received your session request and will be in touch soon.",
        heading: offline ? "Your place is reserved." : "Thanks for reaching out.",
        body: offline ? `Your place in ${chosenSession.name} is reserved. ${miniSession ? `Your ${returningMember ? "returning" : "new"} member package is $${miniPrice}. ` : ""}You chose ${paymentMethod}; payment is still pending and no online fee has been added. Please pay before your first class.${paymentMethod === "venmo" ? "\n\nSend your program payment to @holdenhealthllc on Venmo: https://venmo.com/u/holdenhealthllc. Include the name you registered with in the payment note so Kelsey can match it to your reservation. Your reservation will stay marked unpaid until Kelsey confirms your payment. Kelsey will follow up with intake details." : " Kelsey will follow up with payment and intake details."}\n\nYou can find arrival instructions and the cancellation policy on the group program page. If your plans change, please contact Kelsey.` : "Your Focus on You session request is safely with Kelsey. She’ll reach out personally to learn what you’re looking for, answer questions, and make sure the session feels like a good fit.\n\nThere’s nothing else you need to do right now. Keep an eye on your inbox. Kelsey looks forward to connecting with you.",
        ctaLabel: paymentMethod === "venmo" ? "Open Venmo" : "Learn more about Holden Health",
        ctaUrl: paymentMethod === "venmo" ? "https://venmo.com/u/holdenhealthllc" : "https://holden.health",
      },
    ),
  ]);
  if (formData.get("renewal") === "on") redirect(`/portal/renew?session=${sessionId}`);
  redirect(offline ? `${registrationPath}&sent=1&reserved=1&paymentMethod=${paymentMethod}` : `${registrationPath}&sent=1`);
}

export async function approveRegistrationRequest(formData: FormData) {
  await verifyAdmin();
  const requestId = uuidField(formData, "requestId");
  const amount = dollarsToCents(requiredText(formData, "amount", 12));
  if (!Number.isInteger(amount) || amount < 0 || amount > 1000000) throw new Error("Enter the agreed price, up to $10,000.");
  const db = await createClient();
  const {error} = await db.rpc("approve_priced_registration", {p_request_id: requestId, p_amount: amount});
  if (error) redirect(`/admin/people?program=${encodeURIComponent(String(formData.get("programId") || ""))}&approval=unavailable#requests`);
  const {data: request, error: readError} = await db.from("registration_requests").select("id,session_id,full_name,email,approved_amount_cents,setup_email_sent_at").eq("id", requestId).single();
  if (readError || !request) throw new Error("Approval saved, but the request could not be reloaded. Refresh before retrying.");
  if (!request.setup_email_sent_at) {
    await prepareMemberPortalLink(request.email, request.full_name);
    const sent = await sendTransactionalEmail(request.email, "Your Holden Health registration is approved", {
      firstName: request.full_name.trim().split(/\s+/)[0] || "there", preheader: "Your agreed price and private setup link are ready.", heading: "Your place is approved.",
      body: `Your agreed program price is $${((request.approved_amount_cents ?? 0) / 100).toFixed(2)}. Please arrange payment with Kelsey by Venmo, cash, or check before your first class. No online payment fee applies. Payment remains pending until Kelsey records it.\n\nOpen your private portal below to complete your intake. Kelsey will confirm you are ready to participate after reviewing your intake and payment.`,
      ctaLabel: "Sign in to my private portal", ctaUrl: "https://portal.holden.health/login",
    }, {idempotencyKey: `priced-registration-${request.id}`});
    if (sent) await db.from("registration_requests").update({setup_email_sent_at: new Date().toISOString()}).eq("id", requestId);
    else { revalidateHub(); redirect(`/admin/people?program=${request.session_id}&approval=email-failed#requests`); }
  }
  revalidateHub();
  redirect(`/admin/people?program=${request.session_id}&approval=saved#requests`);
}

export async function declineRegistrationRequest(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("registration_requests").update({ status: "declined", reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq("id", uuidField(formData, "requestId")).eq("status", "pending");
  if (error) throw new Error("We could not update this request.");
  revalidateHub();
}

export async function markWebsiteInquiryHandled(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("website_inquiries").update({
    status: "handled",
    reviewed_by: admin.userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", uuidField(formData, "inquiryId")).eq("status", "pending");
  if (error) throw new Error("We could not update this inquiry.");
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
  const { data: existing, error: readError } = await supabase.from("sessions").select("two_day_price_cents,three_day_price_cents,published,starts_on,ends_on").eq("id", sessionId).maybeSingle();
  if (readError || !existing) throw new Error("Program details could not be loaded.");
  const miniSession = existing.two_day_price_cents == null && existing.three_day_price_cents == null;
  if (formData.get("published") === "on" && !existing.published) {
    if (status !== "enrolling" || existing.starts_on <= detroitDate(new Date().toISOString())) throw new Error("Open registration before the first class starts.");
    const { data: meetings, error: meetingsError } = await supabase.from("class_meetings").select("starts_at,cancelled").eq("session_id", sessionId);
    if (meetingsError || !meetings?.some(meeting => !meeting.cancelled && detroitDate(meeting.starts_at) >= existing.starts_on && detroitDate(meeting.starts_at) <= existing.ends_on)) throw new Error("Add and review the class schedule before opening registration.");
  }
  const { error } = await supabase.from("sessions").update({
    name: requiredText(formData, "name", 140),
    description: requiredText(formData, "description", 1200),
    capacity,
    status,
    new_member_price_cents: dollarsToCents(requiredText(formData, miniSession ? "newMemberPrice" : "twoDayPrice", 12)),
    returning_member_price_cents: dollarsToCents(requiredText(formData, miniSession ? "returningMemberPrice" : "threeDayPrice", 12)),
    ...(miniSession ? {} : {
      two_day_price_cents: dollarsToCents(requiredText(formData, "twoDayPrice", 12)),
      three_day_price_cents: dollarsToCents(requiredText(formData, "threeDayPrice", 12)),
    }),
    published: formData.get("published") === "on",
  }).eq("id", sessionId);
  if (error) throw new Error("We could not update the session.");
  revalidateHub();
}

export async function createClassProgram(formData: FormData) {
  await verifyAdmin();
  const format = textField(formData, "format", 20) as ProgramFormat;
  if (format !== "weekly" && format !== "all-classes") throw new Error("Choose a program format.");
  const name = requiredText(formData, "name", 140);
  const description = requiredText(formData, "description", 1200);
  const startsOn = requiredText(formData, "startsOn", 10);
  const endsOn = requiredText(formData, "endsOn", 10);
  const today = detroitDate(new Date().toISOString());
  if (startsOn <= today) throw new Error("Choose a future start date.");
  const dates = programMeetingDates(startsOn, endsOn, format);
  const capacity = Number(formData.get("capacity"));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error("Total spots must be between 1 and 100.");
  const firstPrice = dollarsToCents(requiredText(formData, "firstPrice", 12));
  const secondPrice = dollarsToCents(requiredText(formData, "secondPrice", 12));
  if (!firstPrice || !secondPrice) throw new Error("Enter both package prices.");
  const supabase = await createClient();
  const slug = `${name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "class-program"}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: program, error: programError } = await supabase.from("sessions").insert({
    name, slug, description, starts_on: startsOn, ends_on: endsOn, capacity,
    new_member_price_cents: firstPrice, returning_member_price_cents: secondPrice,
    two_day_price_cents: format === "weekly" ? firstPrice : null,
    three_day_price_cents: format === "weekly" ? secondPrice : null,
    location_name: "Moore Performance Health", address_line: "41100 Plymouth Road, Suite B1-162",
    city: "Plymouth", state: "MI", status: "draft", published: false,
  }).select("id").single();
  if (programError || !program) throw new Error("The program could not be created. Please check the details and try again.");
  const meetings = dates.map(({ date, time }) => {
    const start = detroitDateTime(date, time);
    return { session_id: program.id, title: "Total-body conditioning", starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 60 * 60000).toISOString(), drop_in_enabled: false, drop_in_capacity: 0 };
  });
  const { error: meetingsError } = await supabase.from("class_meetings").insert(meetings);
  if (meetingsError) {
    await supabase.from("sessions").delete().eq("id", program.id);
    throw new Error("The class schedule could not be created. Please try again.");
  }
  revalidatePath("/admin/training");
  redirect(`/admin/settings?program=${program.id}&created=1`);
}

export async function createClassMeeting(formData: FormData) {
  await verifyAdmin();
  const startsAt = detroitDateTime(requiredText(formData, "date", 10), requiredText(formData, "time", 5));
  const durationMinutes = Number(formData.get("durationMinutes"));
  const capacity = Number(formData.get("dropInCapacity"));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) throw new Error("Class length must be between 15 minutes and 4 hours.");
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 50) throw new Error("Drop-in capacity must be between 0 and 50.");
  const supabase = await createClient();
  const title = requiredText(formData, "title", 140);
  const isZoom = formData.get("isZoom") === "on";
  const { data: createdMeeting, error } = await supabase.from("class_meetings").insert({
    session_id: uuidField(formData, "sessionId"),
    title,
    notes: textField(formData, "notes", 600) || null,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + durationMinutes * 60000).toISOString(),
    is_zoom: isZoom,
    drop_in_enabled: formData.get("dropInEnabled") === "on",
    drop_in_capacity: capacity,
  }).select("id").single();
  if (error || !createdMeeting) redirect("/admin/classes?message=create-failed");
  if (isZoom) {
    try {
      await ensureClassZoomMeeting(supabase, createdMeeting.id, title, startsAt.toISOString(), durationMinutes);
    } catch {
      await supabase.from("class_meetings").delete().eq("id", createdMeeting.id);
      redirect("/admin/classes?message=zoom-create-failed");
    }
  }
  revalidatePath("/admin/classes");
  revalidatePath("/drop-in");
  revalidateHub();
  redirect("/admin/classes?message=created");
}

export async function updateClassMeeting(formData: FormData) {
  await verifyAdmin();
  const meetingId = uuidField(formData, "meetingId");
  const startsAt = detroitDateTime(requiredText(formData, "date", 10), requiredText(formData, "time", 5));
  const durationMinutes = Number(formData.get("durationMinutes"));
  const capacity = Number(formData.get("dropInCapacity"));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) throw new Error("Class length must be between 15 minutes and 4 hours.");
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 50) throw new Error("Drop-in capacity must be between 0 and 50.");
  const supabase = await createClient();
  const { data: originalMeeting } = await supabase.from("class_meetings").select("id,session_id,starts_at").eq("id", meetingId).maybeSingle();
  if (!originalMeeting) redirect("/admin/classes?message=update-failed");
  const title = requiredText(formData, "title", 140);
  const isZoom = formData.get("isZoom") === "on";
  const { data, error } = await supabase.from("class_meetings").update({
    title,
    notes: textField(formData, "notes", 600) || null,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + durationMinutes * 60000).toISOString(),
    is_zoom: isZoom,
    cancelled: formData.get("cancelled") === "on",
    drop_in_enabled: formData.get("dropInEnabled") === "on",
    drop_in_capacity: capacity,
  }).eq("id", meetingId).select("id").maybeSingle();
  if (error || !data) redirect("/admin/classes?message=update-failed");
  if (isZoom) {
    try {
      await ensureClassZoomMeeting(supabase, meetingId, title, startsAt.toISOString(), durationMinutes);
    } catch {
      redirect(`/admin/classes?message=zoom-create-failed#class-${meetingId}`);
    }
  }
  if (formData.get("applyToSeries") === "on") {
    const weekday = detroitWeekday(originalMeeting.starts_at);
    const { data: futureMeetings, error: futureError } = await supabase.from("class_meetings").select("id,starts_at").eq("session_id", originalMeeting.session_id).gte("starts_at", new Date().toISOString());
    if (futureError) redirect(`/admin/classes?message=series-update-failed#class-${meetingId}`);
    const newTime = requiredText(formData, "time", 5);
    const seriesResults = await Promise.all((futureMeetings ?? []).filter((meeting) => meeting.id !== meetingId && detroitWeekday(meeting.starts_at) === weekday).map((meeting) => {
      const seriesStart = detroitDateTime(detroitDate(meeting.starts_at), newTime);
      return supabase.from("class_meetings").update({ starts_at: seriesStart.toISOString(), ends_at: new Date(seriesStart.getTime() + durationMinutes * 60000).toISOString() }).eq("id", meeting.id);
    }));
    if (seriesResults.some((result) => result.error)) redirect(`/admin/classes?message=series-update-failed#class-${meetingId}`);
  }
  revalidatePath("/admin/classes");
  revalidatePath("/drop-in");
  revalidateHub();
  redirect(`/admin/classes?message=${formData.get("applyToSeries") === "on" ? "series-updated" : "updated"}#class-${meetingId}`);
}

export async function submitDropInBooking(formData: FormData) {
  if (formData) redirect("/drop-in");
  if (textField(formData, "website", 200)) redirect("/drop-in?sent=1");
  const meetingId = uuidField(formData, "meetingId");
  const fullName = requiredText(formData, "fullName", 140);
  const email = requiredText(formData, "email", 254).toLowerCase();
  const phone = requiredText(formData, "phone", 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const client = publicAuthClient();
  const { data: meeting } = await client.from("class_meetings").select("id,title,starts_at").eq("id", meetingId).eq("drop_in_enabled", true).eq("cancelled", false).gt("starts_at", new Date().toISOString()).maybeSingle();
  if (!meeting) redirect("/drop-in?message=class-unavailable");
  const { error } = await client.from("drop_in_bookings").insert({
    meeting_id: meetingId,
    full_name: fullName,
    email,
    phone,
    note: textField(formData, "note", 1000) || null,
  });
  if (error) redirect(`/drop-in?message=${error.code === "23505" ? "already-requested" : "request-failed"}`);
  const classTime = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" }).format(new Date(meeting.starts_at));
  await Promise.all([
    sendTransactionalEmail("holdenhealth.coaching@gmail.com", `New drop-in request from ${fullName}`, {
      firstName: "Kelsey",
      preheader: `${fullName} requested a Holden Health drop-in class.`,
      heading: "You have a new drop-in request.",
      body: `${fullName} would like to attend ${meeting.title} on ${classTime}.\n\nEmail: ${email}\nPhone: ${phone}\n\nOpen the class dashboard to confirm or follow up.`,
      ctaLabel: "Review the request",
      ctaUrl: "https://portal.holden.health/admin/classes",
    }),
    sendTransactionalEmail(email, "Your Holden Health drop-in request is in", {
      firstName: fullName.split(/\s+/)[0],
      preheader: `Kelsey received your request for ${meeting.title}.`,
      heading: "We’d love to have you join us.",
      body: `Your request for ${meeting.title} on ${classTime} is with Kelsey. She’ll follow up personally to confirm your spot and share payment details.\n\nThanks for taking the first step. We look forward to moving with you.`,
      ctaLabel: "Questions? Talk with Kelsey",
      ctaUrl: "https://holden.health/book.html",
    }),
  ]);
  redirect("/drop-in?sent=1");
}

export async function updateDropInBookingStatus(formData: FormData) {
  const admin = await verifyAdmin();
  const bookingId = uuidField(formData, "bookingId");
  const status = textField(formData, "status", 20);
  if (!DROP_IN_STATUSES.has(status)) throw new Error("Invalid booking status.");
  const supabase = await createClient();
  const { data: booking } = await supabase.from("drop_in_bookings").select("id,meeting_id,full_name,email,zoom_link_sent_at").eq("id", bookingId).maybeSingle();
  if (!booking) redirect("/admin/classes?message=booking-update-failed");
  const { error } = await supabase.from("drop_in_bookings").update({ status, reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq("id", bookingId);
  if (error) redirect("/admin/classes?message=booking-update-failed");
  let emailFailed = false;
  if (status === "confirmed" && !booking.zoom_link_sent_at) {
    const [{ data: meeting }, { data: zoomMeeting }] = await Promise.all([
      supabase.from("class_meetings").select("title,starts_at,is_zoom").eq("id", booking.meeting_id).maybeSingle(),
      supabase.from("class_zoom_meetings").select("join_url").eq("meeting_id", booking.meeting_id).maybeSingle(),
    ]);
    if (meeting?.is_zoom && zoomMeeting?.join_url) {
      const sent = await sendTransactionalEmail(booking.email, `Your Zoom link for ${meeting.title}`, {
        firstName: booking.full_name.trim().split(/\s+/)[0] || "there",
        preheader: `Your spot and private Zoom link are confirmed.`,
        heading: "Your Zoom class is confirmed.",
        body: `Kelsey confirmed your spot for ${meeting.title} on ${classDateTimeLabel(meeting.starts_at)}. Everyone attending this class will use the same private Zoom link below.\n\nPlease keep the link private and join a few minutes early.`,
        ctaLabel: "Join Zoom class",
        ctaUrl: zoomMeeting.join_url,
      }, { idempotencyKey: `drop-in-zoom-${booking.id}` });
      if (sent) await supabase.from("drop_in_bookings").update({ zoom_link_sent_at: new Date().toISOString() }).eq("id", booking.id);
      else emailFailed = true;
    }
  }
  revalidatePath("/admin/classes");
  redirect(`/admin/classes?message=${emailFailed ? "booking-email-failed" : "booking-updated"}#bookings`);
}

export async function createConsultationSlot(formData: FormData) {
  const admin = await verifyAdmin();
  const availabilityMode = textField(formData, "availabilityMode", 20);
  if (availabilityMode !== "weekly-window") return publishSingleConsultationSlot(formData);
  const date = requiredText(formData, "date", 10);
  const slotStarts: Date[] = [];

  if (availabilityMode === "weekly-window") {
    const repeatUntil = textField(formData, "repeatUntil", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(repeatUntil)) redirect("/admin/consultations?message=repeat-end-required");
    const repeatDays = new Set(formData.getAll("repeatDays").map(String).filter((day) => /^[0-6]$/.test(day)).map(Number));
    if (!repeatDays.size) redirect("/admin/consultations?message=repeat-days-required");
    const startTime = requiredText(formData, "startTime", 5);
    const endTime = requiredText(formData, "endTime", 5);
    const timeToMinutes = (value: string) => {
      if (!/^\d{2}:\d{2}$/.test(value)) return Number.NaN;
      const [hours, minutes] = value.split(":").map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : Number.NaN;
    };
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes - startMinutes < 60) redirect("/admin/consultations?message=time-window-invalid");
    if (startMinutes % 30 !== 0 || endMinutes % 30 !== 0) redirect("/admin/consultations?message=time-increment-invalid");

    const cursor = new Date(`${date}T12:00:00Z`);
    const end = new Date(`${repeatUntil}T12:00:00Z`);
    if (end < cursor) redirect("/admin/consultations?message=repeat-end-before-start");
    while (cursor <= end) {
      if (repeatDays.has(cursor.getUTCDay())) {
        const slotDate = cursor.toISOString().slice(0, 10);
        for (let minutes = startMinutes; minutes + 60 <= endMinutes; minutes += 60) {
          const slotTime = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
          const slotStart = detroitDateTime(slotDate, slotTime);
          if (slotStart > new Date()) slotStarts.push(slotStart);
          if (slotStarts.length > 2000) redirect("/admin/consultations?message=too-many-slots");
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  if (!slotStarts.length) redirect("/admin/consultations?message=no-matching-days");
  const supabase = await createClient();
  const { error } = await supabase.from("consultation_slots").upsert(slotStarts.map((slotStart) => ({
    starts_at: slotStart.toISOString(),
    duration_minutes: 60,
    created_by: admin.userId,
    active: true,
  })), { onConflict: "starts_at", ignoreDuplicates: true });
  if (error) redirect("/admin/consultations?message=slot-create-failed");
  revalidatePath("/admin/consultations");
  redirect(`/admin/consultations?message=${availabilityMode === "weekly-window" ? "series-created" : "slot-created"}`);
}

export async function closeConsultationSlot(formData: FormData) {
  await verifyAdmin();
  const slotId = uuidField(formData, "slotId");
  const supabase = await createClient();
  const { data: booking } = await supabase.from("consultation_bookings").select("id").eq("slot_id", slotId).eq("status", "booked").maybeSingle();
  if (booking) redirect("/admin/consultations?message=slot-booked");
  const { error } = await supabase.from("consultation_slots").update({ active: false }).eq("id", slotId);
  if (error) redirect("/admin/consultations?message=slot-close-failed");
  revalidatePath("/admin/consultations");
  redirect("/admin/consultations?message=slot-closed");
}

export async function updateConsultationSlot(formData: FormData) {
  await verifyAdmin();
  const slotId = uuidField(formData, "slotId");
  const time = requiredText(formData, "time", 5);
  if (!/^\d{2}:(00|30)$/.test(time)) redirect("/admin/consultations?message=time-increment-invalid");
  const startsAt = detroitDateTime(requiredText(formData, "date", 10), time);
  if (startsAt <= new Date()) redirect("/admin/consultations?message=time-in-past");
  const supabase = await createClient();
  const { data: booking } = await supabase.from("consultation_bookings").select("id").eq("slot_id", slotId).eq("status", "booked").maybeSingle();
  if (booking) redirect("/admin/consultations?message=slot-booked");
  const { error } = await supabase.from("consultation_slots").update({ starts_at: startsAt.toISOString(), active: true }).eq("id", slotId);
  if (error) redirect(`/admin/consultations?message=${error.code === "23505" ? "time-exists" : "slot-update-failed"}`);
  revalidatePath("/admin/consultations");
  redirect("/admin/consultations?message=slot-updated");
}

export async function cancelConsultationBooking(formData: FormData) {
  await verifyAdmin();
  const bookingId = uuidField(formData, "bookingId");
  const supabase = await createClient();
  const { data: booking } = await supabase.from("consultation_bookings").select("id,email,full_name,slot_id,status").eq("id", bookingId).maybeSingle();
  if (!booking || booking.status !== "booked") redirect("/admin/consultations?message=booking-cancel-failed");
  const { data: slot } = await supabase.from("consultation_slots").select("starts_at").eq("id", booking.slot_id).maybeSingle();
  const { error } = await supabase.from("consultation_bookings").update({ status: "cancelled" }).eq("id", bookingId);
  if (error) redirect("/admin/consultations?message=booking-cancel-failed");
  if (slot) {
    await sendTransactionalEmail(booking.email, "Your Holden Health Zoom call was cancelled", {
      firstName: booking.full_name.trim().split(/\s+/)[0] || "there",
      preheader: "Your scheduled conversation with Kelsey was cancelled.",
      heading: "Your Zoom call was cancelled.",
      body: `Your free Zoom conversation scheduled for ${classDateTimeLabel(slot.starts_at)} has been cancelled. If you would like another time, return to the booking page or reply to this email and Kelsey will help.`,
      ctaLabel: "Choose another Zoom time",
      ctaUrl: "https://holden.health/book.html",
    }, { idempotencyKey: `consultation-cancel-${booking.id}` });
  }
  revalidatePath("/admin/consultations");
  redirect("/admin/consultations?message=booking-cancelled");
}

function announcementAudience(formData: FormData) {
  // Older open admin pages still submit sessionId; preserve their audience.
  if (!formData.has("audience")) return uuidField(formData, "sessionId");
  return formData.get("audience") === "all" ? null : uuidField(formData, "audience");
}

export async function createAnnouncement(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    session_id: announcementAudience(formData),
    title: requiredText(formData, "title", 140),
    body: requiredText(formData, "body", 1600),
    published_at: formData.get("published") === "on" ? new Date().toISOString() : null,
    created_by: admin.userId,
  });
  if (error) throw new Error("We could not create the announcement.");
  revalidateHub();
}

export async function updateAnnouncementAudience(formData: FormData) {
  await verifyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements")
    .update({ session_id: announcementAudience(formData) })
    .eq("id", uuidField(formData, "id")).select("id").single();
  if (error || !data) throw new Error("We could not update the announcement audience.");
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
  const fullName = requiredText(formData, "fullName", 120);
  const email = requiredText(formData, "email", 320).toLowerCase();
  const phone = textField(formData, "phone", 40);
  const enrollmentStatus = textField(formData, "enrollmentStatus", 20);
  const paymentStatus = textField(formData, "paymentStatus", 20);
  const paymentMethod = textField(formData, "paymentMethod", 20);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid member email address.");
  if (!ENROLLMENT_STATUSES.has(enrollmentStatus) || !PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Invalid member status.");
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) throw new Error("Invalid payment method.");
  const supabase = await createClient();
  const { data: enrollment } = await supabase.from("enrollments").select("id,member_id").eq("id", enrollmentId).maybeSingle();
  if (!enrollment) redirect(`/admin/members/${enrollmentId}?message=enrollment-save-failed`);

  const { data: currentContact } = await supabase.from("member_contacts").select("email").eq("user_id", enrollment.member_id).maybeSingle();
  if (currentContact?.email !== email) {
    const serviceClient = createAdminClient();
    const { error: emailError } = await serviceClient.auth.admin.updateUserById(enrollment.member_id, {
      email,
      email_confirm: true,
    });
    if (emailError) redirect(`/admin/members/${enrollmentId}?message=email-save-failed`);
  }

  const { data: updatedProfile, error: profileError } = await supabase.from("profiles").update({
    full_name: fullName,
    phone: phone || null,
  }).eq("id", enrollment.member_id).select("id").maybeSingle();
  if (profileError || !updatedProfile) redirect(`/admin/members/${enrollmentId}?message=profile-save-failed`);

  const { data: updatedEnrollment, error: enrollmentError } = await supabase.from("enrollments").update({
    status: enrollmentStatus,
    weekly_commitment: weeklyCommitmentField(formData, true, true),
    returning_member: formData.get("returningMember") === "on",
  }).eq("id", enrollmentId).select("id").maybeSingle();
  if (enrollmentError || !updatedEnrollment) redirect(`/admin/members/${enrollmentId}?message=enrollment-save-failed`);
  const { data: updatedPayment, error: paymentError } = await supabase.from("payment_records").upsert({
    enrollment_id: enrollmentId,
    status: paymentStatus,
    method: paymentMethod || null,
    amount_cents: dollarsToCents(requiredText(formData, "amount", 12)),
    received_on: paymentStatus === "paid" ? (textField(formData, "receivedOn", 10) || new Date().toISOString().slice(0, 10)) : null,
    internal_note: textField(formData, "internalNote", 500) || null,
    recorded_by: admin.userId,
  }, { onConflict: "enrollment_id" }).select("enrollment_id").maybeSingle();
  if (paymentError || !updatedPayment) redirect(`/admin/members/${enrollmentId}?message=payment-save-failed`);
  await supabase.from("audit_events").insert({
    actor_id: admin.userId,
    action: "member_record_updated",
    entity_type: "enrollment",
    entity_id: enrollmentId,
    details: { member_id: enrollment.member_id, enrollment_status: enrollmentStatus, payment_status: paymentStatus },
  });
  revalidateHub();
  revalidatePath(`/admin/members/${enrollmentId}`);
  redirect(`/admin/members/${enrollmentId}?message=saved`);
}

export async function refundOnlinePayment(formData: FormData) {
  const admin = await verifyAdmin();
  const enrollmentId = uuidField(formData, "enrollmentId");
  if (formData.get("confirmRefund") !== "on") {
    redirect(`/admin/members/${enrollmentId}?message=refund-confirmation-required`);
  }

  const serviceClient = createAdminClient();
  const { data: enrollment } = await serviceClient
    .from("enrollments")
    .select("id,member_id,session_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment) redirect(`/admin/members/${enrollmentId}?message=refund-unavailable`);

  const { data: invitation } = await serviceClient
    .from("member_invitations")
    .select("id")
    .eq("session_id", enrollment.session_id)
    .eq("claimed_by", enrollment.member_id)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invitation) redirect(`/admin/members/${enrollmentId}?message=refund-unavailable`);

  const { data: order } = await serviceClient
    .from("checkout_orders")
    .select("id,email,full_name,amount_cents,status,stripe_payment_intent_id,stripe_refund_id")
    .eq("member_invitation_id", invitation.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order?.stripe_payment_intent_id) redirect(`/admin/members/${enrollmentId}?message=refund-unavailable`);
  if (order.stripe_refund_id) redirect(`/admin/members/${enrollmentId}?message=refund-already-requested`);

  let refund;
  try {
    refund = await getStripe().refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      metadata: {
        checkout_order_id: order.id,
        enrollment_id: enrollmentId,
        requested_by_admin: admin.userId,
      },
    }, { idempotencyKey: `checkout-order-${order.id}-full-refund-v1` });
  } catch {
    redirect(`/admin/members/${enrollmentId}?message=refund-failed`);
  }

  const refundStatus = refund.status ?? "pending";
  const requestedAt = new Date().toISOString();
  const { error: orderError } = await serviceClient.from("checkout_orders").update({
    stripe_refund_id: refund.id,
    refund_status: refundStatus,
    refund_amount_cents: refund.amount,
    refund_requested_at: requestedAt,
    refund_requested_by: admin.userId,
    refunded_at: refundStatus === "succeeded" ? requestedAt : null,
  }).eq("id", order.id);
  if (orderError) redirect(`/admin/members/${enrollmentId}?message=refund-recording-failed`);

  const { error: paymentError } = await serviceClient.from("payment_records").update({
    status: "refunded",
    recorded_by: admin.userId,
  }).eq("enrollment_id", enrollmentId);
  if (paymentError) redirect(`/admin/members/${enrollmentId}?message=refund-recording-failed`);
  await serviceClient.from("audit_events").insert({
    actor_id: admin.userId,
    action: "online_payment_refund_requested",
    entity_type: "checkout_order",
    entity_id: order.id,
    details: { stripe_refund_id: refund.id, refund_status: refundStatus, amount_cents: refund.amount },
  });

  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(refund.amount / 100);
  const emailSent = await sendTransactionalEmail(
    order.email,
    `Your ${amount} Holden Health refund is on its way`,
    {
      firstName: order.full_name.trim().split(/\s+/)[0] || "there",
      preheader: `Your ${amount} refund has been submitted to your bank.`,
      heading: "Your refund is on its way.",
      body: `We submitted a full ${amount} refund to the bank account you used for your Holden Health payment. Your bank's processing time determines when it appears in your account.\n\nYou don't need to do anything else. If you have any questions, reply to this email and Kelsey will be happy to help.`,
    },
    { idempotencyKey: `checkout-refund-${refund.id}` },
  );
  if (emailSent) {
    await serviceClient.from("checkout_orders").update({ refund_email_sent_at: requestedAt }).eq("id", order.id);
  }

  revalidateHub();
  revalidatePath(`/admin/members/${enrollmentId}`);
  redirect(`/admin/members/${enrollmentId}?message=${emailSent ? "refund-requested" : "refund-requested-email-failed"}`);
}

export async function reviewMemberIntake(formData: FormData) {
  const admin = await verifyAdmin();
  const enrollmentId = uuidField(formData, "enrollmentId");
  const supabase = await createClient();
  const [{ data: intake, error: intakeLookupError }, { data: payment }, { data: enrollment }, { data: agreement }] = await Promise.all([
    supabase.from("member_intakes").select("enrollment_id,member_id,reviewed_at").eq("enrollment_id", enrollmentId).maybeSingle(),
    supabase.from("payment_records").select("status").eq("enrollment_id", enrollmentId).maybeSingle(),
    supabase.from("enrollments").select("risk_agreement_required").eq("id", enrollmentId).maybeSingle(),
    supabase.from("risk_agreements").select("id").eq("enrollment_id", enrollmentId).maybeSingle(),
  ]);
  if (intakeLookupError) redirect(`/admin/members/${enrollmentId}?message=intake-review-failed`);
  if (!intake) redirect(`/admin/members/${enrollmentId}?message=intake-missing`);
  if (enrollment?.risk_agreement_required && !agreement) redirect(`/admin/members/${enrollmentId}?message=agreement-required`);
  if (payment?.status !== "paid" && payment?.status !== "waived" && payment?.status !== "credited") {
    redirect(`/admin/members/${enrollmentId}?message=payment-required`);
  }
  const isFirstReview = !intake.reviewed_at;
  const reviewedAt = intake.reviewed_at ?? new Date().toISOString();
  const { error: intakeError } = await supabase.from("member_intakes").update({
    reviewed_at: reviewedAt,
    reviewed_by: admin.userId,
  }).eq("enrollment_id", intake.enrollment_id);
  if (intakeError) redirect(`/admin/members/${enrollmentId}?message=intake-review-failed`);
  const { error: enrollmentError } = await supabase.from("enrollments").update({ status: "active" }).eq("id", enrollmentId);
  if (enrollmentError) redirect(`/admin/members/${enrollmentId}?message=enrollment-save-failed`);
  let approvalEmailSent = true;
  if (isFirstReview) {
    const [{ data: profile }, { data: contact }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", intake.member_id).maybeSingle(),
      supabase.from("member_contacts").select("email").eq("user_id", intake.member_id).maybeSingle(),
    ]);
    approvalEmailSent = Boolean(contact?.email) && await sendTransactionalEmail(
      contact!.email,
      "Your Holden Health intake is approved",
      {
        firstName: profile?.full_name?.trim().split(/\s+/)[0] || "there",
        preheader: "Your intake review is complete and your enrollment is active.",
        heading: "You are ready to get started.",
        body: "Kelsey reviewed your confidential intake, and your Holden Health enrollment is now active.\n\nYou can sign in to your member portal anytime to view your schedule and program details. Kelsey is excited to work with you.",
        ctaLabel: "Open my member portal",
        ctaUrl: "https://portal.holden.health/portal",
      },
      { idempotencyKey: `intake-approved-member-${enrollmentId}` },
    );
  }
  revalidateHub();
  revalidatePath(`/admin/members/${enrollmentId}`);
  redirect(`/admin/members/${enrollmentId}?message=${approvalEmailSent ? "intake-reviewed" : "intake-reviewed-email-failed"}`);
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

function websiteLink(formData: FormData, name: string) {
  const value = requiredText(formData, name, 700);
  if (/^(?:https:\/\/|\/|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(value)) return value;
  throw new Error("Website links must be a full HTTPS URL or a page such as coaching.html.");
}

export async function updateWebsiteContent(formData: FormData) {
  const admin = await verifyAdmin();
  const supabase = await createClient();
  const { data: settingsRecord } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const { getWebsitePage, normalizeWebsiteSettings, websitePagesForSettings } = await import("@/lib/website-pages");
  const page = getWebsitePage(String(formData.get("pageKey") ?? ""), websitePagesForSettings(normalizeWebsiteSettings(settingsRecord?.value)));
  if (!page) redirect("/admin/website?message=publish-failed");
  const value: Record<string, string> = Object.fromEntries(page.sections.flatMap((section) => section.fields).map((field) => [
    field.key,
    field.kind === "link" ? websiteLink(formData, field.key) : requiredText(formData, field.key, field.maxLength),
  ]));
  if (page.key === "homepage" || page.key === "coaching") {
    const { data: previous } = await supabase.from("site_content").select("value").eq("content_key", `website:${page.key}`).maybeSingle();
    const saved = previous?.value as Record<string, unknown> | null;
    for (const key of ["mini_eyebrow", "mini_heading", "mini_body", "mini_cta_label", "mini_cta_url"]) {
      if (typeof saved?.[key] === "string") value[key] = saved[key] as string;
    }
  }
  try {
    const overrides = JSON.parse(textField(formData, "visual_overrides", 500_000));
    if (!Array.isArray(overrides) || overrides.length > 1000) throw new Error("Invalid visual changes.");
    value.visual_overrides = JSON.stringify(overrides.map((item) => {
      if (!item || typeof item !== "object" || typeof item.selector !== "string" || item.selector.length > 500) throw new Error("Invalid visual change.");
      const clean: Record<string, string | boolean> = { selector: item.selector };
      for (const key of ["text", "href", "src", "alt", "placeholder", "font", "size", "color", "align"] as const) {
        if (typeof item[key] === "string") clean[key] = item[key].trim().slice(0, key === "text" ? 3000 : 1000);
      }
      if (clean.font && !["site", "display", "clean"].includes(String(clean.font))) throw new Error("Invalid font choice.");
      if (clean.size && !["small", "regular", "large"].includes(String(clean.size))) throw new Error("Invalid size choice.");
      if (clean.color && !["default", "purple", "aqua"].includes(String(clean.color))) throw new Error("Invalid color choice.");
      if (clean.align && !["left", "center"].includes(String(clean.align))) throw new Error("Invalid alignment choice.");
      if (item.bold === true) clean.bold = true;
      if (item.italic === true) clean.italic = true;
      if (item.hidden === true) clean.hidden = true;
      if (clean.href && !/^(?:https:\/\/|mailto:|tel:|\/|#|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(String(clean.href))) throw new Error("Invalid visual link.");
      if (clean.src && !/^(?:https:\/\/|\/|assets\/)/i.test(String(clean.src))) throw new Error("Invalid image location.");
      return clean;
    }));
  } catch {
    redirect(`/admin/website?page=${page.key}&message=publish-failed`);
  }
  try {
    const sections = JSON.parse(textField(formData, "custom_sections", 100_000));
    const templates = new Set(["text-photo", "announcement", "testimonial", "faq", "call-to-action"]);
    const themes = new Set(["light", "lavender", "dark"]);
    if (!Array.isArray(sections) || sections.length > 20) throw new Error("Invalid custom sections.");
    value.custom_sections = JSON.stringify(sections.map((item) => {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^section-[a-z0-9-]{6,80}$/i.test(item.id) || !templates.has(item.template) || !themes.has(item.theme)) throw new Error("Invalid custom section.");
      const clean: Record<string, unknown> = { id: item.id, template: item.template, theme: item.theme };
      for (const [key, limit] of [["eyebrow", 100], ["heading", 240], ["body", 1200], ["buttonLabel", 80], ["buttonUrl", 700], ["imageSrc", 1000], ["imageAlt", 300], ["attribution", 140]] as const) {
        if (typeof item[key] === "string") clean[key] = item[key].trim().slice(0, limit);
      }
      if (clean.buttonUrl && !/^(?:https:\/\/|mailto:|tel:|\/|#|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(String(clean.buttonUrl))) throw new Error("Invalid section link.");
      if (clean.imageSrc && !/^(?:https:\/\/|\/|assets\/)/i.test(String(clean.imageSrc))) throw new Error("Invalid section image.");
      if (item.hidden === true) clean.hidden = true;
      if (item.template === "faq") {
        if (!Array.isArray(item.items) || item.items.length < 1 || item.items.length > 12) throw new Error("Invalid questions.");
        clean.items = item.items.map((entry: unknown) => {
          if (!entry || typeof entry !== "object") throw new Error("Invalid question.");
          const faq = entry as Record<string, unknown>;
          return { question: String(faq.question ?? "").trim().slice(0, 240), answer: String(faq.answer ?? "").trim().slice(0, 800) };
        });
      }
      return clean;
    }));
  } catch {
    redirect(`/admin/website?page=${page.key}&message=publish-failed`);
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("site_content").upsert({
    content_key: `website:${page.key}`,
    value,
    published: true,
    published_at: now,
    updated_by: admin.userId,
  }, { onConflict: "content_key" }).select("content_key").maybeSingle();
  if (error || !data) redirect(`/admin/website?page=${page.key}&message=publish-failed`);
  revalidatePath("/admin/website");
  redirect(`/admin/website?page=${page.key}&message=published`);
}

export async function updateDropInVisibility(formData: FormData) {
  const admin = await verifyAdmin();
  const visible = formData.get("visible") === "true";
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: current } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const { normalizeWebsiteSettings } = await import("@/lib/website-pages");
  const settings = normalizeWebsiteSettings(current?.value);
  const { error } = await supabase.from("site_content").upsert({
    content_key: "website:settings",
    value: { ...settings, drop_in_visible: visible },
    published: true,
    published_at: now,
    updated_by: admin.userId,
  }, { onConflict: "content_key" });
  if (error) redirect("/admin/website?message=drop-in-update-failed");
  revalidatePath("/admin/website");
  redirect(`/admin/website?message=${visible ? "drop-in-shown" : "drop-in-hidden"}`);
}

export async function updateFeaturedProgram(formData: FormData) {
  const admin = await verifyAdmin();
  const sessionId = uuidField(formData, "sessionId");
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id,published,status,starts_on").eq("id", sessionId).maybeSingle();
  if (!session || !session.published || session.status !== "enrolling" || session.starts_on <= detroitDate(new Date().toISOString())) {
    redirect("/admin/website?message=feature-unavailable");
  }
  const { data: current } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const { normalizeWebsiteSettings } = await import("@/lib/website-pages");
  const settings = normalizeWebsiteSettings(current?.value);
  const { error } = await supabase.from("site_content").upsert({
    content_key: "website:settings", published: true, published_at: new Date().toISOString(), updated_by: admin.userId,
    value: { ...settings, featured_session_id: sessionId,
      featured_headline: requiredText(formData, "headline", 220),
      featured_body: requiredText(formData, "body", 700),
      featured_button: requiredText(formData, "button", 80) },
  }, { onConflict: "content_key" });
  if (error) redirect("/admin/website?message=feature-failed");
  revalidatePath("/admin/website");
  redirect("/admin/website?message=feature-published");
}

export async function reorderWebsitePage(formData: FormData) {
  const admin = await verifyAdmin();
  const pageKey = textField(formData, "pageKey", 100);
  const direction = textField(formData, "direction", 10);
  if (!pageKey || !["up", "down"].includes(direction)) redirect("/admin/website?message=page-reorder-failed");

  const supabase = await createClient();
  const { data: current } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const { normalizeWebsiteSettings, websitePagesForSettings } = await import("@/lib/website-pages");
  const settings = normalizeWebsiteSettings(current?.value);
  const orderedKeys = websitePagesForSettings(settings).map((page) => page.key);
  const index = orderedKeys.indexOf(pageKey);
  const destination = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || destination < 0 || destination >= orderedKeys.length) redirect(`/admin/website?page=${encodeURIComponent(pageKey)}`);
  [orderedKeys[index], orderedKeys[destination]] = [orderedKeys[destination], orderedKeys[index]];

  const now = new Date().toISOString();
  const { error } = await supabase.from("site_content").upsert({
    content_key: "website:settings",
    value: { ...settings, page_order: orderedKeys },
    published: true,
    published_at: now,
    updated_by: admin.userId,
  }, { onConflict: "content_key" });
  if (error) redirect(`/admin/website?page=${encodeURIComponent(pageKey)}&message=page-reorder-failed`);
  revalidatePath("/admin/website");
  redirect(`/admin/website?page=${encodeURIComponent(pageKey)}&message=page-reordered`);
}

export async function createWebsitePage(formData: FormData) {
  const admin = await verifyAdmin();
  const pageName = requiredText(formData, "pageName", 80);
  const slug = textField(formData, "pageSlug", 63).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) redirect("/admin/website?message=page-create-failed");

  const supabase = await createClient();
  const { data: current } = await supabase.from("site_content").select("value").eq("content_key", "website:settings").maybeSingle();
  const { customWebsitePage, normalizeWebsiteSettings, websitePages } = await import("@/lib/website-pages");
  const settings = normalizeWebsiteSettings(current?.value);
  const key = `custom:${slug}`;
  const slugTaken = settings.custom_pages.some((page) => page.slug === slug || page.key === key)
    || websitePages.some((page) => page.pathname === `/pages/${slug}` || page.pathname === `/${slug}.html`);
  if (slugTaken) redirect("/admin/website?message=page-create-failed");

  const customPage = { key, label: pageName, slug };
  const page = customWebsitePage(customPage);
  const now = new Date().toISOString();
  const { error: pageError } = await supabase.from("site_content").upsert({
    content_key: `website:${key}`,
    value: { visual_overrides: "[]", custom_sections: "[]", ...page.defaults },
    published: true,
    published_at: now,
    updated_by: admin.userId,
  }, { onConflict: "content_key" });
  if (pageError) redirect("/admin/website?message=page-create-failed");

  const { error: settingsError } = await supabase.from("site_content").upsert({
    content_key: "website:settings",
    value: { ...settings, custom_pages: [...settings.custom_pages, customPage], page_order: [...settings.page_order, key] },
    published: true,
    published_at: now,
    updated_by: admin.userId,
  }, { onConflict: "content_key" });
  if (settingsError) redirect("/admin/website?message=page-create-failed");
  revalidatePath("/admin/website");
  redirect(`/admin/website?page=${encodeURIComponent(key)}&message=page-created`);
}
