"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return <button className="button secondary" type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
    {pending ? "Refreshing…" : "↻ Refresh data"}
  </button>;
}
