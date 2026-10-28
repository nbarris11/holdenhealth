import type { Workout } from "./challenge";
import { validSteps, type WorkoutStep } from "./workout-app";
import { validTimer } from "./workout-timer";
import { safeHttps } from "./challenge";
export type Template = Pick<
  Workout,
  | "title"
  | "minutes"
  | "equipment"
  | "plan"
  | "exercises"
  | "level"
  | "focus"
  | "timer_config"
> & { steps: WorkoutStep[] };
export type LibraryContent = { steps: WorkoutStep[]; template?: Template };
export type LibraryItem = {
  id: string;
  name: string;
  kind: "exercise" | "block" | "workout";
  content: LibraryContent;
};
export function cleanLibraryContent(
  kind: unknown,
  value: unknown,
): LibraryContent | null {
  if (!value || typeof value !== "object") return null;
  const c = value as LibraryContent;
  if (!validSteps(c.steps)) return null;
  const steps = c.steps.map(
    ({ section, title, dose, instructions, easier, demo }) => ({
      section,
      title,
      dose,
      instructions,
      easier,
      demo,
    }),
  );
  if (kind === "exercise" || kind === "block")
    return steps.length && (kind !== "exercise" || steps.length === 1)
      ? { steps }
      : null;
  if (kind !== "workout" || !c.template) return null;
  const t = c.template;
  if (
    typeof t.title !== "string" ||
    !t.title.trim() ||
    t.title.length > 120 ||
    !Number.isInteger(t.minutes) ||
    t.minutes < 1 ||
    t.minutes > 180 ||
    typeof t.plan !== "string" ||
    !t.plan.trim() ||
    t.plan.length > 20000 ||
    typeof t.equipment !== "string" ||
    t.equipment.length > 200 ||
    !["Beginner", "All levels", "Intermediate"].includes(t.level || "") ||
    typeof t.focus !== "string" ||
    !t.focus.trim() ||
    t.focus.length > 80 ||
    (t.timer_config != null && !validTimer(t.timer_config)) ||
    !Array.isArray(t.exercises) ||
    t.exercises.length > 50 ||
    t.exercises.some(
      (e) =>
        !e ||
        typeof e.label !== "string" ||
        !e.label.trim() ||
        e.label.length > 140 ||
        typeof e.url !== "string" ||
        e.url.length > 2000 ||
        !safeHttps(e.url),
    )
  )
    return null;
  return {
    steps,
    template: {
      title: t.title,
      minutes: t.minutes,
      equipment: t.equipment,
      plan: t.plan,
      level: t.level,
      focus: t.focus,
      timer_config: t.timer_config ?? null,
      exercises: t.exercises.map(({ label, url }) => ({ label, url })),
      steps,
    },
  };
}

// A fresh copy of a saved workout's content for "Repeat on a new date".
// Leaves out id, release date and publish state so the copy is a new workout.
export function repeatTemplate(workout: Workout): Template {
  return structuredClone({
    title: workout.title,
    minutes: workout.minutes,
    equipment: workout.equipment,
    plan: workout.plan,
    exercises: workout.exercises,
    level: workout.level,
    focus: workout.focus,
    timer_config: workout.timer_config,
    steps: workout.steps ?? [],
  });
}
