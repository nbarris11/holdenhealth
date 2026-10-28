"use client";
import { useState } from "react";
import {
  TIMER_LABELS,
  timerLength,
  formatClock,
  validTimer,
  type TimerConfig,
  type TimerMode,
} from "@/lib/workout-timer";
export default function TimerFields({
  config,
  onChange,
  disabled = false,
}: {
  config: TimerConfig;
  onChange: (value: TimerConfig) => void;
  disabled?: boolean;
}) {
  const [countdownUnit, setCountdownUnit] = useState<"minutes" | "seconds">(
    config.durationSeconds % 60 === 0 ? "minutes" : "seconds",
  );
  const numberField = (
    label: string,
    key: "durationSeconds" | "workSeconds" | "restSeconds" | "rounds",
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        required
        disabled={disabled}
        value={Number.isNaN(config[key]) ? "" : config[key]}
        onChange={(e) =>
          onChange({
            ...config,
            [key]: e.target.value === "" ? NaN : Number(e.target.value),
          })
        }
      />
    </label>
  );
  return (
    <fieldset className="timer-fields" disabled={disabled}>
      <legend>Timer settings</legend>
      <label>
        Timer type
        <select
          value={config.mode}
          onChange={(e) =>
            onChange({ ...config, mode: e.target.value as TimerMode })
          }
        >
          {Object.entries(TIMER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {config.mode === "interval" ? (
        <div className="timer-fields-grid">
          {numberField("Work (seconds)", "workSeconds", 1, 3600)}
          {numberField("Rest (seconds)", "restSeconds", 0, 3600)}
          {numberField("Rounds", "rounds", 1, 100)}
        </div>
      ) : config.mode === "emom" ? (
        numberField("Minutes / rounds", "rounds", 1, 100)
      ) : config.mode === "countdown" ? (
        <div className="timer-fields-grid">
          <label>
            Countdown unit
            <select
              value={countdownUnit}
              onChange={(e) =>
                setCountdownUnit(e.target.value as "minutes" | "seconds")
              }
            >
              <option value="minutes">Minutes</option>
              <option value="seconds">Seconds</option>
            </select>
          </label>
          <label>
            Countdown ({countdownUnit})
            <input
              type="number"
              min={countdownUnit === "minutes" ? 1 / 60 : 1}
              max={countdownUnit === "minutes" ? 180 : 10800}
              step={countdownUnit === "minutes" ? "any" : 1}
              required
              value={
                Number.isNaN(config.durationSeconds)
                  ? ""
                  : config.durationSeconds / (countdownUnit === "minutes" ? 60 : 1)
              }
              onChange={(e) =>
                onChange({
                  ...config,
                  durationSeconds:
                    e.target.value === ""
                      ? NaN
                      : countdownUnit === "minutes"
                        ? Math.round(Number(e.target.value) * 60)
                        : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      ) : (
        numberField(
          "Time cap (seconds)",
          "durationSeconds",
          1,
          10800,
        )
      )}
      <p className="fine-print">
        {validTimer(config)
          ? `${formatClock(timerLength(config))} total${config.mode === "interval" ? " · Rest is included after every round." : config.mode === "emom" ? " · A new round starts every minute." : config.mode === "stopwatch" ? " · Counts up until you finish or reach the cap." : " · Complete your rounds before time runs out."}`
          : "Use whole numbers within the limits. Maximum total time: 3 hours."}
      </p>
    </fieldset>
  );
}
