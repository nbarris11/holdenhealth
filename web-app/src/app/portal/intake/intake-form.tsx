"use client";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitMemberIntake } from "./actions";
import { intakeConditionalError, type IntakeResult } from "@/lib/intake-validation";

export default function IntakeForm({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const dirty = useRef(false), lock = useRef(false), router = useRouter();
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function showError(form: HTMLFormElement, result: IntakeResult) {
    setError(result.error || "Your intake could not be saved. Please try again.");
    const field = Array.from(form.elements).find(element => (element as HTMLInputElement).name === result.field) as HTMLInputElement | HTMLTextAreaElement | undefined;
    if (field) { field.setCustomValidity(result.error || "Please check this answer."); setTimeout(() => field.reportValidity(), 0); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget, data = new FormData(form), invalid = intakeConditionalError(data);
    if (invalid) { showError(form, invalid); return; }
    lock.current = true; setPending(true); setError("");
    try {
      const result = await submitMemberIntake(data);
      if (result.redirect) { dirty.current = false; router.push(result.redirect); router.refresh(); }
      else showError(form, result);
    } catch {
      setError("We couldn’t confirm the save. Your answers are still here. Check your connection and retry; an intake can only be saved once.");
    } finally { lock.current = false; setPending(false); }
  }
  return <form className="stack-form intake-form" onSubmit={submit} onChange={event => {
    dirty.current = true;
    // A selection can resolve an error attached to another field in its group.
    for (const element of Array.from(event.currentTarget.elements)) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.setCustomValidity("");
    }
  }}>
    <p>Complete this in one sitting. Answers stay on this page if a save fails, but are not saved as a draft. Fields and groups marked required must be answered.</p>
    <noscript>Please enable JavaScript to submit this private intake without losing answers on a validation error.</noscript>
    {error && <p className="notice error" role="alert">{error} Your other answers are still on this page.</p>}
    <fieldset className="intake-submit-group" disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Saving your private intake…</p>}
  </form>;
}
