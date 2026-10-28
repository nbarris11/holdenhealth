import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    typescript: true,
  });
  return stripeClient;
}

export function isStripeConfigured() {
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const validStripeKey = process.env.NODE_ENV === "production"
    ? stripeKey.startsWith("sk_live_")
    : stripeKey.startsWith("sk_test_") || stripeKey.startsWith("sk_live_");
  return Boolean(
    validStripeKey
    && process.env.STRIPE_WEBHOOK_SECRET
    && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}
