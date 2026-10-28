import { redirect } from "next/navigation";

// Today was folded into Workouts; keep old links and bookmarks working.
export default async function Today({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const { challenge } = await searchParams;
  redirect(`/portal/workouts${challenge ? `?challenge=${encodeURIComponent(challenge)}` : ""}`);
}
