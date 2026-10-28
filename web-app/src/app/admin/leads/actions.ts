"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { manualConsultationTime } from "@/lib/manual-consultation";
import { leadConversationCalendarInvite } from "@/lib/consultation-calendar";
import { sendTransactionalEmail } from "@/lib/email";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Lead = { id: string; full_name: string; email: string; starts_at: string; duration_minutes: number; meeting_type: "phone" | "in_person"; meeting_details: string; confirmation_sent_at: string | null };

function finish(message: string): never {
  revalidatePath("/admin/leads");
  redirect(`/admin/leads?message=${message}`);
}

async function sendConfirmation(lead: Lead) {
  if (lead.confirmation_sent_at || new Date(lead.starts_at) <= new Date()) return false;
  const supabase = await createClient();
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Detroit", timeZoneName: "short",
  }).format(new Date(lead.starts_at));
  const format = lead.meeting_type === "phone" ? "phone call" : "in-person conversation";
  let sent = false;
  try { sent = await sendTransactionalEmail(lead.email, `Confirming our conversation on ${when}`, {
    firstName: lead.full_name.split(/\s+/)[0],
    preheader: `Your conversation with Kelsey is set for ${when}.`,
    heading: "Our conversation is on the calendar.",
    body: `It was great connecting with you. I'm looking forward to our ${format} on ${when}. We'll plan on ${lead.duration_minutes} minutes.\n\n${lead.meeting_details}\n\nI've attached a calendar reminder. If anything changes, just reply to this email.`,
  }, {
    idempotencyKey: `lead-confirmation-${lead.id}`,
    attachments: [leadConversationCalendarInvite(lead.id, lead.starts_at, lead.duration_minutes, lead.meeting_type, lead.meeting_details)],
  }); } catch { return false; }
  if (!sent) return false;
  const { error } = await supabase.from("lead_appointments")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", lead.id).is("confirmation_sent_at", null);
  return !error;
}

export async function createLeadAndSend(form: FormData) {
  const admin = await verifyAdmin();
  const id = String(form.get("leadId") ?? "");
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const startsAt = manualConsultationTime(String(form.get("date") ?? ""), String(form.get("time") ?? ""));
  const duration = Number(form.get("duration"));
  const meetingType = String(form.get("meetingType") ?? "");
  const details = String(form.get("details") ?? "").trim();
  const source = String(form.get("source") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!uuid.test(id) || fullName.length < 2 || fullName.length > 140 || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length > 40 ||
    !startsAt || startsAt <= new Date() || ![15, 30, 45, 60].includes(duration) ||
    !["phone", "in_person"].includes(meetingType) || details.length < 3 || details.length > 300 ||
    !["instagram", "website", "referral", "other"].includes(source) || note.length > 1000 ||
    form.get("reviewed") !== "on") finish("invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_appointments").insert({
    id, full_name: fullName, email, phone: phone || null, starts_at: startsAt.toISOString(),
    duration_minutes: duration, meeting_type: meetingType, meeting_details: details,
    source, note: note || null, created_by: admin.userId,
  }).select("id,full_name,email,starts_at,duration_minutes,meeting_type,meeting_details,confirmation_sent_at").single();
  if (error || !data) finish(error?.code === "23505" ? "duplicate" : "save-failed");
  const sent = await sendConfirmation(data as Lead);
  finish(sent ? "sent" : "send-failed");
}

export async function retryLeadConfirmation(form: FormData) {
  await verifyAdmin();
  const id = String(form.get("leadId") ?? "");
  if (!uuid.test(id)) finish("invalid");
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_appointments")
    .select("id,full_name,email,starts_at,duration_minutes,meeting_type,meeting_details,confirmation_sent_at")
    .eq("id", id).single();
  if (error || !data || data.confirmation_sent_at) finish("invalid");
  const sent = await sendConfirmation(data as Lead);
  finish(sent ? "sent" : "send-failed");
}
