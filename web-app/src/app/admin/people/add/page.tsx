import { inviteMember } from "@/app/actions";
import { addPersonalTrainingClient } from "@/app/training-actions";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Program = {
  id: string;
  name: string;
  status: string;
  starts_on: string;
  new_member_price_cents: number;
  two_day_price_cents: number | null;
};

export default async function AddPersonPage({ searchParams }: {
  searchParams: Promise<{ program?: string; sent?: string }>;
}) {
  await verifyAdmin();
  const { program: requestedProgramId, sent } = await searchParams;
  const personalTraining = !requestedProgramId || requestedProgramId === "personal-training";
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions")
    .select("id,name,status,starts_on,new_member_price_cents,two_day_price_cents")
    .order("starts_on", { ascending: true });
  if (error) throw new Error("Programs could not be loaded. Please try again.");
  const programs = (data ?? []) as Program[];
  const program = personalTraining ? undefined : (programs.find((item) => item.id === requestedProgramId)
    ?? programs.find((item) => ["enrolling", "active"].includes(item.status))
    ?? programs[0]);

  return <main className="app-shell admin-shell workspace-page people-page">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/people?people=all">← People</Link><span className="eyebrow">New client</span><h1>Add someone</h1><p>Choose personal training or a class program.</p></div></header>
    <div className="panel soft-note">Still getting to know them? <Link href="/admin/leads">Add a lead and confirm a phone or in-person conversation →</Link></div>
    <form className="panel stack-form" action="/admin/people/add">
      <label>Service<select name="program" defaultValue={personalTraining ? "personal-training" : program?.id ?? "personal-training"}>
        <option value="personal-training">Personal training · no class program</option>
        {programs.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <div><button className="button secondary" type="submit">Choose service</button></div>
    </form>
    {personalTraining || !program ? <section className="panel add-person-panel" aria-labelledby="add-person-heading">
      <span className="eyebrow">Personal training</span><h2 id="add-person-heading">Client details</h2>
      <p>This creates their coaching record and sends a secure portal setup email. It does not enroll them in a class or record a payment.</p>
      <form className="stack-form" action={addPersonalTrainingClient}>
        <div className="field-grid"><label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" required /></label></div>
        <div className="field-grid"><label>Phone<input name="phone" type="tel" /></label><label>Training format<select name="serviceMode" defaultValue="in_person"><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label></div>
        <label>Primary goal (optional)<textarea name="primaryGoal" placeholder="Add this after you speak with your client if you don't know yet" /></label>
        <button className="button primary" type="submit">Add client and send setup email</button>
      </form>
    </section> : <>
      {sent === "1" ? <div className="panel soft-note" role="status">Invitation saved and setup email sent. <Link href={`/admin/people?program=${encodeURIComponent(program.id)}`}>View {program.name} people →</Link></div> : null}
      <section className="panel add-person-panel" aria-labelledby="add-person-heading">
        <span className="eyebrow">Adding to {program.name}</span>
        <h2 id="add-person-heading">Member details</h2>
        <p>Saving sends a secure setup email. Existing account holders are linked to this program right away; new people appear in its roster after setting up their account.</p>
        <form className="stack-form" action={inviteMember}>
          <input type="hidden" name="sessionId" value={program.id} />
          <input type="hidden" name="returnTo" value="add-person" />
          <div className="field-grid"><label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" required /></label></div>
          <div className="field-grid"><label>Phone<input name="phone" type="tel" /></label><label>Current relationship<select name="enrollmentStatus" defaultValue="active"><option value="active">Confirmed member</option><option value="invited">Invite only</option><option value="prospect">Interested, not confirmed</option></select></label></div>
          <div className="field-grid"><label>Payment<select name="paymentStatus" defaultValue="pending"><option value="pending">Needs payment</option><option value="paid">Already paid</option><option value="waived">No payment needed</option><option value="credited">Has a credit</option></select></label><label>Payment method<select name="paymentMethod" defaultValue=""><option value="">Not recorded</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="check">Check</option><option value="other">Other</option></select></label></div>
          <div className="field-grid"><label>Weekly plan<select name="weeklyCommitment" defaultValue="2"><option value="1">1 class per week · private arrangement</option><option value="2">2 classes per week</option><option value="3">3 classes per week</option></select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={((program.two_day_price_cents ?? program.new_member_price_cents) / 100).toFixed(0)} required /></label></div>
          <button className="button primary" type="submit">Save and send setup email</button>
        </form>
      </section>
    </>}
  </main>;
}
