"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nextValue = String(formData.get("next") ?? "/portal");
  const next = nextValue.startsWith("/") && !nextValue.startsWith("//") ? nextValue : "/portal";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const origin = (await headers()).get("origin");
  if (!origin) {
    redirect(`/login?error=${encodeURIComponent("Unable to determine the sign-in address.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    const message = error.status === 429
      ? "Too many sign-in emails were requested. Please wait a few minutes and try again."
      : "We could not send the sign-in email. Contact Kelsey if you need help.";

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}
