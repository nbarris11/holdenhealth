import Link from "next/link";
import { memberData } from "@/lib/member-data";
import MemberAlerts from "@/components/member-alerts";
import {
  EmptyWorkouts,
  WorkoutCard,
  ProgramPicker,
} from "@/components/member-shared";
export default async function Workouts({
  searchParams,
}: {
  searchParams: Promise<{
    challenge?: string;
    program?: string;
    minutes?: string;
    level?: string;
    equipment?: string;
  }>;
}) {
  const p = await searchParams,
    d = await memberData(p.challenge, p.program);
  const list = d.workouts.filter(
    (w) =>
      (!p.minutes || w.minutes <= Number(p.minutes)) &&
      (!p.level || (w.level || "All levels") === p.level) &&
      (!p.equipment ||
        w.equipment.toLowerCase().includes(p.equipment.toLowerCase())),
  );
  return (
    <main className="member-page workout-library">
      <span className="member-kicker">Your daily practice</span>
      <h1>Your workouts</h1>
      <p className="member-muted">
        A little stronger. A little more you. Find your session.
      </p>
      <MemberAlerts challenge={p.challenge} />
      <ProgramPicker
        joined={d.joined}
        current={d.challenge}
        destination="/portal/workouts"
      />
      {d.classPrograms.length > 0 && <nav className="member-programs" aria-label="Your class programs">
        <Link className={`member-pill ${!p.program && !p.challenge ? "green" : "neutral"}`} href="/portal/workouts">All workouts</Link>
        {d.classPrograms.map(program => <Link key={program.id} className={`member-pill ${p.program === program.id ? "green" : "neutral"}`} href={`/portal/workouts?program=${program.id}`}>{program.name}</Link>)}
      </nav>}
      {d.training && (
        <Link className="member-more-link" href="/portal/training">
          <div>
            <strong>Your personal training plan</strong>
            <p>Your workout options, coach feedback, and weekly planning with Kelsey.</p>
          </div>
          <span>→</span>
        </Link>
      )}
      {d.workouts.length ? (
        <>
          <details
            className="workout-filters"
            open={Boolean(p.minutes || p.level || p.equipment)}
          >
            <summary>
              Find your fit{" "}
              <span>
                Time, level & equipment <span aria-hidden="true">+</span>
              </span>
            </summary>
            <form className="member-filter">
              <input
                type="hidden"
                name="challenge"
                value={p.challenge || ""}
              />
              <input type="hidden" name="program" value={p.program || ""} />
              <label className="member-field">
                Time
                <select name="minutes" defaultValue={p.minutes || ""}>
                  <option value="">Any length</option>
                  <option value="10">10 minutes or less</option>
                  <option value="20">20 minutes or less</option>
                  <option value="30">30 minutes or less</option>
                </select>
              </label>
              <label className="member-field">
                Level
                <select name="level" defaultValue={p.level || ""}>
                  <option value="">All levels</option>
                  <option>Beginner</option>
                  <option value="All levels">Suitable for all levels</option>
                  <option>Intermediate</option>
                </select>
              </label>
              <label className="member-field">
                Equipment
                <input
                  name="equipment"
                  defaultValue={p.equipment || ""}
                  placeholder="e.g. chair"
                  maxLength={100}
                />
              </label>
              <button className="member-button">Find workouts</button>
            </form>
          </details>
          <p className="member-muted">
            {list.length} {list.length === 1 ? "workout" : "workouts"}
          </p>
          <div className="workout-library-grid">
            {list.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                done={d.logs.some(
                  (l) => l.workout_id === w.id && l.status === "completed",
                )}
              />
            ))}
          </div>
          {!list.length && (
            <p className="member-empty">No matches. Try a different filter.</p>
          )}
        </>
      ) : (
        <EmptyWorkouts challenge={d.challenge} classProgram={d.classPrograms.find(c => c.id === p.program) ?? d.classPrograms[0]} />
      )}
    </main>
  );
}
