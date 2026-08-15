import "server-only";

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
  const session = await verifySession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", session.userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!data) {
    redirect("/portal");
  }

  return session;
});
