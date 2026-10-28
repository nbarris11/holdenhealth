"use server";
import {verifyAdmin} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
export async function saveActivityPreferences(form: FormData) {
 const user=await verifyAdmin(),db=await createClient();
 const {error}=await db.from("coach_activity_preferences").upsert({user_id:user.userId,email_habits:form.get("emailHabits")==="on",email_workouts:form.get("emailWorkouts")==="on",updated_at:new Date().toISOString()});
 if(error)throw new Error("Notification preferences did not save.");
 revalidatePath("/admin/activity");redirect("/admin/activity?saved=1");
}
export async function markActivityRead(form: FormData) {
 const user=await verifyAdmin(),db=await createClient(),through=String(form.get("through")||"");
 if(!Number.isFinite(Date.parse(through)) || Date.parse(through)>Date.now())throw new Error("Reload your activity inbox.");
 const {data:existing,error:readError}=await db.from("coach_activity_preferences").select("read_through").eq("user_id",user.userId).maybeSingle();
 if(readError)throw new Error("Activity could not be marked read.");
 const readThrough=existing?.read_through && existing.read_through>through ? existing.read_through:through;
 const {error}=await db.from("coach_activity_preferences").upsert({user_id:user.userId,read_through:readThrough});
 if(error)throw new Error("Activity could not be marked read.");
 revalidatePath("/admin/activity");
}
