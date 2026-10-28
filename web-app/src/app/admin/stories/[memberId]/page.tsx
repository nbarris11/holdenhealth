import { randomUUID } from "node:crypto";
import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import { progressStoryData } from "@/lib/progress-story-data";
import { storyDate } from "@/lib/progress-story";
import { StoryTotals, RecapCard } from "@/components/progress-story";
import RecapEditor from "../recap-editor";

export default async function MemberStoryAdmin({ params }: { params: Promise<{ memberId: string }> }) {
  await verifyAdmin();
  const { memberId } = await params;
  let d = await progressStoryData(memberId);
  const draft = d.recaps.find(r => !r.published_at);
  if (draft && draft.period_end !== d.end) d = await progressStoryData(memberId, draft.period_end);
  const goal = d.goals.at(-1);
  return <main className="app-shell admin-shell workspace-page story-admin">
    <header className="workspace-page-header"><div><Link href="/admin/stories" className="back-link">← Member stories</Link><h1>{d.name}’s story</h1><p>A little preparation. A personal moment of recognition.</p></div></header>
    <div className="story-goal"><span className="story-eyebrow">Their reason for starting</span>{goal ? <blockquote>{goal.goal}</blockquote> : <p>This member hasn’t saved a story goal yet. They can add it in Progress.</p>}</div>
    <div className="story-admin-grid"><section><span className="story-eyebrow">Saved activity · {storyDate(d.start)}–{storyDate(d.end)}</span><h2>What you can recognize</h2><StoryTotals summary={d.summary} />{d.summary.partials ? <p>{d.summary.partials} partial sessions saved.</p> : null}<p className="story-muted">Class totals include confirmed attendance only. Reflections below are the member’s own words.</p>
      {d.reflections.length ? d.reflections.map(w => <article className="story-recap" key={w.id}><span className="story-eyebrow">{w.source} · {storyDate(w.day)}</span><p className="story-words">{w.body}</p></article>) : <p className="story-muted">No written wins or check-in reflections in this period yet.</p>}
      <details><summary>Recent activity in this period</summary>{d.activities.filter(a => a.kind !== "habit").slice(0, 30).map(a => <p key={a.id}><strong>{storyDate(a.day)}</strong> · {a.label}{a.kind === "partial" ? " (partial)" : ""}</p>)}{!d.activities.length ? <p>No recorded activity yet.</p> : null}</details>
    </section><section><h2>{draft ? "Continue your recap" : "Write a personal recap"}</h2><RecapEditor key={`${draft?.id || "new"}-${draft?.updated_at || d.recaps[0]?.id || "first"}`} id={draft?.id || randomUUID()} memberId={memberId} name={d.name} body={draft?.body || ""} version={draft?.updated_at || ""} goal={goal?.goal || ""} summary={d.summary} start={d.start} end={d.end} /></section></div>
    <section className="workspace-section"><h2>Published recaps</h2>{d.recaps.filter(r => r.published_at).map(r => <RecapCard key={r.id} recap={r} />)}{!d.recaps.some(r => r.published_at) ? <p className="story-muted">The first published recap will appear here and in this member’s Progress screen.</p> : null}</section>
  </main>;
}
