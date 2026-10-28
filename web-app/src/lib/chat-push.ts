import "server-only";
import webPush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { validPushSubscription } from "./chat";
// Durable jobs are drained after sends and inbox visits. Failed deliveries retry
// on subsequent activity, with a five-minute delay and at most five attempts.
export async function deliverChatPush() {
  const publicKey = process.env.CHAT_VAPID_PUBLIC_KEY,
    privateKey = process.env.CHAT_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  const db = createAdminClient();
  const { data: jobs } = await db
    .from("chat_push_jobs")
    .select("*")
    .lt("attempts", 5)
    .lte("available_at", new Date().toISOString())
    .order("message_id")
    .limit(10);
  for (const job of jobs ?? []) {
    const { data: claimed } = await db
      .from("chat_push_jobs")
      .update({
        attempts: job.attempts + 1,
        available_at: new Date(Date.now() + 300000).toISOString(),
      })
      .eq("message_id", job.message_id)
      .eq("attempts", job.attempts)
      .eq("available_at", job.available_at)
      .select("message_id");
    if (!claimed?.length) continue;
    const { data: message, error: messageError } = await db
      .from("chat_messages")
      .select("id,conversation_id,sender_id,removed")
      .eq("id", job.message_id)
      .maybeSingle();
    if (messageError) continue;
    if (!message || message.removed) {
      await db.from("chat_push_jobs").delete().eq("message_id", job.message_id);
      continue;
    }
    const { data: room, error: roomError } = await db
      .from("chat_conversations")
      .select("*")
      .eq("id", message.conversation_id)
      .single();
    if (roomError || !room) continue;
    if (room.challenge_id) {
      await db.from("chat_push_jobs").delete().eq("message_id", job.message_id);
      continue;
    }
    const { data: staff, error: staffError } = await db
      .from("staff_roles")
      .select("user_id")
      .eq("role", "admin");
    if (staffError) continue;
    const admins = new Set((staff ?? []).map((s) => s.user_id));
    const recipients = new Set<string>(admins);
    if (room.member_id) recipients.add(room.member_id);
    if (room.session_id) {
      const { data: members, error } = await db
        .from("enrollments")
        .select("member_id,payment_records!inner(status,amount_cents)")
        .eq("session_id", room.session_id)
        .in("status", ["active", "completed"])
        .eq("payment_records.status", "paid")
        .gt("payment_records.amount_cents", 0);
      if (error) continue;
      members?.forEach((m) => recipients.add(m.member_id));
    }
    const { data: eligible, error: eligibilityError } = await db.rpc("chat_eligible_members", { user_ids: [...recipients] });
    if (eligibilityError) continue;
    const allowed = new Set<string>(eligible ?? []);
    for (const recipient of recipients) if (!allowed.has(recipient)) recipients.delete(recipient);
    recipients.delete(message.sender_id);
    const { data: prefs, error: prefError } = await db
      .from("chat_preferences")
      .select("user_id,muted,last_read_id")
      .eq("conversation_id", room.id);
    if (prefError) continue;
    prefs?.forEach((p) => {
      if (p.muted || p.last_read_id >= message.id) recipients.delete(p.user_id);
    });
    if (!recipients.size) {
      await db.from("chat_push_jobs").delete().eq("message_id", job.message_id);
      continue;
    }
    const { data: devices, error: deviceError } = await db
      .from("chat_push_subscriptions")
      .select("*")
      .in("user_id", [...recipients]);
    if (deviceError) continue;
    let retry = false;
    // Bound fan-out concurrency and use timeouts so the background function finishes.
    for (let i = 0; i < (devices?.length ?? 0); i += 10)
      await Promise.all(
        (devices ?? []).slice(i, i + 10).map(async (device) => {
          if (!validPushSubscription(device.subscription)) {
            await db
              .from("chat_push_subscriptions")
              .delete()
              .eq("endpoint", device.endpoint);
            return;
          }
          try {
            await webPush.sendNotification(
              device.subscription,
              JSON.stringify({
                title: "Holden Health",
                body: "You have a new message in Holden Health.",
                tag: `chat-${room.id}`,
                url: `/${admins.has(device.user_id) ? "admin" : "portal"}/communicate?conversation=${room.id}`,
              }),
              {
                TTL: 3600,
                timeout: 5000,
                vapidDetails: {
                  subject: "mailto:HoldenHealth.Coaching@gmail.com",
                  publicKey,
                  privateKey,
                },
              },
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await db
                .from("chat_push_subscriptions")
                .delete()
                .eq("endpoint", device.endpoint);
            else retry = true;
          }
        }),
      );
    if (!retry)
      await db.from("chat_push_jobs").delete().eq("message_id", job.message_id);
  }
}
