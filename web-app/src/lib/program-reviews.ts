import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChallengeRecipients } from "./challenge-email-recipients";

export const GOOGLE_REVIEW_URL = "https://share.google/EOKYvkNJMEZN22Cta";
export const REVIEW_SUBJECT = "Thanks for being part of the program!";
export const REVIEW_BODY = "Thank you for spending these past few weeks with me! I’ve loved having you be part of Holden Health.\n\nIf you have a minute, would you share your experience on Google? Your honest feedback helps me improve and helps other people decide whether Holden Health is right for them.\n\nOpen our Google profile below and choose Write a review. Thank you for your support!";
export type ReviewProgram = { key: string; name: string; ends_on: string; status: string };
export type ReviewRecord = { id: string; member_id: string; email: string; status: string; sent_at: string | null };
export type ReviewRecipient = ReturnType<typeof buildChallengeRecipients>[number];
export function detroitDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function canRequestReviews(program: ReviewProgram, today = detroitDate()) {
  return program.ends_on < today && !["draft", "cancelled"].includes(program.status);
}
export function recipientFingerprint(recipients: ReviewRecipient[]) {
  return createHash("sha256").update(JSON.stringify(recipients.map(p => [p.memberId, p.email]).sort())).digest("hex");
}
export function pendingReviewRecipients(recipients: ReviewRecipient[], records: ReviewRecord[]) {
  return recipients.filter(person => !records.some(record => (record.member_id === person.memberId || record.email === person.email) && record.status !== "failed"));
}

// Authenticated admin or authorized cron service client only. All reads fail closed and paginate.
async function rows<T>(query: { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }> }): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error("Review requests could not be loaded. Please refresh and try again.");
    const page = (data ?? []) as T[];
    result.push(...page);
    if (page.length < 500) return result;
  }
}
export async function loadReviewPrograms(db: SupabaseClient): Promise<ReviewProgram[]> {
  const [classes, challenges] = await Promise.all([
    rows<{id: string; name: string; ends_on: string; status: string}>(db.from("sessions").select("id,name,ends_on,status").order("id")),
    rows<{id: string; title: string; ends_on: string; published: boolean}>(db.from("habit_challenges").select("id,title,ends_on,published").order("id")),
  ]);
  return [...classes.map(p => ({ ...p, key: `class:${p.id}` })), ...challenges.map(p => ({ key: `challenge:${p.id}`, name: p.title, ends_on: p.ends_on, status: p.published ? "published" : "draft" }))].sort((a,b) => b.ends_on.localeCompare(a.ends_on));
}
export async function loadReviewAudience(db: SupabaseClient, program: ReviewProgram) {
  const [kind, id] = program.key.split(":");
  const participants = kind === "class"
    ? (await rows<{member_id: string}>(db.from("enrollments").select("member_id").eq("session_id", id).in("status", ["active", "completed"]).order("id"))).map(p => ({ user_id: p.member_id, display_name: null }))
    : await rows<{user_id: string; display_name: string}>(db.from("challenge_participants").select("user_id,display_name").eq("challenge_id", id).order("id"));
  const [contacts, profiles, records] = await Promise.all([
    rows<{user_id: string; email: string; email_opt_in: boolean; is_test: boolean; unsubscribe_token: string}>(db.from("member_contacts").select("user_id,email,email_opt_in,is_test,unsubscribe_token").order("user_id")),
    rows<{id: string; full_name: string}>(db.from("profiles").select("id,full_name").order("id")),
    rows<ReviewRecord>(db.from("program_review_requests").select("id,member_id,email,status,sent_at").eq("program_key", program.key).order("id")),
  ]);
  const eligible = buildChallengeRecipients(participants, contacts, profiles);
  const pending = pendingReviewRecipients(eligible, records);
  return { recipients: pending.slice(0, 100), remaining: Math.max(0, pending.length - 100), records };
}

// Do not backfill historical programs when enabling automation. A seven-day
// window catches missed daily runs and definite provider rejections.
export function automaticReviewPrograms(programs: ReviewProgram[], today = detroitDate()) {
  const oldest = new Date(`${today}T12:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - 7);
  return programs.filter(p => canRequestReviews(p, today) && p.ends_on >= "2026-09-23" && p.ends_on >= oldest.toISOString().slice(0, 10));
}
