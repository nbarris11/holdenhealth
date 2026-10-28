import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { billMonth, TRAINING_CHECKOUT_FEE, TRAINING_CHECKOUT_TYPE, type BillCheckout, type TrainingBill } from "@/lib/training-billing";

export async function syncTrainingCheckout(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();
  const attemptId = session.metadata?.training_bill_checkout_id;
  const { data: attempt, error } = await admin.from("training_bill_checkouts").select("bill_id").eq("id", attemptId || "").single();
  if (error || !attempt || attempt.bill_id !== session.metadata?.training_bill_id || session.metadata?.purchase_type !== TRAINING_CHECKOUT_TYPE || session.currency !== "usd") throw new Error("Payment could not be matched to its bill.");
  const state = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : session.status === "complete" ? "processing" : "open";
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const { error: updateError } = await admin.rpc("update_training_bill_checkout", {
    p_attempt_id: attemptId, p_session_id: session.id, p_state: state,
    p_total: session.amount_total, p_intent: intent || null,
  });
  if (updateError) throw new Error("Payment status could not be saved. Please refresh shortly.");
}

// Stripe retrieval is authoritative; a browser return URL never marks a bill paid.
export async function refreshTrainingBill(billId: string, expire = false) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("training_bill_checkouts").select("*").eq("bill_id", billId).in("state", ["creating", "open", "processing"]);
  if (error) throw new Error("Payment status could not be loaded.");
  for (const attempt of (data || []) as BillCheckout[]) {
    if (!attempt.stripe_session_id) continue;
    let session = await getStripe().checkout.sessions.retrieve(attempt.stripe_session_id);
    if (expire && session.status === "open") {
      try { session = await getStripe().checkout.sessions.expire(session.id); }
      catch { session = await getStripe().checkout.sessions.retrieve(session.id); }
    }
    await syncTrainingCheckout(session);
  }
}

export async function trainingCheckout(billId: string, memberId: string) {
  const admin = createAdminClient();
  await refreshTrainingBill(billId);
  const { data, error } = await admin.rpc("reserve_training_bill_checkout", { p_bill_id: billId, p_member_id: memberId });
  if (error || !data) throw new Error("This bill is paid, processing, or unavailable. Refresh the page to see its status.");
  const { bill, attempt } = data as { bill: TrainingBill; attempt: BillCheckout };
  const stripe = getStripe();
  if (attempt.stripe_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
    if (existing.status === "open" && existing.url) return existing.url;
    await syncTrainingCheckout(existing);
    throw new Error("Payment status has changed. Refresh the page before trying again.");
  }
  const metadata = { purchase_type: TRAINING_CHECKOUT_TYPE, training_bill_id: bill.id, training_bill_checkout_id: attempt.id };
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], customer_email: bill.customer_email,
    client_reference_id: bill.id, metadata, payment_intent_data: { metadata },
    expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1000),
    line_items: [
      { price_data: { currency: "usd", unit_amount: bill.amount_cents, product_data: { name: `Personal training — ${billMonth(bill.billing_month)}`, description: bill.description } }, quantity: 1 },
      { price_data: { currency: "usd", unit_amount: TRAINING_CHECKOUT_FEE, product_data: { name: "Online payment fee" } }, quantity: 1 },
    ],
    success_url: `https://portal.holden.health/portal/training/billing?bill=${bill.id}&checkout=complete`,
    cancel_url: `https://portal.holden.health/portal/training/billing?bill=${bill.id}&checkout=cancelled`,
  }, { idempotencyKey: `training-bill-${attempt.id}` });
  // Attach before revealing the URL. Retrying after a network failure uses the same session.
  await syncTrainingCheckout(session);
  if (!session.url) throw new Error("Checkout is unavailable. Please try again.");
  return session.url;
}
