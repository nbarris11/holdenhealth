export const TRAINING_CHECKOUT_TYPE = "personal_training_monthly_bill";
export const TRAINING_CHECKOUT_FEE = 400;
export type TrainingBill = {
  id: string; relationship_id: string; member_id: string; billing_month: string;
  description: string; amount_cents: number; customer_email: string; due_on: string;
  status: "unpaid" | "processing" | "paid" | "void"; emailed_at: string | null;
  paid_at: string | null; payment_method: string | null; stripe_payment_intent_id: string | null;
};
export type BillCheckout = { id: string; bill_id: string; state: string; stripe_session_id: string | null; expires_at: string };
export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export const billMonth = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
export function parseBill(data: FormData) {
  const month = String(data.get("month") || ""), due = String(data.get("dueOn") || "");
  const amount = String(data.get("amount") || "").trim(), description = String(data.get("description") || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0, 10) !== due) throw new Error("Choose a valid month and due date.");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(amount)) throw new Error("Enter an amount in dollars, with up to two decimal places.");
  const [dollars, cents = ""] = amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  if (amountCents < 100 || amountCents > 1000000) throw new Error("The amount must be between $1 and $10,000.");
  if (!description || description.length > 500) throw new Error("Add a description of up to 500 characters.");
  return { billing_month: `${month}-01`, due_on: due, amount_cents: amountCents, description };
}
