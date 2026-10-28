import "server-only";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function getPostHogClient() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (process.env.NODE_ENV !== "production" || !token || !host) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 1000,
      fetchRetryCount: 0,
      disableGeoip: true,
      enableExceptionAutocapture: false,
    });
  }
  return posthogClient;
}

export function distinctIdForValue(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function eventUuidForKey(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Only operational counters/categories are accepted; never send submitted text or identities.
const propertyKeys = new Set([
  "amount_cents", "payment_method", "weekly_commitment", "form_name", "guide_delivered",
  "duration_minutes", "format", "offering", "payment_status", "stripe_event_type",
  "entry_type", "completion_status", "status", "completed", "source", "room_type",
]);

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, boolean | number | string | null>,
  idempotencyKey?: string,
) {
  try {
    const posthog = getPostHogClient();
    if (!posthog) return;
    const safeProperties = Object.fromEntries(Object.entries(properties ?? {}).filter(([key]) => propertyKeys.has(key)));
    after(async () => {
      try {
        posthog.capture({
          distinctId: distinctIdForValue(distinctId), event,
          properties: { ...safeProperties, $process_person_profile: false },
          ...(idempotencyKey ? { uuid: eventUuidForKey(`${event}:${idempotencyKey}`) } : {}),
        });
        await posthog.flush();
      } catch {
        // Analytics must never change a booking, payment, or member-save result.
      }
    });
  } catch {
    // Missing request context or unavailable analytics must not break the operation.
  }
}

export async function captureServerException(_error: unknown, _distinctId?: string) {
  // Raw errors may contain submitted text, email, tokens, or database details.
  void _error;
  void _distinctId;
  await captureServerEvent("portal-operation", "portal_operation_failed");
}
