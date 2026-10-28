"use client";
import { useState } from "react";
import Link from "next/link";
import { STORY_COOKIE, STORY_PRESETS, storyPreset } from "@/lib/progress-story";

export default function FirstWeek({ initialGoal }: { initialGoal: string }) {
  const [goal, setGoal] = useState(initialGoal), [mode, setMode] = useState("group");
  const preset = storyPreset(goal);
  function remember() {
    if (preset) document.cookie = `${STORY_COOKIE}=${preset.id}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return <>
    <fieldset><legend>Choose what’s on your mind</legend><div className="story-choices">{STORY_PRESETS.map(p => <label className="story-choice" key={p.id}><input type="radio" name="goal" value={p.id} checked={goal === p.id} onChange={() => setGoal(p.id)} />{p.label}</label>)}</div></fieldset>
    <fieldset><legend>How would you like to train?</legend><div className="story-choices"><label className="story-choice"><input type="radio" name="mode" value="group" checked={mode === "group"} onChange={() => setMode("group")} />With a supportive group</label><label className="story-choice"><input type="radio" name="mode" value="personal" checked={mode === "personal"} onChange={() => setMode("personal")} />With a personal online plan</label></div></fieldset>
    {preset ? <section className="story-first-week" aria-live="polite"><span className="story-eyebrow">A preview of your first week</span><h2>A starting point for you.</h2><p>{preset.focus}</p><ol className="story-week-steps">
      <li><strong>Let Kelsey get to know you.</strong><p>Share what matters to you, your starting point, and what has made consistency difficult. You’ll agree on a realistic way to begin.</p></li>
      <li><strong>{mode === "group" ? "Take the unknown out of your first class." : "Open a plan that fits your week."}</strong><p>{mode === "group" ? "Use your member calendar for class details. Talk with Kelsey about what to expect and how to make the movements work for you." : "Find your assigned workout in the portal, with a full session and shorter options for days when time or energy is limited."}</p></li>
      <li><strong>Notice one small win.</strong><p>Save something you’re proud of in Progress. Your goal, activity, and personal recaps from Kelsey will grow into a story you can look back on.</p></li>
    </ol><p className="story-muted">This is a preview of the experience. Your schedule and training plan are agreed with Kelsey after enrollment and intake.</p><div className="button-row"><Link className="button primary" onClick={remember} href={mode === "group" ? "/register" : "/online-training"}>{mode === "group" ? "Explore group enrollment" : "Explore personal training"}</Link><a className="button secondary" onClick={remember} href="https://www.holden.health/book.html">Talk with Kelsey first</a></div><p className="story-muted">We’ll remember this choice on this browser for 30 days so you can make it your own in the member portal.</p></section> : <p className="story-muted">Choose a goal above to see what your first week could look like.</p>}
  </>;
}
