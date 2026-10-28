import "server-only";
import { cache } from "react";
import { verifySession } from "./auth";
import { createClient } from "./supabase/server";
import { memberEnrollments } from "./member-enrollments";
import { unreadForMember, type HabitComment } from "./habit-comments";

// Counts Kelsey's unread comments on the signed-in member's own habit weeks.
// Filtering by owned weeks keeps admins (who can read every comment) at zero.
export const memberHabitUnread = cache(async () => {
  const auth = await verifySession(), db = await createClient();
  const [enrollments, relationships] = await Promise.all([
    memberEnrollments(),
    db.from("coaching_relationships").select("id").eq("member_id", auth.userId),
  ]);
  if (relationships.error) return 0;
  const owners = [
    ...enrollments.map(e => `enrollment_id.eq.${e.id}`),
    ...(relationships.data ?? []).map(r => `relationship_id.eq.${r.id}`),
  ];
  if (!owners.length) return 0;
  const weeks = await db.from("class_habit_weeks").select("id").or(owners.join(","));
  if (weeks.error || !weeks.data?.length) return 0;
  const comments = await db.from("habit_comments").select("*").in("week_id", weeks.data.map(w => w.id)).is("member_read_at", null);
  if (comments.error) return 0;
  return unreadForMember((comments.data ?? []) as HabitComment[], auth.userId);
});
