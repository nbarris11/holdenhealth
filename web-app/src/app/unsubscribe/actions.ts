"use server";

import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function unsubscribeFromCommunications(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!UUID_PATTERN.test(token)) redirect("/unsubscribe?result=invalid");
  const supabase = createIsolatedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await supabase.from("communication_unsubscribe_requests").insert({ token });
  redirect(`/unsubscribe?result=${error ? "invalid" : "success"}`);
}
