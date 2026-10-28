import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, validPushSubscription } from "@/lib/chat";
import { deliverChatPush } from "@/lib/chat-push";
import { captureServerEvent } from "@/lib/posthog-server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
async function context() {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: role } = await db
    .from("staff_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  const { data: access, error: accessError } = await db.rpc("chat_has_access");
  return { db, user: data.user.id, admin: !!role, canChat: !accessError && access === true };
}
export async function GET(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return reply({ error: "Please sign in again." }, 401);
  if (!ctx.canChat) return reply({ error: "Messaging is included with paid memberships." }, 403);
  const { db, admin, user } = ctx;
  const cid = request.nextUrl.searchParams.get("conversation");
  if (cid) {
    if (!isUuid(cid)) return reply({ error: "Invalid conversation." }, 400);
    const { data: room, error: accessError } = await db
      .from("chat_conversations")
      .select("id")
      .eq("id", cid)
      .maybeSingle();
    if (accessError || !room)
      return reply({ error: "This conversation is no longer available." }, 404);
    let query = db
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", cid)
      .order("id", { ascending: false })
      .limit(50);
    const before = Number(request.nextUrl.searchParams.get("before"));
    if (Number.isSafeInteger(before) && before > 0)
      query = query.lt("id", before);
    const [{ data, error }, pinned] = await Promise.all([
      query,
      db
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", cid)
        .eq("pinned", true)
        .eq("removed", false)
        .order("id", { ascending: false })
        .limit(10),
    ]);
    if (error || pinned.error)
      return reply(
        { error: "Messages could not be loaded. Please retry." },
        500,
      );
    return reply({
      messages: (data ?? []).reverse(),
      pinned: pinned.data ?? [],
      hasMore: data?.length === 50,
    });
  }
  const { data, error } = await db.rpc("chat_inbox");
  after(deliverChatPush);
  if (error)
    return reply(
      { error: "Your inbox could not be loaded. Please retry." },
      500,
    );
  const q = request.nextUrl.searchParams.get("q")?.trim();
  let people: { id: string; full_name: string }[] = [];
  if (admin && q && q.length >= 2) {
    const { data: found, error: searchError } = await db
      .from("profiles")
      .select("id,full_name")
      .ilike("full_name", `%${q.replace(/[%_\\]/g, "")}%`)
      .order("full_name")
      .limit(20);
    if (searchError)
      return reply({ error: "Member search failed. Please retry." }, 500);
    const { data: eligible, error: eligibilityError } = await createAdminClient().rpc("chat_eligible_members", { user_ids: (found ?? []).map(p => p.id) });
    if (eligibilityError) return reply({ error: "Member search failed. Please retry." }, 500);
    people = (found ?? []).filter(p => (eligible ?? []).includes(p.id));
  }
  return reply({
    conversations: data ?? [],
    people,
    admin,
    user,
    pushKey: process.env.CHAT_VAPID_PUBLIC_KEY ?? null,
  });
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return reply({ error: "Please reload and try again." }, 403);
  const ctx = await context();
  if (!ctx) return reply({ error: "Please sign in again." }, 401);
  const { db, user, admin } = ctx;
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 12000)
      return reply({ error: "Message is too long." }, 400);
    input = JSON.parse(raw);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (!input || typeof input !== "object")
    return reply({ error: "Invalid request." }, 400);
  if (!ctx.canChat && input.action !== "unsubscribe") return reply({ error: "Messaging is included with paid memberships." }, 403);
  if (input.action === "start") {
    const target = admin ? input.member : user;
    if (!isUuid(target)) return reply({ error: "Choose a member." }, 400);
    const service = createAdminClient();
    const { data: eligible, error: eligibilityError } = await service.rpc("chat_eligible_members", { user_ids: [target] });
    if (eligibilityError || !eligible?.includes(target)) return reply({ error: "Messaging is included with paid memberships." }, 403);
    const { data: profile } = await service
      .from("profiles")
      .select("id,full_name")
      .eq("id", target)
      .maybeSingle();
    if (!profile) return reply({ error: "Member not found." }, 404);
    const { error } = await service
      .from("chat_conversations")
      .upsert(
        { member_id: target, title: profile.full_name || "Member" },
        { onConflict: "member_id", ignoreDuplicates: true },
      );
    if (error)
      return reply({ error: "Conversation could not be opened." }, 500);
    const { data: room, error: readError } = await db
      .from("chat_conversations")
      .select("id")
      .eq("member_id", target)
      .single();
    return readError
      ? reply({ error: "Conversation could not be opened." }, 500)
      : reply(room);
  }
  if (input.action === "push-status") {
    if (typeof input.endpoint !== "string")
      return reply({ error: "Invalid device." }, 400);
    const { data, error } = await createAdminClient()
      .from("chat_push_subscriptions")
      .select("endpoint")
      .eq("endpoint", input.endpoint)
      .eq("user_id", user)
      .maybeSingle();
    return error
      ? reply({ error: "Could not check notification settings." }, 500)
      : reply({ enabled: !!data });
  }
  if (input.action === "subscribe" || input.action === "unsubscribe") {
    const service = createAdminClient();
    if (input.action === "unsubscribe") {
      if (typeof input.endpoint !== "string")
        return reply({ error: "Invalid device." }, 400);
      const { error } = await service
        .from("chat_push_subscriptions")
        .delete()
        .eq("user_id", user)
        .eq("endpoint", input.endpoint);
      if (!error) (await cookies()).delete("hh-chat-device");
      return error
        ? reply({ error: "Could not disable notifications." }, 500)
        : reply({ ok: true });
    }
    if (
      !process.env.CHAT_VAPID_PRIVATE_KEY ||
      !validPushSubscription(input.subscription)
    )
      return reply(
        {
          error:
            "Notifications are unavailable on this device. Please try again later.",
        },
        400,
      );
    const { error } = await service
      .from("chat_push_subscriptions")
      .upsert(
        {
          endpoint: input.subscription.endpoint,
          user_id: user,
          subscription: input.subscription,
        },
        { onConflict: "endpoint" },
      );
    if (!error)
      (await cookies()).set("hh-chat-device", input.subscription.endpoint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      });
    return error
      ? reply({ error: "Could not enable notifications." }, 500)
      : reply({ ok: true });
  }
  const cid = input.conversation;
  if (!isUuid(cid)) return reply({ error: "Choose a conversation." }, 400);
  if (input.action === "send") {
    if (
      typeof input.body !== "string" ||
      !input.body.trim() ||
      input.body.trim().length > 4000 ||
      !isUuid(input.clientId)
    )
      return reply(
        { error: "Enter a message of up to 4,000 characters." },
        400,
      );
    const { data, error } = await db
      .from("chat_messages")
      .insert({
        conversation_id: cid,
        sender_id: user,
        client_id: input.clientId,
        body: input.body.trim(),
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: existing } = await db
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", cid)
        .eq("sender_id", user)
        .eq("client_id", input.clientId)
        .maybeSingle();
      if (existing) {
        after(deliverChatPush);
        return reply(existing);
      }
    }
    if (error)
      return reply(
        {
          error: error.message.includes("wait a minute")
            ? "Please wait a minute before sending more messages."
            : "Message not sent. This conversation may be read-only. Your text is still here.",
        },
        400,
      );
    await captureServerEvent(user, "chat_message_sent", {
      message_length: input.body.trim().length,
      sender_role: admin ? "admin" : "member",
    });
    after(deliverChatPush);
    return reply(data);
  }
  if (input.action === "read" || input.action === "mute") {
    const update: {
      user_id: string;
      conversation_id: string;
      last_read_id?: number;
      muted?: boolean;
    } = { user_id: user, conversation_id: cid };
    if (input.action === "read") {
      if (!Number.isSafeInteger(input.lastId) || input.lastId < 0)
        return reply({ error: "Invalid message." }, 400);
      update.last_read_id = input.lastId;
    } else {
      if (typeof input.muted !== "boolean")
        return reply({ error: "Invalid preference." }, 400);
      update.muted = input.muted;
    }
    const { error: insertError } = await db
      .from("chat_preferences")
      .upsert(
        { user_id: user, conversation_id: cid },
        { onConflict: "user_id,conversation_id", ignoreDuplicates: true },
      );
    if (insertError)
      return reply({ error: "Could not save your preference." }, 400);
    const { error } = await db
      .from("chat_preferences")
      .update(
        input.action === "read"
          ? { last_read_id: update.last_read_id }
          : { muted: update.muted },
      )
      .eq("user_id", user)
      .eq("conversation_id", cid);
    return error
      ? reply({ error: "Could not save your preference." }, 400)
      : reply({ ok: true });
  }
  if (!admin)
    return reply({ error: "Only Kelsey can manage conversations." }, 403);
  if (input.action === "close") {
    if (typeof input.closed !== "boolean")
      return reply({ error: "Invalid request." }, 400);
    const { error } = await db
      .from("chat_conversations")
      .update({ closed: input.closed })
      .eq("id", cid);
    return error
      ? reply({ error: "Could not update conversation." }, 400)
      : reply({ ok: true });
  }
  if (input.action === "remove" || input.action === "pin") {
    if (!Number.isSafeInteger(input.message))
      return reply({ error: "Invalid message." }, 400);
    const update =
      input.action === "remove"
        ? { body: "Message removed by Kelsey.", removed: true, pinned: false }
        : { pinned: input.pinned === true };
    const { error } = await db
      .from("chat_messages")
      .update(update)
      .eq("id", input.message)
      .eq("conversation_id", cid);
    return error
      ? reply({ error: "Could not update message." }, 400)
      : reply({ ok: true });
  }
  return reply({ error: "Unknown request." }, 400);
}
