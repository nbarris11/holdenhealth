"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { captureServerEvent, distinctIdForValue } from "@/lib/posthog-server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrationClassTimes } from "@/lib/registration-schedule";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLINE_PAYMENT_FEE_CENTS = 400;

function textField(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}


async function applicationUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "https://portal.holden.health";
}

export async function startStripeCheckout(formData: FormData) {
  const renewal = formData.get("renewal") === "on";
  const registrationPath = renewal ? `/portal/renew?session=${encodeURIComponent(String(formData.get("sessionId") ?? ""))}` : `/register?session=${encodeURIComponent(String(formData.get("sessionId") ?? ""))}`;
  function registrationError(code: string): never {
    redirect(renewal ? `${registrationPath}&message=${encodeURIComponent(code)}` : `${registrationPath}&checkoutError=${encodeURIComponent(code)}#enroll`);
  }
  if (textField(formData, "website", 200)) redirect("/register?sent=1");

  const paymentMethod = textField(formData, "paymentMethod", 20);
  if (paymentMethod !== "ach" && paymentMethod !== "card") registrationError("payment");

  const sessionId = textField(formData, "sessionId", 40);
  const fullName = textField(formData, "fullName", 140);
  const email = textField(formData, "email", 254).toLowerCase();
  const phone = textField(formData, "phone", 40);
  const weeklyCommitment = Number(formData.get("weeklyCommitment"));
  const returningMember = formData.get("returningMember") === "on";

  if (!UUID_PATTERN.test(sessionId) || fullName.length < 2 || !EMAIL_PATTERN.test(email) || phone.length < 7) registrationError("details");
  if (weeklyCommitment !== 2 && weeklyCommitment !== 3) registrationError("plan");

  const safetyConfirmed = ["adultConfirmed", "exerciseClearanceConfirmed"].every((name) => formData.get(name) === "on");
  if (!safetyConfirmed) redirect("https://holden.health/book.html");
  if (formData.get("policiesConfirmed") !== "on") registrationError("policies");

  let stripe: ReturnType<typeof getStripe>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    stripe = getStripe();
    admin = createAdminClient();
  } catch {
    registrationError("unavailable");
  }

  const { data: openSession } = await admin.from("sessions").select("name,starts_on,two_day_price_cents,three_day_price_cents").eq("id", sessionId).maybeSingle();
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if (!openSession || openSession.starts_on <= today) redirect("https://holden.health/contact.html");
  const { data: classMeetings, error: meetingsError } = await admin.from("class_meetings").select("starts_at,cancelled").eq("session_id", sessionId);
  if (meetingsError) registrationError("unavailable");
  const allowedDays = new Set(registrationClassTimes(classMeetings ?? []));
  const attendanceInterest = formData.getAll("attendance").map(String).filter(day => allowedDays.has(day));
  if (!attendanceInterest.length) registrationError("attendance");
  const miniSession = openSession.two_day_price_cents == null && openSession.three_day_price_cents == null;
  if (miniSession && weeklyCommitment !== 3) registrationError("plan");

  const { data: reservationData, error: reservationError } = await admin.rpc(miniSession ? "reserve_mini_checkout_order" : "reserve_checkout_order", miniSession ? {
    p_session_id: sessionId,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_attendance_interest: attendanceInterest,
    p_returning_member: returningMember,
  } : {
    p_session_id: sessionId,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_weekly_commitment: weeklyCommitment,
    p_attendance_interest: attendanceInterest,
  });

  if (reservationError || !reservationData) {
    const message = reservationError?.message.toLowerCase() ?? "";
    if (message.includes("full")) registrationError("full");
    if (message.includes("already in progress")) registrationError("in-progress");
    registrationError("unavailable");
  }

  const reservation = (Array.isArray(reservationData) ? reservationData[0] : reservationData) as {
    id: string;
    amount_cents: number;
  };
  const membershipAmountCents = reservation.amount_cents;
  const checkoutAmountCents = membershipAmountCents + ONLINE_PAYMENT_FEE_CENTS;
  const baseUrl = await applicationUrl();
  let checkoutUrl: string | null = null;

  try {
    const { error: amountUpdateError } = await admin.from("checkout_orders").update({
      amount_cents: checkoutAmountCents,
    }).eq("id", reservation.id);
    if (amountUpdateError) throw amountUpdateError;

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: [paymentMethod === "card" ? "card" : "us_bank_account"],
      customer_creation: "always",
      customer_email: email,
      client_reference_id: reservation.id,
      expires_at: Math.floor(Date.now() / 1000) + (31 * 60),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: membershipAmountCents,
          product_data: {
            name: miniSession ? `Holden Health · ${openSession.name}` : `Holden Health · ${weeklyCommitment} days per week`,
            description: "Focus on You group fitness and nutrition session",
          },
        },
      }, {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: ONLINE_PAYMENT_FEE_CENTS,
          product_data: {
            name: "Online payment convenience fee",
            description: "Secure online payment processing",
          },
        },
      }],
      metadata: { checkout_order_id: reservation.id, session_id: sessionId, online_payment_fee_cents: String(ONLINE_PAYMENT_FEE_CENTS) },
      payment_intent_data: { metadata: { checkout_order_id: reservation.id, session_id: sessionId, online_payment_fee_cents: String(ONLINE_PAYMENT_FEE_CENTS) } },
      success_url: `${baseUrl}/register/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${registrationPath}&checkout=cancelled#enroll`,
      custom_text: paymentMethod === "ach" ? {
        submit: { message: "ACH bank payments usually take up to four business days to finish processing." },
      } : undefined,
    });

    checkoutUrl = checkout.url;
    const { error: updateError } = await admin.from("checkout_orders").update({
      stripe_checkout_session_id: checkout.id,
      expires_at: new Date(checkout.expires_at * 1000).toISOString(),
    }).eq("id", reservation.id);
    if (updateError) throw updateError;
  } catch {
    await admin.from("checkout_orders").update({ status: "cancelled" }).eq("id", reservation.id);
    registrationError("unavailable");
  }

  if (!checkoutUrl) registrationError("unavailable");
  const distinctId = distinctIdForValue(email);
  await captureServerEvent(distinctId, "enrollment_checkout_started", {
    amount_cents: checkoutAmountCents,
    payment_method: paymentMethod,
    weekly_commitment: weeklyCommitment,
  });
  redirect(checkoutUrl);
}
