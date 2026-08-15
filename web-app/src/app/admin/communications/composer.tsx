"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMemberCommunication } from "./actions";

type ComposerProps = { sessionId: string; allCount: number; twoDayCount: number; threeDayCount: number };

function SubmitButtons() {
  const { pending } = useFormStatus();
  return <div className="communication-actions"><button className="button secondary" name="intent" value="test" type="submit" disabled={pending}>{pending ? "Working…" : "Email me a preview"}</button><button className="button primary" name="intent" value="send" type="submit" disabled={pending}>{pending ? "Sending…" : "Send to members"}</button></div>;
}

export default function CommunicationComposer({ sessionId, allCount, twoDayCount, threeDayCount }: ComposerProps) {
  const [subject, setSubject] = useState("A note from Kelsey");
  const [preheader, setPreheader] = useState("One useful thought for your week.");
  const [heading, setHeading] = useState("A little progress still counts.");
  const [body, setBody] = useState("Real life does not always leave room for the perfect plan. Pick the version you can actually do today, and let that be enough.\n\nConsistency is not doing everything. It is continuing to show up in a way that fits the day you actually have.");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  return <div className="communication-builder">
    <form className="panel stack-form communication-form" action={sendMemberCommunication}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <div><span className="eyebrow">Step 1 · Who and why</span><h2>Choose the communication.</h2></div>
      <div className="field-grid"><label>Type<select name="kind" defaultValue="newsletter"><option value="newsletter">Newsletter / coaching note</option><option value="session_update">Session update</option><option value="reminder">Class reminder</option></select></label><label>Send to<select name="audience" defaultValue="all_active"><option value="all_active">All active members ({allCount})</option><option value="two_day">2-day members ({twoDayCount})</option><option value="three_day">3-day members ({threeDayCount})</option></select></label></div>
      <div className="form-divider"><span className="eyebrow">Step 2 · Write it</span><h2>Keep it useful and human.</h2></div>
      <label>Email subject<input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} required /></label>
      <label>Inbox preview text<input name="preheader" value={preheader} onChange={(event) => setPreheader(event.target.value)} maxLength={180} /></label>
      <label>Large heading<input name="heading" value={heading} onChange={(event) => setHeading(event.target.value)} maxLength={180} required /></label>
      <label>Message<textarea name="body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={6000} required /></label>
      <div className="field-grid"><label>Optional button text<input name="ctaLabel" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder="Open the member portal" maxLength={80} /></label><label>Optional button link<input name="ctaUrl" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} type="url" placeholder="https://portal.holden.health/portal" /></label></div>
      <div className="send-confirmation"><label className="check-label"><input name="confirmed" type="checkbox" /> I reviewed the preview and am ready to send this now.</label><p>“Email me a preview” does not send anything to members.</p></div>
      <SubmitButtons />
    </form>

    <aside className="communication-preview-wrap"><span className="eyebrow">Live preview</span><div className="email-subject-preview"><strong>{subject || "Your subject"}</strong><span>{preheader || "Preview text appears here."}</span></div><div className="email-preview"><div className="email-preview-head"><span>Holden Health</span><h2>{heading || "Your heading"}</h2><p>Stronger together. Better every day.</p></div><div className="email-preview-body"><strong>Hi Jamie,</strong>{body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{ctaLabel && ctaUrl ? <span className="email-preview-button">{ctaLabel}</span> : null}<p>You’ve got this,<br /><strong>Kelsey</strong></p></div><div className="email-preview-foot"><strong>Holden Health LLC</strong><br />Plymouth, Michigan</div></div></aside>
  </div>;
}
