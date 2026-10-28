import { addDays, validDate } from "./challenge";
import { mondayOf } from "./workout-app";

export type HabitWeek = { id: string; enrollment_id: string; week_number: number; habits: string[]; version?: number; relationship_id?: string | null };
export type HabitMark = { week_id: string; day: string; habit_index: number };

export function weekDates(startsOn: string, endsOn: string, weekNumber: number) {
  if (!validDate(startsOn) || !validDate(endsOn) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 10000) return null;
  const calendarStart = addDays(mondayOf(startsOn), (weekNumber - 1) * 7);
  if (calendarStart > endsOn) return null;
  const calendarEnd = addDays(calendarStart, 6);
  return { start: calendarStart < startsOn ? startsOn : calendarStart, end: calendarEnd < endsOn ? calendarEnd : endsOn };
}

export function currentHabitWeek(startsOn: string, endsOn: string, today: string) {
  if (today < startsOn) return 1;
  let lastWeek = 1;
  for (let week = 1; week <= 6; week++) {
    const dates = weekDates(startsOn, endsOn, week);
    if (!dates) return lastWeek;
    lastWeek = week;
    if (dates && today <= dates.end) return week;
  }
  return lastWeek;
}

export function cleanHabits(values: FormDataEntryValue[]) {
  const habits = values.map(value => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "").filter(Boolean);
  if (habits.length < 3 || habits.length > 6 || habits.some(habit => habit.length < 3 || habit.length > 100)) return null;
  if (new Set(habits.map(habit => habit.toLocaleLowerCase())).size !== habits.length) return null;
  return habits;
}

export function habitCounts(week: HabitWeek, marks: HabitMark[], start: string, through: string) {
  const days = Array.from({ length: Math.max(0, Math.min(7, Math.round((Date.parse(through) - Date.parse(start)) / 86400000) + 1)) }, (_, index) => addDays(start, index));
  const perHabit = week.habits.map((_, index) => days.filter(day => marks.some(mark => mark.week_id === week.id && mark.day === day && mark.habit_index === index)).length);
  const fullDays = days.filter(day => week.habits.every((_, index) => marks.some(mark => mark.week_id === week.id && mark.day === day && mark.habit_index === index))).length;
  return { days: days.length, perHabit, fullDays };
}
