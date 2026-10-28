import Link from "next/link";
import { memberData } from "@/lib/member-data";
import { dateLabel, detroitToday } from "@/lib/challenge";
import { mondayOf } from "@/lib/workout-app";
import { ProgramPicker } from "@/components/member-shared";
import { ProgressStory } from "@/components/progress-story";
export default async function Progress({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const d = await memberData((await searchParams).challenge),
    completed = d.logs.filter((l) => l.status === "completed");
  const days = new Set(d.marks.filter((m) => m.completed).map((m) => m.day));
  const fullDays = [...days].filter(
    (day) => d.marks.filter((m) => m.completed && m.day === day).length === 3,
  ).length;
  return (
    <main className="member-page">
      <span className="member-kicker">Look how far you’ve come</span>
      <h1>Your progress</h1>
      <p className="member-muted">
        Every session is time you made for yourself. Partial sessions are saved,
        too.
      </p>
      <ProgressStory />
      <h2>Your workout history</h2>
      <ProgramPicker joined={d.joined} current={d.challenge} destination="/portal/progress" />
      <p className="member-muted">Workout history includes all your challenges. Habit totals reflect the challenge selected above.</p>
      <div className="member-stat-grid">
        <div className="member-card member-stat">
          <strong>
            {completed.filter((l) => l.performed_on >= mondayOf(d.today))
              .length +
              d.trainingLogs.filter(
                (l) =>
                  detroitToday(new Date(l.completed_at)) >= mondayOf(d.today),
              ).length}
            {d.participant ? ` / ${d.participant.weekly_workouts}` : ""}
          </strong>
          <span>Workouts this week</span>
        </div>
        <div className="member-card member-stat">
          <strong>{completed.length}</strong>
          <span>Challenge workouts completed</span>
        </div>
        <div className="member-card member-stat">
          <strong>{fullDays}</strong>
          <span>All three habits · selected challenge</span>
        </div>
      </div>
      <section className="member-card">
        <h2>Your session history</h2>
        {d.logs.length ? (
          <div className="member-list">
            {d.logs.map((l) => (
              <article key={l.id}>
                <div className="member-meta">
                  <span>{dateLabel(l.performed_on)}</span>
                  <span
                    className={`member-pill ${l.status === "completed" ? "green" : "neutral"}`}
                  >
                    {l.status === "completed" ? "Completed" : "Partial session"}
                  </span>
                  <span>
                    {Math.floor(l.elapsed_seconds / 60)}m{" "}
                    {l.elapsed_seconds % 60}s
                  </span>
                </div>
                <h3>{l.workout_title}</h3>
                {l.effort && (
                  <p className="member-muted">Effort: {l.effort}/10</p>
                )}
                {l.note && <p className="member-plan">{l.note}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="member-empty">
            <p>Your first saved session will appear here.</p>
            <Link
              className="member-button"
              href={`/portal/workouts${d.challenge ? `?challenge=${d.challenge.id}` : ""}`}
            >
              Find your workout
            </Link>
          </div>
        )}
      </section>
      {d.training && (
        <Link className="member-more-link" href="/portal/training">
          <div>
            <strong>Personal training progress</strong>
            <p>
              {d.trainingLogs.length} personal workouts completed. Open your
              private training logs and Kelsey’s feedback.
            </p>
          </div>
          <span>→</span>
        </Link>
      )}
    </main>
  );
}
