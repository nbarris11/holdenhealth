"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function emailField(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/admin/login?error=${encodeURIComponent("Enter a valid email address.")}`);
  }
  return email;
}

export async function adminSignIn(formData: FormData) {
  const email = emailField(formData);
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/admin/login?error=${encodeURIComponent("That email and password did not match.")}`);
  }

  const { data: role } = await supabase.from("staff_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(`/admin/login?error=${encodeURIComponent("This account does not have admin access.")}`);
  }

  redirect("/admin");
}

export async function requestAdminPasswordReset(formData: FormData) {
  const email = emailField(formData);
  const origin = (await headers()).get("origin") ?? "https://portal.holden.health";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/admin/set-password")}`,
  });
  redirect(`/admin/login?reset=${encodeURIComponent(email)}`);
}

export async function updateAdminPassword(formData: FormData) {
  await verifyAdmin();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 12) {
    redirect(`/admin/set-password?error=${encodeURIComponent("Use at least 12 characters.")}`);
  }
  if (password !== confirmation) {
    redirect(`/admin/set-password?error=${encodeURIComponent("The passwords did not match.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/admin/set-password?error=${encodeURIComponent("We could not save that password. Request a new reset link and try again.")}`);
  }
  redirect("/admin");
}
