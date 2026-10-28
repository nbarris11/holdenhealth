"use client";
import { normalizeChallengePageCopy, type ChallengePageCopy } from "@/lib/challenge-page-copy";
import PrivacyNotice from "@/components/privacy-notice";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { joinChallenge, requestChallengeLink } from "./actions";
import type { Challenge, FormResult } from "@/lib/challenge";
export function Submit({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={pending || disabled}>
      {pending ? "Saving…" : children}
    </button>
  );
}
export function Result({ result }: { result: FormResult }) {
  return (
    <>
      {result.error && (
        <p className="notice error" role="alert">
          {result.error}
        </p>
      )}
      {result.success && (
        <p className="notice success" role="status">
          {result.success}
        </p>
      )}
    </>
  );
}
export function EmailForm({ challengeId, copy = normalizeChallengePageCopy(null) }: { challengeId: string; copy?: ChallengePageCopy }) {
  const [result, action] = useActionState(requestChallengeLink, {});
  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="challenge_id" value={challengeId} />
      <label>{copy.email_label}<input
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
        />
      </label>
      <label className="challenge-trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <PrivacyNotice />
      <Submit>{copy.email_button}</Submit>
      <Result result={result} />
      <p className="fine-print">{copy.email_help}</p>
    </form>
  );
}
export function JoinForm({ challenge, copy = normalizeChallengePageCopy(null) }: { challenge: Challenge; copy?: ChallengePageCopy }) {
  const [result, action] = useActionState(joinChallenge, {});
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState(["", "", ""]);
  const count = selected.length + custom.filter((g) => g.trim()).length;
  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="challenge_id" value={challenge.id} />
      <label>{copy.name_label}<input
          name="display_name"
          required
          maxLength={100}
          autoComplete="name"
        />
      </label>
      <label>{copy.weekly_label}<select name="weekly_workouts" defaultValue="3">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "workout" : "workouts"}
            </option>
          ))}
        </select>
      </label>
      <p className="fine-print">{copy.weekly_help}</p>
      {[...new Set(challenge.goal_options.map((g) => g.category))].map(
        (category) => (
          <fieldset className="challenge-options" key={category}>
            <legend>{category}</legend>
            {challenge.goal_options
              .filter((g) => g.category === category)
              .map((g) => (
                <label className="challenge-choice" key={g.label}>
                  <input
                    type="checkbox"
                    name="goal"
                    value={g.label}
                    checked={selected.includes(g.label)}
                    disabled={count >= 3 && !selected.includes(g.label)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, g.label]
                          : selected.filter((s) => s !== g.label),
                      )
                    }
                  />
                  <span>{g.label}</span>
                </label>
              ))}
          </fieldset>
        ),
      )}
      <details>
        <summary>{copy.custom_heading}</summary>
        <p className="fine-print">{copy.custom_help}</p>
        {custom.map((g, i) => (
          <label key={i}>
            {copy.custom_label} {i + 1}
            <input
              name="custom_goal"
              maxLength={140}
              value={g}
              placeholder={copy.custom_placeholder}
              onChange={(e) =>
                setCustom(custom.map((s, j) => (i === j ? e.target.value : s)))
              }
            />
          </label>
        ))}
      </details>
      <p aria-live="polite">
        {count > 3
          ? `${count} habits chosen — remove ${count - 3} suggested or custom habit${count - 3 === 1 ? "" : "s"} before joining. Keep the three you want to work on.`
          : `${count} of 3 habits chosen. These stay consistent for the challenge.`}
      </p>
      <PrivacyNotice />
      <Submit disabled={count !== 3}>{copy.join_button}</Submit>
      <Result result={result} />
    </form>
  );
}
