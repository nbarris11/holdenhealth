import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memberNavItems } from '../src/lib/member-nav-items.ts';

test('paid members get Workouts, Habits and Messages in that order', () => {
  const items = memberNavItems({ canChat: true, habitUnread: 0 });
  assert.deepEqual(items.map((i) => i.href), ['/portal/workouts', '/portal/habits', '/portal/communicate']);
  assert.deepEqual(items.map((i) => i.label), ['Workouts', 'Habits', 'Messages']);
  assert.equal(items[1].badge, undefined);
});

test('members without messaging access never see a dead-end Messages tab', () => {
  assert.deepEqual(memberNavItems({ canChat: false, habitUnread: 0 }).map((i) => i.label), ['Workouts', 'Habits']);
});

test('unread habit comments badge the Habits tab', () => {
  assert.equal(memberNavItems({ canChat: true, habitUnread: 2 }).find((i) => i.label === 'Habits').badge, 2);
});
