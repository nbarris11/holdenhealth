// Browser-only demo data. No authentication, network writes, or member records.
export const DEMO_KEY = "holden:public-demo:v1";
export const DEMO_USER = "public-demo";
export type DemoSession = {
  id: string;
  status: "completed" | "partial";
  seconds: number;
  note: string;
  effort: number | null;
  day: string;
};
export type DemoData = {
  goal: string;
  wins: string[];
  habits: string[];
  sessions: DemoSession[];
};
const initial: DemoData = {
  goal: "Feel stronger for everyday life and have more energy for my family.",
  wins: ["Sample win: I made time for movement on a busy day."],
  habits: [],
  sessions: [],
};
export const EMPTY_DEMO = JSON.stringify(initial);
let fallback = EMPTY_DEMO;
export function demoSnapshot() {
  try {
    return localStorage.getItem(DEMO_KEY) || fallback;
  } catch {
    return fallback;
  }
}
export function parseDemo(raw: string): DemoData {
  try {
    const d = JSON.parse(raw);
    if (
      typeof d.goal !== "string" ||
      !Array.isArray(d.wins) ||
      !d.wins.every((v: unknown) => typeof v === "string") ||
      !Array.isArray(d.habits) ||
      !d.habits.every((v: unknown) => typeof v === "string") ||
      !Array.isArray(d.sessions)
    )
      return initial;
    if (
      !d.sessions.every(
        (s: DemoSession) =>
          s &&
          typeof s.id === "string" &&
          ["completed", "partial"].includes(s.status) &&
          Number.isFinite(s.seconds) &&
          typeof s.note === "string" &&
          typeof s.day === "string",
      )
    )
      return initial;
    return d;
  } catch {
    return initial;
  }
}
export function subscribeDemo(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("holden-demo-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("holden-demo-change", listener);
  };
}
export function updateDemo(update: (data: DemoData) => DemoData) {
  fallback = JSON.stringify(update(parseDemo(demoSnapshot())));
  try {
    localStorage.setItem(DEMO_KEY, fallback);
  } catch {
    /* In-memory demo remains usable. */
  }
  window.dispatchEvent(new Event("holden-demo-change"));
}
export function resetDemo() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`holden:workout-session:${DEMO_USER}:`))
        localStorage.removeItem(key);
    }
  } catch {}
  updateDemo(() => initial);
}
export function demoDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export async function saveDemoSession(input: Omit<DemoSession, "day">) {
  const day = demoDay();
  updateDemo((d) => ({
    ...d,
    sessions: [
      ...d.sessions.filter((s) => s.id !== input.id),
      {
        id: input.id,
        status: input.status,
        seconds: input.seconds,
        effort: input.effort,
        note: input.note,
        day,
      },
    ].slice(-100),
  }));
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const week = date.toISOString().slice(0, 10);
  return {
    weeklyCompleted: parseDemo(demoSnapshot()).sessions.filter(
      (s) => s.status === "completed" && s.day >= week,
    ).length,
    error: undefined,
  };
}
