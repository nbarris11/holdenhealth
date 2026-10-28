"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Workout } from "@/lib/challenge";
import { workoutLibraryPath } from "@/lib/workout-program";
import { safeHttps } from "@/lib/challenge";
import { sessionKey, selfPacedTimer, nextWorkoutStep } from "@/lib/workout-app";
import type { WorkoutStep } from "@/lib/workout-app";
import { formatClock, timerPosition, validTimer } from "@/lib/workout-timer";
import useTimerSound from "@/components/use-timer-sound";
import WorkoutIcon from "@/components/workout-icon";
import MovementIllustration from "@/components/movement-illustration";
import { displayExerciseLoad, type ExerciseLoad } from "@/lib/exercise-loads";
import {
  movementGuide,
  movementRound,
  restSecondsRemaining,
} from "@/lib/movement-guide";
import { saveSession } from "../actions";
type Session = { id: string; seconds: number; index: number; rest?: number; loads?: Record<number, { weight: string; reps: string }> };
export default function WorkoutSession({
  workout: w,
  userId,
  canLog,
  preview,
  demo = false,
  previousLoads = {},
}: {
  workout: Workout;
  userId: string;
  canLog: boolean;
  preview: boolean;
  demo?: boolean;
  previousLoads?: Record<string, { load: ExerciseLoad; performedOn: string }>;
}) {
  const router = useRouter(),
    key = sessionKey(userId, w.id, w.revision || 1);
  const [session, setSession] = useState<Session | null>(null),
    [running, setRunning] = useState(false),
    [review, setReview] = useState(false),
    [pending, setPending] = useState(false),
    [saved, setSaved] = useState(false),
    [message, setMessage] = useState("");
  const [restRunning, setRestRunning] = useState(false);
  const restDeadline = useRef(0);
  const [weeklyCompleted, setWeeklyCompleted] = useState<number | null>(null);
  const [status, setStatus] = useState<"completed" | "partial">("completed"),
    [effort, setEffort] = useState(""),
    [note, setNote] = useState("");
  const anchor = useRef(0),
    base = useRef(0),
    lock = useRef(false);
  const config = validTimer(w.timer_config)
    ? w.timer_config
    : selfPacedTimer(w.minutes);
  const steps: WorkoutStep[] = w.steps?.length
    ? w.steps
    : [
        {
          section: "Main work",
          title: w.title,
          dose: `About ${w.minutes} minutes · at your pace`,
          instructions: w.plan,
          easier: "Take breaks whenever you need them.",
          demo: "",
        },
      ];
  const soundPosition = timerPosition(config, (session?.seconds || 0) * 1000);
  const soundRest = session?.rest !== undefined && !review;
  const sound = useTimerSound(userId, {
    kind: soundRest
      ? "rest"
      : session && !review && !saved && config.mode !== "stopwatch"
        ? "workout"
        : "quiet",
    segment: soundRest
      ? "rest"
      : `${soundPosition.round}:${soundPosition.phase}`,
    remaining: soundRest ? session!.rest! : soundPosition.display,
    active: soundRest ? restRunning : running && !review && !saved,
    complete: soundRest ? session!.rest === 0 : soundPosition.complete,
  });
  useEffect(() => {
    if (preview) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw) as Session;
      if (
        typeof data.id === "string" &&
        Number.isInteger(data.seconds) &&
        data.seconds >= 0 &&
        data.seconds <= 10800 &&
        Number.isInteger(data.index) &&
        data.index >= 0 &&
        data.index < steps.length
      ) {
        // Restore paused: time spent away is not counted as exercise.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession({
          id: data.id,
          seconds: data.seconds,
          index: data.index,
          ...(data.loads && typeof data.loads === "object" ? { loads: data.loads } : {}),
          ...(Number.isInteger(data.rest) &&
          data.rest! >= 0 &&
          data.rest! <= 120
            ? { rest: data.rest }
            : {}),
        });
        setMessage("Your unfinished session is ready. Resume when you are.");
      }
    } catch {
      /* A blocked browser store does not prevent starting a session. */
    }
  }, [key, preview, steps.length]);
  useEffect(() => {
    if (session && !preview && !saved) {
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch {
        /* Saving to the server still works. */
      }
    }
  }, [session, key, preview, saved]);
  useEffect(() => {
    if (!running) return;
    const update = () =>
      setSession((s) =>
        s
          ? {
              ...s,
              seconds: Math.min(
                10800,
                base.current + Math.floor((Date.now() - anchor.current) / 1000),
              ),
            }
          : s,
      );
    const timer = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [running]);
  useEffect(() => {
    if (!restRunning) return;
    const tick = () => {
      const left = restSecondsRemaining(restDeadline.current, Date.now());
      setSession((s) => (s && s.rest !== undefined ? { ...s, rest: left } : s));
      if (left === 0) setRestRunning(false);
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [restRunning]);
  function startRest(seconds: number) {
    void sound.unlock();
    if (running) pause();
    setSession((s) => (s ? { ...s, rest: seconds } : s));
    restDeadline.current = Date.now() + seconds * 1000;
    setRestRunning(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function pauseRest() {
    const left = restSecondsRemaining(restDeadline.current, Date.now());
    setSession((s) => (s ? { ...s, rest: left } : s));
    setRestRunning(false);
  }
  function resumeRest() {
    void sound.unlock();
    if (!session?.rest) return;
    restDeadline.current = Date.now() + session.rest * 1000;
    setRestRunning(true);
  }
  function continueWorkout() {
    void sound.unlock();
    if (!session) return;
    const next = { ...session, rest: undefined };
    setRestRunning(false);
    setSession(next);
    base.current = next.seconds;
    anchor.current = Date.now();
    setRunning(true);
    setMessage("");
  }
  function start() {
    void sound.unlock();
    const next = session || { id: crypto.randomUUID(), seconds: 0, index: 0 };
    setSession(next);
    base.current = next.seconds;
    anchor.current = Date.now();
    setRunning(true);
    setMessage("");
  }
  function pause() {
    const seconds = Math.min(
      10800,
      base.current + Math.floor((Date.now() - anchor.current) / 1000),
    );
    setSession((s) => (s ? { ...s, seconds } : s));
    setRunning(false);
  }
  async function finish() {
    if (!session || lock.current || preview || !canLog) return;
    void sound.unlock();
    lock.current = true;
    setPending(true);
    setMessage("");
    try {
      const exerciseLoads: ExerciseLoad[] = [];
      if (w.relationship_id) for (const [index, entry] of Object.entries(session.loads ?? {})) {
        if (!entry.weight && !entry.reps) continue;
        const stepIndex = Number(index);
        const weightLbs = Number(entry.weight);
        const reps = entry.reps ? Number(entry.reps) : null;
        if (!Number.isInteger(stepIndex) || steps[stepIndex]?.section !== "Main work" ||
          !entry.weight || !Number.isFinite(weightLbs) || weightLbs < 0 || weightLbs > 2000 ||
          Math.round(weightLbs * 4) !== weightLbs * 4 ||
          (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > 500))) {
          setMessage("Check your weight and reps. Enter a weight in pounds before adding reps.");
          return;
        }
        exerciseLoads.push({ stepIndex, title: steps[stepIndex].title, weightLbs, reps });
      }
      const save = demo
        ? (await import("@/lib/demo-store")).saveDemoSession
        : saveSession;
      const result = await save({
        id: session.id,
        workoutId: w.id,
        revision: w.revision || 1,
        status,
        seconds: session.seconds,
        effort: effort ? Number(effort) : null,
        note,
        exerciseLoads,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setWeeklyCompleted(result.weeklyCompleted ?? null);
      setSaved(true);
      sound.play(status === "completed" ? "celebrate" : "saved");
      window.scrollTo({ top: 0, behavior: "instant" });
      try {
        localStorage.removeItem(key);
      } catch {}
      router.refresh();
    } catch {
      setMessage(
        "We couldn’t confirm the save. Please retry—this will not create a duplicate session.",
      );
    } finally {
      setPending(false);
      lock.current = false;
    }
  }
  function checkIn(partial = false) {
    setStatus(partial ? "partial" : "completed");
    if (running) pause();
    if (restRunning) pauseRest();
    setReview(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function moveStep(offset: number) {
    if (offset > 0 && session && session.index < steps.length - 1) sound.play("move");
    setRestRunning(false);
    setSession((s) =>
      s
        ? {
            ...s,
            rest: undefined,
            index: Math.max(0, Math.min(steps.length - 1, s.index + offset)),
          }
        : s,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function updateLoad(index: number, field: "weight" | "reps", value: string) {
    setSession((s) => s ? { ...s, loads: {
      ...s.loads,
      [index]: { weight: s.loads?.[index]?.weight ?? "", reps: s.loads?.[index]?.reps ?? "", [field]: value },
    } } : s);
  }
  function advance() {
    if (!session) return;
    const seconds = running
      ? Math.min(10800, base.current + Math.floor((Date.now() - anchor.current) / 1000))
      : session.seconds;
    const index = nextWorkoutStep(steps, session.index, config, seconds);
    if (index === null) {
      checkIn();
      return;
    }
    sound.play("move");
    setRestRunning(false);
    setSession((s) => s ? { ...s, seconds, index, rest: undefined } : s);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const back = demo
    ? "/demo/workouts"
    : workoutLibraryPath(w);
  if (saved)
    return (
      <section className="workout-saved" role="status">
        <span className="workout-success-mark">
          <WorkoutIcon name="check" />
        </span>
        <span className="member-kicker">Session saved</span>
        <h2>
          You made time
          <br />
          for yourself.
        </h2>
        <p>
          {status === "completed"
            ? "Your workout is complete."
            : "Your partial session is recorded. Showing up matters."}{" "}
          {demo
            ? "This practice check-in stays in this browser; it is not sent to Kelsey."
            : "Kelsey can see your check-in."}
        </p>
        <div className="workout-celebration-controls">
          <button className="workout-sound-toggle" onClick={sound.toggle} aria-pressed={sound.enabled}>
            Sound {sound.enabled ? "on" : "off"}
          </button>
        </div>
        <div className="workout-saved-stat">
          <strong>{formatClock(session?.seconds || 0)}</strong>
          <span>time you made for movement</span>
        </div>
        {weeklyCompleted !== null && (
          <p className="workout-week-result">
            <strong>{weeklyCompleted}</strong> completed workout
            {weeklyCompleted === 1 ? "" : "s"}{" "}
            {demo ? "in your demo this week" : "in this program this week"}
          </p>
        )}
        <div className="member-actions">
          <Link
            className="member-button"
            href={
              demo
                ? "/demo/progress"
                : w.session_id ? "/portal/progress" : `/portal/progress?challenge=${w.challenge_id}`
            }
          >
            See my progress <WorkoutIcon name="next" />
          </Link>
          <Link
            className="member-button secondary"
            href={demo ? "/demo" : w.session_id ? "/portal/today" : `/portal/today?challenge=${w.challenge_id}`}
          >
            Back to Today
          </Link>
        </div>
      </section>
    );
  if (!canLog && !preview) return null;
  if (!session)
    return (
      <section className="workout-ready">
        <div className="workout-ready-copy">
          <span className="workout-overline">A little time for you</span>
          <h2>
            Your pace.
            <br />
            Your practice.
          </h2>
          <p>
            {steps.length > 1
              ? `${steps.length} guided movements.`
              : "One guided session."}{" "}
            Pause whenever you need.
          </p>
          <button className="member-button" onClick={start}>
            <WorkoutIcon name="play" />
            {preview ? "Try session preview" : "Start workout"}
          </button>
        </div>
        <div className="workout-duration">
          <strong>{w.minutes}</strong>
          <span>MINUTES</span>
        </div>
      </section>
    );
  const step = steps[session.index];
  const position = timerPosition(config, session.seconds * 1000);
  const timed = validTimer(w.timer_config) && config.mode !== "stopwatch";
  const nextIndex = nextWorkoutStep(steps, session.index, config, session.seconds);
  const nextStep = nextIndex === null ? undefined : steps[nextIndex];
  const repeatRound = nextIndex !== null && nextIndex <= session.index;
  const resting = session.rest !== undefined && !review;
  const guide = movementGuide(step.title);
  const round = movementRound(
    step.title,
    steps.map((s) => s.title),
  );
  return (
    <section className="workout-player" data-active="true" data-review={review}>
      <header className="workout-player-top">
        <Link href={back} aria-label="Back to workouts">
          <WorkoutIcon name="back" />
        </Link>
        <span>{w.title}</span>
        <button
          className="workout-sound-toggle"
          onClick={sound.toggle}
          aria-pressed={sound.enabled}
          aria-label="Workout sounds"
        >
          {sound.enabled ? "Sound on" : "Sound off"}
        </button>
      </header>
      <div className="workout-player-body">
        {sound.enabled && (
          <p className="workout-sound-help" role="status">
            {sound.unavailable
              ? "Sound unavailable. Tap Sound off, then on to retry."
              : "Timer, movement and celebration sounds on. Keep the app open and media volume up."}
          </p>
        )}
        <div
          className="workout-clock-panel"
          data-rest={resting || (timed && position.phase === "Rest")}
        >
          <div className="workout-clock-label">
            <span
              className={`workout-live-dot ${running ? "is-running" : ""}`}
            />
            {resting
              ? session.rest === 0
                ? "Rest complete"
                : restRunning
                  ? "Rest"
                  : "Rest paused"
              : review
                ? "Your session"
                : !running
                  ? "Paused"
                  : timed
                    ? position.complete
                      ? "Timer complete"
                      : position.phase === "Go"
                        ? "Time remaining"
                        : position.phase
                    : "At your pace"}
          </div>
          <strong
            className="workout-clock"
            aria-label={
              resting
                ? "Rest time remaining"
                : timed && !review
                  ? "Coach timer"
                  : "Elapsed workout time"
            }
          >
            {formatClock(
              resting
                ? session.rest!
                : timed && !review
                  ? position.display
                  : session.seconds,
            )}
          </strong>
          <div className="workout-clock-caption">
            {resting ? (
              "Workout clock paused"
            ) : timed && !review ? (
              <>
                {position.round && ["interval", "emom"].includes(config.mode)
                  ? `Timer round ${position.round} of ${config.rounds} · `
                  : ""}
                {formatClock(session.seconds)} elapsed
              </>
            ) : (
              "Time in your session"
            )}
          </div>
          <div className="workout-clock-footer">
            {preview
              ? "Read-only preview"
              : demo
                ? "Demo · Practice only"
                : review
                  ? "Every bit counts."
                  : "Breathe. Find your rhythm."}
          </div>
        </div>
        {resting ? (
          <div className="workout-rest-panel">
            <span className="member-kicker">A moment to reset</span>
            <div
              className={`rest-orbit ${restRunning ? "rest-orbit-running" : ""}`}
              aria-hidden="true"
            >
              <span />
            </div>
            <h2>
              {session.rest === 0 ? "Ready when you are." : "Take your time."}
            </h2>
            <p>
              {session.rest === 0
                ? "Continue when you feel ready. Nothing moves on without you."
                : "Relax your shoulders. Breathe comfortably."}
            </p>
            <div className="workout-up-next">
              <span>RETURN TO</span>
              <strong>{round.title}</strong>
              <small>{round.label || step.section}</small>
            </div>
          </div>
        ) : !review ? (
          <div className="workout-move-panel">
            <div className="workout-step-meta">
              <span>{round.label || step.section}</span>
              <span>
                {String(session.index + 1).padStart(2, "0")} /{" "}
                {String(steps.length).padStart(2, "0")}
              </span>
            </div>
            <progress
              className="workout-step-progress"
              value={session.index + 1}
              max={steps.length}
              aria-label="Workout steps"
            />
            <div className="workout-current-move" key={session.index}>
              <h2 tabIndex={-1} aria-live="polite">
                {round.title}
              </h2>
              <span className="workout-dose">{step.dose}</span>
              {guide && <MovementIllustration guide={guide} />}
              {guide ? (
                <details className="workout-full-instructions">
                  <summary>Full instructions</summary>
                  <p className="workout-instructions">{step.instructions}</p>
                </details>
              ) : (
                <p className="workout-instructions">{step.instructions}</p>
              )}
              {step.easier && (
                <details className="workout-adaptation">
                  <summary>
                    Make it easier <span aria-hidden="true">+</span>
                  </summary>
                  <p>{step.easier}</p>
                </details>
              )}
              {safeHttps(step.demo) && (
                <a
                  className="workout-demo-link"
                  href={step.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WorkoutIcon name="play" /> Watch demonstration ↗
                </a>
              )}
            </div>
            {step.section === "Main work" && (
              <div className="workout-rest-choices">
                <span>Need a rest?</span>
                {[30, 60, 90].map((seconds) => (
                  <button key={seconds} onClick={() => startRest(seconds)}>
                    {seconds}s
                  </button>
                ))}
              </div>
            )}
            <div className="workout-up-next">
              <span>{repeatRound ? "NEXT ROUND" : nextStep ? "UP NEXT" : "SESSION CHECK-IN"}</span>
              <strong>
                {nextStep ? nextStep.title : "Your session check-in"}
              </strong>
              {nextStep?.dose && <small>{nextStep.dose}</small>}
            </div>
          </div>
        ) : (
          <div className="workout-review-panel">
            <span className="member-kicker">Your check-in</span>
            <h2>How did that feel?</h2>
            <p className="member-muted">
              You decide what complete means today.
            </p>
            <fieldset className="workout-completion-options" disabled={pending}>
              <legend className="workout-sr-only">
                How much of the workout did you do?
              </legend>
              <label>
                <input
                  type="radio"
                  name="session-status"
                  checked={status === "completed"}
                  onChange={() => setStatus("completed")}
                />
                <span>
                  <strong>I completed it</strong>
                  <small>My workout is done for today</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="session-status"
                  checked={status === "partial"}
                  onChange={() => setStatus("partial")}
                />
                <span>
                  <strong>I did part of it</strong>
                  <small>Save the movement I made time for</small>
                </span>
              </label>
            </fieldset>
            {w.relationship_id && steps.some((item) => item.section === "Main work") && <div className="workout-loads">
              <h3>Weights used</h3>
              <p className="member-muted">Optional. Record a working weight for each exercise. Enter 0 for bodyweight.</p>
              {steps.map((item, index) => item.section === "Main work" && <div className="workout-load-row" key={index}>
                <strong>{item.title}</strong>
                {previousLoads[item.title.trim().toLocaleLowerCase()] && <small>Last time: {displayExerciseLoad(previousLoads[item.title.trim().toLocaleLowerCase()].load)} · {previousLoads[item.title.trim().toLocaleLowerCase()].performedOn}</small>}
                <div className="workout-load-fields">
                  <label>Weight (lb)<input type="number" inputMode="decimal" min="0" max="2000" step="0.25" value={session.loads?.[index]?.weight ?? ""} onChange={(e) => updateLoad(index, "weight", e.target.value)} placeholder="Optional" disabled={pending} /></label>
                  <label>Reps<input type="number" inputMode="numeric" min="1" max="500" step="1" value={session.loads?.[index]?.reps ?? ""} onChange={(e) => updateLoad(index, "reps", e.target.value)} placeholder="Optional" disabled={pending} /></label>
                </div>
              </div>)}
            </div>}
            <label className="member-field">
              Effort{" "}
              <span className="workout-optional">
                Optional · 1 is very easy, 10 is maximum effort
              </span>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
              >
                <option value="">Choose your effort</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                    {i === 0
                      ? " · Very easy"
                      : i === 9
                        ? " · Maximum effort"
                        : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="member-field">
              {demo
                ? "Practice note (only in this browser)"
                : "A note for Kelsey"}{" "}
              <span className="workout-optional">Optional</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="A small win, something tricky, or how you’re feeling…"
              />
            </label>
            <div className="workout-review-actions">
              <button
                className="member-button"
                disabled={pending || preview}
                onClick={finish}
              >
                {preview
                  ? "Preview — nothing is saved"
                  : pending
                    ? "Saving…"
                    : demo
                      ? "Save demo session"
                      : "Save my session"}
                {!pending && !preview && <WorkoutIcon name="check" />}
              </button>
              <button
                className="workout-text-button"
                disabled={pending}
                onClick={() => setReview(false)}
              >
                Back to session
              </button>
            </div>
          </div>
        )}
      </div>
      {!review && (
        <footer className="workout-controls">
          <div className="workout-control-main">
            <button
              className="workout-pause"
              onClick={() =>
                resting
                  ? restRunning
                    ? pauseRest()
                    : resumeRest()
                  : running
                    ? pause()
                    : start()
              }
              disabled={resting && session.rest === 0}
              aria-label={
                resting
                  ? restRunning
                    ? "Pause rest"
                    : "Resume rest"
                  : running
                    ? "Pause workout"
                    : "Resume workout"
              }
            >
              <WorkoutIcon
                name={(resting ? restRunning : running) ? "pause" : "play"}
              />
              <span>
                {(resting ? restRunning : running) ? "Pause" : "Resume"}
              </span>
            </button>
            <button
              className="member-button workout-next"
              onClick={() =>
                resting ? continueWorkout() : advance()
              }
            >
              {resting
                ? "Continue workout"
                : repeatRound
                  ? "Repeat round"
                : nextStep
                  ? "Next movement"
                  : "Finish & check in"}
              <WorkoutIcon name={nextStep ? "next" : "check"} />
            </button>
          </div>
          <div className="workout-control-secondary">
            <button
              className="workout-text-button"
              disabled={session.index === 0 || resting}
              onClick={() => moveStep(-1)}
            >
              ← Previous
            </button>
            <span>
              {resting ? "Optional rest" : running ? "In progress" : "Paused"}
            </span>
            {nextStep ? (
              <button className="workout-text-button" onClick={() => checkIn(true)}>
                Finish early
              </button>
            ) : (
              <span />
            )}
          </div>
        </footer>
      )}
      {message && (
        <p role="status" className="member-notice workout-status-message">
          {message}
        </p>
      )}
    </section>
  );
}
