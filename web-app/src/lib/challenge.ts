import type { TimerConfig } from "./workout-timer";
export type GoalOption = { category: string; label: string };
export type Challenge = {
  archived?: boolean;
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  published: boolean;
  signup_open: boolean;
  welcome: string;
  community_url: string;
  goal_options: GoalOption[];
};
export type Participant = {
  id: string;
  challenge_id: string;
  user_id: string;
  display_name: string;
  goals: string[];
  weekly_workouts: number;
  joined_on: string;
};
export type Checkmark = {
  participant_id: string;
  day: string;
  goal_index: number;
  completed: boolean;
};
export type Workout = {
  relationship_id?: string | null;
  archived?: boolean;
  revision?: number;
  level?: "Beginner" | "All levels" | "Intermediate";
  focus?: string;
  steps?: import("./workout-app").WorkoutStep[];
  timer_config?: TimerConfig | null;
  id: string;
  challenge_id: string | null;
  session_id?: string | null;
  title: string;
  minutes: number;
  equipment: string;
  plan: string;
  exercises: { label: string; url: string }[];
  publish_on: string;
  published: boolean;
};
export type FormResult = { error?: string; success?: string };
export function detroitToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function challengeDays(challenge: Pick<Challenge, "starts_on" | "ends_on">) {
  return Math.round((Date.parse(challenge.ends_on) - Date.parse(challenge.starts_on)) / 86400000) + 1;
}
export function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    addDays(value, 0) === value
  );
}
export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
export function safeHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export function eligibleDay(
  challenge: Pick<Challenge, "starts_on" | "ends_on">,
  joined: string,
  day: string,
  today: string,
) {
  return (
    validDate(day) &&
    day >= challenge.starts_on &&
    day >= joined &&
    day <= challenge.ends_on &&
    day <= today
  );
}
