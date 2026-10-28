"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./chat.css";
export function useChatUnread(enabled = true) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/chat", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (alive)
          setUnread(
            d.conversations.reduce(
              (n: number, c: { unread: number }) => n + Number(c.unread),
              0,
            ),
          );
      } catch {}
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [enabled]);
  return unread;
}
export default function ChatNavLink() {
  const unread = useChatUnread();
  return (
    <Link href="/portal/communicate" className="chat-nav-link">
      Messaging
      {unread > 0 ? (
        <span
          className="chat-nav-badge"
          aria-label={`${unread} unread messages`}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
