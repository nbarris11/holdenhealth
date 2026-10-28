"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitRiskAgreement } from "@/app/risk-agreement-actions";
import { riskAgreement, validateRiskAgreement, type RiskContext } from "@/lib/risk-agreement";

type Defaults = { clientName?: string; phone?: string; email?: string; emergencyContact?: string; emergencyContactPhone?: string; preferredCommunication?: string };

export default function RiskAgreementForm({ context, subjectId, defaults = {} }: { context: RiskContext; subjectId: string; defaults?: Defaults }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const content = riskAgreement(context);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const validation = validateRiskAgreement(data, context);
    if (validation.error) {
      setError(validation.error);
      (Array.from(form.elements).find(element => (element as HTMLInputElement).name === validation.field) as HTMLElement | undefined)?.focus();
      return;
    }
    setPending(true); setError("");
    try {
      const result = await submitRiskAgreement(data);
      if (result.redirect) { router.push(result.redirect); router.refresh(); }
      else setError(result.error || "The agreement could not be saved.");
    } catch { setError("We could not confirm the save. Your answers are still here; please check your connection and try again."); }
    finally { setPending(false); }
  }
  return <form className="stack-form intake-form" onSubmit={submit}>
    <input type="hidden" name="context" value={context} /><input type="hidden" name="subjectId" value={subjectId} />
    {error && <p className="notice error" role="alert">{error}</p>}
    <fieldset className="intake-submit-group" disabled={pending}>
      <section className="panel intake-section"><h2>{context === "personal_training" ? "Personal Training Agreement & Assumption of Risk" : "Group Class Agreement & Assumption of Risk"}</h2><p>Read the full agreement before signing. A copy of the wording you accept will be saved with your signature.</p>
        <div className="field-grid"><label>Client Name:<input name="clientName" defaultValue={defaults.clientName || ""} required /></label><label>Phone:<input name="phone" type="tel" defaultValue={defaults.phone || ""} required /></label></div><label>Email:<input name="email" type="email" defaultValue={defaults.email || ""} required /></label>
        <div style={{ whiteSpace: "pre-line" }}>{content.beforeEmergency}</div>
        <div className="field-grid"><label>Emergency Contact:<input name="emergencyContact" defaultValue={defaults.emergencyContact || ""} required /></label><label>Emergency Contact Phone:<input name="emergencyContactPhone" type="tel" defaultValue={defaults.emergencyContactPhone || ""} required /></label></div>
        <div style={{ whiteSpace: "pre-line" }}>{content.afterEmergency}</div>
        <fieldset><legend>Preferred communication:</legend><div className="intake-choice-grid">{["Text", "Email", "Phone"].map(option => <label className="check-label choice-card" key={option}><input type="radio" name="preferredCommunication" value={option} defaultChecked={defaults.preferredCommunication === option} required /> {option}</label>)}</div></fieldset>
        <div style={{ whiteSpace: "pre-line" }}>{content.afterCommunication}</div>
      </section>
      <section className="panel intake-section acknowledgment-section"><h2>By signing below, I acknowledge that:</h2>{content.acknowledgments.map(item => <label className="check-label policy-check" key={item}><input type="checkbox" name="riskAcknowledgment" value={item} required /> {item}</label>)}
        <label>Client Printed Name:<input name="printedName" defaultValue={defaults.clientName || ""} required /></label>
        <label>Client Signature: <span className="fine-print">Type your full name</span><input name="signature" required /></label>
        <label>Date:<input name="signedOn" type="date" required /></label>
        <p>Holden Health Representative: Kelsey will complete this after reviewing your agreement.</p>
        <button className="button primary" type="submit">Sign and submit agreement</button>
      </section>
    </fieldset>{pending && <p role="status">Saving your signed agreement…</p>}
  </form>;
}
