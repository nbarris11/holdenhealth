"use client";
import { useActionState } from "react";
import { headerFields, type WebsiteHeader } from "@/lib/website-header";
import { publishHeader } from "./header-actions";
export default function HeaderEditor({ value }: { value: WebsiteHeader }) {
  const [result, action, pending] = useActionState(publishHeader, {});
  return (
    <details className="panel" id="website-header">
      <summary>
        <strong>Website header — menu and buttons</strong>
      </summary>
      <p>
        These settings apply to every public page and the mobile menu. Keep
        labels short so the header stays uncluttered.
      </p>
      <form action={action} className="stack-form">
        <div className="builder-field-grid">
          {headerFields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                name={f.key}
                defaultValue={String(value[f.key])}
                required
                maxLength={"link" in f ? 700 : 30}
              />
            </label>
          ))}
        </div>
        {[
          ["join_visible", "Show Join now button"],
          ["call_visible", "Show Free call button"],
          ["app_visible", "Show The App link"],
        ].map(([key, label]) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              name={key}
              defaultChecked={value[key] === true}
            />
            {label}
          </label>
        ))}
        <p>
          Review the labels and destinations above, then publish them together.
        </p>
        <button className="button primary" disabled={pending}>
          {pending ? "Publishing…" : "Publish website header"}
        </button>
        {result.error && <p role="alert">{result.error}</p>}
        {result.success && <p role="status">{result.success}</p>}
      </form>
    </details>
  );
}
