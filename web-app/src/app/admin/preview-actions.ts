"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startMemberPreview(formData: FormData) {
  await verifyAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  if (!UUID_PATTERN.test(memberId)) throw new Error("Invalid member reference.");

  const supabase = await createClient();
  const { data: enrollment } = await supabase.from("enrollments").select("id").eq("member_id", memberId).limit(1).maybeSingle();
  if (!enrollment) throw new Error("This person does not have a member portal yet.");

  (await cookies()).set("holden_admin_member_preview", memberId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  redirect("/portal");
}

export async function stopMemberPreview() {
  await verifyAdmin();
  (await cookies()).delete("holden_admin_member_preview");
  redirect("/admin#members");
}
