import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validSteps,
  validDemo,
  selfPacedTimer,
  mondayOf,
  sessionKey,
  nextWorkoutStep,
} from "../src/lib/workout-app.ts";
import { validTimer, timerLength } from "../src/lib/workout-timer.ts";
const amrap = { ...selfPacedTimer(20), mode: "countdown" };
const circuit = Array.from({ length: 6 }, () => ({ section: "Main work" }));
test("six-movement AMRAP repeats for multiple rounds without restarting its clock", () => {
  let index = 0;
  for (let click = 1; click <= 18; click++) {
    index = nextWorkoutStep(circuit, index, amrap, click * 10);
    assert.equal(index, click % 6);
  }
  assert.equal(nextWorkoutStep(circuit, 5, amrap, 1199), 0);
});
test("AMRAP offers check-in at expiry from any movement, including restored sessions", () => {
  for (let index = 0; index < 6; index++) {
    assert.equal(nextWorkoutStep(circuit, index, amrap, 1200), null);
    assert.equal(nextWorkoutStep(circuit, index, amrap, 1300), null);
  }
});
test("AMRAP repeats main work only and advances to cooldown when time expires", () => {
  const steps = [{ section: "Warm-up" }, ...circuit, { section: "Cool-down" }];
  assert.equal(nextWorkoutStep(steps, 0, amrap, 10), 1);
  assert.equal(nextWorkoutStep(steps, 6, amrap, 100), 1);
  assert.equal(nextWorkoutStep(steps, 3, amrap, 1200), 7);
  assert.equal(nextWorkoutStep(steps, 6, amrap, 1200), 7);
  assert.equal(nextWorkoutStep(steps, 7, amrap, 1200), null);
});
test("other timer modes keep linear movement navigation", () => {
  for (const mode of ["stopwatch", "interval", "emom"]) {
    const config = { ...amrap, mode };
    assert.equal(nextWorkoutStep(circuit, 4, config, 10), 5);
    assert.equal(nextWorkoutStep(circuit, 5, config, 10), null);
    assert.equal(nextWorkoutStep(circuit, 0, config, 1200), 1);
  }
});
test("single-movement countdown can repeat, and an empty circuit finishes", () => {
  assert.equal(nextWorkoutStep(circuit.slice(0, 1), 0, amrap, 23), 0);
  assert.equal(nextWorkoutStep([], 0, amrap, 23), null);
});
test("beginner fallback is self-paced and matches the plan, not a four-minute Tabata", () => {
  const timer = selfPacedTimer(10);
  assert.equal(timer.mode, "stopwatch");
  assert.equal(timerLength(timer), 600);
  assert.equal(validTimer(timer), true);
});
test("structured steps validate safe demo links and field sizes", () => {
  const step = {
    section: "Warm-up",
    title: "Easy march",
    dose: "1 minute",
    instructions: "Move comfortably.",
    easier: "Stay seated.",
    demo: "",
  };
  assert.equal(validSteps([step]), true);
  assert.equal(validSteps([{ ...step, title: "" }]), false);
  assert.equal(validSteps([{ ...step, demo: "javascript:alert(1)" }]), false);
  assert.equal(
    validSteps([{ ...step, instructions: "x".repeat(1501) }]),
    false,
  );
  assert.equal(validSteps(Array(41).fill(step)), false);
  assert.equal(validDemo("https://example.com/demo"), true);
  assert.equal(validDemo("https://user:password@example.com"), false);
});
test("week boundaries work across months and years", () => {
  assert.equal(mondayOf("2026-09-09"), "2026-09-07");
  assert.equal(mondayOf("2026-09-13"), "2026-09-07");
  assert.equal(mondayOf("2026-01-01"), "2025-12-29");
});
test("session recovery is scoped by member, workout and version", () => {
  assert.notEqual(sessionKey("a", "w", 1), sessionKey("b", "w", 1));
  assert.notEqual(sessionKey("a", "w", 1), sessionKey("a", "w", 2));
});
