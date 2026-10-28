import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import FirstWeek from "./first-week";
import { storyPreset } from "@/lib/progress-story";
import "@/components/progress-story.css";

export const metadata = { title: "Your first week with Kelsey | Holden Health" };
export default async function StartPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  return <main className="story-start"><header><BrandLogo href="https://www.holden.health" /><Link href="/login">Member log in</Link></header><div className="story-start-intro"><span className="story-eyebrow">Picture yourself here</span><h1>What would getting stronger let you do?</h1><p>You don’t need a perfect routine to begin. Start with something that matters to you.</p></div><FirstWeek initialGoal={storyPreset(goal)?.id || ""} /></main>;
}
