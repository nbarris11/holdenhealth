import assert from "node:assert/strict";
import { test, after } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const output = mkdtempSync(join(tmpdir(), "holden-library-test-"));
execFileSync(
  process.execPath,
  [
    require.resolve("typescript/bin/tsc"),
    "src/lib/workout-library.ts",
    "--outDir",
    output,
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--skipLibCheck",
  ],
  { cwd: new URL("..", import.meta.url) },
);
after(() => rmSync(output, { recursive: true, force: true }));
const { cleanLibraryContent, repeatTemplate } = require(join(output, "workout-library.js"));
const step = {
  section: "Warm-up",
  title: "March",
  dose: "1 minute",
  instructions: "Move comfortably",
  easier: "Seated",
  demo: "",
};
const template = {
  title: "Gentle strength",
  minutes: 20,
  equipment: "Chair",
  plan: "Start gently",
  level: "Beginner",
  focus: "Full body",
  exercises: [],
  timer_config: null,
  steps: [step],
};
test("templates exclude identity, dates and publishing state and copy exercises", () => {
  const saved = cleanLibraryContent("workout", {
    steps: [step],
    template: {
      ...template,
      id: "old",
      challenge_id: "old",
      published: true,
      publish_on: "2026-09-21",
      archived: true,
    },
  });
  assert.ok(saved);
  for (const field of [
    "id",
    "challenge_id",
    "published",
    "publish_on",
    "archived",
  ])
    assert.equal(field in saved.template, false);
  saved.steps[0].title = "Edited";
  assert.equal(step.title, "March");
});
test("exercise and block validation rejects empty, oversized and unsafe input", () => {
  assert.equal(cleanLibraryContent("exercise", { steps: [] }), null);
  assert.equal(cleanLibraryContent("exercise", { steps: [step, step] }), null);
  assert.ok(cleanLibraryContent("block", { steps: [step, step] }));
  assert.equal(
    cleanLibraryContent("block", { steps: Array(41).fill(step) }),
    null,
  );
  assert.equal(
    cleanLibraryContent("exercise", {
      steps: [{ ...step, demo: "javascript:alert(1)" }],
    }),
    null,
  );
  assert.equal(
    cleanLibraryContent("workout", {
      steps: [step],
      template: { ...template, minutes: 0 },
    }),
    null,
  );
  assert.equal(
    cleanLibraryContent("workout", {
      steps: [step],
      template: { ...template, timer_config: { mode: "invalid" } },
    }),
    null,
  );
  assert.equal(cleanLibraryContent("other", { steps: [step] }), null);
  assert.equal(cleanLibraryContent("exercise", null), null);
});
test("templates retain demonstration links and valid timer settings", () => {
  const timer = {
    mode: "interval",
    workSeconds: 30,
    restSeconds: 15,
    rounds: 3,
    durationSeconds: 60,
  };
  const saved = cleanLibraryContent("workout", {
    steps: [{ ...step, demo: "https://example.com/march" }],
    template: { ...template, timer_config: timer },
  });
  assert.ok(saved);
  assert.equal(saved.steps[0].demo, "https://example.com/march");
  assert.deepEqual(saved.template.timer_config, timer);
});

test("repeating a workout copies the plan but never its id, date or publish state", () => {
  const original = {
    id: "w1", challenge_id: null, relationship_id: "r1", title: "Leg day", minutes: 30, equipment: "Bands",
    plan: "Squats", exercises: [{ label: "Squat", url: "https://example.com/squat" }], level: "All levels",
    focus: "Legs", timer_config: null, steps: [step], publish_on: "2026-10-20", published: true, revision: 3,
  };
  const copy = repeatTemplate(original);
  for (const key of ["id", "publish_on", "published", "revision", "relationship_id", "challenge_id"]) assert.equal(key in copy, false, key);
  assert.equal(copy.title, "Leg day");
  assert.deepEqual(copy.exercises, original.exercises);
  assert.deepEqual(copy.steps, [step]);
  copy.exercises[0].label = "Changed";
  copy.steps[0].title = "Changed";
  assert.equal(original.exercises[0].label, "Squat");
  assert.equal(original.steps[0].title, "March");
  assert.deepEqual(repeatTemplate({ ...original, steps: undefined }).steps, []);
});
