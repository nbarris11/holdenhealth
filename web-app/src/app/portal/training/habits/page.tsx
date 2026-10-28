import {verifySession} from "@/lib/auth";
import PersonalHabits from "@/components/personal-habits";
import Link from "next/link";
import "@/app/challenge/style.css";
export default async function Page() {const user=await verifySession(); return <main className="member-page"><Link href="/portal/training">← Personal training</Link><h1>Your weekly habits</h1><PersonalHabits memberId={user.userId}/></main>;}
