import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Relationship = { id: string; member_id: string; service_mode: string; status: string; primary_goal: string | null; next_review_on: string | null };
type Program = { id: string; name: string; starts_on: string; ends_on: string; status: string; published: boolean };
const statusLabels: Record<string, string> = { draft: "Preparing", enrolling: "Accepting registrations", full: "Full", active: "In progress", completed: "Completed", cancelled: "Cancelled" };
const programDate = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

type Profile = { id: string; full_name: string };

export default async function ProgramsPage() {
  await verifyAdmin();
  const supabase = await createClient();
  const [{ data: programData, error: programError }, { data: relationshipData }] = await Promise.all([
    supabase.from("sessions").select("id,name,starts_on,ends_on,status,published").order("starts_on"),
    supabase.from("coaching_relationships").select("id,member_id,service_mode,status,primary_goal,next_review_on").order("created_at", { ascending: false }),
  ]);
  if (programError) throw new Error("Programs could not be loaded. Please try again.");
  const programs = (programData ?? []) as Program[];
  const relationships = (relationshipData ?? []) as Relationship[];
  const currentRelationships = relationships.filter(row => row.status !== "withdrawn" && row.status !== "completed");
  const pastRelationships = relationships.filter(row => row.status === "withdrawn" || row.status === "completed");
  const memberIds = relationships.map((relationship) => relationship.member_id);
  const { data: profileData } = memberIds.length ? await supabase.from("profiles").select("id,full_name").in("id", memberIds) : { data: [] };
  const profiles = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));

  return <main className="app-shell admin-shell workspace-page training-programs-index">
    <header className="workspace-page-header"><div><span className="eyebrow">Coaching workspace</span><h1>Programs</h1><p>Manage class programs and personal training in one place.</p></div></header>
    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Group fitness</span><h2>Class programs</h2></div><div><p>Choose a program to manage its workouts, weekly habits, people, schedule, or details.</p><Link className="button primary" href="/admin/training/new">Create a class program</Link></div></div>
      <div className="program-client-grid">{programs.length ? programs.map(program => <article className="panel" key={program.id}>
        <div className="roster-heading"><h3>{program.name}</h3><span className={`status-pill ${program.status === "active" || program.status === "enrolling" ? "success" : "neutral"}`}>{statusLabels[program.status] || program.status}</span></div>
        <p>{programDate(program.starts_on)} – {programDate(program.ends_on)}</p>
        <p>{program.published ? "Visible to customers" : "Hidden from customers"}</p>
        <div className="button-row"><Link className="button primary" href={`/admin/programs/${program.id}/workouts`}>At-home workouts</Link><Link className="button secondary" href={`/admin/programs/${program.id}/habits`}>Weekly habits</Link><Link className="button secondary" href={`/admin/people?program=${program.id}`}>View people</Link><Link className="button secondary" href={`/admin/people/add?program=${program.id}`}>Add someone</Link><Link className="button secondary" href={`/admin/classes?program=${program.id}`}>Schedule</Link><Link className="button secondary" href={`/admin/settings?program=${program.id}`}>Program details</Link><Link className="button secondary" href={`/admin/communications/reviews?program=class:${program.id}`}>Request Google reviews</Link></div>
      </article>) : <div className="panel calm-empty"><h3>No class programs yet.</h3><p>Class programs will appear here once they have been set up.</p></div>}</div>
    </section>
    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Habit coaching</span><h2>Free challenges</h2></div><Link className="button secondary" href="/admin/challenges">Manage challenges</Link><Link className="button secondary" href="/admin/communications/reviews">Request Google reviews</Link></div></section>
    <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">Active coaching</span><h2>Personal-training clients</h2></div><p>Open a client to publish workouts, review their adjustments, and respond to progress. <Link href="/admin/people/add?program=personal-training">Add a client →</Link></p></div><div className="program-client-grid">{currentRelationships.length ? currentRelationships.map((relationship) => { const profile = profiles.get(relationship.member_id); return <Link className="panel" href={`/admin/training/${relationship.member_id}`} key={relationship.id}><div className="roster-heading"><div><h3>{profile?.full_name || "Member"}</h3><p>{relationship.primary_goal || "Goal not recorded"}</p></div><span className={`status-pill ${relationship.status === "active" ? "success" : "warning"}`}>{relationship.status}</span></div><dl><div><dt>Format</dt><dd>{relationship.service_mode.replace("_", " ")}</dd></div><div><dt>Next review</dt><dd>{relationship.next_review_on || "Not scheduled"}</dd></div></dl><b className="text-link">Open coaching workspace →</b></Link>; }) : <div className="panel calm-empty"><h3>No personal-training clients yet.</h3><p>Open People, select an existing member, and choose Add personal training. Group enrollment will stay unchanged.</p><Link className="button primary" href="/admin/people?people=all">Open People</Link></div>}</div></section>
    {pastRelationships.length > 0 && <section className="workspace-section"><h2>Past personal-training clients</h2><div className="panel member-list">{pastRelationships.map(row => <Link className="member-list-row" key={row.id} href={`/admin/training/${row.member_id}`}><strong>{profiles.get(row.member_id)?.full_name || "Member"}</strong><span>{row.status} · Open record →</span></Link>)}</div></section>}
  </main>;
}
