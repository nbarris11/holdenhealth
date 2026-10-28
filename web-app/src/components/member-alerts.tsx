import Link from "next/link";
import MemberAnnouncements from "@/components/member-announcements";
import GroupNextStep from "@/components/group-next-step";
import { StoryTodayCard } from "@/components/progress-story";
import { memberData } from "@/lib/member-data";
import { createClient } from "@/lib/supabase/server";

// Things a member must see or act on, shown at the top of Workouts (formerly on Today).
export default async function MemberAlerts({ challenge }: { challenge?: string }) {
  const d = await memberData(challenge);
  const db = await createClient();
  const trainingSetup = d.training ? await Promise.all([
    db.from("personal_training_intakes").select("submitted_at").eq("relationship_id", d.training.id).maybeSingle(),
    db.from("risk_agreements").select("signed_at").eq("relationship_id", d.training.id).maybeSingle(),
  ]) : null;
  if (trainingSetup?.some(result => result.error)) throw new Error("Your personal training setup status could not be loaded.");
  const trainingIntake = trainingSetup?.[0].data;
  const trainingAgreement = trainingSetup?.[1].data;
  return <>
    <MemberAnnouncements />
    <GroupNextStep />
    {d.training && (!trainingIntake || !trainingAgreement) && <section className="member-card"><span className="member-kicker">Personal training setup</span><h2>{trainingIntake ? "Sign your Assumption of Risk" : "Complete your private intake"}</h2><p>{trainingIntake ? "Your intake is saved. Please review and sign the agreement before training." : "Share your goals and health details so Kelsey can plan your training."}</p><Link className="member-button" href="/portal/training/intake">{trainingIntake ? "Review agreement →" : "Start my intake →"}</Link></section>}
    <StoryTodayCard challengeId={d.challenge?.id} />
  </>;
}
