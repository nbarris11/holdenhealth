import type { MovementGuide, MovementId } from "@/lib/movement-guide";
type Point = [number, number];
type Pose = {
  head: Point;
  shoulder: Point;
  hip: Point;
  knee: Point;
  ankle: Point;
  elbow: Point;
  hand: Point;
  farLeg?: [Point, Point];
  farArm?: [Point, Point];
  weight?: boolean;
};
const stand: Pose = {
  head: [66, 29],
  shoulder: [66, 51],
  hip: [66, 98],
  knee: [64, 130],
  ankle: [64, 164],
  elbow: [72, 75],
  hand: [78, 101],
};
const seated: Pose = {
  head: [53, 39],
  shoulder: [53, 61],
  hip: [53, 111],
  knee: [91, 115],
  ankle: [91, 164],
  elbow: [67, 85],
  hand: [91, 95],
};
function pose(id: MovementId, end: boolean): Pose {
  switch (id) {
    case "chair":
      return end
        ? { ...stand, elbow: [81, 77], hand: [93, 87] }
        : {
            ...seated,
            head: [66, 43],
            shoulder: [60, 65],
            elbow: [75, 85],
            hand: [89, 95],
          };
    case "squat":
      return end
        ? {
            head: [76, 52],
            shoulder: [68, 74],
            hip: [48, 113],
            knee: [87, 120],
            ankle: [73, 164],
            elbow: [76, 101],
            hand: [90, 78],
            weight: true,
          }
        : { ...stand, elbow: [77, 82], hand: [87, 61], weight: true };
    case "wall":
      return end
        ? {
            head: [104, 36],
            shoulder: [97, 58],
            hip: [78, 105],
            knee: [65, 133],
            ankle: [52, 164],
            elbow: [98, 86],
            hand: [127, 57],
          }
        : {
            head: [86, 32],
            shoulder: [82, 54],
            hip: [69, 101],
            knee: [60, 132],
            ankle: [52, 164],
            elbow: [104, 55],
            hand: [127, 57],
          };
    case "heel":
      return end
        ? {
            ...stand,
            head: [66, 21],
            shoulder: [66, 43],
            hip: [66, 90],
            knee: [66, 122],
            ankle: [67, 156],
            elbow: [94, 58],
            hand: [119, 68],
          }
        : { ...stand, elbow: [92, 64], hand: [119, 68] };
    case "march":
      return end
        ? {
            ...seated,
            knee: [91, 96],
            ankle: [99, 139],
            elbow: [51, 87],
            hand: [49, 112],
            farLeg: [
              [84, 115],
              [84, 164],
            ],
          }
        : {
            ...seated,
            elbow: [51, 87],
            hand: [49, 112],
            farLeg: [
              [84, 115],
              [84, 164],
            ],
          };
    case "hinge":
      return end
        ? {
            head: [108, 63],
            shoulder: [87, 74],
            hip: [46, 99],
            knee: [67, 131],
            ankle: [64, 164],
            elbow: [85, 104],
            hand: [81, 134],
            weight: true,
          }
        : { ...stand, elbow: [75, 79], hand: [79, 109], weight: true };
    case "row":
      return {
        head: [122, 52],
        shoulder: [99, 55],
        hip: [54, 66],
        knee: [42, 112],
        ankle: [38, 164],
        elbow: end ? [79, 72] : [99, 85],
        hand: end ? [88, 93] : [99, 118],
        farLeg: [
          [64, 105],
          [40, 105],
        ],
        farArm: [
          [115, 75],
          [121, 107],
        ],
        weight: true,
      };
    case "carry":
      return {
        ...stand,
        elbow: [71, 79],
        hand: [73, 110],
        weight: true,
        knee: end ? [85, 130] : [65, 132],
        ankle: end ? [98, 164] : [64, 164],
        farLeg: end
          ? [
              [49, 130],
              [34, 164],
            ]
          : [
              [54, 130],
              [52, 164],
            ],
      };
  }
}
function limb(points: Point[], color: string, width: number) {
  return (
    <polyline
      points={points.map((p) => p.join(",")).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
function Person({ p, raised }: { p: Pose; raised: boolean }) {
  return (
    <>
      {p.farLeg && limb([p.hip, ...p.farLeg], "#8f80a5", 11)}
      {p.farArm && limb([p.shoulder, ...p.farArm], "#b2a0c3", 9)}
      {limb([p.hip, p.knee, p.ankle], "#514164", 13)}
      {limb(
        [
          [p.ankle[0] - 4, p.ankle[1]],
          [p.ankle[0] + 12, raised ? 166 : p.ankle[1]],
        ],
        "#30253d",
        7,
      )}
      {limb([p.shoulder, p.hip], "#9680b4", 22)}
      {limb([p.shoulder, [p.head[0], p.head[1] + 12]], "#c89576", 9)}
      <circle cx={p.head[0]} cy={p.head[1]} r="12" fill="#d6aa8d" />
      <path
        d={`M ${p.head[0] - 11} ${p.head[1] + 1} Q ${p.head[0] - 15} ${p.head[1] - 16} ${p.head[0] + 7} ${p.head[1] - 10}`}
        fill="#403047"
      />
      {limb([p.shoulder, p.elbow, p.hand], "#d6aa8d", 9)}
      {p.weight && (
        <g
          transform={`translate(${p.hand[0]},${p.hand[1]})`}
          stroke="#30253d"
          strokeWidth="4"
        >
          <path d="M-10 0H10" />
          <rect
            x="-14"
            y="-8"
            width="7"
            height="16"
            rx="2"
            fill="#55416b"
            strokeWidth="1"
          />
          <rect
            x="7"
            y="-8"
            width="7"
            height="16"
            rx="2"
            fill="#55416b"
            strokeWidth="1"
          />
        </g>
      )}
    </>
  );
}
function Scene({ id, end }: { id: MovementId; end: boolean }) {
  return (
    <g>
      <ellipse cx="78" cy="171" rx="59" ry="5" fill="#ded6e8" />
      {(id === "chair" || id === "march") && (
        <g stroke="#9b8bab" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M29 64v53h44M32 117v49M72 117v49" />
        </g>
      )}
      {id === "wall" && (
        <path d="M132 18v151" stroke="#b4a4c3" strokeWidth="6" />
      )}
      {id === "heel" && (
        <g stroke="#a899b8" strokeWidth="5" fill="none">
          <path d="M116 68h27M127 69v98" />
        </g>
      )}
      {id === "row" && (
        <g stroke="#9b8bab" strokeWidth="5" fill="none">
          <path d="M51 109h81M57 110v57M126 110v57" />
        </g>
      )}
      <Person p={pose(id, end)} raised={id === "heel" && end} />
    </g>
  );
}
export default function MovementIllustration({
  guide,
}: {
  guide: MovementGuide;
}) {
  return (
    <figure className="movement-visual">
      <svg viewBox="0 0 340 195" role="img" aria-label={guide.description}>
        <g transform="translate(0,0)">
          <Scene id={guide.id} end={false} />
        </g>
        <path
          d="M159 94h20m-5-5 5 5-5 5"
          stroke="#9680b4"
          strokeWidth="2"
          fill="none"
        />
        <g transform="translate(180,0)">
          <Scene id={guide.id} end />
        </g>
        <text x="76" y="192" textAnchor="middle">
          {guide.labels[0]}
        </text>
        <text x="256" y="192" textAnchor="middle">
          {guide.labels[1]}
        </text>
      </svg>
      <figcaption>
        {guide.id === "row" && (
          <span className="movement-variation">Bench-supported variation</span>
        )}
        <span className="movement-cue">{guide.cue}</span>
        <a href={guide.source} target="_blank" rel="noopener noreferrer">
          Form reference ↗
        </a>
      </figcaption>
    </figure>
  );
}
