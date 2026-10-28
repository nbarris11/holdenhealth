import { createTrainingBill, sendTrainingBill, closeTrainingBill, refreshBillStatus } from "@/app/training-billing-actions";
import { createClient } from "@/lib/supabase/server";
import { billMonth, money, type TrainingBill } from "@/lib/training-billing";
import BillingActionForm from "@/components/billing-action-form";

export default async function TrainingBillingAdmin({ relationshipId, allowCreate = true }: { relationshipId: string; allowCreate?: boolean }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_bills").select("*").eq("relationship_id", relationshipId).order("billing_month", { ascending: false });
  if (error) throw new Error("Monthly bills could not be loaded.");
  const bills = (data || []) as TrainingBill[];
  return <section className="workspace-section" id="billing">
    <div className="section-heading"><div><span className="eyebrow">Personal training</span><h2>Monthly billing</h2></div><p>Create and send a bill each month. Clients pay manually; there are no automatic charges.</p></div>
    {allowCreate && <details className="panel" open={!bills.length}><summary><strong>Create a monthly bill</strong></summary>
      <BillingActionForm action={createTrainingBill} reset>
        <input type="hidden" name="relationshipId" value={relationshipId} />
        <div className="field-grid"><label>Month<input type="month" name="month" required /></label><label>Amount ($)<input type="number" name="amount" min="1" max="10000" step="0.01" placeholder="200.00" required /></label><label>Due date<input type="date" name="dueOn" required /></label></div>
        <label>What is this bill for?<textarea name="description" maxLength={500} placeholder="Two personal training sessions" required /></label>
        <button className="button primary" type="submit">Create bill</button>
      </BillingActionForm>
    </details>}
    <div className="admin-workout-grid">{bills.map(bill => <article className="panel" key={bill.id}>
      <div className="roster-heading"><h3>{billMonth(bill.billing_month)}</h3><span className={`status-pill ${bill.status === "paid" ? "success" : "neutral"}`}>{bill.status}</span></div>
      <p>{bill.description}</p><p><strong>{money(bill.amount_cents)}</strong> · Due {bill.due_on}</p>
      <p>{bill.emailed_at ? `Last sent ${new Date(bill.emailed_at).toLocaleDateString("en-US")}` : "Not emailed yet"}</p>
      {bill.paid_at && <p>Paid {new Date(bill.paid_at).toLocaleDateString("en-US")} · {bill.payment_method?.replace("stripe_card", "Card")}</p>}
      {bill.status === "unpaid" && <>
        <BillingActionForm action={sendTrainingBill}><input type="hidden" name="billId" value={bill.id} /><button className="button primary" type="submit">{bill.emailed_at ? "Resend bill" : "Send bill"}</button><small>Send to {bill.customer_email}</small></BillingActionForm>
        <details><summary>Record an offline payment or void this bill</summary>
          <BillingActionForm action={closeTrainingBill} confirm="Confirm this bill update? Any open online checkout will be closed first."><input type="hidden" name="billId" value={bill.id} /><label>Update<select name="method"><option value="cash">Paid by cash</option><option value="check">Paid by check</option><option value="venmo">Paid by Venmo</option><option value="void">Void bill</option></select></label><button className="button secondary" type="submit">Save bill update</button></BillingActionForm>
        </details>
      </>}
      {["unpaid", "processing"].includes(bill.status) && <BillingActionForm action={refreshBillStatus}><input type="hidden" name="billId" value={bill.id} /><button className="button secondary" type="submit">Refresh payment status</button></BillingActionForm>}
      {bill.stripe_payment_intent_id && <a href={`https://dashboard.stripe.com/payments/${bill.stripe_payment_intent_id}`} target="_blank" rel="noreferrer">View payment in Stripe →</a>}
    </article>)}</div>
  </section>;
}
