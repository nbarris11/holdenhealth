"use server";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  headerFields,
  validHeaderLink,
  type WebsiteHeader,
} from "@/lib/website-header";
import { revalidatePath } from "next/cache";
export async function publishHeader(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const admin = await verifyAdmin();
  const value: WebsiteHeader = {};
  for (const field of headerFields) {
    const input = String(form.get(field.key) || "").trim();
    if (
      !input ||
      input.length > ("link" in field ? 700 : 30) ||
      ("link" in field && !validHeaderLink(input))
    )
      return {
        error: `Check ${field.label.toLowerCase()}. Use short labels and a full HTTPS or /page.html destination.`,
      };
    value[field.key] = input;
  }
  for (const key of ["join_visible", "call_visible", "app_visible"])
    value[key] = form.has(key);
  const db = await createClient();
  const { error } = await db
    .from("site_content")
    .upsert(
      {
        content_key: "website:header",
        value,
        published: true,
        published_at: new Date().toISOString(),
        updated_by: admin.userId,
      },
      { onConflict: "content_key" },
    );
  if (error) return { error: "The header did not publish. Please try again." };
  revalidatePath("/admin/website");
  return {
    success:
      "Header published across the website. Allow a few minutes for cached pages, then refresh.",
  };
}
