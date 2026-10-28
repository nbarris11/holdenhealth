"use client";
import { useState, useTransition } from "react";
import type { LibraryContent, LibraryItem } from "@/lib/workout-library";
import { listLibrary, saveLibrary, deleteLibrary } from "./library-actions";
export function SaveToLibrary({
  kind,
  getContent,
  defaultName = "",
}: {
  kind: LibraryItem["kind"];
  getContent: () => LibraryContent;
  defaultName?: string;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(defaultName),
    [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="library-save">
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(!open)}
      >
        Save{" "}
        {kind === "workout"
          ? "workout as template"
          : kind === "block"
            ? "selection to library"
            : "exercise to library"}
      </button>
      {open && (
        <div className="library-panel">
          <label>
            Library name
            <input
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beginner warm-up"
            />
          </label>
          <button
            type="button"
            className="button primary"
            disabled={pending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  const r = await saveLibrary(name, kind, getContent());
                  setMessage(r.error || r.success || "");
                  if (r.success) setOpen(false);
                } catch {
                  setMessage(
                    "Could not save. Check the workout details and try again.",
                  );
                }
              })
            }
          >
            {pending ? "Saving…" : "Save to library"}
          </button>
        </div>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export function LibraryPicker({
  kind,
  challengeId,
  sessionId,
  relationshipId,
  onAdd,
}: {
  kind: "movements" | "workout";
  challengeId?: string;
  sessionId?: string;
  relationshipId?: string;
  onAdd?: (item: LibraryItem) => string;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<LibraryItem[]>([]),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function load() {
    setOpen(true);
    setMessage("");
    startTransition(async () => {
      try {
        const r = await listLibrary();
        if (r.error) setMessage(r.error);
        else setItems(r.items || []);
      } catch {
        setMessage(
          "Could not load the library. Close and reopen to try again.",
        );
      }
    });
  }
  const filtered = items.filter(
    (i) =>
      (kind === "workout" ? i.kind === "workout" : i.kind !== "workout") &&
      `${i.name} ${i.content.steps.map((s) => `${s.title} ${s.section}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="library-browser">
      <button
        type="button"
        className="button secondary"
        onClick={() => (open ? setOpen(false) : load())}
      >
        {open
          ? "Close library"
          : kind === "workout"
            ? "Start from a template"
            : "Add from library"}
      </button>
      {open && (
        <div className="library-panel">
          <label>
            Search saved{" "}
            {kind === "workout" ? "workouts" : "exercises and blocks"}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or movement"
            />
          </label>
          <p className="builder-help">
            {kind === "workout"
              ? "Opens a new draft in a separate tab. Choose its release date before publishing."
              : "Adds editable copies to the end of this workout. Move them into place afterward."}
          </p>
          {pending ? (
            <p>Loading…</p>
          ) : filtered.length ? (
            filtered.map((item) => (
              <article className="library-item" key={item.id}>
                <strong>{item.name}</strong>
                <small>
                  {item.kind} · {item.content.steps.length} movements
                </small>
                <details>
                  <summary>Preview</summary>
                  <ul>
                    {item.content.steps.map((s, i) => (
                      <li key={i}>
                        {s.title} — {s.dose}
                      </li>
                    ))}
                  </ul>
                  {item.content.template && (
                    <p>
                      {item.content.template.minutes} min ·{" "}
                      {item.content.template.equipment || "No equipment listed"}
                    </p>
                  )}
                </details>
                <div className="button-row">
                  {kind === "workout" ? (
                    <a
                      className="button secondary"
                      href={relationshipId ? `/admin/training/workouts/${relationshipId}?template=${item.id}#new-workout` : sessionId ? `/admin/programs/${sessionId}/workouts?template=${item.id}#new-workout` : `/admin/challenges?id=${challengeId}&template=${item.id}#new-workout`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Use template ↗
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setMessage(onAdd?.(item) || "Added to workout.")
                      }
                    >
                      Add to workout
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirm(item.id)}>
                    Remove from library
                  </button>
                </div>
                {confirm === item.id && (
                  <div>
                    <p>
                      Remove this saved item? Existing workouts will stay
                      unchanged.
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            const r = await deleteLibrary(item.id);
                            setMessage(r.error || r.success || "");
                            if (r.success) {
                              setItems((old) =>
                                old.filter((i) => i.id !== item.id),
                              );
                              setConfirm(null);
                            }
                          } catch {
                            setMessage(
                              "Could not remove the item. Please try again.",
                            );
                          }
                        })
                      }
                    >
                      Confirm removal
                    </button>{" "}
                    <button type="button" onClick={() => setConfirm(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p>
              {query
                ? "No matching items."
                : "Nothing saved yet. Save an exercise, block, or workout to build your library."}
            </p>
          )}
        </div>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
