"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canRequestReviews, loadReviewAudience, loadReviewPrograms, recipientFingerprint } from "@/lib/program-reviews";
import { deliverProgramReviews } from "@/lib/send-program-reviews";
import { sendReviewEmailBatch } from "@/lib/program-review-email";

export async function sendProgramReviewRequests(form: FormData) {
  const admin = await verifyAdmin();
  const db = await createClient();
  const programKey = String(form.get("program") ?? "");
  const location = `/admin/communications/reviews?program=${encodeURIComponent(programKey)}`;
  if (form.get("confirmed") !== "on") redirect(`${location}&message=confirm`);
  if (!process.env.RESEND_API_KEY) redirect(`${location}&message=not-configured`);
  const programs = await loadReviewPrograms(db);
  const program = programs.find(p => p.key === programKey);
  if (!program || !canRequestReviews(program)) redirect(`${location}&message=not-ended`);
  const { recipients, records } = await loadReviewAudience(db, program);
  if (form.get("fingerprint") !== recipientFingerprint(recipients)) redirect(`${location}&message=changed`);
  if (!recipients.length) redirect(`${location}&message=already-requested`);
  const result = await deliverProgramReviews({ db, programKey, adminId: admin.userId, recipients, records,
    send: sendReviewEmailBatch,
  });
  revalidatePath("/admin/communications/reviews");
  redirect(`${location}&message=${result}`);
}
