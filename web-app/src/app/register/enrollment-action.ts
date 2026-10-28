"use server";

import { redirect } from "next/navigation";
import { submitRegistrationRequest } from "@/app/actions";
import { startStripeCheckout } from "./checkout-action";

export async function submitEnrollment(formData: FormData) {
  const method = formData.get("paymentMethod");
  if (method === "request") return submitRegistrationRequest(formData);
  if (method === "ach" || method === "card") return startStripeCheckout(formData);
  if (method === "venmo" || method === "cash" || method === "check") {
    return submitRegistrationRequest(formData);
  }
  redirect("/register?checkoutError=payment#enroll");
}
