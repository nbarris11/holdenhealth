// Explicit title matching: unfamiliar or edited exercise names keep their written plan.
export type MovementId =
  "chair" | "wall" | "heel" | "march" | "squat" | "hinge" | "row" | "carry";
export type MovementGuide = {
  id: MovementId;
  cue: string;
  labels: [string, string];
  description: string;
  source: string;
};
const nhs = "https://www.nhs.uk/live-well/exercise/strength-exercises/";
const guides: Record<string, MovementGuide> = {
  "chair sit-to-stand": {
    id: "chair",
    cue: "Feet planted. Stand tall, then sit with control.",
    labels: ["Sit", "Stand"],
    description:
      "Side views of a person seated on a stable chair, then standing with feet planted.",
    source: nhs,
  },
  "wall push-up": {
    id: "wall",
    cue: "Keep your body in one line as your elbows bend.",
    labels: ["Set up", "Lower"],
    description:
      "Side views of a wall push-up: hands against the wall, then elbows bent as the straight body leans toward the wall.",
    source: nhs,
  },
  "supported heel raise": {
    id: "heel",
    cue: "Keep your support. Lift your heels, then lower slowly.",
    labels: ["Heels down", "Heels up"],
    description:
      "A standing person holding a fixed support, first with heels down and then rising onto the balls of the feet.",
    source: nhs,
  },
  "seated march": {
    id: "march",
    cue: "Sit tall and lift one knee at a time.",
    labels: ["Feet down", "Lift one knee"],
    description:
      "A person sitting on a chair with both feet down, then one bent knee lifted. Alternate sides.",
    source: "https://www.nhs.uk/live-well/exercise/sitting-exercises/",
  },
  "goblet squat": {
    id: "squat",
    cue: "Hold the weight close. Keep your feet grounded.",
    labels: ["Stand", "Lower"],
    description:
      "Side views of a goblet squat: standing with a weight at the chest, then lowering with hips and knees bent and feet planted.",
    source:
      "https://www.nasm.org/resource-center/exercise-library/goblet-squat",
  },
  "dumbbell romanian deadlift": {
    id: "hinge",
    cue: "Send your hips back; keep the weights close to your legs.",
    labels: ["Stand", "Hinge"],
    description:
      "Side views of a Romanian deadlift with soft knees: upright, then hinging at the hips with a long spine and weights close to the legs.",
    source:
      "https://www.acefitness.org/continuing-education/certified/may-2025/8865/the-ace-do-it-better-series-the-romanian-deadlift/",
  },
  "one-arm dumbbell row": {
    id: "row",
    cue: "Keep your torso still as you draw your elbow back.",
    labels: ["Arm long", "Row"],
    description:
      "Side views of a bench-supported one-arm row: one hand and knee supported, the other arm lowering a dumbbell, then drawing it toward the ribs without twisting.",
    source:
      "https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/",
  },
  "suitcase carry": {
    id: "carry",
    cue: "Walk tall with the weight at your side. Switch sides.",
    labels: ["Stand tall", "Walk"],
    description:
      "A person holding one weight at their side, standing upright, then taking a controlled step without leaning sideways.",
    source:
      "https://www.catalystathletics.com/exercise/514/1-Arm-Farmer-Carry/",
  },
};
export function movementGuide(title: string): MovementGuide | null {
  const name = title
    .replace(/^Round\s+\d+\s*[·:–-]\s*/i, "")
    .trim()
    .toLowerCase();
  return guides[name] || null;
}
export function movementRound(title: string, titles: string[]) {
  const match = /^Round\s+(\d+)\s*[·:–-]\s*(.+)$/i.exec(title);
  if (!match)
    return {
      title,
      label: title === "Optional third round" ? "Optional round 3" : null,
    };
  const rounds = titles.map((t) =>
    Number(/^Round\s+(\d+)\s*[·:–-]/i.exec(t)?.[1] || 0),
  );
  const total = Math.max(...rounds, Number(match[1]));
  return { title: match[2], label: `Round ${Number(match[1])} of ${total}` };
}
export function restSecondsRemaining(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
