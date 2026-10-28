import Link from 'next/link';
import { loadPeopleData } from '@/lib/people-data';
import { buildPeople, filterPeople, PERSONAL_TRAINING_PROGRAM } from '@/lib/people';

export default async function PeopleDirectory({ query = '', program = '', showEveryone = false }: { query?: string; program?: string; showEveryone?: boolean }) {
  const data = await loadPeopleData();
  const people = buildPeople(data);
  const search = query.trim().toLowerCase();
  const filteredProgram = showEveryone ? '' : program;
  const personalTraining = filteredProgram === PERSONAL_TRAINING_PROGRAM;
  const shown = filterPeople(people, filteredProgram, query);
  const programName = personalTraining ? 'Personal training' : data.sessions.find(session => session.id === program)?.name || 'Selected program';
  const viewParams = new URLSearchParams();
  if (program) viewParams.set('program', program);
  if (showEveryone) viewParams.set('people', 'all');
  const clearHref = `/admin/people?${viewParams}`;
  if (query) viewParams.set('q', query);
  if (showEveryone) viewParams.delete('people');
  else viewParams.set('people', 'all');
  const toggleHref = `/admin/people?${viewParams}#all-people`;
  return <section id="all-people" className="workspace-section">
    <div className="section-heading"><div><span className="eyebrow">{filteredProgram ? programName : "All programs"}</span><h2>{personalTraining ? "Personal-training clients" : filteredProgram ? "Program people" : "Everyone"} · {shown.length}</h2></div><div><p>{personalTraining ? "Current personal-training clients. Withdrawn and completed clients remain under Show everyone." : filteredProgram ? "Withdrawn members are excluded from this list and count. Find their records under Show everyone or Past members." : "Challenge participants and members across all programs."}</p>{program ? <Link className="text-link inline-link" href={toggleHref}>{showEveryone ? "Show selected program" : "Show everyone"}</Link> : null}</div></div>
    <form className="stack-form panel" action="/admin/people" method="get">
      {program ? <input type="hidden" name="program" value={program} /> : null}
      {showEveryone ? <input type="hidden" name="people" value="all" /> : null}
      <label>Find someone<input type="search" name="q" defaultValue={query} placeholder="Name, email, or phone" /></label>
      <div className="button-row"><button className="button primary" type="submit">Search</button>{query ? <Link className="button secondary" href={clearHref}>Clear</Link> : null}</div>
    </form>
    <div className="panel member-list redesigned-member-list">{shown.map(person => <Link className="member-list-row" href={`/admin/people/${person.id}`} key={person.id}>
      <div className="member-list-person" style={{ display: 'grid', gap: '0.25rem', minWidth: 0, overflowWrap: 'anywhere' }}><strong>{person.name}</strong><span>{person.email || person.phone || 'No contact saved'}</span>{person.participants.map(participant => <span key={participant.id}>{data.challenges.find(row => row.id === participant.challenge_id)?.title || 'Challenge'} · Joined {participant.joined_on}</span>)}</div>
      <div className="member-list-meta">{person.participants.length ? <span className="status-pill neutral">Free Challenge</span> : null}{person.enrollments.length ? <span className="status-pill neutral">Classes</span> : null}{person.coaching.length ? <span className="status-pill neutral">Personal training</span> : null}{!person.participants.length && !person.enrollments.length && !person.coaching.length ? <span className="status-pill neutral">Account only</span> : null}{person.isTest ? <span className="status-pill warning">Test</span> : null}<b aria-hidden="true">›</b></div>
    </Link>)}{!shown.length ? <div className="compact-empty"><p>{search ? 'No people match your search in this view.' : personalTraining ? 'No personal-training clients yet.' : filteredProgram ? 'No people are enrolled in this program yet.' : 'No people yet.'}</p></div> : null}</div>
  </section>;
}
