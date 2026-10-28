"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation } from "@/lib/chat";
import "./chat.css";
type Inbox = {
  conversations: Conversation[];
  people: { id: string; full_name: string }[];
  admin: boolean;
  user: string;
  pushKey: string | null;
};
async function request(path = "", body?: unknown) {
  const response = await fetch(
    `/api/chat${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please retry.");
  return data;
}
const time = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export default function ChatInbox({
  admin = false,
  initialConversation = "",
}: {
  admin?: boolean;
  initialConversation?: string;
}) {
  const [inbox, setInbox] = useState<Inbox | null>(null),
    [selected, setSelected] = useState(initialConversation),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(!!initialConversation),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [pushEnabled, setPushEnabled] = useState(false),
    [pushBusy, setPushBusy] = useState(false);
  const pageRef = useRef<HTMLElement>(null);
  const scrollIntent = useRef<{cid: string; kind: "bottom" | "preserve"; height: number; top: number} | null>(null);
  const selectedRef = useRef(selected),
    feed = useRef<HTMLDivElement>(null),
    retry = useRef<{ conversation: string; body: string; id: string } | null>(
      null,
    ),
    requestVersion = useRef(0);
  useLayoutEffect(() => {
    const intent = scrollIntent.current;
    if (!intent || !feed.current || intent.cid !== selectedRef.current) return;
    feed.current.scrollTop = intent.kind === "bottom"
      ? feed.current.scrollHeight
      : intent.top + feed.current.scrollHeight - intent.height;
    scrollIntent.current = null;
  }, [messages]);
  const room = inbox?.conversations.find((c) => c.id === selected);
  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      pageRef.current?.style.setProperty('--chat-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      pageRef.current?.style.setProperty('--chat-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  const refreshInbox = useCallback(async () => {
    try {
      const data = await request();
      setInbox(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await request(
          admin && search.trim().length >= 2
            ? `?q=${encodeURIComponent(search.trim())}`
            : "",
        );
        if (alive) setInbox(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    const delay = setTimeout(load, 200);
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      alive = false;
      clearTimeout(delay);
      clearInterval(timer);
    };
  }, [admin, search]);
  const open = (id: string) => {
    if (id === selectedRef.current) return;
    selectedRef.current = id;
    setMessages([]);
    setPinned([]);
    setHasMore(false);
    setLoading(!!id);
    setSelected(id);
    setError("");
    setNotice("");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("conversation", id);
    else url.searchParams.delete("conversation");
    window.history.replaceState(null, "", url);
  };
  const loadMessages = useCallback(
    async (cid: string, older?: number) => {
      const version = requestVersion.current;
      const data = await request(
        `?conversation=${cid}${older ? `&before=${older}` : ""}`,
      );
      if (selectedRef.current !== cid || version !== requestVersion.current)
        return;
      const nearBottom =
        !feed.current ||
        feed.current.scrollHeight -
          feed.current.scrollTop -
          feed.current.clientHeight <
          100;
      scrollIntent.current = older || nearBottom ? {
        cid,
        kind: older ? "preserve" : "bottom",
        height: feed.current?.scrollHeight ?? 0,
        top: feed.current?.scrollTop ?? 0,
      } : null;
      setMessages((previous) => {
        if (older)
          return [
            ...data.messages,
            ...previous.filter(
              (m: ChatMessage) =>
                !data.messages.some((n: ChatMessage) => n.id === m.id),
            ),
          ];
        if (!data.messages.length) return [];
        const first = data.messages[0].id;
        return [...previous.filter((m) => m.id < first), ...data.messages];
      });
      setPinned(data.pinned);
      if (older || !messages.length) setHasMore(data.hasMore);
      const last = data.messages.at(-1)?.id;
      if (last && nearBottom && !document.hidden && !older) {
        await request("", { action: "read", conversation: cid, lastId: last });
        void refreshInbox();
      }
    },
    [messages.length, refreshInbox],
  );
  const loadRef = useRef(loadMessages);
  useEffect(() => {
    loadRef.current = loadMessages;
  }, [loadMessages]);
  useEffect(() => {
    selectedRef.current = selected;
    requestVersion.current++;
    if (!selected) return;
    let alive = true;
    const load = () =>
      loadRef
        .current(selected)
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    void load();
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [selected]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .getRegistration("/")
        .then(async (reg) => {
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            const state = await request("", {
              action: "push-status",
              endpoint: sub.endpoint,
            });
            setPushEnabled(state.enabled);
          }
        })
        .catch(() => {});
  }, []);
  async function start(member?: string) {
    setError("");
    try {
      const data = await request("", { action: "start", member });
      await refreshInbox();
      open(data.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function mutate(body: Record<string, unknown>) {
    setError("");
    try {
      await request("", { ...body, conversation: selected });
      await refreshInbox();
      await loadRef.current(selected);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const cid = selected,
      body = (drafts[cid] || "").trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    if (retry.current?.conversation !== cid || retry.current?.body !== body)
      retry.current = { conversation: cid, body, id: crypto.randomUUID() };
    try {
      await request("", {
        action: "send",
        conversation: cid,
        body,
        clientId: retry.current.id,
      });
      setDrafts((prev) => ({ ...prev, [cid]: "" }));
      retry.current = null;
      if (selectedRef.current === cid) {
        if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
        await loadRef.current(cid);
      }
      await refreshInbox();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  async function togglePush() {
    setPushBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "For iPhone notifications, add Holden Health to your Home Screen, open it there, then enable notifications. A supported browser is required.",
        );
      if (!inbox?.pushKey)
        throw new Error(
          "Phone notifications are being set up. Your messages are available here.",
        );
      // Safari requires the permission prompt directly from the button click,
      // before service-worker registration or other asynchronous work.
      if (!pushEnabled && (await Notification.requestPermission()) !== "granted")
        throw new Error(
          "Notifications are off. You can allow them in your browser or phone settings.",
        );
      const reg = await navigator.serviceWorker.register("/chat-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (pushEnabled && existing) {
        await request("", {
          action: "unsubscribe",
          endpoint: existing.endpoint,
        });
        await existing.unsubscribe();
        setPushEnabled(false);
        setNotice("Notifications are off on this device.");
        return;
      }
      if (Notification.permission !== "granted")
        throw new Error(
          "Notifications are off. You can allow them in your browser or phone settings.",
        );
      const bytes = Uint8Array.from(
        atob(inbox.pushKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      await request("", {
        action: "subscribe",
        subscription: subscription.toJSON(),
      });
      setPushEnabled(true);
      setNotice("Notifications are on for this device.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPushBusy(false);
    }
  }
  const visible = (inbox?.conversations ?? [])
    .filter(
      (c) =>
        (filter === "all" ||
          (filter === "private" ? !!c.member_id : !c.member_id)) &&
        (!search ||
          (c.member_id && !admin ? "Message Kelsey" : c.title)
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort(
      (a, b) =>
        Number(b.unread > 0) - Number(a.unread > 0) ||
        (b.last_id ?? 0) - (a.last_id ?? 0),
    );
  return (
    <main ref={pageRef} className={`chat-page ${selected ? "chat-selected" : ""}`}>
      <header className="chat-page-heading">
        <div>
          <span className="eyebrow">Stay connected</span>
          <h1>{admin ? "Communicate" : "Messaging"}</h1>
        </div>
        {admin ? (
          <Link href="/admin/communications">Email &amp; announcements →</Link>
        ) : null}
      </header>
      <details className="chat-notification-settings">
        <summary>
          Phone notifications {pushEnabled ? "· On this device" : ""}
        </summary>
        <p>
          Get an alert when a message arrives. Previews keep message text
          private. On iPhone, add this app to your Home Screen and open it there
          first.
        </p>
        <button type="button" onClick={togglePush} disabled={pushBusy}>
          {pushBusy
            ? "Updating…"
            : pushEnabled
              ? "Turn off on this device"
              : "Enable on this device"}
        </button>
      </details>
      {error ? (
        <p className="chat-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              void refreshInbox();
              if (selected)
                void loadRef
                  .current(selected)
                  .catch((e) => setError(e.message));
            }}
          >
            Retry
          </button>
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <div className="chat-workspace">
        <aside className="chat-sidebar" aria-label="Conversations">
          {!admin ? (
            <button className="chat-start" onClick={() => start()}>
              Message Kelsey <span>↗</span>
            </button>
          ) : null}
          <label className="chat-search">
            {admin ? "Find a member or conversation" : "Find a conversation"}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={admin ? "Search members…" : "Search…"}
            />
          </label>
          <div className="chat-filters" aria-label="Conversation type">
            {["all", "private", "groups"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "private" ? "Private" : "Groups"}
              </button>
            ))}
          </div>
          {admin && search.trim().length >= 2 ? (
            <div className="chat-people">
              {inbox?.people.map((p) => (
                <button key={p.id} onClick={() => start(p.id)}>
                  {p.full_name || "Member"} <span>Message →</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="chat-room-list">
            {visible.map((c) => (
              <button
                className={`chat-room ${selected === c.id ? "active" : ""}`}
                key={c.id}
                onClick={() => open(c.id)}
                aria-current={selected === c.id ? "page" : undefined}
              >
                <span className="chat-avatar">{c.member_id ? "K" : "#"}</span>
                <span className="chat-room-text">
                  <strong>
                    {c.member_id && !admin ? "Message Kelsey" : c.title}
                  </strong>
                  <small>
                    {c.member_id ? "Private conversation" : "Program group"}
                    {!c.can_write ? " · Read-only" : ""}
                    {c.muted ? " · Muted" : ""}
                  </small>
                  <span>{c.last_body || "Start the conversation"}</span>
                </span>
                {c.unread > 0 ? (
                  <b
                    className="chat-unread"
                    aria-label={`${c.unread} unread messages`}
                  >
                    {c.unread > 99 ? "99+" : c.unread}
                  </b>
                ) : null}
              </button>
            ))}
          </div>
          {!inbox ? (
            <p className="chat-empty">Loading your inbox…</p>
          ) : !visible.length ? (
            <p className="chat-empty">
              {search
                ? "No matching conversations."
                : admin
                  ? "No conversations yet. Search for a member to start one."
                  : "Your program groups appear here when you join. You can message Kelsey any time."}
            </p>
          ) : null}
        </aside>
        <section className="chat-thread" aria-label="Conversation">
          {selected ? (
            <>
              <header className="chat-thread-heading">
                <button
                  className="chat-back"
                  onClick={() => open("")}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div>
                  <h2>
                    {room
                      ? room.member_id && !admin
                        ? "Message Kelsey"
                        : room.title
                      : "Conversation"}
                  </h2>
                  <p>
                    {room?.member_id
                      ? "Private · You and the coaching team"
                      : "Group · Everyone in this program can read and reply"}
                  </p>
                </div>
              </header>
              {room ? (
                <div className="chat-thread-tools">
                  <button
                    onClick={() =>
                      mutate({ action: "mute", muted: !room.muted })
                    }
                  >
                    {room.muted ? "Unmute notifications" : "Mute notifications"}
                  </button>
                  {admin ? (
                    <button
                      onClick={() =>
                        mutate({ action: "close", closed: !room.closed })
                      }
                    >
                      {room.closed
                        ? "Reopen conversation"
                        : "Close conversation"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {pinned.length ? (
                <details className="chat-pinned">
                  <summary>
                    📌 {pinned.length} pinned{" "}
                    {pinned.length === 1 ? "message" : "messages"}
                  </summary>
                  {pinned.map((m) => (
                    <p key={m.id}>
                      <strong>{m.sender_name}</strong>
                      <br />
                      {m.body}
                    </p>
                  ))}
                </details>
              ) : null}
              <div
                className="chat-feed"
                ref={feed}
                aria-label="Messages"
                aria-busy={loading}
              >
                {hasMore ? (
                  <button
                    className="chat-older"
                    onClick={() =>
                      loadRef
                        .current(selected, messages[0]?.id)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Load earlier messages
                  </button>
                ) : null}
                {loading ? (
                  <p className="chat-empty">Loading messages…</p>
                ) : !messages.length ? (
                  <p className="chat-empty">
                    {room?.member_id
                      ? "Ask a question or check in with Kelsey."
                      : "Say hello to your program group."}
                  </p>
                ) : null}
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className={`chat-message ${m.sender_id === inbox?.user ? "own" : ""} ${m.removed ? "removed" : ""}`}
                  >
                    <strong>
                      {m.sender_id === inbox?.user ? "You" : m.sender_name}
                    </strong>
                    <p>{m.body}</p>
                    <footer>
                      <time dateTime={m.created_at}>{time(m.created_at)}</time>
                      {m.pinned ? <span> · Pinned</span> : null}
                    </footer>
                    {admin && !m.removed ? (
                      <div className="chat-moderation">
                        <button
                          onClick={() =>
                            mutate({
                              action: "pin",
                              message: m.id,
                              pinned: !m.pinned,
                            })
                          }
                        >
                          {m.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Remove this message for everyone?",
                              )
                            )
                              void mutate({ action: "remove", message: m.id });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              {room?.can_write ? (
                <form className="chat-composer" onSubmit={send}>
                  <label htmlFor="chat-message">
                    {room.member_id
                      ? "Private message"
                      : "Message to everyone in this program"}
                  </label>
                  <div>
                    <textarea
                      id="chat-message"
                      value={drafts[selected] || ""}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [selected]: e.target.value })
                      }
                      maxLength={4000}
                      rows={2}
                      placeholder="Write a message…"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !(drafts[selected] || "").trim()}
                    >
                      {sending ? "Sending…" : "Send ↑"}
                    </button>
                  </div>
                  <small>
                    Messages are saved to your Holden Health account.
                  </small>
                </form>
              ) : (
                <p className="chat-read-only">
                  {room
                    ? "This conversation is read-only. You can still revisit the messages."
                    : "Select an available conversation from your inbox."}
                </p>
              )}
            </>
          ) : (
            <div className="chat-welcome">
              <span className="chat-welcome-icon">↗</span>
              <h2>
                {admin
                  ? "Your conversations, together."
                  : "A little support goes a long way."}
              </h2>
              <p>
                {admin
                  ? "Open a program chat or find a member to send a private message."
                  : "Choose your program group or send Kelsey a private message."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
