import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople, challengeProgress } from '../src/lib/people.ts';
const participant = { id: 'p1', user_id: 'u1', challenge_id: 'c1', display_name: 'Challenge Name', joined_on: '2026-09-23', goals: ['Walk', 'Water', 'Sleep'], weekly_workouts: 3 };
const fixture = () => ({ profiles: [{ id: 'u1', full_name: '', phone: null }], contacts: [{ user_id: 'u1', email: 'member@example.invalid', is_test: true }], participants: [participant], enrollments: [], coaching: [], challenges: [], sessions: [] });
test('existing challenge participant appears without a class session or enrollment', () => {
  const people = buildPeople(fixture());
  assert.equal(people.length, 1); assert.equal(people[0].name, 'Challenge Name');
  assert.equal(people[0].email, 'member@example.invalid'); assert.equal(people[0].isTest, true);
});
test('multiple challenges and later classes/coaching share one stable person record', () => {
  const data = fixture();
  data.participants.push({ ...participant, id: 'p2', challenge_id: 'c2' });
  data.enrollments.push({ id: 'e1', member_id: 'u1', session_id: 's1', status: 'active' });
  data.coaching.push({ id: 'r1', member_id: 'u1', status: 'active' });
  const people = buildPeople(data);
  assert.equal(people.length, 1); assert.equal(people[0].id, 'u1');
  assert.equal(people[0].participants.length, 2); assert.equal(people[0].enrollments.length, 1); assert.equal(people[0].coaching.length, 1);
});
test('profile name wins and same-name accounts are not incorrectly merged', () => {
  const data = fixture(); data.profiles[0].full_name = 'Alex';
  data.profiles.push({ id: 'u2', full_name: 'Alex', phone: null });
  const people = buildPeople(data);
  assert.equal(people.length, 2); assert.equal(people[0].name, 'Alex'); assert.equal(people[1].participants.length, 0);
});
test('habit totals exclude pre-join, future, unchecked, duplicate and other-person marks', () => {
  const mark = (day, goal_index, extra = {}) => ({ participant_id: 'p1', day, goal_index, completed: true, ...extra });
  const marks = ['2026-09-22', '2026-09-23', '2026-09-25'].flatMap(day => [0,1,2].map(index => mark(day, index)));
  marks.push(mark('2026-09-24', 0), mark('2026-09-24', 0), mark('2026-09-24', 1), mark('2026-09-24', 2, { completed: false }), mark('2026-09-24', 2, { participant_id: 'other' }));
  assert.deepEqual(challengeProgress(participant, { starts_on: '2026-09-21', ends_on: '2026-10-11' }, marks, '2026-09-24'), { completed: 1, eligible: 2 });
  assert.deepEqual(challengeProgress(participant, { starts_on: '2026-09-21', ends_on: '2026-10-11' }, marks, '2026-09-12'), { completed: 0, eligible: 0 });
});

test('program directory switches membership, deduplicates people, and preserves all-program access', async () => {
  const { filterPeople } = await import('../src/lib/people.ts');
  const data = fixture();
  data.profiles.push({ id: 'u2', full_name: 'December Member', phone: '555-1234' }, { id: 'u3', full_name: 'Challenge Only', phone: null });
  data.enrollments.push(
    { id: 'e1', member_id: 'u1', session_id: 'oct', status: 'active' },
    { id: 'e2', member_id: 'u2', session_id: 'dec', status: 'invited' },
    { id: 'e3', member_id: 'u1', session_id: 'oct', status: 'completed' },
  );
  const people = buildPeople(data);
  assert.deepEqual(filterPeople(people, 'oct').map(p => p.id), ['u1']);
  assert.deepEqual(filterPeople(people, 'dec').map(p => p.id), ['u2']);
  assert.equal(filterPeople(people, 'empty').length, 0);
  assert.equal(filterPeople(people).length, 3);
  assert.equal(filterPeople(people, 'dec', 'member@example.invalid').length, 0);
  assert.equal(filterPeople(people, 'oct', ' MEMBER@EXAMPLE.INVALID ').length, 1);
  assert.equal(filterPeople(people, 'dec', '555-1234').length, 1);
  assert.equal(filterPeople(people, '', 'challenge').length, 2);
});
