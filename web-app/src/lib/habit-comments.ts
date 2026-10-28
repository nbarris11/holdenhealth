export type HabitComment = {
  id: string;
  week_id: string;
  day: string;
  habit_index: number;
  habit_text: string;
  author_id: string;
  body: string;
  member_read_at: string | null;
  created_at: string;
};

// Habit text is part of the key: after a member edits a habit, new comments start a new thread.
export function threadKey(c: { week_id: string; day: string; habit_index: number; habit_text: string }) {
  return `${c.week_id}|${c.day}|${c.habit_index}|${c.habit_text}`;
}

export function groupThreads(comments: HabitComment[]) {
  const threads = new Map<string, HabitComment[]>();
  for (const c of [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const key = threadKey(c);
    threads.set(key, [...(threads.get(key) ?? []), c]);
  }
  return threads;
}

export function unreadForMember(comments: HabitComment[], memberId: string) {
  return comments.filter((c) => c.author_id !== memberId && !c.member_read_at).length;
}

export function cleanCommentBody(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  return body.length >= 1 && body.length <= 1000 ? body : null;
}

// Threads the day-by-day tracker can't show: other weeks, edited-away habits and removed slots.
export function otherThreads(comments: HabitComment[], current?: { id: string; habits: string[] }) {
  const shown = (c: HabitComment) => c.week_id === current?.id && current.habits[c.habit_index] === c.habit_text;
  const latest = (thread: HabitComment[]) => thread[thread.length - 1].created_at;
  return [...groupThreads(comments.filter(c => !shown(c))).values()].sort((a, b) => latest(b).localeCompare(latest(a)));
}

// Until the habit_comments migration is applied, read as "no comments" instead of breaking Habits.
export function commentRows(result: { data: unknown; error: { code?: string } | null }) {
  if (result.error && ["42P01", "PGRST205"].includes(result.error.code ?? "")) return [];
  if (result.error) throw new Error("Habit comments could not be loaded.");
  return (result.data ?? []) as HabitComment[];
}

// Email a member about Kelsey's note only for the first note in 12 hours, so a burst of
// comments sends one email. Replies, opted-out members and test accounts get none.
export function shouldEmailHabitNote({ authorIsMember, optedIn, isTest, previousNoteAt, now }: {
  authorIsMember: boolean; optedIn: boolean; isTest: boolean; previousNoteAt: string | null; now: number;
}) {
  if (authorIsMember || !optedIn || isTest) return false;
  return !previousNoteAt || now - Date.parse(previousNoteAt) >= 12 * 3600000;
}
