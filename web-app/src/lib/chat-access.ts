import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

export const hasChatAccess = cache(async () => {
  const db = await createClient();
  const { data, error } = await db.rpc("chat_has_access");
  return !error && data === true;
});
