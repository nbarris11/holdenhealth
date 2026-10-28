import Link from 'next/link';
import { verifyAdmin } from '@/lib/auth';
import { loadAdminClassTimes } from '@/lib/admin-class-times';
import { classConfirmationLine } from '@/lib/private-class-times';

export default async function AdminClassTimes({ memberId, enrollmentId }: { memberId: string; enrollmentId?: string }) {
  await verifyAdmin();
  let programs: Awaited<ReturnType<typeof loadAdminClassTimes>>;
  try {
    programs = await loadAdminClassTimes(memberId, enrollmentId);
  } catch {
    return <section className="panel"><h2>Class times</h2><p role="status">Class times could not be loaded. Refresh to try again.</p></section>;
  }
  if (!programs.length) return null;
  return <section className="workspace-section" aria-label="Class times">
    <div className="section-heading"><div><span className="eyebrow">Schedule preferences</span><h2>Class times</h2></div><p>All times are Eastern.</p></div>
    {programs.map(program => <article className="panel" key={program.id}>
      <h3>{program.name}</h3>
      <h4>Times requested at signup</h4>
      {program.preferences.length ? <>
        {program.preferences.map(preference => <p key={preference.label}><strong>{preference.label}:</strong> {preference.times.length ? preference.times.join(' · ') : 'No times saved with this signup.'}</p>)}
        <p className="fine-print">These are the times they said could work when they registered.</p>
      </> : <p>No signup preferences saved.</p>}
      <details><summary>Calendar selections · {program.meetings.length} upcoming</summary>
      {program.meetings.length ? <>
        <ul>{program.meetings.slice(0, 3).map(meeting => <li key={meeting.id}>{classConfirmationLine(meeting)}</li>)}</ul>
        {program.meetings.length > 3 ? <details><summary>Show {program.meetings.length - 3} more selected classes</summary><ul>{program.meetings.slice(3).map(meeting => <li key={meeting.id}>{classConfirmationLine(meeting)}</li>)}</ul></details> : null}
      </> : <p>No dates selected in the calendar. Signup preferences are saved separately above; an empty calendar does not mean they are not coming.</p>}
      </details>
      <Link className="text-link" href={`/admin/classes?program=${program.sessionId}`}>Open program schedule →</Link>
    </article>)}
  </section>;
}
