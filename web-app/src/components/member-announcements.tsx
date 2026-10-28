import { verifySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MemberAnnouncements() {
  await verifySession();
  const db = await createClient();
  // The member's authenticated client enforces audience and draft visibility via RLS.
  const { data, error } = await db.from("announcements")
    .select("id,title,body,published_at")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .order("id");
  if (error) return <section className="member-card"><h2>Updates from Kelsey</h2><p>Updates couldn’t load. Please refresh to try again.</p></section>;
  if (!data?.length) return null;
  const [latest, ...older] = data;
  return <section className="member-card member-announcements" aria-label="Announcements">
    <span className="member-kicker">Updates from Kelsey</span>
    <h2>{latest.title}</h2>
    <p className="announcement-body">{latest.body}</p>
    {older.length > 0 && <details><summary>Earlier updates ({older.length})</summary>
      {older.map(item => <article key={item.id}><h3>{item.title}</h3><p className="announcement-body">{item.body}</p></article>)}
    </details>}
  </section>;
}
