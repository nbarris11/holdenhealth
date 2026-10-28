import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  challengeDays,
  detroitToday,
  eligibleDay,
  validDate,
  safeHttps,
} from "../src/lib/challenge.ts";
const challenge = { starts_on: "2026-09-21", ends_on: "2026-10-11" };
test("14-day challenge ends October 4 and rejects tracking on October 5", () => {
  const shortened = { starts_on: "2026-09-21", ends_on: "2026-10-04" };
  assert.equal(challengeDays(shortened), 14);
  assert.equal(addDays(shortened.starts_on, challengeDays(shortened) - 1), "2026-10-04");
  assert.equal(eligibleDay(shortened, "2026-09-21", "2026-10-04", "2026-10-05"), true);
  assert.equal(eligibleDay(shortened, "2026-09-21", "2026-10-05", "2026-10-05"), false);
  assert.equal(challengeDays(challenge), 21);
});
test("21-day calendar includes both endpoints across month boundary", () => {
  assert.equal(addDays(challenge.starts_on, 20), challenge.ends_on);
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
});
test("Detroit day does not change at UTC midnight", () => {
  assert.equal(detroitToday(new Date("2026-09-22T02:00:00Z")), "2026-09-21");
  assert.equal(detroitToday(new Date("2026-09-22T04:00:00Z")), "2026-09-22");
});
test("late arrival has no checkmarks before joining, after today, or outside challenge", () => {
  assert.equal(
    eligibleDay(challenge, "2026-09-25", "2026-09-24", "2026-09-27"),
    false,
  );
  assert.equal(
    eligibleDay(challenge, "2026-09-25", "2026-09-25", "2026-09-27"),
    true,
  );
  assert.equal(
    eligibleDay(challenge, "2026-09-25", "2026-09-28", "2026-09-27"),
    false,
  );
  assert.equal(
    eligibleDay(challenge, "2026-09-25", "2026-10-12", "2026-10-15"),
    false,
  );
  assert.equal(
    eligibleDay(challenge, "2026-09-25", "2026-10-11", "2026-10-15"),
    true,
  );
});
test("invalid dates and unsafe demonstration links are rejected", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("not-a-date"), false);
  assert.equal(safeHttps("javascript:alert(1)"), false);
  assert.equal(safeHttps("https://www.youtube.com/watch?v=example"), true);
});
