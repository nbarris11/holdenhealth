import MemberActionForm from "@/components/member-action-form";
import { saveTrainingSessionPlan } from "@/app/admin/training/session-plan-actions";
import { detroitToday } from "@/lib/challenge";
import { createClient } from "@/lib/supabase/server";

type Plan = {
  id: string;
  session_date: string;
  title: string;
  plan: string;
  member_visible: boolean;
};

function PlanFields({ memberId, relationshipId, plan }: { memberId: string; relationshipId: string; plan?: Plan }) {
  return <MemberActionForm action={saveTrainingSessionPlan} className="stack-form">
    <input type="hidden" name="memberId" value={memberId} />
    <input type="hidden" name="relationshipId" value={relationshipId} />
    {plan && <input type="hidden" name="planId" value={plan.id} />}
    <div className="field-grid">
      <label>Session date<input type="date" name="sessionDate" defaultValue={plan?.session_date ?? detroitToday()} required /></label>
      <label>Workout title<input name="title" defaultValue={plan?.title ?? ""} maxLength={140} placeholder="Full-body strength session" required /></label>
    </div>
    <label>Workout plan<textarea name="plan" defaultValue={plan?.plan ?? ""} rows={12} maxLength={15000} placeholder="Paste the workout from your Google Doc here. Include exercises, sets, reps, rest, and coaching notes you want to keep." required /></label>
    <label className="check-label"><input type="checkbox" name="memberVisible" value="yes" defaultChecked={plan?.member_visible ?? true} />Show this plan in the member’s portal</label>
    <button className="button primary" type="submit">{plan ? "Save changes" : "Save session plan"}</button>
  </MemberActionForm>;
}

export default async function TrainingSessionPlansAdmin({ memberId, relationshipId, allowEdit }: { memberId: string; relationshipId: string; allowEdit: boolean }) {
  const db = await createClient();
  const { data, error } = await db.from("personal_training_session_plans")
    .select("id,session_date,title,plan,member_visible")
    .eq("relationship_id", relationshipId)
    .order("session_date", { ascending: false });
  if (error) throw new Error("In-person session plans could not be loaded.");
  const plans = (data ?? []) as Plan[];
  return <section id="session-plans" className="workspace-section">
    <div className="section-heading"><div><span className="eyebrow">Personal coaching</span><h2>Session workout plans</h2></div><p>Keep the workout you lead with this client in their coaching workspace.</p></div>
    {plans.length > 0 && <div className="admin-workout-grid">{plans.map(plan => <details className="panel" key={plan.id}>
      <summary><strong>{plan.title}</strong> · {plan.session_date} · {plan.member_visible ? "Visible to member" : "Coach only"}</summary>
      <div className="workout-plan-text">{plan.plan}</div>
      {allowEdit && <PlanFields memberId={memberId} relationshipId={relationshipId} plan={plan} />}
    </details>)}</div>}
    {!plans.length && <div className="panel calm-empty"><p>No coached session plans saved yet.</p></div>}
    {allowEdit && <details className="panel" open={!plans.length}><summary>+ Add a session workout</summary><p>Paste the workout from your Google Doc. You can save it for yourself first, then show it to the member when ready.</p><PlanFields memberId={memberId} relationshipId={relationshipId} /></details>}
  </section>;
}
