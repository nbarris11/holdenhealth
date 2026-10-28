import assert from "node:assert/strict";
import { test } from "node:test";
import { validExerciseLoads, displayExerciseLoad } from "../src/lib/exercise-loads.ts";

const steps = [
  { section: "Warm-up", title: "March" },
  { section: "Main work", title: "Goblet squat" },
  { section: "Main work", title: "Dumbbell row" },
];

test("exercise logs accept optional bodyweight and reps", () => {
  assert.equal(validExerciseLoads([], steps), true);
  assert.equal(validExerciseLoads([{ stepIndex: 1, title: "Goblet squat", weightLbs: 0, reps: null }], steps), true);
  assert.equal(displayExerciseLoad({ stepIndex: 1, title: "Goblet squat", weightLbs: 25, reps: 10 }), "25 lb × 10 reps");
});

test("exercise logs reject changed workouts, duplicate steps, and invalid loads", () => {
  const good = { stepIndex: 1, title: "Goblet squat", weightLbs: 25, reps: 10 };
  assert.equal(validExerciseLoads([good, good], steps), false);
  assert.equal(validExerciseLoads([{ ...good, title: "Other" }], steps), false);
  assert.equal(validExerciseLoads([{ ...good, stepIndex: 0 }], steps), false);
  assert.equal(validExerciseLoads([{ ...good, weightLbs: -5 }], steps), false);
  assert.equal(validExerciseLoads([{ ...good, reps: 0 }], steps), false);
});
