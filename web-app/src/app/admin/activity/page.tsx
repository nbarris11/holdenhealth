import {verifyAdmin} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {activityLabel,queueCoachActivityDelivery} from "@/lib/coach-activity";
import {saveActivityPreferences,markActivityRead} from "./actions";
import Link from "next/link";
export default async function Page({searchParams}: {searchParams: Promise<{saved?:string; page?:string}>}) {
 const user=await verifyAdmin(),db=await createClient(),params=await searchParams;
 const page=Math.max(0,Math.min(10000,Number(params.page)||0));
 const [events,prefs]=await Promise.all([
  db.from("coach_activity").select("id,kind,href,created_at,profiles(full_name)").order("created_at",{ascending:false}).range(page*50,page*50+49),
  db.from("coach_activity_preferences").select("*").eq("user_id",user.userId).maybeSingle(),
 ]);
 if(events.error||prefs.error)throw new Error("Activity could not be loaded.");
 queueCoachActivityDelivery();
 return <main className="app-shell workspace-page"><header className="workspace-page-header"><h1>Member activity</h1><p>Weekly habit choices, habit changes, and completed workouts. Refresh to see the latest activity.</p></header>
 <details className="panel" open={!prefs.data}><summary>Email notifications</summary><form className="stack-form" action={saveActivityPreferences}><p>Send alerts to {user.email}. Alerts begin when enabled; previous activity is not emailed.</p><label className="check-label"><input type="checkbox" name="emailHabits" defaultChecked={prefs.data?.email_habits??false}/>Habit choices and changes</label><label className="check-label"><input type="checkbox" name="emailWorkouts" defaultChecked={prefs.data?.email_workouts??false}/>Completed workouts</label><button className="button primary">Save notification preferences</button></form></details>
 {params.saved && <p className="notice success" role="status">Notification preferences saved.</p>}
 <section className="panel"><h2>Recent activity</h2>{events.data?.length ? <><form action={markActivityRead}><input type="hidden" name="through" value={events.data[0].created_at}/><button className="button secondary">Mark these updates read</button></form>{events.data.map(event=><article className="soft-note" key={event.id}><strong>{(event.profiles as unknown as {full_name:string}|null)?.full_name||"Member"}</strong><p>{activityLabel(event.kind)} · {new Date(event.created_at).toLocaleString("en-US",{timeZone:"America/Detroit"})} Eastern {(!prefs.data?.read_through||event.created_at>prefs.data.read_through)&&<span className="status-pill">New</span>}</p><Link href={event.href}>Review progress →</Link></article>)}</>:<p>No activity yet. New submissions will appear here.</p>}</section>
 <div className="button-row">{page>0&&<Link href={`/admin/activity?page=${page-1}`}>Newer updates</Link>}{events.data?.length===50&&<Link href={`/admin/activity?page=${page+1}`}>Older updates</Link>}</div></main>;
}
