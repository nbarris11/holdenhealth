import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseEnrollment, classVisible, sessionPhase, sessionWeek, sundayFor } from '../src/lib/member-session.ts';
import { intakeConditionalError } from '../src/lib/intake-validation.ts';

test('current session wins over a later purchase, and explicit ownership-scoped selection works', () => {
  const rows = [
    { id: 'dec', sessions: { starts_on: '2026-12-01', ends_on: '2026-12-19' } },
    { id: 'oct', sessions: { starts_on: '2026-10-13', ends_on: '2026-11-21' } },
    { id: 'old', sessions: { starts_on: '2026-08-01', ends_on: '2026-08-31' } },
  ];
  assert.equal(chooseEnrollment(rows, '2026-10-20').id, 'oct');
  assert.equal(chooseEnrollment(rows, '2026-09-11').id, 'oct');
  assert.equal(chooseEnrollment(rows, '2027-01-01').id, 'dec');
  assert.equal(chooseEnrollment(rows, '2026-10-20', 'dec').id, 'dec');
  assert.equal(chooseEnrollment(rows, '2026-10-20', 'someone-elses-id').id, 'oct');
  assert.equal(chooseEnrollment([], '2026-10-20'), undefined);
});
test('session phase and first check-in respect local date boundaries', () => {
  const program = { starts_on: '2026-10-13', ends_on: '2026-11-21' };
  assert.equal(sessionPhase(program, '2026-10-12'), 'upcoming');
  assert.equal(sessionPhase(program, '2026-10-13'), 'current');
  assert.equal(sessionPhase(program, '2026-11-22'), 'finished');
  assert.equal(sessionWeek(program.starts_on, '2026-10-20'), 2);
  assert.equal(sundayFor(program.starts_on), '2026-10-18');
  assert.equal(sundayFor('2026-11-01'), '2026-11-01');
});
test('class remains accessible after its start and expires after end plus grace', () => {
  const meeting = { ends_at: '2026-11-07T15:00:00Z' };
  assert.equal(classVisible(meeting, Date.parse('2026-11-07T14:07:00Z')), true);
  assert.equal(classVisible(meeting, Date.parse('2026-11-07T15:15:00Z')), true);
  assert.equal(classVisible(meeting, Date.parse('2026-11-07T15:15:01Z')), false);
});
function baseForm() {
  const form = new FormData();
  for (const field of ['goals', 'nutritionSupport', 'coachingSupport', 'commitments']) form.append(field, 'Example');
  form.set('preferredCommunication', 'Email');
  return form;
}
test('intake identifies an empty required group and retains caller data', () => {
  const form = baseForm(); form.delete('goals'); form.set('primaryGoal', 'A goal to preserve');
  assert.equal(intakeConditionalError(form).field, 'goals');
  assert.equal(form.get('primaryGoal'), 'A goal to preserve');
});
test('conditional intake explanations and phone requirements are specific', () => {
  const form = baseForm(); form.set('injury', 'yes');
  assert.equal(intakeConditionalError(form).field, 'injuryDetail');
  form.set('injuryDetail', 'Example for validation only'); form.append('goals', 'Other');
  assert.equal(intakeConditionalError(form).field, 'goalOther');
  form.set('goalOther', 'Example'); form.set('preferredCommunication', 'Text');
  assert.equal(intakeConditionalError(form).field, 'contactPhone');
  form.set('contactPhone', '555-555-0123');
  assert.equal(intakeConditionalError(form), null);
});
