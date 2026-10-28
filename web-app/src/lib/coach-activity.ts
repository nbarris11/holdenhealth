import "server-only";
import {after} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendTransactionalEmail} from "@/lib/email";

export const activityLabel = (kind: string) => kind === "workout_completed" ? "Completed a workout" : kind === "habits_edited" ? "Updated weekly habits" : "Chose weekly habits";

// Event + recipient is unique in the database. A compare-and-set lease and provider
// idempotency key protect concurrent workers and uncertain network responses.
export async function deliverCoachActivity() {
 const db = createAdminClient(), now = new Date(), stale = new Date(now.getTime()-10*60000).toISOString();
 const {data: jobs, error} = await db.from("coach_activity_deliveries").select("id,user_id,activity_id,status,attempted_at,created_at")
  .or(`status.eq.pending,and(status.eq.sending,attempted_at.lt.${stale})`).order("created_at").limit(50);
 if (error) throw new Error("Activity deliveries could not be loaded.");
 for (const job of jobs ?? []) {
  // Do not retry beyond the email provider's 24-hour idempotency window.
  if (now.getTime()-Date.parse(job.created_at)>23*3600000) {await db.from("coach_activity_deliveries").update({status:"failed"}).eq("id",job.id).eq("status",job.status);continue;}
  let claim = db.from("coach_activity_deliveries").update({status:"sending",attempted_at:now.toISOString()}).eq("id",job.id).eq("status",job.status);
  if (job.attempted_at) claim=claim.eq("attempted_at",job.attempted_at);
  const {data: locked,error: lockError}=await claim.select("id").maybeSingle();
  if (lockError || !locked) continue;
  try {
   const [event,role,prefs,recipient] = await Promise.all([
    db.from("coach_activity").select("kind,href,member_id").eq("id",job.activity_id).single(),
    db.from("staff_roles").select("role").eq("user_id",job.user_id).eq("role","admin").maybeSingle(),
    db.from("coach_activity_preferences").select("email_habits,email_workouts").eq("user_id",job.user_id).maybeSingle(),
    db.auth.admin.getUserById(job.user_id),
   ]);
   if (event.error || role.error || prefs.error || recipient.error) throw new Error("Delivery access check failed");
   const enabled=event.data?.kind === "workout_completed" ? prefs.data?.email_workouts : prefs.data?.email_habits;
   if (!role.data || !enabled || !recipient.data.user?.email) {await db.from("coach_activity_deliveries").update({status:"failed"}).eq("id",job.id);continue;}
   // Stable, private email content: all names and habit details stay behind login.
   const sent=await sendTransactionalEmail(recipient.data.user.email,"New Holden Health member activity",{
    firstName:"Coach",preheader:"A member has new activity for you to review.",heading:activityLabel(event.data.kind),
    body:"A member has saved new activity. Open your private activity inbox to see who it is and review their progress.",ctaLabel:"View member activity",ctaUrl:"https://portal.holden.health/admin/activity",
   },{idempotencyKey:`coach-activity-${job.id}`});
   if (!sent) throw new Error("Email not accepted");
   const {error: saved}=await db.from("coach_activity_deliveries").update({status:"sent",sent_at:new Date().toISOString()}).eq("id",job.id);
   if (saved) throw saved;
  } catch {await db.from("coach_activity_deliveries").update({status:"pending"}).eq("id",job.id);}
 }
}
export function queueCoachActivityDelivery() {
 after(async()=>{try {await deliverCoachActivity();} catch {console.error("Coach activity email delivery will retry.");}});
}
