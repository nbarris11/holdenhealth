import { createAdminClient } from "@/lib/supabase/admin";
import { automaticReviewPrograms, detroitDate, loadReviewAudience, loadReviewPrograms } from "@/lib/program-reviews";
import { deliverProgramReviews } from "@/lib/send-program-reviews";
import { sendReviewEmailBatch } from "@/lib/program-review-email";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const simulatedDate = dryRun ? url.searchParams.get("date") : null;
  const today = simulatedDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedDate) && Number.isFinite(Date.parse(`${simulatedDate}T12:00:00Z`)) ? simulatedDate : detroitDate();
  if (!dryRun && !process.env.RESEND_API_KEY) return Response.json({ error: "Email delivery is not configured" }, { status: 503 });
  const db = createAdminClient();
  try {
    const programs = automaticReviewPrograms(await loadReviewPrograms(db), today);
    const results: { program: string; eligible: number; result: string }[] = [];
    // Bound each invocation; remaining recipients stay eligible for the next day.
    let batches = 0;
    for (const program of programs) {
      while (batches < 10) {
        const { recipients, records, remaining } = await loadReviewAudience(db, program);
        if (!recipients.length || dryRun) {
          results.push({ program: program.key, eligible: recipients.length + remaining, result: dryRun ? "dry-run" : "no-new-recipients" });
          break;
        }
        batches++;
        const result = await deliverProgramReviews({ db, programKey: program.key, adminId: null, recipients, records, send: sendReviewEmailBatch });
        results.push({ program: program.key, eligible: recipients.length, result });
        if (result !== "sent" || !remaining) break;
      }
    }
    const needsAttention = results.some(r => ["failed", "unknown"].includes(r.result));
    return Response.json({ ok: !needsAttention, dryRun, date: today, results }, { status: needsAttention ? 502 : 200 });
  } catch {
    return Response.json({ error: "Review requests could not be completed. Check the admin review-request page before retrying." }, { status: 500 });
  }
}
