"use client";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { memberNavItems } from "@/lib/member-nav-items";
import { useChatUnread } from "./chat-nav-link";
function Icon({ name }: { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {name === "work" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="m8 9 2 2 5-5M8 15h8m-8 3h5" />
        </>
      ) : name === "habits" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </>
      ) : (
        <>
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </>
      )}
    </svg>
  );
}
export default function MemberNav({ canChat, habitUnread }: { canChat: boolean; habitUnread: number }) {
  const path = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const challenge = params.get("challenge");
  const chatUnread = useChatUnread(canChat);
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return (
    <nav className="member-bottom-nav" aria-label="Member app">
      {memberNavItems({ canChat, habitUnread }).map((item) => {
        const active = path.startsWith(item.href) || (item.label === "Habits" && path.startsWith("/portal/training/habits"));
        const badge = item.label === "Messages" ? chatUnread : item.badge ?? 0;
        return (
          <Link
            key={item.href}
            href={`${item.href}${challenge && item.label !== "Messages" ? `?challenge=${encodeURIComponent(challenge)}` : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {badge > 0 ? <span className="member-nav-badge" aria-label={`${badge} new`}>{badge > 99 ? "99+" : badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MemberAccountLink() {
  const params = useSearchParams();
  const challenge = params.get("challenge");
  return <Link className="member-account" href={`/portal/more${challenge ? `?challenge=${encodeURIComponent(challenge)}` : ""}`}>My account</Link>;
}
