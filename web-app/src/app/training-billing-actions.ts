"use server";
import { revalidatePath } from "next/cache";
import { verifyAdmin, verifySession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email";
import { billMonth, money, parseBill, type TrainingBill } from "@/lib/training-billing";
import { refreshTrainingBill, trainingCheckout } from "@/lib/training-billing-stripe";
import { isStripeConfigured } from "@/lib/stripe";

type Result = { error?: string; success?: string; url?: string };
const value = (form: FormData, key: string) => String(form.get(key) || "");
function refresh(memberId: string) {
  revalidatePath(`/admin/training/${memberId}`);
  revalidatePath("/portal/training/billing");
}
async function adminBill(form: FormData) {
  await verifyAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("training_bills").select("*").eq("id", value(form, "billId")).single();
  if (error || !data) throw new Error("Bill could not be found.");
  return { admin, bill: data as TrainingBill };
}
export async function createTrainingBill(form: FormData): Promise<Result> {
  const staff = await verifyAdmin();
  try {
    const fields = parseBill(form), admin = createAdminClient();
    const { data: relationship, error } = await admin.from("coaching_relationships").select("id,member_id,status").eq("id", value(form, "relationshipId")).single();
    if (error || !relationship) return { error: "Personal training client not found." };
    if (relationship.status === "withdrawn") return { error: "This client has withdrawn from personal training." };
    const { data: contact } = await admin.from("member_contacts").select("email").eq("user_id", relationship.member_id).single();
    if (!contact?.email) return { error: "Add an email address for this client first." };
    const { error: saveError } = await admin.from("training_bills").insert({ ...fields, relationship_id: relationship.id, member_id: relationship.member_id, customer_email: contact.email, created_by: staff.userId });
    if (saveError) return { error: saveError.code === "23505" ? "A bill already exists for this month. Void that bill first if it needs correcting." : "The bill could not be saved. Please try again." };
    refresh(relationship.member_id);
    return { success: "Bill created. Review it below, then select Send bill." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Bill could not be created." }; }
}
export async function sendTrainingBill(form: FormData): Promise<Result> {
  const { admin, bill } = await adminBill(form);
  try {
    await refreshTrainingBill(bill.id);
    const { data: current } = await admin.from("training_bills").select("status").eq("id", bill.id).single();
    if (current?.status !== "unpaid") { refresh(bill.member_id); return { error: "Only unpaid bills can be sent. Payment status has been refreshed." }; }
    const sent = await sendTransactionalEmail(bill.customer_email, `Your ${billMonth(bill.billing_month)} personal training bill`, {
      firstName: "there", preheader: `${money(bill.amount_cents)} for your personal training.`, heading: "Your personal training bill is ready.",
      body: `${billMonth(bill.billing_month)}\n${bill.description}\n\nAmount: ${money(bill.amount_cents)}\nDue: ${bill.due_on}\n\nOpen your member portal to review and pay your bill. This is a one-time payment; you won’t be charged automatically each month.`,
      ctaLabel: "View and pay bill", ctaUrl: `https://portal.holden.health/portal/training/billing?bill=${bill.id}`,
    }, { idempotencyKey: `training-bill-${bill.id}-${new Date().toISOString().slice(0, 10)}` });
    if (!sent) return { error: "The email could not be sent. Your bill is saved; please try again." };
    const { error } = await admin.from("training_bills").update({ emailed_at: new Date().toISOString() }).eq("id", bill.id);
    refresh(bill.member_id);
    return error ? { error: "Email sent, but its send date could not be saved. Refresh before retrying." } : { success: "Bill sent. Repeat clicks today won’t send duplicate emails." };
  } catch { return { error: "The bill could not be sent. Please try again shortly." }; }
}
export async function closeTrainingBill(form: FormData): Promise<Result> {
  const { admin, bill } = await adminBill(form);
  try {
    await refreshTrainingBill(bill.id, true);
    const { error } = await admin.rpc("close_training_bill", { p_bill_id: bill.id, p_method: value(form, "method") });
    refresh(bill.member_id);
    if (error) return { error: "This bill is paid, processing, or has a checkout being prepared. Refresh its status and try again shortly." };
    return { success: value(form, "method") === "void" ? "Bill voided." : "Payment recorded." };
  } catch { return { error: "We could not confirm the payment status. The bill was not changed; please retry." }; }
}
export async function refreshBillStatus(form: FormData): Promise<Result> {
  const { bill } = await adminBill(form);
  try { await refreshTrainingBill(bill.id); refresh(bill.member_id); return { success: "Payment status refreshed." }; }
  catch { return { error: "Payment status could not be refreshed. Please retry shortly." }; }
}
export async function payTrainingBill(form: FormData): Promise<Result> {
  const user = await verifySession();
  const supabase = await createClient();
  const { data: bill } = await supabase.from("training_bills").select("id").eq("id", value(form, "billId")).eq("member_id", user.userId).single();
  if (!bill) return { error: "This bill could not be found." };
  if (!isStripeConfigured()) return { error: "Online payment is temporarily unavailable. Please contact Kelsey." };
  try { return { url: await trainingCheckout(bill.id, user.userId) }; }
  catch (error) { revalidatePath("/portal/training/billing"); return { error: error instanceof Error ? error.message : "Checkout could not be opened. Please try again." }; }
}
