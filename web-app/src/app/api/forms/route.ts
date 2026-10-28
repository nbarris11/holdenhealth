import { NextResponse, type NextRequest } from "next/server";
import { sendTransactionalEmail } from "@/lib/email";
import { captureServerEvent, captureServerException, distinctIdForValue } from "@/lib/posthog-server";
import { createAdminClient } from "@/lib/supabase/admin";

const KELSEY_EMAIL = "holdenhealth.coaching@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://holden.health",
  "https://www.holden.health",
  "https://holdenhealth-tau.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function clean(value: FormDataEntryValue | null, maxLength = 3000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function messageFor(formData: FormData) {
  const formName = clean(formData.get("form-name"), 80);
  const name = clean(formData.get("name"), 140);
  const email = clean(formData.get("email"), 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");

  if (formName === "contact") {
    const message = clean(formData.get("message"));
    if (!name || !message) throw new Error("Missing contact details");
    return {
      subject: `New Holden Health message from ${name}`,
      replyTo: email,
      inquiry: {
        form_name: formName,
        full_name: name,
        email,
        phone: null,
        topic: clean(formData.get("topic"), 200) || null,
        message,
      },
      content: {
        firstName: "Kelsey",
        preheader: `${name} sent a message through the Holden Health website.`,
        heading: "You have a new website message.",
        body: `From: ${name} (${email})\nTopic: ${clean(formData.get("topic")) || "General question"}\n\nMessage:\n${message}`,
      },
    };
  }

  if (formName === "consultation-request") {
    if (!name) throw new Error("Missing name");
    return {
      subject: `New free-call request from ${name}`,
      replyTo: email,
      inquiry: {
        form_name: formName,
        full_name: name,
        email,
        phone: clean(formData.get("phone"), 40) || null,
        topic: clean(formData.get("goal"), 200) || null,
        message: clean(formData.get("note")) || null,
      },
      content: {
        firstName: "Kelsey",
        preheader: `${name} requested a free conversation with you.`,
        heading: "Someone wants to talk about their goals.",
        body: `From: ${name} (${email})\nPhone: ${clean(formData.get("phone")) || "Not provided"}\nInterested in: ${clean(formData.get("goal")) || "Not specified"}\n\nNote:\n${clean(formData.get("note")) || "No note included."}`,
      },
    };
  }

  if (formName === "guide-request-resources") {
    return {
      subject: `Free guide request from ${email}`,
      replyTo: email,
      guideDelivery: {
        to: email,
        subject: "Your free Holden Health 5 Habits guide",
        content: {
          firstName: "there",
          preheader: "Your free Holden Health guide is ready.",
          heading: "Your 5 Habits guide is ready.",
          body: "Thanks for requesting the guide. These are five simple habits you can start using without overhauling your whole life.\n\nUse the button below to open or download your copy. Start with one habit that feels realistic this week—you do not need to tackle all five at once.",
          ctaLabel: "Download the free guide",
          ctaUrl: "https://www.holden.health/assets/holden-health-5-habits-guide.pdf",
        },
      },
      content: {
        firstName: "Kelsey",
        preheader: "Someone requested the Holden Health habits guide.",
        heading: "Your free guide sparked some interest.",
        body: `${email} requested “5 habits that change everything.”`,
      },
    };
  }

  if (formName === "wednesday-note") {
    const source = clean(formData.get("source"), 200) || "the Holden Health website";
    return {
      subject: `New Wednesday Note signup: ${email}`,
      replyTo: email,
      subscriber: { email, source },
      guideDelivery: {
        to: email,
        subject: "Welcome to Holden Health — I’m glad you’re here",
        content: {
          firstName: "there",
          preheader: "Meet Kelsey and find a manageable place to start.",
          heading: "Welcome to Holden Health.",
          body: "I’m Kelsey, the coach behind Holden Health. I help people get stronger, build practical habits, and find a routine that fits their lives.\n\nYou can work with me through in-person group classes, personal training, or online training. Our free 14-day habit challenge is another place to start. Explore the options at https://holden.health/#programs.\n\nYou don’t need a perfect week to make progress. I’ve included The Backup Plan Still Works, a short note about finding a manageable next step when life gets busy.\n\nIf you’re unsure where to begin, reply and tell me what you’re looking for. I’ll help you find a good fit.",
          ctaLabel: "Read The Backup Plan Still Works",
          ctaUrl: "https://holden.health/backup-plan.html",
        },
      },
      content: {
        firstName: "Kelsey",
        preheader: "A new reader joined the Wednesday Note.",
        heading: "Your Wednesday Note community is growing.",
        body: `${email} joined from ${source}.`,
      },
    };
  }

  throw new Error("Unknown form");
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return NextResponse.json({ ok: false }, { status: 403 });

  try {
    const formData = await request.formData();
    if (clean(formData.get("bot-field"), 200)) return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
    const formName = clean(formData.get("form-name"), 80);
    const email = clean(formData.get("email"), 254).toLowerCase();
    const message = messageFor(formData);
    let inquiryId: string | null = null;
    let unsubscribeToken: string | null = null;
    if ("subscriber" in message) {
      const { data: subscriber, error } = await createAdminClient().from("wednesday_note_subscribers").upsert({
        ...message.subscriber,
        email_opt_in: true,
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" }).select("unsubscribe_token").single();
      if (error) throw error;
      unsubscribeToken = subscriber?.unsubscribe_token ?? null;
    }
    if ("inquiry" in message) {
      const referer = request.headers.get("referer");
      let sourcePath: string | null = null;
      try { sourcePath = referer ? new URL(referer).pathname.slice(0, 500) : null; } catch { sourcePath = null; }
      const { data, error } = await createAdminClient().from("website_inquiries").insert({ ...message.inquiry, source_path: sourcePath }).select("id").single();
      if (error || !data) throw error ?? new Error("Inquiry was not saved.");
      inquiryId = data.id;
    }
    let sent = false;
    try {
      sent = await sendTransactionalEmail(KELSEY_EMAIL, message.subject, message.content, {
        replyTo: message.replyTo,
        ...(inquiryId ? { idempotencyKey: `website-inquiry/${inquiryId}` } : {}),
      });
    } catch (error) {
      if (!inquiryId) throw error;
    }

    const guideDelivery = "guideDelivery" in message ? message.guideDelivery : undefined;
    let guideDelivered = true;
    if (guideDelivery) {
      guideDelivered = await sendTransactionalEmail(
        guideDelivery.to,
        guideDelivery.subject,
        { ...guideDelivery.content, unsubscribeToken },
      );
    }

    if (inquiryId && "inquiry" in message && message.inquiry) {
      await sendTransactionalEmail(message.inquiry.email, "Kelsey received your message", {
        firstName: message.inquiry.full_name.split(/\s+/)[0] || "there",
        preheader: "Your message is safely with Holden Health.", heading: "Thanks for reaching out.",
        body: message.inquiry.form_name === "consultation-request"
          ? "Kelsey received your consultation request and will respond within 12 hours to arrange your free 30–60 minute conversation."
          : "Your message is safely with Kelsey. She will reply to the email address you provided.",
      }, { idempotencyKey: `website-receipt/${inquiryId}` }).catch(() => false);
    }
    const received = guideDelivery ? guideDelivered : Boolean(inquiryId) || sent;
    if (received) {
      const distinctId = distinctIdForValue(email);
      await captureServerEvent(distinctId, "website_form_submitted", {
        form_name: formName,
        guide_delivered: guideDelivered,
      });
    }
    return NextResponse.json({ ok: received }, { status: received ? 200 : 502, headers: corsHeaders(origin) });
  } catch (error) {
    await captureServerException(error, "website_form");
    return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders(origin) });
  }
}
