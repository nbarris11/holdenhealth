import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanCommentBody, commentRows, groupThreads, otherThreads, threadKey, unreadForMember } from '../src/lib/habit-comments.ts';

const comment = (over) => ({ id: 'c', week_id: 'w1', day: '2026-10-27', habit_index: 0, habit_text: 'Walk', author_id: 'coach', body: 'Nice', member_read_at: null, created_at: '2026-10-27T12:00:00Z', ...over });

test('threads group by week, day and habit, oldest first', () => {
  const rows = [
    comment({ id: 'reply', author_id: 'member', created_at: '2026-10-27T13:00:00Z' }),
    comment({ id: 'other-habit', habit_index: 1 }),
    comment({ id: 'first' }),
  ];
  const threads = groupThreads(rows);
  assert.equal(threadKey(rows[0]), 'w1|2026-10-27|0|Walk');
  assert.deepEqual(threads.get('w1|2026-10-27|0|Walk').map((c) => c.id), ['first', 'reply']);
  assert.deepEqual(threads.get('w1|2026-10-27|1|Walk').map((c) => c.id), ['other-habit']);
});

test('members count only unread comments written by someone else', () => {
  const rows = [
    comment({ id: 'unread' }),
    comment({ id: 'read', member_read_at: '2026-10-27T14:00:00Z' }),
    comment({ id: 'mine', author_id: 'member' }),
  ];
  assert.equal(unreadForMember(rows, 'member'), 1);
  assert.equal(unreadForMember([], 'member'), 0);
});

test('comment bodies are trimmed and limited to 1000 characters', () => {
  assert.equal(cleanCommentBody('  Nice work!  '), 'Nice work!');
  assert.equal(cleanCommentBody(''), null);
  assert.equal(cleanCommentBody('   '), null);
  assert.equal(cleanCommentBody(null), null);
  assert.equal(cleanCommentBody('x'.repeat(1001)), null);
  assert.equal(cleanCommentBody('x'.repeat(1000)).length, 1000);
});

test('a new comment after a habit edit starts its own thread', () => {
  const threads = groupThreads([comment({ id: 'old', habit_text: 'Walk' }), comment({ id: 'new', habit_text: 'Stretch' })]);
  assert.equal(threads.size, 2);
});

test('threads outside the visible week and its current habits are listed separately, newest activity first', () => {
  const current = { id: 'w2', habits: ['Walk', 'Stretch', 'Read'] };
  const rows = [
    comment({ id: 'shown', week_id: 'w2', habit_index: 1, habit_text: 'Stretch' }),
    comment({ id: 'edited-away', week_id: 'w2', habit_index: 1, habit_text: 'Water' }),
    comment({ id: 'removed-slot', week_id: 'w2', habit_index: 5, habit_text: 'Sleep' }),
    comment({ id: 'last-week', week_id: 'w1', created_at: '2026-10-25T12:00:00Z' }),
    comment({ id: 'last-week-reply', week_id: 'w1', author_id: 'member', created_at: '2026-10-26T12:00:00Z' }),
  ];
  const other = otherThreads(rows, current);
  assert.deepEqual(other.map((t) => t.map((c) => c.id)), [['edited-away'], ['removed-slot'], ['last-week', 'last-week-reply']]);
  assert.equal(otherThreads(rows, undefined).length, 4);
});

test('a missing comments table reads as no comments; other errors still fail', () => {
  assert.deepEqual(commentRows({ data: null, error: { code: '42P01' } }), []);
  assert.deepEqual(commentRows({ data: null, error: { code: 'PGRST205' } }), []);
  assert.deepEqual(commentRows({ data: [comment({})], error: null }).length, 1);
  assert.throws(() => commentRows({ data: null, error: { code: '42501' } }));
});
