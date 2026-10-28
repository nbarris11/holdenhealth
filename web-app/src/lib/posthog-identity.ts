import posthog from "posthog-js";

// Only a verified account ID and its saved display name enter the person profile.
export function syncPostHogIdentity(user: { id: string; name?: string } | null) {
  const current = posthog.get_distinct_id();
  const next = user ? `member:${user.id}` : null;
  if (current?.startsWith("member:") && current !== next) posthog.reset(true);
  const name = user?.name?.trim();
  if (user && next) posthog.identify(next, name ? { name } : undefined);
}
