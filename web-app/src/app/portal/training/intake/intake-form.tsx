"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { acknowledgmentFields, acknowledgmentText, parsePersonalTrainingIntake, personalTrainingIntakeSections, type IntakeField } from "@/lib/personal-training-intake";
import { submitTrainingIntake } from "./actions";

function Question({ field }: { field: IntakeField }) {
  if (field.kind === "radio" || field.kind === "checkbox" || field.kind === "yesno") {
    const options = field.kind === "yesno" ? ["Yes", "No"] : field.options || [];
    return <fieldset><legend>{field.label}</legend><div className="intake-choice-grid">{options.map(option => <label className="check-label choice-card" key={option}><input type={field.kind === "checkbox" ? "checkbox" : "radio"} name={field.name} value={option} required={field.required && field.kind !== "checkbox"} /> {option}</label>)}</div>
      {field.detailName && <label>{field.detailLabel}<textarea name={field.detailName} maxLength={2000} /></label>}
      {field.otherName && <label>Other:<input name={field.otherName} maxLength={2000} /></label>}
    </fieldset>;
  }
  return <label>{field.label}{field.kind === "textarea" ? <textarea name={field.name} maxLength={2000} required={field.required} /> : <input name={field.name} type={field.kind} required={field.required} maxLength={field.kind === "text" || field.kind === "email" || field.kind === "tel" ? 2000 : undefined} min={field.kind === "number" ? 0 : undefined} max={field.kind === "number" ? 7 : undefined} />}</label>;
}

export default function TrainingIntakeForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = parsePersonalTrainingIntake(data);
    if (parsed.error) {
      setError(parsed.error.message);
      (Array.from(form.elements).find(element => (element as HTMLInputElement).name === parsed.error?.field) as HTMLElement | undefined)?.focus();
      return;
    }
    setPending(true); setError("");
    try {
      const result = await submitTrainingIntake(data);
      if (result.redirect) { router.push(result.redirect); router.refresh(); }
      else setError(result.error || "Your intake could not be saved.");
    } catch { setError("We could not confirm the save. Your answers are still here. Check your connection and try again."); }
    finally { setPending(false); }
  }
  return <form className="stack-form intake-form" onSubmit={submit}>
    {error && <p className="notice error" role="alert">{error}</p>}
    <fieldset disabled={pending} className="intake-submit-group">
      {personalTrainingIntakeSections.map(section => <section className="panel intake-section" key={section.id}><h2>{section.title}</h2>{section.intro && <p>{section.intro}</p>}{section.fields.map(field => <Question field={field} key={field.name} />)}</section>)}
      <section className="panel intake-section acknowledgment-section"><h2>CLIENT ACKNOWLEDGMENT</h2>{acknowledgmentText.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{acknowledgmentFields.map(field => <Question field={field} key={field.name} />)}<button className="button primary" type="submit">Continue to Assumption of Risk</button></section>
    </fieldset>{pending && <p role="status">Saving your intake…</p>}
  </form>;
}
