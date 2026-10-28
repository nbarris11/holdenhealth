"use client";

import { useState } from "react";
import { createClassProgram } from "@/app/actions";

export default function NewProgramForm() {
  const [format, setFormat] = useState<"weekly" | "all-classes">("all-classes");
  return <form className="panel stack-form" action={createClassProgram}>
    <h2>Program basics</h2>
    <label>Program name<input name="name" maxLength={140} placeholder="Focus on You: January Session" required /></label>
    <label>Short signup description<textarea name="description" maxLength={1200} placeholder="A welcoming description of what members get." required /></label>
    <label>Program format<select name="format" value={format} onChange={event => setFormat(event.target.value as typeof format)}><option value="all-classes">One package for all classes</option><option value="weekly">Choose 2 or 3 days each week</option></select></label>
    <p className="soft-note">{format === "all-classes" ? "Classes are created Tuesday at 6 a.m., Wednesday at 7 p.m., and Saturday at 9 a.m." : "Classes are created Tuesday at 6 a.m., Wednesday at 7 p.m., and Saturday at 7:30 and 9 a.m."} You can review each class on the Schedule page before opening signup.</p>
    <div className="field-grid"><label>Program start date<input name="startsOn" type="date" required /></label><label>Program end date<input name="endsOn" type="date" required /></label></div>
    <div className="field-grid"><label>{format === "all-classes" ? "New member package ($)" : "2 days per week ($)"}<input name="firstPrice" type="number" min="1" max="10000" step="0.01" required /></label><label>{format === "all-classes" ? "Returning member package ($)" : "3 days per week ($)"}<input name="secondPrice" type="number" min="1" max="10000" step="0.01" required /></label></div>
    <label>Total spots<input name="capacity" type="number" min="1" max="100" defaultValue="25" required /></label>
    <p>The new program starts as a private draft. You can check its schedule, prices, and signup page before opening registration.</p>
    <button className="button primary" type="submit">Create draft program</button>
  </form>;
}
