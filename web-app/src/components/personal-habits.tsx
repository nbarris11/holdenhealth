import ClassTracker from "@/app/portal/habits/class-tracker";
import {createClient} from "@/lib/supabase/server";
import {detroitToday} from "@/lib/challenge";
import {mondayOf} from "@/lib/workout-app";
import type {HabitWeek, HabitMark} from "@/lib/class-habits";
export default async function PersonalHabits({memberId, readOnly = false}: {memberId: string; readOnly?: boolean}) {
 const db = await createClient();
 const {data: relationship, error} = await db.from("coaching_relationships").select("id,starts_on,status").eq("member_id", memberId).maybeSingle();
 if (error) throw new Error("Personal habits could not be loaded.");
 if (!relationship) return <p>No personal training plan is available.</p>;
 const {data, error: weeksError} = await db.from("class_habit_weeks").select("*").eq("relationship_id", relationship.id).order("week_number");
 if (weeksError) throw new Error("Habit weeks could not be loaded.");
 const weeks = (data ?? []) as HabitWeek[], ids = weeks.map(w => w.id), today = detroitToday();
 const [marks, revisions] = ids.length ? await Promise.all([
  db.from("class_habit_marks").select("*").in("week_id", ids),
  db.from("habit_week_revisions").select("*").in("week_id", ids).order("created_at", {ascending: false}),
 ]) : [{data: [], error: null}, {data: [], error: null}];
 if (marks.error || revisions.error) throw new Error("Habit progress could not be loaded.");
 const weekNumber = Math.max(1, Math.floor((Date.parse(mondayOf(today))-Date.parse(mondayOf(relationship.starts_on)))/604800000)+1);
 return <ClassTracker enrollmentId="" relationshipId={relationship.id} sessionName="Personal training" startsOn={relationship.starts_on} endsOn="9999-12-31" today={today} weekNumber={weekNumber} weeks={weeks} marks={(marks.data ?? []) as HabitMark[]} revisions={revisions.data ?? []} readOnly={readOnly || relationship.status !== "active"} />;
}
