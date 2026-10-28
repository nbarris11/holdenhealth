import "server-only";
import { renderHoldenHealthEmail, renderHoldenHealthText } from "@/lib/communication-email";
import { GOOGLE_REVIEW_URL, REVIEW_BODY, REVIEW_SUBJECT, type ReviewRecipient } from "@/lib/program-reviews";

export async function sendReviewEmailBatch(people: ReviewRecipient[], key: string) {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(people.map(person => {
      const content = { firstName: person.firstName, preheader: "Thank you for being part of Holden Health.", heading: REVIEW_SUBJECT, body: REVIEW_BODY, ctaLabel: "Leave a Google review", ctaUrl: GOOGLE_REVIEW_URL, unsubscribeToken: person.unsubscribeToken };
      return { from: "Kelsey at Holden Health <members@mail.holden.health>", to: [person.email], reply_to: "holdenhealth.coaching@gmail.com", subject: REVIEW_SUBJECT, html: renderHoldenHealthEmail(content), text: renderHoldenHealthText(content) };
    })),
  });
  if (response.ok) {
    const result = await response.json() as { data?: { id?: string }[] };
    if (result.data?.length !== people.length || result.data.some(item => !item.id)) return 502;
  }
  return response.status;
}
