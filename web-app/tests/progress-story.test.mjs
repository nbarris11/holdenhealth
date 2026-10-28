import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeStory, storyDay, shiftStoryDay, storyMemberName, storyPreset, validStoryId } from "../src/lib/progress-story.ts";

test("story totals separate partial sessions and deduplicate habit days and classes", () => {
  const activity = [
    { id: "workout-a", day: "2026-09-09", kind: "workout" },
    { id: "workout-b", day: "2026-09-09", kind: "workout" },
    { id: "partial", day: "2026-09-09", kind: "partial" },
    { id: "class-one", day: "2026-09-08", kind: "class" },
    { id: "class-one", day: "2026-09-08", kind: "class" },
    { id: "habit-a", day: "2026-09-08", kind: "habit" },
    { id: "habit-b", day: "2026-09-08", kind: "habit" },
    { id: "habit-c", day: "2026-09-09", kind: "habit" },
    { id: "future", day: "2026-09-10", kind: "workout" },
    { id: "old", day: "2026-07-01", kind: "workout" },
  ];
  assert.deepEqual(summarizeStory(activity, "2026-07-30", "2026-09-09"), { workouts: 2, partials: 1, classes: 1, habitDays: 2, activeWeeks: 1 });
});
test("six-week windows include 42 local calendar days across month and DST boundaries", () => {
  assert.equal(shiftStoryDay("2026-09-09", -41), "2026-07-30");
  assert.equal(storyDay("2026-09-09T02:00:00Z"), "2026-09-08");
  assert.equal(storyDay("2026-11-01T04:30:00Z"), "2026-11-01");
  assert.equal(storyDay("2026-11-02T04:30:00Z"), "2026-11-01");
  const summary = summarizeStory([{ id: "start", day: "2026-07-30", kind: "workout" }, { id: "end", day: "2026-09-09", kind: "class" }], "2026-07-30", "2026-09-09");
  assert.equal(summary.workouts, 1); assert.equal(summary.classes, 1);
});
test("empty stories make no progress claims and cookie presets are allowlisted", () => {
  assert.deepEqual(summarizeStory([], "2026-07-30", "2026-09-09"), { workouts: 0, partials: 0, classes: 0, habitDays: 0, activeWeeks: 0 });
  assert.equal(storyPreset("<script>"), undefined);
  assert.equal(storyPreset("family")?.id, "family");
  assert.equal(validStoryId("other-user"), false);
});

test("story names prefer the saved profile, then the challenge signup", () => {
  assert.equal(storyMemberName("  Kelsey Holden  ", "Challenge Name"), "Kelsey Holden");
  assert.equal(storyMemberName("", "  Ricci Malloure  "), "Ricci Malloure");
  assert.equal(storyMemberName(null, "  "), "Member");
});
