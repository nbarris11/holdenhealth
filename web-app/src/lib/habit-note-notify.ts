import "server-only";
import webPush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { validPushSubscription } from "./chat";
import { sendTransactionalEmail } from "./email";
import { shouldEmailHabitNote } from "./habit-comments";

// Tells a member that Kelsey left a note on their habits: a phone notification on every
// device they enabled in Messages, plus one email per 12 hours. Content stays generic so
// nothing personal shows on a lock screen or in an inbox preview. Best effort: failures
// never affect the saved comment.
export async function notifyMemberOfHabitNote(commentId: string) {
  const db = createAdminClient();
  const { data: comment } = await db.from("habit_comments").select("id,week_id,author_id,created_at").eq("id", commentId).maybeSingle();
  if (!comment) return;
  const { data: week } = await db.from("class_habit_weeks").select("enrollment_id,relationship_id").eq("id", comment.week_id).maybeSingle();
  if (!week) return;
  const owner = week.relationship_id
    ? await db.from("coaching_relationships").select("member_id").eq("id", week.relationship_id).maybeSingle()
    : await db.from("enrollments").select("member_id").eq("id", week.enrollment_id).maybeSingle();
  const memberId = owner.data?.member_id as string | undefined;
  if (!memberId || memberId === comment.author_id) return;

  const publicKey = process.env.CHAT_VAPID_PUBLIC_KEY, privateKey = process.env.CHAT_VAPID_PRIVATE_KEY;
  const { data: devices } = await db.from("chat_push_subscriptions").select("endpoint,subscription").eq("user_id", memberId);
  if (publicKey && privateKey) await Promise.all((devices ?? []).map(async device => {
    if (!validPushSubscription(device.subscription)) return;
    try {
      await webPush.sendNotification(device.subscription, JSON.stringify({
        title: "Holden Health", body: "Kelsey left you a note on your habits.", tag: "habit-note", url: "/portal/habits",
      }), { TTL: 3600, timeout: 5000, vapidDetails: { subject: "mailto:HoldenHealth.Coaching@gmail.com", publicKey, privateKey } });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("chat_push_subscriptions").delete().eq("endpoint", device.endpoint);
    }
  }));

  // Notes on any of this member's weeks count toward the 12-hour email limit.
  const [contact, profile, enrollments, relationships] = await Promise.all([
    db.from("member_contacts").select("email,email_opt_in,unsubscribed_at,is_test").eq("user_id", memberId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", memberId).maybeSingle(),
    db.from("enrollments").select("id").eq("member_id", memberId),
    db.from("coaching_relationships").select("id").eq("member_id", memberId),
  ]);
  const owners = [...(enrollments.data ?? []).map(e => `enrollment_id.eq.${e.id}`), ...(relationships.data ?? []).map(r => `relationship_id.eq.${r.id}`)];
  const { data: weeks } = owners.length ? await db.from("class_habit_weeks").select("id").or(owners.join(",")) : { data: [] };
  const memberWeeks = (weeks ?? []).map(w => w.id);
  const { data: earlier } = memberWeeks.length ? await db.from("habit_comments").select("created_at").in("week_id", memberWeeks)
    .neq("author_id", memberId).neq("id", comment.id).lt("created_at", comment.created_at).order("created_at", { ascending: false }).limit(1) : { data: [] };
  if (!contact.data?.email || !shouldEmailHabitNote({
    authorIsMember: false,
    optedIn: contact.data.email_opt_in !== false && !contact.data.unsubscribed_at,
    isTest: Boolean(contact.data.is_test),
    previousNoteAt: earlier?.[0]?.created_at ?? null,
    now: Date.parse(comment.created_at),
  })) return;
  await sendTransactionalEmail(contact.data.email, "Kelsey left you a note", {
    firstName: (profile.data?.full_name ?? "").split(" ")[0] || "there",
    preheader: "Open your Holden Health portal to read it and reply.",
    heading: "Kelsey left you a note",
    body: "Kelsey commented on one of your habits. Open your portal to read her note and reply.",
    ctaLabel: "Read Kelsey’s note",
    ctaUrl: "https://portal.holden.health/portal/habits",
  }, { idempotencyKey: `habit-note-${comment.id}` });
}
