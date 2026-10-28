"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLabel } from "@/lib/challenge";
import { threadKey, type HabitComment } from "@/lib/habit-comments";
import { addHabitComment, markHabitCommentsRead } from "./comment-actions";
import "./habit-comments.css";

export default function HabitComments({ weekId, ownerId, day, today, habits, comments, commenter }: {
  weekId: string; ownerId: string; day: string; today: string; habits: string[];
  comments: HabitComment[]; commenter: "member" | "coach";
}) {
  const router = useRouter();
  const [composing, setComposing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const dayComments = comments.filter(c => c.week_id === weekId && c.day === day);
  const unread = commenter === "member" && dayComments.some(c => c.author_id !== ownerId && !c.member_read_at);

  useEffect(() => {
    if (!unread) return;
    void markHabitCommentsRead(weekId).then(() => router.refresh());
  }, [unread, weekId, router]);

  const author = (c: HabitComment) => c.author_id === ownerId ? (commenter === "member" ? "You" : "Member") : (commenter === "coach" ? "You" : "Kelsey");
  const indexes = habits.map((_, index) => index).filter(index =>
    dayComments.some(c => c.habit_index === index) || (commenter === "coach" && day <= today));
  if (!indexes.length) return null;

  const submit = (form: FormData) => {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await addHabitComment(form);
        setMessage(result.error || "");
        if (result.success) { setComposing(null); router.refresh(); }
      } catch { setMessage("Connection interrupted. Please try again."); }
    });
  };

  return <section className="habit-comments" aria-label={`Comments for ${dateLabel(day)}`}>
    <h3>{commenter === "coach" ? `Comments · ${dateLabel(day)}` : `Notes from Kelsey · ${dateLabel(day)}`}</h3>
    {indexes.map(index => {
      const thread = dayComments.filter(c => threadKey(c) === threadKey({ week_id: weekId, day, habit_index: index }));
      const open = thread.length > 0 || composing === index;
      return <article key={index} className="habit-comment-thread">
        <strong className="habit-comment-habit">{thread[0]?.habit_text ?? habits[index]}</strong>
        {thread.map(c => <p key={c.id} className={c.author_id === ownerId ? "habit-comment mine-member" : "habit-comment from-coach"}>
          <span>{author(c)}</span>{c.body}
        </p>)}
        {open ? <form className="habit-comment-form" action={submit}>
          <input type="hidden" name="weekId" value={weekId} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="habitIndex" value={index} />
          <label>
            <span className="sr-only">{thread.length ? "Reply" : "Comment"} on {habits[index]}</span>
            <textarea name="body" rows={2} maxLength={1000} required placeholder={thread.length ? "Write a reply" : "Leave a comment on this habit"} />
          </label>
          <button className="member-button secondary" disabled={pending}>{pending ? "Sending…" : thread.length ? "Reply" : "Comment"}</button>
        </form> : <button type="button" className="habit-comment-start" onClick={() => setComposing(index)}>Comment on this habit</button>}
      </article>;
    })}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
