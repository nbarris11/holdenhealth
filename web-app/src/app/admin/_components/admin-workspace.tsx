"use client";

import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/admin/activity", label: "Activity", icon: "◉", matches: ["/admin/activity"] },
  { href: "/admin/challenges", label: "Challenges", icon: "✓", matches: ["/admin/challenges"] },
  { href: "/admin", label: "Today", icon: "⌂", matches: ["/admin"] },
  { href: "/admin/people", label: "People", icon: "◎", matches: ["/admin/people", "/admin/members"] },
  { href: "/admin/leads", label: "Leads", icon: "✉", matches: ["/admin/leads"] },
  { href: "/admin/training", label: "Programs", icon: "◇", matches: ["/admin/training", "/admin/programs"] },
  { href: "/admin/classes", label: "Schedule", icon: "□", matches: ["/admin/classes"] },
  { href: "/admin/consultations", label: "Zoom calls", icon: "◷", matches: ["/admin/consultations"] },
  { href: "/admin/communicate", label: "Communicate", icon: "↗", matches: ["/admin/communicate"] },
  { href: "/admin/communications", label: "Email", icon: "✉", matches: ["/admin/communications"] },
  { href: "/admin/reports", label: "Reports", icon: "≡", matches: ["/admin/reports"] },
  { href: "/admin/analytics", label: "Analytics", icon: "◫", matches: ["/admin/analytics"] },
  { href: "/admin/stories", label: "Member stories", icon: "♡", matches: ["/admin/stories"] },
  { href: "/admin/content", label: "Content", icon: "◇", matches: ["/admin/content", "/admin/website"] },
];

function matchesPath(pathname: string, patterns: string[]) {
  return patterns.some((pattern) => pattern === "/admin" ? pathname === pattern : pathname.startsWith(pattern));
}

export default function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPrivateWorkspace = pathname !== "/admin/login" && pathname !== "/admin/set-password";

  if (!isPrivateWorkspace) return children;

  return <div className="admin-workspace-frame">
    <aside className="admin-workspace-nav">
      <BrandLogo className="workspace-brand" href="/admin" subtitle="Kelsey's workspace" />
      <nav aria-label="Admin navigation">
        {navigation.map((item) => <Link className={matchesPath(pathname, item.matches) ? "active" : ""} href={item.href} aria-current={matchesPath(pathname, item.matches) ? "page" : undefined} key={item.href}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
      </nav>
      <Link className={`workspace-settings ${pathname.startsWith("/admin/settings") ? "active" : ""}`} href="/admin/settings"><span aria-hidden="true">⚙</span> Settings</Link>
    </aside>
    <div className="admin-workspace-content">{children}</div>
  </div>;
}
