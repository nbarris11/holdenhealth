import { verifyAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function POST(request: Request) {
  await verifyAdmin();
  const formData = await request.formData();
  const file = formData.get("file");
  const pageKey = String(formData.get("pageKey") ?? "website").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "website";
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Choose a JPG, PNG, WebP, or GIF under 8 MB." }, { status: 400 });
  }

  const path = `${pageKey}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const supabase = createAdminClient();
  const { data: bucket } = await supabase.storage.getBucket("site-media");
  if (!bucket) {
    const { error: bucketError } = await supabase.storage.createBucket("site-media", {
      public: true,
      allowedMimeTypes: [...allowedTypes],
      fileSizeLimit: "8MB",
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      return Response.json({ error: "Website photo storage is not available." }, { status: 500 });
    }
  }
  const { error } = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return Response.json({ error: "The image could not be uploaded." }, { status: 500 });
  const { data } = supabase.storage.from("site-media").getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
