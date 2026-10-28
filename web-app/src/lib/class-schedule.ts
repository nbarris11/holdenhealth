export type ScheduleMeeting = { starts_at: string; cancelled?: boolean };
export type WeeklyScheduleSlot = { weekday: string; time: string };

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
const dayOrder = new Map(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => [day, index]));

export function weeklyScheduleSlots(meetings: ScheduleMeeting[]): WeeklyScheduleSlot[] {
  const slots = new Map<string, WeeklyScheduleSlot & { order: number; timestamp: number }>();
  meetings.filter((meeting) => !meeting.cancelled).forEach((meeting) => {
    const date = new Date(meeting.starts_at);
    const weekday = weekdayFormatter.format(date);
    const time = timeFormatter.format(date);
    const key = `${weekday}-${time}`;
    if (!slots.has(key)) slots.set(key, { weekday, time, order: dayOrder.get(weekday) ?? 7, timestamp: date.getTime() });
  });
  return [...slots.values()].sort((a, b) => a.order - b.order || a.timestamp - b.timestamp).map(({ weekday, time }) => ({ weekday, time }));
}

export function weeklyScheduleLabel(slots: WeeklyScheduleSlot[]) {
  return slots.length ? slots.map((slot) => `${slot.weekday}s at ${slot.time}`).join(" · ") : "Class times will be posted soon.";
}
