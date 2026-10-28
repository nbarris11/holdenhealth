import { randomUUID } from "node:crypto";
import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createLeadAndSend, retryLeadConfirmation } from "./actions";
import SubmitButton from "./submit-button";

type Lead = {
  id: string; full_name: string; email: string; phone: string | null; starts_at: string;
  duration_minutes: number; meeting_type: "phone" | "in_person"; meeting_details: string;
  source: string; note: string | null; confirmation_sent_at: string | null;
};

const messages: Record<string, { tone: string; text: string }> = {
  sent: { tone: "success", text: "Lead saved and confirmation email sent." },
  "send-failed": { tone: "error", text: "Lead saved, but email delivery could not be confirmed. Check the lead below and retry the confirmation." },
  duplicate: { tone: "error", text: "This email already has a conversation at that time. Check the list below before sending again." },
  invalid: { tone: "error", text: "Check the details, choose a future time, and confirm you reviewed the email address." },
  "save-failed": { tone: "error", text: "The lead could not be saved. Please try again." },
};

const dateTime = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "long", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit", timeZone: "America/Detroit", timeZoneName: "short",
});

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await verifyAdmin();
  const { message: messageKey } = await searchParams;
  const message = messages[messageKey ?? ""];
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_appointments")
    .select("id,full_name,email,phone,starts_at,duration_minutes,meeting_type,meeting_details,source,note,confirmation_sent_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Leads could not be loaded. Please try again.");
  const leads = (data ?? []) as Lead[];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());

  return <main className="app-shell admin-shell workspace-page consultation-page">
    <header className="workspace-page-header"><div><span className="eyebrow">Prospects</span><h1>Leads & conversations</h1><p>Confirm a phone or in-person conversation after you’ve agreed on a time. No account or Zoom link is created.</p></div><Link className="button secondary" href="/admin/consultations">Zoom calls →</Link></header>
    {message ? <p className={`notice ${message.tone}`} role="status">{message.text}</p> : null}
    <section className="panel" aria-labelledby="add-lead-heading">
      <span className="eyebrow">Add a lead</span><h2 id="add-lead-heading">Send a conversation confirmation</h2>
      <p>The email includes the time in Eastern time, the meeting details you enter, and a calendar attachment. The lead can reply directly to Kelsey.</p>
      <form className="stack-form" action={createLeadAndSend}>
        <input type="hidden" name="leadId" value={randomUUID()} />
        <div className="field-grid">
          <label>Name<input name="fullName" autoComplete="name" minLength={2} maxLength={140} required /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
          <label>How they found you<select name="source" defaultValue="instagram"><option value="instagram">Instagram</option><option value="website">Website</option><option value="referral">Referral</option><option value="other">Other</option></select></label>
          <label>Date<input name="date" type="date" min={today} required /></label>
          <label>Time (Eastern)<input name="time" type="time" required /></label>
          <label>Conversation length<select name="duration" defaultValue="30"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
          <label>How you’ll talk<select name="meetingType" defaultValue="phone"><option value="phone">Phone call</option><option value="in_person">In person</option></select></label>
        </div>
        <label>Details to include in the email<input name="details" maxLength={300} minLength={3} placeholder="I'll call you at the number we discussed, or enter the meeting address" required /></label>
        <label>Private note (optional)<textarea name="note" maxLength={1000} placeholder="What they asked about; this stays in your portal" /></label>
        <label className="check-label"><input type="checkbox" name="reviewed" required /> I checked their email, time, and meeting details.</label>
        <div><SubmitButton /></div>
      </form>
    </section>
    <section className="workspace-section" aria-labelledby="upcoming-leads-heading">
      <div className="section-heading"><div><span className="eyebrow">Saved leads</span><h2 id="upcoming-leads-heading">Lead conversations</h2></div><p>{leads.length} shown</p></div>
      <div className="consultation-slot-list">{leads.length ? leads.map(lead => <article className="panel consultation-slot booked" key={lead.id}>
        <div><span className={`status-pill ${lead.confirmation_sent_at ? "success" : "warning"}`}>{lead.confirmation_sent_at ? "Email sent" : "Email pending"}</span><h3>{dateTime.format(new Date(lead.starts_at))}</h3><p>{lead.duration_minutes} minutes · {lead.meeting_type === "phone" ? "Phone call" : "In person"}{new Date(lead.starts_at) <= new Date() ? " · Past" : ""}</p></div>
        <div className="consultation-person"><strong>{lead.full_name}</strong><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : null}<span>{lead.meeting_details}</span><small>From {lead.source}{lead.note ? ` · Note: ${lead.note}` : ""}</small>{!lead.confirmation_sent_at && new Date(lead.starts_at) > new Date() ? <form action={retryLeadConfirmation}><input type="hidden" name="leadId" value={lead.id} /><SubmitButton retry /></form> : null}</div>
      </article>) : <div className="panel calm-empty compact"><div><h3>No leads yet</h3><p>Add a lead above when you’ve agreed on a time.</p></div></div>}</div>
    </section>
  </main>;
}
