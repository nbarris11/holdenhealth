"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import TimerFields from "./timer-fields";
import {
  elapsedAt,
  formatClock,
  timerLength,
  timerPosition,
  validTimer,
  TIMER_DEFAULT,
  type TimerConfig,
} from "@/lib/workout-timer";
import "./workout-timer.css";
export default function WorkoutTimer({
  title,
  preset,
}: {
  title: string;
  preset?: TimerConfig | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [config, setConfig] = useState<TimerConfig>(
    validTimer(preset) ? preset : { ...TIMER_DEFAULT },
  );
  const [open, setOpen] = useState(false),
    [running, setRunning] = useState(false),
    [started, setStarted] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [finished, setFinished] = useState(false);
  const [volume, setVolume] = useState(0.5),
    [muted, setMuted] = useState(false),
    [keepAwake, setKeepAwake] = useState(true),
    [screenAwake, setScreenAwake] = useState(false),
    [soundNotice, setSoundNotice] = useState("");
  const anchor = useRef<number | null>(null),
    accumulated = useRef(0),
    audio = useRef<AudioContext | null>(null),
    lastCue = useRef("");
  const valid = validTimer(config),
    position = timerPosition(valid ? config : TIMER_DEFAULT, elapsed);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (!running) return;
    const update = () => {
      const value = elapsedAt(accumulated.current, anchor.current, Date.now());
      setElapsed(Math.min(value, timerLength(config) * 1000));
      if (value >= timerLength(config) * 1000) {
        accumulated.current = timerLength(config) * 1000;
        anchor.current = null;
        setRunning(false);
        setFinished(true);
      }
    };
    const id = window.setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [running, config]);
  useEffect(() => {
    if (!open || !running || !keepAwake || !("wakeLock" in navigator)) return;
    let disposed = false,
      sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (
        document.visibilityState !== "visible" ||
        disposed ||
        (sentinel && !sentinel.released)
      )
        return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          await lock.release();
          return;
        }
        sentinel = lock;
        setScreenAwake(true);
        lock.addEventListener("release", () => setScreenAwake(false));
      } catch {
        setScreenAwake(false);
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [open, running, keepAwake]);
  useEffect(() => {
    if (!started || !open) return;
    // Announce current transitions only; never replay missed cues after returning to the page.
    const key = `${position.round}:${position.phase}:${position.complete ? "end" : position.display <= 3 && config.mode !== "stopwatch" ? position.display : "phase"}`;
    if (key === lastCue.current) return;
    lastCue.current = key;
    const ctx = audio.current;
    if (
      muted ||
      volume === 0 ||
      !ctx ||
      ctx.state !== "running" ||
      document.visibilityState !== "visible" ||
      (!running && !position.complete)
    )
      return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = position.complete
      ? 880
      : position.phase === "Rest"
        ? 440
        : 660;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * 0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [
    started,
    open,
    running,
    position.round,
    position.phase,
    position.display,
    position.complete,
    config.mode,
    muted,
    volume,
  ]);
  useEffect(
    () => () => {
      if (audio.current) void audio.current.close().catch(() => {});
    },
    [],
  );
  function pause() {
    accumulated.current = Math.min(
      elapsedAt(accumulated.current, anchor.current, Date.now()),
      timerLength(config) * 1000,
    );
    anchor.current = null;
    setElapsed(accumulated.current);
    setRunning(false);
  }
  function start() {
    if (!valid) return;
    if (!muted) {
      try {
        audio.current ??= new AudioContext();
        void audio.current
          .resume()
          .catch(() =>
            setSoundNotice(
              "Sound is unavailable. You can still follow the visual timer.",
            ),
          );
      } catch {
        setSoundNotice(
          "Sound is unavailable. You can still follow the visual timer.",
        );
      }
    }
    anchor.current = Date.now();
    lastCue.current = "";
    setStarted(true);
    setRunning(true);
  }
  function reset() {
    anchor.current = null;
    accumulated.current = 0;
    lastCue.current = "";
    setElapsed(0);
    setRunning(false);
    setStarted(false);
    setFinished(false);
  }
  function close() {
    pause();
    dialog.current?.close();
    setOpen(false);
  }
  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => setOpen(true)}
      >
        Start workout timer
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="workout-timer-dialog"
            aria-label={`${title} timer`}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClose={() => {
              if (open) close();
            }}
          >
            <div className="timer-header">
              <div>
                <span className="eyebrow">HOLDEN HEALTH</span>
                <h2>{title}</h2>
              </div>
              <button
                type="button"
                className="timer-close"
                aria-label="Close and pause timer"
                onClick={close}
              >
                ×
              </button>
            </div>
            {!started ? (
              <>
                <TimerFields config={config} onChange={setConfig} />
                <p className="fine-print">
                  Follow the written workout for exercises. This timer handles
                  timing and rounds.
                </p>
              </>
            ) : (
              <section
                className={`timer-face ${position.phase === "Rest" ? "rest" : ""}`}
              >
                <p className="timer-phase" role="status">
                  {finished
                    ? "Nice work."
                    : running
                      ? position.phase
                      : "Paused"}
                </p>
                <div
                  className="timer-digits"
                  role="timer"
                  aria-live="off"
                  aria-label={`${formatClock(position.display)} ${config.mode === "stopwatch" ? "elapsed" : "remaining"}`}
                >
                  {formatClock(position.display)}
                </div>
                {(config.mode === "interval" || config.mode === "emom") && (
                  <p>
                    Round {position.round} of {config.rounds}
                  </p>
                )}
                <p>
                  {formatClock(position.elapsed)} elapsed ·{" "}
                  {formatClock(position.total)} total
                </p>
                <progress
                  value={position.elapsed}
                  max={position.total}
                  aria-label="Workout timer progress"
                />
              </section>
            )}
            <div className="timer-sound">
              <label>
                Sound volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
              <label className="timer-check">
                <input
                  type="checkbox"
                  checked={muted}
                  onChange={(e) => {
                    setMuted(e.target.checked);
                    if (!e.target.checked) {
                      try {
                        audio.current ??= new AudioContext();
                        void audio.current.resume().catch(() => {});
                      } catch {
                        setSoundNotice("Sound is unavailable.");
                      }
                    }
                  }}
                />
                Mute sound cues
              </label>
              <label className="timer-check">
                <input
                  type="checkbox"
                  checked={keepAwake}
                  onChange={(e) => setKeepAwake(e.target.checked)}
                />
                Keep screen awake while running
              </label>
              <p className="fine-print">
                {screenAwake && running && keepAwake
                  ? "Screen is staying awake. "
                  : ""}
                Keep this screen open for sound cues. Closing the timer pauses
                it; leaving the page ends it.
              </p>
              {soundNotice && <p role="status">{soundNotice}</p>}
            </div>
            <div className="timer-controls">
              {!started ? (
                <button
                  type="button"
                  className="button primary"
                  disabled={!valid}
                  onClick={start}
                >
                  Start
                </button>
              ) : (
                <>
                  {!finished && (
                    <button
                      type="button"
                      className="button primary"
                      onClick={running ? pause : start}
                    >
                      {running ? "Pause" : "Resume"}
                    </button>
                  )}
                  {config.mode === "stopwatch" && started && !finished && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        pause();
                        setFinished(true);
                      }}
                    >
                      Finish
                    </button>
                  )}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={reset}
                  >
                    {finished ? "Set another timer" : "Reset & change settings"}
                  </button>
                </>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
