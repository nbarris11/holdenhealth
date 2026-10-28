export const STORY_PRESETS = [
  { id: "family", label: "Keep up with my kids", goal: "I want to have the strength and energy to keep up with my kids.", focus: "Start with movement that fits around family life. Notice one everyday moment that feels easier as you build consistency." },
  { id: "confidence", label: "Feel comfortable in a class", goal: "I want to feel comfortable and confident walking into a class.", focus: "Make the first visit feel familiar. Ask about the space, the movements, and the options available when something feels new." },
  { id: "return", label: "Get back to something I love", goal: "I want to get back to an activity I love and feel more confident doing it.", focus: "Tell Kelsey what you miss doing. Choose a realistic starting point together and a small milestone that matters to you." },
  { id: "myself", label: "Make time for myself", goal: "I want to make time for myself and build a routine I can stick with.", focus: "Choose a realistic place for movement in your week, including a shorter option for a busy day." },
] as const;
export const STORY_COOKIE = "holden_story_start";
export const storyPreset = (id: string | undefined) => STORY_PRESETS.find(p => p.id === id);
export const validStoryId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export function storyMemberName(profileName: string | null | undefined, challengeName?: string | null) {
  return profileName?.trim() || challengeName?.trim() || "Member";
}

export function storyDay(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function shiftStoryDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function storyDate(day: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.slice(0, 10)}T12:00:00Z`));
}
export type StoryActivity = { id: string; day: string; kind: "workout" | "partial" | "class" | "habit"; label: string };
export type StorySummary = { workouts: number; partials: number; classes: number; habitDays: number; activeWeeks: number };
export function summarizeStory(activity: StoryActivity[], start: string, end: string): StorySummary {
  const result: StorySummary = { workouts: 0, partials: 0, classes: 0, habitDays: 0, activeWeeks: 0 };
  const ids = new Set<string>(), habitDays = new Set<string>(), weeks = new Set<string>();
  for (const a of activity) {
    if (a.day < start || a.day > end || ids.has(a.id)) continue;
    ids.add(a.id);
    if (a.kind === "workout") result.workouts++;
    if (a.kind === "partial") result.partials++;
    if (a.kind === "class") result.classes++;
    if (a.kind === "habit") habitDays.add(a.day);
    if (a.kind === "workout" || a.kind === "class") {
      const weekday = new Date(`${a.day}T12:00:00Z`).getUTCDay();
      weeks.add(shiftStoryDay(a.day, -((weekday + 6) % 7)));
    }
  }
  result.habitDays = habitDays.size;
  result.activeWeeks = weeks.size;
  return result;
}
export type StoryGoal = { id: string; goal: string; created_at: string };
export type StoryWin = { id: string; body: string; created_at: string };
export type StoryRecap = { id: string; member_id: string; body: string; goal_snapshot: string; period_start: string; period_end: string; summary: StorySummary; published_at: string | null; created_at: string; updated_at: string };
export type StoryState = { ok?: boolean; message: string };
