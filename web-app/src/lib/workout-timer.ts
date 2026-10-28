export type TimerMode = "countdown" | "stopwatch" | "emom" | "interval";
export type TimerConfig = {
  mode: TimerMode;
  durationSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
};
export const TIMER_DEFAULT: TimerConfig = {
  mode: "interval",
  durationSeconds: 1200,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
};
export const TIMER_LABELS: Record<TimerMode, string> = {
  countdown: "AMRAP / Countdown",
  stopwatch: "For time / Stopwatch",
  emom: "EMOM",
  interval: "Work / rest",
};
export function timerLength(config: TimerConfig) {
  return config.mode === "interval"
    ? (config.workSeconds + config.restSeconds) * config.rounds
    : config.mode === "emom"
      ? 60 * config.rounds
      : config.durationSeconds;
}
export function validTimer(value: unknown): value is TimerConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as TimerConfig;
  return (
    Object.hasOwn(TIMER_LABELS, c.mode) &&
    [c.durationSeconds, c.workSeconds, c.restSeconds, c.rounds].every(
      Number.isInteger,
    ) &&
    c.durationSeconds >= 1 &&
    c.durationSeconds <= 10800 &&
    c.workSeconds >= 1 &&
    c.workSeconds <= 3600 &&
    c.restSeconds >= 0 &&
    c.restSeconds <= 3600 &&
    c.rounds >= 1 &&
    c.rounds <= 100 &&
    timerLength(c) <= 10800
  );
}
export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}
export function timerPosition(config: TimerConfig, elapsedMs: number) {
  const elapsed = Math.max(0, elapsedMs) / 1000,
    total = timerLength(config),
    complete = elapsed >= total;
  const round =
    config.mode === "interval"
      ? Math.min(
          config.rounds,
          Math.floor(elapsed / (config.workSeconds + config.restSeconds)) + 1,
        )
      : config.mode === "emom"
        ? Math.min(config.rounds, Math.floor(elapsed / 60) + 1)
        : 1;
  let phase: "Work" | "Rest" | "Go" | "Complete" = complete ? "Complete" : "Go";
  let remaining = Math.max(0, total - elapsed);
  if (!complete && config.mode === "interval") {
    const within = elapsed % (config.workSeconds + config.restSeconds);
    phase = within < config.workSeconds ? "Work" : "Rest";
    remaining =
      phase === "Work"
        ? config.workSeconds - within
        : config.workSeconds + config.restSeconds - within;
  }
  if (!complete && config.mode === "emom") {
    phase = "Work";
    remaining = 60 - (elapsed % 60);
  }
  return {
    round,
    phase,
    complete,
    elapsed: Math.min(elapsed, total),
    remaining,
    total,
    display:
      config.mode === "stopwatch"
        ? Math.floor(Math.min(elapsed, total))
        : Math.ceil(remaining),
  };
}
// Wall-clock anchors preserve accuracy when browser callbacks are throttled.
export function elapsedAt(
  accumulated: number,
  startedAt: number | null,
  now: number,
) {
  return accumulated + (startedAt === null ? 0 : Math.max(0, now - startedAt));
}
