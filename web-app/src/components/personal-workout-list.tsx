import {createClient} from "@/lib/supabase/server";
import {detroitToday,dateLabel} from "@/lib/challenge";
import Link from "next/link";
export default async function PersonalWorkoutList({relationshipId,preview=false}: {relationshipId:string;preview?:boolean}) {
 const db=await createClient();
 const [workouts,logs]=await Promise.all([
  db.from("challenge_workouts").select("id,title,minutes,publish_on").eq("relationship_id",relationshipId).eq("published",true).eq("archived",false).lte("publish_on",detroitToday()).order("publish_on",{ascending:false}),
  db.from("challenge_workout_logs").select("id,workout_title,completed_at,status,elapsed_seconds,note").eq("relationship_id",relationshipId).order("completed_at",{ascending:false}).limit(100),
 ]);
 if(workouts.error||logs.error)throw new Error("Your workouts could not be loaded.");
 return <section className="panel" id="assigned-workouts"><h2>Your workouts</h2><p>Open a workout for exercises, reps, demonstrations, and your timer.</p>{workouts.data?.length ? workouts.data.map(w=><article className="soft-note" key={w.id}><h3>{w.title}</h3><p>{dateLabel(w.publish_on)} · {w.minutes} minutes</p><Link className="button primary" href={`/portal/workouts/${w.id}${preview?"?preview=1":""}`}>{preview?"Preview workout":"Open workout"}</Link></article>):<p>Kelsey will add your next workout here.</p>}
 {!preview && <div className="button-row"><Link className="button secondary" href="/portal/training/habits">Weekly habits</Link><Link className="button secondary" href="/portal/progress">My progress</Link></div>}
 {(logs.data?.length??0)>0&&<details><summary>Recent workout history · {logs.data?.filter(l=>l.status==="completed").length} completed in the latest 100 sessions</summary>{logs.data?.map(l=><article className="soft-note" key={l.id}><strong>{l.workout_title}</strong><p>{new Date(l.completed_at).toLocaleDateString("en-US",{timeZone:"America/Detroit"})} · {l.status==="completed"?"Completed":"Partial"} · {Math.round(l.elapsed_seconds/60)} minutes</p>{l.note&&<p>{l.note}</p>}</article>)}</details>}</section>;
}
