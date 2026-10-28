"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { manualConsultationTime } from "@/lib/manual-consultation";

export async function publishSingleConsultationSlot(form: FormData) {
  await verifyAdmin();
  const startsAt = manualConsultationTime(String(form.get("date") ?? ""), String(form.get("time") ?? ""));
  if (!startsAt || startsAt <= new Date()) redirect("/admin/consultations?message=time-in-past");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_consultation_slot", { p_starts_at: startsAt.toISOString() });
  const messages = ["slot-created", "slot-reopened", "time-exists", "slot-booked", "time-in-past"];
  const message = !error && typeof data === "string" && messages.includes(data) ? data : "slot-create-failed";
  revalidatePath("/admin/consultations");
  redirect(`/admin/consultations?message=${message}`);
}
