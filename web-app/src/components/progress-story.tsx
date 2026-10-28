import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import Link from "next/link";
import { progressStoryData } from "@/lib/progress-story-data";
import { STORY_COOKIE, storyDate, storyDay, storyPreset, type StorySummary, type StoryRecap } from "@/lib/progress-story";
import { StoryEntryForm, RemoveStoryWin } from "./story-forms";
import "./progress-story.css";

export function StoryTotals({ summary }: { summary: StorySummary }) {
  return <dl className="story-totals">
    <div><dt>Workouts completed</dt><dd>{summary.workouts}</dd></div>
    <div><dt>Classes attended</dt><dd>{summary.classes}</dd></div>
    <div><dt>Days with a habit</dt><dd>{summary.habitDays}</dd></div>
  </dl>;
}
export function RecapCard({ recap }: { recap: StoryRecap }) {
  return <article className="story-recap">
    <div className="story-byline"><span className="story-avatar" aria-hidden="true">K</span><div><strong>A note from Kelsey</strong><span>{recap.published_at ? storyDate(storyDay(recap.published_at)) : "Draft · only you can see this"}</span></div></div>
    {recap.goal_snapshot ? <p className="story-recap-goal">What you’re working toward: <q>{recap.goal_snapshot}</q></p> : null}
    <p className="story-words">{recap.body}</p>
    <details><summary>Your activity for this recap · {storyDate(recap.period_start)}–{storyDate(recap.period_end)}</summary><StoryTotals summary={recap.summary} />{recap.summary.partials > 0 ? <p>{recap.summary.partials} partial session{recap.summary.partials === 1 ? "" : "s"} saved, too.</p> : null}</details>
  </article>;
}
export async function ProgressStory() {
  const [d, cookieStore] = await Promise.all([progressStoryData(), cookies()]);
  const goal = d.goals.at(-1), original = d.goals[0];
  const suggestion = storyPreset(cookieStore.get(STORY_COOKIE)?.value)?.goal || d.suggestion;
  const published = d.recaps.filter(r => r.published_at);
  return <section className="progress-story" aria-labelledby="story-heading" id="my-story">
    <div className="story-heading"><span className="story-eyebrow">Your story, still unfolding</span><h2 id="story-heading">This is why you started.</h2><p>There’s more to progress than a number. Keep the moments that matter to you.</p></div>
    <div className="story-goal" id="story-goal">
      {goal ? <><span className="story-eyebrow">What you’re working toward</span><blockquote>{goal.goal}</blockquote><p className="story-muted">You saved this on {storyDate(storyDay(goal.created_at))}.</p>
        {original && original.id !== goal.id ? <details><summary>Your original reason for starting</summary><blockquote className="story-original">{original.goal}</blockquote><p className="story-muted">{storyDate(storyDay(original.created_at))}</p></details> : null}
        <details className="story-goal-edit"><summary>Has your goal changed?</summary><p className="story-muted">Save what matters now. Your original goal and earlier recaps stay in your story.</p><StoryEntryForm kind="goal" id={randomUUID()} suggestion={goal.goal} /></details>
      </> : <StoryEntryForm kind="goal" id={randomUUID()} suggestion={suggestion} />}
    </div>
    <section className="story-period"><div><span className="story-eyebrow">The last six weeks</span><h3>You made time for yourself.</h3><p className="story-muted">{storyDate(d.start)}–{storyDate(d.end)} · Across your programs</p></div><StoryTotals summary={d.summary} />
      {d.summary.partials > 0 ? <p>{d.summary.partials} partial session{d.summary.partials === 1 ? "" : "s"} saved along the way.</p> : null}
      <p className="story-muted">{d.activities.length ? "Based on your saved workouts, checked habits, and classes marked attended. This is a record, not a score." : "Your first saved workout, habit, or attended class will start filling this in. There’s nothing to catch up on."}</p>
    </section>
    <section className="story-wins"><h3>The little things are the big things.</h3><StoryEntryForm kind="win" id={randomUUID()} />
      {d.reflections.length ? <details className="story-reflections" open><summary>Your words from the last six weeks</summary><div className="story-reflection-grid">{d.reflections.map(w => <article key={w.id}><span className="story-eyebrow">{w.source} · {storyDate(w.day)}</span><p className="story-words">“{w.body}”</p>{w.removable ? <RemoveStoryWin id={w.id} /> : null}</article>)}</div></details> : null}
      {d.wins.some(w => storyDay(w.created_at) < d.start) ? <details><summary>Earlier personal wins · most recent 50 saved wins</summary>{d.wins.filter(w => storyDay(w.created_at) < d.start).map(w => <article className="story-older-win" key={w.id}><span className="story-muted">{storyDate(storyDay(w.created_at))}</span><p className="story-words">{w.body}</p><RemoveStoryWin id={w.id} /></article>)}</details> : null}
    </section>
    <section className="story-notes" id="coach-recaps"><h3>Seen by your coach.</h3>{published.length ? <><RecapCard recap={published[0]} />{published.length > 1 ? <details><summary>Earlier recaps · {published.length - 1}</summary>{published.slice(1).map(r => <RecapCard recap={r} key={r.id} />)}</details> : null}</> : <p className="story-muted">When Kelsey adds a personal recap, you’ll find it here alongside your progress.</p>}</section>
  </section>;
}
export async function StoryTodayCard({ challengeId }: { challengeId?: string }) {
  // A compact, independent read keeps the workout home fast.
  const { verifySession } = await import("@/lib/auth");
  const { createClient } = await import("@/lib/supabase/server");
  const auth = await verifySession(), db = await createClient();
  const [goal, recap] = await Promise.all([
    db.from("member_story_goals").select("goal").eq("member_id", auth.userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("member_story_recaps").select("published_at").eq("member_id", auth.userId).not("published_at", "is", null).order("published_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (goal.error || recap.error) return <Link className="member-more-link" href="/portal/progress#my-story">Open your progress story →</Link>;
  return <Link className="story-today" href={`/portal/progress${challengeId ? `?challenge=${challengeId}` : ""}#${recap.data ? "coach-recaps" : "story-goal"}`}><div><span className="story-eyebrow">{recap.data ? "A personal recap from Kelsey" : "Your reason for starting"}</span><strong>{goal.data?.goal || "What would getting stronger let you do?"}</strong><p>{recap.data ? `Saved ${storyDate(storyDay(recap.data.published_at))} · Read your story` : goal.data ? "See the moments you’re building along the way." : "Save one thing that matters to you. We’ll keep it in view."}</p></div><span aria-hidden="true">↗</span></Link>;
}
