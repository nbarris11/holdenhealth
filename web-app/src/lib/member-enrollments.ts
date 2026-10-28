import "server-only";
import { cache } from "react";
import { verifySession } from "./auth";
import { createClient } from "./supabase/server";
import type { GroupProgram } from "./member-session";

export const memberEnrollments = cache(async () => {
  const auth = await verifySession(), db = await createClient();
  const { data, error } = await db.from("enrollments")
    .select("id,member_id,status,session_id,returning_member,weekly_commitment,risk_agreement_required,sessions(id,name,description,starts_on,ends_on,address_line,city,state)")
    .eq("member_id", auth.userId).in("status", ["invited", "active", "completed"])
    .order("created_at", { ascending: false });
  if (error) throw new Error("Your memberships could not be loaded. Please try again.");
  return (data ?? []).map(row => ({ ...row, sessions: row.sessions as unknown as GroupProgram | null }));
});
