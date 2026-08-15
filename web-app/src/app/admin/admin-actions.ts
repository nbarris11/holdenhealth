"use server";

import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export async function inviteAdministrator(formData: FormData) {
  const admin = await verifyAdmin();
  const email = adminEmail(formData);
  const supabase = await createClient();

  const { data: currentAdmins, error: listError } = await supabase.rpc("list_admin_accounts");
  if (listError) throw new Error("We could not check the current administrators.");
  if ((currentAdmins ?? []).some((account: { email: string }) => account.email.toLowerCase() === email)) {
    redirect("/admin?adminMessage=already-admin#administrators");
  }

  const { error: invitationError } = await supabase.from("admin_invitations").insert({ email, invited_by: admin.userId });
  if (invitationError) {
    if (invitationError.code === "23505") redirect("/admin?adminMessage=already-invited#administrators");
    throw new Error("We could not create that admin invitation.");
  }

  const origin = (await headers()).get("origin") ?? "https://portal.holden.health";
  const authClient = createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error: emailError } = await authClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/admin/set-password")}`,
      data: { full_name: "Holden Health administrator" },
    },
  });
  if (emailError) throw new Error("The invitation was saved, but the setup email could not be sent.");

  revalidatePath("/admin");
  redirect(`/admin?adminMessage=${encodeURIComponent(`Invitation sent to ${email}`)}#administrators`);
}

export async function removeAdministrator(formData: FormData) {
  const admin = await verifyAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!UUID_PATTERN.test(userId)) throw new Error("Invalid administrator reference.");
  if (userId === admin.userId) redirect("/admin?adminMessage=cannot-remove-yourself#administrators");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_admin", { target_user_id: userId });
  if (error) throw new Error("We could not remove that administrator.");
  revalidatePath("/admin");
  redirect("/admin?adminMessage=admin-removed#administrators");
}
