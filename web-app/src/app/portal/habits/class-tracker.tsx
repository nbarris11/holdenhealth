"use client";

import { useState, useTransition } from "react";
import { addDays, dateLabel } from "@/lib/challenge";
import { habitCounts, weekDates, type HabitMark, type HabitWeek } from "@/lib/class-habits";
import { saveHabitWeek, setHabitMark } from "./actions";
import { SIX_WEEK_CHECK_IN_URL } from "@/lib/check-in";

export default function ClassTracker({ enrollmentId, sessionName, startsOn, endsOn, today, weekNumber, weeks, marks, readOnly = false, relationshipId, revisions = [] }: {
  enrollmentId: string; sessionName: string; startsOn: string; endsOn: string; today: string;
  relationshipId?: string; revisions?: {id: string; week_id: string; habits: string[]; marks: {day: string; habit_index: number}[]; version: number; created_at: string}[];
  weekNumber: number; weeks: HabitWeek[]; marks: HabitMark[]; readOnly?: boolean;
}) {
  const current = weeks.find(week => week.week_number === weekNumber);
  const previous = weeks.find(week => week.week_number === weekNumber - 1);
  const { start, end } = weekDates(startsOn, endsOn, weekNumber)!;
  const previousDates = weekNumber > 1 ? weekDates(startsOn, endsOn, weekNumber - 1) : null;
  const previousCounts = previous && previousDates ? habitCounts(previous, marks, previousDates.start, previousDates.end) : null;
  const [selectedDay, setSelectedDay] = useState(today < start ? start : today > end ? end : today);
  const [localMarks, setLocalMarks] = useState(marks);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const editable = !readOnly && today >= start && today <= endsOn;
  const days = Array.from({ length: Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 }, (_, index) => addDays(start, index));
  const counts = current ? habitCounts(current, localMarks, start, today < end ? today : end) : null;
  return <>
    <section className="member-card class-habit-card">
      <span className="member-kicker">{sessionName} · Week {weekNumber}{!relationshipId && " of 6"}</span>
      <h2>Your weekly habits</h2>
      <p className="member-muted">{dateLabel(start)}–{dateLabel(end)}. {relationshipId ? "Choose three habits for each week. Keep them or choose new ones next week." : "Pick three habits to begin. Each new week, you can keep them or add up to three more."}</p>
      {today < startsOn && <p>Choose your habits now. Daily checkboxes open when your program begins on {dateLabel(startsOn)}.</p>}
      {previous && <div className="class-habit-review">
        <h3>Last week’s check-in</h3>
        <p>{previousCounts?.fullDays ?? 0} days with every habit checked.</p>
        <ul>{previous.habits.map((habit, index) => <li key={`${habit}-${index}`}>{habit}: {previousCounts?.perHabit[index] ?? 0} of {previousCounts?.days ?? 0} days</li>)}</ul>
        <p className="member-muted">Use this as a starting point for this week. Progress counts even when the week wasn’t perfect.</p>
      </div>}
      {current && !editing ? <>
        <p><strong>{counts?.fullDays ?? 0} of {counts?.days ?? 0} days</strong> with every habit checked so far this week.</p>
        <div className="class-habit-days" aria-label="Choose a day to track">
          {days.map(day => <button key={day} type="button" className={selectedDay === day ? "selected" : ""} aria-pressed={selectedDay === day} onClick={() => { setSelectedDay(day); setMessage(""); }}>
            <span>{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span><strong>{Number(day.slice(-2))}</strong>
          </button>)}
        </div>
        <h3>{dateLabel(selectedDay)}</h3>
        <div className="class-habit-list">{current.habits.map((habit, index) => {
          const checked = localMarks.some(mark => mark.week_id === current.id && mark.day === selectedDay && mark.habit_index === index);
          return <label key={`${index}-${habit}`} className="class-habit-row"><input type="checkbox" checked={checked} disabled={pending || !editable || selectedDay > today} onChange={event => {
            const next = event.target.checked, day = selectedDay;
            const prior = localMarks;
            setLocalMarks(next ? [...prior, { week_id: current.id, day, habit_index: index }] : prior.filter(mark => !(mark.week_id === current.id && mark.day === day && mark.habit_index === index)));
            setMessage("");
            startTransition(async () => {
              try {
                const result = await setHabitMark({ weekId: current.id, day, habitIndex: index, checked: next, version: current.version ?? 1 });
                if (result.error) { setLocalMarks(prior); setMessage(result.error); }
                else setMessage("Saved.");
              } catch { setLocalMarks(prior); setMessage("Connection interrupted. Reload to check your progress, then try again."); }
            });
          }} /><span>{habit}</span><small>{counts?.perHabit[index] ?? 0}/{counts?.days ?? 0} days</small></label>;
        })}</div>
        <p className="member-muted">{today < start ? `Tracking opens ${dateLabel(start)}.` : today > endsOn ? "This session has finished. Your progress is saved." : selectedDay > today ? "That day has not started yet." : "You can update today or an earlier day in this week."}</p>
        {!readOnly && today <= end && <button type="button" className="member-button secondary" onClick={() => setEditing(true)}>Edit this week’s habits</button>}
      </> : <form action={form => { if (readOnly) return; setMessage(""); startTransition(async () => {
        try { const result = await saveHabitWeek(form); setMessage(result.error || result.success || ""); if (result.success) window.location.reload(); }
        catch { setMessage("Connection interrupted. Please try again."); }
      }); }} className="class-habit-form">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        {relationshipId && <input type="hidden" name="relationshipId" value={relationshipId} />}
        {editing && current && <><input type="hidden" name="weekId" value={current.id} /><input type="hidden" name="version" value={current.version ?? 1} /><p>Changing a habit resets that habit’s checkmarks for this week. Unchanged habits keep their checkmarks. The previous version stays in saved history below.</p></>}
        <input type="hidden" name="weekNumber" value={weekNumber} />
        {readOnly && <p>This member has not chosen this week’s habits yet. They will see these fields when they open their tracker.</p>}
        {((editing ? current?.habits : previous?.habits) ?? ["", "", ""]).map((habit, index) => <label key={index}>Habit {index + 1}<input disabled={readOnly} name="habit" defaultValue={habit} minLength={3} maxLength={100} required={index < 3} placeholder="A small action I can repeat" /></label>)}
        {Array.from({ length: relationshipId ? 0 : 6 - ((editing ? current?.habits : previous?.habits)?.length ?? 3) }, (_, index) => <label key={`extra-${index}`}>Optional habit {index + 1}<input disabled={readOnly} name="habit" minLength={3} maxLength={100} placeholder="Leave blank for now" /></label>)}
        <button className="member-button" disabled={pending || readOnly}>{pending ? "Saving…" : editing ? "Save habit changes" : `Save week ${weekNumber} habits`}</button>
        {editing && <button type="button" className="member-button secondary" onClick={() => setEditing(false)}>Cancel</button>}
      </form>}
      <p role="status" aria-live="polite">{message}</p>
      {editable && !relationshipId && <p><a className="member-button secondary" href={SIX_WEEK_CHECK_IN_URL} target="_blank" rel="noreferrer">Complete Kelsey’s weekly check-in ↗</a></p>}
    </section>
    {revisions.length > 0 && <section className="member-card"><h2>Previous habit versions</h2><p>These saved records show your habits and checkmarks before an edit.</p>{revisions.map(revision => <details key={revision.id}><summary>Week {weeks.find(w => w.id === revision.week_id)?.week_number} · version {revision.version}</summary><ul>{revision.habits.map((habit, index) => <li key={index}>{habit}: {revision.marks.filter(m => m.habit_index === index).length} checkmarks</li>)}</ul></details>)}</section>}
    {weeks.length > 1 && <section className="member-card class-habit-history"><h2>Earlier weeks</h2>{weeks.filter(week => week.week_number < weekNumber - 1).reverse().map(week => {
      const dates = weekDates(startsOn, endsOn, week.week_number)!;
      const result = habitCounts(week, localMarks, dates.start, dates.end);
      return <details key={week.id}><summary>Week {week.week_number} · {result.fullDays} full days</summary><ul>{week.habits.map((habit, index) => <li key={index}>{habit}: {result.perHabit[index]} of {result.days} days</li>)}</ul></details>;
    })}</section>}
  </>;
}
