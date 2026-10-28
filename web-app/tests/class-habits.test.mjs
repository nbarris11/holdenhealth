import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = fs.readFileSync(new URL('../src/lib/class-habits.ts', import.meta.url), 'utf8');
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const mondayOf = day => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports,
  require: name => name === './challenge' ? { addDays, validDate: day => /^\d{4}-\d{2}-\d{2}$/.test(day) } : { mondayOf },
  Date, Math, Number, Set, String, FormData,
});

test('six class weeks follow Monday to Sunday and clip to session dates', () => {
  assert.deepEqual({ ...exports.weekDates('2026-10-13', '2026-11-21', 1) }, { start: '2026-10-13', end: '2026-10-18' });
  assert.deepEqual({ ...exports.weekDates('2026-10-13', '2026-11-21', 2) }, { start: '2026-10-19', end: '2026-10-25' });
  assert.deepEqual({ ...exports.weekDates('2026-10-13', '2026-11-21', 6) }, { start: '2026-11-16', end: '2026-11-21' });
  assert.equal(exports.currentHabitWeek('2026-10-13', '2026-11-21', '2026-10-18'), 1);
  assert.equal(exports.currentHabitWeek('2026-10-13', '2026-11-21', '2026-10-19'), 2);
  assert.equal(exports.currentHabitWeek('2026-10-13', '2026-10-25', '2026-11-01'), 2);
});

test('weekly success counts full days and each habit independently', () => {
  const week = { id: 'week', habits: ['Water', 'Walk', 'Sleep'] };
  const marks = [
    ...[0, 1, 2].map(habit_index => ({ week_id: 'week', day: '2026-10-13', habit_index })),
    { week_id: 'week', day: '2026-10-14', habit_index: 0 },
  ];
  assert.deepEqual({ ...exports.habitCounts(week, marks, '2026-10-13', '2026-10-14') }, { days: 2, perHabit: [2, 1, 1], fullDays: 1 });
});

test('habit choices require three distinct short labels and permit later additions', () => {
  assert.deepEqual(Array.from(exports.cleanHabits([' Drink water ', 'Walk', 'Sleep', '', 'Stretch'])), ['Drink water', 'Walk', 'Sleep', 'Stretch']);
  assert.equal(exports.cleanHabits(['Walk', 'walk', 'Sleep']), null);
  assert.equal(exports.cleanHabits(['Walk', 'Sleep']), null);
});
