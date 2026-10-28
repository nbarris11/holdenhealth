"use client";
import { useState } from "react";
import TimerFields from "@/components/timer-fields";
import WorkoutTimer from "@/components/workout-timer";
import {
  TIMER_DEFAULT,
  validTimer,
  type TimerConfig,
} from "@/lib/workout-timer";
export default function TimerPreset({
  preset,
}: {
  preset?: TimerConfig | null;
}) {
  const [enabled, setEnabled] = useState(validTimer(preset));
  const [config, setConfig] = useState<TimerConfig>(
    validTimer(preset) ? preset : { ...TIMER_DEFAULT },
  );
  return (
    <section className="timer-preset-editor">
      <h3>Workout timer</h3>
      <label className="challenge-choice">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Suggest timer settings for this workout
      </label>
      <input
        type="hidden"
        name="timer_config"
        value={enabled ? JSON.stringify(config) : ""}
      />
      {enabled && <TimerFields config={config} onChange={setConfig} />}
      <p className="fine-print">
        Leave this off for a self-paced elapsed-time clock. Enable it for a
        specific timed block. The timer length is separate from the estimated
        workout length above.
      </p>
      {enabled && (
        <WorkoutTimer
          key={JSON.stringify(config)}
          title="Try the workout timer"
          preset={enabled && validTimer(config) ? config : null}
        />
      )}
    </section>
  );
}
