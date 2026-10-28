import assert from 'node:assert/strict';
import { test } from 'node:test';
import { programMeetingDates } from '../src/lib/program-schedule.ts';

test('a three-week all-classes program creates the expected nine class slots', () => {
  const meetings = programMeetingDates('2026-12-01', '2026-12-19', 'all-classes');
  assert.equal(meetings.length, 9);
  assert.deepEqual(meetings.slice(0, 3), [
    {date:'2026-12-01',time:'06:00'},
    {date:'2026-12-02',time:'19:00'},
    {date:'2026-12-05',time:'09:00'},
  ]);
});

test('a weekly program offers both Saturday times and rejects bad dates', () => {
  const meetings = programMeetingDates('2027-01-05', '2027-01-09', 'weekly');
  assert.deepEqual(meetings.map(item => item.time), ['06:00','19:00','07:30','09:00']);
  assert.throws(() => programMeetingDates('2027-02-30','2027-03-01','weekly'));
  assert.throws(() => programMeetingDates('2027-01-09','2027-01-05','weekly'));
});
