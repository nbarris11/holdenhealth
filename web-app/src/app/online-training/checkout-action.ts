"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { captureServerEvent, distinctIdForValue } from "@/lib/posthog-server";
import { getStripe } from "@/lib/stripe";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLINE_TRAINING_AMOUNT_CENTS = 19_900;
const ONLINE_PAYMENT_FEE_CENTS = 400;

function textField(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function checkoutError(code: string): never {
  redirect(`/online-training?checkoutError=${encodeURIComponent(code)}#checkout`);
}

async function applicationUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "https://portal.holden.health";
}

export async function startOnlineTrainingCheckout(formData: FormData) {
  if (formData.get("consultationConfirmed") !== "on") redirect("https://holden.health/book.html");
  if (textField(formData, "website", 200)) redirect("/online-training?sent=1");

  const fullName = textField(formData, "fullName", 140);
  const email = textField(formData, "email", 254).toLowerCase();
  const phone = textField(formData, "phone", 40);

  if (fullName.length < 2 || !EMAIL_PATTERN.test(email) || phone.length < 7) checkoutError("details");
  if (formData.get("adultConfirmed") !== "on" || formData.get("exerciseClearanceConfirmed") !== "on") checkoutError("safety");
  if (formData.get("policiesConfirmed") !== "on") checkoutError("policies");

  let checkoutUrl: string | null = null;
  try {
    const baseUrl = await applicationUrl();
    const checkout = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
      customer_email: email,
      phone_number_collection: { enabled: true },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: ONLINE_TRAINING_AMOUNT_CENTS,
          product_data: {
            name: "Holden Health · Online Personal Training",
            description: "Four weeks of personalized workouts, weekly Zoom coaching, accountability, and direct support",
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
      metadata: {
        purchase_type: "online_personal_training",
        full_name: fullName,
        email,
        phone,
      },
      payment_intent_data: {
        metadata: { purchase_type: "online_personal_training" },
      },
      success_url: `${baseUrl}/online-training/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/online-training?checkout=cancelled#checkout`,
      custom_text: {
        submit: { message: "Your total is $203, including the $4 online payment fee. Kelsey will email your next steps." },
      },
    });
    checkoutUrl = checkout.url;
  } catch {
    checkoutError("unavailable");
  }

  if (!checkoutUrl) checkoutError("unavailable");
  const distinctId = distinctIdForValue(email);
  await captureServerEvent(distinctId, "online_training_checkout_started", {
    amount_cents: ONLINE_TRAINING_AMOUNT_CENTS + ONLINE_PAYMENT_FEE_CENTS,
    payment_method: "card",
  });
  redirect(checkoutUrl);
}
