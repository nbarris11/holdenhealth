import type { TimerConfig } from "./workout-timer";

export type WorkoutStep = {
  section: "Warm-up" | "Main work" | "Cool-down";
  title: string;
  dose: string;
  instructions: string;
  easier: string;
  demo: string;
};
export type WorkoutLog = {
  id: string;
  participant_id: string | null;
  enrollment_id?: string | null;
  workout_id: string;
  status: "completed" | "partial";
  elapsed_seconds: number;
  effort: number | null;
  note: string;
  performed_on: string;
  completed_at: string;
  workout_title: string;
  workout_revision: number;
};
// Countdown workouts repeat only their main circuit, until the clock expires.
// Return null when the next action is the session check-in.
export function nextWorkoutStep(
  steps: Pick<WorkoutStep, "section">[],
  index: number,
  config: TimerConfig,
  elapsedSeconds: number,
): number | null {
  if (config.mode === "countdown" && steps[index]?.section === "Main work") {
    const first = steps.findIndex((step) => step.section === "Main work");
    let last = steps.length - 1;
    while (steps[last].section !== "Main work") last--;
    if (elapsedSeconds >= config.durationSeconds) {
      return last + 1 < steps.length ? last + 1 : null;
    }
    if (index === last) return first;
  }
  return index + 1 < steps.length ? index + 1 : null;
}
export function validSteps(value: unknown): value is WorkoutStep[] {
  return (
    Array.isArray(value) &&
    value.length <= 40 &&
    value.every(
      (s) =>
        s &&
        typeof s === "object" &&
        ["Warm-up", "Main work", "Cool-down"].includes(s.section) &&
        typeof s.title === "string" &&
        s.title.trim().length > 0 &&
        s.title.length <= 140 &&
        typeof s.dose === "string" &&
        s.dose.length <= 120 &&
        typeof s.instructions === "string" &&
        s.instructions.length <= 1500 &&
        typeof s.easier === "string" &&
        s.easier.length <= 600 &&
        typeof s.demo === "string" &&
        s.demo.length <= 2000 &&
        (!s.demo || validDemo(s.demo)),
    )
  );
}
export function validDemo(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function selfPacedTimer(minutes: number): TimerConfig {
  return {
    mode: "stopwatch",
    durationSeconds: Math.min(10800, Math.max(60, minutes * 60)),
    workSeconds: 20,
    restSeconds: 10,
    rounds: 1,
  };
}
export function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function sessionKey(
  userId: string,
  workoutId: string,
  revision: number,
) {
  return `holden:workout-session:${userId}:${workoutId}:${revision}`;
}
