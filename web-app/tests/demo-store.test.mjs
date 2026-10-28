import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEMO_KEY,
  EMPTY_DEMO,
  parseDemo,
  demoSnapshot,
  saveDemoSession,
  resetDemo,
} from "../src/lib/demo-store.ts";
test("demo saves stay local, deduplicate retries, exclude partials, and reset only demo recovery", async () => {
  const values = {};
  globalThis.localStorage = new Proxy(
    {
      getItem: (key) => values[key] ?? null,
      setItem: (key, value) => {
        values[key] = value;
      },
      removeItem: (key) => {
        delete values[key];
      },
    },
    {
      ownKeys: () => Object.keys(values),
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
    },
  );
  globalThis.window = new EventTarget();
  const session = {
    id: "one",
    seconds: 12,
    status: "completed",
    effort: 3,
    note: "Sample",
  };
  assert.equal((await saveDemoSession(session)).weeklyCompleted, 1);
  assert.equal((await saveDemoSession(session)).weeklyCompleted, 1);
  assert.equal(
    (await saveDemoSession({ ...session, id: "two", status: "partial" }))
      .weeklyCompleted,
    1,
  );
  assert.equal(parseDemo(demoSnapshot()).sessions.length, 2);
  assert.deepEqual(Object.keys(values), [DEMO_KEY]);
  values["holden:workout-session:real-member:w:1"] = "keep";
  values["holden:workout-session:public-demo:w:1"] = "remove";
  resetDemo();
  assert.equal(demoSnapshot(), EMPTY_DEMO);
  assert.equal(values["holden:workout-session:real-member:w:1"], "keep");
  assert.equal(values["holden:workout-session:public-demo:w:1"], undefined);
  globalThis.localStorage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal((await saveDemoSession(session)).weeklyCompleted, 1);
});
test("corrupt demo storage falls back to sample data", () => {
  for (const raw of [
    "broken",
    "null",
    '{"goal":"test","wins":[4],"habits":[],"sessions":[]}',
  ])
    assert.deepEqual(parseDemo(raw), JSON.parse(EMPTY_DEMO));
});
