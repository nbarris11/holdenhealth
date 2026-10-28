import { syncTrainingCheckout } from "@/lib/training-billing-stripe";
import Stripe from "stripe";
import { privateClassConfirmation, syncPrivateClassSignup } from "@/lib/private-class-confirmation";
import { NextResponse } from "next/server";
import { sendMemberPortalLink, sendTransactionalEmails } from "@/lib/email";
import { captureServerEvent, captureServerException, distinctIdForValue } from "@/lib/posthog-server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const KELSEY_EMAIL = "holdenhealth.coaching@gmail.com";

type CheckoutOrder = {
  id: string;
  session_id: string;
  full_name: string;
  email: string;
  phone: string;
  weekly_commitment: number;
  returning_member: boolean;
  plan_kind: "weekly" | "mini";
  amount_cents: number;
  status: string;
  portal_invite_sent_at: string | null;
  payment_submitted_notified_at: string | null;
  payment_paid_notified_at: string | null;
  payment_failed_notified_at: string | null;
};

type NotificationColumn =
  | "payment_submitted_notified_at"
  | "payment_paid_notified_at"
  | "payment_failed_notified_at";

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

function dollars(amountCents: number) {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

function isOnlineTrainingCheckout(session: Stripe.Checkout.Session) {
  return session.metadata?.purchase_type === "online_personal_training";
}

async function sendOnlineTrainingPaidNotifications(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" || session.currency !== "usd" || session.amount_total !== 20_300) {
    throw new Error("Online training checkout amount did not match the offer.");
  }

  const fullName = session.metadata?.full_name?.trim() || session.customer_details?.name?.trim() || "New client";
  const email = session.customer_details?.email?.trim().toLowerCase() || session.metadata?.email?.trim().toLowerCase();
  const phone = session.customer_details?.phone?.trim() || session.metadata?.phone?.trim() || "Not provided";
  if (!email) throw new Error("Online training checkout email is missing.");

  const sent = await sendTransactionalEmails([
    {
      to: email,
      subject: "Welcome to Holden Health online personal training",
      content: {
        firstName: firstName(fullName),
        preheader: "Your payment is confirmed, and Kelsey will be in touch with your next steps.",
        heading: "You’re officially on your way.",
        body: "Your $203 payment is confirmed. That includes $199 for four weeks of online personal training and the $4 online payment fee. Kelsey will reach out to learn more about your goals, schedule, available equipment, and current fitness level before building your personalized plan.\n\nYour coaching includes weekly one-to-one Zoom sessions, direct text support, workout adjustments, accountability, and progress tracking. Kelsey is excited to work with you.",
        ctaLabel: "Questions? Talk with Kelsey",
        ctaUrl: "https://holden.health/book.html",
      },
    },
    {
      to: KELSEY_EMAIL,
      subject: `New online training client: ${fullName}`,
      content: {
        firstName: "Kelsey",
        preheader: `${fullName} purchased four weeks of online personal training.`,
        heading: "A new online coaching client just enrolled.",
        body: `${fullName} completed the $203 online personal training checkout ($199 coaching + $4 online payment fee).\n\nEmail: ${email}\nPhone: ${phone}\n\nTheir payment is confirmed. Reach out with the intake and next steps for building their four-week plan.`,
        ctaLabel: "Open Stripe",
        ctaUrl: "https://dashboard.stripe.com/payments",
      },
    },
  ], `online-training-${session.id}-paid-v1`);
  if (!sent) throw new Error("Online training confirmation emails could not be sent.");
}

async function checkoutOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.checkout_order_id ?? session.client_reference_id;
  if (!orderId) throw new Error("Checkout order metadata is missing.");
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("checkout_orders")
    .select("id,session_id,full_name,email,phone,weekly_commitment,returning_member,plan_kind,amount_cents,status,portal_invite_sent_at,payment_submitted_notified_at,payment_paid_notified_at,payment_failed_notified_at")
    .eq("id", orderId)
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (error || !order) throw new Error("Checkout order was not found.");
  if (session.currency !== "usd" || session.amount_total !== order.amount_cents) throw new Error("Checkout amount did not match the reservation.");
  return { admin, order: order as CheckoutOrder };
}

async function markNotificationSent(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  column: NotificationColumn,
) {
  const { error } = await admin.from("checkout_orders")
    .update({ [column]: new Date().toISOString() })
    .eq("id", orderId)
    .is(column, null);
  if (error) throw error;
}

