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

export function threadKey(c: { week_id: string; day: string; habit_index: number }) {
  return `${c.week_id}|${c.day}|${c.habit_index}`;
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
