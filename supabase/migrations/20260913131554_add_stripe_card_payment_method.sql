-- Includes Apple Pay through Stripe hosted Checkout.
alter type public.payment_method add value if not exists 'stripe_card';
