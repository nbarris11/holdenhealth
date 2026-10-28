import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadPeopleData } from '@/lib/people-data';
import { buildPeople, challengeProgress } from '@/lib/people';
import { detroitToday, isUuid } from '@/lib/challenge';
import AdminClassTimes from '@/components/admin-class-times';
import { habitCounts, weekDates, type HabitWeek, type HabitMark } from '@/lib/class-habits';

type Mark = { participant_id: string; day: string; goal_index: number; completed: boolean };
type Log = { id: string; participant_id: string; status: string };

export default async function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  await verifyAdmin();
  const { personId } = await params;
  if (!isUuid(personId)) notFound();
  const data = await loadPeopleData();
  const person = buildPeople(data).find(row => row.id === personId);
  if (!person) notFound();
  const db = await createClient();
  const progress = await Promise.all(person.participants.map(async participant => {
    const marks: Mark[] = [];
    const logs: Log[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error } = await db.from('challenge_checkmarks').select('participant_id,day,goal_index,completed').eq('participant_id', participant.id).eq('completed', true).order('day').order('goal_index').range(offset, offset + 499);
      if (error) throw new Error('Habit progress could not be loaded.');
      marks.push(...(rows ?? []));
      if (!rows || rows.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error } = await db.from('challenge_workout_logs').select('id,participant_id,status').eq('participant_id', participant.id).order('id').range(offset, offset + 499);
      if (error) throw new Error('Workout progress could not be loaded.');
      logs.push(...(rows ?? []));
      if (!rows || rows.length < 500) break;
    }
    return { participant, marks, logs };
  }));
  const enrollmentIds = person.enrollments.map(enrollment => enrollment.id);
  const [{ data: classWeeks, error: classWeekError }, { data: classSessions, error: classSessionError }] = await Promise.all([
    enrollmentIds.length ? db.from('class_habit_weeks').select('id,enrollment_id,week_number,habits').in('enrollment_id', enrollmentIds).order('week_number') : Promise.resolve({ data: [], error: null }),
    person.enrollments.length ? db.from('sessions').select('id,starts_on,ends_on').in('id', person.enrollments.map(enrollment => enrollment.session_id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (classWeekError || classSessionError) throw new Error('Class habit plans could not be loaded.');
  const typedClassWeeks = (classWeeks ?? []) as HabitWeek[];
  const { data: classMarks, error: classMarkError } = typedClassWeeks.length
    ? await db.from('class_habit_marks').select('week_id,day,habit_index').in('week_id', typedClassWeeks.map(week => week.id))
    : { data: [], error: null };
  if (classMarkError) throw new Error('Class habit progress could not be loaded.');
  const typedClassMarks = (classMarks ?? []) as HabitMark[];
  return <main className="app-shell admin-shell workspace-page">
    <Link className="text-link" href="/admin/people">← People</Link>
    <header className="workspace-page-header"><div><span className="eyebrow">Person record</span><h1 style={{ overflowWrap: 'anywhere' }}>{person.name}</h1><p>Contact details, challenge progress, and program history.</p></div>{person.isTest ? <span className="status-pill warning">Test</span> : null}</header>
    <section className="panel"><h2>Contact</h2><p style={{ overflowWrap: 'anywhere' }}>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : 'No email saved'}</p>{person.phone ? <p><a href={`tel:${person.phone}`}>{person.phone}</a></p> : null}</section>
    <AdminClassTimes memberId={person.id} />
    <section className="workspace-section"><div className="section-heading"><h2>Challenges</h2><p>Completed days require all three habits. Partial workouts are shown separately.</p></div>
      {progress.length ? progress.map(({ participant, marks, logs }) => {
        const challenge = data.challenges.find(row => row.id === participant.challenge_id);
        const totals = challenge ? challengeProgress(participant, challenge, marks, detroitToday()) : null;
        return <article className="panel" key={participant.id}>
          <span className="status-pill neutral">Free Challenge</span><h3>{challenge?.title || 'Challenge'}</h3>
          <p>Joined {participant.joined_on}{challenge ? ` · ${challenge.starts_on} – ${challenge.ends_on}` : ''}</p>
          <h4>Daily habits</h4><ul>{participant.goals.map((goal, index) => <li key={index}>{goal}</li>)}</ul>
          <dl className="answer-grid"><div><dt>Weekly workout goal</dt><dd>{participant.weekly_workouts}</dd></div><div><dt>Completed habit days</dt><dd>{totals ? `${totals.completed} / ${totals.eligible}` : 'Unavailable'}</dd></div><div><dt>Workouts</dt><dd>{logs.filter(row => row.status === 'completed').length} complete · {logs.filter(row => row.status === 'partial').length} partial</dd></div></dl>
          <Link className="text-link" href={`/admin/challenges?id=${participant.challenge_id}`}>Open challenge →</Link>
        </article>;
      }) : <div className="panel"><p>No challenges joined yet.</p></div>}
    </section>
    <section className="workspace-section"><h2>Classes</h2><div className="panel member-list">{person.enrollments.length ? person.enrollments.map(enrollment => <Link className="member-list-row" key={enrollment.id} href={`/admin/members/${enrollment.id}`}><div className="member-list-person"><strong>{data.sessions.find(row => row.id === enrollment.session_id)?.name || 'Class program'}</strong><span>{enrollment.status}</span></div><span>Open record →</span></Link>) : <div className="compact-empty"><p>No class enrollment.</p></div>}</div>
      {person.enrollments.map(enrollment => {
        const session = (classSessions ?? []).find(row => row.id === enrollment.session_id);
        const plans = typedClassWeeks.filter(week => week.enrollment_id === enrollment.id);
        return plans.length && session ? <div className="panel" key={enrollment.id}><h3>{data.sessions.find(row => row.id === enrollment.session_id)?.name || 'Class program'} · weekly habits</h3>
          {plans.map(week => {
            const { start, end } = weekDates(session.starts_on, session.ends_on, week.week_number)!;
            const through = detroitToday() < end ? detroitToday() : end;
            const counts = habitCounts(week, typedClassMarks, start, through);
            return <div key={week.id}><h4>Week {week.week_number}: {counts.fullDays} of {counts.days} days with every habit</h4><ul>{week.habits.map((habit, index) => <li key={index}>{habit}: {counts.perHabit[index]} of {counts.days} days</li>)}</ul></div>;
          })}
        </div> : null;
      })}
    </section>
    <section className="panel"><h2>Personal training</h2>{person.coaching.length ? <><p>{person.coaching.map(row => row.status).join(' · ')}</p><Link className="button secondary" href={`/admin/training/${person.id}`}>Open coaching record</Link></> : <p>No personal-training program.</p>}</section>
  </main>;
}
