"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMemberCommunication } from "./actions";

type ComposerProps = { sessionId: string; challengeCount: number; allCount: number; twoDayCount: number; threeDayCount: number; wednesdayNoteCount: number; defaultAudience: "all_active" | "wednesday_note" | "free_challenge" };

function SubmitButtons() {
  const { pending } = useFormStatus();
  return <div className="communication-actions"><button className="button secondary" name="intent" value="test" type="submit" disabled={pending}>{pending ? "Working…" : "Email me a preview"}</button><button className="button primary" name="intent" value="send" type="submit" disabled={pending}>{pending ? "Sending…" : "Send email"}</button></div>;
}

export default function CommunicationComposer({ sessionId, challengeCount, allCount, twoDayCount, threeDayCount, wednesdayNoteCount, defaultAudience }: ComposerProps) {
  const [subject, setSubject] = useState("A note from Kelsey");
  const [preheader, setPreheader] = useState("One useful thought for your week.");
  const [heading, setHeading] = useState("A little progress still counts.");
  const [body, setBody] = useState("Real life does not always leave room for the perfect plan. Pick the version you can actually do today, and let that be enough.\n\nConsistency is not doing everything. It is continuing to show up in a way that fits the day you actually have.");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const hasOpeningGreeting = /^\s*(?:hi|hello|hey)\b/i.test(body);

  return <div className="communication-builder">
    <form className="panel stack-form communication-form" action={sendMemberCommunication} id="composer">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div><span className="eyebrow">Step 1 · Choose who</span><h2>Who needs this message?</h2></div>
      <div className="field-grid"><label>Starting point<select name="kind" defaultValue="newsletter"><option value="newsletter">Weekly coaching note</option><option value="session_update">Program update</option><option value="reminder">Class reminder</option></select></label><label>Send to<select name="audience" defaultValue={defaultAudience}><option value="all_active" disabled={!sessionId}>Class members ({allCount})</option><option value="two_day" disabled={!sessionId}>2-class members ({twoDayCount})</option><option value="three_day" disabled={!sessionId}>3-class members ({threeDayCount})</option><option value="free_challenge">Free challenge participants ({challengeCount})</option><option value="wednesday_note">Wednesday Note subscribers ({wednesdayNoteCount})</option></select></label></div>
      <div className="form-divider"><span className="eyebrow">Step 2 · Write</span><h2>What should they know?</h2></div>
      <label>Email subject<input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} required /></label>
      <label>Inbox preview text<input name="preheader" value={preheader} onChange={(event) => setPreheader(event.target.value)} maxLength={180} /></label>
      <label>Large heading<input name="heading" value={heading} onChange={(event) => setHeading(event.target.value)} maxLength={180} required /></label>
      <div>
        <label htmlFor="communication-body">Message</label>
        <p id="communication-body-help" className="personalization-note" style={{ margin: "8px 0" }}>Just write your message—we’ll add the greeting and Kelsey’s signature.</p>
        <textarea id="communication-body" name="body" value={body} onChange={(event) => setBody(event.target.value)} aria-describedby={`communication-body-help${hasOpeningGreeting ? " communication-greeting-warning" : ""}`} maxLength={6000} required />
        <div aria-live="polite">
          {hasOpeningGreeting ? <p id="communication-greeting-warning" className="notice send-confirmation">Your message starts with a greeting. We already add “Hi [first name],” above it, so consider removing your opening greeting to avoid saying hello twice.</p> : null}
        </div>
      </div>
      <div className="field-grid"><label>Optional button text<input name="ctaLabel" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder="Open the member portal" maxLength={80} /></label><label>Optional button link<input name="ctaUrl" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} type="url" placeholder="https://portal.holden.health/portal" /></label></div>
      <div className="send-confirmation"><label className="check-label"><input name="confirmed" type="checkbox" /> I reviewed the preview and am ready to send this email.</label><p>You can email yourself a private preview first. Nothing reaches the selected audience until you choose “Send email.”</p></div>
      <SubmitButtons />
    </form>

    <aside className="communication-preview-wrap"><span className="eyebrow">Live preview</span><p className="personalization-note">Member and challenge emails use their saved first name. Wednesday Note emails use “there.”</p><div className="email-subject-preview"><strong>{subject || "Your subject"}</strong><span>{preheader || "Preview text appears here."}</span></div><div className="email-preview"><div className="email-preview-head"><span>Holden Health</span><h2>{heading || "Your heading"}</h2><p>Stronger together. Better every day.</p></div><div className="email-preview-body"><strong>Hi [first name],</strong>{body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{ctaLabel && ctaUrl ? <span className="email-preview-button">{ctaLabel}</span> : null}<p>You’ve got this,<br /><strong>Kelsey</strong></p></div><div className="email-preview-foot"><strong>Holden Health LLC</strong><br />Plymouth, Michigan</div></div></aside>
  </div>;
}
