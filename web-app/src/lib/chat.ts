export type Conversation = {
  id: string;
  title: string;
  member_id: string | null;
  closed: boolean;
  can_write: boolean;
  muted: boolean;
  last_id: number | null;
  last_body: string | null;
  last_at: string | null;
  unread: number;
};
export type ChatMessage = {
  id: number;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  removed: boolean;
  pinned: boolean;
  client_id: string;
};
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function validPushSubscription(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const v = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (typeof v.endpoint !== "string" || v.endpoint.length > 2048) return false;
  try {
    const u = new URL(v.endpoint);
    // Only browser push services. Never allow a user-provided endpoint to reach internal hosts.
    const allowed =
      u.hostname === "fcm.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname.endsWith(".push.apple.com") ||
      u.hostname === "web.push.apple.com" ||
      u.hostname.endsWith(".notify.windows.com");
    return (
      allowed &&
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password &&
      typeof v.keys?.p256dh === "string" &&
      /^[A-Za-z0-9_-]{87}=?$/.test(v.keys.p256dh) &&
      typeof v.keys.auth === "string" &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(v.keys.auth)
    );
  } catch {
    return false;
  }
}
