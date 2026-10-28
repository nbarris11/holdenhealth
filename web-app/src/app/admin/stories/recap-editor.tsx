"use client";
import { useActionState, useState } from "react";
import { saveStoryRecap } from "./actions";
import { storyDate, type StoryState, type StorySummary } from "@/lib/progress-story";

export default function RecapEditor({ id, memberId, name, body: initialBody, version, goal, summary, start, end }: { id: string; memberId: string; name: string; body: string; version: string; goal: string; summary: StorySummary; start: string; end: string }) {
  const [body, setBody] = useState(initialBody), [preview, setPreview] = useState(false);
  const [state, action, pending] = useActionState(saveStoryRecap, { message: "" } as StoryState);
  return <form action={action} className="story-form">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="version" value={version} />
    <input type="hidden" name="evidence" value={JSON.stringify({ goal, summary, start, end })} />
    <label htmlFor="recap-body">Your note to {name.split(" ")[0]}</label><p className="story-muted">Connect something they did or noticed to what matters to them. Your own words make this personal.</p>
    <textarea id="recap-body" name="body" required minLength={3} maxLength={3000} rows={8} value={body} onChange={e => { setBody(e.target.value); setPreview(false); }} placeholder="Something I noticed in your recent check-ins…" />
    <p className="story-muted">Recap period: {storyDate(start)}–{storyDate(end)}. Published recaps keep this goal and these totals.</p>
    {state.message ? <p className={state.ok ? "story-success" : "story-error"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
    <div className="button-row"><button name="intent" value="draft" formNoValidate className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save private draft"}</button><button type="button" className="button secondary" disabled={body.trim().length < 3 || pending} onClick={() => setPreview(!preview)}>{preview ? "Close preview" : "Preview for member"}</button></div>
    {preview ? <section className="story-review"><span className="story-eyebrow">Preview for {name}</span><h3>A note from Kelsey</h3>{goal ? <p>What you’re working toward: <q>{goal}</q></p> : <p className="story-error">This member needs to save a personal goal before you can publish.</p>}<p className="story-words">{body}</p><p>{summary.workouts} workouts completed · {summary.classes} classes attended · {summary.habitDays} days with a habit</p>{summary.partials ? <p>{summary.partials} partial sessions saved, too.</p> : null}<label className="check-label"><input key={body} type="checkbox" name="confirmed" required /> I reviewed this note and it’s ready for {name.split(" ")[0]}.</label><button name="intent" value="publish" className="button primary" disabled={pending || !goal}>{pending ? "Publishing…" : "Publish to member’s story"}</button></section> : null}
  </form>;
}
