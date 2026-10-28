"use client";

import { useActionState, useState } from "react";
import { challengePageFields, type ChallengePageCopy } from "@/lib/challenge-page-copy";
import { Result, Submit } from "@/app/challenge/forms";
import { saveChallengePageCopy } from "./actions";

export default function PageCopyForm({ copy }: { copy: ChallengePageCopy }) {
  const [result, action] = useActionState(saveChallengePageCopy, {});
  const [values, setValues] = useState(copy);
  return (
    <form action={action} className="stack-form" noValidate>
      {Array.from(new Set(challengePageFields.map((field) => field.group))).map((group) => (
        <details key={group} open={group === "A little support at home"}>
          <summary><strong>{group}</strong></summary>
          <fieldset className="stack-form">
          <legend className="sr-only">{group}</legend>
          {challengePageFields.filter((field) => field.group === group).map((field) => (
            <label key={field.key}>
              {field.label}
              <textarea
                name={field.key}
                value={values[field.key]}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                maxLength={field.maxLength}
                rows={field.maxLength > 200 ? 3 : 2}
                required
              />
            </label>
          ))}
        </fieldset>
        </details>
      ))}
      <Submit>Save page wording</Submit>
      <Result result={result} />
    </form>
  );
}
