"use client";
import { useRef, useState } from "react";
import type { WorkoutStep } from "@/lib/workout-app";
import { LibraryPicker, SaveToLibrary } from "./library-controls";
type Row = { key: number; step: WorkoutStep };
const empty: WorkoutStep = {
  section: "Main work",
  title: "",
  dose: "",
  instructions: "",
  easier: "",
  demo: "",
};

export default function StepEditor({
  initial = [],
}: {
  initial?: WorkoutStep[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((step, key) => ({ key, step })),
  );
  const [selected, setSelected] = useState<number[]>([]);
  const nextKey = useRef(initial.length);
  const [active, setActive] = useState<number | null>(null);
  const [removed, setRemoved] = useState<{ row: Row; index: number } | null>(
    null,
  );
  function update(key: number, field: keyof WorkoutStep, value: string) {
    setRows((old) =>
      old.map((r) =>
        r.key === key ? { ...r, step: { ...r.step, [field]: value } } : r,
      ),
    );
  }
  function add(section: WorkoutStep["section"]) {
    const key = nextKey.current++;
    setRows((old) => [...old, { key, step: { ...empty, section } }]);
    setActive(key);
  }
  function move(index: number, direction: number) {
    setRows((old) => {
      const copy = [...old];
      [copy[index], copy[index + direction]] = [
        copy[index + direction],
        copy[index],
      ];
      return copy;
    });
  }
  return (
    <div className="workout-step-editor">
      <input
        type="hidden"
        name="steps"
        value={JSON.stringify(rows.map((r) => r.step))}
      />
      <LibraryPicker
        kind="movements"
        onAdd={(item) => {
          if (rows.length + item.content.steps.length > 40)
            return "This would exceed 40 movements. Remove some before adding this item.";
          const copies = item.content.steps.map((step) => ({
            key: nextKey.current++,
            step: { ...step },
          }));
          setRows((old) => [...old, ...copies]);
          if (copies[0]) setActive(copies[0].key);
          return `Added ${item.name}. Save the workout to keep these changes.`;
        }}
      />
      <div className="builder-exercise-count">
        <strong>
          {rows.length} {rows.length === 1 ? "movement" : "movements"}
        </strong>
        <span>In the order members will follow</span>
      </div>
      {!rows.length && (
        <div className="builder-empty">
          <strong>Start with a warm-up.</strong>
          <p>
            Add your exercises, then finish with a cool-down. Open any card to
            edit the details.
          </p>
        </div>
      )}
      {rows.map(({ key, step: s }, i) => (
        <details
          className="builder-exercise"
          key={key}
          open={active === key}
          onInvalidCapture={() => setActive(key)}
        >
          <summary
            onClick={(event) => {
              event.preventDefault();
              setActive(active === key ? null : key);
            }}
          >
            <span className="builder-exercise-number">{i + 1}</span>
            <span>
              <strong>{s.title || "New movement"}</strong>
              <small>
                {s.section} · {s.dose || "Add reps or time"}
              </small>
            </span>
            <span className="builder-edit-label">
              {active === key ? "Close −" : "Edit +"}
            </span>
          </summary>
          <div className="builder-exercise-fields">
            <label className="challenge-choice">
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, key]
                      : old.filter((k) => k !== key),
                  )
                }
              />{" "}
              Select for saved block
            </label>
            <SaveToLibrary
              kind="exercise"
              defaultName={s.title}
              getContent={() => ({ steps: [s] })}
            />
            <div className="builder-field-grid">
              <label>
                Movement name
                <input
                  value={s.title}
                  required
                  maxLength={140}
                  placeholder="e.g. Chair sit-to-stand"
                  onChange={(e) => update(key, "title", e.target.value)}
                />
              </label>
              <label>
                Part of workout
                <select
                  value={s.section}
                  onChange={(e) => update(key, "section", e.target.value)}
                >
                  <option>Warm-up</option>
                  <option>Main work</option>
                  <option>Cool-down</option>
                </select>
              </label>
            </div>
            <label>
              Reps or time
              <input
                value={s.dose}
                placeholder="e.g. 5 repetitions or 30 seconds"
                maxLength={120}
                onChange={(e) => update(key, "dose", e.target.value)}
              />
            </label>
            <label>
              How to do it
              <textarea
                rows={3}
                value={s.instructions}
                maxLength={1500}
                placeholder="Explain the movement and when to rest."
                onChange={(e) => update(key, "instructions", e.target.value)}
              />
            </label>
            <label>
              Easier option — optional
              <textarea
                rows={2}
                value={s.easier}
                maxLength={600}
                onChange={(e) => update(key, "easier", e.target.value)}
              />
            </label>
            <label>
              Demonstration link — optional
              <input
                type="url"
                value={s.demo}
                maxLength={2000}
                placeholder="https://…"
                onChange={(e) => update(key, "demo", e.target.value)}
              />
            </label>
            <div className="builder-exercise-actions">
              <button type="button" disabled={!i} onClick={() => move(i, -1)}>
                ↑ Move up
              </button>
              <button
                type="button"
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓ Move down
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemoved({ row: rows[i], index: i });
                  setRows((old) => old.filter((r) => r.key !== key));
                  setActive(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
      {removed && (
        <div className="builder-undo" role="status">
          <span>Removed {removed.row.step.title || "movement"}.</span>
          <button
            type="button"
            disabled={rows.length >= 40}
            onClick={() => {
              const restore = removed;
              setRows((old) => {
                const copy = [...old];
                copy.splice(
                  Math.min(restore.index, copy.length),
                  0,
                  restore.row,
                );
                return copy;
              });
              setActive(restore.row.key);
              setRemoved(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      {rows.some((r) => selected.includes(r.key)) && (
        <SaveToLibrary
          kind="block"
          getContent={() => ({
            steps: rows
              .filter((r) => selected.includes(r.key))
              .map((r) => r.step),
          })}
        />
      )}
      <div className="builder-add-actions">
        {(["Warm-up", "Main work", "Cool-down"] as const).map((section) => (
          <button
            key={section}
            className="button secondary"
            type="button"
            disabled={rows.length >= 40}
            onClick={() => add(section)}
          >
            + {section === "Main work" ? "Exercise" : section.toLowerCase()}
          </button>
        ))}
      </div>
      <p className="builder-help">
        Changes are saved when you select Save workout in the Publish step.
      </p>
    </div>
  );
}
