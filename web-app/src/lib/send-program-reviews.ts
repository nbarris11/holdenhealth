import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewRecord, ReviewRecipient } from "./program-reviews";

// Claims are persisted before contacting the provider. Concurrent submissions can
// only send records they successfully claim. Uncertain outcomes stay blocked.
export async function deliverProgramReviews(input: {
  db: SupabaseClient; programKey: string; adminId: string | null;
  recipients: ReviewRecipient[]; records: ReviewRecord[];
  send: (recipients: ReviewRecipient[], key: string) => Promise<number>;
}) {
  const claimed: { id: string; attempt: string; person: ReviewRecipient }[] = [];
  for (const person of input.recipients) {
    const prior = input.records.find(r => r.member_id === person.memberId || r.email === person.email);
    const attempt = crypto.randomUUID();
    const query = prior
      ? input.db.from("program_review_requests").update({ status: "sending", attempt_id: attempt, requested_by: input.adminId, email: person.email, member_id: person.memberId }).eq("id", prior.id).eq("status", "failed")
      : input.db.from("program_review_requests").insert({ program_key: input.programKey, member_id: person.memberId, email: person.email, requested_by: input.adminId, attempt_id: attempt });
    const { data, error } = await query.select("id").maybeSingle();
    if (error && error.code !== "23505") throw new Error("The send could not be reserved. Refresh to check the request status before trying again.");
    if (data) claimed.push({ id: data.id, attempt, person });
  }
  if (!claimed.length) return "already-requested";
  let status = "unknown";
  try {
    const code = await input.send(claimed.map(row => row.person), `review-${createHash("sha256").update(claimed.map(row => row.attempt).sort().join("-")).digest("hex")}`);
    status = code >= 200 && code < 300 ? "sent" : code >= 400 && code < 500 && ![408, 409, 425].includes(code) ? "failed" : "unknown";
  } catch {
    // A timeout can happen after the provider accepted the email. Never retry it blindly.
  }
  const { error } = await input.db.from("program_review_requests").update({ status, sent_at: status === "sent" ? new Date().toISOString() : null }).in("id", claimed.map(row => row.id));
  return error ? "unknown" : status;
}
