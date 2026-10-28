"use client";
import { useEffect, useRef, useState } from "react";
import { timerCue, type SoundFrame } from "@/lib/timer-sound";

export default function useTimerSound(userId: string, frame: SoundFrame) {
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const previous = useRef<SoundFrame | null>(null);
  const allowed = useRef(false);
  const key = `holden:timer-sound:${userId}`;
  useEffect(() => {
    try {
      const on = localStorage.getItem(key) === "on";
      allowed.current = on;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(on);
    } catch {
      /* Sound remains optional if storage is blocked. */
    }
    return () => {
      void context.current?.close();
      context.current = null;
    };
  }, [key]);
  async function unlock() {
    if (!allowed.current) return false;
    try {
      context.current ??= new AudioContext();
      if (context.current.state === "suspended") await context.current.resume();
      setUnavailable(false);
      return context.current.state === "running";
    } catch {
      setUnavailable(true);
      return false;
    }
  }
  function play(cue: "tick" | "finish" | "move" | "celebrate" | "saved") {
    try {
    const ctx = context.current;
    if (!allowed.current || !ctx || ctx.state !== "running" || document.hidden)
      return;
    const tones = cue === "tick" ? [660]
      : cue === "move" ? [523.25, 659.25]
      : cue === "celebrate" ? [523.25, 659.25, 783.99, 1046.5]
      : cue === "saved" ? [523.25, 659.25, 783.99]
      : [660, 880];
    tones.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
    } catch { setUnavailable(true); }
  }
  async function toggle() {
    const next = !enabled;
    allowed.current = next;
    setEnabled(next);
    previous.current = null;
    try {
      localStorage.setItem(key, next ? "on" : "off");
    } catch {}
    if (next) {
      if (await unlock()) play("tick");
    } else {
      const oldContext = context.current;
      context.current = null;
      await oldContext?.close();
      setUnavailable(false);
    }
  }
  useEffect(() => {
    const cue = timerCue(previous.current, frame);
    previous.current = frame;
    if (enabled && cue) play(cue);
    // Primitive values intentionally avoid replaying cues on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    frame.kind,
    frame.segment,
    frame.remaining,
    frame.active,
    frame.complete,
    enabled,
  ]);
  return { enabled, unavailable, toggle, unlock, play };
}
