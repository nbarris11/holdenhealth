import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanCommentBody, groupThreads, threadKey, unreadForMember } from '../src/lib/habit-comments.ts';

const comment = (over) => ({ id: 'c', week_id: 'w1', day: '2026-10-27', habit_index: 0, habit_text: 'Walk', author_id: 'coach', body: 'Nice', member_read_at: null, created_at: '2026-10-27T12:00:00Z', ...over });

test('threads group by week, day and habit, oldest first', () => {
  const rows = [
    comment({ id: 'reply', author_id: 'member', created_at: '2026-10-27T13:00:00Z' }),
    comment({ id: 'other-habit', habit_index: 1 }),
    comment({ id: 'first' }),
  ];
  const threads = groupThreads(rows);
  assert.equal(threadKey(rows[0]), 'w1|2026-10-27|0');
  assert.deepEqual(threads.get('w1|2026-10-27|0').map((c) => c.id), ['first', 'reply']);
  assert.deepEqual(threads.get('w1|2026-10-27|1').map((c) => c.id), ['other-habit']);
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
