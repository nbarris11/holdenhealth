import "server-only";

import { renderHoldenHealthEmail, renderHoldenHealthText } from "@/lib/communication-email";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM_EMAIL = "Kelsey at Holden Health <members@mail.holden.health>";
const REPLY_TO_EMAIL = "holdenhealth.coaching@gmail.com";

export type TransactionalEmailContent = {
  firstName: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  unsubscribeToken?: string | null;
};

export type TransactionalEmailMessage = {
  to: string;
  subject: string;
  content: TransactionalEmailContent;
  replyTo?: string;
};

export async function prepareMemberPortalLink(email: string, fullName: string, origin?: string, nextPath = "/portal/intake") {
  const appOrigin = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.holden.health").replace(/\/$/, "");
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: { full_name: fullName },
      redirectTo: `${appOrigin}${nextPath}`,
    },
  });
  if (error || !data.user?.id || !data.properties?.hashed_token) {
    throw new Error("The secure portal link could not be created.");
  }

  const portalUrl = new URL("/auth/confirm", appOrigin);
  portalUrl.searchParams.set("token_hash", data.properties.hashed_token);
  portalUrl.searchParams.set("type", data.properties.verification_type);
  portalUrl.searchParams.set("next", nextPath);

  return { userId: data.user.id, url: portalUrl.toString() };
}

export async function sendMemberPortalLink(email: string, fullName: string, origin?: string) {
  const portal = await prepareMemberPortalLink(email, fullName, origin);
  const sent = await sendTransactionalEmail(
    email,
    "Your private Holden Health portal is ready",
    {
      firstName: fullName.trim().split(/\s+/)[0] || "there",
      preheader: "Use your secure link to open the Holden Health member portal.",
      heading: "Your private portal is ready.",
      body: "Welcome to Holden Health. Use the secure button below to open your member portal and complete your confidential intake.\n\nThis link is private, works only once, and should not be forwarded. If it expires, you can request a fresh sign-in link from the portal at any time.\n\nKelsey looks forward to learning more about you and helping you feel ready for your first session.",
      ctaLabel: "Open my private portal",
      ctaUrl: portal.url,
    },
  );
  if (!sent) throw new Error("The enrollment was saved, but the portal email could not be sent.");
}

type EmailAttachment = { filename: string; content: string };

function resendMessage(message: TransactionalEmailMessage, attachments?: EmailAttachment[]) {
  return {
    from: FROM_EMAIL,
    to: [message.to],
    reply_to: message.replyTo ?? REPLY_TO_EMAIL,
    subject: message.subject,
    html: renderHoldenHealthEmail(message.content),
    text: renderHoldenHealthText(message.content),
    ...(attachments?.length ? { attachments } : {}),
  };
}

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  content: TransactionalEmailContent,
  options?: { idempotencyKey?: string; replyTo?: string; attachments?: EmailAttachment[] },
) {
  if (!process.env.RESEND_API_KEY) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify(resendMessage({ to, subject, content, replyTo: options?.replyTo }, options?.attachments)),
  });
  return response.ok;
}

export async function sendTransactionalEmails(
  messages: TransactionalEmailMessage[],
  idempotencyKey: string,
) {
  if (!process.env.RESEND_API_KEY || !messages.length) return false;
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(messages.map((message) => resendMessage(message))),
  });
  return response.ok;
}
