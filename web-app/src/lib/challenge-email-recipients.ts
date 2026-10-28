import type { SupabaseClient } from '@supabase/supabase-js';

type Participant = { user_id: string; display_name: string | null };
type Contact = { user_id: string; email: string; email_opt_in: boolean; is_test: boolean; unsubscribe_token: string };
type Profile = { id: string; full_name: string | null };

export function buildChallengeRecipients(participants: Participant[], contacts: Contact[], profiles: Profile[]) {
  const names = new Map<string, string>();
  for (const participant of participants) {
    if (!names.has(participant.user_id) || !names.get(participant.user_id)) {
      names.set(participant.user_id, participant.display_name?.trim() || '');
    }
  }
  const profileNames = new Map(profiles.map(profile => [profile.id, profile.full_name?.trim()]));
  const seen = new Set<string>();
  return contacts.flatMap(contact => {
    const email = contact.email.trim().toLowerCase();
    if (!names.has(contact.user_id) || !contact.email_opt_in || contact.is_test || !email || seen.has(email)) return [];
    seen.add(email);
    const name = profileNames.get(contact.user_id) || names.get(contact.user_id) || 'there';
    return [{ memberId: contact.user_id, subscriberId: null, email, unsubscribeToken: contact.unsubscribe_token, firstName: name.split(/\s+/)[0], name }];
  });
}

// Call only after verifyAdmin, with the authenticated server client (RLS retained).
export async function loadChallengeRecipients(db: SupabaseClient) {
  async function rows<T>(table: string, columns: string, order: string): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select(columns).order(order).range(offset, offset + 499);
      if (error) throw new Error('Challenge recipients could not be loaded. Please try again.');
      result.push(...(data ?? []) as unknown as T[]);
      if (!data || data.length < 500) return result;
    }
  }
  const [participants, contacts, profiles] = await Promise.all([
    rows<Participant>('challenge_participants', 'user_id,display_name', 'id'),
    rows<Contact>('member_contacts', 'user_id,email,email_opt_in,is_test,unsubscribe_token', 'user_id'),
    rows<Profile>('profiles', 'id,full_name', 'id'),
  ]);
  return buildChallengeRecipients(participants, contacts, profiles);
}
