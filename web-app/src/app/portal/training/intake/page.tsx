import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TrainingIntakeForm from "./intake-form";
import RiskAgreementForm from "@/components/risk-agreement-form";

export default async function TrainingIntakePage() {
  const auth = await verifySession();
  const db = await createClient();
  const { data: relationship, error: relationshipError } = await db.from("coaching_relationships")
    .select("id,status").eq("member_id", auth.userId).maybeSingle();
  if (relationshipError) throw new Error("Your coaching record could not be loaded.");
  if (!relationship || !["invited", "active"].includes(relationship.status)) return <main className="app-shell intake-shell"><section className="panel"><h1>Personal training intake</h1><p>Your personal training record is not ready. Contact Kelsey for help.</p><Link href="/portal">Return to Today</Link></section></main>;
  const [{ data: intake, error }, { data: agreement, error: agreementError }] = await Promise.all([
    db.from("personal_training_intakes").select("submitted_at,reviewed_at,responses").eq("relationship_id", relationship.id).maybeSingle(),
    db.from("risk_agreements").select("id,signed_at,representative_signed_at").eq("relationship_id", relationship.id).maybeSingle(),
  ]);
  if (error || agreementError) throw new Error("Your intake status could not be loaded.");
  if (intake && !agreement) {
    const basic = (intake.responses as Record<string, Record<string, string>> | null)?.basicInformation || {};
    return <main className="app-shell intake-shell"><header className="app-header"><div><span className="eyebrow">Step 2 of 2 · Personal training setup</span><h1>Assumption of Risk</h1><p className="lede">Your intake was saved. Please read and sign the separate personal training agreement.</p></div></header><RiskAgreementForm context="personal_training" subjectId={relationship.id} defaults={{ clientName: basic.name, phone: basic.phone, email: basic.email, emergencyContact: basic.emergencyContact, emergencyContactPhone: basic.emergencyContactPhone, preferredCommunication: basic.preferredCommunication }} /></main>;
  }
  if (intake && agreement) return <main className="app-shell intake-shell"><section className="panel"><span className="eyebrow">Personal training setup complete</span><h1>Thank you. Your forms are in.</h1><p>{intake.reviewed_at ? "Kelsey has reviewed your intake." : "Kelsey will review your intake and signed agreement before you begin."}</p><p>Your agreement was signed on {new Date(agreement.signed_at).toLocaleDateString("en-US")}{agreement.representative_signed_at ? " and countersigned by Holden Health." : "."}</p><Link className="button primary" href="/portal/training">View my training →</Link></section></main>;
  return <main className="app-shell intake-shell"><header className="app-header"><div><span className="eyebrow">Holden Health · Private intake</span><h1>Personal Training Client Intake Form</h1><p className="lede"><strong>Welcome!</strong> This form helps me understand your goals, experience, preferences, and anything that may affect your training. There are no “right” answers—this is simply a starting point so we can build a plan that works for you and your life.</p></div></header><TrainingIntakeForm /></main>;
}
