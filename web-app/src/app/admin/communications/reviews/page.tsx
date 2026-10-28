import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canRequestReviews, GOOGLE_REVIEW_URL, loadReviewAudience, loadReviewPrograms, recipientFingerprint, REVIEW_BODY, REVIEW_SUBJECT } from "@/lib/program-reviews";
import { sendProgramReviewRequests } from "./actions";
import SendReviewButton from "./send-button";

const messages: Record<string, string> = {
  sent: "Review requests were accepted by the email provider. They will not be sent again for this program.",
  failed: "The email provider rejected the request. No emails were accepted. You can try again.",
  unknown: "The send could not be confirmed. To prevent duplicates, these recipients are blocked from another send. Check the email provider’s delivery records before taking further action.",
  "already-requested": "There are no new recipients to send to. Previously requested members will not receive another email for this program.",
  changed: "The recipient list changed. Please review the updated list and confirm again.",
  confirm: "Confirm the recipient list before sending.",
  "not-ended": "Review requests become available the day after a program ends, using Michigan time.",
  "not-configured": "Email delivery is not configured. No emails were sent.",
};
export default async function ProgramReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await verifyAdmin();
  const params = await searchParams;
  const db = await createClient();
  const programs = await loadReviewPrograms(db);
  const selected = programs.find(p => p.key === params.program);
  const audience = selected ? await loadReviewAudience(db, selected) : null;
  const ready = selected && canRequestReviews(selected);
  const uncertain = audience?.records.filter(r => r.status === "sending" || r.status === "unknown") ?? [];
  const sent = audience?.records.filter(r => r.status === "sent") ?? [];
  return <main className="app-shell admin-shell workspace-page communications-shell">
    <header className="workspace-page-header"><div><span className="eyebrow">Program follow-up</span><h1>Request Google reviews</h1><p>Review requests send automatically the morning after each class program or challenge ends. You can preview the email and recipients here.</p></div><Link className="button secondary" href="/admin/communications">Back to Email</Link></header>
    {typeof params.message === "string" && messages[params.message] ? <p className="notice" role="status">{messages[params.message]}</p> : null}
    <section className="panel"><h2>Choose a program</h2><form method="get" className="button-row"><label htmlFor="review-program">Program</label><select id="review-program" name="program" defaultValue={selected?.key ?? ""} required style={{ maxWidth: "100%" }}><option value="" disabled>Select a class program or challenge</option>{programs.map(p => <option key={p.key} value={p.key}>{p.name} · ends {p.ends_on}{canRequestReviews(p) ? " · Ready" : " · Not ready"}</option>)}</select><button className="button secondary" type="submit">View recipients</button></form></section>
    {selected && audience ? <>
      <section className="panel"><h2>{selected.name}</h2><p>Ends {selected.ends_on}. {ready ? "Automatic sending is enabled. You can also send manually below; members will not receive duplicates." : "Sending opens the day after the end date. Draft and cancelled programs cannot send."}</p><p>{sent.length} already sent · {audience.recipients.length} eligible for this send{audience.remaining ? ` · ${audience.remaining} more available after this batch` : ""}</p><p>Includes enrolled class members or this challenge’s signups with email updates enabled. Opt-outs, test accounts, and previous requests for this program are excluded.</p>
      <details open><summary>Review names and emails</summary><div className="wednesday-subscriber-list">{audience.recipients.map(person => <div key={person.memberId}><span>{person.name}</span><span style={{ overflowWrap: "anywhere" }}>{person.email}</span></div>)}</div>{!audience.recipients.length ? <p>No eligible recipients remain.</p> : null}</details>
      {uncertain.length ? <div className="notice error"><p>{uncertain.length} requests are still sending or need their delivery status checked. They cannot be sent again here.</p><details><summary>View affected recipients</summary>{uncertain.map(r => <p key={r.id} style={{ overflowWrap: "anywhere" }}>{r.email} · {r.status === "sending" ? "Sending / awaiting confirmation" : "Delivery unconfirmed"}</p>)}</details></div> : null}
      {sent.length ? <details><summary>Previously requested members</summary>{sent.map(r => <p key={r.id} style={{ overflowWrap: "anywhere" }}>{r.email} · {r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" }) : "Sent"}</p>)}</details> : null}</section>
      <section className="panel"><span className="eyebrow">Email preview</span><h2>{REVIEW_SUBJECT}</h2><p>Hi [First name],</p>{REVIEW_BODY.split("\n\n").map(p => <p key={p}>{p}</p>)}<a className="button secondary" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">Leave a Google review</a><p>You’ve got this,<br />Kelsey</p><p className="muted">Each email includes the member’s unsubscribe link.</p></section>
      {ready && audience.recipients.length ? <section className="panel"><form action={sendProgramReviewRequests}><input type="hidden" name="program" value={selected.key} /><input type="hidden" name="fingerprint" value={recipientFingerprint(audience.recipients)} /><label style={{ display: "block", marginBottom: "16px" }}><input type="checkbox" name="confirmed" required /> I’ve reviewed the email and want to send it to these {audience.recipients.length} members.</label><SendReviewButton /></form></section> : null}
    </> : <section className="panel"><p>Select a program to preview its recipients and email. Automatic requests run each morning (9–10 AM Michigan time), starting the day after the end date. Missed sends are retried for up to seven days.</p></section>}
  </main>;
}
