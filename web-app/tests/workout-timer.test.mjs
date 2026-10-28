import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TIMER_DEFAULT,
  timerLength,
  timerPosition,
  validTimer,
  elapsedAt,
  formatClock,
} from "../src/lib/workout-timer.ts";
test("Tabata uses eight complete 20/10 intervals, including final rest", () => {
  assert.equal(timerLength(TIMER_DEFAULT), 240);
  assert.deepEqual(
    [
      timerPosition(TIMER_DEFAULT, 19999).phase,
      timerPosition(TIMER_DEFAULT, 19999).display,
    ],
    ["Work", 1],
  );
  assert.deepEqual(
    [
      timerPosition(TIMER_DEFAULT, 20000).phase,
      timerPosition(TIMER_DEFAULT, 20000).display,
    ],
    ["Rest", 10],
  );
  assert.equal(timerPosition(TIMER_DEFAULT, 30000).round, 2);
  assert.equal(timerPosition(TIMER_DEFAULT, 239999).phase, "Rest");
  assert.equal(timerPosition(TIMER_DEFAULT, 240000).complete, true);
});
test("zero rest transitions directly to work without dividing by zero", () => {
  const c = { ...TIMER_DEFAULT, restSeconds: 0 };
  assert.equal(timerPosition(c, 20000).round, 2);
  assert.equal(timerPosition(c, 20000).phase, "Work");
});
test("EMOM restarts each minute and ends on its final minute", () => {
  const c = { ...TIMER_DEFAULT, mode: "emom", rounds: 3 };
  assert.equal(timerPosition(c, 60000).round, 2);
  assert.equal(timerPosition(c, 60000).display, 60);
  assert.equal(timerPosition(c, 180000).complete, true);
});
test("countdown and count-up use correct display at boundaries and cap", () => {
  const c = { ...TIMER_DEFAULT, mode: "countdown", durationSeconds: 90 };
  assert.equal(timerPosition(c, 89999).display, 1);
  assert.equal(timerPosition(c, 90000).display, 0);
  const s = { ...c, mode: "stopwatch" };
  assert.equal(timerPosition(s, 1999).display, 1);
  assert.equal(timerPosition(s, 100000).display, 90);
});
test("pause/resume excludes paused time and catches up after background throttling", () => {
  const before = elapsedAt(0, 1000, 12000);
  assert.equal(before, 11000);
  assert.equal(elapsedAt(before, null, 100000), 11000);
  assert.equal(elapsedAt(before, 100000, 101000), 12000);
  const delayed = timerPosition(TIMER_DEFAULT, elapsedAt(0, 1000, 96000));
  assert.equal(delayed.round, 4);
  assert.equal(delayed.display, 15);
});
test("invalid settings, excessive totals, and noninteger values are rejected", () => {
  for (const value of [
    null,
    {},
    { ...TIMER_DEFAULT, rounds: 0 },
    { ...TIMER_DEFAULT, workSeconds: NaN },
    { ...TIMER_DEFAULT, rounds: 1.5 },
    { ...TIMER_DEFAULT, mode: "bad" },
    { ...TIMER_DEFAULT, workSeconds: 3600, rounds: 100 },
  ])
    assert.equal(validTimer(value), false);
  assert.equal(validTimer(TIMER_DEFAULT), true);
  assert.equal(formatClock(240), "04:00");
  assert.equal(formatClock(0), "00:00");
});
