import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { storyDate, storyDay, storyMemberName } from "@/lib/progress-story";
import "@/components/progress-story.css";

export default async function MemberStories({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await verifyAdmin();
  const { q = "" } = await searchParams;
  const db = await createClient();
  const [goals, recaps, wins, participants] = await Promise.all([
    db.from("member_story_goals").select("member_id,goal,created_at,profiles(full_name)").order("created_at", { ascending: false }),
    db.from("member_story_recaps").select("member_id,published_at,created_at").order("created_at", { ascending: false }),
    db.from("member_story_wins").select("member_id,created_at").order("created_at", { ascending: false }),
    db.from("challenge_participants").select("user_id,display_name,joined_on").order("joined_on", { ascending: false }),
  ]);
  if ([goals, recaps, wins, participants].some(r => r.error)) throw new Error("Member stories could not be loaded. Please try again.");
  const challengeNames = new Map<string, string>();
  for (const participant of participants.data ?? []) {
    if (!challengeNames.has(participant.user_id) && participant.display_name?.trim()) challengeNames.set(participant.user_id, participant.display_name);
  }
  const seen = new Set<string>();
  const members = (goals.data ?? []).filter(g => { if (seen.has(g.member_id)) return false; seen.add(g.member_id); return true; }).map(g => {
    const profile = g.profiles as unknown as { full_name: string };
    const latest = (recaps.data ?? []).find(r => r.member_id === g.member_id && r.published_at);
    const draft = (recaps.data ?? []).some(r => r.member_id === g.member_id && !r.published_at);
    const newWins = (wins.data ?? []).filter(w => w.member_id === g.member_id && (!latest || w.created_at > latest.published_at!)).length;
    return { ...g, name: storyMemberName(profile?.full_name, challengeNames.get(g.member_id)), latest, draft, newWins };
  }).filter(m => m.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a,b) => Number(b.draft) - Number(a.draft) || b.newWins - a.newWins || (a.latest?.published_at || "").localeCompare(b.latest?.published_at || ""));
  return <main className="app-shell admin-shell workspace-page story-admin"><header className="workspace-page-header"><div><span className="eyebrow">Coaching moments</span><h1>Member stories</h1><p>Their reason for starting, the little wins, and your words of encouragement.</p></div></header>
    <p className="story-muted">Review at the end of a training block, or whenever there’s something worth recognizing. Members appear after saving a goal in Progress. Nothing is sent automatically.</p>
    <form className="stack-form" role="search"><label htmlFor="story-search">Find a member<input id="story-search" name="q" defaultValue={q} maxLength={120} type="search" /></label><button className="button secondary">Search stories</button></form>
    <section className="workspace-section story-person-list">{members.length ? members.map(m => <Link className="story-person" key={m.member_id} href={`/admin/stories/${m.member_id}`}><h2>{m.name}</h2><p className="story-words">“{m.goal}”</p><div className="story-person-meta">{m.draft ? <strong>Draft in progress</strong> : null}{m.newWins ? <strong>{m.newWins} new personal win{m.newWins === 1 ? "" : "s"}</strong> : null}<span>{m.latest?.published_at ? `Last recap ${storyDate(storyDay(m.latest.published_at))}` : "First recap to write"}</span><span>Open story →</span></div></Link>) : <div className="panel calm-empty"><h2>{q ? "No matching stories" : "The first story starts with a goal."}</h2><p>{q ? "Try a different member name." : "Ask a member to open Progress and save what getting stronger would let them do. Their goal and activity will be here for your next review."}</p></div>}</section>
  </main>;
}
