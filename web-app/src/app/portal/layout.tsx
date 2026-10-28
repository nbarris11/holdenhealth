import Link from "next/link";
import { hasChatAccess } from "@/lib/chat-access";
import BrandLogo from "@/components/brand-logo";
import { Suspense } from "react";
import MemberNav, { MemberAccountLink } from "@/components/member-nav";
import { memberHabitUnread } from "@/lib/member-habit-unread";
import { verifySession } from "@/lib/auth";
import "./member.css";
import "./workouts/workout-design.css";
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  const [habitUnread, canChat] = await Promise.all([memberHabitUnread(), hasChatAccess()]);
  return (
    <div className="member-app">
      <a className="member-skip" href="#member-content">
        Skip to content
      </a>
      <header className="member-topbar">
        <BrandLogo href="/portal/workouts" subtitle="YOUR DAILY PRACTICE" />
        <div className="chat-top-links"><Suspense fallback={<Link href="/portal/more" className="member-account">My account</Link>}><MemberAccountLink /></Suspense></div>
      </header>
      <div id="member-content">{children}</div>
      <Suspense>
        <MemberNav canChat={canChat} habitUnread={habitUnread} />
      </Suspense>
    </div>
  );
}
