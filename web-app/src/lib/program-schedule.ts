export type ProgramFormat = "weekly" | "all-classes";

export const PROGRAM_CLASS_TIMES: Record<ProgramFormat, Array<{ day: number; time: string }>> = {
  weekly: [{ day: 2, time: "06:00" }, { day: 3, time: "19:00" }, { day: 6, time: "07:30" }, { day: 6, time: "09:00" }],
  "all-classes": [{ day: 2, time: "06:00" }, { day: 3, time: "19:00" }, { day: 6, time: "09:00" }],
};

export function programMeetingDates(start: string, end: string, format: ProgramFormat) {
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) ||
      first.toISOString().slice(0, 10) !== start || last.toISOString().slice(0, 10) !== end ||
      first > last || last.getTime() - first.getTime() > 84 * 86400000) {
    throw new Error("Choose valid start and end dates up to 12 weeks apart.");
  }
  const dates: Array<{ date: string; time: string }> = [];
  for (let day = new Date(first); day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    for (const slot of PROGRAM_CLASS_TIMES[format]) {
      if (day.getUTCDay() === slot.day) dates.push({ date: day.toISOString().slice(0, 10), time: slot.time });
    }
  }
  if (!dates.length) throw new Error("This date range has no classes. Choose a longer range.");
  return dates;
}
