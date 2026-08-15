import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth";
import { signOut } from "@/app/actions";

type SessionSummary = {
  name: string; starts_on: string; ends_on: string; address_line: string; city: string; state: string;
};

export default async function PortalPage() {
  const session = await verifySession();
  const supabase = await createClient();
  const [{ data: profile }, { data: enrollmentRows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
    supabase.from("enrollments").select("id,status,session_id,sessions(name,starts_on,ends_on,address_line,city,state)").eq("member_id", session.userId).in("status", ["invited", "active", "completed"]).order("created_at", { ascending: false }).limit(1),
  ]);

  const enrollment = enrollmentRows?.[0];
  const program = enrollment?.sessions as unknown as SessionSummary | null;
  const { data: nextMeeting } = enrollment
    ? await supabase.from("class_meetings").select("starts_at,ends_at,title").eq("session_id", enrollment.session_id).eq("cancelled", false).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle()
    : { data: null };
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><span className="eyebrow">Holden Health</span><h1>Hi, {firstName}.</h1></div>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </header>
      {program ? (
        <div className="dashboard-grid">
          <section className="panel hero-panel"><span className="eyebrow">Your current session</span><h2>{program.name}</h2><p>{program.address_line}, {program.city}, {program.state}</p></section>
          <section className="panel"><span className="eyebrow">Up next</span><h2>{nextMeeting ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" }).format(new Date(nextMeeting.starts_at)) : "Schedule coming soon"}</h2><p>{nextMeeting?.title ?? "Kelsey will post your next class here."}</p></section>
          <section className="panel"><span className="eyebrow">Weekly check-in</span><h2>Notice what worked.</h2><p>Your four-question check-in and Kelsey’s response will live here.</p></section>
        </div>
      ) : (
        <section className="panel empty-state"><span className="eyebrow">Account ready</span><h2>Your session will appear after Kelsey completes your enrollment.</h2><p>If you have already paid or spoken with Kelsey, she may still be finishing the setup.</p><a className="button primary" href="mailto:HoldenHealth.Coaching@gmail.com">Contact Kelsey</a></section>
      )}
    </main>
  );
}
