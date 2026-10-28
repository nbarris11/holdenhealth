"use client";
import { useRef, useState } from "react";
import {
  addDays,
  challengeDays,
  dateLabel,
  eligibleDay,
  type Challenge,
  type Participant,
  type Checkmark,
} from "@/lib/challenge";
import { saveCheckmark } from "./actions";
export default function Tracker({
  challenge,
  participant,
  marks,
  today,
}: {
  challenge: Challenge;
  participant: Participant;
  marks: Checkmark[];
  today: string;
}) {
  const duration = challengeDays(challenge);
  const [day, setDay] = useState(
    today < challenge.starts_on
      ? challenge.starts_on
      : today > challenge.ends_on
        ? challenge.ends_on
        : today,
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const inFlight = useRef(new Set<string>());
  const pending = Object.values(saving).some(Boolean);
  const [message, setMessage] = useState("");
  const done = (d: string, index: number) =>
    overrides[`${d}:${index}`] ??
    marks.some((m) => m.day === d && m.goal_index === index && m.completed);
  const completed = [0, 1, 2].filter((i) => done(day, i)).length;
  const allowed = eligibleDay(challenge, participant.joined_on, day, today);
  return (
    <>
      <section className="panel">
        <span className="eyebrow">
          {dateLabel(day)} · Day{" "}
          {Math.round(
            (Date.parse(day) - Date.parse(challenge.starts_on)) / 86400000,
          ) + 1}{" "}
          of {duration}
        </span>
        <div className="challenge-heading">
          <h2>Your three daily goals</h2>
          <strong>{completed}/3</strong>
        </div>
        <progress
          aria-label="Habits completed for selected day"
          value={completed}
          max={3}
        />
        {participant.goals.map((goal, i) => (
          <label className="challenge-goal" key={goal}>
            <input
              type="checkbox"
              checked={done(day, i)}
              disabled={!allowed || saving[`${day}:${i}`]}
              onChange={async (e) => {
                const key = `${day}:${i}`;
                if (inFlight.current.has(key)) return;
                inFlight.current.add(key);
                const previous = done(day, i);
                const checked = e.target.checked;
                setOverrides((old) => ({ ...old, [key]: checked }));
                setSaving((old) => ({ ...old, [key]: true }));
                setMessage("");
                try {
                  const result = await saveCheckmark({
                    participantId: participant.id,
                    day,
                    goalIndex: i,
                    completed: checked,
                  });
                  setMessage(result.error || result.success || "");
                  if (result.error)
                    setOverrides((old) => ({ ...old, [key]: previous }));
                } catch {
                  setOverrides((old) => ({ ...old, [key]: previous }));
                  setMessage(
                    "Connection interrupted. Reload to check whether your change saved, then try again.",
                  );
                } finally {
                  inFlight.current.delete(key);
                  setSaving((old) => ({ ...old, [key]: false }));
                }
              }}
            />
            <span>{goal}</span>
          </label>
        ))}
        <p className="fine-print">
          {day < participant.joined_on
            ? "You had not joined yet. This day is not counted as missed."
            : day > today
              ? "This day has not started yet."
              : "Check things off as you go. Every little bit counts."}
        </p>
        <p role="status" aria-live="polite">
          {pending ? "Saving your progress…" : message}
        </p>
      </section>
      <section className="panel">
        <h2>Your {duration} days</h2>
        <p>{today < challenge.starts_on ? `Tracking opens ${dateLabel(challenge.starts_on)}. You can preview your days below.` : "Choose today or a past day to fill in your progress."}</p>
        <div className="challenge-calendar">
          {Array.from({ length: duration }, (_, i) =>
            addDays(challenge.starts_on, i),
          ).map((d, i) => (
            <button
              type="button"
              key={d}
              aria-pressed={day === d}
              className={`${day === d ? "selected" : ""} ${[0, 1, 2].every((n) => done(d, n)) ? "complete" : ""}`}
              onClick={() => {
                setDay(d);
                setMessage("");
              }}
              aria-label={`${dateLabel(d)}, ${[0, 1, 2].filter((n) => done(d, n)).length} of 3 complete${d < participant.joined_on ? ", not enrolled" : ""}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="fine-print">
          Your weekly intention: {participant.weekly_workouts} {participant.weekly_workouts === 1 ? "workout" : "workouts"}. Your
          daily habits stay the same throughout the challenge.
        </p>
      </section>
    </>
  );
}
