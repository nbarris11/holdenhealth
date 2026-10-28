import { countersignRiskAgreement } from "@/app/risk-agreement-actions";
import type { RiskContext } from "@/lib/risk-agreement";

export type SavedRiskAgreement = {
  id: string;
  document_version: string;
  document_text: string;
  printed_name: string;
  signature: string;
  signed_on: string;
  signed_at: string;
  acknowledgments: string[];
  representative_name: string | null;
  representative_signed_on: string | null;
  representative_signed_at: string | null;
};

export default function RiskAgreementAdmin({ agreement, context, subjectId, memberId }: {
  agreement: SavedRiskAgreement | null;
  context: RiskContext;
  subjectId: string;
  memberId: string;
}) {
  return <section id="agreement" className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Signed document</span><h2>{context === "personal_training" ? "Personal training" : "Class"} Assumption of Risk</h2></div><p>{agreement ? "Signed by client" : "Waiting for the client to sign"}</p></div>
    {agreement ? <div className="panel"><p><strong>Client:</strong> {agreement.printed_name} · <strong>Signature:</strong> {agreement.signature} · <strong>Date:</strong> {agreement.signed_on}</p><p>Submitted {new Date(agreement.signed_at).toLocaleString("en-US")} · Version {agreement.document_version}</p>
      <details><summary>View exact agreement wording and acknowledgments</summary><div style={{ whiteSpace: "pre-wrap" }}>{agreement.document_text}</div><p><strong>All six acknowledgments checked:</strong></p><ul>{agreement.acknowledgments.map(item => <li key={item}>{item}</li>)}</ul></details>
      {agreement.representative_signed_at ? <p className="notice success">Holden Health representative: {agreement.representative_name} · {agreement.representative_signed_on}</p> : <form className="stack-form" action={countersignRiskAgreement}><input type="hidden" name="agreementId" value={agreement.id} /><input type="hidden" name="context" value={context} /><input type="hidden" name="subjectId" value={subjectId} /><input type="hidden" name="memberId" value={memberId} /><div className="field-grid"><label>Holden Health Representative<input name="representativeName" required /></label><label>Date<input name="representativeSignedOn" type="date" required /></label></div><button className="button secondary" type="submit">Sign as representative</button></form>}
    </div> : <div className="panel calm-empty"><p>The client will see the agreement after completing the intake. Keep participation pending until it is signed.</p></div>}
  </section>;
}
