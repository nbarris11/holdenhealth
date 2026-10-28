"use client";
import { useActionState, useState } from "react";
import { saveStoryGoal, saveStoryWin, removeStoryWin } from "@/app/portal/progress/actions";
import type { StoryState } from "@/lib/progress-story";
const initial: StoryState = { message: "" };

export function StoryEntryForm({ kind, id, suggestion = "" }: { kind: "goal" | "win"; id: string; suggestion?: string }) {
  const [entryId, setEntryId] = useState(id);
  const [value, setValue] = useState("");
  const [state, action, pending] = useActionState(async (previous: StoryState, form: FormData) => {
    const result = await (kind === "goal" ? saveStoryGoal : saveStoryWin)(previous, form);
    if (result.ok) { setValue(""); setEntryId(crypto.randomUUID()); }
    return result;
  }, initial);
  const isGoal = kind === "goal";
  return <form action={action} className="story-form">
    <input type="hidden" name="id" value={entryId} />
    <label htmlFor={`story-${id}`}>{isGoal ? "What would getting stronger let you do?" : "What feels different in everyday life?"}</label>
    <p id={`hint-${id}`} className="story-muted">{isGoal ? "A moment, an activity, or a feeling you want more of. Your words stay between you and Kelsey." : "Something felt easier? You showed up when it was hard? Write it down while you remember."}</p>
    {isGoal && suggestion ? <button type="button" className="story-suggestion" onClick={() => setValue(suggestion)}><span>Use this as a starting point</span><q>{suggestion}</q></button> : null}
    <textarea id={`story-${id}`} name={isGoal ? "goal" : "body"} value={value} onChange={e => setValue(e.target.value)} minLength={3} maxLength={isGoal ? 600 : 1200} required rows={3} aria-describedby={`hint-${id}`} placeholder={isGoal ? "I want to enjoy hiking with my daughter…" : "I noticed…"} />
    {state.message ? <p className={state.ok ? "story-success" : "story-error"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
    <button className="button primary" disabled={pending}>{pending ? "Saving…" : isGoal ? "Save my goal" : "Save this win"}</button>
  </form>;
}
export function RemoveStoryWin({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [state, action, pending] = useActionState(removeStoryWin, initial);
  return <form action={action} className="story-remove"><input type="hidden" name="id" value={id} />
    {confirm ? <><span>Remove this personal win?</span><button disabled={pending}>{pending ? "Removing…" : "Yes, remove"}</button><button type="button" onClick={() => setConfirm(false)}>Keep it</button></> : <button type="button" onClick={() => setConfirm(true)}>Remove win</button>}
    {state.message ? <span role={state.ok ? "status" : "alert"}>{state.message}</span> : null}
  </form>;
}
