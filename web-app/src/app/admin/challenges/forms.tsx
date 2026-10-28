"use client";
import { useActionState, useState } from "react";
import { saveChallenge, setArchived } from "./actions";
import { Result, Submit } from "@/app/challenge/forms";
import type { Challenge, GoalOption } from "@/lib/challenge";
import { challengeDays } from "@/lib/challenge";
export function SettingsForm({
  challenge,
  defaults,
  locked,
}: {
  challenge?: Challenge;
  defaults: GoalOption[];
  locked: boolean;
}) {
  const [result, action] = useActionState(saveChallenge, {});
  return (
    <form action={action} className="stack-form">
      <input name="id" type="hidden" value={challenge?.id || ""} />
      <label>
        Challenge name
        <input
          name="title"
          defaultValue={challenge?.title || "The 14-day habit challenge"}
          required
          maxLength={120}
        />
      </label>
      <label>
        Start date
        <input
          type="date"
          name="starts_on"
          defaultValue={challenge?.starts_on || "2026-09-21"}
          readOnly={locked}
          required
        />
      </label>
      <p className="fine-print">
        Runs for {challenge ? challengeDays(challenge) : 14} days, including the start date.{" "}
        {locked
          ? "Dates are locked because participants have joined."
          : "Late arrivals join on the current challenge day."}
      </p>
      <label id="kelsey-note">
        A note from Kelsey
        <textarea
          name="welcome"
          aria-describedby="kelsey-note-help"
          defaultValue={challenge?.welcome || ""}
          maxLength={10000}
          rows={5}
        />
      </label>
      <p className="fine-print" id="kelsey-note-help">
        This is the message in the “A note from Kelsey” box on the free
        challenge page. Edit it here, then choose Save challenge below.
      </p>
      <label>
        WhatsApp group invite link
        <input
          name="community_url"
          type="url"
          placeholder="https://chat.whatsapp.com/…"
          defaultValue={challenge?.community_url || ""}
        />
      </label>
      <label>
        Goal options — one per line: Category | Habit
        <textarea
          name="goal_options"
          rows={16}
          defaultValue={(challenge?.goal_options || defaults)
            .map((g) => `${g.category} | ${g.label}`)
            .join("\n")}
          required
        />
      </label>
      <p className="fine-print">
        Participants choose three goals or write their own. Edits here only
        affect future signups; existing participants keep their goals.
      </p>
      <label className="challenge-choice">
        <input
          type="checkbox"
          name="published"
          defaultChecked={challenge?.published || false}
        />
        Publish challenge page
      </label>
      <label className="challenge-choice">
        <input
          type="checkbox"
          name="signup_open"
          defaultChecked={challenge?.signup_open || false}
        />
        Allow free signup, including late arrivals
      </label>
      <Submit>Save challenge</Submit>
      <Result result={result} />
    </form>
  );
}
export { default as WorkoutForm } from "./workout-builder";

export function ArchiveForm({
  id,
  kind,
  archived,
}: {
  id: string;
  kind: "challenge" | "workout";
  archived: boolean;
}) {
  const [result, action] = useActionState(setArchived, {});
  const [confirm, setConfirm] = useState(false);
  return (
    <form action={action} onSubmit={() => setConfirm(false)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="archived" value={String(!archived)} />
      {confirm ? (
        <div className="soft-note">
          <p>
            {archived
              ? "Restore as a draft? It will stay hidden until you publish it."
              : `Archive this ${kind}? It will disappear from members, but their history will be kept.`}
          </p>
          <div className="button-row">
            <Submit>{archived ? "Confirm restore" : "Confirm archive"}</Submit>
            <button
              type="button"
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="button secondary"
          onClick={() => setConfirm(true)}
        >
          {archived ? "Restore as draft" : `Archive ${kind}`}
        </button>
      )}
      <Result result={result} />
    </form>
  );
}
