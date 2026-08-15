import { NextResponse, type NextRequest } from "next/server";

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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
      html: `<h2>New website message</h2><p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>Topic:</strong> ${escapeHtml(clean(formData.get("topic")))}</p><p><strong>Message:</strong></p><p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
    };
  }

  if (formName === "consultation-request") {
    if (!name) throw new Error("Missing name");
    return {
      subject: `New free-call request from ${name}`,
      replyTo: email,
      html: `<h2>New consultation request</h2><p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>Phone:</strong> ${escapeHtml(clean(formData.get("phone"))) || "Not provided"}</p><p><strong>Interested in:</strong> ${escapeHtml(clean(formData.get("goal")))}</p><p><strong>Preferred time:</strong> ${escapeHtml(clean(formData.get("preferred-date")))} at ${escapeHtml(clean(formData.get("preferred-time")))}</p><p><strong>Note:</strong> ${escapeHtml(clean(formData.get("note"))) || "None"}</p>`,
    };
  }

  if (formName === "guide-request-resources") {
    return {
      subject: `Free guide request from ${email}`,
      replyTo: email,
      html: `<h2>New free-guide request</h2><p>${escapeHtml(email)} requested “5 habits that change everything.”</p>`,
    };
  }

  if (formName === "wednesday-note") {
    return {
      subject: `New Wednesday Note signup: ${email}`,
      replyTo: email,
      html: `<h2>New Wednesday Note signup</h2><p>${escapeHtml(email)} joined from ${escapeHtml(clean(formData.get("source"))) || "the Holden Health website"}.</p>`,
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
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false }, { status: 503, headers: corsHeaders(origin) });

    const message = messageFor(formData);
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Holden Health Website <members@mail.holden.health>",
        to: [KELSEY_EMAIL],
        reply_to: message.replyTo,
        subject: message.subject,
        html: message.html,
      }),
    });

    return NextResponse.json({ ok: resendResponse.ok }, { status: resendResponse.ok ? 200 : 502, headers: corsHeaders(origin) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders(origin) });
  }
}
