import Link from "next/link";
import { hasChatAccess } from "@/lib/chat-access";
import ChatNavLink from "@/components/chat-nav-link";
import BrandLogo from "@/components/brand-logo";
import { Suspense } from "react";
import MemberNav, { MemberAccountLink } from "@/components/member-nav";
import { memberEnrollments } from "@/lib/member-enrollments";
import { verifySession } from "@/lib/auth";
import "./member.css";
import "./workouts/workout-design.css";
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  const [enrollments, canChat] = await Promise.all([memberEnrollments(), hasChatAccess()]);
  const hasClasses = Boolean(enrollments.length);
  return (
    <div className="member-app">
      <a className="member-skip" href="#member-content">
        Skip to content
      </a>
      <header className="member-topbar">
        <BrandLogo href="/portal/today" subtitle="YOUR DAILY PRACTICE" />
        <div className="chat-top-links">{canChat && <ChatNavLink />}<Suspense fallback={<Link href="/portal/more" className="member-account">My account</Link>}><MemberAccountLink /></Suspense></div>
      </header>
      <div id="member-content">{children}</div>
      <Suspense>
        <MemberNav hasClasses={hasClasses} />
      </Suspense>
    </div>
  );
}
