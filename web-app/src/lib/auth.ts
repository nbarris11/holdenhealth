import "server-only";

import { headers } from "next/headers";
import { adminLoginPath } from "@/lib/admin-return";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
  };
});

export const verifyAdmin = cache(async () => {
  const next = (await headers()).get("x-holden-admin-return");
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (error || !userId) {
    redirect(adminLoginPath(next));
  }

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!data) {
    redirect(adminLoginPath(next, "You’re signed in with an account that does not have admin access. Sign in with your admin account to review this request."));
  }

  return {
    userId,
    email: typeof claimsData.claims.email === "string" ? claimsData.claims.email : "",
  };
});
