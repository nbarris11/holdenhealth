"use client";

import { useEffect, useRef, useState } from "react";
import { updateFeaturedProgram } from "@/app/actions";

type Program = { id: string; name: string; starts_on: string; ends_on: string; description: string | null };
type FeaturedCopy = { headline: string; body: string; button: string };
type FeaturedPage = "homepage" | "coaching";

export default function FeaturedProgramForm({ programs, selectedId, copy, fallbackCopy, initialPage, hasPublishedFeature }: { programs: Program[]; selectedId: string; copy: FeaturedCopy; fallbackCopy: Record<FeaturedPage, FeaturedCopy>; initialPage: string; hasPublishedFeature: boolean }) {
  const initial = programs.find(program => program.id === selectedId) ?? programs[0];
  const startingCopy = hasPublishedFeature ? copy : fallbackCopy[initialPage === "coaching" ? "coaching" : "homepage"];
  const hasTyped = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [programId, setProgramId] = useState(initial.id);
  const [headline, setHeadline] = useState(startingCopy.headline || "A good time to show up for yourself.");
  const [body, setBody] = useState(startingCopy.body || initial.description || "Join Kelsey for coached group fitness in Plymouth.");
  const [button, setButton] = useState(startingCopy.button || "See dates and sign up");
  useEffect(() => {
    const showClickedPageCopy = (event: Event) => {
      dialogRef.current?.showModal();
      if (hasTyped.current || hasPublishedFeature) return;
      const pageKey = (event as CustomEvent<{ pageKey?: string }>).detail?.pageKey;
      const pageCopy = fallbackCopy[pageKey === "coaching" ? "coaching" : "homepage"];
      setHeadline(pageCopy.headline || "A good time to show up for yourself.");
      setBody(pageCopy.body || initial.description || "Join Kelsey for coached group fitness in Plymouth.");
      setButton(pageCopy.button || "See dates and sign up");
    };
    window.addEventListener("holden-health-featured-program-edit", showClickedPageCopy);
    return () => window.removeEventListener("holden-health-featured-program-edit", showClickedPageCopy);
  }, [fallbackCopy, hasPublishedFeature, initial.description]);
  const fields = <>
    <label>Program<select name="sessionId" value={programId} onChange={event => {
      const next = programs.find(program => program.id === event.target.value);
      hasTyped.current = true;
      setProgramId(event.target.value);
      if (next) { setHeadline(`Join ${next.name}.`); setBody(next.description || "Join Kelsey for coached group fitness in Plymouth."); setButton("See dates and sign up"); }
    }}>{programs.map(program => <option value={program.id} key={program.id}>{program.name} · {program.starts_on} to {program.ends_on}</option>)}</select></label>
    <label>Headline<input name="headline" maxLength={220} value={headline} onChange={event => { hasTyped.current = true; setHeadline(event.target.value); }} required /></label>
    <label>Short invitation<textarea name="body" maxLength={700} value={body} onChange={event => { hasTyped.current = true; setBody(event.target.value); }} required /></label>
    <label>Button text<input name="button" maxLength={80} value={button} onChange={event => { hasTyped.current = true; setButton(event.target.value); }} required /></label>
    <p className="payment-note">Publishing these words updates the featured promotion on both Home and Coaching. Dates, prices, and the signup link stay tied to the selected program.</p>

    <a className="text-link" href={`/register?session=${programId}`} target="_blank" rel="noopener noreferrer">Check its signup page ↗</a>
  </>;
  return <>
    <form className="stack-form" action={updateFeaturedProgram}>{fields}<button className="button primary" type="submit">Publish featured program</button></form>
    <dialog ref={dialogRef} className="featured-program-dialog" aria-labelledby="featured-program-dialog-title">
      <div className="featured-program-dialog-heading"><h2 id="featured-program-dialog-title">Edit this promotion</h2><button type="button" className="button secondary" onClick={() => dialogRef.current?.close()}>Close</button></div>
      <form className="stack-form" action={updateFeaturedProgram}>{fields}<button className="button primary" type="submit">Save and publish promotion</button></form>
    </dialog>
  </>;
}
