import {verifyAdmin} from "@/lib/auth";
import PersonalHabits from "@/components/personal-habits";
import {isUuid} from "@/lib/challenge";
import {notFound} from "next/navigation";
import Link from "next/link";
import "@/app/challenge/style.css";
export default async function Page({params}: {params: Promise<{memberId:string}>}) {await verifyAdmin();const {memberId}=await params;if(!isUuid(memberId))notFound();return <main className="app-shell workspace-page"><Link href={`/admin/training/${memberId}`}>← Client workspace</Link><h1>Personal training habits</h1><p>Read-only coach view. The client chooses and checks off their own habits.</p><PersonalHabits memberId={memberId} readOnly/></main>;}
