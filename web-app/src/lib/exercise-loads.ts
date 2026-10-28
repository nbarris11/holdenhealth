import type { WorkoutStep } from "./workout-app";

export type ExerciseLoad = {
  stepIndex: number;
  title: string;
  weightLbs: number;
  reps: number | null;
};

export function validExerciseLoads(value: unknown, steps: WorkoutStep[]): value is ExerciseLoad[] {
  return Array.isArray(value) && value.length <= steps.length && value.length <= 40 &&
    value.every((entry) => entry && typeof entry === "object" &&
      Number.isInteger(entry.stepIndex) && entry.stepIndex >= 0 &&
      steps[entry.stepIndex]?.section === "Main work" &&
      entry.title === steps[entry.stepIndex].title &&
      typeof entry.weightLbs === "number" && Number.isFinite(entry.weightLbs) &&
      entry.weightLbs >= 0 && entry.weightLbs <= 2000 &&
      Math.round(entry.weightLbs * 4) === entry.weightLbs * 4 &&
      (entry.reps === null || (Number.isInteger(entry.reps) && entry.reps >= 1 && entry.reps <= 500))) &&
    new Set(value.map((entry) => entry.stepIndex)).size === value.length;
}

export function displayExerciseLoad(load: ExerciseLoad) {
  return `${load.weightLbs} lb${load.reps === null ? "" : ` × ${load.reps} reps`}`;
}
