import { test } from "node:test";
import assert from "node:assert/strict";
import { timerCue } from "../src/lib/timer-sound.ts";
const frame = {
  kind: "rest",
  segment: "rest",
  remaining: 4,
  active: true,
  complete: false,
};
test("last three seconds cue once, without repeats or pause cues", () => {
  const three = { ...frame, remaining: 3 };
  assert.equal(timerCue(frame, three), "tick");
  assert.equal(timerCue(three, three), null);
  assert.equal(timerCue({ ...frame, active: false }, three), null);
  assert.equal(timerCue(frame, { ...three, active: false }), null);
  assert.equal(timerCue(null, three), null);
});
test("rest finish cues despite countdown stopping, but does not repeat", () => {
  const done = { ...frame, remaining: 0, complete: true, active: false };
  assert.equal(timerCue(frame, done), "finish");
  assert.equal(timerCue(done, done), null);
  assert.equal(timerCue(frame, { ...done, kind: "quiet" }), null);
});
test("interval transitions cue once, including work-only rounds", () => {
  assert.equal(
    timerCue(
      { ...frame, kind: "workout", segment: "1:Work" },
      { ...frame, kind: "workout", segment: "2:Work" },
    ),
    "finish",
  );
  assert.equal(timerCue(frame, { ...frame, kind: "workout" }), null);
});
