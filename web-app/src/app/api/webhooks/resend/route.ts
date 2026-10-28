import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import { NextResponse, type NextRequest } from "next/server";

const TRACKED_EVENTS = new Set([
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.failed",
]);

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    click?: { link?: string; timestamp?: string };
    open?: { timestamp?: string };
    bounce?: { message?: string };
    failed?: { reason?: string };
  };
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const ingestKey = process.env.EMAIL_TRACKING_INGEST_KEY;
  if (!webhookSecret || !ingestKey) return new NextResponse("Webhook is not configured", { status: 503 });

  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature) return new NextResponse("Missing webhook headers", { status: 400 });

  const payload = await request.text();
  let event: ResendEvent;
  try {
    event = new Webhook(webhookSecret).verify(payload, {
      "svix-id": eventId,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ResendEvent;
  } catch {
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  if (!event.type || !TRACKED_EVENTS.has(event.type)) return NextResponse.json({ received: true, ignored: true });
  if (!event.data?.email_id || !event.created_at) return new NextResponse("Invalid webhook payload", { status: 400 });

  const occurredAt = event.data.click?.timestamp ?? event.data.open?.timestamp ?? event.created_at;
  const providerMessage = event.data.bounce?.message ?? event.data.failed?.reason ?? null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await supabase.from("resend_webhook_ingest").insert({
    ingest_key: ingestKey,
    event_id: eventId,
    provider_id: event.data.email_id,
    event_type: event.type,
    occurred_at: occurredAt,
    clicked_url: event.data.click?.link ?? null,
    provider_message: providerMessage,
  });

  if (error) return new NextResponse("Could not save webhook event", { status: 500 });
  return NextResponse.json({ received: true });
}
