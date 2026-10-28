export type PersonProfile = { id: string; full_name: string; phone: string | null };
export type PersonContact = { user_id: string; email: string; is_test: boolean };
export type PersonChallenge = { id: string; user_id: string; challenge_id: string; display_name: string; joined_on: string; goals: string[]; weekly_workouts: number };
export type PersonEnrollment = { id: string; member_id: string; session_id: string; status: string };
export type PersonCoaching = { id: string; member_id: string; status: string };
export const PERSONAL_TRAINING_PROGRAM = 'personal-training';
export type PeopleData = {
  profiles: PersonProfile[]; contacts: PersonContact[]; participants: PersonChallenge[];
  enrollments: PersonEnrollment[]; coaching: PersonCoaching[];
  challenges: { id: string; title: string; starts_on: string; ends_on: string }[];
  sessions: { id: string; name: string }[];
};
export function buildPeople(data: PeopleData) {
  return data.profiles.map(profile => {
    const contact = data.contacts.find(row => row.user_id === profile.id);
    const participants = data.participants.filter(row => row.user_id === profile.id).sort((a, b) => b.joined_on.localeCompare(a.joined_on));
    const enrollments = data.enrollments.filter(row => row.member_id === profile.id);
    const coaching = data.coaching.filter(row => row.member_id === profile.id);
    return { ...profile, name: profile.full_name.trim() || participants[0]?.display_name || contact?.email || 'Name not provided', email: contact?.email ?? '', isTest: contact?.is_test ?? false, participants, enrollments, coaching };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
export function challengeProgress(participant: PersonChallenge, challenge: { starts_on: string; ends_on: string }, marks: { participant_id: string; day: string; goal_index: number; completed: boolean }[], today: string) {
  const first = [participant.joined_on, challenge.starts_on].sort().at(-1)!;
  const last = [today, challenge.ends_on].sort()[0];
  const days = new Map<string, Set<number>>();
  for (const mark of marks) {
    if (mark.participant_id !== participant.id || !mark.completed || mark.day < first || mark.day > last || mark.goal_index < 0 || mark.goal_index > 2) continue;
    const goals = days.get(mark.day) ?? new Set<number>();
    goals.add(mark.goal_index); days.set(mark.day, goals);
  }
  return { completed: [...days.values()].filter(goals => goals.size === 3).length, eligible: Math.max(0, Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1) };
}

export function filterPeople(people: ReturnType<typeof buildPeople>, program = '', query = '') {
  const search = query.trim().toLowerCase();
  return people.filter(person =>
    (!program || (program === PERSONAL_TRAINING_PROGRAM
      ? person.coaching.some(row => row.status !== 'withdrawn' && row.status !== 'completed')
      : person.enrollments.some(enrollment => enrollment.session_id === program && enrollment.status !== 'withdrawn'))) &&
    `${person.name} ${person.email} ${person.phone ?? ''}`.toLowerCase().includes(search)
  );
}