async function sendPaymentSubmittedNotifications(
  admin: ReturnType<typeof createAdminClient>,
  order: CheckoutOrder,
) {
  if (order.payment_submitted_notified_at) return;
  const { data: program } = await admin.from("sessions").select("name").eq("id", order.session_id).maybeSingle();
  const sent = await sendTransactionalEmails([
    {
      to: order.email,
      subject: "Thank you! Your Holden Health enrollment is in",
      content: {
        firstName: firstName(order.full_name),
        preheader: "Your bank payment was submitted, and Kelsey is looking forward to seeing you.",
        heading: "You’re officially on your way.",
        body: `Thank you for choosing Holden Health. Your secure bank payment for ${dollars(order.amount_cents)} has been submitted and is now processing.\n\nACH payments can take up to four business days to clear. As soon as it is confirmed, we’ll send your secure member-portal and intake link.\n\nKelsey is excited to welcome you and looks forward to seeing you at your first session.`,
        ctaLabel: "Questions? Talk with Kelsey",
        ctaUrl: "https://holden.health/book.html",
      },
    },
    {
      to: KELSEY_EMAIL,
      subject: `New online enrollment submitted: ${order.full_name}`,
      content: {
        firstName: "Kelsey",
        preheader: `${order.full_name} submitted an ACH payment for Holden Health.`,
        heading: "A new member just enrolled online.",
        body: `${order.full_name} completed secure ACH checkout for ${dollars(order.amount_cents)}. The bank payment is processing and may take up to four business days to clear.\n\nProgram: ${program?.name ?? "Group session"}\nPlan: ${order.plan_kind === "mini" ? `All classes · ${order.returning_member ? "returning" : "new"} member` : `${order.weekly_commitment} days per week`}\nEmail: ${order.email}\nPhone: ${order.phone}\n\nYou’ll get another email when the payment is confirmed.`,
      },
    },
  ], `checkout-${order.id}-payment-submitted-v1`);
  if (!sent) throw new Error("Payment-submitted emails could not be sent.");
  await markNotificationSent(admin, order.id, "payment_submitted_notified_at");
}

async function sendPaymentPaidNotifications(
  admin: ReturnType<typeof createAdminClient>,
  order: CheckoutOrder,
) {
  if (order.payment_paid_notified_at) return;
  const { data: program } = await admin.from("sessions").select("name").eq("id", order.session_id).maybeSingle();
  const classDetails = order.weekly_commitment === 1 ? await privateClassConfirmation(order.id) : "";
  const sent = await sendTransactionalEmails([
    {
      to: order.email,
      subject: classDetails ? "Payment and class signup confirmed: Holden Health" : "Payment confirmed: welcome to Holden Health",
      content: {
        firstName: firstName(order.full_name),
        preheader: "Your payment is confirmed. Welcome to Holden Health!",
        heading: "Welcome to Holden Health.",
        body: `Your payment for ${dollars(order.amount_cents)} is confirmed. Your place is officially secured.${classDetails ? `\n\n${classDetails}` : ""}\n\nYour private member-portal link is arriving in a separate email. Use it to complete your confidential intake before your first session.\n\nKelsey is truly looking forward to working with you, cheering you on, and seeing what you accomplish.`,
        ctaLabel: "Open the member portal",
        ctaUrl: "https://portal.holden.health/login",
      },
    },
    {
      to: KELSEY_EMAIL,
      subject: `Payment confirmed: ${order.full_name}`,
      content: {
        firstName: "Kelsey",
        preheader: `${order.full_name}'s Holden Health payment has cleared.`,
        heading: "Payment confirmed. Time to welcome your new member.",
        body: `${order.full_name}'s payment of ${dollars(order.amount_cents)} is confirmed.\n\nProgram: ${program?.name ?? "Group session"}\nPlan: ${order.plan_kind === "mini" ? `All classes · ${order.returning_member ? "returning" : "new"} member` : `${order.weekly_commitment} days per week`}\nEmail: ${order.email}\nPhone: ${order.phone}${classDetails ? `\n\n${classDetails}` : ""}\n\nTheir secure portal and intake link is being sent separately. Health answers will stay inside the protected admin portal.`,
        ctaLabel: "Open the member list",
        ctaUrl: "https://portal.holden.health/admin/people",
      },
    },
  ], `checkout-${order.id}-payment-paid-v1`);
  if (!sent) throw new Error("Payment-confirmed emails could not be sent.");
  await markNotificationSent(admin, order.id, "payment_paid_notified_at");
}

async function sendPaymentFailedNotifications(
  admin: ReturnType<typeof createAdminClient>,
  order: CheckoutOrder,
) {
  if (order.payment_failed_notified_at) return;
  const sent = await sendTransactionalEmails([
    {
      to: order.email,
      subject: "Your Holden Health bank payment needs attention",
      content: {
        firstName: firstName(order.full_name),
        preheader: "Your bank payment did not complete, but Kelsey is here to help.",
        heading: "Let’s get your enrollment back on track.",
        body: "Stripe could not complete your bank payment, so your account was not charged successfully. You can return to online enrollment to try again.\n\nIf you have questions or would rather talk it through, reach out to Kelsey. She’ll be happy to help.",
        ctaLabel: "Try enrollment again",
        ctaUrl: "https://portal.holden.health/register",
      },
    },
    {
      to: KELSEY_EMAIL,
      subject: `Payment needs attention: ${order.full_name}`,
      content: {
        firstName: "Kelsey",
        preheader: `${order.full_name}'s ACH payment did not complete.`,
        heading: "An online enrollment payment did not clear.",
        body: `${order.full_name}'s ACH payment of ${dollars(order.amount_cents)} did not complete. They received a friendly email with a link to try again.\n\nEmail: ${order.email}\nPhone: ${order.phone}`,
        ctaLabel: "Open the admin dashboard",
        ctaUrl: "https://portal.holden.health/admin",
      },
    },
  ], `checkout-${order.id}-payment-failed-v1`);
  if (!sent) throw new Error("Payment-failed emails could not be sent.");
  await markNotificationSent(admin, order.id, "payment_failed_notified_at");
}

