import { weeklyScheduleSlots, type ScheduleMeeting } from "./class-schedule";

export function registrationClassTimes(meetings: ScheduleMeeting[]) {
  return weeklyScheduleSlots(meetings).map(slot => `${slot.weekday} ${slot.time}`);
}
