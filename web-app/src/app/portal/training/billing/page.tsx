import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { billMonth, money, type TrainingBill } from "@/lib/training-billing";
import { refreshTrainingBill } from "@/lib/training-billing-stripe";
import { payTrainingBill } from "@/app/training-billing-actions";
import BillingActionForm from "@/components/billing-action-form";

export default async function TrainingBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await verifySession(), supabase = await createClient(), query = await searchParams;
  let statusError = false;
  if (typeof query.bill === "string") {
    const { data: ownBill } = await supabase.from("training_bills").select("id,status").eq("id", query.bill).eq("member_id", user.userId).maybeSingle();
    if (ownBill && ["unpaid", "processing"].includes(ownBill.status)) {
      try { await refreshTrainingBill(ownBill.id); } catch { statusError = true; }
    }
  }
  const { data, error } = await supabase.from("training_bills").select("*").eq("member_id", user.userId).order("billing_month", { ascending: false });
  if (error) throw new Error("Your bills could not be loaded. Please try again.");
  const bills = (data || []) as TrainingBill[];
  return <main className="app-shell training-shell">
    <header className="app-header"><div><Link href="/portal/training">← Personal training</Link><span className="eyebrow">Holden Health</span><h1>Your training bills</h1><p>Review and pay each month. Payments are one-time; there are no automatic monthly charges.</p></div></header>
    {statusError && <p className="notice warning" role="status">We’re still checking your payment. Refresh this page shortly before trying again.</p>}
    {query.checkout === "cancelled" && <p className="notice">You returned from checkout. Your latest bill status is shown below.</p>}
    <div className="training-workout-list">{bills.length ? bills.map(bill => <article className="panel" key={bill.id} id={`bill-${bill.id}`}>
      <span className={`status-pill ${bill.status === "paid" ? "success" : "neutral"}`}>{bill.status === "void" ? "Cancelled" : bill.status}</span>
      <h2>{billMonth(bill.billing_month)}</h2><p>{bill.description}</p><h3>{money(bill.amount_cents)}</h3><p>Due {bill.due_on}</p>
      {bill.status === "unpaid" && <BillingActionForm action={payTrainingBill}><input type="hidden" name="billId" value={bill.id} /><button className="button primary" type="submit">Continue to checkout</button></BillingActionForm>}
      {bill.status === "processing" && <p>Your payment is processing. Please check back shortly.</p>}
      {bill.status === "paid" && <p>Thank you—your payment is confirmed.</p>}
      {["unpaid", "processing"].includes(bill.status) && <Link href={`/portal/training/billing?bill=${bill.id}`}>Refresh payment status</Link>}
    </article>) : <section className="panel"><h2>You’re all caught up.</h2><p>Kelsey will send you a bill when your next month of training is ready.</p></section>}</div>
    <p>Questions about a bill? <a href="mailto:holdenhealth.coaching@gmail.com">Contact Kelsey</a>.</p>
  </main>;
}
