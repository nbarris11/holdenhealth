import 'server-only';
import { verifyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { PeopleData } from './people';

// Fetch every page so older people and memberships are not silently omitted.
export async function loadPeopleData(): Promise<PeopleData> {
  await verifyAdmin();
  const db = await createClient();
  async function rows(table: string, columns: string, order = 'id') {
    const result = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select(columns).order(order).range(offset, offset + 499);
      if (error) throw new Error('People records could not be loaded. Please try again.');
      result.push(...(data ?? []));
      if (!data || data.length < 500) return result;
    }
  }
  const [profiles, contacts, participants, enrollments, coaching, challenges, sessions] = await Promise.all([
    rows('profiles', 'id,full_name,phone'),
    rows('member_contacts', 'user_id,email,is_test', 'user_id'),
    rows('challenge_participants', 'id,user_id,challenge_id,display_name,joined_on,goals,weekly_workouts'),
    rows('enrollments', 'id,member_id,session_id,status'),
    rows('coaching_relationships', 'id,member_id,status'),
    rows('habit_challenges', 'id,title,starts_on,ends_on'),
    rows('sessions', 'id,name'),
  ]);
  return { profiles, contacts, participants, enrollments, coaching, challenges, sessions } as unknown as PeopleData;
}
