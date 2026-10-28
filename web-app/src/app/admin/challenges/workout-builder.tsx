"use client";

import { useActionState, useRef, useState } from "react";
import { detroitToday, type Workout } from "@/lib/challenge";
import type { WorkoutProgram } from "@/lib/workout-program";
import { Result, Submit } from "@/app/challenge/forms";
import { saveWorkout } from "./actions";
import StepEditor from "./step-editor";
import { SaveToLibrary } from "./library-controls";
import type { Template } from "@/lib/workout-library";
import TimerPreset from "./timer-preset";

const stages = ["Workout details", "Exercises", "Publish"];

export default function WorkoutBuilder({
  challenge,
  workout,
  template,
  classProgram = false,
  personalProgram = false,
}: {
  challenge: WorkoutProgram;
  workout?: Workout;
  template?: Template;
  classProgram?: boolean;
  personalProgram?: boolean;
}) {
  const content = workout || template;
  const formRef = useRef<HTMLFormElement>(null);
  const [result, action] = useActionState(saveWorkout, {});
  const [stage, setStage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  function navigate(next: number) {
    setStage(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <form
      ref={formRef}
      action={action}
      className="stack-form workout-builder"
      noValidate
      onSubmitCapture={(event) => {
        const form = event.currentTarget;
        if (stage < 2) {
          event.preventDefault();
          navigate(stage + 1);
          return;
        }
        const invalid = form.querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input:invalid, textarea:invalid, select:invalid");
        if (invalid) {
          event.preventDefault();
          setStage(
            Number(
              invalid.closest<HTMLElement>("[data-builder-stage]")?.dataset
                .builderStage || 0,
            ),
          );
          invalid.checkValidity();
          let parent = invalid.parentElement;
          while (parent && parent !== form) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
            parent = parent.parentElement;
          }
          requestAnimationFrame(() => {
            invalid.focus();
            invalid.reportValidity();
          });
        }
      }}
    >
      <input type="hidden" name="id" value={workout?.id || ""} />
      <input type="hidden" name={personalProgram ? "relationship_id" : classProgram ? "session_id" : "challenge_id"} value={challenge.id} />
      <nav className="builder-navigation" aria-label="Workout builder steps">
        {stages.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-current={stage === i ? "step" : undefined}
            onClick={() => navigate(i)}
          >
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <header className="builder-heading">
        <span>STEP {stage + 1} OF 3</span>
        <h3 ref={heading} tabIndex={-1}>
          {
            [
              "Give your workout a home",
              "Build the movement lineup",
              "Choose when members see it",
            ][stage]
          }
        </h3>
        <p>
          {
            [
              "Start with the essentials. You’ll add the exercises next.",
              "Add one movement at a time. Members see these as exercise cards and guided steps.",
              "Save privately as a draft, or make it available on your chosen date.",
            ][stage]
          }
        </p>
      </header>
      <section
        data-builder-stage="0"
        hidden={stage !== 0}
        className="builder-section"
      >
        <label>
          Workout name
          <input
            name="title"
            required
            maxLength={120}
            placeholder="e.g. Gentle full-body strength"
            defaultValue={content?.title || ""}
          />
        </label>
        <div className="builder-field-grid">
          <label>
            Estimated minutes
            <input
              name="minutes"
              type="number"
              min={1}
              max={180}
              required
              defaultValue={content?.minutes || 20}
            />
          </label>
          <label>
            Level
            <select name="level" defaultValue={content?.level || "All levels"}>
              <option>Beginner</option>
              <option>All levels</option>
              <option>Intermediate</option>
            </select>
          </label>
        </div>
        <label>
          Focus
          <input
            name="focus"
            required
            maxLength={80}
            defaultValue={content?.focus || "Full body"}
          />
        </label>
        <label>
          Equipment
          <input
            name="equipment"
            maxLength={200}
            placeholder="e.g. A sturdy chair and a mat"
            defaultValue={content?.equipment || ""}
          />
        </label>
        <label>
          Coach’s introduction & safety notes
          <textarea
            name="plan"
            rows={4}
            required
            maxLength={20000}
            placeholder="A short introduction, how to prepare, and any important modifications."
            defaultValue={content?.plan || ""}
          />
        </label>
        <p className="builder-help">
          No need to write the exercises twice. Add their instructions in the
          next step. Existing written plans are kept here.
        </p>
      </section>
      <section
        data-builder-stage="1"
        hidden={stage !== 1}
        className="builder-section"
      >
        <StepEditor initial={content?.steps} />
        <details className="builder-optional">
          <summary>Extra demonstration links — optional</summary>
          <label>
            One per line: Exercise | Link
            <textarea
              name="exercises"
              rows={3}
              placeholder="Chair squat | https://…"
              defaultValue={
                content?.exercises
                  .map((e) => `${e.label} | ${e.url}`)
                  .join("\n") || ""
              }
            />
          </label>
          <p className="builder-help">
            You can also add a demonstration directly to an exercise.
          </p>
        </details>
      </section>
      <section
        data-builder-stage="2"
        hidden={stage !== 2}
        className="builder-section"
      >
        <div className="builder-publish-note">
          <strong>{challenge.title}</strong>
          <p>
            {personalProgram ? "This workout is private to this client." : `Workouts stay within this ${classProgram ? "program’s" : "challenge’s"} dates.`} Members only see
            published workouts once their release date arrives.
          </p>
        </div>
        <label>
          Release date
          <input
            name="publish_on"
            type="date"
            min={challenge.starts_on}
            max={challenge.ends_on}
            required
            defaultValue={
              workout?.publish_on || (template ? "" : personalProgram && detroitToday() > challenge.starts_on ? detroitToday() : challenge.starts_on)
            }
          />
        </label>
        <label className="challenge-choice">
          <input
            type="checkbox"
            name="published"
            defaultChecked={workout?.published || false}
          />
          Make available to members on the release date
        </label>
        <p className="builder-help">
          Leave unchecked to save as a private draft. Changes reach members only
          after you save.
        </p>
        <details className="builder-optional">
          <summary>Timer settings — optional</summary>
          <TimerPreset preset={content?.timer_config} />
        </details>
        {workout && (
          <a
            className="builder-preview"
            href={`/portal/workouts/${workout.id}?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview saved workout as a member ↗
          </a>
        )}
        <p className="builder-help">
          Save your changes before opening the member preview.
        </p>
      </section>
      <SaveToLibrary
        kind="workout"
        defaultName={content?.title || ""}
        getContent={() => {
          const data = new FormData(formRef.current!);
          const str = (name: string) => String(data.get(name) || "").trim();
          const steps = JSON.parse(str("steps") || "[]");
          return {
            steps,
            template: {
              title: str("title"),
              minutes: Number(str("minutes")),
              level: str("level") as Template["level"],
              focus: str("focus"),
              equipment: str("equipment"),
              plan: str("plan"),
              steps,
              timer_config: JSON.parse(str("timer_config") || "null"),
              exercises: str("exercises")
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [label, ...url] = l.split("|");
                  return { label: label.trim(), url: url.join("|").trim() };
                }),
            },
          };
        }}
      />
      <footer className="builder-footer">
        <span>
          {stage > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => navigate(stage - 1)}
            >
              ← Back
            </button>
          )}
        </span>
        <div>
          {stage < 2 ? (
            <button
              type="button"
              className="button primary"
              onClick={() => navigate(stage + 1)}
            >
              Next: {stages[stage + 1]} →
            </button>
          ) : (
            <Submit>Save workout</Submit>
          )}
        </div>
      </footer>
      <Result result={result} />
    </form>
  );
}
