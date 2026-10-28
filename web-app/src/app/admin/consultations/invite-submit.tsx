"use client";

import { useFormStatus } from "react-dom";

export default function InviteSubmit({ retry = false }: { retry?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`button ${retry ? "secondary" : "primary"}`} type="submit" disabled={pending}>
    {pending ? "Sending…" : retry ? "Retry unsent invites" : "Send Zoom invite"}
  </button>;
}