async function markPaymentProcessing(session: Stripe.Checkout.Session) {
  const { admin, order } = await checkoutOrder(session);
  if (order.status === "paid") return;
  const { error } = await admin.from("checkout_orders").update({
    status: "payment_processing",
    stripe_payment_intent_id: paymentIntentId(session),
  }).eq("id", order.id);
  if (error) throw error;
  await sendPaymentSubmittedNotifications(admin, order);
}

async function fulfillPaidCheckout(session: Stripe.Checkout.Session) {
  const { admin, order } = await checkoutOrder(session);
  if (order.status !== "paid") {
    const { data: invitation, error: invitationError } = await admin.from("member_invitations").upsert({
      email: order.email,
      full_name: order.full_name,
      phone: order.phone,
      session_id: order.session_id,
      enrollment_status: "invited",
      weekly_commitment: order.weekly_commitment,
      returning_member: order.returning_member,
      payment_status: "paid",
      payment_method: session.payment_method_types.length === 1 && session.payment_method_types[0] === "card" ? "stripe_card" : "stripe_ach",
      amount_cents: order.amount_cents,
      invited_by: null,
    }, { onConflict: "session_id,email" }).select("id").single();
    if (invitationError || !invitation) throw new Error("The paid member invitation could not be created.");

    const { error: orderError } = await admin.from("checkout_orders").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId(session),
      member_invitation_id: invitation.id,
    }).eq("id", order.id);
    if (orderError) throw orderError;
  }

  if (order.weekly_commitment === 1) await syncPrivateClassSignup(order.id);
  await sendPaymentPaidNotifications(admin, order);

  if (!order.portal_invite_sent_at) {
    await sendMemberPortalLink(order.email, order.full_name);
    const { error: inviteTimeError } = await admin.from("checkout_orders")
      .update({ portal_invite_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("portal_invite_sent_at", null);
    if (inviteTimeError) throw inviteTimeError;
  }
  // Portal-link generation creates a new account and claims its invitation.
  if (order.weekly_commitment === 1) await syncPrivateClassSignup(order.id);
}

async function markPaymentFailed(session: Stripe.Checkout.Session) {
  const { admin, order } = await checkoutOrder(session);
  if (order.status === "paid") return;
  const { error } = await admin.from("checkout_orders").update({
    status: "payment_failed",
    stripe_payment_intent_id: paymentIntentId(session),
  }).eq("id", order.id);
  if (error) throw error;
  await sendPaymentFailedNotifications(admin, order);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ ok: false }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purchase_type === "personal_training_monthly_bill") {
        await syncTrainingCheckout(await getStripe().checkout.sessions.retrieve(session.id));
        return NextResponse.json({ received: true });
      }
    }
    let trackedSession: Stripe.Checkout.Session | null = null;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      trackedSession = session;
      if (isOnlineTrainingCheckout(session)) {
        if (session.payment_status === "paid") await sendOnlineTrainingPaidNotifications(session);
      } else if (session.payment_status === "paid") await fulfillPaidCheckout(session);
      else await markPaymentProcessing(session);
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      trackedSession = session;
      if (isOnlineTrainingCheckout(session)) await sendOnlineTrainingPaidNotifications(session);
      else await fulfillPaidCheckout(session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      trackedSession = session;
      if (!isOnlineTrainingCheckout(session)) await markPaymentFailed(session);
    }
    if (trackedSession) {
      const email = trackedSession.customer_details?.email ?? trackedSession.customer_email;
      if (!isOnlineTrainingCheckout(trackedSession) && ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
        await captureServerEvent(email ? distinctIdForValue(email) : trackedSession.id, "group_signup_completed", {
          offering: "group_enrollment",
          completion_status: trackedSession.payment_status === "paid" ? "paid" : "processing",
          payment_status: trackedSession.payment_status,
          payment_method: trackedSession.payment_method_types[0] ?? null,
          amount_cents: trackedSession.amount_total,
        }, `stripe:${trackedSession.id}`);
      }
      await captureServerEvent(email ? distinctIdForValue(email) : trackedSession.id, "payment_status_changed", {
        amount_cents: trackedSession.amount_total,
        offering: isOnlineTrainingCheckout(trackedSession) ? "online_training" : "group_enrollment",
        payment_status: trackedSession.payment_status,
        stripe_event_type: event.type,
      });
    }
  } catch (error) {
    await captureServerException(error, event.id);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
