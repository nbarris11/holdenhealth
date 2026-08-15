"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { renderHoldenHealthEmail, renderHoldenHealthText } from "@/lib/communication-email";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set(["newsletter", "session_update", "reminder"]);
const AUDIENCES = new Set(["all_active", "two_day", "three_day"]);

function field(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function completeUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!new Set(["https:", "http:"]).has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type EnrollmentRow = { member_id: string; weekly_commitment: number | null; profiles: { full_name: string } | { full_name: string }[] | null };
type ContactRow = { user_id: string; email: string; unsubscribe_token: string };

export async function sendMemberCommunication(formData: FormData) {
  const admin = await verifyAdmin();
  const sessionId = field(formData, "sessionId", 40);
  const kind = field(formData, "kind", 30);
  const audience = field(formData, "audience", 30);
  const subject = field(formData, "subject", 140);
  const preheader = field(formData, "preheader", 180);
  const heading = field(formData, "heading", 180);
  const body = field(formData, "body", 6000);
  const ctaLabel = field(formData, "ctaLabel", 80) || null;
  const ctaUrlInput = field(formData, "ctaUrl", 700);
  const ctaUrl = completeUrl(ctaUrlInput);
  const intent = field(formData, "intent", 20);

  if (!UUID_PATTERN.test(sessionId) || !KINDS.has(kind) || !AUDIENCES.has(audience) || !subject || !heading || !body) {
    redirect("/admin/communications?message=missing-fields");
  }
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrlInput)) redirect("/admin/communications?message=invalid-button");
  if (!process.env.RESEND_API_KEY) redirect("/admin/communications?message=email-not-configured");

  if (intent === "test") {
    const previewResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `communication-preview-${crypto.randomUUID()}` },
      body: JSON.stringify({
        from: "Kelsey at Holden Health <members@mail.holden.health>",
        to: [admin.email],
        reply_to: "holdenhealth.coaching@gmail.com",
        subject: `[Preview] ${subject}`,
        html: renderHoldenHealthEmail({ firstName: "Kelsey", preheader, heading, body, ctaLabel, ctaUrl, isPreview: true }),
        text: renderHoldenHealthText({ firstName: "Kelsey", preheader, heading, body, ctaLabel, ctaUrl, isPreview: true }),
      }),
    });
    redirect(`/admin/communications?message=${previewResponse.ok ? "preview-sent" : "preview-failed"}`);
  }

  if (formData.get("confirmed") !== "on") redirect("/admin/communications?message=confirm-send");
  const supabase = await createClient();
  let enrollmentQuery = supabase.from("enrollments").select("member_id,weekly_commitment,profiles(full_name)").eq("session_id", sessionId).eq("status", "active");
  if (audience === "two_day") enrollmentQuery = enrollmentQuery.eq("weekly_commitment", 2);
  if (audience === "three_day") enrollmentQuery = enrollmentQuery.eq("weekly_commitment", 3);
  const { data: enrollmentData, error: enrollmentError } = await enrollmentQuery;
  if (enrollmentError) redirect("/admin/communications?message=recipient-error");

  const enrollments = (enrollmentData ?? []) as unknown as EnrollmentRow[];
  const memberIds = enrollments.map((row) => row.member_id);
  if (!memberIds.length) redirect("/admin/communications?message=no-recipients");
  const { data: contactData, error: contactError } = await supabase.from("member_contacts").select("user_id,email,unsubscribe_token").in("user_id", memberIds).eq("email_opt_in", true);
  if (contactError) redirect("/admin/communications?message=recipient-error");

  const contacts = new Map(((contactData ?? []) as ContactRow[]).map((contact) => [contact.user_id, contact]));
  const recipients = enrollments.flatMap((enrollment) => {
    const contact = contacts.get(enrollment.member_id);
    if (!contact) return [];
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    return [{ ...contact, firstName: profile?.full_name?.trim().split(/\s+/)[0] || "there" }];
  });
  if (!recipients.length) redirect("/admin/communications?message=no-recipients");

  const { data: campaign, error: campaignError } = await supabase.from("communication_campaigns").insert({
    session_id: sessionId, kind, audience, subject, preheader, heading, body, cta_label: ctaLabel, cta_url: ctaUrl,
    recipient_count: recipients.length, created_by: admin.userId,
  }).select("id").single();
  if (campaignError || !campaign) redirect("/admin/communications?message=save-failed");

  const emails = recipients.map((recipient) => ({
    from: "Kelsey at Holden Health <members@mail.holden.health>",
    to: [recipient.email],
    reply_to: "holdenhealth.coaching@gmail.com",
    subject,
    html: renderHoldenHealthEmail({ firstName: recipient.firstName, preheader, heading, body, ctaLabel, ctaUrl, unsubscribeToken: recipient.unsubscribe_token }),
    text: renderHoldenHealthText({ firstName: recipient.firstName, preheader, heading, body, ctaLabel, ctaUrl, unsubscribeToken: recipient.unsubscribe_token }),
    tags: [{ name: "campaign_id", value: campaign.id }],
  }));

  const batchResponse = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `holden-campaign-${campaign.id}` },
    body: JSON.stringify(emails),
  });
  const responseData = await batchResponse.json().catch(() => ({})) as { data?: { id: string }[]; message?: string };
  const sentCount = batchResponse.ok ? recipients.length : 0;
  const failedCount = recipients.length - sentCount;
  const deliveries = recipients.map((recipient, index) => ({
    campaign_id: campaign.id,
    member_id: recipient.user_id,
    email: recipient.email,
    status: batchResponse.ok ? "sent" : "failed",
    provider_id: responseData.data?.[index]?.id ?? null,
    error_message: batchResponse.ok ? null : String(responseData.message ?? "Email provider rejected the batch").slice(0, 500),
    sent_at: batchResponse.ok ? new Date().toISOString() : null,
  }));
  await supabase.from("communication_deliveries").insert(deliveries);
  await supabase.from("communication_campaigns").update({
    status: batchResponse.ok ? "sent" : "failed", sent_count: sentCount, failed_count: failedCount, sent_at: new Date().toISOString(),
  }).eq("id", campaign.id);

  revalidatePath("/admin/communications");
  redirect(`/admin/communications?message=${batchResponse.ok ? "sent" : "send-failed"}`);
}
