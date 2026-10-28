"use server";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/challenge";
import { cleanLibraryContent, type LibraryItem } from "@/lib/workout-library";
export async function listLibrary() {
  await verifyAdmin();
  const db = await createClient();
  const { data, error } = await db
    .from("workout_library")
    .select("id,name,kind,content")
    .order("created_at", { ascending: false });
  return error
    ? { error: "The library could not be loaded. Please try again." }
    : { items: data as LibraryItem[] };
}
export async function saveLibrary(
  name: string,
  kind: LibraryItem["kind"],
  input: unknown,
) {
  await verifyAdmin();
  const content = cleanLibraryContent(kind, input);
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 120 ||
    !content
  )
    return {
      error:
        "Add a library name and complete the selected exercises or workout details. Check demonstration links and timer settings.",
    };
  const db = await createClient();
  const { error } = await db
    .from("workout_library")
    .insert({ name: name.trim(), kind, content });
  return error
    ? { error: "This item did not save. Please try again." }
    : { success: "Saved to your library." };
}
export async function deleteLibrary(id: string) {
  await verifyAdmin();
  if (!isUuid(id)) return { error: "Invalid library item." };
  const db = await createClient();
  const { error } = await db
    .from("workout_library")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  return error
    ? { error: "The item could not be removed. Refresh and try again." }
    : { success: "Removed from library. Existing workouts are unchanged." };
}
