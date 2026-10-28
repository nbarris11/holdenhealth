"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function BillingActionForm({ action, children, confirm, reset = false }: {
  action: (data: FormData) => Promise<{ error?: string; success?: string; url?: string }>;
  children: ReactNode; confirm?: string; reset?: boolean;
}) {
  const router = useRouter(), lock = useRef(false);
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  return <form className="stack-form" onSubmit={async event => {
    event.preventDefault();
    if (lock.current || (confirm && !window.confirm(confirm))) return;
    const form = event.currentTarget, data = new FormData(form);
    lock.current = true; setPending(true); setMessage("");
    try {
      const result = await action(data);
      if (result.url) { window.location.assign(result.url); return; }
      setError(Boolean(result.error)); setMessage(result.error || result.success || "Saved.");
      if (result.success && reset) form.reset();
      router.refresh();
    } catch { setError(true); setMessage("We couldn’t confirm that action. Refresh the page before retrying."); }
    finally { lock.current = false; setPending(false); }
  }}>
    <fieldset className="intake-submit-group" disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Please wait…</p>}
    {message && <p className={`notice ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{message}</p>}
  </form>;
}
