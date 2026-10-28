"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Retains entered notes when a server action returns an error. */
export default function MemberActionForm({ action, className, children }: {
  action: (data: FormData) => Promise<{ error?: string; redirect?: string }>;
  className?: string; children: ReactNode;
}) {
  const router = useRouter(), lock = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <form className={className} onSubmit={async event => {
    event.preventDefault();
    if (lock.current) return;
    const data = new FormData(event.currentTarget);
    lock.current = true; setPending(true); setError("");
    try {
      const result = await action(data);
      if (result.redirect) { router.push(result.redirect); router.refresh(); }
      else setError(result.error || "Your change could not be saved. Please try again.");
    } catch { setError("We couldn’t confirm the save. Your notes are still here. Please retry."); }
    finally { lock.current = false; setPending(false); }
  }}>
    {error && <p className="notice error" role="alert">{error}</p>}
    <fieldset className="intake-submit-group" disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Saving…</p>}
  </form>;
}
