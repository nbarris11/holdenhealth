"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ retry = false }: { retry?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`button ${retry ? "secondary" : "primary"}`} type="submit" disabled={pending}>
    {pending ? "Sending…" : retry ? "Retry confirmation email" : "Save lead and send confirmation"}
  </button>;
}
