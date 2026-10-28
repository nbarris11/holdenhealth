export type GroupProgram = {
  id: string; name: string; description: string | null;
  starts_on: string; ends_on: string;
  address_line: string; city: string; state: string;
};

export function chooseEnrollment<T extends { id: string; sessions: Pick<GroupProgram, "starts_on" | "ends_on"> | null }>(rows: T[], today: string, requested?: string) {
  const available = rows.filter(row => row.sessions);
  return available.find(row => row.id === requested)
    ?? available.find(row => row.sessions!.starts_on <= today && row.sessions!.ends_on >= today)
    ?? available.filter(row => row.sessions!.starts_on > today).sort((a, b) => a.sessions!.starts_on.localeCompare(b.sessions!.starts_on))[0]
    ?? available.sort((a, b) => b.sessions!.ends_on.localeCompare(a.sessions!.ends_on))[0];
}

export function sessionPhase(program: Pick<GroupProgram, "starts_on" | "ends_on">, today: string) {
  return today < program.starts_on ? "upcoming" : today > program.ends_on ? "finished" : "current";
}

export function sessionWeek(startsOn: string, today: string) {
  return Math.max(1, Math.floor((Date.parse(today) - Date.parse(startsOn)) / 604800000) + 1);
}

export function classVisible(meeting: { ends_at: string }, now: number) {
  return Date.parse(meeting.ends_at) + 15 * 60_000 >= now;
}

export function sundayFor(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7);
  return date.toISOString().slice(0, 10);
}

export const ARRIVAL_DIRECTIONS = "Park near the clock on the south-facing side of the Burroughs building. Enter through those doors, walk straight, then turn left down the hallway. The gym is on your left.";

// The class a member should see first: their next picked class, else the next on the schedule.
// A class still counts while it is in progress.
export function nextClass<T extends { id: string; starts_at: string; ends_at: string }>(meetings: T[], pickedIds: string[], now: number) {
  const upcoming = meetings.filter(m => Date.parse(m.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const picked = upcoming.find(m => pickedIds.includes(m.id));
  if (picked) return { meeting: picked, picked: true };
  return upcoming[0] ? { meeting: upcoming[0], picked: false } : null;
}
