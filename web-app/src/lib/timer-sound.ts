export type SoundFrame = {
  kind: string;
  segment: string;
  remaining: number;
  active: boolean;
  complete: boolean;
};
export function timerCue(
  previous: SoundFrame | null,
  current: SoundFrame,
): "tick" | "finish" | null {
  if (
    !previous ||
    !previous.active ||
    previous.kind !== current.kind ||
    current.kind === "quiet"
  )
    return null;
  if (current.complete && !previous.complete) return "finish";
  if (!current.active) return null;
  if (previous.segment !== current.segment) return "finish";
  if (
    current.remaining >= 1 &&
    current.remaining <= 3 &&
    current.remaining < previous.remaining
  )
    return "tick";
  return null;
}
