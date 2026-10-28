import Link from "next/link";
import WorkoutIcon from "./workout-icon";
import type { Challenge, Workout } from "@/lib/challenge";
export function ProgramPicker({
  joined,
  current,
  destination = "/portal/today",
}: {
  joined: Challenge[];
  current?: Challenge;
  destination?: "/portal/today" | "/portal/workouts" | "/portal/progress";
}) {
  return joined.length > 1 ? (
    <nav className="member-programs" aria-label="Your challenges">
      {joined.map((c) => (
        <Link
          className={`member-pill ${c.id === current?.id ? "green" : "neutral"}`}
          aria-current={c.id === current?.id ? "page" : undefined}
          key={c.id}
          href={`${destination}?challenge=${c.id}`}
        >
          {c.title}
        </Link>
      ))}
    </nav>
  ) : null;
}
export function WorkoutCard({
  workout,
  done = false,
}: {
  workout: Workout;
  done?: boolean;
}) {
  return (
    <Link
      className="member-workout-card"
      href={`/portal/workouts/${workout.id}`}
    >
      <div className="workout-card-art">
        <span className="workout-card-focus">
          {workout.focus || "Full body"}
        </span>
        <div className="workout-card-duration">
          <strong>{workout.minutes}</strong>
          <span>MIN</span>
        </div>
        <span className="workout-card-play">
          <WorkoutIcon name={done ? "check" : "play"} />
        </span>
      </div>
      <div className="workout-card-content">
        <div className="workout-card-meta">
          <span>{workout.level || "All levels"}</span>
          <span>
            {done
              ? "Completed"
              : workout.steps?.length
                ? `${workout.steps.length} steps`
                : "At your pace"}
          </span>
        </div>
        <h3>{workout.title}</h3>
        <p>{workout.equipment || "Check the plan for equipment"}</p>
        <div className="member-card-bottom">
          <span>{done ? "Move with it again" : "Make time for movement"}</span>
          <WorkoutIcon name="next" />
        </div>
      </div>
    </Link>
  );
}
export function EmptyWorkouts({ challenge, classProgram }: { challenge?: Challenge; classProgram?: { name: string; starts_on: string } }) {
  return (
    <div className="member-card member-empty">
      <span className="member-kicker">Your workout library</span>
      <h2>
        {challenge || classProgram
          ? "Your next workout is on its way."
          : "Start with a challenge."}
      </h2>
      <p>
        {classProgram ? `Kelsey will release at-home workouts for ${classProgram.name} here. Check back for the next release.` : challenge
          ? `Kelsey will release your workouts here. ${challenge.starts_on > new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" }) ? `Your challenge begins ${new Date(challenge.starts_on + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}.` : "Check back for the next release."}`
          : "Join a free challenge to get your workouts and daily habits in one place."}
      </p>
      {!challenge && !classProgram && (
        <Link className="member-button" href="/challenge">
          Explore the challenge
        </Link>
      )}
    </div>
  );
}
