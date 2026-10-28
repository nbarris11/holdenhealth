import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextClass } from '../src/lib/member-session.ts';

const meeting = (id, starts_at, extra = {}) => ({ id, starts_at, ends_at: new Date(Date.parse(starts_at) + 3600000).toISOString(), is_zoom: false, ...extra });
const now = Date.parse('2026-10-28T16:00:00Z');

test("the member's next picked class wins over the next class on the schedule", () => {
  const meetings = [meeting('tue', '2026-10-29T10:00:00Z'), meeting('sat', '2026-11-01T13:00:00Z')];
  assert.deepEqual(nextClass(meetings, ['sat'], now), { meeting: meetings[1], picked: true });
});

test('without picks, the next scheduled class is shown', () => {
  const meetings = [meeting('sat', '2026-11-01T13:00:00Z'), meeting('tue', '2026-10-29T10:00:00Z')];
  assert.deepEqual(nextClass(meetings, [], now), { meeting: meetings[1], picked: false });
});

test('finished classes are skipped, a class in progress still counts, and none left returns null', () => {
  const inProgress = meeting('now', '2026-10-28T15:30:00Z');
  assert.deepEqual(nextClass([meeting('old', '2026-10-27T10:00:00Z'), inProgress], [], now), { meeting: inProgress, picked: false });
  assert.equal(nextClass([meeting('old', '2026-10-27T10:00:00Z')], ['old'], now), null);
});

