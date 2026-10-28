"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLabel } from "@/lib/challenge";
import { otherThreads, type HabitComment } from "@/lib/habit-comments";
import { addHabitComment, markHabitCommentsRead } from "./comment-actions";
import "./habit-comments.css";

type Viewer = "member" | "coach";

// Marks the member's unread notes as read once they are on screen, then refreshes the Habits badge.
function useMarkRead(comments: HabitComment[], ownerId: string, viewer: Viewer) {
  const router = useRouter();
  const unreadWeeks = viewer === "member" ? [...new Set(comments.filter(c => c.author_id !== ownerId && !c.member_read_at).map(c => c.week_id))].join(",") : "";
  useEffect(() => {
    if (!unreadWeeks) return;
    void Promise.all(unreadWeeks.split(",").map(weekId => markHabitCommentsRead(weekId))).then(() => router.refresh());
  }, [unreadWeeks, router]);
}

function Thread({ weekId, day, habitIndex, habitText, title, thread, ownerId, viewer, allowStart = false }: {
  weekId: string; day: string; habitIndex: number; habitText: string; title: string; thread: HabitComment[];
  ownerId: string; viewer: Viewer; allowStart?: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const author = (c: HabitComment) => c.author_id === ownerId ? (viewer === "member" ? "You" : "Member") : (viewer === "coach" ? "You" : "Kelsey");
  const submit = (form: FormData) => {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await addHabitComment(form);
        setMessage(result.error || "");
        if (result.success) { setComposing(false); router.refresh(); }
      } catch { setMessage("Connection interrupted. Please try again."); }
    });
  };
  if (!thread.length && !allowStart) return null;
  return <article className="habit-comment-thread">
    <strong className="habit-comment-habit">{title}</strong>
    {thread.map(c => <p key={c.id} className={c.author_id === ownerId ? "habit-comment mine-member" : "habit-comment from-coach"}>
      <span>{author(c)}</span>{c.body}
    </p>)}
    {thread.length || composing ? <form className="habit-comment-form" action={submit}>
      <input type="hidden" name="weekId" value={weekId} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="habitIndex" value={habitIndex} />
      <input type="hidden" name="habitText" value={habitText} />
      <label>
        <span className="sr-only">{thread.length ? "Reply" : "Comment"} on {title}</span>
        <textarea name="body" rows={2} maxLength={1000} required placeholder={thread.length ? "Write a reply" : "Leave a comment on this habit"} />
      </label>
      <button className="member-button secondary" disabled={pending}>{pending ? "Sending…" : thread.length ? "Reply" : "Comment"}</button>
    </form> : <button type="button" className="habit-comment-start" onClick={() => setComposing(true)}>Comment on this habit</button>}
    <p role="status" aria-live="polite">{message}</p>
  </article>;
}

// One day of the visible week: threads on that day's current habits, plus "Comment" for the coach.
export default function HabitComments({ weekId, ownerId, day, today, habits, comments, commenter }: {
  weekId: string; ownerId: string; day: string; today: string; habits: string[];
  comments: HabitComment[]; commenter: Viewer;
}) {
  const dayComments = comments.filter(c => c.week_id === weekId && c.day === day);
  useMarkRead(dayComments, ownerId, commenter);
  const threads = habits.map((habit, index) => ({ habit, index, thread: dayComments.filter(c => c.habit_index === index && c.habit_text === habit) }))
    .filter(({ thread }) => thread.length || (commenter === "coach" && day <= today));
  if (!threads.length) return null;
  return <section className="habit-comments" aria-label={`Comments for ${dateLabel(day)}`}>
    <h3>{commenter === "coach" ? `Comments · ${dateLabel(day)}` : `Notes from Kelsey · ${dateLabel(day)}`}</h3>
    {threads.map(({ habit, index, thread }) => <Thread key={`${index}-${habit}`} weekId={weekId} day={day} habitIndex={index} habitText={habit} title={habit} thread={thread} ownerId={ownerId} viewer={commenter} allowStart={commenter === "coach"} />)}
  </section>;
}

// Notes the day view can't show (earlier weeks, edited or removed habits), newest first, still open for replies.
export function EarlierHabitComments({ comments, current, ownerId, commenter, heading }: {
  comments: HabitComment[]; current?: { id: string; habits: string[] }; ownerId: string; commenter: Viewer; heading?: string;
}) {
  const threads = otherThreads(comments, current);
  useMarkRead(threads.flat(), ownerId, commenter);
  if (!threads.length) return null;
  return <section className="member-card habit-comments" aria-label="Earlier notes">
    <h2>{heading ?? (commenter === "coach" ? "Earlier comments" : "Earlier notes from Kelsey")}</h2>
    {threads.map(thread => <Thread key={thread[0].id} weekId={thread[0].week_id} day={thread[0].day} habitIndex={thread[0].habit_index} habitText={thread[0].habit_text}
      title={`${thread[0].habit_text} · ${dateLabel(thread[0].day)}`} thread={thread} ownerId={ownerId} viewer={commenter} />)}
  </section>;
}
